import express, {Request, Response} from "express";
import cors from "cors";
import { connectToDb, getDb } from "./db";
import {client as PostgresClient} from "./postgres"
import { ObjectId } from "mongodb";
const app = express();
app.use(express.json());
app.use(cors());


interface Book {
  title: string;
  author: string;
  pages: number;
  rating: number;
  genre: string;
  review?: string;
}

function isValidBook(book: Book): boolean {
  if (
    book.title &&
    book.author &&
    typeof book.pages === "number" &&
    typeof book.rating === "number" &&
    book.genre &&
    book.rating >= 0 &&
    book.rating <= 10
  ) {
    return true;
  }
  return false;
}

const validateBookUpdates = (updates: Book) => {
  if (!updates.title || !updates.author || !updates.pages || !updates.rating || !updates.genre) {
    return "Please provide all the required fields: title, author, pages, rating, genre";
  }

  const rating = parseFloat(updates.rating.toString());
  if (isNaN(rating) || rating < 0 || rating > 10) {
    return "Rating must be a number between 0 and 10";
  }
  return null;
};





//data connection
let db: any;
connectToDb((err: any) => {
  if (!err) {
    app.listen(8080, () => {
      console.log("application listening");
    });

    db = getDb();
  }
});

app.get("/books", (req: Request, res: Response) => {
  //current

  const page = Number(req.query.p) || 0;
  const bookPerPage = 3;
  let books: any[] = [];
  db.collection("books")
    .find()
    .sort({ author: 1 })
    .skip(page * bookPerPage)
    .limit(bookPerPage)
    .forEach((book: any) => books.push(book))
    .then(() => {
      return res.status(200).json(books);
    })
    .catch(() => {
      return res.status(500).json({ error: "Could not fetch the documents" });
    });
});

app.get("/books/:id", (req: Request, res: Response) => {
  if (ObjectId.isValid(req.params.id)) {
    db.collection("books")
      .findOne({ _id: new ObjectId(req.params.id) })
      .then((doc: any) => {
        res.status(200).json(doc);
      })
      .catch(() => {
        res.status(500).json({ error: "Could not fetch documents" });
      });
  } else {
    res.status(500).json({ error: "Not a valid Document ID" });
  }
});

app.post("/books", (req: Request, res: Response) => {
  const book: Book = req.body;

  if (!isValidBook(book)) {
    return res.status(400).json({ error: "Invalid book object" });
  }

  db.collection("books")
    .insertOne(book)
    .then((result: any) => {
      res.status(201).json(result);
    })
    .catch(() => {
      res.status(500).json("Could not a new Document");
    });
});

app.delete("/books/:id", (req: Request, res: Response) => {
  if (ObjectId.isValid(req.params.id)) {
    db.collection("books")
      .deleteOne({ _id: new ObjectId(req.params.id) })
      .then((result: any) => {
        res.status(200).json(result);
      })
      .catch(() => {
        res.status(500).json({ error: "Could not delete documents" });
      });
  } else {
    res.status(500).json({ error: "Not a valid Document ID" });
  }
});

app.patch("/books/:id", (req: Request, res: Response) => {
  const updates = req.body;
  if (ObjectId.isValid(req.params.id)) {
    db.collection("books")
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates })
      .then((result: any) => {
        res.status(200).json(result);
      })
      .catch(() => {
        res.status(500).json({ error: "Could not delete documents" });
      });
  } else {
    res.status(500).json({ error: "Not a valid Document ID" });
  }
});


app.get("/pg/books", async (req: Request, res: Response) => {
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    try {
        const offset = (page - 1) * limit;
        const query = `SELECT * FROM books OFFSET ${offset} LIMIT ${limit}`;
      const results = await PostgresClient.query('SELECT * FROM books');
      return res.status(200).json(results.rows);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Could not fetch documents" });
    }
  });

  app.get("/pg/books/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    try {
      const { rows } = await PostgresClient.query(
        "SELECT * FROM books WHERE id = $1",
        [id]
      );
      if (rows.length === 0) {
        res.status(404).json({ error: "Book not found" });
      } else {
        res.status(200).json(rows[0]);
      }
    } catch (error) {
      res.status(500).json({ error: "Could not fetch the document" });
    }
  });

 




  app.post("/pg/books", async (req: Request, res: Response) => {
    const book: Book = req.body;
    
    if (!isValidBook(book)) {
      return res.status(400).json({ error: "Invalid book object" });
    }

    try {
      const { rows } = await PostgresClient.query(
        "INSERT INTO books (title, author, pages, rating, genre) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [book.title, book.author, book.pages, book.rating, book.genre]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Could not insert a new document" });
    }
  });


  app.delete("/pg/books/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const { rowCount } = await PostgresClient.query(
        "DELETE FROM books WHERE id = $1",
        [id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.status(200).json({ message: "Book deleted successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Could not delete the book" });
    }
  });

  app.patch("/pg/books/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    //validate the update
    const validationError = validateBookUpdates(updates);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }


    try {
      const { rowCount } = await PostgresClient.query(
        "UPDATE books SET title = $1, author = $2, pages = $3, rating = $4, genre = $5 WHERE id = $6",
        [updates.title, updates.author, updates.pages, updates.rating, updates.genre, id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ error: "Book not found" });
      }
      res.status(200).json({ message: "Book updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Could not update the book" });
    }
  });