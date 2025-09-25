const Invoice = require('../../models/Invoice');
const Client = require('../../models/Client');
const Proposal = require('../../models/Proposal');
const { logger } = require('../logger');

/**
 * Show invoices list
 */
const showInvoices = async (req, res) => {
    try {
        const { status, client, search, sort = '-createdAt' } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (client) filter.client = client;
        if (search) {
            filter.$or = [
                { invoiceNumber: new RegExp(search, 'i') },
                { title: new RegExp(search, 'i') },
            ];
        }

        // Fetch invoices with virtual fields
        const invoices = await Invoice.find(filter)
            .populate('client', 'name company')
            .sort(sort)
            .lean(); // Use lean for better performance

        // Calculate balance due for each invoice
        const invoicesWithBalance = invoices.map((invoice) => ({
            ...invoice,
            balanceDue: invoice.amount - (invoice.amountPaid || 0),
            isOverdue:
                invoice.status !== 'paid' &&
                invoice.status !== 'cancelled' &&
                new Date() > new Date(invoice.dueDate),
        }));

        // Fetch all clients for the filter dropdown AND modal
        const clients = await Client.find({ status: { $ne: 'archived' } })
            .select('name company')
            .sort('name');

        res.render('invoices/index', {
            title: 'Invoices - Sahab Solutions',
            layout: 'layout',
            invoices: invoicesWithBalance,
            clients,
            additionalCSS: ['invoices.css'],
            additionalJS: ['invoices.js'],
            filters: { status, client, search },
            activeTab: 'invoices',
        });
    } catch (error) {
        logger.error('Show invoices error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load invoices',
            layout: 'layout',
        });
    }
};

/**
 * Show invoice details
 */
const showInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('client')
            .populate('proposal', 'title');

        if (!invoice) {
            return res.status(404).render('error', {
                title: 'Invoice Not Found',
                message: 'The requested invoice could not be found',
                layout: 'layout',
            });
        }

        res.render('invoices/view', {
            title: `Invoice #${invoice.invoiceNumber} - Sahab Solutions`,
            layout: 'layout',
            invoice,
            additionalCSS: ['invoices.css'],
            additionalJS: ['invoices.js'],
            activeTab: 'invoices',
        });
    } catch (error) {
        logger.error('Show invoice error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load invoice',
            layout: 'layout',
        });
    }
};

/**
 * Show edit invoice form
 */
const showEditInvoice = async (req, res) => {
    try {
        const [invoice, clients] = await Promise.all([
            Invoice.findById(req.params.id).populate('client'),
            Client.find({ status: 'active' }).sort('company name').select('name company email'),
        ]);

        if (!invoice) {
            return res.status(404).render('error', {
                title: 'Invoice Not Found',
                message: 'The requested invoice could not be found',
                layout: 'layout',
            });
        }

        if (invoice.status === 'paid') {
            return res.status(400).render('error', {
                title: 'Cannot Edit',
                message: 'Paid invoices cannot be edited',
                layout: 'layout',
            });
        }

        res.render('invoices/edit', {
            title: `Edit Invoice #${invoice.invoiceNumber} - Sahab Solutions`,
            layout: 'layout',
            invoice,
            clients,
            additionalCSS: ['invoices.css'],
            additionalJS: ['invoices.js'],
            activeTab: 'invoices',
        });
    } catch (error) {
        logger.error('Show edit invoice error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load invoice',
            layout: 'layout',
        });
    }
};

/**
 * Get invoices API
 */
const getInvoices = async (req, res) => {
    try {
        const { status, client, overdue, sort = '-createdAt', page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (client) filter.client = client;
        if (overdue === 'true') {
            filter.status = { $ne: 'paid' };
            filter.dueDate = { $lt: new Date() };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [invoices, total] = await Promise.all([
            Invoice.find(filter)
                .populate('client', 'name company')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit)),
            Invoice.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: invoices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoices',
        });
    }
};

/**
 * Create new invoice
 */
const createInvoice = async (req, res) => {
    try {
        const invoiceData = req.body;

        // Calculate amounts
        let subtotal = 0;
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
            invoiceData.items = invoiceData.items.map((item) => {
                item.amount = item.quantity * item.rate;
                subtotal += item.amount;
                return item;
            });
        }

        invoiceData.subtotal = subtotal;

        // Calculate tax
        if (invoiceData.tax?.rate) {
            invoiceData.tax.amount = subtotal * (invoiceData.tax.rate / 100);
        }

        // Calculate discount
        if (invoiceData.discount?.rate) {
            invoiceData.discount.amount = subtotal * (invoiceData.discount.rate / 100);
        }

        // Calculate total
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
            invoiceData.amount =
                subtotal + (invoiceData.tax?.amount || 0) - (invoiceData.discount?.amount || 0);
        } else if (invoiceData.amount) {
            invoiceData.amount = parseFloat(invoiceData.amount);
        }

        // Set due date if not provided
        if (!invoiceData.dueDate) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);
            invoiceData.dueDate = dueDate;
        }

        const invoice = new Invoice(invoiceData);
        await invoice.save();

        logger.info(`Invoice created: ${invoice._id}`);

        res.json({
            success: true,
            data: invoice,
            message: 'Invoice created successfully',
        });
    } catch (error) {
        logger.error('Create invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create invoice',
        });
    }
};

