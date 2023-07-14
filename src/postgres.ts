const { Client } = require('pg')
export const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'bookstore',
  password: '12345',
  port: 5432,
})
client.connect(function(err: any) {
  if (err) throw err;
  console.log("Connected!");
});