const Cita = require('../models/Cita');
const whatsappService = require('../services/whatsappBaileysService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const enviarRecordatorioManual = async (req, res) => {
  try {
    const { citaId } = req.params;
    
    const cita = await Cita.findByPk(citaId, {
      include: ['paciente', 'tratamiento']
    });
    
    if (!cita) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    const mensaje = generarMensajeRecordatorio(cita);
    
    const resultado = await whatsappService.enviarMensaje(
      cita.paciente.telefono,
      mensaje
    );
    
    res.json({ 
      success: true, 
      mensaje: 'Recordatorio enviado',
      resultado 
    });
    
  } catch (error) {
    logger.error('Error enviando recordatorio manual:', error);
    res.status(500).json({ error: error.message });
  }
};

const enviarRecordatorioMasivo = async (req, res) => {
  try {
    const { fecha } = req.body;
    const fechaBuscar = fecha || new Date().toISOString().split('T')[0];
    
    const citas = await Cita.findAll({
      where: {
        fecha: fechaBuscar,
        estado: ['pendiente', 'confirmada'],
        recordatorio_24h_enviado: false
      },
      include: ['paciente', 'tratamiento']
    });
    
    const resultados = [];
    for (const cita of citas) {
      try {
        const mensaje = generarMensajeRecordatorio(cita);
        await whatsappService.enviarMensaje(cita.paciente.telefono, mensaje);
        await cita.update({ recordatorio_24h_enviado: true });
        resultados.push({ id: cita.id, success: true });
      } catch (error) {
        resultados.push({ id: cita.id, success: false, error: error.message });
      }
      
      // Pequeña pausa para no saturar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    res.json({ 
      total: citas.length,
      enviados: resultados.filter(r => r.success).length,
      resultados 
    });
    
  } catch (error) {
    logger.error('Error enviando recordatorios masivos:', error);
    res.status(500).json({ error: error.message });
  }
};

const revisarYEnviarRecordatorios = async (io) => {
  try {
    const hoy = new Date();
    const mañana = new Date(hoy);
    mañana.setDate(mañana.getDate() + 1);
    const fechaMañana = mañana.toISOString().split('T')[0];
    
    // Recordatorios de 24 horas
    const citasMañana = await Cita.findAll({
      where: {
        fecha: fechaMañana,
        estado: 'pendiente',
        recordatorio_24h_enviado: false
      },
      include: ['paciente', 'tratamiento']
    });
    
    for (const cita of citasMañana) {
      const mensaje = generarMensaje24Horas(cita);
      await whatsappService.enviarMensaje(cita.paciente.telefono, mensaje);
      await cita.update({ recordatorio_24h_enviado: true });
      logger.info(`Recordatorio 24h enviado a ${cita.paciente.telefono}`);
    }
    
    // Recordatorios de 1 hora
    const ahora = new Date();
    const enUnaHora = new Date(ahora.getTime() + 60*60*1000);
    const horaActual = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}:00`;
    
    const citasProximas = await Cita.findAll({
      where: {
        fecha: hoy.toISOString().split('T')[0],
        hora: {
          [Op.between]: [horaActual, `${(enUnaHora.getHours()).toString().padStart(2, '0')}:59:59`]
        },
        estado: 'pendiente',
        recordatorio_1h_enviado: false
      },
      include: ['paciente', 'tratamiento']
    });
    
    for (const cita of citasProximas) {
      const mensaje = generarMensaje1Hora(cita);
      await whatsappService.enviarMensaje(cita.paciente.telefono, mensaje);
      await cita.update({ recordatorio_1h_enviado: true });
      logger.info(`Recordatorio 1h enviado a ${cita.paciente.telefono}`);
    }
    
    // Notificar via socket si hay novedades
    if (io && (citasMañana.length > 0 || citasProximas.length > 0)) {
      io.emit('recordatorios_enviados', {
        timestamp: new Date(),
        citas_24h: citasMañana.length,
        citas_1h: citasProximas.length
      });
    }
    
    return { citas_24h: citasMañana.length, citas_1h: citasProximas.length };
    
  } catch (error) {
    logger.error('Error en revisión automática:', error);
    throw error;
  }
};

const generarMensajeRecordatorio = (cita) => {
  // Usar variable de entorno para la URL base
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  const urlConfirmacion = `${baseUrl}/confirmar/${cita.token_confirmacion}`;
  
  return `🦷 *CLÍNICA DENTAL* 🦷

Hola ${cita.paciente.nombre}, te recordamos tu cita:

📅 *Fecha:* ${formatFecha(cita.fecha)}
⏰ *Hora:* ${formatHora(cita.hora)}
💊 *Tratamiento:* ${cita.tratamiento.nombre}

📍 *Dirección:* Av. Principal 123

🔗 *Para confirmar o cancelar tu cita, haz clic aquí:*
${urlConfirmacion}

¡Te esperamos! 😊`;
};

const generarMensaje24Horas = (cita) => {
  return `🦷 *RECORDATORIO CITA DENTAL* 🦷

Hola ${cita.paciente.nombre} 👋

Tu cita es MAÑANA ${formatFecha(cita.fecha)} a las ${formatHora(cita.hora)}.

✅ Responde *CONFIRMO* para confirmar
❌ Responde *CANCELO* para cancelar

¡Saludos! 🦷✨`;
};

const generarMensaje1Hora = (cita) => {
  return `⏰ *RECORDATORIO URGENTE* ⏰

${cita.paciente.nombre}, tu cita dental es en 1 HORA (${formatHora(cita.hora)}).

¡No faltes! Te esperamos. 🦷`;
};

const formatFecha = (fecha) => {
  const date = new Date(fecha);
  return date.toLocaleDateString('es-PE', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
};

const formatHora = (hora) => {
  return hora.substring(0, 5);
};

const getWhatsAppStatus = async (req, res) => {
  const estado = whatsappService.obtenerEstado();
  res.json(estado);
};

module.exports = {
  enviarRecordatorioManual,
  enviarRecordatorioMasivo,
  revisarYEnviarRecordatorios,
  getWhatsAppStatus
}