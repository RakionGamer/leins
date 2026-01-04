const express = require('express');
const boom = require('@hapi/boom');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const AuthService = require('./../services/auth.service');
const { config } = require('./../config/config');
const { jwtValidate } = require('./../middlewares/auth.handler');
const { logInfo } = require('../utils/logger');
const validatorHandler = require('./../middlewares/validator.handler');
const { loginSchema, recoverySchema, resetPasswordSchema } = require('./../schemas/auth.schema');

const router = express.Router();
const service = new AuthService();

// --- configuracion de limitadores (rate limiters) ---

const loginLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   max: 20,
   standardHeaders: true,
   legacyHeaders: false
});

const refreshLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 60,
   standardHeaders: true,
   legacyHeaders: false
});

const sessionsGetLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 60,
   standardHeaders: true,
   legacyHeaders: false
});

const sessionsWriteLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 30,
   standardHeaders: true,
   legacyHeaders: false
});

// --- helpers ---

// extrae userid (superadminid) de un access token expirado (opcional en /refresh)
function tryDecodeAccessToken(req) {
   const authHeader = req.headers.authorization || '';
   const [type, token] = authHeader.split(' ');
   if (type === 'Bearer' && token) {
      try {
         const payload = jwt.verify(token, config.jwtAccessSecret, { ignoreExpiration: true });
         return payload.sub;
      } catch (e) {
         return null;
      }
   }
   return null;
}

// ==========================================
//  rutas publicas: autenticacion basica
// ==========================================

// post /auth/login - iniciar sesion
router.post('/login',
   loginLimiter,
   validatorHandler(loginSchema, 'body'),
   async (req, res, next) => {
      try {
         const { username, password } = req.body;
         const meta = { rid: req.rid, ip: req.ip, userAgent: req.get('user-agent') || '-' };

         const { accessToken, refreshToken, user } = await service.login(username, password, meta);

         logInfo('AUTH_LOGIN_OK', { rid: req.rid, userId: user.id, ip: meta.ip, ua: meta.userAgent });

         return res.status(200).json({
            message: 'Login successful',
            data: {
               accessToken,
               refreshToken,
               user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  lastLogin: user.lastLogin,
                  theme: user.theme,
                  name: user.name,
                  last_name: user.last_name
               }
            }
         });
      } catch (error) {
         next(error);
      }
   }
);

// post /auth/refresh - renovar tokens
router.post('/refresh', refreshLimiter, async (req, res, next) => {
   try {
      const { refreshToken, userId } = req.body || {};
      if (!refreshToken) {
         throw boom.badRequest('refreshToken is required', { code: 'REFRESH_REQUIRED' });
      }
      const effectiveUserId = userId || tryDecodeAccessToken(req);
      if (!effectiveUserId) throw boom.badRequest('userId is required', { code: 'USER_ID_REQUIRED' });

      const meta = { rid: req.rid, ip: req.ip, userAgent: req.get('user-agent') || '-' };
      const { accessToken, refreshToken: newRefreshToken, user } =
         await service.refresh(effectiveUserId, refreshToken, meta);

      logInfo('AUTH_REFRESH_OK', { rid: req.rid, userId: user.id, ip: meta.ip, ua: meta.userAgent });

      return res.status(200).json({
         message: 'Tokens refreshed',
         data: {
            accessToken,
            refreshToken: newRefreshToken,
            user: { id: user.id, username: user.username, email: user.email, lastLogin: user.lastLogin }
         }
      });
   } catch (error) {
      return next(error);
   }
});

// ==========================================
//  rutas publicas: recuperacion de cuenta
// ==========================================

// post /auth/recovery - enviar link al correo
router.post('/recovery',
   validatorHandler(recoverySchema, 'body'),
   async (req, res, next) => {
      try {
         const { email } = req.body;
         const rta = await service.sendRecoveryLink(email);
         res.status(200).json(rta);
      } catch (error) {
         next(error);
      }
   }
);

