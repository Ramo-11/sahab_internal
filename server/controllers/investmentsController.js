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
 * Show investments list
 */
const showInvestments = async (req, res) => {
    try {
        const { type, status, search } = req.query;

        const filter = {};

        if (type) filter.type = type;
        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
            ];
        }

        // Get current dates for comparisons
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const [
            investments,
            investmentStats,
            allTimeReturnStats,
            currentMonthReturns,
            lastMonthReturns,
            monthlyTrend,
            returnsByType,
        ] = await Promise.all([
            // Main investments query with returns
            Investment.find(filter).sort('-createdAt'),

            // Investment stats
            Investment.getStats(),

            // All-time return stats
            InvestmentReturn.getAllTimeStats(),

            // Current month returns
            InvestmentReturn.getMonthlyTotal(now.getFullYear(), now.getMonth() + 1),

            // Last month returns
            InvestmentReturn.getMonthlyTotal(now.getFullYear(), now.getMonth()),

            // Monthly trend (last 6 months)
            InvestmentReturn.getMonthlyTrend(6),

            // Returns grouped by investment type
            Investment.aggregate([
                { $match: { status: 'active' } },
                {
                    $lookup: {
                        from: 'investmentreturns',
                        localField: '_id',
                        foreignField: 'investment',
                        as: 'returns',
                    },
                },
                {
                    $group: {
                        _id: '$type',
                        totalPrincipal: { $sum: '$principal' },
                        totalReturns: { $sum: { $sum: '$returns.amount' } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { totalReturns: -1 } },
            ]),
        ]);

        // Get returns for each investment
        const investmentIds = investments.map((inv) => inv._id);
        const allReturns = await InvestmentReturn.find({ investment: { $in: investmentIds } }).sort(
            '-returnDate'
        );

        // Map returns to investments
        const returnsMap = {};
        allReturns.forEach((ret) => {
            const invId = ret.investment.toString();
            if (!returnsMap[invId]) {
                returnsMap[invId] = [];
            }
            returnsMap[invId].push(ret);
        });

        // Calculate totals for each investment
        const investmentsWithTotals = investments.map((inv) => {
            const invReturns = returnsMap[inv._id.toString()] || [];
            const totalReturns = invReturns.reduce((sum, r) => sum + safeNumber(r.amount), 0);
            const totalGains = invReturns
                .filter((r) => r.amount > 0)
                .reduce((sum, r) => sum + r.amount, 0);
            const totalLosses = invReturns
                .filter((r) => r.amount < 0)
                .reduce((sum, r) => sum + r.amount, 0);
            const roi = inv.principal > 0 ? ((totalReturns / inv.principal) * 100).toFixed(2) : 0;

            return {
                ...inv.toObject(),
                returns: invReturns,
                totalReturns,
                totalGains,
                totalLosses,
                roi,
                returnCount: invReturns.length,
            };
        });

        // Calculate stats
        const totalPrincipal = safeNumber(investmentStats?.totals?.[0]?.totalPrincipal);
        const activePrincipal = safeNumber(investmentStats?.totals?.[0]?.activePrincipal);
        const totalAllTimeReturns = safeNumber(allTimeReturnStats?.totalReturns);
        const totalGains = safeNumber(allTimeReturnStats?.totalGains);
        const totalLosses = safeNumber(allTimeReturnStats?.totalLosses);
        const currentMonthTotal = safeNumber(currentMonthReturns?.total);
        const lastMonthTotal = safeNumber(lastMonthReturns?.total);
        const monthlyChange =
            lastMonthTotal !== 0
                ? ((currentMonthTotal - lastMonthTotal) / Math.abs(lastMonthTotal)) * 100
                : currentMonthTotal !== 0
                ? 100
                : 0;

        // Overall ROI
        const overallROI = activePrincipal > 0 ? (totalAllTimeReturns / activePrincipal) * 100 : 0;

        // Format monthly trend for chart
        const trendData = monthlyTrend.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            label: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', {
                month: 'short',
            }),
            total: safeNumber(item.total),
            gains: safeNumber(item.gains),
            losses: safeNumber(item.losses),
            count: safeNumber(item.count),
        }));

        // Format type breakdown for chart
        const typeData = returnsByType.map((item) => ({
            type: item._id || 'other',
            totalPrincipal: safeNumber(item.totalPrincipal),
            totalReturns: safeNumber(item.totalReturns),
            count: safeNumber(item.count),
            roi:
                item.totalPrincipal > 0
                    ? ((item.totalReturns / item.totalPrincipal) * 100).toFixed(2)
                    : 0,
        }));

        const stats = {
            totalPrincipal,
            activePrincipal,
            totalAllTimeReturns,
            totalGains,
            totalLosses,
            currentMonthTotal,
            currentMonthGains: safeNumber(currentMonthReturns?.gains),
            currentMonthLosses: safeNumber(currentMonthReturns?.losses),
            lastMonthTotal,
            monthlyChange: safeNumber(monthlyChange),
            overallROI: safeNumber(overallROI),
            activeCount: safeNumber(
                investmentStats?.byStatus?.find((s) => s._id === 'active')?.count
            ),
            totalCount: safeNumber(investmentStats?.totals?.[0]?.totalInvestments),
            trendData,
            typeData,
        };

        res.render('investments/index', {
            title: 'Investments - Sahab Solutions',
            layout: 'layout',
            investments: investmentsWithTotals,
            stats,
            filters: { type, status, search },
            additionalCSS: ['investments.css'],
            additionalJS: ['investments.js'],
            activeTab: 'investments',
        });
    } catch (error) {
        logger.error('Show investments error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load investments',
            layout: 'layout',
        });
    }
};

