const Client = require('../../models/Client');
const Proposal = require('../../models/Proposal');
const Invoice = require('../../models/Invoice');
const Expense = require('../../models/Expense');
const Investment = require('../../models/Investment');
const InvestmentReturn = require('../../models/InvestmentReturn');
const { logger } = require('../logger');

/**
 * Helper to safely get a number value (prevents NaN)
 */
const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Show main dashboard
 */
const showDashboard = async (req, res) => {
    try {
        // Get current month for calculations
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        // Get quick stats
        const [
            clientCount,
            activeProposals,
            unpaidInvoices,
            recentClients,
            pendingClients,
            incomingInvoices,
            clientStats,
            invoiceStats,
            proposalStats,
            revenueStats,
            expenseStats,
            totalExpenses,
            investmentStats,
            investmentReturnsStats,
            currentMonthInvestmentReturns,
        ] = await Promise.all([
            Client.countDocuments({ status: 'active' }),
            Proposal.countDocuments({ status: { $in: ['sent', 'viewed'] } }),
            Invoice.countDocuments({ status: { $in: ['sent', 'overdue'] } }),
            Client.find({ status: 'active' })
                .sort('-createdAt')
                .limit(5)
                .select('name company email createdAt'),
            Client.countDocuments({ status: 'pending' }),
            Invoice.countDocuments({ status: 'sent' }),
            // Client stats
            Client.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                    },
                },
            ]),
            // Invoice stats - enhanced
            Invoice.aggregate([
                {
                    $facet: {
                        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    totalPaid: {
                                        $sum: { $ifNull: ['$amountPaid', 0] },
                                    },
                                    totalPending: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $not: [
                                                        { $in: ['$status', ['paid', 'cancelled']] },
                                                    ],
                                                },
                                                {
                                                    $subtract: [
                                                        { $ifNull: ['$amount', 0] },
                                                        { $ifNull: ['$amountPaid', 0] },
                                                    ],
                                                },
                                                0,
                                            ],
                                        },
                                    },
                                    totalAmount: {
                                        $sum: { $ifNull: ['$amount', 0] },
                                    },
                                },
                            },
                        ],
                        overdue: [
                            {
                                $match: {
                                    status: { $nin: ['paid', 'cancelled'] },
                                    dueDate: { $lt: new Date() },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    count: { $sum: 1 },
                                    amount: { $sum: { $ifNull: ['$amount', 0] } },
                                },
                            },
                        ],
                        monthly: [
                            {
                                $match: {
                                    status: 'paid',
                                    paidDate: { $gte: currentMonth },
                                },
                            },
                            {
                                $group: {
                                    _id: null,
                                    revenue: { $sum: { $ifNull: ['$amountPaid', 0] } },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                    },
                },
            ]),
            // Proposal stats
            Proposal.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        value: { $sum: { $ifNull: ['$pricing.amount', 0] } },
                    },
                },
            ]),
            // Revenue stats
            Invoice.aggregate([
                {
                    $match: {
                        $or: [
                            // Fully paid invoices
                            {
                                status: 'paid',
                                paidDate: { $gte: currentMonth },
                            },
                            // Partially paid invoices (count the paid portion)
                            {
                                status: 'partial',
                                updatedAt: { $gte: currentMonth },
                                amountPaid: { $gt: 0 },
                            },
                        ],
                    },
                },
                {
                    $group: {
                        _id: null,
                        monthlyRevenue: {
                            $sum: { $ifNull: ['$amountPaid', 0] },
                        },
                    },
                },
            ]),
            // Monthly expense stats
            Expense.aggregate([
                {
                    $match: {
                        expenseDate: { $gte: currentMonth },
                    },
                },
                {
                    $group: {
                        _id: null,
                        monthlyExpenses: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
            ]),
            // Total expenses
            Expense.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                    },
                },
            ]),
            // Investment stats
            Investment.getStats(),
            // Investment returns all-time stats
            InvestmentReturn.getAllTimeStats(),
            // Current month investment returns
            InvestmentReturn.getMonthlyTotal(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1
            ),
        ]);

        // Calculate proposal conversion rate
        const proposalSent = safeNumber(proposalStats.find((s) => s._id === 'sent')?.count);
        const proposalViewed = safeNumber(proposalStats.find((s) => s._id === 'viewed')?.count);
        const proposalAccepted = safeNumber(proposalStats.find((s) => s._id === 'accepted')?.count);
        const proposalRejected = safeNumber(proposalStats.find((s) => s._id === 'rejected')?.count);
        const totalSentProposals =
            proposalSent + proposalViewed + proposalAccepted + proposalRejected;
        const conversionRate =
            totalSentProposals > 0 ? (proposalAccepted / totalSentProposals) * 100 : 0;

        // Get invoice stats data safely
        const invoiceData = invoiceStats[0] || {
            byStatus: [],
            totals: [],
            overdue: [],
            monthly: [],
        };

        // Calculate monthly values (include investment returns in revenue)
        const monthlyInvoiceRevenue = safeNumber(revenueStats[0]?.monthlyRevenue);
        const monthlyInvestmentReturns = safeNumber(currentMonthInvestmentReturns?.total);
        const monthlyRevenue = monthlyInvoiceRevenue + monthlyInvestmentReturns;
        const monthlyExpenses = safeNumber(expenseStats[0]?.monthlyExpenses);
        const monthlyProfit = monthlyRevenue - monthlyExpenses;

        // Format stats with safe number handling
        const stats = {
            clients: safeNumber(clientCount),
            activeProposals: safeNumber(activeProposals),
            unpaidInvoices: safeNumber(unpaidInvoices),
            pendingClients: safeNumber(pendingClients),
            incomingInvoices: safeNumber(incomingInvoices),
            monthlyRevenue: monthlyRevenue,
            clientStats: {
                active: safeNumber(clientStats.find((s) => s._id === 'active')?.count),
                lead: safeNumber(clientStats.find((s) => s._id === 'lead')?.count),
                inactive: safeNumber(clientStats.find((s) => s._id === 'inactive')?.count),
                archived: safeNumber(clientStats.find((s) => s._id === 'archived')?.count),
                total: safeNumber(clientStats.reduce((sum, s) => sum + safeNumber(s.count), 0)),
            },
            invoiceStats: {
                totalPaid: safeNumber(invoiceData.totals[0]?.totalPaid),
                totalPending: safeNumber(invoiceData.totals[0]?.totalPending),
                totalAmount: safeNumber(invoiceData.totals[0]?.totalAmount),
                sent: safeNumber(invoiceData.byStatus.find((s) => s._id === 'sent')?.count),
                overdue: safeNumber(invoiceData.overdue[0]?.count),
                overdueAmount: safeNumber(invoiceData.overdue[0]?.amount),
                draft: safeNumber(invoiceData.byStatus.find((s) => s._id === 'draft')?.count),
                paid: safeNumber(invoiceData.byStatus.find((s) => s._id === 'paid')?.count),
                partial: safeNumber(invoiceData.byStatus.find((s) => s._id === 'partial')?.count),
                cancelled: safeNumber(
                    invoiceData.byStatus.find((s) => s._id === 'cancelled')?.count
                ),
                monthlyRevenue: safeNumber(invoiceData.monthly[0]?.revenue),
                monthlyCount: safeNumber(invoiceData.monthly[0]?.count),
            },
            proposalStats: {
                draft: safeNumber(proposalStats.find((s) => s._id === 'draft')?.count),
                sent: proposalSent,
                viewed: proposalViewed,
                accepted: proposalAccepted,
                rejected: proposalRejected,
                totalValue: safeNumber(
                    proposalStats.reduce((sum, s) => sum + safeNumber(s.value), 0)
                ),
                acceptedValue: safeNumber(proposalStats.find((s) => s._id === 'accepted')?.value),
                conversionRate: safeNumber(conversionRate),
            },
            expenseStats: {
                monthlyExpenses: monthlyExpenses,
                totalExpenses: safeNumber(totalExpenses[0]?.total),
                monthlyCount: safeNumber(expenseStats[0]?.count),
                monthlyProfit: monthlyProfit,
            },
            investmentStats: {
                activeCount: safeNumber(
                    investmentStats?.byStatus?.find((s) => s._id === 'active')?.count
                ),
                totalCount: safeNumber(investmentStats?.totals?.[0]?.totalInvestments),
                totalPrincipal: safeNumber(investmentStats?.totals?.[0]?.totalPrincipal),
                activePrincipal: safeNumber(investmentStats?.totals?.[0]?.activePrincipal),
                totalReturns: safeNumber(investmentReturnsStats?.totalReturns),
                totalGains: safeNumber(investmentReturnsStats?.totalGains),
                totalLosses: safeNumber(investmentReturnsStats?.totalLosses),
                monthlyReturns: safeNumber(currentMonthInvestmentReturns?.total),
            },
        };

        res.render('dashboard', {
            title: 'Dashboard - Sahab Solutions',
            layout: 'layout',
            stats,
            additionalCSS: ['dashboard.css'],
            additionalJS: ['dashboard.js'],
            recentClients: recentClients || [],
            activeTab: 'dashboard',
        });
    } catch (error) {
        logger.error('Dashboard error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load dashboard',
            layout: 'layout',
        });
    }
};

