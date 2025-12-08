const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema(
    {
        // Basic Information
        name: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        // Financial Details
        principal: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'USD',
        },

        // Investment Type
        type: {
            type: String,
            enum: ['stocks', 'bonds', 'real_estate', 'crypto', 'mutual_fund', 'business', 'other'],
            default: 'other',
        },

        // Status
        status: {
            type: String,
            enum: ['active', 'paused', 'closed'],
            default: 'active',
            index: true,
        },

        // Important Dates
        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        endDate: {
            type: Date,
        },

        // Notes
        notes: {
            type: String,
            maxlength: 2000,
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
investmentSchema.index({ status: 1, createdAt: -1 });
investmentSchema.index({ name: 'text', description: 'text' });

// Virtual for returns
investmentSchema.virtual('returns', {
    ref: 'InvestmentReturn',
    localField: '_id',
    foreignField: 'investment',
});

// Static method to get active investments
investmentSchema.statics.getActive = function () {
    return this.find({ status: 'active' }).sort('-createdAt');
};

// Static method for dashboard stats
investmentSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $facet: {
                byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalInvestments: { $sum: 1 },
                            totalPrincipal: { $sum: '$principal' },
                            activePrincipal: {
                                $sum: {
                                    $cond: [{ $eq: ['$status', 'active'] }, '$principal', 0],
                                },
                            },
                        },
                    },
                ],
            },
        },
    ]);

    return stats[0];
};

// Ensure virtual fields are serialized
investmentSchema.set('toJSON', { virtuals: true });
investmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Investment', investmentSchema);
