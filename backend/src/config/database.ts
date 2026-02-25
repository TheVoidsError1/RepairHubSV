import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Support both DATABASE_URL/DB_API_BACKEND (connection string) and individual parameters
// DB_API_BACKEND or DATABASE_URL is preferred for Neon and other cloud databases
const databaseUrl = process.env.DB_API_BACKEND || process.env.DATABASE_URL;

let pool: pg.Pool;

if (databaseUrl) {
  // Use connection string (recommended for Neon)
  const config: pg.PoolConfig = {
    connectionString: databaseUrl,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // Add SSL config for Neon
  if (databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require')) {
    config.ssl = { rejectUnauthorized: false };
  }

  pool = new Pool(config);
} else {
  // Use individual parameters (fallback for local development)
  const dbPassword = process.env.DB_PASSWORD?.trim();
  const passwordConfig = dbPassword && dbPassword.length > 0 
    ? { password: dbPassword } 
    : {};

  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'Fixphone',
    user: process.env.DB_USER || 'postgres',
    ...passwordConfig, // Only include password if it's provided
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

// Test database connection
pool.on('connect', () => {
  const connectionString = process.env.DB_API_BACKEND || process.env.DATABASE_URL;
  const dbName = process.env.DB_NAME || connectionString?.split('/').pop()?.split('?')[0] || 'Fixphone';
  console.log(`✅ Connected to PostgreSQL database: ${dbName}`);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

export default pool;
