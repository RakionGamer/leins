const boom = require('@hapi/boom');
const SuperAdminService = require('../services/super-admin.service');
const { logInfo } = require('../utils/logger');
const asyncHandler = require('../utils/helpers/asyncHandler');

const service = new SuperAdminService();

// controlador para crear un nuevo super admin
const createSuperAdmin = asyncHandler(async (req, res) => {
   const body = req.body;
   const created = await service.create(body);

   // log de auditoria: creacion de usuario
   logInfo('USER_CREATED', {
      rid: req.rid,
      newUserId: created.id,
      email: created.email,
      ip: req.ip
   });

   res.status(201).json({ data: created });
});

// controlador para obtener perfil del usuario actual (lectura)
const getProfile = asyncHandler(async (req, res) => {
   const { sub: superAdminId } = req.user;
   const superAdmin = await service.findOne(superAdminId);

   if (!superAdmin) throw boom.notFound('super admin not found');

   res.status(200).json({ data: superAdmin });
});

// controlador para modificar contrasena
const changePassword = asyncHandler(async (req, res) => {
   const { sub: superAdminId } = req.user;
   const { oldPassword, newPassword } = req.body;
   const result = await service.changePassword(superAdminId, oldPassword, newPassword);

   // log de auditoria
   logInfo('USER_PASSWORD_CHANGED', { rid: req.rid, userId: superAdminId });

   res.status(200).json(result);
});

// controlador para actualizar datos de texto del perfil
const updateProfile = asyncHandler(async (req, res) => {
   const { sub: id } = req.user; // id seguro del token
   const changes = req.body;
   const updated = await service.update(id, changes);

   // log de auditoria
   logInfo('USER_PROFILE_UPDATED', {
      rid: req.rid,
      userId: id,
      changes: Object.keys(changes)
   });

   res.status(200).json({ message: 'perfil actualizado', data: updated });
});

// controlador para actualizar un super admin completo
const updateSuperAdmin = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const body = req.body;
   const result = await service.update(id, body);

   // log de auditoria
   logInfo('USER_UPDATED', {
      rid: req.rid,
      targetId: id,
      updatedFields: Object.keys(body),
      author: req.user.sub
   });

   res.status(200).json(result);
});

// controlador para subir o actualizar avatar
const uploadAvatar = asyncHandler(async (req, res) => {
   if (!req.file) throw boom.badRequest('no se ha subido ninguna imagen');

   const { sub: superAdminId } = req.user;
   const protocol = req.protocol;
   const host = req.get('host');

   const avatarUrl = `${protocol}://${host}/avatars/${req.file.filename}`;

   const updated = await service.update(superAdminId, { avatar_url: avatarUrl });

   // log de auditoria: cambio de imagen
   logInfo('USER_AVATAR_UPDATED', {
      rid: req.rid,
      userId: superAdminId,
      filename: req.file.filename
   });

   res.status(200).json({ message: 'avatar actualizado', data: { avatar_url: avatarUrl } });
});

// controlador para cambiar preferencia de tema
const changeTheme = asyncHandler(async (req, res) => {
   const { sub: superAdminId } = req.user;
   const { theme } = req.body;

   if (!theme || !['light', 'dark'].includes(theme)) {
      throw boom.badRequest('invalid theme value.');
   }

   const updated = await service.updateTheme(superAdminId, theme);

   if (!updated) throw boom.notFound('super admin not found');

   res.status(200).json({ data: updated });
});

// controlador para eliminar un administrador
const deleteSuperAdmin = asyncHandler(async (req, res) => {
   const { id } = req.params;
   await service.delete(id);

   // log de auditoria
   logInfo('USER_DELETED', { rid: req.rid, targetId: id, authorIp: req.ip });

   res.status(200).json({ id });
});

// controlador para listar super admins (con paginacion y busqueda)
const listSuperAdmins = asyncHandler(async (req, res) => {
   const { limit = 10, offset = 0, search } = req.query;
   const currentUserId = req.user.sub;

   const users = await service.find({
      limit,
      offset,
      search,
      excludeId: currentUserId
   });

   res.status(200).json(users);
});

