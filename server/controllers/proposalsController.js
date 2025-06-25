const { db } = require('../../models/database');

const getAllProposals = (req, res) => {
  try {
    const query = `
      SELECT 
        p.*,
        c.name as client_name,
        c.company as client_company
      FROM proposals p
      LEFT JOIN clients c ON p.client_id = c.id
      ORDER BY p.created_at DESC
    `;

    db.all(query, (err, proposals) => {
      if (err) {
        console.error('Error fetching proposals:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      res.render('proposals/index', {
        title: 'Proposals',
        appName: process.env.APP_NAME,
        proposals: proposals || []
      });
    });
  } catch (error) {
    console.error('Error in getAllProposals:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const getProposalById = (req, res) => {
  try {
    const proposalId = req.params.id;

    // Get proposal with client details
    const proposalQuery = `
      SELECT 
        p.*,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.state as client_state,
        c.zip_code as client_zip_code
      FROM proposals p
      LEFT JOIN clients c ON p.client_id = c.id
      WHERE p.id = ?
    `;

    db.get(proposalQuery, [proposalId], (err, proposal) => {
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

      // Get proposal items
      db.all('SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY id', 
        [proposalId], 
        (err, items) => {
          if (err) {
            console.error('Error fetching proposal items:', err);
            items = [];
          }

          res.render('proposals/detail', {
            title: `${proposal.title} - Proposal Details`,
            appName: process.env.APP_NAME,
            proposal,
            items: items || []
          });
        }
      );
    });
  } catch (error) {
    console.error('Error in getProposalById:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const createProposal = (req, res) => {
  try {
    const {
      client_id,
      title,
      description,
      amount,
      valid_until,
      proposed_timeline,
      project_features,
      items
    } = req.body;

    const query = `
      INSERT INTO proposals (client_id, title, description, amount, valid_until, proposed_timeline, project_features, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')
    `;

    const values = [
      client_id,
      title,
      description || null,
      amount || 0,
      valid_until || null,
      proposed_timeline || null,
      project_features || null
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error creating proposal:', err);
        if (req.headers['content-type'] === 'application/json') {
          return res.status(500).json({ error: 'Failed to create proposal' });
        }
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      const proposalId = this.lastID;

      // Insert proposal items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const itemQuery = `
          INSERT INTO proposal_items (proposal_id, description, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?)
        `;

        let completedItems = 0;
        const totalItems = items.length;

        items.forEach(item => {
          const itemAmount = (item.quantity || 1) * (item.rate || 0);
          db.run(itemQuery, [
            proposalId,
            item.description,
            item.quantity || 1,
            item.rate || 0,
            itemAmount
          ], (err) => {
            if (err) {
              console.error('Error inserting proposal item:', err);
            }
            
            completedItems++;
            if (completedItems === totalItems) {
              if (req.headers['content-type'] === 'application/json') {
                res.json({ success: true, redirectUrl: `/proposals/${proposalId}` });
              } else {
                res.redirect(`/proposals/${proposalId}`);
              }
            }
          });
        });
      } else {
        if (req.headers['content-type'] === 'application/json') {
          res.json({ success: true, redirectUrl: `/proposals/${proposalId}` });
        } else {
          res.redirect(`/proposals/${proposalId}`);
        }
      }
    });
  } catch (error) {
    console.error('Error in createProposal:', error);
    if (req.headers['content-type'] === 'application/json') {
      res.status(500).json({ error: 'Failed to create proposal' });
    } else {
      res.status(500).render('error', {
        title: 'Error',
        appName: process.env.APP_NAME,
        error
      });
    }
  }
};

const updateProposal = (req, res) => {
  try {
    const proposalId = req.params.id;
    const {
      client_id,
      title,
      description,
      amount,
      status,
      valid_until,
      proposed_timeline,
      project_features
    } = req.body;

    const query = `
      UPDATE proposals 
      SET client_id = ?, title = ?, description = ?, amount = ?, 
          status = ?, valid_until = ?, proposed_timeline = ?, project_features = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      client_id,
      title,
      description || null,
      amount || 0,
      status || 'draft',
      valid_until || null,
      proposed_timeline || null,
      project_features || null,
      proposalId
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating proposal:', err);
        if (req.headers['content-type'] === 'application/json') {
          return res.status(500).json({ error: 'Failed to update proposal' });
        }
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      if (req.headers['content-type'] === 'application/json') {
        res.json({ success: true, redirectUrl: `/proposals/${proposalId}` });
      } else {
        res.redirect(`/proposals/${proposalId}`);
      }
    });
  } catch (error) {
    console.error('Error in updateProposal:', error);
    if (req.headers['content-type'] === 'application/json') {
      res.status(500).json({ error: 'Failed to update proposal' });
    } else {
      res.status(500).render('error', {
        title: 'Error',
        appName: process.env.APP_NAME,
        error
      });
    }
  }
};
const deleteProposal = (req, res) => {
  try {
    const proposalId = req.params.id;

    // Delete proposal items first
    db.run('DELETE FROM proposal_items WHERE proposal_id = ?', [proposalId], (err) => {
      if (err) {
        console.error('Error deleting proposal items:', err);
        return res.status(500).json({ error: 'Failed to delete proposal' });
      }

      // Then delete the proposal
      db.run('DELETE FROM proposals WHERE id = ?', [proposalId], function(err) {
        if (err) {
          console.error('Error deleting proposal:', err);
          return res.status(500).json({ error: 'Failed to delete proposal' });
        }

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error('Error in deleteProposal:', error);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
};

module.exports = {
  getAllProposals,
  getProposalById,
  createProposal,
  updateProposal,
  deleteProposal
};