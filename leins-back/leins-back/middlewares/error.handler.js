// middlewares/error.handler.js
const { ValidationError, UniqueConstraintError } = require('sequelize');
const Boom = require('@hapi/boom');
const { logError } = require('../utils/logger');

function logErrors(err, req, res, next) {
   // log unificado con request id
   logError('HTTP_ERR', {
      rid: req.rid || '-',
      path: req.path,
      method: req.method,
      code: err?.data?.code || err?.output?.payload?.error || err?.name || 'UNKNOWN'
   });
   next(err);
}

function ormErrorHandler(err, req, res, next) {
   if (res.headersSent) return next(err);
   if (err instanceof UniqueConstraintError) {
      const fields = err.fields || {};
      const paths = (err.errors || []).map((item) => item.path).filter(Boolean);
      const keys = new Set([...Object.keys(fields), ...paths]);

      let message = 'ya existe un registro con esos datos';
      if (keys.has('tax_id')) message = 'ya existe una entidad registrada con ese RUT';
      else if (keys.has('legal_name')) message = 'ya existe una entidad registrada con ese nombre';
      else if (keys.has('email')) message = 'ya existe un usuario registrado con ese email';
      else if (keys.has('username')) message = 'ya existe un usuario registrado con ese nombre de usuario';

      return res.status(409).json({
         statusCode: 409,
         message,
         code: 'UNIQUE_CONSTRAINT',
         fields: [...keys]
      });
   }
   if (err instanceof ValidationError) {
      return res.status(409).json({
         statusCode: 409,
         message: 'los datos enviados no son validos',
         errors: err.errors
      });
   }
   return next(err);
}

function boomErrorHandler(err, req, res, next) {
   if (res.headersSent) return next(err);
   if (err.isBoom || Boom.isBoom?.(err)) {
      const { statusCode, payload, headers } = err.output;
      if (headers) res.set(headers);
      const extra = err.data && typeof err.data === 'object' ? err.data : null;
      return res.status(statusCode).json(extra ? { ...payload, ...extra } : payload);
   }
   return next(err);
}

function errorHandler(err, req, res, next) {
   if (res.headersSent) return next(err);
   const status = err.status || 500;
   const body = {
      statusCode: status,
      message: err.message || 'Internal Server Error'
   };
   if (process.env.NODE_ENV !== 'production') {
      body.stack = err.stack;
   }
   return res.status(status).json(body);
}

module.exports = {
   logErrors,
   ormErrorHandler,
   boomErrorHandler,
   errorHandler
};
