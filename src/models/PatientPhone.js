// src/models/PatientPhone.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const PatientPhone = sequelize.define('PatientPhone', {
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
    phoneNumber: { 
      type: DataTypes.STRING(20), 
      allowNull: false,
      field: 'phone_number',
      validate: {
        notEmpty: true
      }
    },
    isPrimary: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      field: 'is_primary'
    }
  }, {
    tableName: 'patient_phones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return PatientPhone;
};