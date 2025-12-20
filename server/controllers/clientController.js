const Client = require('../../models/Client');
const Proposal = require('../../models/Proposal');
const Invoice = require('../../models/Invoice');
const Expense = require('../../models/Expense');
const { logger } = require('../logger');
const { add } = require('winston');

/**
 * Show clients list
 */
const showClients = async (req, res) => {
    try {
        const { status, industry, search, sort = '-createdAt' } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (industry) filter.industry = industry;
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { company: new RegExp(search, 'i') },
                { email: new RegExp(search, 'i') },
            ];
        }

        const clients = await Client.find(filter)
            .sort(sort)
            .select('name company email phone status rating createdAt');

        const clientIds = clients.map((c) => c._id);

        // Get revenue from paid and partially paid invoices
        const invoices = await Invoice.aggregate([
            {
                $match: {
                    client: { $in: clientIds },
                    status: { $in: ['paid', 'partial'] },
                },
            },
            {
                $group: {
                    _id: '$client',
                    // Use amountPaid if > 0, otherwise use amount for paid invoices
                    total: {
                        $sum: {
                            $cond: [
                                { $gt: ['$amountPaid', 0] },
                                '$amountPaid',
                                { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', '$amountPaid'] }
                            ]
                        }
                    },
                },
            },
        ]);

        // Get expenses for each client
        const expenses = await Expense.aggregate([
            {
                $match: {
                    client: { $in: clientIds },
                },
            },
            {
                $group: {
                    _id: '$client',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const revenueMap = {};
        invoices.forEach((i) => {
            revenueMap[i._id.toString()] = i.total;
        });

        const expensesMap = {};
        expenses.forEach((e) => {
            expensesMap[e._id.toString()] = e.total;
        });

        clients.forEach((c) => {
            c.totalRevenue = revenueMap[c._id.toString()] || 0;
            c.totalExpenses = expensesMap[c._id.toString()] || 0;
        });

        res.render('clients/index', {
            title: 'Clients - Sahab Solutions',
            layout: 'layout',
            clients,
            filters: { status, industry, search },
            additionalCSS: ['clients.css'],
            additionalJS: ['clients.js'],
            activeTab: 'clients',
        });
    } catch (error) {
        logger.error('Show clients error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load clients',
            layout: 'layout',
        });
    }
};

/**
 * Show new client form
 */
const showNewClient = async (req, res) => {
    res.render('clients/new', {
        title: 'New Client - Sahab Solutions',
        layout: 'layout',
        additionalCSS: ['clients.css'],
        additionalJS: ['clients.js'],
        activeTab: 'clients',
    });
};

/**
 * Show client details
 */
const showClient = async (req, res) => {
    try {
        const clientObject = await Client.findById(req.params.id);

        if (!clientObject) {
            return res.status(404).render('error', {
                title: 'Client Not Found',
                message: 'The requested client could not be found',
                layout: 'layout',
            });
        }

        const [proposals, invoices, revenueResult] = await Promise.all([
            Proposal.find({ client: clientObject._id })
                .sort('-createdAt')
                .select('title status pricing.amount createdAt'),
            Invoice.find({ client: clientObject._id })
                .sort('-createdAt')
                .select('invoiceNumber status amount dueDate createdAt'),
            Invoice.aggregate([
                {
                    $match: {
                        client: clientObject._id,
                        status: { $in: ['paid', 'partial'] },
                    },
                },
                {
                    $group: {
                        _id: null,
                        // Use amountPaid if > 0, otherwise use amount for paid invoices
                        total: {
                            $sum: {
                                $cond: [
                                    { $gt: ['$amountPaid', 0] },
                                    '$amountPaid',
                                    { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', '$amountPaid'] }
                                ]
                            }
                        },
                    },
                },
            ]),
        ]);

        const totalRevenue = revenueResult[0]?.total || 0;
        clientObject.totalRevenue = totalRevenue;

        res.render('clients/view', {
            title: `${clientObject.displayName || clientObject.name} - Sahab Solutions`,
            layout: 'layout',
            clientData: clientObject,
            proposals,
            invoices,
            additionalCSS: ['clients.css'],
            additionalJS: ['clients.js'],
            activeTab: 'clients',
        });
    } catch (error) {
        logger.error('Show client error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load client details',
            layout: 'layout',
        });
    }
};

/**
 * Get clients API
 */
const getClients = async (req, res) => {
    try {
        const { status, industry, search, sort = '-createdAt', page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (industry) filter.industry = industry;
        if (search) {
            filter.$text = { $search: search };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [clients, total] = await Promise.all([
            Client.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
            Client.countDocuments(filter),
        ]);

        res.json({
            success: true,
            data: clients,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Get clients error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch clients',
        });
    }
};

/**
 * Create new client
 */
const createClient = async (req, res) => {
    try {
        const clientData = {
            ...req.body,
            lastContactDate: new Date(),
        };

        const client = new Client(clientData);
        await client.save();

        logger.info(`Client created: ${client._id}`);

        res.json({
            success: true,
            data: client,
            message: 'Client created successfully',
        });
    } catch (error) {
        logger.error('Create client error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to create client',
        });
    }
};

/**
 * Get single client API
 */
const getClient = async (req, res) => {
    try {
        const client = await Client.findById(req.params.id)
            .populate('proposals')
            .populate('invoices');

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found',
            });
        }

        // Get expenses for this client
        const expenses = await Expense.find({ client: req.params.id })
            .sort('-expenseDate')
            .select('description category amount expenseDate notes');

        // Calculate totals
        const revenueResult = await Invoice.aggregate([
            {
                $match: {
                    client: client._id,
                    status: { $in: ['paid', 'partial'] },
                },
            },
            {
                $group: {
                    _id: null,
                    // Use amountPaid if > 0, otherwise use amount for paid invoices
                    total: {
                        $sum: {
                            $cond: [
                                { $gt: ['$amountPaid', 0] },
                                '$amountPaid',
                                { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', '$amountPaid'] }
                            ]
                        }
                    },
                },
            },
        ]);

        const expenseResult = await Expense.aggregate([
            {
                $match: {
                    client: client._id,
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);

        const clientData = client.toObject();
        clientData.expenses = expenses;
        clientData.totalRevenue = revenueResult[0]?.total || 0;
        clientData.totalExpenses = expenseResult[0]?.total || 0;

        res.json({
            success: true,
            data: clientData,
        });
    } catch (error) {
        logger.error('Get client error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch client',
        });
    }
};

/**
 * Update client
 */
const updateClient = async (req, res) => {
    try {
        const updates = req.body;
        delete updates._id;

        updates.updatedAt = new Date();
        if (updates.contacted) {
            updates.lastContactDate = new Date();
        }

        const client = await Client.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found',
            });
        }

        logger.info(`Client updated: ${client._id}`);

        res.json({
            success: true,
            data: client,
            message: 'Client updated successfully',
        });
    } catch (error) {
        logger.error('Update client error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update client',
        });
    }
};

