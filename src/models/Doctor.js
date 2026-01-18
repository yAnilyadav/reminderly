// src/models/Doctor.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Doctor = sequelize.define('Doctor', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: { 
      type: DataTypes.STRING, 
      allowNull: false,
      field: 'password_hash'
    },
    // NEW: Verification fields
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'email_verified'
    },
    otpCode: {
      type: DataTypes.STRING(6),
      field: 'otp_code',
      allowNull: true
    },
    otpExpires: {
      type: DataTypes.DATE,
      field: 'otp_expires',
      allowNull: true
    },
    otpAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'otp_attempts'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true, // Auto-activate for now
      field: 'is_active'
    },
    resetToken: {
      type: DataTypes.STRING,
      field: 'reset_token',
      allowNull: true
    },
    resetTokenExpires: {
      type: DataTypes.DATE,
      field: 'reset_token_expires',
      allowNull: true
    }
  }, {
    tableName: 'doctors',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Doctor;
};