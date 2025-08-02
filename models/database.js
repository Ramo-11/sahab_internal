const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const initializeDatabase = async () => {
  try {
    // Create clients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT,
        company TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT DEFAULT 'US',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        status TEXT DEFAULT 'active'
      )
    `);

    // Create external_documents table for storing links to external docs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS external_documents (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('proposal', 'contract', 'invoice')),
        title TEXT NOT NULL,
        external_url TEXT NOT NULL,
        description TEXT,
        amount DECIMAL(10,2),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (client_id) REFERENCES clients (id)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

module.exports = {
  pool,
  initializeDatabase
};