const { db } = require('../../models/database');

// Get all documents (proposals, contracts, invoices)
const getAllDocuments = (req, res) => {
  try {
    const query = `
      SELECT 
        d.*,
        c.name as client_name,
        c.company as client_company
      FROM external_documents d
      LEFT JOIN clients c ON d.client_id = c.id
      ORDER BY d.created_at DESC
    `;

    db.all(query, (err, documents) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      // Separate documents by type
      const proposals = documents.filter(doc => doc.type === 'proposal');
      const contracts = documents.filter(doc => doc.type === 'contract');
      const invoices = documents.filter(doc => doc.type === 'invoice');

      res.render('documents/index', {
        title: 'Documents',
        appName: process.env.APP_NAME,
        proposals: proposals || [],
        contracts: contracts || [],
        invoices: invoices || []
      });
    });
  } catch (error) {
    console.error('Error in getAllDocuments:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

// Get documents by type
const getDocumentsByType = (req, res) => {
  try {
    const type = req.params.type;
    
    if (!['proposal', 'contract', 'invoice'].includes(type)) {
      return res.status(404).render('404', {
        title: '404 - Page Not Found',
        appName: process.env.APP_NAME
      });
    }

    const query = `
      SELECT 
        d.*,
        c.name as client_name,
        c.company as client_company
      FROM external_documents d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.type = ?
      ORDER BY d.created_at DESC
    `;

    db.all(query, [type], (err, documents) => {
      if (err) {
        console.error('Error fetching documents:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      const titleMap = {
        'proposal': 'Proposals',
        'contract': 'Contracts', 
        'invoice': 'Invoices'
      };

      res.render('documents/type', {
        title: titleMap[type],
        appName: process.env.APP_NAME,
        documents: documents || [],
        type: type
      });
    });
  } catch (error) {
    console.error('Error in getDocumentsByType:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

// Create new document link
const createDocument = (req, res) => {
  try {
    const {
      client_id,
      type,
      title,
      external_url,
      description,
      amount,
      status
    } = req.body;

    const query = `
      INSERT INTO external_documents (
        client_id, type, title, external_url, description, amount, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      client_id,
      type,
      title,
      external_url,
      description || null,
      amount || null,
      status || 'pending'
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error creating document:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create document link' 
        });
      }

      const documentId = this.lastID;
      res.json({ 
        success: true, 
        redirectUrl: `/${type}s` 
      });
    });
  } catch (error) {
    console.error('Error in createDocument:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create document link' 
    });
  }
};

// Update document
const updateDocument = (req, res) => {
  try {
    const documentId = req.params.id;
    const {
      client_id,
      type,
      title,
      external_url,
      description,
      amount,
      status
    } = req.body;

    const query = `
      UPDATE external_documents 
      SET client_id = ?, type = ?, title = ?, external_url = ?, 
          description = ?, amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      client_id,
      type,
      title,
      external_url,
      description || null,
      amount || null,
      status || 'pending',
      documentId
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating document:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update document' 
        });
      }

      res.json({ 
        success: true, 
        redirectUrl: `/${type}s` 
      });
    });
  } catch (error) {
    console.error('Error in updateDocument:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update document' 
    });
  }
};

// Delete document
const deleteDocument = (req, res) => {
  try {
    const documentId = req.params.id;

    db.run('DELETE FROM external_documents WHERE id = ?', [documentId], function(err) {
      if (err) {
        console.error('Error deleting document:', err);
        return res.status(500).json({ error: 'Failed to delete document' });
      }

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

module.exports = {
  getAllDocuments,
  getDocumentsByType,
  createDocument,
  updateDocument,
  deleteDocument
};