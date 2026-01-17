// src/models/index.js
'use strict';

const initDoctor = require('./Doctor');
const initPatientPhone = require('./PatientPhone');
const initDoctorPatient = require('./DoctorPatient');
const initDoctorPatientPhone = require('./DoctorPatientPhone');
const initVisit = require('./Visit');
const initReminder = require('./Reminder');

module.exports = (sequelize, DataTypes) => {
  const models = {
    Doctor: initDoctor(sequelize, DataTypes),
    PatientPhone: initPatientPhone(sequelize, DataTypes),
    DoctorPatient: initDoctorPatient(sequelize, DataTypes),
    DoctorPatientPhone: initDoctorPatientPhone(sequelize, DataTypes),
    Visit: initVisit(sequelize, DataTypes),
    Reminder: initReminder(sequelize, DataTypes)
  };

  const { 
    Doctor, 
    PatientPhone, 
    DoctorPatient, 
    DoctorPatientPhone, 
    Visit, 
    Reminder 
  } = models;

  // Define all associations
  // Doctor ↔ PatientPhone
  Doctor.hasMany(PatientPhone, { foreignKey: 'doctor_id' });
  PatientPhone.belongsTo(Doctor, { foreignKey: 'doctor_id' });

  // Doctor ↔ DoctorPatient
  Doctor.hasMany(DoctorPatient, { foreignKey: 'doctor_id' });
  DoctorPatient.belongsTo(Doctor, { foreignKey: 'doctor_id' });

  // DoctorPatient ↔ DoctorPatientPhone
  DoctorPatient.hasMany(DoctorPatientPhone, { foreignKey: 'doctor_patient_id' });
  DoctorPatientPhone.belongsTo(DoctorPatient, { foreignKey: 'doctor_patient_id' });

  // PatientPhone ↔ DoctorPatientPhone
  PatientPhone.hasMany(DoctorPatientPhone, { foreignKey: 'patient_phone_id' });
  DoctorPatientPhone.belongsTo(PatientPhone, { foreignKey: 'patient_phone_id' });

  // Doctor ↔ Visit
  Doctor.hasMany(Visit, { foreignKey: 'doctor_id' });
  Visit.belongsTo(Doctor, { foreignKey: 'doctor_id' });

  // DoctorPatient ↔ Visit
  DoctorPatient.hasMany(Visit, { foreignKey: 'doctor_patient_id' });
  Visit.belongsTo(DoctorPatient, { foreignKey: 'doctor_patient_id' });

  // Doctor ↔ Reminder
  Doctor.hasMany(Reminder, { foreignKey: 'doctor_id' });
  Reminder.belongsTo(Doctor, { foreignKey: 'doctor_id' });

  // DoctorPatient ↔ Reminder
  DoctorPatient.hasMany(Reminder, { foreignKey: 'doctor_patient_id' });
  Reminder.belongsTo(DoctorPatient, { foreignKey: 'doctor_patient_id' });

  // Visit ↔ Reminder (optional)
  Visit.hasMany(Reminder, { foreignKey: 'visit_id' });
  Reminder.belongsTo(Visit, { foreignKey: 'visit_id' });

  return models;
};