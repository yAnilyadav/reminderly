// src/controllers/doctor/onboarding.controller.js
const { Doctor } = require('../../models')(require('../../config/db'), require('sequelize').DataTypes);
const { hashPassword, comparePassword } = require('../../utils/bcrypt');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (doctorId) => {
  return jwt.sign({ id: doctorId }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

// Signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    // Check if doctor already exists
    const existingDoctor = await Doctor.findOne({ where: { email } });
    if (existingDoctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create doctor
    const doctor = await Doctor.create({
      name,
      email,
      passwordHash
    });

    // Generate token
    const token = generateToken(doctor.id);

    // Remove password hash from response
    const doctorResponse = doctor.toJSON();
    delete doctorResponse.passwordHash;

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully',
      data: {
        doctor: doctorResponse,
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering doctor',
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
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
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