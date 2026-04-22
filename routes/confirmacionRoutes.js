const express = require('express');
const router = express.Router();
const { Cita, Paciente, Tratamiento } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Página de confirmación (GET)
router.get('/confirmar/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const cita = await Cita.findOne({
      where: {
        token_confirmacion: token,
        token_expira: { [Op.gt]: new Date() },
        estado: 'pendiente'
      },
      include: ['paciente', 'tratamiento']
    });
    
    if (!cita) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Enlace inválido</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>⚠️ Enlace inválido o expirado</h1>
          <p>Por favor contacta la clínica.</p>
        </body>
        </html>
      `);
    }
    
    const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-PE');
    const apiUrl = process.env.API_URL || `https://${req.get('host')}`;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Confirmar cita</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
          .card { background: white; max-width: 500px; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
          button { padding: 12px 25px; margin: 10px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
          .btn-yes { background: #10b981; color: white; }
          .btn-no { background: #ef4444; color: white; }
          .info { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0; }
          .mensaje { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; }
          .success { background: #d1fae5; color: #065f46; }
          .error { background: #fee2e2; color: #991b1b; }
        </style>
      </head>
      <body>
        <div class="card" id="app">
          <h1>🦷 Clínica Dental</h1>
          <div class="info">
            <p><strong>Paciente:</strong> ${cita.paciente.nombre}</p>
            <p><strong>Fecha:</strong> ${fechaFormateada}</p>
            <p><strong>Hora:</strong> ${cita.hora.substring(0,5)}</p>
            <p><strong>Tratamiento:</strong> ${cita.tratamiento.nombre}</p>
          </div>
          <button class="btn-yes" id="btnConfirmar">✅ Sí, asistiré</button>
          <button class="btn-no" id="btnCancelar">❌ Cancelar cita</button>
          <div id="mensaje" class="mensaje"></div>
        </div>
        
        <script>
          const TOKEN = '${token}';
          const API_URL = '${apiUrl}';
          
          console.log('API_URL:', API_URL);
          console.log('TOKEN:', TOKEN);
          
          document.getElementById('btnConfirmar').addEventListener('click', async function() {
            const btn = this;
            btn.disabled = true;
            btn.textContent = 'Procesando...';
            
            try {
              console.log('Confirmando cita...');
              const response = await fetch(API_URL + '/api/confirmacion/' + TOKEN + '/confirmar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              const result = await response.json();
              console.log('Respuesta:', result);
              
              if (result.success) {
                document.getElementById('app').innerHTML = '<div style="text-align:center"><h1 style="color:#10b981;">🎉 ¡Gracias por tu confirmación!</h1><p>Tu cita ha sido confirmada.</p></div>';
              } else {
                mostrarMensaje('Error al confirmar la cita: ' + (result.message || 'Desconocido'), 'error');
                btn.disabled = false;
                btn.textContent = '✅ Sí, asistiré';
              }
            } catch (error) {
              console.error('Error:', error);
              mostrarMensaje('Error de conexión: ' + error.message, 'error');
              btn.disabled = false;
              btn.textContent = '✅ Sí, asistiré';
            }
          });
          
          document.getElementById('btnCancelar').addEventListener('click', async function() {
            const btn = this;
            btn.disabled = true;
            btn.textContent = 'Procesando...';
            
            try {
              console.log('Cancelando cita...');
              const response = await fetch(API_URL + '/api/confirmacion/' + TOKEN + '/cancelar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              });
              const result = await response.json();
              console.log('Respuesta:', result);
              
              if (result.success) {
                document.getElementById('app').innerHTML = '<div style="text-align:center"><h1 style="color:#ef4444;">❌ Cita cancelada</h1><p>Tu cita ha sido cancelada.</p></div>';
              } else {
                mostrarMensaje('Error al cancelar la cita', 'error');
                btn.disabled = false;
                btn.textContent = '❌ Cancelar cita';
              }
            } catch (error) {
              console.error('Error:', error);
              mostrarMensaje('Error de conexión: ' + error.message, 'error');
              btn.disabled = false;
              btn.textContent = '❌ Cancelar cita';
            }
          });
          
          function mostrarMensaje(texto, tipo) {
            const msgDiv = document.getElementById('mensaje');
            msgDiv.textContent = texto;
            msgDiv.className = 'mensaje ' + tipo;
            msgDiv.style.display = 'block';
            setTimeout(() => {
              msgDiv.style.display = 'none';
            }, 5000);
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error interno');
  }
});


// API para confirmar cita (POST)
router.post('/api/confirmacion/:token/confirmar', async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`🔍 ========== CONFIRMANDO CITA ==========`);
    console.log(`🔍 Token recibido: ${token}`);
    console.log(`🔍 Headers:`, req.headers);
    
    const cita = await Cita.findOne({
      where: {
        token_confirmacion: token,
        token_expira: { [Op.gt]: new Date() },
        estado: 'pendiente'
      }
    });
    
    console.log(`🔍 Cita encontrada:`, cita ? `ID ${cita.id}` : 'NO');
    
    if (!cita) {
      console.log(`❌ Token no encontrado o expirado`);
      return res.status(404).json({ success: false, message: 'Enlace inválido o expirado' });
    }
    
    await cita.update({ estado: 'confirmada', confirmada_cliente: true });
    console.log(`✅ Cita ${cita.id} confirmada correctamente`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error confirmando cita:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API para cancelar cita (POST)
router.post('/api/confirmacion/:token/cancelar', async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`🔍 Cancelando cita con token: ${token}`);
    
    const cita = await Cita.findOne({
      where: {
        token_confirmacion: token,
        token_expira: { [Op.gt]: new Date() },
        estado: 'pendiente'
      }
    });
    
    if (!cita) {
      console.log(`❌ Token no encontrado o expirado: ${token}`);
      return res.status(404).json({ success: false, message: 'Enlace inválido o expirado' });
    }
    
    await cita.update({ estado: 'cancelada' });
    console.log(`❌ Cita ${cita.id} cancelada correctamente`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelando cita:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;