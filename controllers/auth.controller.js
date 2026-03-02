const boom = require('@hapi/boom');
const jwt = require('jsonwebtoken');
const { config } = require('../config/config');
const { logInfo } = require('../utils/logger');
const AuthService = require('../services/auth.service');
const SuperAdminService = require('../services/super-admin.service');
const asyncHandler = require('../utils/helpers/asyncHandler');

const service = new AuthService();

// helper interno del controlador
const tryDecodeAccessToken = (req) => {
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
};

// ==========================================
//  controladores publicos: autenticacion
// ==========================================

const login = asyncHandler(async (req, res) => {
   const { username, password } = req.body;
   const meta = { rid: req.rid, ip: req.ip, userAgent: req.get('user-agent') || '-' };

   const result = await service.login(username, password, meta);

   // caso 1: requiere 2fa
   if (result.require2fa) {
      logInfo('AUTH_LOGIN_2FA_REQUIRED', { rid: req.rid, userId: result.userId, ip: meta.ip });
      return res.status(200).json({
         message: result.message,
         require2fa: true,
         userId: result.userId
      });
   }

   // caso 2: login directo
   const { accessToken, refreshToken, user } = result;
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
            last_name: user.last_name,
            avatar_url: user.avatar_url
         }
      }
   });
});

const refresh = asyncHandler(async (req, res) => {
   const { refreshToken, userId } = req.body || {};
   if (!refreshToken) {
      throw boom.badRequest('refreshToken is required', { code: 'REFRESH_REQUIRED' });
   }

   const effectiveUserId = userId || tryDecodeAccessToken(req);
   if (!effectiveUserId) throw boom.badRequest('userId is required', { code: 'USER_ID_REQUIRED' });

   const meta = { rid: req.rid, ip: req.ip, userAgent: req.get('user-agent') || '-' };
   const { accessToken, refreshToken: newRefreshToken, user } = await service.refresh(effectiveUserId, refreshToken, meta);

   logInfo('AUTH_REFRESH_OK', { rid: req.rid, userId: user.id, ip: meta.ip, ua: meta.userAgent });

   return res.status(200).json({
      message: 'Tokens refreshed',
      data: {
         accessToken,
         refreshToken: newRefreshToken,
         user: { id: user.id, username: user.username, email: user.email, lastLogin: user.lastLogin }
      }
   });
});

const recovery = asyncHandler(async (req, res) => {
   const { email } = req.body;
   const rta = await service.sendRecoveryLink(email);
   res.status(200).json(rta);
});

const resetPassword = asyncHandler(async (req, res) => {
   const { token, id, newPassword } = req.body;
   const rta = await service.changePasswordByRecovery(id, token, newPassword);
   res.status(200).json(rta);
});

const logout = asyncHandler(async (req, res) => {
   const { refreshToken, userId } = req.body || {};
   if (!refreshToken || !userId) {
      throw boom.badRequest('userId and refreshToken are required', { code: 'BAD_REQUEST' });
   }

   await service.logout(userId, refreshToken, { rid: req.rid });
   logInfo('AUTH_LOGOUT_OK', { rid: req.rid, userId, ip: req.ip, ua: req.get('user-agent') || '-' });

   return res.status(200).json({ message: 'Logged out', data: { revoked: true } });
});

// ==========================================
//  controladores protegidos: sesiones
// ==========================================

const listSessions = asyncHandler(async (req, res) => {
   const userId = req.user.sub;
   const { status = 'active', limit = '20', offset = '0' } = req.query || {};
   const out = await service.listSessions(userId, { status, limit, offset });

   logInfo('AUTH_SESS_LIST_OK', { rid: req.rid, userId, count: out.items.length, total: out.total });
   return res.status(200).json({ data: out.items, total: out.total });
});

const revokeSessionById = asyncHandler(async (req, res) => {
   const userId = req.user.sub;
   const tokenId = Number(req.params.id);
   if (!Number.isFinite(tokenId)) {
      throw boom.badRequest('Invalid session id', { code: 'BAD_REQUEST' });
   }

   const result = await service.revokeSessionById(userId, tokenId);
   logInfo('AUTH_SESS_REVOKE_OK', { rid: req.rid, userId, tokenId, alreadyRevoked: !!result.alreadyRevoked });
   return res.status(200).json({ revoked: true, id: result.id, alreadyRevoked: !!result.alreadyRevoked });
});

const revokeOthers = asyncHandler(async (req, res) => {
   const userId = req.user.sub;
   const { keepId } = req.body || {};
   const idNum = Number(keepId);
   if (!Number.isFinite(idNum)) {
      throw boom.badRequest('keepId must be a number', { code: 'BAD_REQUEST' });
   }

   const { revokedCount } = await service.revokeAllExcept(userId, idNum);
   logInfo('AUTH_SESS_REVOKE_OTHERS_OK', { rid: req.rid, userId, keepId: idNum, revokedCount });

   return res.status(200).json({ revokedCount });
});

const logoutAll = asyncHandler(async (req, res) => {
   const userId = req.user.sub;
   const { revokedCount } = await service.revokeAllSessions(userId);

   logInfo('AUTH_LOGOUT_ALL_OK', { rid: req.rid, userId, revokedCount });
   return res.status(200).json({ revokedCount });
});

// ==========================================
//  controladores: doble factor (2fa)
// ==========================================

const generate2FA = asyncHandler(async (req, res) => {
   const { sub: userId } = req.user;
   const { qrCode, tempSecret } = await service.generate2FA(userId);
   res.status(200).json({ data: { qrCode, tempSecret } });
});

const enable2FA = asyncHandler(async (req, res) => {
   const { sub: userId } = req.user;
   const { token, secret } = req.body;

   const result = await service.enable2FA(userId, token, secret);
   logInfo('2FA_ENABLED', { rid: req.rid, userId, ip: req.ip });

   res.status(200).json({ data: result });
});

const disable2FA = asyncHandler(async (req, res) => {
   const { sub: userId } = req.user;
   const userService = new SuperAdminService();

   await userService.update(userId, {
      two_factor_enabled: false,
      two_factor_secret: null
   });

   logInfo('2FA_DISABLED', { rid: req.rid, userId, ip: req.ip });
   res.status(200).json({ message: '2FA desactivado correctamente' });
});

const verify2FALogin = asyncHandler(async (req, res) => {
   const { userId, token } = req.body;

   const result = await service.verify2FA(userId, token, {
      rid: req.rid,
      ip: req.ip,
      userAgent: req.get('user-agent')
   });

   const { accessToken, refreshToken, user } = result;
   logInfo('AUTH_LOGIN_2FA_OK', { rid: req.rid, userId: user.id, ip: req.ip });

   res.status(200).json({
      message: 'Login successful',
      data: { accessToken, refreshToken, user }
   });
});

module.exports = {
   login,
   refresh,
   recovery,
   resetPassword,
   logout,
   listSessions,
   revokeSessionById,
   revokeOthers,
   logoutAll,
   generate2FA,
   enable2FA,
   disable2FA,
   verify2FALogin
};