/**
 * Get dashboard statistics API
 */
const getStats = async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get revenue time series - group by day for week, by week for month, by month for year
        let groupFormat = '%Y-%m-%d'; // default daily
        if (days > 30) {
            groupFormat = days > 90 ? '%Y-%m' : '%Y-%U'; // monthly for year, weekly for month
        }

        const revenueTimeSeries = await Invoice.aggregate([
            {
                $match: {
                    status: 'paid',
                    $or: [
                        { paidDate: { $gte: startDate } },
                        {
                            paidDate: { $exists: false },
                            status: 'paid',
                            updatedAt: { $gte: startDate },
                        },
                    ],
                },
            },
            {
                $addFields: {
                    effectiveDate: {
                        $ifNull: ['$paidDate', '$updatedAt'],
                    },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: '$effectiveDate',
                        },
                    },
                    revenue: { $sum: { $ifNull: ['$amountPaid', 0] } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $limit: 30 },
        ]);

        // Get expense time series
        const expenseTimeSeries = await Expense.aggregate([
            {
                $match: {
                    expenseDate: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: '$expenseDate',
                        },
                    },
                    expenses: { $sum: { $ifNull: ['$amount', 0] } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $limit: 30 },
        ]);

        // Get investment returns time series
        const investmentTimeSeries = await InvestmentReturn.aggregate([
            {
                $match: {
                    returnDate: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: groupFormat,
                            date: '$returnDate',
                        },
                    },
                    returns: { $sum: { $ifNull: ['$amount', 0] } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $limit: 30 },
        ]);

        const [clientStats, proposalStats, invoiceStats] = await Promise.all([
            Client.getStats ? Client.getStats() : Client.find().countDocuments(),
            Proposal.getConversionStats
                ? Proposal.getConversionStats(startDate, new Date())
                : Proposal.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            Invoice.getRevenueStats(startDate, new Date()),
        ]);

        // Calculate growth rates
        const previousPeriod = new Date(startDate);
        previousPeriod.setDate(previousPeriod.getDate() - days);

        const previousRevenue = await Invoice.aggregate([
            {
                $match: {
                    status: 'paid',
                    $or: [
                        { paidDate: { $gte: previousPeriod, $lt: startDate } },
                        {
                            paidDate: { $exists: false },
                            status: 'paid',
                            updatedAt: { $gte: previousPeriod, $lt: startDate },
                        },
                    ],
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$amountPaid', 0] } },
                },
            },
        ]);

        const currentRevenue = safeNumber(invoiceStats?.totalRevenue);
        const prevRevenue = safeNumber(previousRevenue[0]?.total);
        const revenueGrowth =
            prevRevenue > 0 ? safeNumber(((currentRevenue - prevRevenue) / prevRevenue) * 100) : 0;

        // Format labels for better display
        const formattedRevenue = revenueTimeSeries.map((item) => ({
            _id: item._id,
            label:
                days <= 7
                    ? new Date(item._id).toLocaleDateString('en-US', { weekday: 'short' })
                    : days <= 30
                    ? `Week ${item._id.split('-W')[1] || item._id}`
                    : new Date(item._id + '-01').toLocaleDateString('en-US', { month: 'short' }),
            revenue: safeNumber(item.revenue),
            count: safeNumber(item.count),
        }));

        const formattedExpenses = expenseTimeSeries.map((item) => ({
            _id: item._id,
            label:
                days <= 7
                    ? new Date(item._id).toLocaleDateString('en-US', { weekday: 'short' })
                    : days <= 30
                    ? `Week ${item._id.split('-W')[1] || item._id}`
                    : new Date(item._id + '-01').toLocaleDateString('en-US', { month: 'short' }),
            expenses: safeNumber(item.expenses),
            count: safeNumber(item.count),
        }));

        const formattedInvestments = investmentTimeSeries.map((item) => ({
            _id: item._id,
            label:
                days <= 7
                    ? new Date(item._id).toLocaleDateString('en-US', { weekday: 'short' })
                    : days <= 30
                    ? `Week ${item._id.split('-W')[1] || item._id}`
                    : new Date(item._id + '-01').toLocaleDateString('en-US', { month: 'short' }),
            returns: safeNumber(item.returns),
            count: safeNumber(item.count),
        }));

        res.json({
            success: true,
            data: {
                clients: clientStats,
                proposals: proposalStats,
                invoices: {
                    ...invoiceStats,
                    revenue: formattedRevenue,
                },
                expenses: {
                    timeline: formattedExpenses,
                },
                investments: {
                    timeline: formattedInvestments,
                },
                growth: {
                    revenue: revenueGrowth,
                },
            },
        });
    } catch (error) {
        logger.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics',
        });
    }
};