// controlador para obtener un super admin por id
const getSuperAdminById = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const user = await service.findOne(id);

   res.status(200).json(user);
});

// controlador para activar o desactivar usuario
const changeSuperAdminState = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const { state_id } = req.body;

   const result = await service.changeState(id, state_id);

   // log de auditoria
   logInfo('USER_STATE_CHANGED', {
      rid: req.rid,
      targetId: id,
      newState: state_id,
      author: req.user.sub
   });

   res.status(200).json(result);
});

const listSuperAdminEntities = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const actorId = req.user?.sub || req.user?.id;
   const out = await service.listEntityAssignments(id, { actorId });
   res.status(200).json(out);
});

const listAssignableEntities = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const out = await service.listAssignableEntities({
      actorId,
      q: req.query.q || null,
      limit: req.query.limit,
      offset: req.query.offset,
      activeOnly: String(req.query.activeOnly ?? 'true').toLowerCase() !== 'false'
   });

   res.status(200).json(out);
});

const assignEntityToSuperAdmin = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const actorId = req.user?.sub || req.user?.id;
   const entityId = req.body?.entity_id || req.body?.entityId;

   const out = await service.assignEntity({
      superAdminId: id,
      entityId,
      actorId,
      flags: req.body || {}
   });

   logInfo('ADMIN_ENTITY_ASSIGNED', {
      rid: req.rid,
      author: actorId,
      targetId: Number(id),
      entityId: Number(entityId)
   });

   res.status(201).json(out);
});

const updateSuperAdminEntityAssignment = asyncHandler(async (req, res) => {
   const { id, entityId } = req.params;
   const actorId = req.user?.sub || req.user?.id;

   const out = await service.assignEntity({
      superAdminId: id,
      entityId,
      actorId,
      flags: req.body || {}
   });

   logInfo('ADMIN_ENTITY_ASSIGNMENT_UPDATED', {
      rid: req.rid,
      author: actorId,
      targetId: Number(id),
      entityId: Number(entityId)
   });

   res.status(200).json(out);
});

const removeEntityFromSuperAdmin = asyncHandler(async (req, res) => {
   const { id, entityId } = req.params;
   const actorId = req.user?.sub || req.user?.id;

   const out = await service.removeEntityAssignment({
      superAdminId: id,
      entityId,
      actorId
   });

   logInfo('ADMIN_ENTITY_UNASSIGNED', {
      rid: req.rid,
      author: actorId,
      targetId: Number(id),
      entityId: Number(entityId)
   });

   res.status(200).json(out);
});

// crea una cuenta cliente (users) y la vincula a una o varias entidades con permisos
const createClientUser = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const {
      username,
      email,
      password,
      name,
      last_name,
      lastName,
      entityId,
      entity_id,
      entityIds,
      entity_ids,
      permissions,
      preset,
      read_only,
      readOnly
   } = req.body || {};

   const out = await service.createClientUser({
      actorId,
      username,
      email,
      password,
      name,
      lastName: lastName ?? last_name,
      entityId: entityId ?? entity_id,
      entityIds: entityIds ?? entity_ids,
      permissions,
      preset,
      readOnly: readOnly ?? read_only ?? false,
   });

   logInfo('CLIENT_USER_CREATED', {
      rid: req.rid,
      author: actorId,
      newUserId: out.row?.id,
   });

   res.status(201).json(out);
});

// lista clientes (con soporte de búsqueda, paginación y filtro opcional de entidad)
const listClientUsers = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const entityId = req.query?.entityId || req.query?.entity_id;
   const search = req.query?.search;
   const page = req.query?.page;
   const limit = req.query?.limit;

   const out = await service.listClientUsers({ actorId, entityId, search, page, limit });
   res.status(200).json(out);
});

// obtener un cliente por id
const getClientUserById = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;

   const out = await service.getClientUserById({ actorId, userId });
   res.status(200).json(out);
});

