// src/routes/doctor/visit.js - ONLY ADD VISIT ROUTE
const express = require('express');
const router = express.Router();
const visitController = require('../../controllers/doctor/visit.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Create visit (requires authentication)
router.post('/', authMiddleware, visitController.createVisit);
router.get('/overdue', authMiddleware, visitController.getOverduePatients);
router.get('/today', authMiddleware, visitController.getTodayExpectedVisits);
router.get('/upcoming', authMiddleware, visitController.getUpcomingVisits);

module.exports = router;