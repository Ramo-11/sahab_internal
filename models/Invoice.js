const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
    {
        // References
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Client',
            required: true,
            index: true,
        },
        proposal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Proposal',
        },

        // Invoice Details
        invoiceNumber: {
            type: String,
            unique: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            maxlength: 2000,
        },

        // Line Items
        items: [
            {
                description: String,
                quantity: {
                    type: Number,
                    default: 1,
                },
                rate: Number,
                amount: Number,
            },
        ],

        // Amounts
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        tax: {
            rate: {
                type: Number,
                default: 0,
            },
            amount: {
                type: Number,
                default: 0,
            },
        },
        discount: {
            rate: {
                type: Number,
                default: 0,
            },
            amount: {
                type: Number,
                default: 0,
            },
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: 'USD',
        },

        // Dates
        issueDate: {
            type: Date,
            default: Date.now,
            required: true,
        },
        dueDate: {
            type: Date,
            required: true,
            index: true,
        },
        paidDate: Date,

        // Status
        status: {
            type: String,
            enum: ['draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'cancelled'],
            default: 'draft',
            index: true,
        },

        // Payment Details
        paymentMethod: {
            type: String,
            enum: ['bank_transfer', 'zelle', 'check', 'cash', 'paypal', 'stripe', 'other'],
        },
        paymentReference: String,
        paymentHistory: [
            {
                amount: Number,
                method: String,
                reference: String,
                datePaid: Date,
                dateRecorded: {
                    type: Date,
                    default: Date.now,
                },
                notes: String,
            },
        ],
        amountPaid: {
            type: Number,
            default: 0,
        },

        // Document Link
        documentUrl: {
            type: String,
            trim: true,
        },

        // Terms
        paymentTerms: {
            type: String,
            default: 'Net 30',
        },
        notes: {
            type: String,
            maxlength: 1000,
        },
        internalNotes: {
            type: String,
            maxlength: 1000,
        },

        // Reminders
        remindersSent: [
            {
                sentAt: Date,
                method: String,
                notes: String,
            },
        ],
        lastReminderDate: Date,

        // Tags
        tags: [String],

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

        paidDate: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
invoiceSchema.index({ client: 1, createdAt: -1 });
invoiceSchema.index({ status: 1, dueDate: 1 });

// Virtual for formatted number
invoiceSchema.virtual('formattedNumber').get(function () {
    return `INV-${this.invoiceNumber}`;
});

// Virtual for is overdue
invoiceSchema.virtual('isOverdue').get(function () {
    if (this.status === 'paid' || this.status === 'cancelled') {
        return false;
    }
    return new Date() > this.dueDate;
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function () {
    if (!this.isOverdue) return 0;
    const diff = new Date() - this.dueDate;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual for balance due
invoiceSchema.virtual('balanceDue').get(function () {
    return this.amount - this.amountPaid;
});

// Method to mark as sent
invoiceSchema.methods.markAsSent = async function () {
    this.status = 'sent';
    await this.save();
};

// Method to mark as paid
invoiceSchema.methods.markAsPaid = async function (paymentDetails = {}) {
    this.status = 'paid';
    this.paidDate = new Date();
    this.amountPaid = this.amount;

    if (paymentDetails.method) {
        this.paymentMethod = paymentDetails.method;
    }
    if (paymentDetails.reference) {
        this.paymentReference = paymentDetails.reference;
    }

    await this.save();

    // Update client revenue
    const Client = mongoose.model('Client');
    await Client.findByIdAndUpdate(this.client, { $inc: { totalRevenue: this.amount } });
};

// Method to record partial payment
invoiceSchema.methods.recordPayment = async function (amount) {
    this.amountPaid = (this.amountPaid || 0) + amount;

    if (this.amountPaid >= this.amount) {
        await this.markAsPaid();
    } else {
        this.status = 'partial';
        await this.save();
    }
};

// Method to send reminder
invoiceSchema.methods.sendReminder = async function (method = 'email', notes = '') {
    this.remindersSent.push({
        sentAt: new Date(),
        method,
        notes,
    });
    this.lastReminderDate = new Date();
    await this.save();
};

// Static method to get unpaid invoices
invoiceSchema.statics.getUnpaid = function () {
    return this.find({
        status: { $in: ['sent', 'viewed', 'overdue', 'partial'] },
    }).populate('client', 'name company email');
};

// Static method for revenue stats
invoiceSchema.statics.getRevenueStats = async function (startDate, endDate) {
    const filter = { status: { $in: ['paid', 'partial'] } };
    if (startDate && endDate) {
        filter.$or = [
            { paidDate: { $gte: startDate, $lte: endDate } },
            // Fallback for invoices without paidDate
            {
                paidDate: { $exists: false },
                status: { $in: ['paid', 'partial'] },
                updatedAt: { $gte: startDate, $lte: endDate },
            },
        ];
    }

    const stats = await this.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                // Use amountPaid if available, otherwise use amount for paid invoices
                totalRevenue: {
                    $sum: {
                        $cond: [
                            { $gt: ['$amountPaid', 0] },
                            '$amountPaid',
                            { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', '$amountPaid'] }
                        ]
                    }
                },
                invoiceCount: { $sum: 1 },
                avgInvoiceAmount: {
                    $avg: {
                        $cond: [
                            { $gt: ['$amountPaid', 0] },
                            '$amountPaid',
                            { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', '$amountPaid'] }
                        ]
                    }
                },
            },
        },
    ]);

    const unpaidStats = await this.aggregate([
        {
            $match: {
                status: { $nin: ['paid', 'cancelled'] },
            },
        },
        {
            $group: {
                _id: null,
                totalUnpaid: { $sum: '$amount' },
                unpaidCount: { $sum: 1 },
            },
        },
    ]);

    return {
        ...(stats[0] || { totalRevenue: 0, invoiceCount: 0, avgInvoiceAmount: 0 }),
        ...(unpaidStats[0] || { totalUnpaid: 0, unpaidCount: 0 }),
    };
};

// Ensure virtual fields are serialized
invoiceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
