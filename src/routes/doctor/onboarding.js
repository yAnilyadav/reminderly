// src/routes/doctor/onboarding.js
const express = require('express');
const router = express.Router();
const onboardingController = require('../../controllers/doctor/onboarding.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Public routes - no authentication required
router.post('/signup', onboardingController.signup);
router.post('/resend-verification', onboardingController.resendVerification);
router.get('/verify-email', onboardingController.verifyEmail);
router.post('/login', onboardingController.login);
router.post('/forgot-password', onboardingController.forgotPassword);
router.post('/reset-password', onboardingController.resetPassword);

// Protected routes - require authentication (explicitly applied)
router.get('/profile', authMiddleware, onboardingController.getProfile);
router.put('/change-password', authMiddleware, onboardingController.changePassword);

module.exports = router;

//signup ->sent verification email
//resend-verification-> send email to resend verification email if not received
//verify-email->verify email based on email link received which has token which comes in get api
//forgot-password ->send email which has a token which will be used in reset password
//rese-password -> send the token received in forgetpassword email along with newpassword
