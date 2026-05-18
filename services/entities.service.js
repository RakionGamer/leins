const boom = require('@hapi/boom');
const { sequelize, models } = require('../libs/sequelize');
const { Op, QueryTypes } = require('sequelize');

const SORT_COLUMNS = {
   id: 'e.id',
   name: 'e.legal_name',
   rut: 'e.tax_id',
};

const ENTITY_RELATION_CHECKS = [
   { modelKey: 'EntityBankAccount', foreignKey: 'entity_id', label: 'cuentas bancarias' },
   { modelKey: 'EntitySiiDocument', foreignKey: 'entity_id', label: 'documentos SII' },
   { modelKey: 'EntityBankTransaction', foreignKey: 'entity_id', label: 'movimientos bancarios' },
   { modelKey: 'EntityCashFlowProjection', foreignKey: 'entity_id', label: 'proyecciones de flujo de caja' },
   { modelKey: 'Credential', foreignKey: 'entity_id', label: 'credenciales' },
   { modelKey: 'EntityModule', foreignKey: 'entity_id', label: 'modulos asociados' },
   { modelKey: 'AdminEntity', foreignKey: 'entity_id', label: 'vinculos con administradores' },
   { modelKey: 'UserEntity', foreignKey: 'entity_id', label: 'vinculos con usuarios' },
];

function normalizeOrder(value) {
   return String(value || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
}

function normalizeSort(value) {
   const key = String(value || 'name').toLowerCase();
   return SORT_COLUMNS[key] || SORT_COLUMNS.name;
}

function normalizeRut(value) {
   return String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function isValidRut(cleanRut) {
   if (!/^\d+[0-9K]$/.test(cleanRut || '')) return false;

   const body = cleanRut.slice(0, -1);
   const dv = cleanRut.slice(-1);

   let sum = 0;
   let multiplier = 2;

   for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier < 7 ? multiplier + 1 : 2;
   }

   const expected = 11 - (sum % 11);
   const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);

   return dv === expectedDv;
}

