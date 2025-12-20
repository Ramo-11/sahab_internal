const Client = require('../../models/Client');
const Proposal = require('../../models/Proposal');
const Invoice = require('../../models/Invoice');
const { logger } = require('../logger');

/**
 * Show analysis dashboard
 */
const showAnalysis = async (req, res) => {
    try {
        const { period = '30', startDate, endDate } = req.query;

        let dateRange = {};
        if (startDate && endDate) {
            dateRange.start = new Date(startDate);
            dateRange.end = new Date(endDate);
        } else {
            dateRange.end = new Date();
            dateRange.start = new Date();
            dateRange.start.setDate(dateRange.start.getDate() - parseInt(period));
        }

        const [clientStats, proposalStats, invoiceStats, allTimeInvoiceStats, conversionStats] = await Promise.all([
            Client.getStats(),
            Proposal.getConversionStats(dateRange.start, dateRange.end),
            Invoice.getRevenueStats(dateRange.start, dateRange.end),
            // Get all-time revenue (no date filter)
            Invoice.getRevenueStats(),
            // Get client conversion stats (leads that converted vs lost)
            getClientConversionRate(),
        ]);

        res.render('analysis/index', {
            title: 'Analysis - Sahab Solutions',
            layout: 'layout',
            stats: {
                clients: clientStats,
                proposals: proposalStats,
                invoices: invoiceStats,
                allTimeInvoices: allTimeInvoiceStats,
                clientConversion: conversionStats,
            },
            additionalCSS: ['analysis.css'],
            additionalJS: ['analysis.js'],
            dateRange,
            period,
            activeTab: 'analysis',
        });
    } catch (error) {
        logger.error('Show analysis error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load analysis',
            layout: 'layout',
        });
    }
};

/**
 * Calculate client conversion rate (converted clients vs lost leads)
 */
async function getClientConversionRate() {
    const stats = await Client.aggregate([
        {
            $group: {
                _id: null,
                // Converted clients (active, paused, completed)
                converted: {
                    $sum: {
                        $cond: [
                            { $in: ['$status', ['active', 'paused', 'completed']] },
                            1,
                            0
                        ]
                    }
                },
                // Lost leads
                lost: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'lost'] }, 1, 0]
                    }
                },
                // Still leads (potential)
                leads: {
                    $sum: {
                        $cond: [{ $eq: ['$status', 'lead'] }, 1, 0]
                    }
                },
                // Inactive (not counted in conversion)
                inactive: {
                    $sum: {
                        $cond: [{ $in: ['$status', ['inactive', 'archived']] }, 1, 0]
                    }
                },
                total: { $sum: 1 }
            }
        }
    ]);

    const result = stats[0] || { converted: 0, lost: 0, leads: 0, inactive: 0, total: 0 };

    // Conversion rate = converted / (converted + lost)
    // Only count clients that have been decided (not leads or inactive)
    const decidedClients = result.converted + result.lost;
    const conversionRate = decidedClients > 0
        ? ((result.converted / decidedClients) * 100).toFixed(1)
        : 0;

    return {
        ...result,
        conversionRate
    };
}

/**
 * Get revenue analysis
 */
const getRevenue = async (req, res) => {
    try {
        const { period = 'monthly', year = new Date().getFullYear() } = req.query;

        let groupBy;
        if (period === 'daily') {
            groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$paidDate' } };
        } else if (period === 'monthly') {
            groupBy = { $dateToString: { format: '%Y-%m', date: '$paidDate' } };
        } else if (period === 'quarterly') {
            groupBy = {
                year: { $year: '$paidDate' },
                quarter: { $ceil: { $divide: [{ $month: '$paidDate' }, 3] } },
            };
        } else {
            groupBy = { $year: '$paidDate' };
        }

        const revenue = await Invoice.aggregate([
            {
                $match: {
                    status: 'paid',
                    paidDate: {
                        $gte: new Date(`${year}-01-01`),
                        $lte: new Date(`${year}-12-31`),
                    },
                },
            },
            {
                $group: {
                    _id: groupBy,
                    revenue: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgInvoice: { $avg: '$amount' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Calculate growth metrics
        const totalRevenue = revenue.reduce((sum, r) => sum + r.revenue, 0);
        const avgMonthlyRevenue = totalRevenue / (revenue.length || 1);

        res.json({
            success: true,
            data: {
                revenue,
                summary: {
                    totalRevenue,
                    avgMonthlyRevenue,
                    periods: revenue.length,
                },
            },
        });
    } catch (error) {
        logger.error('Get revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue data',
        });
    }
};

/**
 * Get client analysis
 */
const getClientAnalysis = async (req, res) => {
    try {
        const { groupBy = 'status' } = req.query;

        let aggregation;
        if (groupBy === 'status') {
            aggregation = {
                $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$totalRevenue' } },
            };
        } else if (groupBy === 'industry') {
            aggregation = {
                $group: {
                    _id: '$industry',
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalRevenue' },
                },
            };
        } else if (groupBy === 'acquisition') {
            aggregation = {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalRevenue' },
                },
            };
        } else {
            aggregation = {
                $group: {
                    _id: '$companySize',
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalRevenue' },
                },
            };
        }

        const analysis = await Client.aggregate([aggregation, { $sort: { revenue: -1 } }]);

        // Top clients by revenue
        const topClients = await Client.find()
            .sort('-totalRevenue')
            .limit(10)
            .select('name company totalRevenue totalProjects');

        res.json({
            success: true,
            data: {
                analysis,
                topClients,
            },
        });
    } catch (error) {
        logger.error('Get client analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch client analysis',
        });
    }
};

/**
 * Get proposal analysis
 */
const getProposalAnalysis = async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;

        // Conversion funnel
        const funnel = await Proposal.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(`${year}-01-01`),
                        $lte: new Date(`${year}-12-31`),
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
                    sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
                    viewed: { $sum: { $cond: [{ $eq: ['$status', 'viewed'] }, 1, 0] } },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    expired: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
                    totalValue: { $sum: '$pricing.amount' },
                    acceptedValue: {
                        $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, '$pricing.amount', 0] },
                    },
                },
            },
        ]);

        // By project type
        const byType = await Proposal.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(`${year}-01-01`),
                        $lte: new Date(`${year}-12-31`),
                    },
                },
            },
            {
                $group: {
                    _id: '$projectType',
                    count: { $sum: 1 },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                    value: { $sum: '$pricing.amount' },
                    avgValue: { $avg: '$pricing.amount' },
                },
            },
            { $sort: { value: -1 } },
        ]);

        const conversionRate = funnel[0]
            ? (
                  (funnel[0].accepted /
                      (funnel[0].sent +
                          funnel[0].viewed +
                          funnel[0].accepted +
                          funnel[0].rejected)) *
                  100
              ).toFixed(1)
            : 0;

        res.json({
            success: true,
            data: {
                funnel: funnel[0] || {},
                byType,
                conversionRate,
            },
        });
    } catch (error) {
        logger.error('Get proposal analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch proposal analysis',
        });
    }
};

