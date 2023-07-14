import { Db, MongoClient } from "mongodb";

let dbConnection: Db 

export const connectToDb = (cb: any) => {
        MongoClient.connect("mongodb://localhost:27017/bookstore")
        .then((client) => {
            dbConnection = client.db()
            return cb()
        })
        .catch(err => {
            console.log(err)
            return cb(err)
        })
    }

export const getDb = () => dbConnection;


