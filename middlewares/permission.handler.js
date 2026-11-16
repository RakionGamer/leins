'use strict';

const boom = require('@hapi/boom');
const { models } = require('../libs/sequelize');
const { sanitizePermissions } = require('../utils/permissions.constants');

function resolveActorEntityId(req) {
   const fromProp = req.entityId;
   const fromQuery = req.query?.entityId || req.query?.entity_id;
   const fromBody = req.body?.entityId || req.body?.entity_id;
   const fromParams = req.params?.entityId || req.params?.entity_id;

   const val = fromProp || fromParams || fromQuery || fromBody;
   if (!val) return null;
   const n = Number(val);
   return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Middleware para exigir un permiso granular específico.
 * @param {string} moduleKey - Clave del módulo (ej. 'bank_movements')
 * @param {string} actionKey - Clave de la acción (ej. 'boletear', 'bank_sync')
 */
function requireEntityPermission(moduleKey, actionKey) {
   return async (req, res, next) => {
      try {
         const actorId = Number(req.userId || req.user?.sub || req.user?.id);
         if (!Number.isInteger(actorId) || actorId <= 0) {
            throw boom.unauthorized('Usuario autenticado no válido');
         }

         // 1. Super Administrador siempre tiene acceso total
         const superAdmin = await models.SuperAdmin.findByPk(actorId, {
            attributes: ['id', 'state_id'],
            raw: true
         });
         if (superAdmin && Number(superAdmin.state_id) === 1) {
            req.isSuperAdmin = true;
            return next();
         }

         // 2. Administrador con scoping (Admin)
         const scopedAdmin = await models.Admin.findOne({
            where: { super_admin_id: actorId },
            attributes: ['id'],
            raw: true
         });
         if (scopedAdmin) {
            return next();
         }

         // 3. Cliente: Resolver entidad activa
         const entityId = resolveActorEntityId(req);
         if (!entityId) {
            throw boom.badRequest('entityId es requerido para validar permisos');
         }

         const userEntity = await models.UserEntity.findOne({
            where: { user_id: actorId, entity_id: entityId },
            attributes: ['id', 'read_only', 'permissions'],
            raw: true
         });

         if (!userEntity) {
            throw boom.forbidden('No tienes acceso a la entidad seleccionada');
         }

         // Si la relación en user_entities define permisos específicos, usarlos
         let activePermissions = null;
         if (userEntity.permissions && typeof userEntity.permissions === 'object') {
            activePermissions = sanitizePermissions(userEntity.permissions);
         } else {
            // De lo contrario, buscar los permisos globales del usuario
            const user = await models.User.findByPk(actorId, {
               attributes: ['id', 'permissions', 'state_id'],
               raw: true
            });
            if (!user || user.state_id !== 1) {
               throw boom.unauthorized('Cuenta de usuario suspendida o inactiva');
            }
            activePermissions = sanitizePermissions(user.permissions);
         }

         const hasPermission = Boolean(activePermissions?.[moduleKey]?.[actionKey]);

         if (!hasPermission) {
            const err = boom.forbidden(
               `No tienes permiso para ejecutar '${actionKey}' en '${moduleKey}'`
            );
            err.output.payload.code = 'PERMISSION_DENIED';
            err.output.payload.requiredPermission = `${moduleKey}.${actionKey}`;
            throw err;
         }

         return next();
      } catch (err) {
         return next(err);
      }
   };
}

module.exports = {
   requireEntityPermission,
   resolveActorEntityId,
};
