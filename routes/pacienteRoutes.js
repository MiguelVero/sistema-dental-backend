const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/pacienteController');
const { validatePaciente } = require('../middlewares/validators');

router.get('/', pacienteController.obtenerPacientes);
router.get('/:id', pacienteController.obtenerPacientePorId);
router.post('/', validatePaciente, pacienteController.crearPaciente);
router.put('/:id', validatePaciente, pacienteController.actualizarPaciente);
router.delete('/:id', pacienteController.eliminarPaciente);

module.exports = router;