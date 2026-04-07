import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const pool = mysql.createPool({
    host: process.env.DB_HOST || '192.168.199.104',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'a123456b',
    database: process.env.DB_NAME || 'mysql',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully!');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error);
    }
}
