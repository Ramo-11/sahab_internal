const mongoose = require('mongoose');

const generatedProposalSchema = new mongoose.Schema(
    {
        // Reference
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },

        // Identification
        proposalNumber: {
            type: String,
            unique: true,
            sparse: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },

        // Document sections
        projectName: {
            type: String,
            trim: true,
        },
        projectDescription: {
            type: String,
            maxlength: 5000,
        },
        executiveSummary: {
            type: String,
            maxlength: 3000,
        },

        // Recommended paths (for comparison proposals)
        recommendedPaths: [
            {
                optionTitle: String,
                description: String,
                pros: [String],
                cons: [String],
            },
        ],

        // Scope of work sections
        scopeOfWork: [
            {
                sectionTitle: String,
                description: String,
                items: [String],
            },
        ],

        // Deliverables
        deliverables: [String],

        // Pricing
        pricing: {
            totalAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
            description: {
                type: String,
                default: 'One-Time',
            },
            isOneTime: {
                type: Boolean,
                default: true,
            },
            paymentSchedule: [
                {
                    description: String,
                    amount: Number,
                    dueDate: Date,
                },
            ],
        },

        // Retainer
        retainer: {
            enabled: {
                type: Boolean,
                default: false,
            },
            amount: {
                type: Number,
                min: 0,
            },
            frequency: {
                type: String,
                enum: ['monthly', 'quarterly', 'yearly'],
                default: 'monthly',
            },
            includes: [String],
        },

        // Timeline
        timeline: {
            type: String,
            maxlength: 2000,
        },

        // Closing section
        closingText: {
            type: String,
            default: "We're ready to build and launch your project.",
        },

        // Metadata
        preparedBy: {
            type: String,
            default: 'Sahab Solutions',
        },
        preparedDate: {
            type: Date,
            default: Date.now,
        },
        contactEmail: {
            type: String,
            default: 'sahab@sahab-solutions.com',
        },
        contactWebsite: {
            type: String,
            default: 'sahab-solutions.com',
        },

        // Status tracking
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected'],
            default: 'draft',
            index: true,
        },

        // Dates
        sentDate: Date,
        viewedDate: Date,
        acceptedDate: Date,
        rejectedDate: Date,

        // Notes
        internalNotes: {
            type: String,
            maxlength: 2000,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
generatedProposalSchema.index({ client: 1, createdAt: -1 });
generatedProposalSchema.index({ status: 1, createdAt: -1 });

// Pre-save: Generate proposal number if not set
generatedProposalSchema.pre('save', async function (next) {
    if (!this.proposalNumber) {
        const count = await this.constructor.countDocuments();
        const year = new Date().getFullYear();
        this.proposalNumber = `PROP-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Virtual for formatted amount
generatedProposalSchema.virtual('formattedAmount').get(function () {
    if (!this.pricing?.totalAmount) return '$0.00';
    return (
        '$' +
        this.pricing.totalAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
});

// Method to mark as sent
generatedProposalSchema.methods.markAsSent = async function () {
    this.status = 'sent';
    this.sentDate = new Date();
    await this.save();
};

// Method to mark as accepted
generatedProposalSchema.methods.markAsAccepted = async function () {
    this.status = 'accepted';
    this.acceptedDate = new Date();
    await this.save();

    // Update client total projects
    const Client = mongoose.model('Client');
    await Client.findByIdAndUpdate(this.client, { $inc: { totalProjects: 1 } });
};

// Static method to get stats
generatedProposalSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalValue: { $sum: '$pricing.totalAmount' },
            },
        },
    ]);

    return stats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, totalValue: stat.totalValue };
        return acc;
    }, {});
};

// Ensure virtual fields are serialized
generatedProposalSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('GeneratedProposal', generatedProposalSchema);
