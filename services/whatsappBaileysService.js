const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

let qrMostrado = false;
let reintentos = 0;
const MAX_REINTENTOS = 5;

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
        printQRInTerminal: false,
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
          level: 'silent',
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
          reintentos = 0;
          console.log('\n📱 ESCANEA ESTE QR CON WHATSAPP:\n');
          QRCode.generate(qr, { small: true });
          if (this.qrCallback) this.qrCallback(qr);
          this.reconectando = false;
          
          setTimeout(() => { qrMostrado = false; }, 120000);
        }

        if (connection === 'open') {
          this.conectado = true;
          this.inicializado = true;
          this.reconectando = false;
          qrMostrado = false;
          reintentos = 0;
          console.log('\n✅ WHATSAPP CONECTADO ✅\n');
        }

        if (connection === 'close') {
          this.conectado = false;
          const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
          
          if (statusCode !== DisconnectReason.loggedOut && reintentos < MAX_REINTENTOS) {
            reintentos++;
            console.log(`⚠️ Reconectando WhatsApp (intento ${reintentos}/${MAX_REINTENTOS})...`);
            setTimeout(() => {
              this.reconectando = false;
              this.iniciar();
            }, 30000 * reintentos);
          } else if (reintentos >= MAX_REINTENTOS) {
            console.log('❌ No se pudo conectar WhatsApp después de varios intentos');
            this.inicializado = false;
            this.reconectando = false;
          } else {
            console.log('❌ Sesión de WhatsApp cerrada. Esperando nuevo QR...');
            this.inicializado = false;
            this.reconectando = false;
            qrMostrado = false;
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Procesar mensajes silenciosamente
      this.sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
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
            where: { telefono: { [Op.like]: `%${ultimos9}` } }
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
              console.log(`✅ Cita ${cita.id} confirmada`);
              await this.enviarMensaje(telefono, `✅ ¡Gracias! Tu cita ha sido confirmada. 🦷`);
            }
          }
        }
      });

    } catch (error) {
      this.reconectando = false;
      setTimeout(() => this.iniciar(), 30000);
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