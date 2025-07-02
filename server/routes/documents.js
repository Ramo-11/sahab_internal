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
router.get('/new', (req, res) => {
  const { db } = require('../../models/database');
  const type = req.query.type || 'proposal';
  
  // Get clients for dropdown (only active clients)
  db.all('SELECT id, name, company FROM clients WHERE status = "active" ORDER BY name', (err, clients) => {
    if (err) {
      console.error('Error fetching clients:', err);
      return res.status(500).render('error', { 
        title: 'Error',
        appName: process.env.APP_NAME,
        error: err 
      });
    }
    
    res.render('documents/form', {
      title: `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      appName: process.env.APP_NAME,
      document: null,
      clients,
      selectedType: type,
      action: '/documents',
      method: 'POST'
    });
  });
});

// POST /documents - Create new document
router.post('/', createDocument);

// GET /documents/:id/edit - Show edit document form
router.get('/:id/edit', (req, res) => {
  try {
    const { db } = require('../../models/database');
    
    db.get('SELECT * FROM external_documents WHERE id = ?', [req.params.id], (err, document) => {
      if (err) {
        console.error('Error fetching document:', err);
        return res.status(500).render('error', { 
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err 
        });
      }
      
      if (!document) {
        return res.status(404).render('404', {
          title: '404 - Document Not Found',
          appName: process.env.APP_NAME
        });
      }
      
      // Get clients for dropdown (only active clients)
      db.all('SELECT id, name, company FROM clients WHERE status = "active" ORDER BY name', (err, clients) => {
        if (err) {
          console.error('Error fetching clients:', err);
          return res.status(500).render('error', { 
            title: 'Error',
            appName: process.env.APP_NAME,
            error: err 
          });
        }
        
        res.render('documents/form', {
          title: `Edit ${document.type.charAt(0).toUpperCase() + document.type.slice(1)}`,
          appName: process.env.APP_NAME,
          document,
          clients,
          selectedType: document.type,
          action: `/documents/${document.id}`,
          method: 'PUT'
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

// PUT /documents/:id - Update document
router.put('/:id', updateDocument);

// DELETE /documents/:id - Delete document
router.delete('/:id', deleteDocument);

module.exports = router;