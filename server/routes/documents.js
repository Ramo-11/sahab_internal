const express = require('express');
const router = express.Router();
const {
  getAllDocuments,
  getDocumentsByType,
  createDocument,
  updateDocument,
  deleteDocument
} = require('../controllers/documentsController');

// GET /documents - List all documents
router.get('/', getAllDocuments);

// GET /proposals - List all proposals
router.get('/proposals', (req, res) => {
  req.params.type = 'proposal';
  getDocumentsByType(req, res);
});

// GET /contracts - List all contracts
router.get('/contracts', (req, res) => {
  req.params.type = 'contract';
  getDocumentsByType(req, res);
});

// GET /invoices - List all invoices
router.get('/invoices', (req, res) => {
  req.params.type = 'invoice';
  getDocumentsByType(req, res);
});

// GET /documents/new - Show create document form
router.get('/new', async (req, res) => {
  try {
    const { pool } = require('../../models/database');
    const type = req.query.type || 'proposal';
    
    // Get clients for dropdown (only active clients)
    const result = await pool.query('SELECT id, name, company FROM clients WHERE status = $1 ORDER BY name', ['active']);
    
    res.render('documents/form', {
      title: `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      appName: process.env.APP_NAME,
      document: null,
      clients: result.rows,
      selectedType: type,
      action: '/documents',
      method: 'POST'
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).render('error', { 
      title: 'Error',
      appName: process.env.APP_NAME,
      error 
    });
  }
});

// POST /documents - Create new document
router.post('/', createDocument);

// GET /documents/:id/edit - Show edit document form
router.get('/:id/edit', async (req, res) => {
  try {
    const { pool } = require('../../models/database');
    
    const documentResult = await pool.query('SELECT * FROM external_documents WHERE id = $1', [req.params.id]);
    
    if (documentResult.rows.length === 0) {
      return res.status(404).render('404', {
        title: '404 - Document Not Found',
        appName: process.env.APP_NAME
      });
    }
    
    const document = documentResult.rows[0];
    
    // Get clients for dropdown (only active clients)
    const clientsResult = await pool.query('SELECT id, name, company FROM clients WHERE status = $1 ORDER BY name', ['active']);
    
    res.render('documents/form', {
      title: `Edit ${document.type.charAt(0).toUpperCase() + document.type.slice(1)}`,
      appName: process.env.APP_NAME,
      document,
      clients: clientsResult.rows,
      selectedType: document.type,
      action: `/documents/${document.id}`,
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

// PUT /documents/:id - Update document
router.put('/:id', updateDocument);

// DELETE /documents/:id - Delete document
router.delete('/:id', deleteDocument);

module.exports = router;