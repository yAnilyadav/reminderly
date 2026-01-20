// src/controllers/doctor/visit.controller.js - FIXED VERSION
const sequelize = require('../../config/db');
const { 
  PatientPhone, 
  DoctorPatient, 
  DoctorPatientPhone, 
  Visit 
} = require('../../models')(sequelize, require('sequelize').DataTypes);
const { Op } = require('sequelize');

// Create visit and update last_visit_date
exports.createVisit = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const doctorId = req.doctorId;
    const { patientName, patientPhone, visitDate, notes, nextVisitDate, diagnosis } = req.body;

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
          ...(req.body.address && { address: req.body.address }),
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
      notes: notes || null,
      diagnosis: diagnosis
    }, { transaction });

    // 5. UPDATE last_visit_date on DoctorPatient
    await DoctorPatient.update(
      { lastVisitDate: actualVisitDate,
        nextScheduledVisit: nextVisitDate || null 
      },
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


exports.getOverduePatients = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const today = new Date().toISOString().split('T')[0];

    // Get overdue patients with their latest visit for diagnosis
    const overduePatients = await DoctorPatient.findAll({
      where: { 
        doctorId: doctorId,
        isActive: true,
        nextScheduledVisit: {
          [Op.ne]: null,
          [Op.lt]: today  // Overdue
        }
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['phoneNumber']
          }]
        },
        {
          model: Visit,
          as: 'Visits',
          separate: true,
          order: [['visitDate', 'DESC']],
          limit: 1,  // Get only latest visit for diagnosis
          attributes: ['diagnosis']  // Only need diagnosis
        }
      ],
      order: [['nextScheduledVisit', 'ASC']]  // Most overdue first
    });

    // Format response
    const formattedPatients = overduePatients.map(patient => {
      // Get phone number
      let phone = '';
      if (patient.DoctorPatientPhones && patient.DoctorPatientPhones.length > 0) {
        const primaryPhone = patient.DoctorPatientPhones.find(p => p.isPrimary);
        if (primaryPhone && primaryPhone.PatientPhone) {
          phone = primaryPhone.PatientPhone.phoneNumber;
        } else {
          phone = patient.DoctorPatientPhones[0].PatientPhone.phoneNumber;
        }
      }

      // Get diagnosis from latest visit
      const diagnosis = patient.Visits && patient.Visits[0] 
        ? patient.Visits[0].diagnosis 
        : null;

      // Calculate days overdue
      const daysOverdue = Math.floor(
        (new Date(today) - new Date(patient.nextScheduledVisit)) / (1000 * 60 * 60 * 24)
      );

      return {
        patientId: patient.id,
        patientName: patient.name,
        phone: phone,
        diagnosis: diagnosis,
        lastVisitDate: patient.lastVisitDate,
        expectedVisitDate: patient.nextScheduledVisit,
        daysOverdue: daysOverdue,
        canSendReminder: true
      };
    });

    res.json({
      success: true,
      data: {
        patients: formattedPatients,
        total: formattedPatients.length,
        today: today
      }
    });

  } catch (error) {
    console.error('Get overdue patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching overdue patients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




// Get patients with expected visits for today
exports.getTodayExpectedVisits = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const today = new Date().toISOString().split('T')[0];

    // Get patients with nextScheduledVisit = today
    const todayPatients = await DoctorPatient.findAll({
      where: { 
        doctorId: doctorId,
        isActive: true,
        nextScheduledVisit: today  // Exactly today
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['phoneNumber']
          }]
        },
        {
          model: Visit,
          as: 'Visits',
          separate: true,
          order: [['visitDate', 'DESC']],
          limit: 1, // Get latest visit for diagnosis
          attributes: ['diagnosis']
        }
      ],
      order: [
        ['name', 'ASC'] // Sort by patient name
      ]
    });

    // Format response
    const formattedPatients = todayPatients.map(patient => {
      // Get phone number
      let phone = '';
      if (patient.DoctorPatientPhones && patient.DoctorPatientPhones.length > 0) {
        const primaryPhone = patient.DoctorPatientPhones.find(p => p.isPrimary);
        if (primaryPhone && primaryPhone.PatientPhone) {
          phone = primaryPhone.PatientPhone.phoneNumber;
        } else {
          phone = patient.DoctorPatientPhones[0].PatientPhone.phoneNumber;
        }
      }

      // Get diagnosis from latest visit
      const diagnosis = patient.Visits && patient.Visits[0] 
        ? patient.Visits[0].diagnosis 
        : null;

      return {
        patientId: patient.id,
        patientName: patient.name,
        phone: phone,
        diagnosis: diagnosis,
        lastVisitDate: patient.lastVisitDate,
        expectedVisitDate: patient.nextScheduledVisit, // Will be today
        canSendReminder: true // Can send reminder for today's appointment
      };
    });

    res.json({
      success: true,
      data: {
        patients: formattedPatients,
        total: todayPatients.length,
        today: today
      }
    });

  } catch (error) {
    console.error('Get today expected visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s expected visits',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};