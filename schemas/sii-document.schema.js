const joi = require('joi');

// funcion validadora de rut chileno (modulo 11)
const validateRut = (value, helpers) => {
   if (!value) return value; 
   
   // limpiamos el string dejando solo numeros y la letra k
   const cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();
   if (cleanRut.length < 2) return helpers.message('el rut de la contraparte no es valido');

   const dv = cleanRut.slice(-1);
   let body = parseInt(cleanRut.slice(0, -1), 10);
   
   // algoritmo modulo 11
   let sum = 0;
   let multiplier = 2;
   while (body > 0) {
      sum += (body % 10) * multiplier;
      body = Math.floor(body / 10);
      multiplier = multiplier < 7 ? multiplier + 1 : 2;
   }
   
   const expectedDv = 11 - (sum % 11);
   const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);
   
   if (dv !== calculatedDv) {
      return helpers.message('el rut de la contraparte no es valido');
   }
   
   return value; 
};

// definimos los tipos y restricciones de cada campo
const entity_id = joi.number().integer().positive();
const total_amount = joi.number().precision(2).positive();
const issue_date = joi.date().iso(); 
const doc_type_code = joi.number().integer().positive().allow(null);
// aplicamos la validacion custom al rut
const counterparty_rut = joi.string().max(16).allow(null, '').custom(validateRut, 'validacion matematica de rut');
const counterparty_name = joi.string().max(255).allow(null, '');
const state_id = joi.number().integer().positive();
const folio = joi.string().max(50).allow(null, '');

// esquema para la creacion de un ingreso manual
const createManualIncomeSchema = joi.object({
   entity_id: entity_id.required(),
   total_amount: total_amount.required(),
   issue_date: issue_date.required(),
   doc_type_code: doc_type_code.optional(),
   counterparty_rut: counterparty_rut.optional(),
   counterparty_name: counterparty_name.optional(),
   state_id: state_id.optional(),
   folio: folio.optional()
});

module.exports = { createManualIncomeSchema };