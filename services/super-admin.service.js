const { PERMISSION_MODULES, getDefaultPermissions, getPresetPermissions, sanitizePermissions } = require('../utils/permissions.constants');
const boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize')
const { models, sequelize } = require('./../libs/sequelize');

class SuperAdminService {
   constructor() { }

   // lista admins con paginacion
   async find(query) {
      const { limit, offset, search, excludeId } = query;

      const options = {
         attributes: { exclude: ['password_hash', 'two_factor_secret'] },
         where: {},
         order: [['id', 'DESC']]
      };

      if (limit !== undefined && offset !== undefined) {
         options.limit = parseInt(limit);
         options.offset = parseInt(offset);
      }

      if (search) {
         options.where = {
            [Op.or]: [
               { username: { [Op.like]: `%${search}%` } },
               { email: { [Op.like]: `%${search}%` } },
               { name: { [Op.like]: `%${search}%` } },
               { last_name: { [Op.like]: `%${search}%` } }
            ]
         };
      }

      // excluye a quien esta consultando
      if (excludeId) {
         options.where.id = { [Op.ne]: excludeId };
      }

      const { count, rows } = await models.SuperAdmin.findAndCountAll(options);
      return { total: count, items: rows };
   }

   // Cambiar estado (Activar/Bloquear)
   async changeState(id, stateId) {
      const admin = await this.findOne(id);

      // Aquí actualizamos solo el campo state_id
      await admin.update({ state_id: stateId });

      return {
         id: admin.id,
         state_id: stateId,
         message: 'Estado de usuario actualizado correctamente'
      };
   }

   // buscar un admin por ID
   async findOne(id) {
      const admin = await models.SuperAdmin.findByPk(id, {
         attributes: { exclude: ['password_hash', 'two_factor_secret'] }
      });
      if (!admin) {
         throw boom.notFound('Administrador no encontrado');
      }
      return admin;
   }

   // Actualizar datos del perfil (Permite name, last_name, phone)
   async update(id, changes) {
      const admin = await this.findOne(id);

      // Filtramos campos sensibles para que no se puedan inyectar por aquí
      const { password, password_hash, username, id: _id, ...allowedChanges } = changes;

      const updatedAdmin = await admin.update(allowedChanges);

      // Retornamos sin hash
      const rta = updatedAdmin.toJSON();
      delete rta.password_hash;
      return rta;
   }

   // actualiza el tema del super admin
   async updateTheme(superAdminId, theme) {
      const superAdmin = await this.findOne(superAdminId);
      if (!superAdmin) return null;

      superAdmin.theme = theme;
      await superAdmin.save();

      return superAdmin;
   }

   async getOrCreateScopedAdmin(superAdminId, { transaction } = {}) {
      const parsedSuperAdminId = Number(superAdminId);
      if (!Number.isInteger(parsedSuperAdminId) || parsedSuperAdminId <= 0) {
         throw boom.badRequest('id de administrador invalido');
      }

      const superAdmin = await models.SuperAdmin.findByPk(parsedSuperAdminId, {
         attributes: ['id', 'username', 'email', 'password_hash', 'state_id'],
         transaction
      });
      if (!superAdmin) throw boom.notFound('administrador no encontrado');

      let admin = await models.Admin.findOne({
         where: { super_admin_id: parsedSuperAdminId },
         transaction
      });

      if (!admin) {
         admin = await models.Admin.create({
            super_admin_id: parsedSuperAdminId,
            username: `superadmin_${parsedSuperAdminId}`,
            email: `superadmin_${parsedSuperAdminId}@leins.local`,
            password_hash: superAdmin.password_hash,
            state_id: superAdmin.state_id || 1
         }, { transaction });
      }

      return admin;
   }

   async hasAnyEntityScope(superAdminId, { transaction } = {}) {
      const row = await models.AdminEntity.findOne({
         attributes: ['id'],
         include: [{
            model: models.Admin,
            as: 'admin',
            attributes: [],
            required: true,
            where: { super_admin_id: Number(superAdminId) },
         }],
         raw: true,
         transaction
      });

      return Boolean(row);
   }

