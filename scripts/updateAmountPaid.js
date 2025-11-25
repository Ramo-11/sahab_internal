const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
require('dotenv').config();

// env setup
const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined');
    process.exit();
}

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;
mongoose.connect(process.env.MONGODB_URI);

async function fixInvoices() {
    // find invoices that are paid and amountPaid is 0
    const invoices = await Invoice.find({ status: 'paid', amountPaid: 0 });

    for (const inv of invoices) {
        inv.amountPaid = inv.amount;
        await inv.save();
        console.log(`Updated invoice ${inv._id}`);
    }

    process.exit();
}

fixInvoices();
