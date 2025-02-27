import dotenv from 'dotenv';
import mysql from 'mysql2';

dotenv.config();

const createPool = () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Limits open connections to avoid overload
    queueLimit: 0, // No limit on queued connections
  });

  // Handle connection errors
  pool.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('Reconnecting to MySQL...');
      pool = createPool(); // Recreate the pool
    } else {
      throw err;
    }
  });

  return pool;
};

let pool = createPool();

export const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results);
    });
  });
};

export default pool;
