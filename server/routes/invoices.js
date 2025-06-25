const express = require('express');
const router = express.Router();
const {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid
} = require('../controllers/invoicesController');

// GET /invoices - List all invoices
router.get('/', getAllInvoices);

// GET /invoices/new - Show create invoice form
router.get('/new', (req, res) => {
  const { db } = require('../../models/database');
  
  // Get clients and proposals for dropdown
  db.all('SELECT id, name, company FROM clients ORDER BY name', (err, clients) => {
    if (err) {
      console.error('Error fetching clients:', err);
      return res.status(500).render('error', { 
        title: 'Error',
        appName: process.env.APP_NAME,
        error: err 
      });
    }
    
    db.all('SELECT id, title, client_id FROM proposals WHERE status != "rejected" ORDER BY title', (err, proposals) => {
      if (err) {
        console.error('Error fetching proposals:', err);
        return res.status(500).render('error', { 
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err 
        });
      }
      
      res.render('invoices/form', {
        title: 'Create New Invoice',
        appName: process.env.APP_NAME,
        invoice: null,
        clients,
        proposals,
        action: '/invoices',
        method: 'POST'
      });
    });
  });
});

// POST /invoices - Create new invoice
router.post('/', createInvoice);

// GET /invoices/:id - Show invoice details
router.get('/:id', getInvoiceById);

// GET /invoices/:id/edit - Show edit invoice form
router.get('/:id/edit', async (req, res) => {
  try {
    const { db } = require('../../models/database');
    
    // Get invoice, clients, and proposals
    db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, invoice) => {
      if (err) {
        console.error('Error fetching invoice:', err);
        return res.status(500).render('error', { 
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err 
        });
      }
      
      if (!invoice) {
        return res.status(404).render('404', {
          title: '404 - Invoice Not Found',
          appName: process.env.APP_NAME
        });
      }
      
      // Get clients and proposals for dropdown
      db.all('SELECT id, name, company FROM clients ORDER BY name', (err, clients) => {
        if (err) {
          console.error('Error fetching clients:', err);
          return res.status(500).render('error', { 
            title: 'Error',
            appName: process.env.APP_NAME,
            error: err 
          });
        }
        
        db.all('SELECT id, title, client_id FROM proposals WHERE status != "rejected" ORDER BY title', (err, proposals) => {
          if (err) {
            console.error('Error fetching proposals:', err);
            return res.status(500).render('error', { 
              title: 'Error',
              appName: process.env.APP_NAME,
              error: err 
            });
          }
          
          res.render('invoices/form', {
            title: 'Edit Invoice',
            appName: process.env.APP_NAME,
            invoice,
            clients,
            proposals,
            action: `/invoices/${invoice.id}`,
            method: 'PUT'
          });
        });
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

// PUT /invoices/:id - Update invoice
router.put('/:id', updateInvoice);

// POST /invoices/:id/mark-paid - Mark invoice as paid
router.post('/:id/mark-paid', markInvoicePaid);

// DELETE /invoices/:id - Delete invoice
router.delete('/:id', deleteInvoice);

module.exports = router;