/**
 * Get invoice analysis
 */
const getInvoiceAnalysis = async (req, res) => {
    try {
        const { year = new Date().getFullYear() } = req.query;

        // Payment status breakdown
        const statusBreakdown = await Invoice.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
            { $sort: { amount: -1 } },
        ]);

        // Aging analysis
        const today = new Date();
        const aging = await Invoice.aggregate([
            {
                $match: {
                    status: { $nin: ['paid', 'cancelled'] },
                },
            },
            {
                $project: {
                    amount: 1,
                    daysOverdue: {
                        $divide: [{ $subtract: [today, '$dueDate'] }, 1000 * 60 * 60 * 24],
                    },
                },
            },
            {
                $bucket: {
                    groupBy: '$daysOverdue',
                    boundaries: [-365, 0, 30, 60, 90, 365],
                    default: 'Other',
                    output: {
                        count: { $sum: 1 },
                        amount: { $sum: '$amount' },
                    },
                },
            },
        ]);

        // Average payment time
        const paymentTime = await Invoice.aggregate([
            {
                $match: {
                    status: 'paid',
                    paidDate: { $exists: true },
                },
            },
            {
                $project: {
                    daysToPay: {
                        $divide: [{ $subtract: ['$paidDate', '$issueDate'] }, 1000 * 60 * 60 * 24],
                    },
                },
            },
            {
                $group: {
                    _id: null,
                    avgDaysToPay: { $avg: '$daysToPay' },
                    minDaysToPay: { $min: '$daysToPay' },
                    maxDaysToPay: { $max: '$daysToPay' },
                },
            },
        ]);

        res.json({
            success: true,
            data: {
                statusBreakdown,
                aging,
                paymentTime: paymentTime[0] || {},
            },
        });
    } catch (error) {
        logger.error('Get invoice analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice analysis',
        });
    }
};

/**
 * Get trend analysis
 */
const getTrends = async (req, res) => {
    try {
        const { months = 12 } = req.query;
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - parseInt(months));

        const trends = await Promise.all([
            // Monthly revenue trend
            Invoice.aggregate([
                {
                    $match: {
                        status: 'paid',
                        paidDate: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$paidDate' } },
                        revenue: { $sum: '$amount' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            // Monthly client acquisition
            Client.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                        newClients: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            // Monthly proposals
            Proposal.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                        proposals: { $sum: 1 },
                        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                revenue: trends[0],
                clients: trends[1],
                proposals: trends[2],
            },
        });
    } catch (error) {
        logger.error('Get trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch trends',
        });
    }
};

/**
 * Export data
 */
const exportData = async (req, res) => {
    try {
        const { type, format = 'json', startDate, endDate } = req.query;

        let data;
        const dateFilter = {};

        if (startDate && endDate) {
            dateFilter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        switch (type) {
            case 'clients':
                data = await Client.find(dateFilter).lean();
                break;
            case 'proposals':
                data = await Proposal.find(dateFilter).populate('client', 'name company').lean();
                break;
            case 'invoices':
                data = await Invoice.find(dateFilter).populate('client', 'name company').lean();
                break;
            case 'revenue':
                data = await Invoice.find({
                    ...dateFilter,
                    status: 'paid',
                })
                    .populate('client', 'name company')
                    .lean();
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid export type',
                });
        }

        if (format === 'csv') {
            // Convert to CSV format
            const fields = Object.keys(data[0] || {});
            let csv = fields.join(',') + '\n';

            data.forEach((row) => {
                csv +=
                    fields
                        .map((field) => {
                            const value = row[field];
                            return typeof value === 'object' ? JSON.stringify(value) : value;
                        })
                        .join(',') + '\n';
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${type}-export.csv"`);
            res.send(csv);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${type}-export.json"`);
            res.json(data);
        }
    } catch (error) {
        logger.error('Export data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export data',
        });
    }
};

module.exports = {
    showAnalysis,
    getRevenue,
    getClientAnalysis,
    getProposalAnalysis,
    getInvoiceAnalysis,
    getTrends,
    exportData,
};
