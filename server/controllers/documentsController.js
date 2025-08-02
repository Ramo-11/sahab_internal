const { pool } = require('../../models/database');

// Get all documents (proposals, contracts, invoices)
const getAllDocuments = async (req, res) => {
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

    const result = await pool.query(query);
    const documents = result.rows.map(doc => ({
      ...doc,
      amount: doc.amount ? parseFloat(doc.amount) : null
    }));

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
const getDocumentsByType = async (req, res) => {
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
      WHERE d.type = $1
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query, [type]);
    const documents = result.rows.map(doc => ({
      ...doc,
      amount: doc.amount ? parseFloat(doc.amount) : null
    }));

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
const createDocument = async (req, res) => {
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
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
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

    const result = await pool.query(query, values);
    const documentId = result.rows[0].id;

    res.json({ 
      success: true, 
      redirectUrl: `/${type}s` 
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
const updateDocument = async (req, res) => {
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
      SET client_id = $1, type = $2, title = $3, external_url = $4, 
          description = $5, amount = $6, status = $7, updated_at = NOW()
      WHERE id = $8
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

    await pool.query(query, values);

    res.json({ 
      success: true, 
      redirectUrl: `/${type}s` 
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
const deleteDocument = async (req, res) => {
  try {
    const documentId = req.params.id;

    await pool.query('DELETE FROM external_documents WHERE id = $1', [documentId]);

    res.json({ success: true });
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