// src/routes/doctor/visit.js - ONLY ADD VISIT ROUTE
const express = require('express');
const router = express.Router();
const reminderController = require('../../controllers/doctor/reminder.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Create visit (requires authentication)
router.post('/', authMiddleware, reminderController.initiateWhatsAppReminder);

module.exports = router;