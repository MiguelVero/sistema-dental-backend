const { Paciente, Cita } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const obtenerPacientes = async (req, res) => {
  try {
    const pacientes = await Paciente.findAll({
      where: { activo: true },
      order: [['nombre', 'ASC']]
    });
    res.json(pacientes);
  } catch (error) {
    logger.error('Error obteniendo pacientes:', error);
    res.status(500).json({ error: 'Error al obtener pacientes' });
  }
};

const obtenerPacientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const paciente = await Paciente.findByPk(id, {
      include: [{
        model: Cita,
        as: 'citas',
        limit: 10,
        order: [['fecha', 'DESC']]
      }]
    });
    
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    
    res.json(paciente);
  } catch (error) {
    logger.error('Error obteniendo paciente:', error);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
};

const crearPaciente = async (req, res) => {
  try {
    const { nombre, telefono, email, direccion } = req.body;
    
    // Verificar si ya existe
    const existe = await Paciente.findOne({
      where: {
        [Op.or]: [
          { nombre: { [Op.like]: nombre } },
          { telefono: telefono }
        ],
        activo: true
      }
    });
    
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un paciente con ese nombre o teléfono' });
    }
    
    const paciente = await Paciente.create({
      nombre,
      telefono,
      email,
      direccion,
      activo: true
    });
    
    logger.info(`Paciente creado: ${paciente.nombre}`);
    res.status(201).json(paciente);
    
  } catch (error) {
    logger.error('Error creando paciente:', error);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
};

const actualizarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const paciente = await Paciente.findByPk(id);
    
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    
    await paciente.update(req.body);
    logger.info(`Paciente actualizado: ${paciente.nombre}`);
    res.json(paciente);
    
  } catch (error) {
    logger.error('Error actualizando paciente:', error);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
};

const eliminarPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    const paciente = await Paciente.findByPk(id);
    
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    
    // Verificar si tiene citas
    const citasCount = await Cita.count({ where: { paciente_id: id } });
    if (citasCount > 0) {
      return res.status(400).json({ 
        error: `No se puede eliminar el paciente porque tiene ${citasCount} citas asociadas` 
      });
    }
    
    await paciente.update({ activo: false });
    logger.info(`Paciente eliminado lógicamente: ${paciente.nombre}`);
    res.json({ mensaje: 'Paciente eliminado correctamente' });
    
  } catch (error) {
    logger.error('Error eliminando paciente:', error);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
};

module.exports = {
  obtenerPacientes,
  obtenerPacientePorId,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente
};