/**
 * Get recent activity
 */
const getRecent = async (req, res) => {
    try {
        const [clients, proposals, invoices] = await Promise.all([
            Client.find().sort('-createdAt').limit(5).select('name company status createdAt'),
            Proposal.find()
                .sort('-createdAt')
                .limit(5)
                .populate('client', 'name company')
                .select('title status amount createdAt'),
            Invoice.find()
                .sort('-createdAt')
                .limit(5)
                .populate('client', 'name company')
                .select('invoiceNumber status amount createdAt'),
        ]);

        const activity = [
            ...clients.map((c) => ({
                type: 'client',
                title: `New client: ${c.name}`,
                status: c.status,
                date: c.createdAt,
                link: `/clients/${c._id}`,
            })),
            ...proposals.map((p) => ({
                type: 'proposal',
                title: `Proposal: ${p.title}`,
                subtitle: p.client?.company || p.client?.name,
                status: p.status,
                date: p.createdAt,
                link: `/proposals/${p._id}`,
            })),
            ...invoices.map((i) => ({
                type: 'invoice',
                title: `Invoice #${i.invoiceNumber}`,
                subtitle: i.client?.company || i.client?.name,
                status: i.status,
                amount: safeNumber(i.amount),
                date: i.createdAt,
                link: `/invoices/${i._id}`,
            })),
        ]
            .sort((a, b) => b.date - a.date)
            .slice(0, 10);

        res.json({
            success: true,
            data: activity,
        });
    } catch (error) {
        logger.error('Get recent error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent activity',
        });
    }
};

