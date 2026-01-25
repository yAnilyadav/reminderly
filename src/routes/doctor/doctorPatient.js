const express = require('express');
const router = express.Router();
const doctorPatientController = require('../../controllers/doctor/doctorPatientController');
const authMiddleware = require('../../middlewares/auth.middleware');
// GET /api/patients - Get all patients with pagination and status
router.get('/',authMiddleware, doctorPatientController.getDoctorPatients);
router.get('/',authMiddleware, doctorPatientController.searchPatientsByPhone);

module.exports = router;