const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema(
    {
        // References
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },

        // Proposal Details
        title: {
            type: String,
            required: true,
            trim: true,
        },
        version: {
            type: String,
            default: '1.0',
        },

        // Project Details
        projectType: {
            type: String,
            enum: ['website', 'mobile_app', 'software', 'consulting', 'maintenance', 'other'],
        },
        description: {
            type: String,
            maxlength: 5000,
        },

        // Pricing
        pricing: {
            model: {
                type: String,
                enum: ['fixed', 'hourly', 'retainer', 'milestone'],
                default: 'fixed',
            },
            amount: {
                type: Number,
                min: 0,
                default: 0,
            },
            currency: {
                type: String,
                default: 'USD',
            },
        },

        // Status
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected'],
            default: 'draft',
            index: true,
        },

        // Important Dates
        sentDate: Date,
        viewedDate: Date,
        acceptedDate: Date,
        rejectedDate: Date,

        // Document Links
        documentUrl: {
            type: String,
            trim: true,
        },

        // Response
        clientResponse: {
            feedback: String,
            respondedAt: Date,
        },

        // Notes
        internalNotes: {
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
proposalSchema.index({ client: 1, createdAt: -1 });
proposalSchema.index({ status: 1 });

// Virtual for formatted number
proposalSchema.virtual('formattedNumber').get(function () {
    return `PRO-${this.proposalNumber}`;
});

// Virtual for is expired
proposalSchema.virtual('isExpired').get(function () {
    if (this.status === 'accepted' || this.status === 'rejected') {
        return false;
    }
    return this.expiryDate && new Date() > this.expiryDate;
});

// Method to mark as sent
proposalSchema.methods.markAsSent = async function () {
    this.status = 'sent';
    this.sentDate = new Date();
    await this.save();
};

// Method to mark as viewed
proposalSchema.methods.markAsViewed = async function () {
    if (this.status === 'sent') {
        this.status = 'viewed';
        this.viewedDate = new Date();
        await this.save();
    }
};

// Method to accept
proposalSchema.methods.accept = async function (notes = '') {
    this.status = 'accepted';
    this.acceptedDate = new Date();
    this.clientResponse = {
        feedback: notes,
        respondedAt: new Date(),
    };
    await this.save();

    const Client = mongoose.model('Client');
    await Client.findByIdAndUpdate(this.client, { $inc: { totalProjects: 1 } });
};

// Static method to get pending proposals
proposalSchema.statics.getPending = function () {
    return this.find({
        status: { $in: ['sent', 'viewed'] },
        expiryDate: { $gt: new Date() },
    }).populate('client', 'name company');
};

// Static method for conversion stats
proposalSchema.statics.getConversionStats = async function (startDate, endDate) {
    const filter = {};
    if (startDate && endDate) {
        filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const stats = await this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                sent: { $sum: { $cond: [{ $ne: ['$status', 'draft'] }, 1, 0] } },
                accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                totalValue: { $sum: '$pricing.amount' },
                acceptedValue: {
                    $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, '$pricing.amount', 0] },
                },
            },
        },
    ]);

    return stats[0] || {};
};

// Ensure virtual fields are serialized
proposalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Proposal', proposalSchema);
