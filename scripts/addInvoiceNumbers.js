const mongoose = require('mongoose');
const InvoiceNumber = require('../models/InvoiceNumber');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined - will not connect');
    return;
}
process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

async function addInvoiceNumbers() {
    const numbers = [
        '58754',
        '57306',
        '33439',
        '99918',
        '85456',
        '34970',
        '34971',
        '57342',
        '47010',
        '39005',
    ];

    for (const number of numbers) {
        const exists = await InvoiceNumber.findOne({ number });
        if (!exists) {
            await InvoiceNumber.create({ number });
        }
    }

    console.log('Invoice numbers added.');
    process.exit();
}

addInvoiceNumbers();
