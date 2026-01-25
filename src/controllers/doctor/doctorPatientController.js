const { DoctorPatient, DoctorPatientPhone, PatientPhone, Visit, Reminder } = require('../../models')(require('../../config/db'), require('sequelize').DataTypes);
const { Op, Sequelize } = require('sequelize');

// GET /api/doctor/patients?status=overdue|due-soon|all
exports.getDoctorPatients = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const defaultFollowUpDays = 35;
    
    // Extract query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const statusFilter = req.query.status || 'all'; // 'overdue', 'due-soon', 'all'
    const search = req.query.search || '';
    
    const offset = (page - 1) * limit;
    
    // Base where clause
    const whereClause = { doctorId: doctorId };
    
    // Add search filter
    if (search) {
      whereClause.name = { [Op.iLike]: `%${search}%` };
    }
    
    // Get current date for calculations
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Add status-specific filters
    if (statusFilter === 'overdue') {
      // Patients whose last visit + 35 days has passed
      const overdueCutoffDate = new Date();
      overdueCutoffDate.setDate(overdueCutoffDate.getDate() - defaultFollowUpDays);
      
      whereClause.lastVisitDate = {
        [Op.not]: null,
        [Op.lt]: overdueCutoffDate
      };
    } 
    else if (statusFilter === 'due-soon') {
      // Patients whose last visit + 35 days is within next 7 days
      const dueSoonStart = new Date();
      dueSoonStart.setDate(dueSoonStart.getDate() - (defaultFollowUpDays - 7));
      
      const dueSoonEnd = new Date();
      dueSoonEnd.setDate(dueSoonEnd.getDate() - defaultFollowUpDays);
      
      whereClause.lastVisitDate = {
        [Op.not]: null,
        [Op.between]: [dueSoonEnd, dueSoonStart]
      };
    }
    
    // Get total count with filters
    const totalCount = await DoctorPatient.count({
      where: whereClause
    });
    
    // Get paginated results
    const doctorPatients = await DoctorPatient.findAll({
      where: whereClause,
      include: [
        {
          model: DoctorPatientPhone,
          required: false,
          include: [{ model: PatientPhone, required: false }]
        },
        {
          model: Visit,
          required: false,
          separate: true,
          order: [['visit_date', 'DESC']],
          limit: 1
        },
        {
          model: Reminder,
          required: false,
          separate: true,
          order: [['created_at', 'DESC']],
          limit: 1
        }
      ],
      order: statusFilter === 'overdue' 
        ? [['lastVisitDate', 'ASC']] // Oldest overdue first
        : [['name', 'ASC']], // Alphabetical otherwise
      limit,
      offset
    });
    
    // Process patients and calculate status
    const processedPatients = [];
    
    doctorPatients.forEach(dp => {
      const dpData = dp.toJSON();
      
      // Get phones
      const phones = [];
      if (dpData.DoctorPatientPhones && dpData.DoctorPatientPhones.length > 0) {
        dpData.DoctorPatientPhones.forEach(dpp => {
          if (dpp.PatientPhone) {
            phones.push({
              id: dpp.PatientPhone.id,
              phone: dpp.PatientPhone.phoneNumber,
              is_primary: dpp.PatientPhone.isPrimary || dpp.isPrimary
            });
          }
        });
      }
      
      // Get last visit
      const lastVisitDate = dpData.lastVisitDate || 
                           (dpData.Visits && dpData.Visits[0]?.visit_date) || 
                           null;
      
      // Calculate due date and status
      let dueDate = null;
      let status = 'no_visit';
      let daysOverdue = 0;
      let daysUntilDue = 0;
      
      if (lastVisitDate) {
        dueDate = new Date(lastVisitDate);
        dueDate.setDate(dueDate.getDate() + defaultFollowUpDays);
        
        if (today > dueDate) {
          status = 'overdue';
          daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        } else {
          daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
          if (daysUntilDue <= 7) {
            status = 'due_soon';
          } else {
            status = 'on_track';
          }
        }
      }
      
      // Get primary phone
      const primaryPhone = phones.find(p => p.is_primary) || phones[0];
      
      processedPatients.push({
        id: dpData.id,
        name: dpData.name,
        phone: primaryPhone ? primaryPhone.phone : null,
        phones: phones,
        last_visit: lastVisitDate,
        calculated_due_date: dueDate,
        status: status,
        daysOverdue: daysOverdue,
        daysUntilDue: daysUntilDue,
        notes: dpData.notes,
        created_at: dpData.created_at
      });
    });
    
    // Calculate stats for dashboard
    const stats = await calculateDashboardStats(doctorId, defaultFollowUpDays);
    
    // Build response
    res.json({
      success: true,
      data: {
        patients: processedPatients,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        stats: {
          ...stats,
          defaultFollowUpDays
        }
      },
      message: `Found ${processedPatients.length} patients`
    });
    
  } catch (error) {
    console.error('Get doctor patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper: Calculate dashboard statistics
const calculateDashboardStats = async (doctorId, defaultFollowUpDays) => {
  try {
    const today = new Date();
    const overdueCutoffDate = new Date();
    overdueCutoffDate.setDate(today.getDate() - defaultFollowUpDays);
    
    const dueSoonStart = new Date();
    dueSoonStart.setDate(dueSoonStart.getDate() - (defaultFollowUpDays - 7));
    const dueSoonEnd = new Date();
    dueSoonEnd.setDate(dueSoonEnd.getDate() - defaultFollowUpDays);
    
    // Count overdue patients
    const overdueCount = await DoctorPatient.count({
      where: {
        doctorId: doctorId,
        lastVisitDate: {
          [Op.not]: null,
          [Op.lt]: overdueCutoffDate
        }
      }
    });
    
    // Count due soon patients
    const dueSoonCount = await DoctorPatient.count({
      where: {
        doctorId: doctorId,
        lastVisitDate: {
          [Op.not]: null,
          [Op.between]: [dueSoonEnd, dueSoonStart]
        }
      }
    });
    
    // Count total patients
    const totalCount = await DoctorPatient.count({
      where: { doctorId: doctorId }
    });
    
    return {
      overdue: overdueCount,
      due_soon: dueSoonCount,
      total: totalCount,
      on_track: totalCount - overdueCount - dueSoonCount
    };
    
  } catch (error) {
    console.error('Error calculating stats:', error);
    return { overdue: 0, due_soon: 0, total: 0, on_track: 0 };
  }
};

exports.getPatientSimpleDetails = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const patientId = req.params.patientId;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required'
      });
    }

    // Find patient with phone numbers only
    const patient = await DoctorPatient.findOne({
      where: { 
        id: patientId,
        doctorId: doctorId,
        isActive: true
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['phoneNumber', 'isPrimary']
          }]
        }
      ],
      attributes: [
        'id', 'name', 'gender', 'age', 'address', 'notes',
        'lastVisitDate', 'nextScheduledVisit', 'reminderCount',
        'lastReminderSent', 'created_at'
      ]
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const patientData = patient.toJSON();

    // Get primary phone number
    let primaryPhone = '';
    let allPhones = [];
    
    if (patientData.DoctorPatientPhones && patientData.DoctorPatientPhones.length > 0) {
      patientData.DoctorPatientPhones.forEach(dpp => {
        if (dpp.PatientPhone) {
          const phoneInfo = {
            phoneNumber: dpp.PatientPhone.phoneNumber,
            isPrimary: dpp.PatientPhone.isPrimary || dpp.isPrimary
          };
          allPhones.push(phoneInfo);
          
          if (phoneInfo.isPrimary) {
            primaryPhone = phoneInfo.phoneNumber;
          }
        }
      });
      
      // If no primary found, use first phone
      if (!primaryPhone && allPhones.length > 0) {
        primaryPhone = allPhones[0].phoneNumber;
      }
    }

    const responseData = {
      id: patientData.id,
      name: patientData.name,
      gender: patientData.gender,
      age: patientData.age,
      address: patientData.address,
      notes: patientData.notes,
      phone: primaryPhone,
      phones: allPhones,
      lastVisitDate: patientData.lastVisitDate,
      nextScheduledVisit: patientData.nextScheduledVisit,
      reminderCount: patientData.reminderCount,
      lastReminderSent: patientData.lastReminderSent,
      createdAt: patientData.created_at
    };

    res.json({
      success: true,
      data: responseData,
      message: 'Patient details retrieved successfully'
    });

  } catch (error) {
    console.error('Get patient simple details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patient details'
    });
  }
};


