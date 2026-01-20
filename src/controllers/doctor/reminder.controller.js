// src/controllers/doctor/reminder.controller.js - SIMPLIFIED
const sequelize = require('../../config/db');
const { 
  PatientPhone, 
  DoctorPatient, 
  DoctorPatientPhone, 
  Visit,
  Reminder 
} = require('../../models')(sequelize, require('sequelize').DataTypes);
const { Op } = require('sequelize');


exports.sendReminder = async (req, res) => {
    const transaction = await sequelize.transaction();
    
    try {
      const doctorId = req.doctorId;
      const { patientId } = req.body;
  
      // 1. Get patient with transaction lock
      const patient = await DoctorPatient.findOne({
        where: {
          id: patientId,
          doctorId: doctorId,
          isActive: true,
          nextScheduledVisit: {
            [Op.ne]: null,
            [Op.lt]: new Date().toISOString().split('T')[0]
          }
        },
        lock: transaction.LOCK.UPDATE, // Lock row for update
        transaction
      });
  
      if (!patient) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Patient not found or does not have an overdue visit'
        });
      }
  
      // 2. Check 24-hour cooldown using lastReminderSent
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (patient.lastReminderSent && patient.lastReminderSent > twentyFourHoursAgo) {
        const hoursSince = Math.floor((new Date() - patient.lastReminderSent) / (1000 * 60 * 60));
        const hoursToWait = 24 - hoursSince;
        
        await transaction.rollback();
        return res.status(429).json({
          success: false,
          message: `Reminder sent ${hoursSince} hours ago. Please wait ${hoursToWait} more hours.`,
          lastReminderSent: patient.lastReminderSent
        });
      }
  
      // 3. Get phone number
      const phoneLink = await DoctorPatientPhone.findOne({
        where: { doctorPatientId: patientId, isPrimary: true },
        include: [{ model: PatientPhone, attributes: ['phoneNumber'] }],
        transaction
      });
  
      if (!phoneLink || !phoneLink.PatientPhone) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Patient has no phone number'
        });
      }
  
      const phoneNumber = phoneLink.PatientPhone.phoneNumber;
  
      // 4. Calculate days overdue
      const daysOverdue = Math.floor(
        (new Date() - new Date(patient.nextScheduledVisit)) / (1000 * 60 * 60 * 24)
      );
  
      // 5. Create reminder
      const reminder = await Reminder.create({
        doctorId: doctorId,
        doctorPatientId: patientId,
        channel: 'sms',
        scheduledFor: new Date(),
        status: 'pending'
      }, { transaction });
  
      // 6. Update patient's reminder count and last reminder timestamp
      await patient.update({
        reminderCount: patient.reminderCount + 1,
        lastReminderSent: new Date()
      }, { transaction });
  
      // 7. Send SMS (simulated)
      console.log(`📱 SENDING SMS to ${phoneNumber}`);
      
      await reminder.update({
        status: 'sent',
        sentAt: new Date()
      }, { transaction });
  
      await transaction.commit();
  
      res.json({
        success: true,
        message: 'Reminder sent successfully',
        data: {
          patient: {
            name: patient.name,
            nextScheduledVisit: patient.nextScheduledVisit,
            daysOverdue: daysOverdue,
            reminderCount: patient.reminderCount + 1, // Updated count
            lastReminderSent: new Date()
          }
        }
      });
  
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      console.error('Send reminder error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending reminder'
      });
    }
  };