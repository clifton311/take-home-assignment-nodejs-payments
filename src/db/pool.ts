import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'commissions',
  user: process.env.DB_USER ?? 'commissions',
  password: process.env.DB_PASSWORD ?? 'commissions',
});
