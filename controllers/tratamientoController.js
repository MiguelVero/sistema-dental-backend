const { Tratamiento } = require('../models');
const logger = require('../utils/logger');

const obtenerTratamientos = async (req, res) => {
  try {
    const tratamientos = await Tratamiento.findAll({
      where: { activo: true },
      order: [['nombre', 'ASC']]
    });
    res.json(tratamientos);
  } catch (error) {
    logger.error('Error obteniendo tratamientos:', error);
    res.status(500).json({ error: 'Error al obtener tratamientos' });
  }
};

const obtenerTratamientoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const tratamiento = await Tratamiento.findByPk(id);
    
    if (!tratamiento) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    
    res.json(tratamiento);
  } catch (error) {
    logger.error('Error obteniendo tratamiento:', error);
    res.status(500).json({ error: 'Error al obtener tratamiento' });
  }
};

const crearTratamiento = async (req, res) => {
  try {
    const { nombre, descripcion, duracion_minutos, precio } = req.body;
    
    const existe = await Tratamiento.findOne({
      where: { nombre: { [Op.like]: nombre }, activo: true }
    });
    
    if (existe) {
      return res.status(400).json({ error: 'Ya existe un tratamiento con ese nombre' });
    }
    
    const tratamiento = await Tratamiento.create({
      nombre,
      descripcion,
      duracion_minutos,
      precio,
      activo: true
    });
    
    logger.info(`Tratamiento creado: ${tratamiento.nombre}`);
    res.status(201).json(tratamiento);
    
  } catch (error) {
    logger.error('Error creando tratamiento:', error);
    res.status(500).json({ error: 'Error al crear tratamiento' });
  }
};

const actualizarTratamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const tratamiento = await Tratamiento.findByPk(id);
    
    if (!tratamiento) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    
    await tratamiento.update(req.body);
    logger.info(`Tratamiento actualizado: ${tratamiento.nombre}`);
    res.json(tratamiento);
    
  } catch (error) {
    logger.error('Error actualizando tratamiento:', error);
    res.status(500).json({ error: 'Error al actualizar tratamiento' });
  }
};

const eliminarTratamiento = async (req, res) => {
  try {
    const { id } = req.params;
    const tratamiento = await Tratamiento.findByPk(id);
    
    if (!tratamiento) {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    
    await tratamiento.update({ activo: false });
    logger.info(`Tratamiento eliminado: ${tratamiento.nombre}`);
    res.json({ mensaje: 'Tratamiento eliminado correctamente' });
    
  } catch (error) {
    logger.error('Error eliminando tratamiento:', error);
    res.status(500).json({ error: 'Error al eliminar tratamiento' });
  }
};

module.exports = {
  obtenerTratamientos,
  obtenerTratamientoPorId,
  crearTratamiento,
  actualizarTratamiento,
  eliminarTratamiento
};