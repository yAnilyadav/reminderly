// src/models/Reminder.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Reminder = sequelize.define('Reminder', {
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
    doctorPatientId: { 
      type: DataTypes.UUID, 
      allowNull: false,
      field: 'doctor_patient_id'
    },
    visitId: { 
      type: DataTypes.UUID,
      field: 'visit_id'
    },
    channel: { 
      type: DataTypes.ENUM('sms', 'whatsapp'),
      allowNull: false 
    },
    scheduledFor: { 
      type: DataTypes.DATE, 
      allowNull: false,
      field: 'scheduled_for'
    },
    sentAt: { 
      type: DataTypes.DATE,
      field: 'sent_at'
    },
    status: { 
      type: DataTypes.ENUM('pending', 'sent', 'failed'),
      defaultValue: 'pending'
    },
    failureReason: { 
      type: DataTypes.TEXT,
      field: 'failure_reason'
    },
    recipientPhone: { 
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Phone number the message was sent to',
      field: 'recipient_phone'
    },
  }, {
    tableName: 'reminders',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Reminder;
};