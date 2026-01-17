// src/routes/doctor/visit.js - ONLY ADD VISIT ROUTE
const express = require('express');
const router = express.Router();
const visitController = require('../../controllers/doctor/visit.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Create visit (requires authentication)
router.post('/', authMiddleware, visitController.createVisit);

module.exports = router;