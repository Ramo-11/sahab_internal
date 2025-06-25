require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const methodOverride = require('method-override');
const { initializeDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure EJS options - this line should be removed or corrected
// app.engine('ejs', require('ejs').renderFile);

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride('_method')); // Enable PUT/DELETE from forms

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Initialize database
initializeDatabase();

// Routes
const clientRoutes = require('./server/routes/clients');
const proposalRoutes = require('./server/routes/proposals');
const invoiceRoutes = require('./server/routes/invoices');
const dashboardRoutes = require('./server/routes/dashboard');

app.use('/', dashboardRoutes);
app.use('/clients', clientRoutes);
app.use('/proposals', proposalRoutes);
app.use('/invoices', invoiceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { 
    title: '404 - Page Not Found',
    appName: process.env.APP_NAME 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    title: '500 - Server Error',
    appName: process.env.APP_NAME,
    error: process.env.NODE_ENV === 'development' ? err : null
  });
});

app.listen(PORT, () => {
  console.log(`${process.env.APP_NAME} running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});