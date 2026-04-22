const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappBaileysService');
const QRCode = require('qrcode');

router.get('/qr', async (req, res) => {
  try {
    const qr = whatsappService.obtenerQR();
    if (!qr) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>WhatsApp QR</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>📱 WhatsApp QR</h1>
          <p>No hay QR disponible en este momento. Espera a que se genere...</p>
          <p>El servicio se está conectando. Refresca en unos segundos.</p>
          <button onclick="location.reload()">Refrescar</button>
        </body>
        </html>
      `);
    }
    
    // Generar QR como imagen
    const qrBuffer = await QRCode.toBuffer(qr, { type: 'png', width: 300 });
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp QR - Clínica Dental</title>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #f0f0f0; }
          .card { background: white; max-width: 500px; margin: auto; padding: 30px; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
          .qr-container { margin: 20px 0; }
          img { border: 1px solid #ddd; border-radius: 10px; padding: 10px; background: white; }
          .instructions { text-align: left; background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 20px 0; }
          button { padding: 10px 20px; background: #25D366; color: white; border: none; border-radius: 8px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>📱 Clínica Dental</h1>
          <h2>Escanea este QR con WhatsApp</h2>
          <div class="qr-container">
            <img src="data:image/png;base64,${qrBuffer.toString('base64')}" alt="QR Code"/>
          </div>
          <div class="instructions">
            <p><strong>Instrucciones:</strong></p>
            <ol>
              <li>Abre WhatsApp en tu teléfono</li>
              <li>Ve a <strong>Ajustes → Dispositivos vinculados</strong></li>
              <li>Presiona <strong>Vincular un dispositivo</strong></li>
              <li>Escanea el código QR de arriba</li>
            </ol>
          </div>
          <p>⚠️ El QR expira después de 60 segundos. Refresca si es necesario.</p>
          <button onclick="location.reload()">Refrescar QR</button>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error generando QR');
  }
});

module.exports = router;