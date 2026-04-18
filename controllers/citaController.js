const crypto = require('crypto');
const Cita = require('../models/Cita');
const Paciente = require('../models/Paciente');
const Tratamiento = require('../models/Tratamiento');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Función para generar token único
const generarToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const crearCita = async (req, res) => {
  try {
    console.log('📥 Body recibido:', JSON.stringify(req.body, null, 2));
    
    const { paciente_id, tratamiento_id, fecha, hora, notas } = req.body;

    // Validaciones básicas
    if (!paciente_id || !tratamiento_id || !fecha || !hora) {
      console.log('❌ Campos faltantes:', { paciente_id, tratamiento_id, fecha, hora });
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: paciente_id, tratamiento_id, fecha, hora' 
      });
    }

    // Verificar formato de hora
    let horaFormateada = hora;
    if (horaFormateada && horaFormateada.split(':').length === 2) {
      horaFormateada = `${horaFormateada}:00`;
    }

    // Generar token de confirmación (válido por 7 días)
    const tokenConfirmacion = generarToken();
    const tokenExpira = new Date();
    tokenExpira.setDate(tokenExpira.getDate() + 7);

    const cita = await Cita.create({
      paciente_id: parseInt(paciente_id),
      tratamiento_id: parseInt(tratamiento_id),
      fecha,
      hora: horaFormateada,
      notas,
      estado: 'pendiente',
      token_confirmacion: tokenConfirmacion,
      token_expira: tokenExpira
    });

    const citaCompleta = await Cita.findByPk(cita.id, {
      include: ['paciente', 'tratamiento']
    });

    logger.info(`Cita creada: ID ${cita.id} para paciente ${paciente_id}`);
    logger.info(`Token de confirmación: ${tokenConfirmacion}`);

    res.status(201).json({
      mensaje: 'Cita agendada exitosamente',
      cita: citaCompleta
    });

  } catch (error) {
    console.error('❌ Error detallado:', error);
    logger.error('Error creando cita:', error);
    res.status(500).json({ error: error.message });
  }
};

const obtenerCitas = async (req, res) => {
  try {
    const { fecha, estado, paciente_id } = req.query;
    const where = {};

    if (fecha) where.fecha = fecha;
    if (estado) where.estado = estado;
    if (paciente_id) where.paciente_id = paciente_id;

    const citas = await Cita.findAll({
      where,
      include: ['paciente', 'tratamiento'],
      order: [['fecha', 'ASC'], ['hora', 'ASC']]
    });

    res.json(citas);
  } catch (error) {
    logger.error('Error obteniendo citas:', error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

const obtenerCitasHoy = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    
    const citas = await Cita.findAll({
      where: {
        fecha: hoy,
        estado: ['pendiente', 'confirmada']
      },
      include: ['paciente', 'tratamiento'],
      order: [['hora', 'ASC']]
    });

    res.json(citas);
  } catch (error) {
    logger.error('Error obteniendo citas de hoy:', error);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
};

const actualizarEstadoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const cita = await Cita.findByPk(id);
    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    await cita.update({ estado });

    if (req.io) {
      req.io.emit('cita_actualizada', { id, estado });
    }

    res.json({ mensaje: 'Estado actualizado', cita });
  } catch (error) {
    logger.error('Error actualizando estado:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  crearCita,
  obtenerCitas,
  obtenerCitasHoy,
  actualizarEstadoCita
};