// src/controllers/doctor/reminder.controller.js - SIMPLIFIED
const sequelize = require('../../config/db');
const { 
  DoctorPatient, 
  Visit,
  Reminder 
} = require('../../models')(sequelize, require('sequelize').DataTypes);

/**
 * Track WhatsApp reminder initiation
 * Phone number is provided in the request body
 */
exports.initiateWhatsAppReminder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const doctorId = req.doctorId;
    const { patientId, phoneNumber } = req.body;

    // Validate required fields
    if (!patientId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    if (!phoneNumber) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // 1. Verify patient exists and belongs to this doctor
    const patient = await DoctorPatient.findOne({
      where: { 
        id: patientId,
        doctorId: doctorId,
        isActive: true
      },
      transaction
    });

    if (!patient) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Patient not found or not authorized'
      });
    }

    // 2. Get latest visit for context (optional)
    const latestVisit = await Visit.findOne({
      where: {
        doctorPatientId: patient.id
      },
      order: [['visitDate', 'DESC']],
      transaction
    });

    // 3. Create reminder record in database
    const now = new Date();
    const reminder = await Reminder.create({
      doctorId: doctorId,
      doctorPatientId: patient.id,
      visitId: latestVisit ? latestVisit.id : null,
      channel: 'whatsapp',
      scheduledFor: now,
      sentAt: now,
      status: 'sent',
      recipientPhone: phoneNumber,
    }, { transaction });

    // 4. Update patient's reminder count and last reminder timestamp
    await DoctorPatient.update(
      {
        reminderCount: sequelize.literal('reminder_count + 1'),
        lastReminderSent: now
      },
      {
        where: { id: patient.id },
        transaction
      }
    );

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Reminder tracked successfully',
      data: {
        reminderId: reminder.id,
        patient: {
          id: patient.id,
          name: patient.name,
          newReminderCount: patient.reminderCount + 1,
          lastReminderSent: now
        }
      }
    });

  } catch (error) {
    // Check if transaction is still active before rolling back
    if (transaction && transaction.finished !== 'commit') {
      await transaction.rollback();
    }
    
    console.error('Initiate WhatsApp reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking reminder',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};