/**
 * Delete client
 */
const deleteClient = async (req, res) => {
    try {
        // Check for related data
        const [proposalCount, invoiceCount] = await Promise.all([
            Proposal.countDocuments({ client: req.params.id }),
            Invoice.countDocuments({ client: req.params.id }),
        ]);

        const client = await Client.findByIdAndDelete(req.params.id);

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found',
            });
        }

        logger.info(`Client deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Client deleted successfully',
        });
    } catch (error) {
        logger.error('Delete client error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete client',
        });
    }
};

/**
 * Update client notes
 */
const updateNotes = async (req, res) => {
    try {
        const { notes, internalNotes } = req.body;

        const client = await Client.findByIdAndUpdate(
            req.params.id,
            {
                notes,
                internalNotes,
                updatedAt: new Date(),
            },
            { new: true }
        );

        if (!client) {
            return res.status(404).json({
                success: false,
                message: 'Client not found',
            });
        }

        res.json({
            success: true,
            data: client,
            message: 'Notes updated successfully',
        });
    } catch (error) {
        logger.error('Update notes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update notes',
        });
    }
};

/**
 * Get client history
 */
const getHistory = async (req, res) => {
    try {
        const [proposals, invoices] = await Promise.all([
            Proposal.find({ client: req.params.id })
                .sort('-createdAt')
                .select('title status pricing sentDate responseDate'),
            Invoice.find({ client: req.params.id })
                .sort('-createdAt')
                .select('invoiceNumber status amount issueDate paidDate'),
        ]);

        const history = [
            ...proposals.map((p) => ({
                type: 'proposal',
                title: p.title,
                status: p.status,
                amount: p.pricing?.amount,
                date: p.sentDate || p.createdAt,
                link: `/proposals/${p._id}`,
            })),
            ...invoices.map((i) => ({
                type: 'invoice',
                title: `Invoice #${i.invoiceNumber}`,
                status: i.status,
                amount: i.amount,
                date: i.issueDate,
                link: `/invoices/${i._id}`,
            })),
        ].sort((a, b) => b.date - a.date);

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        logger.error('Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch history',
        });
    }
};

module.exports = {
    showClients,
    showNewClient,
    showClient,
    getClients,
    createClient,
    getClient,
    updateClient,
    deleteClient,
    updateNotes,
    getHistory,
};
