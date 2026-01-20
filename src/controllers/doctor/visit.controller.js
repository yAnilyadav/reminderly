// src/controllers/doctor/visit.controller.js - FIXED VERSION
const sequelize = require('../../config/db');
const { 
  PatientPhone, 
  DoctorPatient, 
  DoctorPatientPhone, 
  Visit ,
  Reminder
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
        nextScheduledVisit: nextVisitDate || null ,
        reminderCount: 0, // RESET counter
        lastReminderSent: null // Clear last reminder
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
    const todayDate = new Date(); // Create Date object
    const todayString = todayDate.toISOString().split('T')[0]; // Get YYYY-MM-DD string

    // Solution 1: Use CURDATE() - Most reliable
    const patients = await DoctorPatient.findAll({
      where: { 
        doctorId: doctorId,
        isActive: true,
        nextScheduledVisit: {
          [Op.ne]: null,
          [Op.lt]: todayString  // Use MySQL's current date
        }
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['phoneNumber']
          }]
        }
      ],
      order: [['nextScheduledVisit', 'ASC']] // Most overdue first
    });
    console.log(patients,">>>>>")
    // For each patient, get latest diagnosis
    const patientsWithDetails = await Promise.all(
      patients.map(async (patient) => {
        // Get latest diagnosis (optional)
        const latestVisit = await Visit.findOne({
          where: {
            doctorPatientId: patient.id
          },
          order: [['visitDate', 'DESC']],
          attributes: ['diagnosis']
        });

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

        // Calculate days overdue - Use Date objects for calculation
        const nextVisitDate = new Date(patient.nextScheduledVisit);
        const daysOverdue = Math.floor(
          (todayDate - nextVisitDate) / (1000 * 60 * 60 * 24)
        );

        // Calculate reminder stats from DoctorPatient fields
        let daysSinceLastReminder = null;
        let hoursSinceLastReminder = null;
        let canSendReminder = true;
        let nextReminderTime = null;
        
        if (patient.lastReminderSent) {
          const lastReminderDate = new Date(patient.lastReminderSent);
          const timeDiff = todayDate - lastReminderDate;
          daysSinceLastReminder = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
          hoursSinceLastReminder = Math.floor(timeDiff / (1000 * 60 * 60));
          
          // Can send if last reminder was more than 24 hours ago
          canSendReminder = hoursSinceLastReminder >= 24;
          
          // Calculate when next reminder can be sent
          if (!canSendReminder) {
            const nextAllowedTime = new Date(lastReminderDate.getTime() + (24 * 60 * 60 * 1000));
            nextReminderTime = nextAllowedTime;
          }
        }

        // Create status messages
        let reminderStatus = '';
        let reminderButtonText = 'Send Reminder';
        let reminderButtonDisabled = !canSendReminder;
        let reminderTooltip = '';
        
        if (patient.reminderCount === 0) {
          reminderStatus = 'No reminders sent yet';
          reminderTooltip = 'Send first reminder to patient';
        } else {
          reminderStatus = `${patient.reminderCount} reminder${patient.reminderCount !== 1 ? 's' : ''} sent`;
          
          if (patient.lastReminderSent) {
            if (daysSinceLastReminder === 0) {
              reminderStatus += `, last one ${hoursSinceLastReminder} hour${hoursSinceLastReminder !== 1 ? 's' : ''} ago`;
            } else {
              reminderStatus += `, last one ${daysSinceLastReminder} day${daysSinceLastReminder !== 1 ? 's' : ''} ago`;
            }
          }
          
          if (!canSendReminder) {
            const hoursToWait = 24 - hoursSinceLastReminder;
            reminderButtonText = `Wait ${hoursToWait}h`;
            reminderTooltip = `Can send reminder in ${hoursToWait} hour${hoursToWait !== 1 ? 's' : ''}`;
          } else {
            reminderTooltip = `Send reminder #${patient.reminderCount + 1}`;
          }
        }

        return {
          // Patient Info
          patientId: patient.id,
          patientName: patient.name,
          phone: phone,
          age: patient.age,
          gender: patient.gender,
          
          // Visit Info
          diagnosis: latestVisit ? latestVisit.diagnosis : null,
          lastVisitDate: patient.lastVisitDate,
          expectedVisitDate: patient.nextScheduledVisit,
          daysOverdue: daysOverdue,
          
          // Reminder Stats (from DoctorPatient fields)
          reminderCount: patient.reminderCount,
          lastReminderSent: patient.lastReminderSent,
          daysSinceLastReminder: daysSinceLastReminder,
          hoursSinceLastReminder: hoursSinceLastReminder,
          
          // UI Controls
          canSendReminder: canSendReminder,
          nextReminderTime: nextReminderTime,
          
          // UI Display Strings
          reminderStatus: reminderStatus,
          reminderButtonText: reminderButtonText,
          reminderButtonDisabled: reminderButtonDisabled,
          reminderTooltip: reminderTooltip,
          
          // Urgency indicators
          isVeryOverdue: daysOverdue > 7,
          isModeratelyOverdue: daysOverdue > 3 && daysOverdue <= 7,
          isRecentlyOverdue: daysOverdue <= 3
        };
      })
    );

    // Calculate summary statistics
    const summary = {
      totalPatients: patientsWithDetails.length,
      totalRemindersSent: patientsWithDetails.reduce((sum, p) => sum + p.reminderCount, 0),
      patientsWithReminders: patientsWithDetails.filter(p => p.reminderCount > 0).length,
      patientsReadyForReminder: patientsWithDetails.filter(p => p.canSendReminder).length,
      veryOverdueCount: patientsWithDetails.filter(p => p.isVeryOverdue).length,
      moderatelyOverdueCount: patientsWithDetails.filter(p => p.isModeratelyOverdue).length,
      recentlyOverdueCount: patientsWithDetails.filter(p => p.isRecentlyOverdue).length,
      today: todayString  // Use string for display
    };

    res.json({
      success: true,
      data: {
        patients: patientsWithDetails,
        summary: summary
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

// Get today's expected visits (optional - for completeness)
exports.getTodayExpectedVisits = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const today = new Date().toISOString().split('T')[0];

    const patients = await DoctorPatient.findAll({
      where: { 
        doctorId: doctorId,
        isActive: true,
        nextScheduledVisit: today
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['phoneNumber']
          }]
        }
      ],
      order: [['name', 'ASC']]
    });

    const formattedPatients = patients.map(patient => {
      let phone = '';
      if (patient.DoctorPatientPhones && patient.DoctorPatientPhones.length > 0) {
        const primaryPhone = patient.DoctorPatientPhones.find(p => p.isPrimary);
        phone = primaryPhone ? primaryPhone.PatientPhone.phoneNumber : 
                 patient.DoctorPatientPhones[0].PatientPhone.phoneNumber;
      }

      return {
        patientId: patient.id,
        patientName: patient.name,
        phone: phone,
        lastVisitDate: patient.lastVisitDate,
        expectedVisitDate: patient.nextScheduledVisit,
        reminderCount: patient.reminderCount,
        lastReminderSent: patient.lastReminderSent,
        canSendReminder: true // Always true for today's appointments
      };
    });

    res.json({
      success: true,
      data: {
        patients: formattedPatients,
        total: patients.length,
        today: today
      }
    });

  } catch (error) {
    console.error('Get today expected visits error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s expected visits'
    });
  }
};