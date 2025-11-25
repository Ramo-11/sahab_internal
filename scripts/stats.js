const fs = require('fs');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
require('dotenv').config();

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined');
    process.exit();
}

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;
mongoose.connect(process.env.MONGODB_URI);

async function run() {
    const total = await Invoice.countDocuments();
    const paid = await Invoice.countDocuments({ status: 'paid' });
    const unpaid = await Invoice.countDocuments({ status: { $ne: 'paid' } });

    const paidInvoices = await Invoice.find({ status: 'paid' });

    const totalAmountPaid = paidInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
    const totalAmount = paidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

    const mismatches = paidInvoices.filter((i) => (i.amountPaid || 0) !== (i.amount || 0));

    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice Stats Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial; margin: 40px; }
        h1 { text-align: center; }
        .chart-container {
            width: 800px;
            margin: 40px auto;
        }
        table {
            margin: 40px auto;
            border-collapse: collapse;
            width: 80%;
        }
        table, th, td {
            border: 1px solid #ccc;
            padding: 12px;
        }
        th {
            background: #f4f4f4;
        }
        .good { color: green; }
        .bad { color: red; }
    </style>
</head>
<body>

<h1>Invoice Statistics Dashboard</h1>

<div class="chart-container">
    <canvas id="invoiceChart"></canvas>
</div>

<div class="chart-container">
    <canvas id="amountChart"></canvas>
</div>

<h2 style="text-align:center;">Summary</h2>
<table>
    <tr><th>Total Invoices</th><td>${total}</td></tr>
    <tr><th>Paid</th><td>${paid}</td></tr>
    <tr><th>Unpaid</th><td>${unpaid}</td></tr>
    <tr><th>Total Amount Paid</th><td>$${totalAmountPaid.toFixed(2)}</td></tr>
    <tr><th>Total Amount (Paid Invoices)</th><td>$${totalAmount.toFixed(2)}</td></tr>
</table>

<h2 style="text-align:center;">Mismatched Invoices</h2>

<table>
    <tr><th>Invoice ID</th><th>amountPaid</th><th>amount</th></tr>
    ${
        mismatches.length === 0
            ? `<tr><td colspan="3" class="good">All invoices match ✔</td></tr>`
            : mismatches
                  .map(
                      (i) => `
            <tr>
                <td>${i._id}</td>
                <td>$${i.amountPaid}</td>
                <td class="bad">$${i.amount}</td>
            </tr>
        `
                  )
                  .join('')
    }
</table>

<script>
    const ctx1 = document.getElementById('invoiceChart');
    new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: ['Total', 'Paid', 'Unpaid'],
            datasets: [{
                label: 'Invoice Counts',
                data: [${total}, ${paid}, ${unpaid}],
                backgroundColor: ['#4c8aff', '#2ecc71', '#e74c3c']
            }]
        }
    });

    const ctx2 = document.getElementById('amountChart');
    new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: ['Amount Paid', 'Total Amount (Paid Invoices)'],
            datasets: [{
                label: 'Amounts',
                data: [${totalAmountPaid}, ${totalAmount}],
                backgroundColor: ['#9b59b6', '#f1c40f']
            }]
        }
    });
</script>

</body>
</html>
`;

    fs.writeFileSync('invoice-stats.html', html);
    console.log('✔ Dashboard generated: invoice-stats.html');
    process.exit();
}

run();
