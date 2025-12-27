const mongoose = require('mongoose');

const invoiceNumberSchema = new mongoose.Schema(
    {
        number: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        usedFor: {
            type: String,
            trim: true,
        },
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Static method to generate a unique invoice number
invoiceNumberSchema.statics.generateUniqueNumber = async function () {
    const Invoice = mongoose.model('Invoice');
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
        const number = String(Math.floor(10000 + Math.random() * 90000)); // 5-digit number

        // Check if number exists in InvoiceNumber collection
        const existsInNumberTable = await this.findOne({ number });

        // Also check if number is already used in an actual Invoice
        const existsInInvoice = await Invoice.findOne({ invoiceNumber: number });

        if (!existsInNumberTable && !existsInInvoice) {
            const newNumber = await this.create({ number });
            return newNumber;
        }
        attempts++;
    }

    throw new Error('Failed to generate unique invoice number after maximum attempts');
};

// Static method to get all generated numbers
invoiceNumberSchema.statics.getAllNumbers = function () {
    return this.find().sort('-createdAt');
};

// Static method to check if number exists
invoiceNumberSchema.statics.numberExists = async function (number) {
    const exists = await this.findOne({ number });
    return !!exists;
};

module.exports = mongoose.model('InvoiceNumber', invoiceNumberSchema);
