const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        category: {
            type: String,
            enum: [
                'office',
                'software',
                'travel',
                'meals',
                'drinks',
                'marketing',
                'contractors',
                'donation',
                'other',
            ],
            default: 'other',
        },
        expenseDate: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
        },
        notes: {
            type: String,
            maxlength: 1000,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
expenseSchema.index({ expenseDate: -1 });

// Virtual for display amount
expenseSchema.virtual('displayAmount').get(function () {
    return `$${(this.amount / 100).toFixed(2)}`;
});

// Static method to get monthly total
expenseSchema.statics.getMonthlyTotal = async function (year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await this.aggregate([
        {
            $match: {
                expenseDate: {
                    $gte: startDate,
                    $lte: endDate,
                },
            },
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
    ]);

    return result[0] || { total: 0, count: 0 };
};

// Ensure virtual fields are serialized
expenseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Expense', expenseSchema);
