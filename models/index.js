const Paciente = require('./Paciente');
const Tratamiento = require('./Tratamiento');
const Cita = require('./Cita');

// Establecer relaciones
Paciente.hasMany(Cita, { foreignKey: 'paciente_id', as: 'citas' });
Cita.belongsTo(Paciente, { foreignKey: 'paciente_id', as: 'paciente' });

Tratamiento.hasMany(Cita, { foreignKey: 'tratamiento_id', as: 'citas' });
Cita.belongsTo(Tratamiento, { foreignKey: 'tratamiento_id', as: 'tratamiento' });

module.exports = {
  Paciente,
  Tratamiento,
  Cita,
  sequelize: require('../config/database').sequelize
};