// post /auth/reset-password - cambiar pass con token
router.post('/reset-password',
   validatorHandler(resetPasswordSchema, 'body'),
   async (req, res, next) => {
      try {
         const { token, id, newPassword } = req.body;
         const rta = await service.changePasswordByRecovery(id, token, newPassword);
         res.status(200).json(rta);
      } catch (error) {
         next(error);
      }
   }
);

// ==========================================
//  rutas de gestion de sesiones (logout)
// ==========================================

// post /auth/logout - requiere body con userid+refreshtoken
router.post('/logout', sessionsWriteLimiter, async (req, res, next) => {
   try {
      const { refreshToken, userId } = req.body || {};
      if (!refreshToken || !userId) {
         return next(boom.badRequest('userId and refreshToken are required', { code: 'BAD_REQUEST' }));
      }
      await service.logout(userId, refreshToken, { rid: req.rid });
      logInfo('AUTH_LOGOUT_OK', { rid: req.rid, userId, ip: req.ip, ua: req.get('user-agent') || '-' });
      return res.status(200).json({ message: 'Logged out', data: { revoked: true } });
   } catch (error) {
      return next(error);
   }
});

// --- endpoints protegidos (requieren token jwt) ---

// get /auth/sessions - listar sesiones activas
router.get('/sessions', jwtValidate, sessionsGetLimiter, async (req, res, next) => {
   try {
      const userId = req.user.sub;
      const { status = 'active', limit = '20', offset = '0' } = req.query || {};
      const out = await service.listSessions(userId, { status, limit, offset });

      logInfo('AUTH_SESS_LIST_OK', { rid: req.rid, userId, count: out.items.length, total: out.total });
      return res.status(200).json({ data: out.items, total: out.total });
   } catch (error) {
      return next(error);
   }
});

// delete /auth/sessions/:id - revocar una sesion especifica
router.delete('/sessions/:id', jwtValidate, sessionsWriteLimiter, async (req, res, next) => {
   try {
      const userId = req.user.sub;
      const tokenId = Number(req.params.id);
      if (!Number.isFinite(tokenId)) {
         return next(boom.badRequest('Invalid session id', { code: 'BAD_REQUEST' }));
      }

      const result = await service.revokeSessionById(userId, tokenId);
      logInfo('AUTH_SESS_REVOKE_OK', {
         rid: req.rid,
         userId,
         tokenId,
         alreadyRevoked: !!result.alreadyRevoked
      });
      return res.status(200).json({ revoked: true, id: result.id, alreadyRevoked: !!result.alreadyRevoked });
   } catch (error) {
      return next(error);
   }
});

// post /auth/sessions/revoke-others - revocar todas menos la actual
router.post('/sessions/revoke-others', jwtValidate, sessionsWriteLimiter, async (req, res, next) => {
   try {
      const userId = req.user.sub;
      const { keepId } = req.body || {};
      const idNum = Number(keepId);
      if (!Number.isFinite(idNum)) {
         return next(boom.badRequest('keepId must be a number', { code: 'BAD_REQUEST' }));
      }
      const { revokedCount } = await service.revokeAllExcept(userId, idNum);

      logInfo('AUTH_SESS_REVOKE_OTHERS_OK', { rid: req.rid, userId, keepId: idNum, revokedCount });
      return res.status(200).json({ revokedCount });
   } catch (error) {
      return next(error);
   }
});

// post /auth/logout-all - revocar todas las sesiones
router.post('/logout-all', jwtValidate, sessionsWriteLimiter, async (req, res, next) => {
   try {
      const userId = req.user.sub;
      const { revokedCount } = await service.revokeAllSessions(userId);

      logInfo('AUTH_LOGOUT_ALL_OK', { rid: req.rid, userId, revokedCount });
      return res.status(200).json({ revokedCount });
   } catch (error) {
      return next(error);
   }
});

module.exports = router;