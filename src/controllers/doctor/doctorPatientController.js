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