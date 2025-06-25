const { db } = require('../../models/database');

const getDashboardStats = (req, res) => {
  try {
    // Get stats in parallel
    const statsQueries = {
      totalClients: 'SELECT COUNT(*) as count FROM clients WHERE status = "active"',
      totalProposals: 'SELECT COUNT(*) as count FROM proposals',
      totalInvoices: 'SELECT COUNT(*) as count FROM invoices',
      pendingInvoices: 'SELECT COUNT(*) as count FROM invoices WHERE status = "pending"',
      recentClients: `
        SELECT id, name, company, email, created_at 
        FROM clients 
        ORDER BY created_at DESC 
        LIMIT 5
      `,
      recentProposals: `
        SELECT p.id, p.title, p.amount, p.status, p.created_at, c.name as client_name
        FROM proposals p
        LEFT JOIN clients c ON p.client_id = c.id
        ORDER BY p.created_at DESC
        LIMIT 5
      `,
      recentInvoices: `
        SELECT i.id, i.invoice_number, i.title, i.total_amount, i.status, i.due_date, c.name as client_name
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        ORDER BY i.created_at DESC
        LIMIT 5
      `,
      overdueInvoices: `
        SELECT i.id, i.invoice_number, i.title, i.total_amount, i.due_date, c.name as client_name
        FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.status = "pending" AND i.due_date < date('now')
        ORDER BY i.due_date ASC
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
            totalInvoices: results.totalInvoices[0]?.count || 0,
            pendingInvoices: results.pendingInvoices[0]?.count || 0
          },
          recentClients: results.recentClients || [],
          recentProposals: results.recentProposals || [],
          recentInvoices: results.recentInvoices || [],
          overdueInvoices: results.overdueInvoices || []
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