const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './database/business.db';
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

const initializeDatabase = () => {
  // Create clients table
  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      company TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      country TEXT DEFAULT 'US',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active'
    )
  `);

  // Create external_documents table for storing links to external docs
  db.run(`
    CREATE TABLE IF NOT EXISTS external_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('proposal', 'contract', 'invoice')),
      title TEXT NOT NULL,
      external_url TEXT NOT NULL,
      description TEXT,
      amount DECIMAL(10,2),
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )
  `);

  // Insert sample data
  insertSampleData();
};

const insertSampleData = () => {
  // Check if clients exist
  db.get("SELECT COUNT(*) as count FROM clients", (err, row) => {
    if (err) {
      console.error('Error checking clients:', err.message);
      return;
    }
    
    if (row.count === 0) {
      // Insert sample clients
      const sampleClients = [
        ['Acme Corporation', 'contact@acme.com', '(555) 123-4567', 'Acme Corp', '123 Business St', 'New York', 'NY', '10001'],
        ['Tech Solutions Inc', 'info@techsolutions.com', '(555) 987-6543', 'Tech Solutions', '456 Innovation Ave', 'San Francisco', 'CA', '94105'],
        ['Green Energy LLC', 'hello@greenenergy.com', '(555) 456-7890', 'Green Energy', '789 Renewable Dr', 'Austin', 'TX', '73301']
      ];

      sampleClients.forEach(client => {
        db.run(`
          INSERT INTO clients (name, email, phone, company, address, city, state, zip_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, client);
      });

      console.log('Sample clients inserted');
    }
  });
};

module.exports = {
  db,
  initializeDatabase
};