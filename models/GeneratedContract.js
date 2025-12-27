const mongoose = require('mongoose');

const generatedContractSchema = new mongoose.Schema(
    {
        // References
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        linkedProposal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'GeneratedProposal',
        },

        // Identification
        contractNumber: {
            type: String,
            unique: true,
            sparse: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },

        // Parties
        clientCompanyName: {
            type: String,
            trim: true,
        },
        clientRepresentativeName: {
            type: String,
            trim: true,
        },

        // Project Overview
        projectName: {
            type: String,
            trim: true,
        },
        projectDescription: {
            type: String,
            maxlength: 5000,
        },

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

        // Payment
        payment: {
            totalAmount: {
                type: Number,
                min: 0,
                default: 0,
            },
            description: {
                type: String,
                default: 'One-Time',
            },
            schedule: [
                {
                    description: String,
                    amount: Number,
                    dueDate: Date,
                },
            ],
            operationalCostsNote: {
                type: String,
                default:
                    'All ongoing operational costs — including but not limited to hosting, database usage, integration fees, API costs, and any third-party service charges — will be billed separately during the installment period. These costs are not included in the project fee.',
            },
            paymentInstructions: {
                type: String,
                default: 'All payments must be made via Zelle to sahab@sahab-solutions.com',
            },
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
            startsAfter: {
                type: String,
                default: 'after the final installment payment is made',
            },
            includes: [String],
        },

        // Resale Rights & Revenue Sharing
        resaleRights: {
            type: String,
            default:
                'This contract does not grant resale, redistribution, or licensing rights to the platform. Any resale or revenue-sharing arrangement must be defined in a separate written agreement.',
        },

        // Terms and Conditions
        termsAndConditions: {
            type: [String],
            default: [
                'The client agrees to provide all necessary content, assets, and feedback promptly.',
                'Sahab Solutions may display the project in its portfolio unless otherwise agreed in writing.',
                'Ongoing maintenance covers bug fixes and optimization; new features or redesigns are billed separately.',
                'Sahab Solutions retains ownership of the codebase unless a buyout agreement is made.',
                'If the client wishes to buy out the codebase, the terms and price will be determined in a separate, newly drafted agreement.',
                'Sahab Solutions is not liable for indirect or consequential damages or downtime.',
                'Both parties agree to maintain confidentiality regarding project details, system credentials, and intellectual property.',
                'Delays caused by the client may extend the timeline.',
                'All intellectual property will be transferred upon full payment and upon request, except for the codebase itself, which requires a separate buyout agreement.',
            ],
        },

        // Signatures
        signatures: {
            sahabName: {
                type: String,
                default: 'Omar Abdelalim',
            },
            sahabTitle: {
                type: String,
                default: 'Sahab Solutions',
            },
            clientName: String,
            clientTitle: String,
            signedDate: Date,
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
            enum: ['draft', 'sent', 'signed'],
            default: 'draft',
            index: true,
        },

        // Dates
        sentDate: Date,
        signedDate: Date,

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
generatedContractSchema.index({ client: 1, createdAt: -1 });
generatedContractSchema.index({ status: 1, createdAt: -1 });
generatedContractSchema.index({ linkedProposal: 1 });

// Pre-save: Generate contract number if not set
generatedContractSchema.pre('save', async function (next) {
    if (!this.contractNumber) {
        const count = await this.constructor.countDocuments();
        const year = new Date().getFullYear();
        this.contractNumber = `CONTRACT-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// Virtual for formatted amount
generatedContractSchema.virtual('formattedAmount').get(function () {
    if (!this.payment?.totalAmount) return '$0.00';
    return (
        '$' +
        this.payment.totalAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
});

// Method to mark as sent
generatedContractSchema.methods.markAsSent = async function () {
    this.status = 'sent';
    this.sentDate = new Date();
    await this.save();
};

// Method to mark as signed
generatedContractSchema.methods.markAsSigned = async function (signedDate) {
    this.status = 'signed';
    this.signedDate = signedDate || new Date();
    this.signatures.signedDate = this.signedDate;
    await this.save();
};

// Static method to get stats
generatedContractSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalValue: { $sum: '$payment.totalAmount' },
            },
        },
    ]);

    return stats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, totalValue: stat.totalValue };
        return acc;
    }, {});
};

// Ensure virtual fields are serialized
generatedContractSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('GeneratedContract', generatedContractSchema);
