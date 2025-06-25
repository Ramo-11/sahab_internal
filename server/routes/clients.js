const express = require('express');
const router = express.Router();
const {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientProposals,
  getClientInvoices
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
    const { db } = require('../../models/database');
    
    db.get('SELECT * FROM clients WHERE id = ?', [req.params.id], (err, client) => {
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
      
      res.render('clients/form', {
        title: 'Edit Client',
        appName: process.env.APP_NAME,
        client,
        action: `/clients/${client.id}`,
        method: 'PUT'
      });
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

// GET /clients/:id/proposals - Get client proposals
router.get('/:id/proposals', getClientProposals);

// GET /clients/:id/invoices - Get client invoices
router.get('/:id/invoices', getClientInvoices);

module.exports = router;