/**
 * Get alerts and notifications
 */
const getAlerts = async (req, res) => {
    try {
        const alerts = [];

        // Check for overdue invoices
        const overdueInvoices = await Invoice.find({
            status: { $in: ['sent', 'overdue'] },
            dueDate: { $lt: new Date() },
        }).populate('client', 'name company');

        overdueInvoices.forEach((invoice) => {
            alerts.push({
                type: 'warning',
                category: 'invoice',
                title: `Invoice #${invoice.invoiceNumber} is overdue`,
                message: `${invoice.daysOverdue || 0} days overdue for ${
                    invoice.client?.company || invoice.client?.name || 'Unknown'
                }`,
                link: `/invoices/${invoice._id}`,
                priority: 'high',
            });
        });

        // Check for expiring proposals
        const expiringProposals = await Proposal.find({
            status: { $in: ['sent', 'viewed'] },
            expiryDate: {
                $gte: new Date(),
                $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        }).populate('client', 'name company');

        expiringProposals.forEach((proposal) => {
            const daysUntilExpiry = Math.ceil(
                (proposal.expiryDate - new Date()) / (1000 * 60 * 60 * 24)
            );
            alerts.push({
                type: 'info',
                category: 'proposal',
                title: `Proposal expiring soon`,
                message: `${proposal.title} expires in ${daysUntilExpiry} days`,
                link: `/proposals/${proposal._id}`,
                priority: 'medium',
            });
        });

        // Check for clients without recent contact
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const inactiveClients = await Client.find({
            status: 'active',
            lastContactDate: { $lt: thirtyDaysAgo },
        }).limit(5);

        inactiveClients.forEach((client) => {
            alerts.push({
                type: 'info',
                category: 'client',
                title: 'Client follow-up needed',
                message: `No contact with ${client.company || client.name} for 30+ days`,
                link: `/clients/${client._id}`,
                priority: 'low',
            });
        });

        res.json({
            success: true,
            data: alerts.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }),
        });
    } catch (error) {
        logger.error('Get alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch alerts',
        });
    }
};

module.exports = {
    showDashboard,
    getStats,
    getRecent,
    getAlerts,
};