/**
 * Get investments API
 */
const getInvestments = async (req, res) => {
    try {
        const { type, status, search } = req.query;

        const filter = {};

        if (type) filter.type = type;
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { name: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') },
            ];
        }

        const investments = await Investment.find(filter).sort('-createdAt');

        res.json({
            success: true,
            data: investments,
        });
    } catch (error) {
        logger.error('Get investments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch investments',
        });
    }
};

/**
 * Get single investment API
 */
const getInvestment = async (req, res) => {
    try {
        const investment = await Investment.findById(req.params.id);

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found',
            });
        }

        const returns = await InvestmentReturn.find({ investment: investment._id }).sort(
            '-returnDate'
        );

        const totalReturns = returns.reduce((sum, r) => sum + safeNumber(r.amount), 0);
        const roi =
            investment.principal > 0 ? ((totalReturns / investment.principal) * 100).toFixed(2) : 0;

        res.json({
            success: true,
            data: {
                ...investment.toObject(),
                returns,
                totalReturns,
                roi,
            },
        });
    } catch (error) {
        logger.error('Get investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch investment',
        });
    }
};

/**
 * Create new investment
 */
const createInvestment = async (req, res) => {
    try {
        const investmentData = {
            ...req.body,
            principal: safeNumber(req.body.principal),
        };

        const investment = new Investment(investmentData);
        await investment.save();

        logger.info(`Investment created: ${investment._id}`);

        res.json({
            success: true,
            data: investment,
            message: 'Investment created successfully',
        });
    } catch (error) {
        logger.error('Create investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create investment',
        });
    }
};

/**
 * Update investment
 */
const updateInvestment = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates._id;

        if (updates.principal !== undefined) {
            updates.principal = safeNumber(updates.principal);
        }

        const investment = await Investment.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found',
            });
        }

        logger.info(`Investment updated: ${investment._id}`);

        res.json({
            success: true,
            data: investment,
            message: 'Investment updated successfully',
        });
    } catch (error) {
        logger.error('Update investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update investment',
        });
    }
};

/**
 * Delete investment
 */
