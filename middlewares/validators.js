const { body, validationResult } = require('express-validator');

// Middleware para validar errores
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Error de validación',
      detalles: errors.array() 
    });
  }
  next();
};


// Validación para crear/actualizar cita (VERSIÓN SIMPLIFICADA)
const validateCita = [
  body('paciente_id')
    .notEmpty().withMessage('El paciente_id es requerido'),
  
  body('tratamiento_id')
    .notEmpty().withMessage('El tratamiento_id es requerido'),
  
  body('fecha')
    .notEmpty().withMessage('La fecha es requerida'),
  
  body('hora')
    .notEmpty().withMessage('La hora es requerida'),
  
  handleValidationErrors
];

// Validación para paciente
const validatePaciente = [
  body('nombre')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('telefono')
    .notEmpty().withMessage('El teléfono es requerido')
    .matches(/^[0-9+\-\s]+$/).withMessage('El teléfono contiene caracteres inválidos')
    .isLength({ min: 9, max: 15 }).withMessage('El teléfono debe tener entre 9 y 15 dígitos'),
  
  body('email')
    .optional()
    .isEmail().withMessage('El email no es válido'),
  
  body('direccion')
    .optional()
    .isString().withMessage('La dirección debe ser texto'),
  
  handleValidationErrors
];

// Validación para tratamiento
const validateTratamiento = [
  body('nombre')
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('duracion_minutos')
    .optional()
    .isInt({ min: 15, max: 480 }).withMessage('La duración debe ser entre 15 y 480 minutos'),
  
  body('precio')
    .optional()
    .isFloat({ min: 0 }).withMessage('El precio debe ser un número positivo'),
  
  handleValidationErrors
];

module.exports = {
  validateCita,
  validatePaciente,
  validateTratamiento,
  handleValidationErrors
};