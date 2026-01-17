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
    }
  }, {
    tableName: 'doctors',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Associations defined in models/index.js
  return Doctor;
};