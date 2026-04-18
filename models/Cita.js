const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Cita = sequelize.define('Cita', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  paciente_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'pacientes',
      key: 'id'
    }
  },
  tratamiento_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'tratamientos',
      key: 'id'
    }
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: true
    }
  },
  hora: {
    type: DataTypes.TIME,
    allowNull: false
  },
  estado: {
    type: DataTypes.ENUM('pendiente', 'confirmada', 'cancelada', 'completada'),
    defaultValue: 'pendiente'
  },
  recordatorio_24h_enviado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recordatorio_1h_enviado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  confirmada_cliente: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notas: {
    type: DataTypes.TEXT
  },
  token_confirmacion: {  // NUEVO CAMPO
    type: DataTypes.STRING(100),
    unique: true
  },
  token_expira: {  // NUEVO CAMPO
    type: DataTypes.DATE
  }
}, {
  tableName: 'citas',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Cita;