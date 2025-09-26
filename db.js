import dotenv from 'dotenv';
import mysql from 'mysql2';
dotenv.config();

let pool;

const createPool = () => {
  const newPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Handle connection errors gracefully
  newPool.on('error', (err) => {
    console.error('MySQL Pool Error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔁 Reconnecting MySQL pool...');
      pool = createPool(); // ✅ Safely reassign outer variable
    } else {
      throw err;
    }
  });

  return newPool;
};

// ✅ Initialize pool once
pool = createPool();

export const query = (sql, values = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
};

export default pool;
