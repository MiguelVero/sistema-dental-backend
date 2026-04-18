const express = require('express');
const router = express.Router();
const tratamientoController = require('../controllers/tratamientoController');
const { validateTratamiento } = require('../middlewares/validators');

router.get('/', tratamientoController.obtenerTratamientos);
router.get('/:id', tratamientoController.obtenerTratamientoPorId);
router.post('/', validateTratamiento, tratamientoController.crearTratamiento);
router.put('/:id', validateTratamiento, tratamientoController.actualizarTratamiento);
router.delete('/:id', tratamientoController.eliminarTratamiento);

module.exports = router;