function formatRut(cleanRut) {
   const dv = cleanRut.slice(-1);
   const body = cleanRut.slice(0, -1);
   const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${bodyWithDots}-${dv}`;
}

function sanitizeRut(value) {
   const raw = String(value || '').trim();
   if (!raw) throw boom.badRequest('rut de entidad requerido');

   const cleanRut = normalizeRut(raw);
   if (cleanRut.length < 2 || !isValidRut(cleanRut)) {
      throw boom.badRequest('rut de entidad invalido');
   }

   return formatRut(cleanRut);
}

async function assertEntityUnique({ legalName, taxId, excludeId = null, transaction = null } = {}) {
   const where = {
      [Op.or]: [
         { legal_name: legalName },
         { tax_id: taxId }
      ]
   };

   if (excludeId) {
      where.id = { [Op.ne]: Number(excludeId) };
   }

   const existing = await models.Entity.findOne({
      attributes: ['id', 'legal_name', 'tax_id'],
      where,
      transaction,
      raw: true
   });

   if (!existing) return;
   if (String(existing.tax_id) === String(taxId)) {
      throw boom.conflict('ya existe una entidad registrada con ese RUT');
   }
   if (String(existing.legal_name).toLowerCase() === String(legalName).toLowerCase()) {
      throw boom.conflict('ya existe una entidad registrada con ese nombre');
   }

   throw boom.conflict('ya existe una entidad registrada con esos datos');
}

function buildEntityFilters({ q, activeOnly, id, activeStateId }) {
   const chunks = [];
   const params = {};

   if (q) {
      chunks.push(`
         AND (e.legal_name LIKE CONCAT('%', :q, '%')
         OR e.tax_id LIKE CONCAT('%', :q, '%'))
      `);
      params.q = q;
   }

   if (Number.isInteger(id) && id > 0) {
      chunks.push('AND e.id = :id');
      params.id = id;
   }

   if (activeOnly) {
      chunks.push('AND e.state_id = :activeStateId');
      params.activeStateId = activeStateId;
   }

   return {
      whereSql: chunks.join('\n'),
      params
   };
}

function mapEntityRow(row) {
   if (!row) return null;
   return {
      id: Number(row.id),
      name: row.name || row.legal_name,
      rut: row.rut || row.tax_id,
      legal_name: row.legal_name || row.name || null,
      state_id: Number(row.state_id || 0),
   };
}

class EntitiesService {
   async listAll({ q = null, limit = 20, offset = 0, activeOnly = false, id = null, sort = 'name', order = 'asc' } = {}) {
      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);
      const sortColumn = normalizeSort(sort);
      const sortOrder = normalizeOrder(order);
      const parsedId = Number.isInteger(Number(id)) ? Number(id) : null;
      const filters = buildEntityFilters({
         q,
         activeOnly,
         id: parsedId,
         activeStateId: ACTIVE_STATE_ID
      });

      const sql = `
         SELECT e.id, e.legal_name AS name, e.legal_name, e.tax_id AS rut, e.tax_id, e.state_id
         FROM entities e
         WHERE 1=1
         ${filters.whereSql}
         ORDER BY ${sortColumn} ${sortOrder}
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `
         SELECT COUNT(*) AS total
         FROM entities e
         WHERE 1=1
         ${filters.whereSql}
      `;

      const params = { ...filters.params, limit, offset };
      const [{ total }] = await sequelize.query(sqlCount, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rowsRaw = await sequelize.query(sql, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rows = rowsRaw.map(mapEntityRow);

      return { ok: true, total: Number(total || 0), limit, offset, rows };
   }

   async listForUser({ userId, q = null, limit = 20, offset = 0, activeOnly = false, id = null, sort = 'name', order = 'asc' } = {}) {
      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);
      const sortColumn = normalizeSort(sort);
      const sortOrder = normalizeOrder(order);
      const parsedId = Number.isInteger(Number(id)) ? Number(id) : null;

      if (!userId) throw boom.badRequest('userId is required');

      const filters = buildEntityFilters({
         q,
         activeOnly,
         id: parsedId,
         activeStateId: ACTIVE_STATE_ID
      });

      const baseJoin = `
         FROM entities e
         JOIN user_entities ue ON ue.entity_id = e.id
         WHERE ue.user_id = :userId
         ${filters.whereSql}
      `;
      const sql = `
         SELECT e.id, e.legal_name AS name, e.legal_name, e.tax_id AS rut, e.tax_id, e.state_id
         ${baseJoin}
         ORDER BY ${sortColumn} ${sortOrder}
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `SELECT COUNT(*) AS total ${baseJoin}`;

      const params = { userId, ...filters.params, limit, offset };
      const [{ total }] = await sequelize.query(sqlCount, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rowsRaw = await sequelize.query(sql, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rows = rowsRaw.map(mapEntityRow);

      return { ok: true, total: Number(total || 0), limit, offset, rows };
   }

   async hasSuperAdminEntityScope(superAdminId) {
      const parsedSuperAdminId = Number(superAdminId);
      if (!Number.isInteger(parsedSuperAdminId) || parsedSuperAdminId <= 0) return false;

      const row = await models.AdminEntity.findOne({
         attributes: ['id'],
         include: [{
            model: models.Admin,
            as: 'admin',
            attributes: [],
            required: true,
            where: { super_admin_id: parsedSuperAdminId },
         }],
         raw: true,
      });

      return Boolean(row);
   }

   async listForSuperAdmin({ superAdminId, q = null, limit = 20, offset = 0, activeOnly = false, id = null, sort = 'name', order = 'asc' } = {}) {
      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);
      const sortColumn = normalizeSort(sort);
      const sortOrder = normalizeOrder(order);
      const parsedId = Number.isInteger(Number(id)) ? Number(id) : null;

      if (!superAdminId) throw boom.badRequest('superAdminId is required');

      const filters = buildEntityFilters({
         q,
         activeOnly,
         id: parsedId,
         activeStateId: ACTIVE_STATE_ID
      });

      const baseJoin = `
         FROM entities e
         JOIN admin_entities ae ON ae.entity_id = e.id
         JOIN admins a ON a.id = ae.admin_id
         WHERE a.super_admin_id = :superAdminId
         ${filters.whereSql}
      `;
      const sql = `
         SELECT DISTINCT e.id, e.legal_name AS name, e.legal_name, e.tax_id AS rut, e.tax_id, e.state_id
         ${baseJoin}
         ORDER BY ${sortColumn} ${sortOrder}
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `
         SELECT COUNT(DISTINCT e.id) AS total
         ${baseJoin}
      `;

      const params = { superAdminId, ...filters.params, limit, offset };
      const [{ total }] = await sequelize.query(sqlCount, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rowsRaw = await sequelize.query(sql, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rows = rowsRaw.map(mapEntityRow);

      return { ok: true, total: Number(total || 0), limit, offset, rows };
   }

   async create({ name, rut, stateId = null, actorId = null } = {}) {
      const legalName = String(name || '').trim();
      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);

      if (!legalName) throw boom.badRequest('nombre de entidad requerido');
      const taxId = sanitizeRut(rut);

      return await sequelize.transaction(async (transaction) => {
         await assertEntityUnique({ legalName, taxId, transaction });

         const created = await models.Entity.create({
            legal_name: legalName,
            tax_id: taxId,
            state_id: Number.isInteger(Number(stateId)) && Number(stateId) > 0
               ? Number(stateId)
               : ACTIVE_STATE_ID
         }, { transaction });

         await this.ensureSuperAdminEntityAccess({
            superAdminId: actorId,
            entityId: created.id,
            transaction
         });

         return mapEntityRow(created.toJSON());
      });
   }

   async update(id, { name, rut, stateId } = {}) {
      const entityId = Number(id);
      if (!Number.isInteger(entityId) || entityId <= 0) {
         throw boom.badRequest('id de entidad invalido');
      }

      const entity = await models.Entity.findByPk(entityId);
      if (!entity) throw boom.notFound('entidad no encontrada');

      const changes = {};
      if (name !== undefined) {
         const legalName = String(name || '').trim();
         if (!legalName) throw boom.badRequest('nombre de entidad requerido');
         changes.legal_name = legalName;
      }
      if (rut !== undefined) {
         changes.tax_id = sanitizeRut(rut);
      }
      if (changes.legal_name || changes.tax_id) {
         await assertEntityUnique({
            legalName: changes.legal_name || entity.legal_name,
            taxId: changes.tax_id || entity.tax_id,
            excludeId: entityId
         });
      }
      if (stateId !== undefined && stateId !== null && String(stateId).trim() !== '') {
         const parsedState = Number(stateId);
         if (!Number.isInteger(parsedState) || parsedState <= 0) {
            throw boom.badRequest('state_id invalido');
         }
         changes.state_id = parsedState;
      }
      changes.updated_at = new Date();

      await entity.update(changes);
      return mapEntityRow(entity.toJSON());
   }

   async ensureSuperAdminEntityAccess({ superAdminId, entityId, transaction } = {}) {
      const parsedSuperAdminId = Number(superAdminId);
      const parsedEntityId = Number(entityId);

      if (!Number.isInteger(parsedSuperAdminId) || parsedSuperAdminId <= 0) return;
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) return;

      const superAdmin = await models.SuperAdmin.findByPk(parsedSuperAdminId, {
         attributes: ['id', 'username', 'email', 'password_hash', 'state_id'],
         transaction
      });
      if (!superAdmin) return;

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
            state_id: superAdmin.state_id || Number(process.env.ACTIVE_STATE_ID || 1)
         }, { transaction });
      }

      const existing = await models.AdminEntity.findOne({
         where: {
            admin_id: admin.id,
            entity_id: parsedEntityId
         },
         transaction
      });

      if (existing) return;

      await models.AdminEntity.create({
         admin_id: admin.id,
         entity_id: parsedEntityId,
         can_create: true,
         can_update: true,
         can_delete: true,
         is_admin: true
      }, { transaction });
   }

   async countRelatedRecords(entityId) {
      const checks = ENTITY_RELATION_CHECKS
         .filter((cfg) => models[cfg.modelKey] && typeof models[cfg.modelKey].count === 'function')
         .map(async (cfg) => {
            const total = await models[cfg.modelKey].count({
               where: { [cfg.foreignKey]: entityId }
            });

            return {
               model: cfg.modelKey,
               label: cfg.label,
               count: Number(total || 0)
            };
         });

      const counts = await Promise.all(checks);
      return counts.filter((item) => item.count > 0);
   }

   async delete(id) {
      const entityId = Number(id);
      if (!Number.isInteger(entityId) || entityId <= 0) {
         throw boom.badRequest('id de entidad invalido');
      }

      const entity = await models.Entity.findByPk(entityId);
      if (!entity) throw boom.notFound('entidad no encontrada');

      const relatedRecords = await this.countRelatedRecords(entityId);
      if (relatedRecords.length > 0) {
         const INACTIVE_STATE_ID = Number(process.env.INACTIVE_STATE_ID || 2);
         const shouldDeactivate = Number(entity.state_id) !== INACTIVE_STATE_ID;

         if (shouldDeactivate) {
            await entity.update({
               state_id: INACTIVE_STATE_ID,
               updated_at: new Date()
            });
         }

         return {
            id: entityId,
            deleted: false,
            deactivated: true,
            state_id: INACTIVE_STATE_ID,
            blockedBy: relatedRecords,
            message: shouldDeactivate
               ? 'la entidad no se elimino porque tiene datos relacionados. fue desactivada automaticamente.'
               : 'la entidad no se elimino porque tiene datos relacionados y ya estaba desactivada.'
         };
      }

      await entity.destroy();
      return {
         id: entityId,
         deleted: true,
         deactivated: false
      };
   }
}

module.exports = EntitiesService;
