const Expense = require('../../models/Expense');
const Client = require('../../models/Client');
const { logger } = require('../logger');

/**
 * Helper to safely get a number value (prevents NaN)
 */
const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Show expenses list
 */
const showExpenses = async (req, res) => {
    try {
        const { category, client, search, month } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (client) filter.client = client;

        if (search) {
            filter.description = new RegExp(search, 'i');
        }

        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = new Date(year, monthNum - 1, 1);
            const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
            filter.expenseDate = {
                $gte: startDate,
                $lte: endDate,
            };
        }

        // Get current dates for comparisons
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const [
            expenses,
            clients,
            totalExpensesAgg,
            currentMonthExpenses,
            lastMonthExpenses,
            categoryBreakdown,
            monthlyTrend,
        ] = await Promise.all([
            // Main expenses query
            Expense.find(filter).populate('client', 'name company').sort('-expenseDate'),

            // Clients for dropdown
            Client.find({ status: 'active' }).select('name company').sort('company'),

            // Total expenses (all time)
            Expense.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
            ]),

            // Current month expenses
            Expense.aggregate([
                { $match: { expenseDate: { $gte: currentMonthStart } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
            ]),

            // Last month expenses
            Expense.aggregate([
                { $match: { expenseDate: { $gte: lastMonthStart, $lte: lastMonthEnd } } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
            ]),

            // Category breakdown
            Expense.aggregate([
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { total: -1 } },
            ]),

            // Monthly trend (last 6 months)
            Expense.aggregate([
                {
                    $match: {
                        expenseDate: {
                            $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$expenseDate' },
                            month: { $month: '$expenseDate' },
                        },
                        total: { $sum: { $ifNull: ['$amount', 0] } },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
            ]),
        ]);

        // Calculate filtered total
        const filteredTotal = expenses.reduce(
            (sum, expense) => sum + safeNumber(expense.amount),
            0
        );

        // Calculate category totals for filtered results
        const categoryTotals = expenses.reduce((acc, expense) => {
            const cat = expense.category || 'other';
            acc[cat] = (acc[cat] || 0) + safeNumber(expense.amount);
            return acc;
        }, {});

        // Calculate stats
        const totalAll = safeNumber(totalExpensesAgg[0]?.total);
        const currentMonthTotal = safeNumber(currentMonthExpenses[0]?.total);
        const lastMonthTotal = safeNumber(lastMonthExpenses[0]?.total);
        const monthlyChange =
            lastMonthTotal > 0 ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

        // Calculate average expense
        const totalCount = safeNumber(totalExpensesAgg[0]?.count);
        const avgExpense = totalCount > 0 ? totalAll / totalCount : 0;

        // Format category breakdown for chart
        const categoryData = categoryBreakdown.map((cat) => ({
            category: cat._id || 'other',
            total: safeNumber(cat.total),
            count: safeNumber(cat.count),
            percentage: totalAll > 0 ? (safeNumber(cat.total) / totalAll) * 100 : 0,
        }));

        // Format monthly trend for chart
        const trendData = monthlyTrend.map((item) => ({
            month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
            label: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', {
                month: 'short',
            }),
            total: safeNumber(item.total),
            count: safeNumber(item.count),
        }));

        const stats = {
            totalAll,
            totalCount,
            filteredTotal,
            filteredCount: expenses.length,
            currentMonthTotal,
            currentMonthCount: safeNumber(currentMonthExpenses[0]?.count),
            lastMonthTotal,
            monthlyChange: safeNumber(monthlyChange),
            avgExpense: safeNumber(avgExpense),
            categoryData,
            trendData,
        };

        res.render('expenses/index', {
            title: 'Expenses - Sahab Solutions',
            layout: 'layout',
            expenses,
            clients,
            stats,
            categoryTotals,
            filters: { category, client, search, month },
            additionalCSS: ['expenses.css'],
            additionalJS: ['expenses.js'],
            activeTab: 'expenses',
        });
    } catch (error) {
        logger.error('Show expenses error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load expenses',
            layout: 'layout',
        });
    }
};

/**
 * Get expenses API
 */
const getExpenses = async (req, res) => {
    try {
        const { category, client, search } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (client) filter.client = client;
        if (search) filter.description = new RegExp(search, 'i');

        const expenses = await Expense.find(filter)
            .populate('client', 'name company')
            .sort('-expenseDate');

        res.json({
            success: true,
            data: expenses,
        });
    } catch (error) {
        logger.error('Get expenses error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expenses',
        });
    }
};

/**
 * Create new expense
 */
const createExpense = async (req, res) => {
    try {
        const expenseData = {
            ...req.body,
            amount: safeNumber(req.body.amount),
        };

        const expense = new Expense(expenseData);
        await expense.save();

        logger.info(`Expense created: ${expense._id}`);

        res.json({
            success: true,
            data: expense,
            message: 'Expense added successfully',
        });
    } catch (error) {
        logger.error('Create expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create expense',
        });
    }
};

/**
 * Update expense
 */
const updateExpense = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates._id;

        if (updates.amount !== undefined) {
            updates.amount = safeNumber(updates.amount);
        }

        const expense = await Expense.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        logger.info(`Expense updated: ${expense._id}`);

        res.json({
            success: true,
            data: expense,
            message: 'Expense updated successfully',
        });
    } catch (error) {
        logger.error('Update expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update expense',
        });
    }
};

/**
 * Delete expense
 */
const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        logger.info(`Expense deleted: ${req.params.id}`);

        res.json({
            success: true,
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        logger.error('Delete expense error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete expense',
        });
    }
};

/**
 * Get expense stats for dashboard
 */
const getExpenseStats = async (req, res) => {
    try {
        const currentMonth = new Date();
        const currentYear = currentMonth.getFullYear();
        const currentMonthNum = currentMonth.getMonth() + 1;

        const monthlyTotal = await Expense.getMonthlyTotal(currentYear, currentMonthNum);

        // Get last 12 months of expenses
        const monthlyData = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;

            const data = await Expense.getMonthlyTotal(year, month);
            monthlyData.push({
                month: `${year}-${month.toString().padStart(2, '0')}`,
                label: date.toLocaleDateString('en-US', { month: 'short' }),
                total: safeNumber(data.total),
                count: safeNumber(data.count),
            });
        }

        // Category breakdown
        const categoryBreakdown = await Expense.aggregate([
            {
                $group: {
                    _id: '$category',
                    total: { $sum: { $ifNull: ['$amount', 0] } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { total: -1 } },
        ]);

        res.json({
            success: true,
            data: {
                currentMonth: {
                    total: safeNumber(monthlyTotal.total),
                    count: safeNumber(monthlyTotal.count),
                },
                monthlyData,
                categoryBreakdown: categoryBreakdown.map((cat) => ({
                    category: cat._id || 'other',
                    total: safeNumber(cat.total),
                    count: safeNumber(cat.count),
                })),
            },
        });
    } catch (error) {
        logger.error('Get expense stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch expense statistics',
        });
    }
};

module.exports = {
    showExpenses,
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseStats,
};
