const { DoctorPatient, DoctorPatientPhone, PatientPhone, Visit, Reminder } = require('../../models')(require('../../config/db'), require('sequelize').DataTypes);
const { Op, Sequelize } = require('sequelize');

// GET /api/doctor/patients?search=query&page=1&limit=20
exports.getDoctorPatients = async (req, res) => {
  try {
    const doctorId = req.doctorId;
    
    // Extract query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;
    
    // Base conditions that always apply
    const baseConditions = {
      doctorId: doctorId,
      isActive: true
    };
    
    // Initialize search conditions array
    let searchConditions = [];
    let phoneSearchPatientIds = [];
    
    // Handle search if provided
    if (search && search.trim() !== '') {
      // Always search by name
      searchConditions.push({
        name: { [Op.like]: `%${search}%` }
      });
      
      // Check if search contains digits (could be a phone number)
      const cleanSearch = search.replace(/\D/g, '');
      if (cleanSearch.length >= 3) {
        try {
          // Find patient phones matching the search
          const phoneRecords = await PatientPhone.findAll({
            where: {
              doctorId: doctorId,
              phoneNumber: { [Op.like]: `%${cleanSearch}%` }
            },
            include: [{
              model: DoctorPatientPhone,
              attributes: ['doctorPatientId']
            }],
            raw: true
          });
          
          // Extract unique patient IDs from phone matches
          phoneSearchPatientIds = [
            ...new Set(
              phoneRecords
                .filter(record => record['DoctorPatientPhones.doctorPatientId'])
                .map(record => record['DoctorPatientPhones.doctorPatientId'])
            )
          ];
          
          // If we found patients by phone, add to search conditions
          if (phoneSearchPatientIds.length > 0) {
            searchConditions.push({
              id: { [Op.in]: phoneSearchPatientIds }
            });
          }
        } catch (phoneSearchError) {
          console.warn('Phone search error:', phoneSearchError);
          // Continue without phone search if it fails
        }
      }
    }
    
    // Build the final WHERE clause
    let whereClause;
    
    if (searchConditions.length > 0) {
      // We have search conditions - combine with base conditions
      whereClause = {
        [Op.and]: [
          baseConditions,
          { [Op.or]: searchConditions }
        ]
      };
    } else {
      // No search - just use base conditions
      whereClause = baseConditions;
    }
    
    // Get total count
    const totalCount = await DoctorPatient.count({
      where: whereClause
    });
    
    // Get paginated results with all necessary data
    const doctorPatients = await DoctorPatient.findAll({
      where: whereClause,
      include: [
        {
          model: DoctorPatientPhone,
          include: [{
            model: PatientPhone,
            attributes: ['id', 'phoneNumber', 'isPrimary']
          }]
        },
        {
          model: Visit,
          separate: true,
          order: [['visitDate', 'DESC']],
          limit: 1, // Get only the latest visit
          attributes: ['id', 'visitDate', 'diagnosis', 'nextVisitDate', 'notes']
        }
      ],
      order: [['created_at', 'DESC']], // Newest patients first
      limit,
      offset
    });
    
    // Process and format the response
    const patients = await Promise.all(
      doctorPatients.map(async (dp) => {
        const patientData = dp.toJSON();
        
        // Get all phone numbers
        const phones = [];
        let primaryPhone = '';
        
        if (patientData.DoctorPatientPhones && patientData.DoctorPatientPhones.length > 0) {
          patientData.DoctorPatientPhones.forEach(dpp => {
            if (dpp.PatientPhone) {
              const phoneInfo = {
                id: dpp.PatientPhone.id,
                phoneNumber: dpp.PatientPhone.phoneNumber,
                isPrimary: dpp.PatientPhone.isPrimary || dpp.isPrimary
              };
              phones.push(phoneInfo);
              
              if (phoneInfo.isPrimary) {
                primaryPhone = phoneInfo.phoneNumber;
              }
            }
          });
          
          // If no primary found, use first phone
          if (!primaryPhone && phones.length > 0) {
            primaryPhone = phones[0].phoneNumber;
          }
        }
        
        // Get latest visit info
        const latestVisit = patientData.Visits && patientData.Visits.length > 0 
          ? patientData.Visits[0] 
          : null;
        
        // Get all reminders count for this patient
        const totalRemindersCount = await Reminder.count({
          where: {
            doctorPatientId: patientData.id
          }
        });
        
        // Calculate patient status based on visits
        let status = 'no_visit';
        let nextVisitDate = patientData.nextScheduledVisit;
        let lastVisitDate = patientData.lastVisitDate || (latestVisit ? latestVisit.visitDate : null);
        
        // Use latest visit's nextVisitDate if available
        if (latestVisit && latestVisit.nextVisitDate) {
          nextVisitDate = latestVisit.nextVisitDate;
        }
        
        // Determine status
        const today = new Date();
        if (nextVisitDate) {
          const nextVisit = new Date(nextVisitDate);
          const timeDiff = nextVisit - today;
          const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          
          if (daysDiff < 0) {
            status = 'overdue';
          } else if (daysDiff <= 7) {
            status = 'upcoming_soon';
          } else {
            status = 'upcoming';
          }
        } else if (lastVisitDate) {
          status = 'follow_up_needed';
        }
        
        // Check if patient was found by phone search
        const foundByPhoneSearch = phoneSearchPatientIds.includes(patientData.id);
        
        // Format the response
        return {
          id: patientData.id,
          name: patientData.name,
          gender: patientData.gender,
          age: patientData.age,
          address: patientData.address,
          
          // Contact info
          phone: primaryPhone,
          phones: phones,
          
          // Medical info
          diagnosis: latestVisit ? latestVisit.diagnosis : null,
          lastVisitDate: lastVisitDate,
          nextVisitDate: nextVisitDate,
          lastVisitNotes: latestVisit ? latestVisit.notes : null,
          
          // Patient notes
          notes: patientData.notes,
          
          // Status and tracking
          status: status,
          reminderCount: totalRemindersCount, // Use actual count from Reminder table
          lastReminderSent: patientData.lastReminderSent,
          isActive: patientData.isActive,
          
          // Search metadata
          foundByPhoneSearch: foundByPhoneSearch,
          
          // Timestamps
          createdAt: patientData.created_at,
          updatedAt: patientData.updated_at
        };
      })
    );
    
    // Calculate statistics
    const stats = {
      total: totalCount,
      currentPageCount: patients.length,
      overdueCount: patients.filter(p => p.status === 'overdue').length,
      upcomingSoonCount: patients.filter(p => p.status === 'upcoming_soon').length,
      upcomingCount: patients.filter(p => p.status === 'upcoming').length,
      noVisitCount: patients.filter(p => p.status === 'no_visit').length,
      followUpNeededCount: patients.filter(p => p.status === 'follow_up_needed').length
    };
    
    // Calculate search statistics
    const searchStats = {
      nameMatches: patients.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase())
      ).length,
      phoneMatches: patients.filter(p => p.foundByPhoneSearch).length
    };
    
    // Build response
    res.json({
      success: true,
      data: {
        patients: patients,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1
        },
        stats: stats,
        search: {
          query: search || null,
          stats: searchStats,
          totalMatches: patients.length
        }
      },
      message: search 
        ? `Found ${patients.length} patients matching "${search}"` 
        : `Found ${patients.length} patients`
    });
    
  } catch (error) {
    console.error('Get doctor patients error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching patients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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