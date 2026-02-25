import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Customer, Personnel, Part, Repair } from './src/entities/index.js';

dotenv.config();

// Support both DATABASE_URL/DB_API_BACKEND (connection string) and individual parameters
// DB_API_BACKEND or DATABASE_URL is preferred for Neon and other cloud databases
let databaseUrl = process.env.DB_API_BACKEND || process.env.DATABASE_URL;

// Normalize SSL mode in connection string to fix pg v9.0.0 warning
// Replace 'prefer', 'require', 'verify-ca' with 'verify-full' for future compatibility
if (databaseUrl) {
  // Replace deprecated SSL modes with verify-full
  databaseUrl = databaseUrl.replace(
    /([?&])sslmode=(prefer|require|verify-ca)(&|$)/gi,
    '$1sslmode=verify-full$3'
  );
  
  // If no sslmode is specified and it's a Neon database, add sslmode=verify-full
  if (databaseUrl.includes('neon.tech') && !databaseUrl.includes('sslmode=')) {
    databaseUrl += (databaseUrl.includes('?') ? '&' : '?') + 'sslmode=verify-full';
  }
}

let dataSourceConfig: any;

if (databaseUrl) {
  // Use connection string (recommended for Neon)
  dataSourceConfig = {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false, // Never use synchronize in production, use migrations
    logging: true,
    entities: [Customer, Personnel, Part, Repair],
    migrations: ['src/migrations/**/*.ts', 'dist/migrations/**/*.js'],
    subscribers: ['src/subscribers/**/*.ts', 'dist/subscribers/**/*.js'],
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : undefined,
  };
} else {
  // Use individual parameters (fallback for local development)
  const dbPassword = process.env.DB_PASSWORD?.trim();
  const passwordConfig = dbPassword && dbPassword.length > 0 
    ? { password: dbPassword } 
    : {};

  dataSourceConfig = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'Fixphone',
    username: process.env.DB_USER || 'postgres',
    ...passwordConfig,
    synchronize: false, // Never use synchronize in production, use migrations
    logging: true,
    entities: [Customer, Personnel, Part, Repair],
    migrations: ['src/migrations/**/*.ts', 'dist/migrations/**/*.js'],
    subscribers: ['src/subscribers/**/*.ts', 'dist/subscribers/**/*.js'],
  };
}

// TypeORM CLI configuration
export default new DataSource(dataSourceConfig);
