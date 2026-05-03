// middlewares/auth.handler.js
const jwt = require('jsonwebtoken');
const { config } = require('./../config/config');
const { models } = require('../libs/sequelize');

function jwtValidate(req, res, next) {
   const authHeader = req.headers.authorization || '';
   const [type, token] = authHeader.split(' ');

   // si no hay token, devolvemos 401 directo
   if (type?.toLowerCase() !== 'bearer' || !token) {
      return res.status(401).json({
         statusCode: 401,
         error: 'Unauthorized',
         message: 'missing or invalid authorization header',
         code: 'AUTH_HEADER_MISSING'
      });
   }

   try {
      const payload = jwt.verify(token, config.jwtAccessSecret);
      req.user = payload;
      req.userId = payload.sub;
      return next();
   } catch (e) {
      // si expiro, devolvemos 401 directo
      if (e?.name === 'TokenExpiredError') {
         return res.status(401).json({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'access token expired',
            code: 'TOKEN_EXPIRED'
         });
      }
      // cualquier otro error de jwt (alterado, malformado)
      return res.status(401).json({
         statusCode: 401,
         error: 'Unauthorized',
         message: 'invalid access token',
         code: 'TOKEN_INVALID'
      });
   }
}

async function resolveSuperAdminFlags(req) {
   const actorId = Number(req.userId || req.user?.sub || req.user?.id);
   req.isSuperAdmin = false;
   req.superAdminId = null;

   if (!Number.isInteger(actorId) || actorId <= 0) return;

   const found = await models.SuperAdmin.findByPk(actorId, {
      attributes: ['id', 'state_id'],
      raw: true
   });

   // consideramos super admin real si existe en tabla y esta activo
   if (found && Number(found.state_id) === 1) {
      req.isSuperAdmin = true;
      req.superAdminId = actorId;
   }
}

async function setSuperAdminContext(req, _res, next) {
   try {
      await resolveSuperAdminFlags(req);
      return next();
   } catch (err) {
      return next(err);
   }
}

async function isSuperAdmin(req, res, next) {
   try {
      await resolveSuperAdminFlags(req);
      if (!req.isSuperAdmin) {
         return res.status(403).json({
            statusCode: 403,
            error: 'Forbidden',
            message: 'solo super admin puede ejecutar esta accion',
            code: 'SUPER_ADMIN_REQUIRED'
         });
      }
      return next();
   } catch (err) {
      return next(err);
   }
}

module.exports = { 
   jwtValidate, 
   isSuperAdmin,
   setSuperAdminContext,
};
