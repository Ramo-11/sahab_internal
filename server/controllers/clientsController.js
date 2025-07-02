const { db } = require('../../models/database');

const getAllClients = (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT CASE WHEN d.type = 'proposal' THEN d.id END) as proposal_count,
        COUNT(DISTINCT CASE WHEN d.type = 'contract' THEN d.id END) as contract_count,
        COUNT(DISTINCT CASE WHEN d.type = 'invoice' THEN d.id END) as invoice_count,
        COALESCE(SUM(CASE WHEN d.type = 'invoice' AND d.status = 'paid' THEN d.amount ELSE 0 END), 0) as total_paid
      FROM clients c
      LEFT JOIN external_documents d ON c.id = d.client_id
      WHERE c.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `;

    db.all(query, (err, clients) => {
      if (err) {
        console.error('Error fetching clients:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }
      
      res.render('clients/index', {
        title: 'Clients',
        appName: process.env.APP_NAME,
        clients: clients || []
      });
    });
  } catch (error) {
    console.error('Error in getAllClients:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const getClientById = (req, res) => {
  try {
    const clientId = req.params.id;

    // Get client details
    db.get('SELECT * FROM clients WHERE id = ?', [clientId], (err, client) => {
      if (err) {
        console.error('Error fetching client:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      if (!client) {
        return res.status(404).render('404', {
          title: '404 - Client Not Found',
          appName: process.env.APP_NAME
        });
      }

      // Get client documents by type
      const documentsQueries = {
        proposals: `SELECT * FROM external_documents WHERE client_id = ? AND type = 'proposal' ORDER BY created_at DESC`,
        contracts: `SELECT * FROM external_documents WHERE client_id = ? AND type = 'contract' ORDER BY created_at DESC`,
        invoices: `SELECT * FROM external_documents WHERE client_id = ? AND type = 'invoice' ORDER BY created_at DESC`
      };

      let completedQueries = 0;
      const results = {};
      const totalQueries = Object.keys(documentsQueries).length;

      const checkComplete = () => {
        completedQueries++;
        if (completedQueries === totalQueries) {
          res.render('clients/detail', {
            title: `${client.name} - Client Details`,
            appName: process.env.APP_NAME,
            client,
            proposals: results.proposals || [],
            contracts: results.contracts || [],
            invoices: results.invoices || []
          });
        }
      };

      // Execute all queries
      Object.entries(documentsQueries).forEach(([key, query]) => {
        db.all(query, [clientId], (err, rows) => {
          if (err) {
            console.error(`Error fetching ${key}:`, err);
            results[key] = [];
          } else {
            results[key] = rows;
          }
          checkComplete();
        });
      });

    });
  } catch (error) {
    console.error('Error in getClientById:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const createClient = (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      address,
      city,
      state,
      zip_code,
      country
    } = req.body;

    const query = `
      INSERT INTO clients (name, email, phone, company, address, city, state, zip_code, country)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name,
      email || null,
      phone || null,
      company || null,
      address || null,
      city || null,
      state || null,
      zip_code || null,
      country || 'US'
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error creating client:', err);
        if (req.headers['content-type'] === 'application/json') {
          return res.status(500).json({ error: 'Failed to create client' });
        }
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      const clientId = this.lastID;
      if (req.headers['content-type'] === 'application/json') {
        res.json({ success: true, redirectUrl: `/clients/${clientId}` });
      } else {
        res.redirect(`/clients/${clientId}`);
      }
    });
  } catch (error) {
    console.error('Error in createClient:', error);
    if (req.headers['content-type'] === 'application/json') {
      res.status(500).json({ error: 'Failed to create client' });
    } else {
      res.status(500).render('error', {
        title: 'Error',
        appName: process.env.APP_NAME,
        error
      });
    }
  }
};

const updateClient = (req, res) => {
  try {
    const clientId = req.params.id;
    const {
      name,
      email,
      phone,
      company,
      address,
      city,
      state,
      zip_code,
      country
    } = req.body;

    const query = `
      UPDATE clients 
      SET name = ?, email = ?, phone = ?, company = ?, address = ?, 
          city = ?, state = ?, zip_code = ?, country = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      name,
      email || null,
      phone || null,
      company || null,
      address || null,
      city || null,
      state || null,
      zip_code || null,
      country || 'US',
      clientId
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating client:', err);
        if (req.headers['content-type'] === 'application/json') {
          return res.status(500).json({ error: 'Failed to update client' });
        }
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      if (req.headers['content-type'] === 'application/json') {
        res.json({ success: true, redirectUrl: `/clients/${clientId}` });
      } else {
        res.redirect(`/clients/${clientId}`);
      }
    });
  } catch (error) {
    console.error('Error in updateClient:', error);
    if (req.headers['content-type'] === 'application/json') {
      res.status(500).json({ error: 'Failed to update client' });
    } else {
      res.status(500).render('error', {
        title: 'Error',
        appName: process.env.APP_NAME,
        error
      });
    }
  }
};

const deleteClient = (req, res) => {
  try {
    const clientId = req.params.id;

    // Soft delete by updating status
    db.run('UPDATE clients SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [clientId], 
      function(err) {
        if (err) {
          console.error('Error deleting client:', err);
          return res.status(500).json({ error: 'Failed to delete client' });
        }

        res.json({ success: true });
      }
    );
  } catch (error) {
    console.error('Error in deleteClient:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
};