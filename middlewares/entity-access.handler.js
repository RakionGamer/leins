const boom = require('@hapi/boom');
const { models } = require('../libs/sequelize');
const { config } = require('../config/config');

const ENTITY_KEYS = ['entityId', 'entity_id'];

function pickRawEntityId(obj = {}) {
   for (const key of ENTITY_KEYS) {
      if (obj?.[key] != null && String(obj[key]).trim() !== '') {
         return obj[key];
      }
   }
   return null;
}

function parsePositiveInt(raw, fieldLabel = 'entityId') {
   if (raw == null || String(raw).trim() === '') return null;
   const n = Number(raw);
   if (!Number.isInteger(n) || n <= 0) {
      throw boom.badRequest(`${fieldLabel} debe ser un entero positivo`);
   }
   return n;
}

function resolveEntityId(req) {
   const fromQueryRaw = pickRawEntityId(req.query || {});
   const fromBodyRaw = pickRawEntityId(req.body || {});
   const fromParamsRaw = pickRawEntityId(req.params || {});

   const candidates = [
      parsePositiveInt(fromQueryRaw, 'entityId (query)'),
      parsePositiveInt(fromBodyRaw, 'entityId (body)'),
      parsePositiveInt(fromParamsRaw, 'entityId (params)'),
   ].filter(v => v != null);

   if (!candidates.length) {
      throw boom.badRequest('entityId es requerido en query, body o params');
   }

   const unique = [...new Set(candidates)];
   if (unique.length > 1) {
      throw boom.badRequest('entityId conflictivo entre query/body/params');
   }

   return unique[0];
}

async function hasUserEntityAccess({ userId, entityId }) {
   const row = await models.UserEntity.findOne({
      attributes: ['id'],
      where: { user_id: userId, entity_id: entityId },
      raw: true,
   });
   return Boolean(row);
}

async function hasScopedAdminEntityAccess({ superAdminId, entityId }) {
   const row = await models.AdminEntity.findOne({
      attributes: ['id'],
      where: { entity_id: entityId },
      include: [{
         model: models.Admin,
         as: 'admin',
         attributes: [],
         required: true,
         where: { super_admin_id: superAdminId },
      }],
      raw: true,
   });
   return Boolean(row);
}

async function hasAnyScopedEntityForSuperAdmin(superAdminId) {
   const row = await models.AdminEntity.findOne({
      attributes: ['id'],
      include: [{
         model: models.Admin,
         as: 'admin',
         attributes: [],
         required: true,
         where: { super_admin_id: superAdminId },
      }],
      raw: true,
   });
   return Boolean(row);
}

async function isSuperAdminUser(userId) {
   const row = await models.SuperAdmin.findByPk(userId, {
      attributes: ['id'],
      raw: true,
   });
   return Boolean(row);
}

function requireEntityAccess() {
   return async (req, _res, next) => {
      try {
         const entityId = resolveEntityId(req);

         // Normalizamos para que controladores/servicios usen el mismo scope.
         req.entityId = entityId;
         if (req.query && typeof req.query === 'object') req.query.entityId = String(entityId);
         if (req.body && typeof req.body === 'object') req.body.entityId = entityId;

         const entity = await models.Entity.findByPk(entityId, {
            attributes: ['id'],
            raw: true,
         });
         if (!entity) throw boom.notFound('entidad no encontrada');

         const actorId = Number(req.user?.sub ?? req.user?.id);
         if (!Number.isInteger(actorId) || actorId <= 0) {
            throw boom.unauthorized('usuario autenticado invalido');
         }

         const [userAccess, scopedAdminAccess] = await Promise.all([
            hasUserEntityAccess({ userId: actorId, entityId }),
            hasScopedAdminEntityAccess({ superAdminId: actorId, entityId }),
         ]);

         if (userAccess || scopedAdminAccess) return next();

         // Super admin sin scoping solo entra si se habilita explícitamente por env.
         const isSuperAdmin = await isSuperAdminUser(actorId);
         if (isSuperAdmin) {
            const hasScopedEntities = await hasAnyScopedEntityForSuperAdmin(actorId);
            if (!hasScopedEntities && config.allowUnscopedSuperAdminEntityAccess) return next();
         }

         throw boom.forbidden('no tienes acceso a la entidad solicitada');
      } catch (err) {
         next(err);
      }
   };
}

function requireSiiDocumentEntityAccess() {
   const ensureEntityAccess = requireEntityAccess();

   return async (req, res, next) => {
      try {
         const documentId = parsePositiveInt(req.params?.id, 'id documento');
         const doc = await models.EntitySiiDocument.findByPk(documentId, {
            attributes: ['id', 'entity_id'],
            raw: true,
         });

         if (!doc) throw boom.notFound('documento no encontrado');

         req.entityId = Number(doc.entity_id);
         if (req.params && typeof req.params === 'object') {
            req.params.entityId = String(doc.entity_id);
         }

         return ensureEntityAccess(req, res, next);
      } catch (err) {
         next(err);
      }
   };
}

module.exports = {
   requireEntityAccess,
   requireSiiDocumentEntityAccess,
};
