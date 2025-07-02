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

  // Create proposals table with all required fields
  db.run(`
    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      technical_highlights TEXT,
      amount DECIMAL(10,2),
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      valid_until DATE,
      proposed_timeline TEXT,
      project_features TEXT,
      start_date DATE,
      due_date DATE,
      FOREIGN KEY (client_id) REFERENCES clients (id)
    )
  `);

  // Check for missing columns and add them
  db.all("PRAGMA table_info(proposals)", (err, columns) => {
    if (err) {
      console.error('Error checking proposals table:', err.message);
      return;
    }
    
    const columnNames = columns.map(col => col.name);
    const requiredColumns = [
      'technical_highlights',
      'proposed_timeline', 
      'project_features',
      'start_date',
      'due_date'
    ];
    
    requiredColumns.forEach(columnName => {
      if (!columnNames.includes(columnName)) {
        const columnType = (columnName === 'start_date' || columnName === 'due_date') ? 'DATE' : 'TEXT';
        db.run(`ALTER TABLE proposals ADD COLUMN ${columnName} ${columnType}`, (err) => {
          if (err) {
            console.error(`Error adding ${columnName} column:`, err.message);
          } else {
            console.log(`Added ${columnName} column to proposals table`);
          }
        });
      }
    });
  });

  // Create invoices table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      proposal_id INTEGER,
      invoice_number TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      amount DECIMAL(10,2),
      tax_amount DECIMAL(10,2) DEFAULT 0,
      total_amount DECIMAL(10,2),
      status TEXT DEFAULT 'pending',
      issue_date DATE DEFAULT CURRENT_DATE,
      due_date DATE,
      paid_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (proposal_id) REFERENCES proposals (id)
    )
  `);

  // Create proposal items table (keeping for backwards compatibility)
  db.run(`
    CREATE TABLE IF NOT EXISTS proposal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proposal_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      rate DECIMAL(10,2),
      amount DECIMAL(10,2),
      FOREIGN KEY (proposal_id) REFERENCES proposals (id)
    )
  `);

  // Create invoice items table
  db.run(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      description TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      rate DECIMAL(10,2),
      amount DECIMAL(10,2),
      FOREIGN KEY (invoice_id) REFERENCES invoices (id)
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