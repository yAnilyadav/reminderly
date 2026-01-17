// src/routes/doctor/onboarding.js
const express = require('express');
const router = express.Router();
const onboardingController = require('../../controllers/doctor/onboarding.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public routes - no authentication required
router.post('/signup', onboardingController.signup);
router.post('/login', onboardingController.login);

// Protected routes - require authentication (explicitly applied)
router.get('/profile', authMiddleware, onboardingController.getProfile);
router.put('/change-password', authMiddleware, onboardingController.changePassword);

module.exports = router;