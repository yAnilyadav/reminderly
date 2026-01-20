// src/models/DoctorPatient.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const DoctorPatient = sequelize.define('DoctorPatient', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    doctorId: { 
      type: DataTypes.UUID, 
      allowNull: false,
      field: 'doctor_id'
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    notes: { 
      type: DataTypes.TEXT 
    },
    lastVisitDate: { 
        type: DataTypes.DATEONLY,
        field: 'last_visit_date'
    },
    
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active'
    },
    nextScheduledVisit: {  
      type: DataTypes.DATEONLY,
      field: 'next_scheduled_visit'
    },
    reminderCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'reminder_count'
    },
    
    lastReminderSent: {
      type: DataTypes.DATE,
      field: 'last_reminder_sent',
      allowNull: true
    }
  }, {
    tableName: 'doctor_patients',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return DoctorPatient;
};