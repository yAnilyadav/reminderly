// src/controllers/doctor/onboarding.controller.js
const { Doctor } = require('../../models')(require('../../config/db'), require('sequelize').DataTypes);
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op, Sequelize } = require('sequelize'); // Added Sequelize
const { 
  sendOtpEmail, 
  sendWelcomeEmail, 
  sendPasswordResetEmail 
} = require('../../utils/emailService');

// Generate JWT Token
const generateToken = (doctorId) => {
  return jwt.sign({ id: doctorId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Generate 4-digit OTP
const generateOtp = () => {
  const otp = Math.floor(Math.random() * 10000);
  return otp.toString().padStart(4, '0');
};

// Get current UTC time (for timezone-safe comparisons)
const getCurrentUTCTime = () => {
  return new Date().toISOString();
};

// Signup with OTP
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const existingDoctor = await Doctor.findOne({ where: { email } });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor with this email already exists'
      });
    }

    // Generate OTP (4 digits, valid for 10 minutes)
    const otpCode = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const doctor = await Doctor.create({
      name,
      email,
      passwordHash: await hashPassword(password),
      otpCode,
      otpExpires,
      otpAttempts: 0,
      emailVerified: false,
      isActive: false
    });

    // Send OTP email (async - don't wait)
    sendOtpEmail(email, otpCode, name)
      .then(result => {
        if (result.success) {
          console.log(`✅ OTP email sent to ${email}: ${otpCode}`);
        } else {
          console.error(`❌ Failed to send OTP email to ${email}:`, result.error);
        }
      })
      .catch(err => console.error('Email sending error:', err));

    const token = generateToken(doctor.id);
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.passwordHash;
    delete doctorResponse.otpCode;
    delete doctorResponse.otpExpires;
    delete doctorResponse.otpAttempts;

    // Build response
    const response = {
      success: true,
      message: 'Registration successful! Please check your email for OTP.',
      data: {
        doctor: doctorResponse,
        token,
        otpRequired: true,
        email: doctor.email,
        // Only include OTP in development
        ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
      }
    };

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

