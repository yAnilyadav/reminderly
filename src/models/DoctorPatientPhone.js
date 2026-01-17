// src/models/DoctorPatientPhone.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const DoctorPatientPhone = sequelize.define('DoctorPatientPhone', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    doctorPatientId: { 
      type: DataTypes.UUID, 
      allowNull: false,
      field: 'doctor_patient_id'
    },
    patientPhoneId: { 
      type: DataTypes.UUID, 
      allowNull: false,
      field: 'patient_phone_id'
    },
    isPrimary: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: false,
      field: 'is_primary'
    }
  }, {
    tableName: 'doctor_patient_phones',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return DoctorPatientPhone;
};