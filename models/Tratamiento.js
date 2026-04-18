const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tratamiento = sequelize.define('Tratamiento', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT
  },
  duracion_minutos: {
    type: DataTypes.INTEGER,
    defaultValue: 60
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'tratamientos',
  timestamps: false
});

module.exports = Tratamiento;