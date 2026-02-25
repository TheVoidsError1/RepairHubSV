import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Customer, Personnel, Part, Repair, WarrantyClaim, Transaction } from '../entities/index.js';

dotenv.config();

// Support both DATABASE_URL/DB_API_BACKEND (connection string) and individual parameters
// DB_API_BACKEND or DATABASE_URL is preferred for Neon and other cloud databases
const databaseUrl = process.env.DB_API_BACKEND || process.env.DATABASE_URL;

let dataSourceConfig: any;

// Determine migrations path based on environment
const isProduction = process.env.NODE_ENV === 'production';
const migrationsPath = isProduction 
  ? ['dist/migrations/**/*.js'] 
  : ['src/migrations/**/*.ts'];
const subscribersPath = isProduction 
  ? ['dist/subscribers/**/*.js'] 
  : ['src/subscribers/**/*.ts'];

if (databaseUrl) {
  // Use connection string (recommended for Neon)
  dataSourceConfig = {
    type: 'postgres',
    url: databaseUrl,
    synchronize: process.env.NODE_ENV === 'development', // Auto sync schema in dev (use migrations in production)
    logging: process.env.NODE_ENV === 'development',
    entities: [Customer, Personnel, Part, Repair, WarrantyClaim, Transaction],
    migrations: migrationsPath,
    subscribers: subscribersPath,
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
    synchronize: process.env.NODE_ENV === 'development', // Auto sync schema in dev (use migrations in production)
    logging: process.env.NODE_ENV === 'development',
    entities: [Customer, Personnel, Part, Repair, WarrantyClaim, Transaction],
    migrations: migrationsPath,
    subscribers: subscribersPath,
  };
}

export const AppDataSource = new DataSource(dataSourceConfig);

// Initialize database connection
export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ TypeORM DataSource has been initialized successfully');
    
    // Get database name from connection string or env variable
    const connectionString = process.env.DB_API_BACKEND || process.env.DATABASE_URL;
    const dbName = connectionString 
      ? connectionString.split('/').pop()?.split('?')[0] || 'unknown'
      : process.env.DB_NAME || 'Fixphone';
    console.log(`📊 Connected to database: ${dbName}`);
    return true;
  } catch (error) {
    console.error('❌ Error during DataSource initialization:', error);
    throw error;
  }
};

// Close database connection
export const closeDatabase = async () => {
  try {
    await AppDataSource.destroy();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};
