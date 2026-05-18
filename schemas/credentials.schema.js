const Joi = require('joi');

const id = Joi.number().integer().positive();
const type = Joi.string().valid('SII', 'BANK', 'sii', 'bank');
const rut = Joi.string().trim().min(3).max(20);
const rutSinDv = Joi.string().trim().pattern(/^\d+$/).max(12);
const dv = Joi.string().trim().pattern(/^[0-9kK]$/);
const secretText = Joi.string().min(1).max(255);

const entityCredentialParamsSchema = Joi.object({
   entityId: id.required(),
});

const credentialParamsSchema = Joi.object({
   entityId: id.required(),
   credentialId: id.required(),
});

const listCredentialsQuerySchema = Joi.object({
   type: type.optional(),
   limit: Joi.number().integer().min(1).max(200).optional(),
   offset: Joi.number().integer().min(0).optional(),
});

const createCredentialSchema = Joi.object({
   type: type.required(),
   user_id: id.allow(null).optional(),

   rut: rut.optional(),
   rut_sin_dv: rutSinDv.optional(),
   dv: dv.optional(),
   clave: secretText.optional(),

   bank: Joi.string().trim().min(2).max(80).optional(),
   username: Joi.string().trim().min(1).max(120).optional(),
   password: secretText.optional(),
}).custom((value, helpers) => {
   const credentialType = String(value.type || '').toUpperCase();

   if (credentialType === 'SII') {
      const hasRut = Boolean(value.rut) || Boolean(value.rut_sin_dv && value.dv);
      if (value.rut_sin_dv && !value.dv) return helpers.message('dv es requerido cuando se envia rut_sin_dv');
      if (value.dv && !value.rut_sin_dv && !value.rut) return helpers.message('rut_sin_dv es requerido cuando se envia dv');
      if (!value.clave && !value.password) return helpers.message('clave es requerida para credenciales SII');
      if (!hasRut) return value;
   }

   if (credentialType === 'BANK') {
      if (!value.bank) return helpers.message('bank es requerido para credenciales BANK');
      if (!value.username) return helpers.message('username es requerido para credenciales BANK');
      if (!value.password && !value.clave) return helpers.message('password es requerido para credenciales BANK');
   }

   return value;
});

const updateCredentialSchema = Joi.object({
   type: type.optional(),
   user_id: id.allow(null).optional(),

   rut: rut.optional(),
   rut_sin_dv: rutSinDv.optional(),
   dv: dv.optional(),
   clave: secretText.optional(),

   bank: Joi.string().trim().min(2).max(80).optional(),
   username: Joi.string().trim().min(1).max(120).optional(),
   password: secretText.optional(),
}).min(1).custom((value, helpers) => {
   if (String(value.type || '').toUpperCase() === 'BANK') return value;
   if (!value.rut_sin_dv && !value.rut && value.dv && (value.bank || value.username || value.password)) return value;
   if (value.rut_sin_dv && !value.dv) return helpers.message('dv es requerido cuando se envia rut_sin_dv');
   if (value.dv && !value.rut_sin_dv && !value.rut) return helpers.message('rut_sin_dv es requerido cuando se envia dv');
   return value;
});

module.exports = {
   entityCredentialParamsSchema,
   credentialParamsSchema,
   listCredentialsQuerySchema,
   createCredentialSchema,
   updateCredentialSchema,
};
