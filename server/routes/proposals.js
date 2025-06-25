const express = require('express');
const router = express.Router();
const {
  getAllProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal
} = require('../controllers/proposalsController');

// GET /proposals - List all proposals
router.get('/', getAllProposals);

// GET /proposals/new - Show create proposal form
router.get('/new', (req, res) => {
  const { db } = require('../../models/database');
  
  // Get clients for dropdown
  db.all('SELECT id, name, company FROM clients ORDER BY name', (err, clients) => {
    if (err) {
      console.error('Error fetching clients:', err);
      return res.status(500).render('error', { 
        title: 'Error',
        appName: process.env.APP_NAME,
        error: err 
      });
    }
    
    res.render('proposals/form', {
      title: 'Create New Proposal',
      appName: process.env.APP_NAME,
      proposal: null,
      clients,
      action: '/proposals',
      method: 'POST'
    });
  });
});

// POST /proposals - Create new proposal
router.post('/', createProposal);

// GET /proposals/:id - Show proposal details
router.get('/:id', getProposalById);

// GET /proposals/:id/edit - Show edit proposal form
router.get('/:id/edit', async (req, res) => {
  try {
    const { db } = require('../../models/database');
    
    // Get proposal and clients
    db.get('SELECT * FROM proposals WHERE id = ?', [req.params.id], (err, proposal) => {
      if (err) {
        console.error('Error fetching proposal:', err);
        return res.status(500).render('error', { 
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err 
        });
      }
      
      if (!proposal) {
        return res.status(404).render('404', {
          title: '404 - Proposal Not Found',
          appName: process.env.APP_NAME
        });
      }
      
      // Get clients for dropdown
      db.all('SELECT id, name, company FROM clients ORDER BY name', (err, clients) => {
        if (err) {
          console.error('Error fetching clients:', err);
          return res.status(500).render('error', { 
            title: 'Error',
            appName: process.env.APP_NAME,
            error: err 
          });
        }
        
        res.render('proposals/form', {
          title: 'Edit Proposal',
          appName: process.env.APP_NAME,
          proposal,
          clients,
          action: `/proposals/${proposal.id}`,
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

// PUT /proposals/:id - Update proposal
router.put('/:id', updateProposal);

// DELETE /proposals/:id - Delete proposal
router.delete('/:id', deleteProposal);

module.exports = router;