// Verify OTP (with timezone fix)
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and OTP'
      });
    }

    // Trim OTP whitespace
    const cleanOtp = otp.toString().trim();

    const doctor = await Doctor.findOne({ 
      where: { 
        email,
        otpCode: cleanOtp,
        // Use Sequelize.fn for timezone-safe comparison
        otpExpires: { 
          [Op.gt]: Sequelize.fn('UTC_TIMESTAMP') 
        }
      }
    });

    if (!doctor) {
      // Increment failed attempts
      await Doctor.increment('otpAttempts', { 
        where: { email } 
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Check OTP attempts limit (max 5)
    if (doctor.otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
        canResend: true
      });
    }

    // Verify email
    await doctor.update({
      emailVerified: true,
      otpCode: null,
      otpExpires: null,
      otpAttempts: 0
    });

    // Send welcome email (async)
    sendWelcomeEmail(doctor.email, doctor.name)
      .then(result => {
        if (result.success) {
          console.log(`✅ Welcome email sent to ${doctor.email}`);
        }
      })
      .catch(err => console.error('Welcome email error:', err));

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
      data: {
        doctor: {
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          emailVerified: true
        }
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Resend OTP
// Resend OTP - CORRECTED VERSION
exports.resendOtp = async (req, res) => {
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

    // Check resend limit (wait 60 seconds between requests)
    const otpExpires = doctor.otpExpires;
    const now = new Date();
    
    if (otpExpires) {
      // Since otpExpires is 10 minutes in the future, we can calculate when it was sent
      // OTP was sent at: otpExpires - 10 minutes
      const otpSentAt = new Date(otpExpires.getTime() - (10 * 60 * 1000));
      const sixtySecondsAgo = new Date(now.getTime() - (60 * 1000));
      
      // If OTP was sent less than 60 seconds ago
      if (otpSentAt > sixtySecondsAgo) {
        const secondsLeft = Math.ceil((otpSentAt - sixtySecondsAgo) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secondsLeft} seconds before requesting new OTP`
        });
      }
    }

    // Generate new OTP
    const otpCode = generateOtp();
    const otpExpiresNew = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await doctor.update({
      otpCode,
      otpExpires: otpExpiresNew,
      otpAttempts: 0
    });

    // Send new OTP (async)
    sendOtpEmail(email, otpCode, doctor.name)
      .then(result => {
        if (result.success) {
          console.log(`✅ OTP resent to ${email}: ${otpCode}`);
        } else {
          console.error(`❌ Failed to resend OTP to ${email}:`, result.error);
        }
      })
      .catch(err => console.error('Resend email error:', err));

    const response = {
      success: true,
      message: 'New OTP sent. Please check your email.',
      data: {
        email: doctor.email,
        // Only include OTP in development
        ...(process.env.NODE_ENV === 'development' && { otp: otpCode })
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      return res.status(403).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified via OTP
    if (!doctor.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email using OTP before logging in',
        requiresOtp: true,
        email: doctor.email,
        canResend: true
      });
    }

    // Check if account is active
    if (!doctor.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await comparePassword(password, doctor.passwordHash);
    if (!isPasswordValid) {
      return res.status(403).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await doctor.update({
      lastLogin: new Date()
    });

    // Generate token
    const token = generateToken(doctor.id);

    // Remove sensitive data from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.passwordHash;
    delete doctorResponse.otpCode;
    delete doctorResponse.otpExpires;
    delete doctorResponse.otpAttempts;
    delete doctorResponse.resetToken;
    delete doctorResponse.resetTokenExpires;

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

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
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
    await doctor.update({ 
      passwordHash: newPasswordHash,
      updatedAt: new Date()
    });

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
      attributes: { 
        exclude: [
          'passwordHash', 
          'otpCode', 
          'otpExpires', 
          'otpAttempts',
          'resetToken',
          'resetTokenExpires'
        ] 
      }
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
        message: 'If an account exists with this email, you will receive a password reset link within 5 minutes.'
      });
    }

    // Check if recently requested (prevent spam)
    const lastResetRequest = doctor.resetTokenExpires;
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    if (lastResetRequest && lastResetRequest > fiveMinutesAgo) {
      return res.status(429).json({
        success: false,
        message: 'Password reset already requested. Please check your email or wait 5 minutes.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await doctor.update({
      resetToken,
      resetTokenExpires
    });

    // Send password reset email (async)
    sendPasswordResetEmail(email, resetToken, doctor.name)
      .then(result => {
        if (result.success) {
          console.log(`✅ Password reset email sent to ${email}`);
        } else {
          console.error(`❌ Failed to send reset email to ${email}:`, result.error);
        }
      })
      .catch(err => console.error('Reset email error:', err));

    res.json({
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Reset password with token (with timezone fix)
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const doctor = await Doctor.findOne({
      where: {
        resetToken: token,
        // Use Sequelize.fn for timezone-safe comparison
        resetTokenExpires: { 
          [Op.gt]: Sequelize.fn('UTC_TIMESTAMP') 
        }
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
      resetTokenExpires: null,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Debug endpoint for timezone testing
exports.debugTime = async (req, res) => {
  try {
    const now = new Date();
    
    res.json({
      success: true,
      data: {
        serverTime: {
          local: now.toString(),
          iso: now.toISOString(),
          utc: now.toUTCString(),
          timestamp: now.getTime(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          indiaTime: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        },
        mysqlUTC: 'UTC_TIMESTAMP() function should be used for comparisons',
        suggestion: 'All date comparisons use UTC_TIMESTAMP() for timezone safety'
      }
    });
    
  } catch (error) {
    console.error('Debug time error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting time info'
    });
  }
};
//signup -> send verification otp on email
//verify otp -> verify with const { email, otp } = req.body;
// resend otp -> send otp on email in req.body
//