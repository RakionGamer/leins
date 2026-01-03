// middlewares/auth.handler.js
const jwt = require('jsonwebtoken');
const Boom = require('@hapi/boom');
const { config } = require('./../config/config');

function jwtValidate(req, res, next) {
   const authHeader = req.headers.authorization || '';
   const [type, token] = authHeader.split(' ');

   if (type?.toLowerCase() !== 'bearer' || !token) {
      const err = Boom.unauthorized('missing or invalid authorization header');
      err.data = { code: 'AUTH_HEADER_MISSING' };
      return next(err);
   }

   try {
      const payload = jwt.verify(token, config.jwtAccessSecret);
      req.user = payload;
      req.userId = payload.sub;
      return next();
   } catch (e) {
      if (e?.name === 'TokenExpiredError') {
         const err = Boom.unauthorized('access token expired');
         err.data = { code: 'TOKEN_EXPIRED' };
         return next(err);
      }
      const err = Boom.unauthorized('invalid access token');
      err.data = { code: 'TOKEN_INVALID' };
      return next(err);
   }
}

module.exports = { jwtValidate };