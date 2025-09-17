const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
    {
        // Basic Information
        name: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            index: true,
            sparse: true, // Allow multiple null values
        },
        phone: {
            type: String,
            trim: true,
        },
        company: {
            type: String,
            trim: true,
        },
        website: {
            type: String,
            trim: true,
        },

        // Contact Person
        contactPerson: {
            name: String,
            title: String,
            email: String,
            phone: String,
        },

        // Address
        address: {
            street: String,
            city: String,
            state: String,
            postalCode: String,
            country: String,
        },

        // Business Details
        industry: {
            type: String,
            enum: ['technology', 'healthcare', 'finance', 'retail', 'education', 'other'],
            default: 'other',
        },
        companySize: {
            type: String,
            enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
        },

        // Status
        status: {
            type: String,
            enum: ['lead', 'active', 'inactive', 'archived'],
            default: 'lead',
            index: true,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
        },

        // Notes
        notes: {
            type: String,
            maxlength: 2000,
        },
        internalNotes: {
            type: String,
            maxlength: 2000,
        },

        // Tags for filtering
        tags: [String],

        // Important Dates
        acquisitionDate: Date,
        lastContactDate: Date,
        nextFollowUp: Date,

        // Metrics
        totalRevenue: {
            type: Number,
            default: 0,
        },
        totalProjects: {
            type: Number,
            default: 0,
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
clientSchema.index({ status: 1, createdAt: -1 });
clientSchema.index({ name: 'text', company: 'text', email: 'text' });

// Virtual for display name
clientSchema.virtual('displayName').get(function () {
    return this.company || this.name;
});

// Virtual for proposals
clientSchema.virtual('proposals', {
    ref: 'Proposal',
    localField: '_id',
    foreignField: 'client',
});

// Virtual for invoices
clientSchema.virtual('invoices', {
    ref: 'Invoice',
    localField: '_id',
    foreignField: 'client',
});

// Method to update revenue
clientSchema.methods.updateRevenue = async function () {
    const Invoice = mongoose.model('Invoice');
    const result = await Invoice.aggregate([
        { $match: { client: this._id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    this.totalRevenue = result[0]?.total || 0;
    await this.save();
};

// Static method to get active clients
clientSchema.statics.getActive = function () {
    return this.find({ status: 'active' }).sort('-lastContactDate');
};

// Static method for dashboard stats
clientSchema.statics.getStats = async function () {
    const stats = await this.aggregate([
        {
            $facet: {
                byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                byIndustry: [{ $group: { _id: '$industry', count: { $sum: 1 } } }],
                totals: [
                    {
                        $group: {
                            _id: null,
                            totalClients: { $sum: 1 },
                            totalRevenue: { $sum: '$totalRevenue' },
                            avgRevenue: { $avg: '$totalRevenue' },
                        },
                    },
                ],
            },
        },
    ]);

    return stats[0];
};

// Ensure virtual fields are serialized
clientSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Client', clientSchema);
