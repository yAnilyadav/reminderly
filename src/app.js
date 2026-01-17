'use strict';

require('dotenv').config();
const express = require('express');
const sequelize = require('./config/db');

// Initialize models
const { DataTypes } = require('sequelize');
const initModels = require('./models');
const models = initModels(sequelize, DataTypes);

const app = express();
app.use(express.json());

// Import routes
const doctorOnboardingRoutes = require('./routes/doctor/onboarding');
const doctorVisitRoutes = require('./routes/doctor/visit');
const doctorPatientRoutes = require('./routes/doctor/doctorPatient');

// Routes
app.use('/api/doctors', doctorOnboardingRoutes);
app.use('/api/visits',doctorVisitRoutes)
app.use('/api/doctorPatients',doctorPatientRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Clinic Management API',
    status: 'running',
    database: 'MySQL',
    version: '1.0.0'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ MySQL connection established successfully.');
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📁 Database: ${process.env.DB_NAME || 'clinic'}`);
      console.log(`👤 Environment: ${process.env.NODE_ENV}`);
    });
    
  } catch (error) {
    console.error('❌ Unable to start server:', error.message);
    process.exit(1);
  }
};

startServer();