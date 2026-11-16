const Joi = require('joi');

// definicion de campos base para reutilizar
const id = Joi.number().integer();
const username = Joi.string().alphanum().min(3).max(60);
const email = Joi.string().email();
const password = Joi.string().min(6);
const name = Joi.string().min(2).max(255);
const lastName = Joi.string().min(2).max(255);
const phone = Joi.string().pattern(/^[0-9+ ]+$/).min(8).max(15).allow(null, '');
const avatarUrl = Joi.string().uri().allow(null, '');
const theme = Joi.string().valid('light', 'dark');
const stateId = Joi.number().integer();
const booleanField = Joi.boolean();

// schema para crear super admin
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

// schema para cambiar contrasena
const changePasswordSchema = Joi.object({
   oldPassword: Joi.string().required(),
   newPassword: password.required(),
});

const getSuperAdminSchema = Joi.object({
   id: id.required(),
});

const deleteSuperAdminSchema = Joi.object({
   id: id.required(),
});

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

const clientUsername = Joi.string().min(3).max(60).pattern(/^[a-zA-Z0-9._-]+$/);

const createClientUserSchema = Joi.object({
   username: clientUsername.required(),
   email: email.required(),
   password: password.required(),
   name: Joi.string().max(255).allow(null, '').optional(),
   lastName: Joi.string().max(255).allow(null, '').optional(),
   last_name: Joi.string().max(255).allow(null, '').optional(),
   entityId: id.optional(),
   entity_id: id.optional(),
   entityIds: Joi.array().items(id).optional(),
   entity_ids: Joi.array().items(id).optional(),
   permissions: Joi.object().optional(),
   preset: Joi.string().optional(),
   readOnly: booleanField.optional(),
   read_only: booleanField.optional(),
});

const listClientUsersQuerySchema = Joi.object({
   entityId: id.optional(),
   entity_id: id.optional(),
   search: Joi.string().allow('', null).optional(),
   page: Joi.number().integer().min(1).optional(),
   limit: Joi.number().integer().min(1).max(100).optional(),
});

const clientUserEntityParamsSchema = Joi.object({
   userId: id.required(),
   entityId: id.required(),
});

const updateClientUserEntityAccessSchema = Joi.object({
   readOnly: booleanField.optional(),
   read_only: booleanField.optional(),
   permissions: Joi.object().optional(),
});

const clientUserParamsSchema = Joi.object({
   userId: id.required(),
});

const updateClientUserSchema = Joi.object({
   username: clientUsername.optional(),
   email: email.optional(),
   name: Joi.string().max(255).allow(null, '').optional(),
   lastName: Joi.string().max(255).allow(null, '').optional(),
   last_name: Joi.string().max(255).allow(null, '').optional(),
   password: Joi.string().min(6).allow(null, '').optional(),
   entityId: id.optional(),
   entity_id: id.optional(),
   entityIds: Joi.array().items(id).optional(),
   permissions: Joi.object().optional(),
   state_id: Joi.number().valid(1, 2).optional(),
   stateId: Joi.number().valid(1, 2).optional(),
});

const updateClientPermissionsSchema = Joi.object({
   permissions: Joi.object().required(),
   entityId: id.optional(),
   entity_id: id.optional(),
});

const assignClientEntitiesSchema = Joi.object({
   entityIds: Joi.array().items(id).required(),
   permissions: Joi.object().optional(),
});

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
   updateEntityAssignmentSchema,
   createClientUserSchema,
   listClientUsersQuerySchema,
   clientUserEntityParamsSchema,
   updateClientUserEntityAccessSchema,
   clientUserParamsSchema,
   updateClientUserSchema,
   updateClientPermissionsSchema,
   assignClientEntitiesSchema,
};
