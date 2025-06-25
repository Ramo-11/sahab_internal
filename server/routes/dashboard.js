const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');

// Dashboard home page
router.get('/', getDashboardStats);

module.exports = router;