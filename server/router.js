const express = require('express');
const router = express.Router();

// Controllers
const dashboardController = require('./controllers/dashboardController');
const clientController = require('./controllers/clientController');
const proposalController = require('./controllers/proposalController');
const invoiceController = require('./controllers/invoiceController');
const analysisController = require('./controllers/analysisController');
const expensesController = require('./controllers/expensesController');
const investmentsController = require('./controllers/investmentsController');
const toolsController = require('./controllers/toolsController');

/**
 * Dashboard Routes
 */
router.get('/', dashboardController.showDashboard);
router.get('/api/dashboard/stats', dashboardController.getStats);
router.get('/api/dashboard/recent', dashboardController.getRecent);
router.get('/api/dashboard/alerts', dashboardController.getAlerts);

/**
 * Client Routes
 */
// Views
router.get('/clients', clientController.showClients);
router.get('/clients/new', clientController.showNewClient);
router.get('/clients/:id', clientController.showClient);

// API
router.get('/api/clients', clientController.getClients);
router.post('/api/clients', clientController.createClient);
router.get('/api/clients/:id', clientController.getClient);
router.put('/api/clients/:id', clientController.updateClient);
router.delete('/api/clients/:id', clientController.deleteClient);
router.post('/api/clients/:id/notes', clientController.updateNotes);
router.get('/api/clients/:id/history', clientController.getHistory);

/**
 * Proposal Routes
 */
// Views
router.get('/proposals', proposalController.showProposals);
router.get('/proposals/new', proposalController.showNewProposal);
router.get('/proposals/:id', proposalController.showProposal);
router.get('/proposals/:id/edit', proposalController.showEditProposal);

// API
router.get('/api/proposals', proposalController.getProposals);
router.post('/api/proposals', proposalController.createProposal);
router.get('/api/proposals/:id', proposalController.getProposal);
router.put('/api/proposals/:id', proposalController.updateProposal);
router.delete('/api/proposals/:id', proposalController.deleteProposal);
router.post('/api/proposals/:id/send', proposalController.sendProposal);
router.post('/api/proposals/:id/status', proposalController.updateStatus);
router.get('/api/proposals/:id/preview', proposalController.previewProposal);

/**
 * Invoice Routes
 */
// Views
router.get('/invoices', invoiceController.showInvoices);
router.get('/invoices/:id', invoiceController.showInvoice);
router.get('/invoices/:id/edit', invoiceController.showEditInvoice);

// API
router.get('/api/invoices', invoiceController.getInvoices);
router.post('/api/invoices', invoiceController.createInvoice);
router.get('/api/invoices/:id', invoiceController.getInvoice);
router.put('/api/invoices/:id', invoiceController.updateInvoice);
router.delete('/api/invoices/:id', invoiceController.deleteInvoice);
router.post('/api/invoices/:id/send', invoiceController.sendInvoice);
router.post('/api/invoices/:id/payment', invoiceController.recordPayment);
router.post('/api/invoices/:id/reminder', invoiceController.sendReminder);
router.get('/api/invoices/:id/preview', invoiceController.previewInvoice);
router.put('/api/invoices/:id/notes', invoiceController.updateNotes);

/**
 * Analysis Routes
 */
router.get('/analysis', analysisController.showAnalysis);
router.get('/api/analysis/revenue', analysisController.getRevenue);
router.get('/api/analysis/clients', analysisController.getClientAnalysis);
router.get('/api/analysis/proposals', analysisController.getProposalAnalysis);
router.get('/api/analysis/invoices', analysisController.getInvoiceAnalysis);
router.get('/api/analysis/trends', analysisController.getTrends);
router.get('/api/analysis/export', analysisController.exportData);

/**
 * Expense Routes
 */
// Views
router.get('/expenses', expensesController.showExpenses);

// API
router.get('/api/expenses', expensesController.getExpenses);
router.post('/api/expenses', expensesController.createExpense);
router.put('/api/expenses/:id', expensesController.updateExpense);
router.delete('/api/expenses/:id', expensesController.deleteExpense);
router.get('/api/expenses/stats', expensesController.getExpenseStats);

/**
 * Investment Routes
 */
// Views
router.get('/investments', investmentsController.showInvestments);

// API
router.get('/api/investments', investmentsController.getInvestments);
router.post('/api/investments', investmentsController.createInvestment);
router.get('/api/investments/stats', investmentsController.getInvestmentStats);
router.get('/api/investments/:id', investmentsController.getInvestment);
router.put('/api/investments/:id', investmentsController.updateInvestment);
router.delete('/api/investments/:id', investmentsController.deleteInvestment);
router.get('/api/investments/:id/returns', investmentsController.getReturns);
router.post('/api/investments/:id/returns', investmentsController.addReturn);
router.put('/api/investments/:id/returns/:returnId', investmentsController.updateReturn);
router.delete('/api/investments/:id/returns/:returnId', investmentsController.deleteReturn);

/**
 * Tools Routes
 */
// Views
router.get('/tools', toolsController.showTools);

// API - Invoice Number Generator
router.get('/api/tools/invoice-numbers', toolsController.getInvoiceNumbers);
router.post('/api/tools/invoice-numbers', toolsController.generateInvoiceNumber);
router.put('/api/tools/invoice-numbers/:id', toolsController.updateInvoiceNumber);
router.delete('/api/tools/invoice-numbers/:id', toolsController.deleteInvoiceNumber);

// API - PDF Processor
router.post('/api/tools/process-pdf', toolsController.uploadPDF, toolsController.processPDF);

/**
 * Utility Routes
 */
router.get('/api/search', (req, res) => {
    // Global search functionality
    res.json({ results: [] });
});

router.get('/api/notifications', (req, res) => {
    // Get notifications
    res.json({ notifications: [] });
});

/**
 * Error handling
 */
router.use((req, res) => {
    res.status(404).render('error', {
        title: '404 - Page Not Found',
        message: 'The page you are looking for does not exist.',
        layout: 'layout',
    });
});

module.exports = router;
