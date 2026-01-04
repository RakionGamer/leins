const Joi = require('joi');

// variables
const username = Joi.string().required();
const password = Joi.string().required();
const email = Joi.string().email().required();
const token = Joi.string().required();
const id = Joi.number().integer().required();

// esquemas validadores

// login
const loginSchema = Joi.object({
   username: username,
   password: password,
});

// recuperar contrasena
const recoverySchema = Joi.object({
   email: email,
});

// modificar contrasena (logeado)
const resetPasswordSchema = Joi.object({
   token: token,
   id: id,
   newPassword: Joi.string().min(6).required()
});

module.exports = { loginSchema, recoverySchema, resetPasswordSchema };