/**
 * Get single invoice API
 */
const getInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('client')
            .populate('proposal', 'title');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        res.json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        logger.error('Get invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice',
        });
    }
};

/**
 * Update invoice
 */
const updateInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        const updates = req.body;
        delete updates._id;
        delete updates.invoiceNumber;

        // Handle status change to paid
        if (updates.status === 'paid' && invoice.status !== 'paid') {
            updates.paidDate = updates.paidDate || new Date();
            if (!updates.amountPaid || updates.amountPaid === 0) {
                updates.amountPaid = invoice.amount;
            }
        }

        // Recalculate amounts if items changed
        if (updates.items) {
            let subtotal = 0;
            updates.items = updates.items.map((item) => {
                item.amount = item.quantity * item.rate;
                subtotal += item.amount;
                return item;
            });
            updates.subtotal = subtotal;

            if (updates.tax?.rate) {
                updates.tax.amount = subtotal * (updates.tax.rate / 100);
            }
            if (updates.discount?.rate) {
                updates.discount.amount = subtotal * (updates.discount.rate / 100);
            }

            updates.amount =
                subtotal + (updates.tax?.amount || 0) - (updates.discount?.amount || 0);
        }

        updates.updatedAt = new Date();

        Object.assign(invoice, updates);
        await invoice.save();

        // If marked as paid, update client revenue
        if (updates.status === 'paid' && invoice.status !== 'paid') {
            await Client.findByIdAndUpdate(invoice.client, {
                $inc: { totalRevenue: invoice.amount },
            });
        }

        logger.info(`Invoice updated: ${invoice._id}`);

        res.json({
            success: true,
            data: invoice,
            message: 'Invoice updated successfully',
        });
    } catch (error) {
        logger.error('Update invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice',
        });
    }
};

/**
 * Delete invoice
 */
const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        await invoice.deleteOne();

        logger.info(`Invoice deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Invoice deleted successfully',
        });
    } catch (error) {
        logger.error('Delete invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete invoice',
        });
    }
};

/**
 * Send invoice
 */
const sendInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('client');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        await invoice.markAsSent();

        logger.info(`Invoice sent: ${invoice._id}`);

        res.json({
            success: true,
            data: invoice,
            message: 'Invoice sent successfully',
        });
    } catch (error) {
        logger.error('Send invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send invoice',
        });
    }
};

/**
 * Record payment
 */
const recordPayment = async (req, res) => {
    try {
        const { amount, method, reference } = req.body;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        const paymentAmount = parseFloat(amount);
        const currentPaid = invoice.amountPaid || 0;
        const newTotalPaid = currentPaid + paymentAmount;
        const balanceDue = invoice.amount - newTotalPaid;

        if (paymentAmount >= balanceDue || Math.abs(balanceDue) < 0.01) {
            // Full payment - mark as paid
            invoice.status = 'paid';
            invoice.paidDate = new Date();
            invoice.amountPaid = invoice.amount;
            if (method) invoice.paymentMethod = method;
            if (reference) invoice.paymentReference = reference;

            await invoice.save();

            // Update client revenue only for the new payment amount
            await Client.findByIdAndUpdate(invoice.client, {
                $inc: { totalRevenue: paymentAmount },
            });
        } else {
            // Partial payment
            invoice.amountPaid = newTotalPaid;
            invoice.status = 'partial';
            if (method) invoice.paymentMethod = method;
            if (reference) invoice.paymentReference = reference;

            await invoice.save();

            // Update client revenue for the partial payment
            await Client.findByIdAndUpdate(invoice.client, {
                $inc: { totalRevenue: paymentAmount },
            });
        }

        logger.info(`Payment of ${paymentAmount} recorded for invoice: ${invoice._id}`);

        res.json({
            success: true,
            data: invoice,
            message:
                invoice.status === 'paid'
                    ? 'Invoice marked as paid'
                    : 'Partial payment recorded successfully',
        });
    } catch (error) {
        logger.error('Record payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record payment',
        });
    }
};

/**
 * Send reminder
 */
const sendReminder = async (req, res) => {
    try {
        const { method = 'email', notes } = req.body;
        const invoice = await Invoice.findById(req.params.id).populate('client');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        await invoice.sendReminder(method, notes);

        logger.info(`Reminder sent for invoice: ${invoice._id}`);

        res.json({
            success: true,
            data: invoice,
            message: 'Reminder sent successfully',
        });
    } catch (error) {
        logger.error('Send reminder error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send reminder',
        });
    }
};

/**
 * Preview invoice
 */
const previewInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('client');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found',
            });
        }

        res.render('invoices/preview', {
            title: `Invoice #${invoice.invoiceNumber}`,
            layout: false,
            invoice,
        });
    } catch (error) {
        logger.error('Preview invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to preview invoice',
        });
    }
};

module.exports = {
    showInvoices,
    showInvoice,
    showEditInvoice,
    getInvoices,
    createInvoice,
    getInvoice,
    updateInvoice,
    deleteInvoice,
    sendInvoice,
    recordPayment,
    sendReminder,
    previewInvoice,
};
