const { pool } = require('../../models/database');

const getAllClients = async (req, res) => {
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

    const result = await pool.query(query);
    
    // Convert numeric fields to proper numbers
    const clients = result.rows.map(client => ({
      ...client,
      proposal_count: parseInt(client.proposal_count) || 0,
      contract_count: parseInt(client.contract_count) || 0,
      invoice_count: parseInt(client.invoice_count) || 0,
      total_paid: parseFloat(client.total_paid) || 0
    }));
    
    res.render('clients/index', {
      title: 'Clients',
      appName: process.env.APP_NAME,
      clients: clients || []
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

const getClientById = async (req, res) => {
  try {
    const clientId = req.params.id;

    // Get client details
    const clientResult = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).render('404', {
        title: '404 - Client Not Found',
        appName: process.env.APP_NAME
      });
    }

    const client = clientResult.rows[0];

    // Get client documents by type
    const [proposalsResult, contractsResult, invoicesResult] = await Promise.all([
      pool.query('SELECT * FROM external_documents WHERE client_id = $1 AND type = $2 ORDER BY created_at DESC', [clientId, 'proposal']),
      pool.query('SELECT * FROM external_documents WHERE client_id = $1 AND type = $2 ORDER BY created_at DESC', [clientId, 'contract']),
      pool.query('SELECT * FROM external_documents WHERE client_id = $1 AND type = $2 ORDER BY created_at DESC', [clientId, 'invoice'])
    ]);

    // Convert amounts to floats
    const proposals = proposalsResult.rows.map(p => ({
      ...p,
      amount: p.amount ? parseFloat(p.amount) : null
    }));
    const contracts = contractsResult.rows.map(c => ({
      ...c,
      amount: c.amount ? parseFloat(c.amount) : null
    }));
    const invoices = invoicesResult.rows.map(i => ({
      ...i,
      amount: i.amount ? parseFloat(i.amount) : null
    }));

    res.render('clients/detail', {
      title: `${client.name} - Client Details`,
      appName: process.env.APP_NAME,
      client,
      proposals,
      contracts,
      invoices
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

const createClient = async (req, res) => {
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
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

    const result = await pool.query(query, values);
    const clientId = result.rows[0].id;

    if (req.headers['content-type'] === 'application/json') {
      res.json({ success: true, redirectUrl: `/clients/${clientId}` });
    } else {
      res.redirect(`/clients/${clientId}`);
    }
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

const updateClient = async (req, res) => {
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
      SET name = $1, email = $2, phone = $3, company = $4, address = $5, 
          city = $6, state = $7, zip_code = $8, country = $9, updated_at = NOW()
      WHERE id = $10
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

    await pool.query(query, values);

    if (req.headers['content-type'] === 'application/json') {
      res.json({ success: true, redirectUrl: `/clients/${clientId}` });
    } else {
      res.redirect(`/clients/${clientId}`);
    }
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

const deleteClient = async (req, res) => {
  try {
    const clientId = req.params.id;

    // Soft delete by updating status
    await pool.query('UPDATE clients SET status = $1, updated_at = NOW() WHERE id = $2', ['inactive', clientId]);

    res.json({ success: true });
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