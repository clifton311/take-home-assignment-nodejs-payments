import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { CommissionEntity } from '../entities/Commission';
import { AllocationEntity } from '../entities/Allocation';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME ?? 'commissions',
  username: process.env.DB_USER ?? 'commissions',
  password: process.env.DB_PASSWORD ?? 'commissions',
  entities: [CommissionEntity, AllocationEntity],
  synchronize: false,
});

