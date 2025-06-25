const { db } = require('../../models/database');

const getAllClients = (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as proposal_count,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as total_paid
      FROM clients c
      LEFT JOIN proposals p ON c.id = p.client_id
      LEFT JOIN invoices i ON c.id = i.client_id
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

      // Get client proposals
      const proposalsQuery = `
        SELECT * FROM proposals 
        WHERE client_id = ? 
        ORDER BY created_at DESC
      `;

      db.all(proposalsQuery, [clientId], (err, proposals) => {
        if (err) {
          console.error('Error fetching proposals:', err);
          proposals = [];
        }

        // Get client invoices
        const invoicesQuery = `
          SELECT * FROM invoices 
          WHERE client_id = ? 
          ORDER BY created_at DESC
        `;

        db.all(invoicesQuery, [clientId], (err, invoices) => {
          if (err) {
            console.error('Error fetching invoices:', err);
            invoices = [];
          }

          res.render('clients/detail', {
            title: `${client.name} - Client Details`,
            appName: process.env.APP_NAME,
            client,
            proposals: proposals || [],
            invoices: invoices || []
          });
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
        // Check if it's a JSON request
        if (req.headers['content-type'] === 'application/json') {
          return res.status(500).json({ error: 'Failed to update client' });
        }
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      // Check if it's a JSON request
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

const getClientProposals = (req, res) => {
  try {
    const clientId = req.params.id;

    db.all('SELECT * FROM proposals WHERE client_id = ? ORDER BY created_at DESC', 
      [clientId], 
      (err, proposals) => {
        if (err) {
          console.error('Error fetching client proposals:', err);
          return res.status(500).json({ error: 'Failed to fetch proposals' });
        }

        res.json(proposals || []);
      }
    );
  } catch (error) {
    console.error('Error in getClientProposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
};

const getClientInvoices = (req, res) => {
  try {
    const clientId = req.params.id;

    db.all('SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC', 
      [clientId], 
      (err, invoices) => {
        if (err) {
          console.error('Error fetching client invoices:', err);
          return res.status(500).json({ error: 'Failed to fetch invoices' });
        }

        res.json(invoices || []);
      }
    );
  } catch (error) {
    console.error('Error in getClientInvoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientProposals,
  getClientInvoices
};