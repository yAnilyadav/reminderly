// src/controllers/doctor/onboarding.controller.js
const { Doctor } = require('../../models')(require('../../config/db'), require('sequelize').DataTypes);
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { 
  sendVerificationEmail, 
  sendWelcomeEmail, 
  sendPasswordResetEmail 
} = require('../../utils/emailService');

// Generate JWT Token
const generateToken = (doctorId) => {
  return jwt.sign({ id: doctorId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};


exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    const existingDoctor = await Doctor.findOne({ where: { email } });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor with this email already exists'
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const doctor = await Doctor.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      verificationToken,
      verificationTokenExpires,
      emailVerified: false,
      isActive: false // Set to true for auto-activation
    });

    // ✅ SEND VERIFICATION EMAIL
    const emailResult = await sendVerificationEmail(email, verificationToken, name);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      // Continue anyway - user can request resend later
    }

    const token = generateToken(doctor.id);
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.passwordHash;
    delete doctorResponse.verificationToken;
    delete doctorResponse.verificationTokenExpires;

    // Build response
    const response = {
      success: true,
      message: 'Doctor registered successfully. Please check your email to verify your account.',
      data: {
        doctor: doctorResponse,
        token
      }
    };

    // If in development, include preview URL
    if (process.env.NODE_ENV === 'development' && emailResult.previewUrl) {
      response.emailPreview = emailResult.previewUrl;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering doctor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify email endpoint
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    const doctor = await Doctor.findOne({
      where: {
        verificationToken: token,
        verificationTokenExpires: { [Op.gt]: new Date() }
      }
    });

    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    await doctor.update({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null
    });

    // ✅ SEND WELCOME EMAIL
    const emailResult = await sendWelcomeEmail(doctor.email, doctor.name);
    
    if (!emailResult.success) {
      console.error('Failed to send welcome email:', emailResult.error);
      // Continue anyway
    }

    const response = {
      success: true,
      message: 'Email verified successfully! You can now login.'
    };

    // If in development, include preview URL
    if (process.env.NODE_ENV === 'development' && emailResult.previewUrl) {
      response.emailPreview = emailResult.previewUrl;
    }

    res.json(response);

  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email'
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find doctor
    const doctor = await Doctor.findOne({ where: { email } });
    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // NEW: Check if email is verified
    if (!doctor.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // NEW: Check if account is active
    if (!doctor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please contact admin.'
      });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, doctor.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(doctor.id);

    // Remove password hash from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.passwordHash;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        doctor: doctorResponse,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const doctorId = req.doctorId; // From auth middleware

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Find doctor
    const doctor = await Doctor.findByPk(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, doctor.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await doctor.update({ passwordHash: newPasswordHash });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get Current Doctor Profile
exports.getProfile = async (req, res) => {
  try {
    const doctorId = req.doctorId; // From auth middleware

    const doctor = await Doctor.findByPk(doctorId, {
      attributes: { exclude: ['passwordHash'] }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    res.json({
      success: true,
      data: { doctor }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Resend verification email
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    const doctor = await Doctor.findOne({ where: { email } });
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    if (doctor.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await doctor.update({
      verificationToken,
      verificationTokenExpires
    });

    // ✅ RESEND VERIFICATION EMAIL
    const emailResult = await sendVerificationEmail(email, verificationToken, doctor.name);
    
    if (!emailResult.success) {
      console.error('Failed to resend verification email:', emailResult.error);
    }

    const response = {
      success: true,
      message: 'Verification email resent. Please check your inbox.'
    };

    if (process.env.NODE_ENV === 'development' && emailResult.previewUrl) {
      response.emailPreview = emailResult.previewUrl;
    }

    res.json(response);

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending verification email'
    });
  }
};


// Forgot password - request reset
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email'
      });
    }

    const doctor = await Doctor.findOne({ where: { email } });
    
    if (!doctor) {
      // Don't reveal if user exists or not for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await doctor.update({
      resetToken,
      resetTokenExpires
    });

    // ✅ SEND PASSWORD RESET EMAIL
    // const { sendPasswordResetEmail } = require('../../utils/emailService');
    const emailResult = await sendPasswordResetEmail(email, resetToken, doctor.name);
    
    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
    }

    const response = {
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    };

    if (process.env.NODE_ENV === 'development' && emailResult.previewUrl) {
      response.emailPreview = emailResult.previewUrl;
    }

    res.json(response);

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
};

// Reset password with token
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    const doctor = await Doctor.findOne({
      where: {
        resetToken: token,
        resetTokenExpires: { [Op.gt]: new Date() }
      }
    });

    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    await doctor.update({
      passwordHash: newPasswordHash,
      resetToken: null,
      resetTokenExpires: null
    });

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};