// edita datos de un cliente
const updateClientUser = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;
   const {
      username,
      email,
      name,
      last_name,
      lastName,
      entityId,
      entity_id,
      entityIds,
      entity_ids,
      password,
      permissions,
      stateId,
      state_id
   } = req.body || {};

   const out = await service.updateClientUser({
      actorId,
      userId,
      entityId: entityId ?? entity_id,
      entityIds: entityIds ?? entity_ids,
      username,
      email,
      name,
      lastName: lastName ?? last_name,
      password,
      permissions,
      stateId: stateId ?? state_id,
   });

   logInfo('CLIENT_USER_UPDATED', {
      rid: req.rid,
      author: actorId,
      userId: Number(userId),
   });

   res.status(200).json(out);
});

// cambia estado de cliente (1 activo, 2 suspendido)
const changeClientUserState = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;
   const { state_id, stateId } = req.body || {};

   const out = await service.changeClientUserState({
      actorId,
      userId,
      stateId: stateId ?? state_id,
   });

   logInfo('CLIENT_USER_STATE_CHANGED', {
      rid: req.rid,
      author: actorId,
      userId: Number(userId),
      state_id: out.state_id
   });

   res.status(200).json(out);
});

// elimina un cliente
const deleteClientUser = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;

   const out = await service.deleteClientUser({ actorId, userId });

   logInfo('CLIENT_USER_DELETED', {
      rid: req.rid,
      author: actorId,
      userId: Number(userId)
   });

   res.status(200).json(out);
});

// obtiene la matriz de permisos de un cliente
const getClientUserPermissions = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;
   const entityId = req.query?.entityId || req.query?.entity_id;

   const out = await service.getClientUserPermissions({ actorId, userId, entityId });
   res.status(200).json(out);
});

// actualiza la matriz de permisos de un cliente
const updateClientUserPermissions = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId } = req.params;
   const { permissions, entityId, entity_id } = req.body || {};

   const out = await service.updateClientUserPermissions({
      actorId,
      userId,
      entityId: entityId ?? entity_id,
      permissions
   });

   logInfo('CLIENT_USER_PERMISSIONS_UPDATED', {
      rid: req.rid,
      author: actorId,
      userId: Number(userId),
      entityId: out.entityId
   });

   res.status(200).json(out);
});

// catalogo canonico de modulos y permisos
const getPermissionsCatalog = asyncHandler(async (req, res) => {
   const out = service.getPermissionsCatalog();
   res.status(200).json(out);
});

// cambia el permiso read_only de un cliente sobre una entidad puntual (legacy)
const updateClientUserEntityAccess = asyncHandler(async (req, res) => {
   const actorId = req.user?.sub || req.user?.id;
   const { userId, entityId } = req.params;
   const { read_only, readOnly, permissions } = req.body || {};

   const out = await service.updateClientUserEntityAccess({
      actorId,
      userId,
      entityId,
      readOnly: readOnly ?? read_only,
      permissions
   });

   logInfo('CLIENT_USER_ENTITY_ACCESS_UPDATED', {
      rid: req.rid,
      author: actorId,
      userId: Number(userId),
      entityId: Number(entityId),
      read_only: out.read_only
   });

   res.status(200).json(out);
});

module.exports = {
   createSuperAdmin,
   createClientUser,
   listClientUsers,
   getClientUserById,
   updateClientUser,
   changeClientUserState,
   deleteClientUser,
   getClientUserPermissions,
   updateClientUserPermissions,
   getPermissionsCatalog,
   updateClientUserEntityAccess,
   getProfile,
   changePassword,
   updateProfile,
   updateSuperAdmin,
   uploadAvatar,
   changeTheme,
   deleteSuperAdmin,
   listSuperAdmins,
   getSuperAdminById,
   changeSuperAdminState,
   listAssignableEntities,
   listSuperAdminEntities,
   assignEntityToSuperAdmin,
   updateSuperAdminEntityAssignment,
   removeEntityFromSuperAdmin
};
