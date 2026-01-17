// src/models/Visit.js
'use strict';

module.exports = (sequelize, DataTypes) => {
  const Visit = sequelize.define('Visit', {
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
    visitDate: { 
      type: DataTypes.DATEONLY, 
      allowNull: false,
      field: 'visit_date'
    },
    nextVisitDate: { 
      type: DataTypes.DATEONLY,
      field: 'next_visit_date'
    },
    notes: { 
      type: DataTypes.TEXT 
    }
  }, {
    tableName: 'visits',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Visit;
};