require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');

const { sequelize } = require('./config/database');
const whatsappService = require('./services/whatsappBaileysService');
const { revisarYEnviarRecordatorios } = require('./controllers/whatsappController');

// Importar rutas
// const authRoutes = require('./routes/authRoutes');  // COMENTAR ESTA LÍNEA
const citaRoutes = require('./routes/citaRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const pacienteRoutes = require('./routes/pacienteRoutes');
const tratamientoRoutes = require('./routes/tratamientoRoutes');
const confirmacionRoutes = require('./routes/confirmacionRoutes');
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    methods: ['GET', 'POST']
  }
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Socket.IO para notificaciones en tiempo real
io.on('connection', (socket) => {
  console.log('📱 Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('📱 Cliente desconectado:', socket.id);
  });
});

// Middleware para inyectar io a las rutas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rutas
// app.use('/api/auth', authRoutes);  // COMENTAR ESTA LÍNEA
app.use('/api/citas', citaRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/tratamientos', tratamientoRoutes);
app.use('/', confirmacionRoutes);
// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    whatsapp: whatsappService.obtenerEstado()
  });
});

// Iniciar WhatsApp service con manejo de errores
if (process.env.WHATSAPP_AUTO_START === 'true') {
  setTimeout(async () => {
    try {
      await whatsappService.iniciar();
    } catch (error) {
      console.error('❌ Error al iniciar WhatsApp:', error.message);
    }
  }, 5000);
}

// Programar CRON jobs
// Cada hora: revisar citas para recordatorios
cron.schedule('0 * * * *', async () => {
  console.log('🔄 [CRON] Revisando citas para recordatorios...');
  await revisarYEnviarRecordatorios(io);
  console.log('✅ [CRON] Revisión completada');
});

// Cada día a las 9 AM: limpieza de logs de sesiones
cron.schedule('0 9 * * *', () => {
  console.log('🧹 [CRON] Limpieza programada ejecutada');
});

// Conectar a BD y iniciar servidor
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');
    
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados');
    
    server.listen(process.env.PORT || 3000, () => {
      console.log(`🚀 Servidor corriendo en puerto ${process.env.PORT || 3000}`);
      console.log(`📱 Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
  }
};

startServer();

module.exports = { app, io };