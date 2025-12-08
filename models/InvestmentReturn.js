const mongoose = require('mongoose');

const investmentReturnSchema = new mongoose.Schema(
    {
        // Reference to Investment
        investment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Investment',
            required: true,
            index: true,
        },

        // Return Amount (can be positive, zero, or negative)
        amount: {
            type: Number,
            required: true,
        },

        // Period
        returnDate: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },

        // Optional period tracking
        period: {
            month: {
                type: Number,
                min: 1,
                max: 12,
            },
            year: {
                type: Number,
            },
        },

        // Notes
        notes: {
            type: String,
            maxlength: 500,
        },

        // Timestamps
        createdAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
investmentReturnSchema.index({ investment: 1, returnDate: -1 });
investmentReturnSchema.index({ returnDate: -1 });

// Virtual for return type (gain, loss, or break-even)
investmentReturnSchema.virtual('returnType').get(function () {
    if (this.amount > 0) return 'gain';
    if (this.amount < 0) return 'loss';
    return 'break-even';
});

// Static method to get monthly total returns
investmentReturnSchema.statics.getMonthlyTotal = async function (year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await this.aggregate([
        {
            $match: {
                returnDate: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                gains: {
                    $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] },
                },
                losses: {
                    $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] },
                },
                count: { $sum: 1 },
            },
        },
    ]);

    return result[0] || { total: 0, gains: 0, losses: 0, count: 0 };
};

// Static method to get returns by investment
investmentReturnSchema.statics.getByInvestment = async function (investmentId) {
    return this.find({ investment: investmentId }).sort('-returnDate');
};

// Static method to get all-time stats
investmentReturnSchema.statics.getAllTimeStats = async function () {
    const result = await this.aggregate([
        {
            $group: {
                _id: null,
                totalReturns: { $sum: '$amount' },
                totalGains: {
                    $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] },
                },
                totalLosses: {
                    $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] },
                },
                count: { $sum: 1 },
            },
        },
    ]);

    return result[0] || { totalReturns: 0, totalGains: 0, totalLosses: 0, count: 0 };
};

// Static method to get monthly trend
investmentReturnSchema.statics.getMonthlyTrend = async function (months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    return this.aggregate([
        {
            $match: {
                returnDate: { $gte: startDate },
            },
        },
        {
            $group: {
                _id: {
                    year: { $year: '$returnDate' },
                    month: { $month: '$returnDate' },
                },
                total: { $sum: '$amount' },
                gains: {
                    $sum: { $cond: [{ $gt: ['$amount', 0] }, '$amount', 0] },
                },
                losses: {
                    $sum: { $cond: [{ $lt: ['$amount', 0] }, '$amount', 0] },
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
};

// Ensure virtual fields are serialized
investmentReturnSchema.set('toJSON', { virtuals: true });
investmentReturnSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InvestmentReturn', investmentReturnSchema);
