const Expense = require('../../models/Expense');
const Client = require('../../models/Client');
const { logger } = require('../logger');

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

        const expenses = await Expense.find(filter)
            .populate('client', 'name company')
            .sort('-expenseDate');

        // Calculate total
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

        // Get clients for filter dropdown
        const clients = await Client.find({ status: 'active' })
            .select('name company')
            .sort('company');

        res.render('expenses/index', {
            title: 'Expenses - Sahab Solutions',
            layout: 'layout',
            expenses,
            clients,
            total,
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
            amount: req.body.amount * 100, // Convert to cents
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
        const updates = req.body;
        delete updates._id;

        // Don't double convert if already in cents
        if (updates.amount !== undefined && updates.amount < 1000) {
            updates.amount = updates.amount * 100;
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
                total: data.total,
                count: data.count,
            });
        }

        res.json({
            success: true,
            data: {
                currentMonth: monthlyTotal,
                monthlyData,
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
