const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.post('/recordatorio/:citaId', whatsappController.enviarRecordatorioManual);
router.post('/recordatorios-masivos', whatsappController.enviarRecordatorioMasivo);
router.get('/status', whatsappController.getWhatsAppStatus);

module.exports = router;