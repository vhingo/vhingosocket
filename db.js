import mysql from 'mysql';

const db = mysql.createConnection({
  host: '93.127.185.122',
  port : 3306,
  user: 'vhingo_nodejs3',
  password: 'sachin1234',
  database: 'vhingo_db',
  connectTimeout: 20000
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Wrap the query method with a promise
export const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    db.query(sql, values, (error, results, fields) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results);
    });
  });
};

export default db;
