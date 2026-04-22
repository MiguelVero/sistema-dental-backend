const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

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
      console.log('📱 WhatsApp ya está conectado');
      return;
    }

    if (this.reconectando) {
      console.log('📱 Reconectando...');
      return;
    }

    this.reconectando = true;
    const sessionDir = path.join(__dirname, '../', 'whatsapp_sessions');
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
      console.log(`📁 Carpeta de sesiones creada`);
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
        maxRetries: 2,
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
          console.log('\n╔════════════════════════════════════════════════════╗');
          console.log('║     📱 ESCANEA ESTE QR CON WHATSAPP 📱             ║');
          console.log('╚════════════════════════════════════════════════════╝');
          QRCode.generate(qr, { small: true });
          if (this.qrCallback) this.qrCallback(qr);
          
          setTimeout(() => { qrMostrado = false; }, 60000);
        }

        if (connection === 'open') {
          this.conectado = true;
          this.inicializado = true;
          this.reconectando = false;
          qrMostrado = false;
          console.log('\n╔════════════════════════════════════════════════════╗');
          console.log('║     ✅ WHATSAPP CONECTADO EXITOSAMENTE ✅          ║');
          console.log('╚════════════════════════════════════════════════════╝');
          if (this.sock.user) {
            console.log(`📱 Número conectado: ${this.sock.user.id.split(':')[0]}\n`);
          }
        }

        if (connection === 'close') {
          this.conectado = false;
          const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 500;
          
          if (statusCode !== DisconnectReason.loggedOut) {
            console.log('⚠️ WhatsApp desconectado, reconectando en 15 segundos...');
            setTimeout(() => {
              this.reconectando = false;
              this.iniciar();
            }, 15000);
          } else {
            console.log('\n❌ SESIÓN CERRADA. Reinicia el servicio\n');
            this.inicializado = false;
            this.reconectando = false;
            qrMostrado = false;
          }
        }
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Manejar errores de conexión
      this.sock.ev.on('error', (error) => {
        console.error('❌ Error en WhatsApp:', error.message);
      });

    } catch (error) {
      console.error('❌ Error iniciando WhatsApp:', error.message);
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