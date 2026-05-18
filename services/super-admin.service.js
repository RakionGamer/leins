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

   async canActorManageEntity({ actorId, entityId, transaction } = {}) {
      const parsedActorId = Number(actorId);
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedActorId) || parsedActorId <= 0) return false;
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) return false;

      const hasScope = await this.hasAnyEntityScope(parsedActorId, { transaction });
      if (!hasScope) return true;

      const row = await models.AdminEntity.findOne({
         attributes: ['id'],
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

      return Boolean(row);
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
            ? await this.canActorManageEntity({ actorId, entityId: row.entity_id })
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

      const include = hasScope
         ? [{
            model: models.Admin,
            as: 'admins',
            attributes: [],
            required: true,
            where: { super_admin_id: parsedActorId },
            through: { attributes: [] }
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

         const canManage = await this.canActorManageEntity({ actorId, entityId, transaction });
         if (!canManage) throw boom.forbidden('no puedes asignar una entidad que no administras');

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
         const canManage = await this.canActorManageEntity({ actorId, entityId, transaction });
         if (!canManage) throw boom.forbidden('no puedes quitar una entidad que no administras');

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
