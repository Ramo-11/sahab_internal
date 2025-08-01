const { db } = require('../../models/database');

const getDashboardStats = (req, res) => {
  try {
    // Get stats in parallel
    const statsQueries = {
      totalClients: 'SELECT COUNT(*) as count FROM clients WHERE status = "active"',
      totalProposals: 'SELECT COUNT(*) as count FROM external_documents WHERE type = "proposal"',
      totalContracts: 'SELECT COUNT(*) as count FROM external_documents WHERE type = "contract"',
      totalInvoices: 'SELECT COUNT(*) as count FROM external_documents WHERE type = "invoice"',
      pendingInvoices: 'SELECT COUNT(*) as count FROM external_documents WHERE type = "invoice" AND status = "pending"',
      totalCollected: 'SELECT COALESCE(SUM(amount), 0) as total FROM external_documents WHERE type = "invoice" AND status = "paid"',
      debugInvoices: 'SELECT id, title, amount, status FROM external_documents WHERE type = "invoice"',
      recentClients: `
        SELECT id, name, company, email, created_at 
        FROM clients 
        ORDER BY created_at DESC 
        LIMIT 5
      `,
      recentProposals: `
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = "proposal"
        ORDER BY d.created_at DESC
        LIMIT 5
      `,
      recentInvoices: `
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = "invoice"
        ORDER BY d.created_at DESC
        LIMIT 5
      `,
      recentContracts: `
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = "contract"
        ORDER BY d.created_at DESC
        LIMIT 5
      `
    };

    let completedQueries = 0;
    const results = {};
    const totalQueries = Object.keys(statsQueries).length;

    const checkComplete = () => {
      completedQueries++;
      if (completedQueries === totalQueries) {
        res.render('dashboard', {
          title: 'Dashboard',
          appName: process.env.APP_NAME,
          stats: {
            totalClients: results.totalClients[0]?.count || 0,
            totalProposals: results.totalProposals[0]?.count || 0,
            totalContracts: results.totalContracts[0]?.count || 0,
            totalInvoices: results.totalInvoices[0]?.count || 0,
            pendingInvoices: results.pendingInvoices[0]?.count || 0,
            totalCollected: (results.totalCollected && results.totalCollected[0] && results.totalCollected[0].total !== undefined) ? 
                           results.totalCollected[0].total : 0
          },
          recentClients: results.recentClients || [],
          recentProposals: results.recentProposals || [],
          recentInvoices: results.recentInvoices || [],
          recentContracts: results.recentContracts || []
        });
      }
    };

    // Execute all queries
    Object.entries(statsQueries).forEach(([key, query]) => {
      db.all(query, (err, rows) => {
        if (err) {
          console.error(`Error executing ${key} query:`, err);
          results[key] = [];
        } else {
          results[key] = rows;
        }
        checkComplete();
      });
    });

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

module.exports = {
  getDashboardStats
};