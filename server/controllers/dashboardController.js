const { pool } = require('../../models/database');

const getDashboardStats = async (req, res) => {
  try {
    // Get stats in parallel using Promise.all
    const [
      activeClientsResult,
      pendingClientsResult,
      totalProposalsResult,
      totalContractsResult,
      totalInvoicesResult,
      pendingInvoicesResult,
      totalCollectedResult,
      recentClientsResult,
      recentProposalsResult,
      recentInvoicesResult,
      recentContractsResult
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count
        FROM clients c
        WHERE c.status = 'active'
        AND EXISTS (
          SELECT 1 FROM external_documents d
          WHERE d.client_id = c.id AND d.type = 'contract' AND d.status = 'accepted'
        )`
      ),
      pool.query(
        `SELECT COUNT(*) as count
        FROM clients c
        WHERE c.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM external_documents d
          WHERE d.client_id = c.id AND d.type = 'contract' AND d.status = 'accepted'
        )`
      ),
      pool.query('SELECT COUNT(*) as count FROM external_documents WHERE type = $1', ['proposal']),
      pool.query('SELECT COUNT(*) as count FROM external_documents WHERE type = $1', ['contract']),
      pool.query('SELECT COUNT(*) as count FROM external_documents WHERE type = $1', ['invoice']),
      pool.query('SELECT COUNT(*) as count FROM external_documents WHERE type = $1 AND status = $2', ['invoice', 'pending']),
      pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM external_documents WHERE type = $1 AND status = $2', ['invoice', 'paid']),
      pool.query(`
        SELECT id, name, company, email, created_at 
        FROM clients 
        WHERE status = 'active'
        ORDER BY created_at DESC 
        LIMIT 5
      `),
      pool.query(`
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = 'proposal'
        ORDER BY d.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = 'invoice'
        ORDER BY d.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT d.id, d.title, d.amount, d.status, d.created_at, c.name as client_name
        FROM external_documents d
        LEFT JOIN clients c ON d.client_id = c.id
        WHERE d.type = 'contract'
        ORDER BY d.created_at DESC
        LIMIT 5
      `)
    ]);

    res.render('dashboard', {
      title: 'Dashboard',
      appName: process.env.APP_NAME,
      stats: {
        activeClients: parseInt(activeClientsResult.rows[0]?.count || 0),
        pendingClients: parseInt(pendingClientsResult.rows[0]?.count || 0),
        totalProposals: parseInt(totalProposalsResult.rows[0]?.count || 0),
        totalContracts: parseInt(totalContractsResult.rows[0]?.count || 0),
        totalInvoices: parseInt(totalInvoicesResult.rows[0]?.count || 0),
        pendingInvoices: parseInt(pendingInvoicesResult.rows[0]?.count || 0),
        totalCollected: parseFloat(totalCollectedResult.rows[0]?.total || 0)
      },
      recentClients: recentClientsResult.rows || [],
      recentProposals: recentProposalsResult.rows.map(p => ({
        ...p,
        amount: p.amount ? parseFloat(p.amount) : null
      })) || [],
      recentInvoices: recentInvoicesResult.rows.map(i => ({
        ...i,
        amount: i.amount ? parseFloat(i.amount) : null
      })) || [],
      recentContracts: recentContractsResult.rows.map(c => ({
        ...c,
        amount: c.amount ? parseFloat(c.amount) : null
      })) || []
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