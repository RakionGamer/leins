// middlewares/auth.handler.js
const jwt = require('jsonwebtoken');
const { config } = require('./../config/config');

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

module.exports = { jwtValidate };