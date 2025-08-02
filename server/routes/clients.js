const express = require('express');
const router = express.Router();
const {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient
} = require('../controllers/clientsController');

// GET /clients - List all clients
router.get('/', getAllClients);

// GET /clients/new - Show create client form
router.get('/new', (req, res) => {
  res.render('clients/form', {
    title: 'Add New Client',
    appName: process.env.APP_NAME,
    client: null,
    action: '/clients',
    method: 'POST'
  });
});

// POST /clients - Create new client
router.post('/', createClient);

// GET /clients/:id - Show client details
router.get('/:id', getClientById);

// GET /clients/:id/edit - Show edit client form
router.get('/:id/edit', async (req, res) => {
  try {
    const { pool } = require('../../models/database');
    
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).render('404', {
        title: '404 - Client Not Found',
        appName: process.env.APP_NAME
      });
    }
    
    const client = result.rows[0];
    
    res.render('clients/form', {
      title: 'Edit Client',
      appName: process.env.APP_NAME,
      client,
      action: `/clients/${client.id}`,
      method: 'PUT'
    });
  } catch (error) {
    console.error('Error in edit route:', error);
    res.status(500).render('error', { 
      title: 'Error',
      appName: process.env.APP_NAME,
      error 
    });
  }
});

// PUT /clients/:id - Update client
router.put('/:id', updateClient);

// DELETE /clients/:id - Delete client
router.delete('/:id', deleteClient);

module.exports = router;