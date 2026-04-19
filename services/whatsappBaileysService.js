const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

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
      logger.info('WhatsApp ya está conectado');
      return;
    }

    if (this.reconectando) {
      logger.info('Ya hay un intento de reconexión en curso');
      return;
    }

    this.reconectando = true;
    const sessionDir = path.join(__dirname, '../', 'whatsapp_sessions');
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      console.log(`📁 Carpeta de sesiones creada en: ${sessionDir}`);
    }

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Clinica Dental', 'Chrome', '1.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        defaultQueryTimeoutMs: 15000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        maxRetries: 3,
        connectTimeoutMs: 20000,
            // Agrega esta línea para aumentar el tiempo entre QR
        qrTimeout: 60000  // 60 segundos en lugar de 20
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n╔════════════════════════════════════════════════════╗');
          console.log('║     📱 ESCANEA ESTE QR CON WHATSAPP 📱             ║');
          console.log('╚════════════════════════════════════════════════════╝');
          QRCode.generate(qr, { small: true });
          if (this.qrCallback) this.qrCallback(qr);
          logger.info('Nuevo QR generado');
          this.reconectando = false;
        }

        if (connection === 'connecting') {
          console.log('🔄 Conectando a WhatsApp...');
        }

        if (connection === 'open') {
          this.conectado = true;
          this.inicializado = true;
          this.reconectando = false;
          console.log('\n╔════════════════════════════════════════════════════╗');
          console.log('║     ✅ WHATSAPP CONECTADO EXITOSAMENTE ✅          ║');
          console.log('╚════════════════════════════════════════════════════╝');
          if (this.sock.user) {
            console.log(`📱 Número conectado: ${this.sock.user.id.split(':')[0]}\n`);
          }
          logger.info('WhatsApp conectado y listo para enviar mensajes');
        }

        if (connection === 'close') {
          this.conectado = false;
          const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
          
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log('⚠️ WhatsApp desconectado, reconectando en 10 segundos...');
            logger.info('WhatsApp desconectado, reconectando en 10 segundos...');
            setTimeout(() => {
              this.reconectando = false;
              this.iniciar();
            }, 10000);
          } else {
            console.log('\n❌ SESIÓN CERRADA. Elimina la carpeta "whatsapp_sessions" y reinicia el servidor\n');
            logger.error('WhatsApp cerró sesión. Elimina la carpeta whatsapp_sessions y reinicia');
            this.inicializado = false;
            this.reconectando = false;
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // MONITOREAR MENSAJES ENTRANTES - VERSIÓN QUE CAPTURA TODOS LOS EVENTOS
     this.sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    // Ignorar mensajes de protocolo y sincronización
    if (msg.message?.protocolMessage) {
      continue; // No mostrar estos mensajes
    }
    
    // Ignorar mensajes de estados (status@broadcast)
    if (msg.key.remoteJid === 'status@broadcast') {
      continue;
    }
    
    console.log('📨 Mensaje recibido:', JSON.stringify(msg, null, 2));
    
    // Intentar obtener el texto del mensaje
    let messageText = '';
    
    if (msg.message?.conversation) {
      messageText = msg.message.conversation;
    } else if (msg.message?.extendedTextMessage?.text) {
      messageText = msg.message.extendedTextMessage.text;
    } else {
      continue; // No es un mensaje de texto, ignorar
    }
    
    // Solo procesar mensajes que NO son enviados por nosotros
    if (msg.key.fromMe) {
      continue;
    }
          
          console.log(`📨 PROCESANDO RESPUESTA: "${messageText}"`);
          
          // Extraer el número de teléfono
          let telefono = '';
          if (msg.key.remoteJid) {
            telefono = msg.key.remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
          }
          
          console.log(`📨 Teléfono del remitente: ${telefono}`);
          
          if (!telefono || telefono.length < 10) {
            console.log('⚠️ No se pudo extraer el número de teléfono');
            continue;
          }
          
          const { Cita, Paciente } = require('../models');
          const { Op } = require('sequelize');
          
          const ultimos9 = telefono.slice(-9);
          console.log(`📨 Buscando paciente con número que termine en: ${ultimos9}`);
          
          const paciente = await Paciente.findOne({
            where: {
              telefono: {
                [Op.like]: `%${ultimos9}`
              }
            }
          });
          
          if (!paciente) {
            console.log(`❌ No se encontró paciente para ${telefono}`);
            continue;
          }
          
          console.log(`✅ Paciente encontrado: ${paciente.nombre}`);
          
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
              console.log(`🎉🎉🎉 CITA ${cita.id} CONFIRMADA por ${paciente.nombre} 🎉🎉🎉`);
              await this.enviarMensaje(telefono, `✅ ¡Gracias ${paciente.nombre}! Tu cita ha sido confirmada. 🦷`);
            } else {
              console.log('❌ No se encontró cita pendiente para confirmar');
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
              console.log(`❌❌❌ CITA ${cita.id} CANCELADA por ${paciente.nombre} ❌❌❌`);
              await this.enviarMensaje(telefono, `❌ Tu cita ha sido cancelada. Llámanos para reagendar.`);
            }
          }
        }
      });

    } catch (error) {
      logger.error('Error iniciando WhatsApp:', error);
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