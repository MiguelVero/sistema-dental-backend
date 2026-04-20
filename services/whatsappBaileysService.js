const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Variable para controlar si ya se mostró el QR
let qrMostrado = false;

class WhatsAppBaileysService {
  constructor() {
    this.sock = null;
    this.conectado = false;
    this.inicializado = false;
    this.qrCallback = null;
    this.reconectando = false;
  }

  async iniciar() {
    if (this.inicializado && this.conectado) {
      return;
    }

    if (this.reconectando) {
      return;
    }

    this.reconectando = true;
    const sessionDir = path.join(__dirname, '../', 'whatsapp_sessions');
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Deshabilitar auto-print
        browser: ['Clinica Dental', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 15000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        maxRetries: 3,
        connectTimeoutMs: 20000,
        logger: {
          level: 'silent', // Silenciar logs internos
          log: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
          trace: () => {},
          debug: () => {},
          fatal: () => {},
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !qrMostrado && !this.conectado) {
          qrMostrado = true;
          console.log('\n📱 ESCANEA ESTE QR CON WHATSAPP (válido por 60 segundos):\n');
          QRCode.generate(qr, { small: true });
          if (this.qrCallback) this.qrCallback(qr);
          this.reconectando = false;
          
          // Reiniciar flag después de 60 segundos
          setTimeout(() => { qrMostrado = false; }, 60000);
        }

        if (connection === 'open') {
          this.conectado = true;
          this.inicializado = true;
          this.reconectando = false;
          qrMostrado = false;
          console.log('\n✅ WHATSAPP CONECTADO EXITOSAMENTE ✅\n');
        }

        if (connection === 'close') {
          this.conectado = false;
          const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
          
          if (statusCode !== DisconnectReason.loggedOut) {
            setTimeout(() => {
              this.reconectando = false;
              this.iniciar();
            }, 10000);
          } else {
            console.log('\n❌ SESIÓN CERRADA. Reinicia el servicio\n');
            this.inicializado = false;
            this.reconectando = false;
            qrMostrado = false;
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Procesar mensajes - SILENCIOSAMENTE
      this.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          // Ignorar mensajes de protocolo y estados
          if (msg.message?.protocolMessage) continue;
          if (msg.key.remoteJid === 'status@broadcast') continue;
          if (msg.key.fromMe) continue;
          
          let messageText = '';
          if (msg.message?.conversation) {
            messageText = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage?.text) {
            messageText = msg.message.extendedTextMessage.text;
          } else {
            continue;
          }
          
          let telefono = '';
          if (msg.key.remoteJid) {
            telefono = msg.key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
          }
          
          if (!telefono || telefono.length < 10) continue;
          
          const { Cita, Paciente } = require('../models');
          const { Op } = require('sequelize');
          
          const ultimos9 = telefono.slice(-9);
          
          const paciente = await Paciente.findOne({
            where: {
              telefono: { [Op.like]: `%${ultimos9}` }
            }
          });
          
          if (!paciente) continue;
          
          const textoLower = messageText.toLowerCase().trim();
          
          if (textoLower === 'confirmo' || textoLower.includes('confirmo')) {
            const cita = await Cita.findOne({
              where: {
                paciente_id: paciente.id,
                fecha: { [Op.gte]: new Date().toISOString().split('T')[0] },
                estado: 'pendiente'
              }
            });
            
            if (cita) {
              await cita.update({ confirmada_cliente: true, estado: 'confirmada' });
              console.log(`✅ Cita ${cita.id} confirmada por ${paciente.nombre}`);
              await this.enviarMensaje(telefono, `✅ ¡Gracias ${paciente.nombre}! Tu cita ha sido confirmada. 🦷`);
            }
          } else if (textoLower === 'cancelar' || textoLower.includes('cancelar')) {
            const cita = await Cita.findOne({
              where: {
                paciente_id: paciente.id,
                fecha: { [Op.gte]: new Date().toISOString().split('T')[0] },
                estado: 'pendiente'
              }
            });
            
            if (cita) {
              await cita.update({ estado: 'cancelada' });
              console.log(`❌ Cita ${cita.id} cancelada por ${paciente.nombre}`);
              await this.enviarMensaje(telefono, `❌ Tu cita ha sido cancelada. Llámanos para reagendar.`);
            }
          }
        }
      });

    } catch (error) {
      this.reconectando = false;
      setTimeout(() => this.iniciar(), 15000);
    }
  }

  async enviarMensaje(numeroTelefono, mensaje) {
    if (!this.conectado) {
      throw new Error('WhatsApp no está conectado');
    }

    let numeroLimpio = numeroTelefono.toString().replace(/\D/g, '');
    if (numeroLimpio.length === 9 && !numeroLimpio.startsWith('51')) {
      numeroLimpio = '51' + numeroLimpio;
    }
    
    const jid = `${numeroLimpio}@s.whatsapp.net`;

    try {
      const resultado = await this.sock.sendMessage(jid, { text: mensaje });
      console.log(`✅ Mensaje enviado a ${numeroTelefono}`);
      return resultado;
    } catch (error) {
      console.error(`❌ Error enviando:`, error.message);
      throw error;
    }
  }

  obtenerEstado() {
    return {
      conectado: this.conectado,
      inicializado: this.inicializado
    };
  }

  onQR(callback) {
    this.qrCallback = callback;
  }
}

module.exports = new WhatsAppBaileysService();