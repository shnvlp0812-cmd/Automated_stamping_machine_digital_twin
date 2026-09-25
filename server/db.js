import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'digital_twin',
    password: process.env.DB_PASSWORD || 'suhani08',
    port: process.env.DB_PORT || 5432,
});

export default {
    query: (text, params) => pool.query(text, params),
};
