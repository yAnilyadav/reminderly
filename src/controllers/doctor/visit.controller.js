// src/controllers/doctor/visit.controller.js - FIXED VERSION
const sequelize = require('../../config/db');
const { 
  PatientPhone, 
  DoctorPatient, 
  DoctorPatientPhone, 
  Visit 
} = require('../../models')(sequelize, require('sequelize').DataTypes);

// Create visit and update last_visit_date
exports.createVisit = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const doctorId = req.doctorId;
    const { patientName, patientPhone, visitDate, notes, nextVisitDate } = req.body;

    // Validate required fields
    if (!patientName || !patientPhone) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Patient name and phone are required'
      });
    }

    // Use today's date if visitDate not provided
    const actualVisitDate = visitDate || new Date().toISOString().split('T')[0];

    // 1. Find or create phone FOR THIS SPECIFIC DOCTOR
    const [phone] = await PatientPhone.findOrCreate({
      where: { 
        doctorId: doctorId,
        phoneNumber: patientPhone.trim()
      },
      defaults: { 
        isPrimary: true 
      },
      transaction
    });

    // 2. Find or create patient - check for exact name + phone combination FOR THIS DOCTOR
    let doctorPatient;

    // Check if this exact phone + name combination already exists FOR THIS DOCTOR
    const existingPatientLink = await DoctorPatientPhone.findOne({
      where: {
        patientPhoneId: phone.id
      },
      include: [{
        model: DoctorPatient,
        where: { 
          doctorId: doctorId,
          name: patientName.trim()
        }
      }],
      transaction
    });

    if (existingPatientLink && existingPatientLink.DoctorPatient) {
      // Found exact match: same doctor + same name + same phone
      doctorPatient = existingPatientLink.DoctorPatient;
    } else {
      // No exact match - create new patient FOR THIS DOCTOR
      [doctorPatient] = await DoctorPatient.findOrCreate({
        where: { 
          doctorId: doctorId,
          name: patientName.trim()
        },
        defaults: {
          notes: req.body.patientNotes || null,
          lastVisitDate: actualVisitDate,
          ...(req.body.age && { age: req.body.age }),
          ...(req.body.gender && { gender: req.body.gender })
        },
        transaction
      });
    }

    // 3. Link this patient to this phone FOR THIS DOCTOR
    await DoctorPatientPhone.findOrCreate({
      where: {
        doctorPatientId: doctorPatient.id,
        patientPhoneId: phone.id
      },
      defaults: { 
        isPrimary: true 
      },
      transaction
    });

    // 4. Create visit FOR THIS DOCTOR
    const visit = await Visit.create({
      doctorId: doctorId,
      doctorPatientId: doctorPatient.id,
      visitDate: actualVisitDate,
      nextVisitDate: nextVisitDate || null,
      notes: notes || null
    }, { transaction });

    // 5. UPDATE last_visit_date on DoctorPatient
    await DoctorPatient.update(
      { lastVisitDate: actualVisitDate },
      {
        where: { id: doctorPatient.id },
        transaction
      }
    );

    await transaction.commit();

    // Simple response without extra query
    res.status(201).json({
      success: true,
      message: 'Visit created successfully',
      data: { 
        visit: {
          id: visit.id,
          doctorId: visit.doctorId,
          doctorPatientId: visit.doctorPatientId,
          visitDate: visit.visitDate,
          nextVisitDate: visit.nextVisitDate,
          notes: visit.notes
        },
        patient: {
          id: doctorPatient.id,
          name: doctorPatient.name,
          age: doctorPatient.age,
          gender: doctorPatient.gender,
          lastVisitDate: doctorPatient.lastVisitDate
        }
      }
    });

  } catch (error) {
    // Check if transaction is still active before rolling back
    if (transaction && transaction.finished !== 'commit') {
      await transaction.rollback();
    }
    
    console.error('Create visit error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating visit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};