exports.searchPatientsByPhone = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    const phoneQuery = req.query.phone;

    if (!phoneQuery || phoneQuery.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 3 characters to search'
      });
    }

    // Clean the phone query
    const cleanQuery = phoneQuery.replace(/\D/g, '');

    // Find phone records matching the query
    const phoneRecords = await PatientPhone.findAll({
      where: { 
        doctorId: doctorId,
        phoneNumber: {
          [Op.iLike]: `%${cleanQuery}%`
        }
      },
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: DoctorPatient,
            where: { 
              doctorId: doctorId,
              isActive: true
            },
            attributes: ['id', 'name', 'gender', 'age', 'lastVisitDate', 'nextScheduledVisit']
          }]
        }
      ],
      limit: 20
    });

    // Format results
    const results = phoneRecords
      .map(pr => pr.toJSON())
      .filter(pr => pr.DoctorPatientPhones && pr.DoctorPatientPhones.length > 0)
      .map(pr => {
        const patientLink = pr.DoctorPatientPhones[0];
        return {
          patient: patientLink.DoctorPatient,
          phone: {
            id: pr.id,
            phoneNumber: pr.phoneNumber,
            isPrimary: patientLink.isPrimary || pr.isPrimary
          },
          matchScore: pr.phoneNumber.includes(cleanQuery) ? 'exact' : 'partial'
        };
      })
      .filter(item => item.patient) // Remove any null patients
      .map(item => ({
        id: item.patient.id,
        name: item.patient.name,
        gender: item.patient.gender,
        age: item.patient.age,
        phone: item.phone.phoneNumber,
        isPrimaryPhone: item.phone.isPrimary,
        lastVisitDate: item.patient.lastVisitDate,
        nextScheduledVisit: item.patient.nextScheduledVisit,
        matchType: item.matchScore
      }));

    res.json({
      success: true,
      data: {
        results: results,
        count: results.length,
        query: phoneQuery
      },
      message: `Found ${results.length} patients matching phone query`
    });

  } catch (error) {
    console.error('Search patients by phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching patients by phone'
    });
  }
};