const deleteInvestment = async (req, res) => {
    try {
        const investment = await Investment.findByIdAndDelete(req.params.id);

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found',
            });
        }

        // Delete associated returns
        await InvestmentReturn.deleteMany({ investment: req.params.id });

        logger.info(`Investment deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Investment deleted successfully',
        });
    } catch (error) {
        logger.error('Delete investment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete investment',
        });
    }
};

/**
 * Get returns for an investment
 */
const getReturns = async (req, res) => {
    try {
        const returns = await InvestmentReturn.find({ investment: req.params.id }).sort(
            '-returnDate'
        );

        res.json({
            success: true,
            data: returns,
        });
    } catch (error) {
        logger.error('Get returns error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch returns',
        });
    }
};

/**
 * Add return to investment
 */
const addReturn = async (req, res) => {
    try {
        const investment = await Investment.findById(req.params.id);

        if (!investment) {
            return res.status(404).json({
                success: false,
                message: 'Investment not found',
            });
        }

        const returnDate = req.body.returnDate ? new Date(req.body.returnDate) : new Date();

        const returnData = {
            investment: req.params.id,
            amount: safeNumber(req.body.amount),
            returnDate,
            period: {
                month: returnDate.getMonth() + 1,
                year: returnDate.getFullYear(),
            },
            notes: req.body.notes || '',
        };

        const investmentReturn = new InvestmentReturn(returnData);
        await investmentReturn.save();

        logger.info(`Return added to investment ${req.params.id}: ${investmentReturn._id}`);

        res.json({
            success: true,
            data: investmentReturn,
            message: 'Return recorded successfully',
        });
    } catch (error) {
        logger.error('Add return error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add return',
        });
    }
};

/**
 * Update a return
 */
const updateReturn = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates._id;

        if (updates.amount !== undefined) {
            updates.amount = safeNumber(updates.amount);
        }

        if (updates.returnDate) {
            const returnDate = new Date(updates.returnDate);
            updates.period = {
                month: returnDate.getMonth() + 1,
                year: returnDate.getFullYear(),
            };
        }

        const investmentReturn = await InvestmentReturn.findByIdAndUpdate(
            req.params.returnId,
            updates,
            {
                new: true,
                runValidators: true,
            }
        );

        if (!investmentReturn) {
            return res.status(404).json({
                success: false,
                message: 'Return not found',
            });
        }

        logger.info(`Return updated: ${investmentReturn._id}`);

        res.json({
            success: true,
            data: investmentReturn,
            message: 'Return updated successfully',
        });
    } catch (error) {
        logger.error('Update return error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update return',
        });
    }
};

/**
 * Delete a return
 */
const deleteReturn = async (req, res) => {
    try {
        const investmentReturn = await InvestmentReturn.findByIdAndDelete(req.params.returnId);

        if (!investmentReturn) {
            return res.status(404).json({
                success: false,
                message: 'Return not found',
            });
        }

        logger.info(`Return deleted: ${req.params.returnId}`);

        res.json({
            success: true,
            message: 'Return deleted successfully',
        });
    } catch (error) {
        logger.error('Delete return error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete return',
        });
    }
};

/**
 * Get investment stats for dashboard
 */
const getInvestmentStats = async (req, res) => {
    try {
        const currentMonth = new Date();
        const currentYear = currentMonth.getFullYear();
        const currentMonthNum = currentMonth.getMonth() + 1;

        const [investmentStats, monthlyTotal, allTimeStats, monthlyTrend] = await Promise.all([
            Investment.getStats(),
            InvestmentReturn.getMonthlyTotal(currentYear, currentMonthNum),
            InvestmentReturn.getAllTimeStats(),
            InvestmentReturn.getMonthlyTrend(12),
        ]);

        res.json({
            success: true,
            data: {
                investments: investmentStats,
                currentMonth: monthlyTotal,
                allTime: allTimeStats,
                monthlyTrend: monthlyTrend.map((item) => ({
                    month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
                    label: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', {
                        month: 'short',
                    }),
                    total: safeNumber(item.total),
                    gains: safeNumber(item.gains),
                    losses: safeNumber(item.losses),
                })),
            },
        });
    } catch (error) {
        logger.error('Get investment stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch investment statistics',
        });
    }
};

module.exports = {
    showInvestments,
    getInvestments,
    getInvestment,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    getReturns,
    addReturn,
    updateReturn,
    deleteReturn,
    getInvestmentStats,
};
