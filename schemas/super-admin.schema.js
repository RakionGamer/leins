const Joi = require('joi');

// definicion de campos base para reutilizar
const id = Joi.number().integer();
const username = Joi.string().alphanum().min(3).max(60);
const email = Joi.string().email();
const password = Joi.string().min(6); // ajusta la seguridad segun necesites
const name = Joi.string().min(2).max(255);
const lastName = Joi.string().min(2).max(255);
// phone permite nulo o vacio para evitar errores si el usuario lo borra
const phone = Joi.string().pattern(/^[0-9+ ]+$/).min(8).max(15).allow(null, '');
const avatarUrl = Joi.string().uri().allow(null, '');
const theme = Joi.string().valid('light', 'dark');
const stateId = Joi.number().integer();
const booleanField = Joi.boolean();

// schema para crear (post /)
const createSuperAdminSchema = Joi.object({
   username: username.required(),
   email: email.required(),
   password: password.required(),
   name: name.optional(),
   last_name: lastName.optional(),
   phone: phone.optional(),
   avatar_url: avatarUrl.optional(),
   theme: theme.optional(),
   verified: booleanField.optional(),
   two_factor_enabled: booleanField.optional(),
});

// schema para actualizar perfil (post /profile)
const updateSuperAdminSchema = Joi.object({
   name: name,
   last_name: lastName,
   phone: phone,
   avatar_url: avatarUrl,
   theme: theme,
   email: email
});

// schema para cambiar contrasena (post /change-password)
const changePasswordSchema = Joi.object({
   oldPassword: Joi.string().required(),
   newPassword: password.required(),
});

// schema para params (get /:id)
const getSuperAdminSchema = Joi.object({
   id: id.required(),
});

// schema para eliminar (delete /:id)
const deleteSuperAdminSchema = Joi.object({
   id: id.required(),
});

// schema para tema (patch /theme)
const updateThemeSchema = Joi.object({
   theme: theme.required(),
});

const changeStateSchema = Joi.object({
   state_id: Joi.number().integer().required()
});

const entityAssignmentParamsSchema = Joi.object({
   id: id.required(),
});

const entityAssignmentEntityParamsSchema = Joi.object({
   id: id.required(),
   entityId: id.required(),
});

const entityAssignmentSchema = Joi.object({
   entity_id: id.optional(),
   entityId: id.optional(),
   can_create: Joi.boolean().optional(),
   canCreate: Joi.boolean().optional(),
   can_update: Joi.boolean().optional(),
   canUpdate: Joi.boolean().optional(),
   can_delete: Joi.boolean().optional(),
   canDelete: Joi.boolean().optional(),
   is_admin: Joi.boolean().optional(),
   isAdmin: Joi.boolean().optional(),
}).or('entity_id', 'entityId');

const updateEntityAssignmentSchema = Joi.object({
   can_create: Joi.boolean().optional(),
   canCreate: Joi.boolean().optional(),
   can_update: Joi.boolean().optional(),
   canUpdate: Joi.boolean().optional(),
   can_delete: Joi.boolean().optional(),
   canDelete: Joi.boolean().optional(),
   is_admin: Joi.boolean().optional(),
   isAdmin: Joi.boolean().optional(),
}).min(1);

module.exports = {
   createSuperAdminSchema,
   updateSuperAdminSchema,
   getSuperAdminSchema,
   deleteSuperAdminSchema,
   updateThemeSchema,
   changePasswordSchema,
   changeStateSchema,
   entityAssignmentParamsSchema,
   entityAssignmentEntityParamsSchema,
   entityAssignmentSchema,
   updateEntityAssignmentSchema
};
