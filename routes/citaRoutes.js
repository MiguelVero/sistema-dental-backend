const express = require('express');
const router = express.Router();
const citaController = require('../controllers/citaController');
// const { validateCita } = require('../middlewares/validators'); // COMENTADO TEMPORALMENTE

// router.post('/', validateCita, citaController.crearCita);
router.post('/', citaController.crearCita); // SIN VALIDACIÓN
router.get('/', citaController.obtenerCitas);
router.get('/hoy', citaController.obtenerCitasHoy);
router.patch('/:id/estado', citaController.actualizarEstadoCita);

module.exports = router;