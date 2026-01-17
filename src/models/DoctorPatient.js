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