   // action: null (existencia), 'delete' (requiere can_delete o is_admin),
   // 'manage_admins' (requiere is_admin - delegar la entidad a otros admins)
   async canActorManageEntity({ actorId, entityId, action = null, transaction } = {}) {
      const parsedActorId = Number(actorId);
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedActorId) || parsedActorId <= 0) return false;
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) return false;

      const hasScope = await this.hasAnyEntityScope(parsedActorId, { transaction });
      if (!hasScope) return true;

      const row = await models.AdminEntity.findOne({
         attributes: ['id', 'can_delete', 'is_admin'],
         where: { entity_id: parsedEntityId },
         include: [{
            model: models.Admin,
            as: 'admin',
            attributes: [],
            required: true,
            where: { super_admin_id: parsedActorId },
         }],
         raw: true,
         transaction
      });

      if (!row) return false;
      if (action === 'delete') return Boolean(row.is_admin || row.can_delete);
      if (action === 'manage_admins') return Boolean(row.is_admin);
      return true;
   }

   normalizeAssignmentFlags(payload = {}) {
      return {
         can_create: Boolean(payload.can_create ?? payload.canCreate ?? true),
         can_update: Boolean(payload.can_update ?? payload.canUpdate ?? true),
         can_delete: Boolean(payload.can_delete ?? payload.canDelete ?? false),
         is_admin: Boolean(payload.is_admin ?? payload.isAdmin ?? false),
      };
   }

   mapAssignmentRow(row, extra = {}) {
      if (!row) return null;
      return {
         id: Number(row.id),
         admin_id: Number(row.admin_id),
         entity_id: Number(row.entity_id),
         can_create: Boolean(row.can_create),
         can_update: Boolean(row.can_update),
         can_delete: Boolean(row.can_delete),
         is_admin: Boolean(row.is_admin),
         can_manage: extra.can_manage === undefined ? true : Boolean(extra.can_manage),
         created_at: row.createdAt || row.created_at || null,
         entity: {
            id: Number(row['entity.id'] || row.entity_id),
            name: row['entity.legal_name'] || null,
            legal_name: row['entity.legal_name'] || null,
            rut: row['entity.tax_id'] || null,
            tax_id: row['entity.tax_id'] || null,
            state_id: row['entity.state_id'] == null ? null : Number(row['entity.state_id']),
         }
      };
   }

   async listEntityAssignments(superAdminId, { actorId = null } = {}) {
      const admin = await models.Admin.findOne({
         where: { super_admin_id: Number(superAdminId) },
         attributes: ['id'],
         raw: true
      });

      if (!admin) return { ok: true, total: 0, rows: [] };

      const rows = await models.AdminEntity.findAll({
         where: { admin_id: admin.id },
         include: [{
            model: models.Entity,
            as: 'entity',
            attributes: ['id', 'legal_name', 'tax_id', 'state_id'],
            required: true,
         }],
         order: [[{ model: models.Entity, as: 'entity' }, 'legal_name', 'ASC']],
         raw: true
      });

      const mappedRows = await Promise.all(rows.map(async (row) => {
         const canManage = actorId
            ? await this.canActorManageEntity({ actorId, entityId: row.entity_id, action: 'manage_admins' })
            : false;

         return this.mapAssignmentRow(row, { can_manage: canManage });
      }));

      return {
         ok: true,
         total: rows.length,
         rows: mappedRows
      };
   }

   async listAssignableEntities({ actorId, q = null, limit = 100, offset = 0, activeOnly = true } = {}) {
      const parsedActorId = Number(actorId);
      if (!Number.isInteger(parsedActorId) || parsedActorId <= 0) {
         throw boom.unauthorized('usuario autenticado invalido');
      }

      const hasScope = await this.hasAnyEntityScope(parsedActorId);
      const where = {};
      if (activeOnly) where.state_id = Number(process.env.ACTIVE_STATE_ID || 1);
      if (q && String(q).trim()) {
         where[Op.or] = [
            { legal_name: { [Op.like]: `%${String(q).trim()}%` } },
            { tax_id: { [Op.like]: `%${String(q).trim()}%` } }
         ];
      }

      // solo entidades donde el actor puede delegar (is_admin=true en admin_entities)
      const include = hasScope
         ? [{
            model: models.Admin,
            as: 'admins',
            attributes: [],
            required: true,
            where: { super_admin_id: parsedActorId },
            through: { attributes: [], where: { is_admin: true } }
         }]
         : [];

      const { count, rows } = await models.Entity.findAndCountAll({
         where,
         include,
         attributes: ['id', 'legal_name', 'tax_id', 'state_id'],
         distinct: true,
         order: [['legal_name', 'ASC']],
         limit: Math.min(Math.max(Number(limit) || 100, 1), 200),
         offset: Math.max(Number(offset) || 0, 0),
      });

      return {
         ok: true,
         total: Number(count || 0),
         rows: rows.map((row) => {
            const json = row.toJSON();
            return {
               id: Number(json.id),
               name: json.legal_name,
               legal_name: json.legal_name,
               rut: json.tax_id,
               tax_id: json.tax_id,
               state_id: Number(json.state_id || 0),
               can_manage: true
            };
         })
      };
   }

   async assignEntity({ superAdminId, entityId, actorId, flags = {} } = {}) {
      return await sequelize.transaction(async (transaction) => {
         const entity = await models.Entity.findByPk(Number(entityId), {
            attributes: ['id'],
            transaction
         });
         if (!entity) throw boom.notFound('entidad no encontrada');

         const canManage = await this.canActorManageEntity({ actorId, entityId, action: 'manage_admins', transaction });
         if (!canManage) throw boom.forbidden('no puedes asignar una entidad que no administras (se requiere ser administrador de la entidad)');

         const admin = await this.getOrCreateScopedAdmin(superAdminId, { transaction });
         const payload = this.normalizeAssignmentFlags(flags);

         const existing = await models.AdminEntity.findOne({
            where: { admin_id: admin.id, entity_id: Number(entityId) },
            transaction
         });

         const row = existing
            ? await existing.update(payload, { transaction })
            : await models.AdminEntity.create({
               admin_id: admin.id,
               entity_id: Number(entityId),
               ...payload
            }, { transaction });

         return {
            ok: true,
            row: {
               id: row.id,
               admin_id: row.admin_id,
               entity_id: row.entity_id,
               ...payload
            }
         };
      });
   }

   async removeEntityAssignment({ superAdminId, entityId, actorId } = {}) {
      return await sequelize.transaction(async (transaction) => {
         const canManage = await this.canActorManageEntity({ actorId, entityId, action: 'manage_admins', transaction });
         if (!canManage) throw boom.forbidden('no puedes quitar una entidad que no administras (se requiere ser administrador de la entidad)');

         const admin = await models.Admin.findOne({
            where: { super_admin_id: Number(superAdminId) },
            transaction
         });
         if (!admin) throw boom.notFound('asignacion no encontrada');

         const row = await models.AdminEntity.findOne({
            where: { admin_id: admin.id, entity_id: Number(entityId) },
            transaction
         });
         if (!row) throw boom.notFound('asignacion no encontrada');

         await row.destroy({ transaction });
         return { ok: true, entity_id: Number(entityId), removed: true };
      });
   }

   // ==========================================
   //  clientes (tabla `users`): cuentas de autogestion para entidades
      // ==========================================
   //  GESTIÓN DE CLIENTES (USERS) Y PERMISOS
   // ==========================================

   mapClientUserRow(row) {
      const entityLinks = row.entities || row.user_entities || [];
      const assignedEntities = Array.isArray(entityLinks)
         ? entityLinks.map(e => ({
            id: Number(e.id || e.entity_id),
            name: e.legal_name || e.name || (e.entity && e.entity.legal_name) || `Entidad ${e.id || e.entity_id}`,
            rut: e.tax_id || (e.entity && e.entity.tax_id) || '',
            read_only: e.read_only !== undefined ? Boolean(e.read_only) : (e.UserEntity ? Boolean(e.UserEntity.read_only) : true),
            permissions: e.permissions || (e.UserEntity ? e.UserEntity.permissions : null),
         }))
         : [];

      return {
         id: Number(row.id),
         username: row.username,
         email: row.email,
         name: row.name || null,
         last_name: row.last_name || null,
         state_id: Number(row.state_id || 1),
         created_at: row.created_at || row.createdAt || null,
         permissions: sanitizePermissions(row.permissions),
         entities: assignedEntities,
         entities_count: assignedEntities.length,
      };
   }

   getPermissionsCatalog() {
      return {
         modules: PERMISSION_MODULES,
         presets: {
            READ_ONLY: getPresetPermissions('READ_ONLY'),
            OPERATIVE_STANDARD: getPresetPermissions('OPERATIVE_STANDARD'),
            FULL_ACCESS: getPresetPermissions('FULL_ACCESS'),
            CLEAR_ALL: getPresetPermissions('CLEAR_ALL'),
         }
      };
   }

   async listClientUsers({ actorId, entityId, search, page = 1, limit = 10 } = {}) {
      const offset = (Number(page) - 1) * Number(limit);
      const parsedLimit = Number(limit) || 10;
      const parsedEntityId = entityId ? Number(entityId) : null;

      const whereUser = {};
      if (search && String(search).trim() !== '') {
         const cleanSearch = `%${String(search).trim()}%`;
         whereUser[Op.or] = [
            { username: { [Op.like]: cleanSearch } },
            { email: { [Op.like]: cleanSearch } },
            { name: { [Op.like]: cleanSearch } },
            { last_name: { [Op.like]: cleanSearch } },
         ];
      }

      if (parsedEntityId) {
         const canManage = await this.canActorManageEntity({ actorId, entityId: parsedEntityId });
         if (!canManage) throw boom.forbidden('no puedes ver clientes de una entidad que no administras');

         const { count, rows } = await models.UserEntity.findAndCountAll({
            where: { entity_id: parsedEntityId },
            include: [{
               model: models.User,
               as: 'user',
               where: Object.keys(whereUser).length ? whereUser : undefined,
               attributes: ['id', 'username', 'email', 'name', 'last_name', 'state_id', 'permissions', 'created_at'],
            }, {
               model: models.Entity,
               as: 'entity',
               attributes: ['id', 'legal_name', 'tax_id'],
            }],
            order: [['id', 'DESC']],
            limit: parsedLimit,
            offset: offset >= 0 ? offset : 0,
         });

         return {
            ok: true,
            total: count,
            page: Number(page),
            limit: parsedLimit,
            rows: rows.map(r => ({
               id: Number(r.user.id),
               username: r.user.username,
               email: r.user.email,
               name: r.user.name,
               last_name: r.user.last_name,
               state_id: Number(r.user.state_id || 1),
               created_at: r.user.created_at,
               permissions: sanitizePermissions(r.permissions || r.user.permissions),
               read_only: Boolean(r.read_only),
               entity_id: r.entity_id,
               entities: [{
                  id: r.entity?.id || r.entity_id,
                  name: r.entity?.legal_name || `Entidad ${r.entity_id}`,
                  rut: r.entity?.tax_id || '',
                  read_only: Boolean(r.read_only),
                  permissions: r.permissions,
               }],
               entities_count: 1,
            }))
         };
      }

      const { count, rows } = await models.User.findAndCountAll({
         where: whereUser,
         attributes: ['id', 'username', 'email', 'name', 'last_name', 'state_id', 'permissions', 'created_at'],
         include: [{
            model: models.Entity,
            as: 'entities',
            attributes: ['id', 'legal_name', 'tax_id'],
            through: { attributes: ['id', 'read_only', 'permissions'] },
            required: false,
         }],
         distinct: true,
         order: [['id', 'DESC']],
         limit: parsedLimit,
         offset: offset >= 0 ? offset : 0,
      });

      return {
         ok: true,
         total: count,
         page: Number(page),
         limit: parsedLimit,
         rows: rows.map(u => this.mapClientUserRow(u)),
      };
   }

   async getClientUserById({ actorId, userId } = {}) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
         throw boom.badRequest('userId inválido');
      }

      const user = await models.User.findByPk(parsedUserId, {
         attributes: ['id', 'username', 'email', 'name', 'last_name', 'state_id', 'permissions', 'created_at'],
         include: [{
            model: models.Entity,
            as: 'entities',
            attributes: ['id', 'legal_name', 'tax_id'],
            through: { attributes: ['id', 'read_only', 'permissions'] },
            required: false,
         }],
      });

      if (!user) throw boom.notFound('Cliente no encontrado');
      return { ok: true, client: this.mapClientUserRow(user) };
   }

   async createClientUser({
      actorId,
      username,
      email,
      password,
      name = null,
      lastName = null,
      last_name = null,
      entityId = null,
      entity_id = null,
      entityIds = [],
      entity_ids = [],
      permissions = null,
      preset = 'OPERATIVE_STANDARD',
      readOnly = false,
      read_only = false,
   } = {}) {
      if (!username || !email || !password) {
         throw boom.badRequest('username, email y password son obligatorios');
      }

      const cleanPermissions = permissions
         ? sanitizePermissions(permissions)
         : getPresetPermissions(preset);

      const targetEntityIds = [
         entityId,
         entity_id,
         ...(Array.isArray(entityIds) ? entityIds : []),
         ...(Array.isArray(entity_ids) ? entity_ids : []),
      ].filter(id => id != null && Number.isInteger(Number(id)) && Number(id) > 0).map(Number);
      const uniqueEntityIds = [...new Set(targetEntityIds)];

      return await sequelize.transaction(async (transaction) => {
         for (const eid of uniqueEntityIds) {
            const canManage = await this.canActorManageEntity({ actorId, entityId: eid, action: 'create', transaction });
            if (!canManage) throw boom.forbidden(`No tienes permiso para asignar la entidad ${eid}`);
         }

         const existsUsername = await models.User.findOne({ where: { username }, transaction });
         if (existsUsername) throw boom.conflict('Ya existe un usuario con ese username');

         const existsEmail = await models.User.findOne({ where: { email }, transaction });
         if (existsEmail) throw boom.conflict('Ya existe un usuario con ese email');

         const password_hash = await bcrypt.hash(password, 10);

         const user = await models.User.create({
            username: String(username).trim(),
            email: String(email).trim().toLowerCase(),
            password_hash,
            name: name || null,
            last_name: lastName || last_name || null,
            state_id: 1,
            permissions: cleanPermissions,
         }, { transaction });

         const isReadOnly = Boolean(readOnly || read_only);
         for (const eid of uniqueEntityIds) {
            await models.UserEntity.create({
               user_id: user.id,
               entity_id: eid,
               read_only: isReadOnly,
               permissions: cleanPermissions,
            }, { transaction });
         }

         const createdWithEntities = await models.User.findByPk(user.id, {
            include: [{
               model: models.Entity,
               as: 'entities',
               attributes: ['id', 'legal_name', 'tax_id'],
               through: { attributes: ['id', 'read_only', 'permissions'] },
            }],
            transaction,
         });

         return {
            ok: true,
            row: this.mapClientUserRow(createdWithEntities),
         };
      });
   }

   async updateClientUser({
      actorId,
      userId,
      username,
      email,
      name,
      lastName,
      last_name,
      password,
      permissions,
      entityIds,
      stateId,
      state_id,
   } = {}) {
      const parsedUserId = Number(userId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) throw boom.badRequest('userId inválido');

      return await sequelize.transaction(async (transaction) => {
         const user = await models.User.findByPk(parsedUserId, { transaction });
         if (!user) throw boom.notFound('Cliente no encontrado');

         const changes = {};

         if (username !== undefined && username !== user.username) {
            const existsUsername = await models.User.findOne({
               where: { username, id: { [Op.ne]: parsedUserId } },
               transaction,
            });
            if (existsUsername) throw boom.conflict('Ya existe un usuario con ese username');
            changes.username = String(username).trim();
         }

         if (email !== undefined && email !== user.email) {
            const existsEmail = await models.User.findOne({
               where: { email: String(email).trim().toLowerCase(), id: { [Op.ne]: parsedUserId } },
               transaction,
            });
            if (existsEmail) throw boom.conflict('Ya existe un usuario con ese email');
            changes.email = String(email).trim().toLowerCase();
         }

         if (name !== undefined) changes.name = name || null;
         if (lastName !== undefined || last_name !== undefined) {
            changes.last_name = lastName || last_name || null;
         }

         const finalState = stateId !== undefined ? stateId : state_id;
         if (finalState !== undefined && [1, 2].includes(Number(finalState))) {
            changes.state_id = Number(finalState);
         }

         if (password !== undefined && password !== null && String(password).trim().length > 0) {
            const cleanPass = String(password).trim();
            if (cleanPass.length < 6) throw boom.badRequest('La clave debe tener al menos 6 caracteres');
            changes.password_hash = await bcrypt.hash(cleanPass, 10);
         }

         if (permissions !== undefined && permissions !== null && typeof permissions === 'object') {
            changes.permissions = sanitizePermissions(permissions);
         }

         if (Object.keys(changes).length) {
            await user.update(changes, { transaction });
         }

         if (Array.isArray(entityIds)) {
            const cleanEntityIds = entityIds.map(Number).filter(id => Number.isInteger(id) && id > 0);
            await models.UserEntity.destroy({
               where: {
                  user_id: parsedUserId,
                  ...(cleanEntityIds.length ? { entity_id: { [Op.notIn]: cleanEntityIds } } : {})
               },
               transaction,
            });

            for (const eid of cleanEntityIds) {
               const existing = await models.UserEntity.findOne({
                  where: { user_id: parsedUserId, entity_id: eid },
                  transaction,
               });
               if (!existing) {
                  await models.UserEntity.create({
                     user_id: parsedUserId,
                     entity_id: eid,
                     read_only: false,
                     permissions: changes.permissions || user.permissions,
                  }, { transaction });
               }
            }
         }

         const updated = await models.User.findByPk(parsedUserId, {
            include: [{
               model: models.Entity,
               as: 'entities',
               attributes: ['id', 'legal_name', 'tax_id'],
               through: { attributes: ['id', 'read_only', 'permissions'] },
            }],
            transaction,
         });

         return {
            ok: true,
            row: this.mapClientUserRow(updated),
         };
      });
   }

   async changeClientUserState({ actorId, userId, stateId } = {}) {
      const parsedUserId = Number(userId);
      const parsedState = Number(stateId);
      if (![1, 2].includes(parsedState)) throw boom.badRequest('stateId debe ser 1 (activo) o 2 (suspendido)');

      const user = await models.User.findByPk(parsedUserId);
      if (!user) throw boom.notFound('Cliente no encontrado');

      user.state_id = parsedState;
      await user.save();

      return { ok: true, user_id: parsedUserId, state_id: parsedState };
   }

   async deleteClientUser({ actorId, userId } = {}) {
      const parsedUserId = Number(userId);
      const user = await models.User.findByPk(parsedUserId);
      if (!user) throw boom.notFound('Cliente no encontrado');

      await sequelize.transaction(async (transaction) => {
         await models.UserEntity.destroy({ where: { user_id: parsedUserId }, transaction });
         await models.RefreshTokenUser.destroy({ where: { user_id: parsedUserId }, transaction });
         await user.destroy({ transaction });
      });

      return { ok: true, id: parsedUserId };
   }

   async getClientUserPermissions({ actorId, userId, entityId = null } = {}) {
      const parsedUserId = Number(userId);
      const user = await models.User.findByPk(parsedUserId);
      if (!user) throw boom.notFound('Cliente no encontrado');

      if (entityId) {
         const link = await models.UserEntity.findOne({
            where: { user_id: parsedUserId, entity_id: Number(entityId) },
         });
         return {
            ok: true,
            userId: parsedUserId,
            entityId: Number(entityId),
            permissions: sanitizePermissions(link?.permissions || user.permissions),
            isCustomEntity: Boolean(link?.permissions),
         };
      }

      return {
         ok: true,
         userId: parsedUserId,
         entityId: null,
         permissions: sanitizePermissions(user.permissions),
      };
   }

   async updateClientUserPermissions({ actorId, userId, entityId = null, permissions } = {}) {
      const parsedUserId = Number(userId);
      const user = await models.User.findByPk(parsedUserId);
      if (!user) throw boom.notFound('Cliente no encontrado');

      const cleanPerms = sanitizePermissions(permissions);

      if (entityId) {
         const link = await models.UserEntity.findOne({
            where: { user_id: parsedUserId, entity_id: Number(entityId) },
         });
         if (!link) throw boom.notFound('El cliente no está vinculado a esta entidad');

         link.permissions = cleanPerms;
         const hasAnyWrite = Object.values(cleanPerms).some(m =>
            Object.entries(m).some(([k, v]) => !k.includes('view') && v === true)
         );
         link.read_only = !hasAnyWrite;
         await link.save();

         return {
            ok: true,
            userId: parsedUserId,
            entityId: Number(entityId),
            permissions: cleanPerms,
         };
      }

      user.permissions = cleanPerms;
      await user.save();

      await models.UserEntity.update(
         { permissions: cleanPerms },
         { where: { user_id: parsedUserId } }
      );

      return {
         ok: true,
         userId: parsedUserId,
         entityId: null,
         permissions: cleanPerms,
      };
   }

   async updateClientUserEntityAccess({ actorId, userId, entityId, readOnly, permissions } = {}) {
      const parsedUserId = Number(userId);
      const parsedEntityId = Number(entityId);
      const link = await models.UserEntity.findOne({
         where: { user_id: parsedUserId, entity_id: parsedEntityId },
      });
      if (!link) throw boom.notFound('El cliente no está vinculado a esta entidad');

      if (permissions) {
         link.permissions = sanitizePermissions(permissions);
      }
      if (readOnly !== undefined) {
         link.read_only = Boolean(readOnly);
      }
      await link.save();

      return { ok: true, user_id: parsedUserId, entity_id: parsedEntityId, read_only: link.read_only };
   }

   // crea un super admin
   async create(payload) {
      const {
         username,
         email,
         password,
         state_id,
         name,
         last_name,
         phone,
         avatar_url,
         theme,
         verified,
         two_factor_enabled,
      } = payload;

      // validaciones básicas
      if (!username || !email || !password) {
         throw boom.badRequest('username, email y password son obligatorios');
      }

      // state_id requerido por el modelo; usa default 1 si no viene
      const finalStateId = Number.isFinite(Number(state_id)) ? Number(state_id) : 1;

      // check duplicados
      const exists = await models.SuperAdmin.findOne({
         where: { email }
      });
      if (exists) {
         throw boom.conflict('ya existe un super admin con ese email');
      }
      const existsUser = await models.SuperAdmin.findOne({
         where: { username }
      });
      if (existsUser) {
         throw boom.conflict('ya existe un super admin con ese username');
      }

      // hash de contraseña
      const password_hash = await bcrypt.hash(password, 10);

      // crea registro
      const created = await models.SuperAdmin.create({
         username,
         email,
         password_hash,
         state_id: finalStateId,
         name: name ?? null,
         last_name: last_name ?? null,
         phone: phone ?? null,
         avatar_url: avatar_url ?? null,
         theme: theme ?? null,
         verified: typeof verified === 'boolean' ? verified : false,
         two_factor_enabled: typeof two_factor_enabled === 'boolean' ? two_factor_enabled : false,
         last_login: null
      });

      // nunca retornar el hash
      const json = created.toJSON();
      delete json.password_hash;
      return json;
   }

   // cambiar contraseña (Estando logueado)
   async changePassword(id, oldPassword, newPassword) {
      // 1. Buscamos al usuario con su hash para comparar
      const admin = await models.SuperAdmin.findByPk(id);
      if (!admin) throw boom.notFound('Usuario no encontrado');

      // 2. Verificamos la contraseña actual
      const isMatch = await bcrypt.compare(oldPassword, admin.password_hash);
      if (!isMatch) {
         throw boom.unauthorized('La contraseña actual es incorrecta');
      }

      // 3. Hasheamos la nueva y guardamos
      const hash = await bcrypt.hash(newPassword, 10);
      await admin.update({ password_hash: hash });

      return { message: 'Contraseña actualizada correctamente' };
   }

   // elimina un usuario
   async delete(id) {
      const admin = await this.findOne(id);
      await admin.update({ state_id: 3 });
      console.log('paso');
      await admin.destroy();
      return { id };
   }

}

module.exports = SuperAdminService;
