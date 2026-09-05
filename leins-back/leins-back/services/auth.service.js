const boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { models } = require('./../libs/sequelize');
const { config } = require('./../config/config');
const { formatToSantiago } = require('./../utils/helpers/dateHelper');
const { logInfo, logError } = require('../utils/logger');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const sendEmailMock = async (email, link) => {
   console.log(`[EMAIL SERVICE] enviando correo a ${email}`);
   console.log(`[EMAIL SERVICE] link de recuperacion: ${link}`);
   return true;
};

class AuthService {

   // helper: sanea meta para respetar longitudes de db
   sanitizeMeta(meta = {}) {
      const ip = meta.ip ? String(meta.ip).slice(0, 45) : null;
      const userAgent = meta.userAgent ? String(meta.userAgent).slice(0, 255) : null;
      return { ip, userAgent };
   }

   // busca usuario por username
   async findUser(username) {
      const user = await models.SuperAdmin.findOne({ where: { username } });
      if (!user) {
         const err = boom.unauthorized('Credenciales inválidas');
         err.data = { code: 'INVALID_CREDENTIALS' };
         throw err;
      }
      return user;
   }

   // busca usuario y compara credenciales
   async validateUser(username, password) {
      // busca usuario por username
      const user = await this.findUser(username);
      // verifica contrasena
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
         const err = boom.unauthorized('Credenciales inválidas');
         err.data = { code: 'INVALID_CREDENTIALS' };
         throw err;
      }
      return user;
   }

   // genera un token de acceso jwt
   generateAccessToken(user) {
      const payload = { sub: user.id, username: user.username };
      return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.jwtAccessExpires });
   }

   // crea y guarda refresh token en la tabla de tokens
   async generateAndStoreRefreshToken(userId, meta = {}) {
      const tokenPlain = crypto.randomBytes(64).toString('hex');
      const token_hash = await bcrypt.hash(tokenPlain, 10);
      const expires_at = new Date(Date.now() + this.parseMs(config.jwtRefreshExpires));
      const clean = this.sanitizeMeta(meta);

      const created = await models.RefreshTokenSuperAdmin.create({
         token_hash,
         super_admin_id: userId,
         expires_at,
         ip: clean.ip,
         user_agent: clean.userAgent,
         last_used_at: new Date(),
      }, {
         validate: false
      });

      return { tokenPlain, tokenRecord: created };
   }

   // verifica refresh token activo y maneja rotacion
   async verifyRefreshToken(userId, refreshTokenPlain, meta = {}) {
      const now = new Date();
      const clean = this.sanitizeMeta(meta);

      // 1) busca activos recientes
      const actives = await models.RefreshTokenSuperAdmin.findAll({
         where: {
            super_admin_id: userId,
            revoked_at: { [Op.is]: null },
            expires_at: { [Op.gt]: now }
         },
         order: [['createdAt', 'DESC']],
         limit: 10
      });

      // 2) intento de match
      for (const rec of actives) {
         const ok = await bcrypt.compare(refreshTokenPlain, rec.token_hash);
         if (ok) {
            rec.last_used_at = new Date();
            if (clean.ip !== null) rec.ip = clean.ip;
            if (clean.userAgent !== null) rec.user_agent = clean.userAgent;
            await rec.save({ validate: false });
            return rec;
         }
      }

      // 3) deteccion de replay en revocados
      await this.detectReplayAndHandle(userId, refreshTokenPlain);

      // 4) invalido o expirado
      const err = boom.unauthorized('Invalid or expired refresh token');
      err.data = { code: 'REFRESH_INVALID' };
      throw err;
   }

   // revoca un token especifico
   async revokeRefreshToken(tokenRecord, replaced_by_token_id = null) {
      tokenRecord.revoked_at = new Date();
      if (replaced_by_token_id) tokenRecord.replaced_by_token_id = replaced_by_token_id;
      await tokenRecord.save({ validate: false });
   }

   // limita sesiones activas, revocando las mas antiguas
   async pruneActiveSessions(userId, keepIds = []) {
      try {
         const cap = config.maxActiveSessions || 2;
         if (!Number.isFinite(cap) || cap <= 0) return;

         const actives = await models.RefreshTokenSuperAdmin.findAll({
            where: {
               super_admin_id: userId,
               revoked_at: { [Op.is]: null },
               expires_at: { [Op.gt]: new Date() }
            },
            order: [['createdAt', 'DESC']],
            attributes: ['id'],
            raw: true
         });

         const explicit = new Set(keepIds);
         const toKeep = new Set([...actives.slice(0, cap).map(r => r.id), ...explicit]);
         const toRevoke = actives.filter(r => !toKeep.has(r.id)).map(r => r.id);

         if (toRevoke.length) {
            await models.RefreshTokenSuperAdmin.update(
               { revoked_at: new Date() },
               { where: { id: toRevoke } }
            );
         }
      } catch (err) {
         // error no bloqueante
      }
   }

   // revoca cadena de tokens descendientes (seguridad)
   async revokeChainFrom(startTokenId) {
      if (!startTokenId) return;
      const RT = models.RefreshTokenSuperAdmin;
      let currentId = startTokenId;
      const now = new Date();
      while (currentId) {
         const t = await RT.findByPk(currentId);
         if (!t) break;
         if (!t.revoked_at) {
            t.revoked_at = now;
            await t.save({ validate: false });
         }
         currentId = t.replaced_by_token_id;
      }
   }

   // deteccion de reutilizacion de tokens
   async detectReplayAndHandle(userId, refreshTokenPlain) {
      const lookbackDays = parseInt(process.env.REFRESH_REPLAY_LOOKBACK_DAYS || '30', 10);
      const cutoff = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000));

      const revokedRecent = await models.RefreshTokenSuperAdmin.findAll({
         where: {
            super_admin_id: userId,
            revoked_at: { [Op.not]: null, [Op.gt]: cutoff },
         },
         order: [['revoked_at', 'DESC']],
         limit: 30
      });

      for (const tok of revokedRecent) {
         const match = await bcrypt.compare(refreshTokenPlain, tok.token_hash);
         if (match) {
            await this.revokeChainFrom(tok.replaced_by_token_id);

            logError('REFRESH_REPLAY_DETECTED', {
               userId, tokenId: tok.id, lookbackDays
            });

            const err = boom.unauthorized('Refresh token replay detected');
            err.data = { code: 'REFRESH_REPLAY' };
            throw err;
         }
      }
   }

   // parser de tiempo para expiracion
   parseMs(timeStr) {
      const match = /^(\d+)(ms|s|m|h|d)$/i.exec(timeStr);
      if (!match) return 30 * 24 * 60 * 60 * 1000;
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const multipliers = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
      return value * multipliers[unit];
   }

   // ==========================================
   //  autenticacion de clientes (tabla `users`)
   //  independiente del flujo de super_admin: no se toca nada de lo anterior
   // ==========================================

   generateClientAccessToken(user) {
      const payload = { sub: user.id, username: user.username, role: 'user' };
      return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.jwtAccessExpires });
   }

   async generateAndStoreClientRefreshToken(userId, meta = {}) {
      const tokenPlain = crypto.randomBytes(64).toString('hex');
      const token_hash = await bcrypt.hash(tokenPlain, 10);
      const expires_at = new Date(Date.now() + this.parseMs(config.jwtRefreshExpires));
      const clean = this.sanitizeMeta(meta);

      const created = await models.RefreshTokenUser.create({
         token_hash,
         user_id: userId,
         expires_at,
         ip: clean.ip,
         user_agent: clean.userAgent,
         last_used_at: new Date(),
      }, {
         validate: false
      });

      return { tokenPlain, tokenRecord: created };
   }

   async verifyClientRefreshToken(userId, refreshTokenPlain, meta = {}) {
      const now = new Date();
      const clean = this.sanitizeMeta(meta);

      const actives = await models.RefreshTokenUser.findAll({
         where: {
            user_id: userId,
            revoked_at: { [Op.is]: null },
            expires_at: { [Op.gt]: now }
         },
         order: [['createdAt', 'DESC']],
         limit: 10
      });

      for (const rec of actives) {
         const ok = await bcrypt.compare(refreshTokenPlain, rec.token_hash);
         if (ok) {
            rec.last_used_at = new Date();
            if (clean.ip !== null) rec.ip = clean.ip;
            if (clean.userAgent !== null) rec.user_agent = clean.userAgent;
            await rec.save({ validate: false });
            return rec;
         }
      }

      await this.detectClientReplayAndHandle(userId, refreshTokenPlain);

      const err = boom.unauthorized('Invalid or expired refresh token');
      err.data = { code: 'REFRESH_INVALID' };
      throw err;
   }

   async pruneActiveClientSessions(userId, keepIds = []) {
      try {
         const cap = config.maxActiveSessions || 2;
         if (!Number.isFinite(cap) || cap <= 0) return;

         const actives = await models.RefreshTokenUser.findAll({
            where: {
               user_id: userId,
               revoked_at: { [Op.is]: null },
               expires_at: { [Op.gt]: new Date() }
            },
            order: [['createdAt', 'DESC']],
            attributes: ['id'],
            raw: true
         });

         const explicit = new Set(keepIds);
         const toKeep = new Set([...actives.slice(0, cap).map(r => r.id), ...explicit]);
         const toRevoke = actives.filter(r => !toKeep.has(r.id)).map(r => r.id);

         if (toRevoke.length) {
            await models.RefreshTokenUser.update(
               { revoked_at: new Date() },
               { where: { id: toRevoke } }
            );
         }
      } catch (err) {
         // error no bloqueante
      }
   }

   async revokeClientChainFrom(startTokenId) {
      if (!startTokenId) return;
      const RT = models.RefreshTokenUser;
      let currentId = startTokenId;
      const now = new Date();
      while (currentId) {
         const t = await RT.findByPk(currentId);
         if (!t) break;
         if (!t.revoked_at) {
            t.revoked_at = now;
            await t.save({ validate: false });
         }
         currentId = t.replaced_by_token_id;
      }
   }

   async detectClientReplayAndHandle(userId, refreshTokenPlain) {
      const lookbackDays = parseInt(process.env.REFRESH_REPLAY_LOOKBACK_DAYS || '30', 10);
      const cutoff = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000));

      const revokedRecent = await models.RefreshTokenUser.findAll({
         where: {
            user_id: userId,
            revoked_at: { [Op.not]: null, [Op.gt]: cutoff },
         },
         order: [['revoked_at', 'DESC']],
         limit: 30
      });

      for (const tok of revokedRecent) {
         const match = await bcrypt.compare(refreshTokenPlain, tok.token_hash);
         if (match) {
            await this.revokeClientChainFrom(tok.replaced_by_token_id);

            logError('CLIENT_REFRESH_REPLAY_DETECTED', {
               userId, tokenId: tok.id, lookbackDays
            });

            const err = boom.unauthorized('Refresh token replay detected');
            err.data = { code: 'REFRESH_REPLAY' };
            throw err;
         }
      }
   }

   // login de un usuario cliente (tabla `users`, sin 2fa por ahora)
   async loginClient(username, password, meta = {}) {
      try {
         const user = await models.User.findOne({ where: { username } });
         if (!user) {
            const err = boom.unauthorized('Credenciales inválidas');
            err.data = { code: 'INVALID_CREDENTIALS' };
            throw err;
         }

         const isMatch = await bcrypt.compare(password, user.password_hash);
         if (!isMatch) {
            const err = boom.unauthorized('Credenciales inválidas');
            err.data = { code: 'INVALID_CREDENTIALS' };
            throw err;
         }

         if (user.state_id !== 1) {
            throw boom.unauthorized('Tu cuenta está suspendida o inactiva. Contacta al administrador.');
         }

         const accessToken = this.generateClientAccessToken(user);
         const { tokenPlain: refreshToken, tokenRecord } = await this.generateAndStoreClientRefreshToken(user.id, meta);

         await this.pruneActiveClientSessions(user.id, [tokenRecord.id]);

         return {
            accessToken,
            refreshToken,
            user: {
               id: user.id,
               username: user.username,
               email: user.email,
               name: user.name,
               last_name: user.last_name,
            },
            refreshTokenId: tokenRecord.id
         };
      } catch (err) {
         logError('AUTH_CLIENT_LOGIN_ERR', {
            rid: meta.rid || '-',
            code: err?.data?.code || 'UNKNOWN',
            ip: meta.ip || '-',
            ua: meta.userAgent || '-'
         });
         throw err;
      }
   }

   async refreshClient(userId, refreshTokenPlain, meta = {}) {
      try {
         const user = await models.User.findByPk(userId);
         if (!user) {
            const e = boom.unauthorized('User not found');
            e.data = { code: 'USER_NOT_FOUND' };
            throw e;
         }

         const oldTokenRecord = await this.verifyClientRefreshToken(userId, refreshTokenPlain, meta);

         const accessToken = this.generateClientAccessToken(user);
         const { tokenPlain: newRefreshToken, tokenRecord: newRecord } =
            await this.generateAndStoreClientRefreshToken(user.id, meta);

         await this.revokeRefreshToken(oldTokenRecord, newRecord.id);
         await this.pruneActiveClientSessions(user.id, [newRecord.id]);

         return {
            accessToken,
            refreshToken: newRefreshToken,
            user: { id: user.id, username: user.username, email: user.email, name: user.name, last_name: user.last_name }
         };
      } catch (err) {
         logError('AUTH_CLIENT_REFRESH_ERR', {
            rid: meta.rid || '-',
            userId,
            code: err?.data?.code || 'UNKNOWN'
         });
         throw err;
      }
   }

   async logoutClient(userId, refreshTokenPlain, meta = {}) {
      try {
         const tokenRecord = await this.verifyClientRefreshToken(userId, refreshTokenPlain, meta);
         await this.revokeRefreshToken(tokenRecord);
         return { revoked: true };
      } catch (err) {
         logError('AUTH_CLIENT_LOGOUT_ERR', {
            rid: meta.rid || '-',
            userId,
            code: err?.data?.code || 'UNKNOWN'
         });
         throw err;
      }
   }

   // ==========================================
   //  logica principal de autenticacion (login)
   // ==========================================

   async login(username, password, meta = {}) {
      try {
         // 1. validar credenciales basicas
         const user = await this.validateUser(username, password);

         // Si no esta activa la cuenta la bloqueamos
         if (user.state_id !== 1) {
            throw boom.unauthorized('Tu cuenta está suspendida o inactiva. Contacta al administrador.');
         }

         // 2. verificar si tiene 2fa activo
         if (user.two_factor_enabled) {
            return {
               require2fa: true,
               userId: user.id,
               message: 'Código 2FA requerido'
            };
         }

         // 3. si no tiene 2fa, procedemos a generar tokens (flujo normal)
         return await this._finalizeLogin(user, meta);

      } catch (err) {
         logError('AUTH_LOGIN_ERR', {
            rid: meta.rid || '-',
            code: err?.data?.code || 'UNKNOWN',
            ip: meta.ip || '-',
            ua: meta.userAgent || '-'
         });
         throw err;
      }
   }

   // helper interno para generar tokens y finalizar login
   async _finalizeLogin(user, meta) {
      // actualiza ultimo login
      await models.SuperAdmin.update(
         { last_login: new Date() },
         { where: { id: user.id } }
      );

      // genera tokens
      const accessToken = this.generateAccessToken(user);
      const { tokenPlain: refreshToken, tokenRecord } = await this.generateAndStoreRefreshToken(user.id, meta);

      // limpia sesiones antiguas
      await this.pruneActiveSessions(user.id, [tokenRecord.id]);

      return {
         accessToken,
         refreshToken,
         user: {
            ...user.get(),
            lastLogin: user.last_login ? formatToSantiago(user.last_login) : null
         },
         refreshTokenId: tokenRecord.id
      };
   }

   async refresh(userId, refreshTokenPlain, meta = {}) {
      try {
         const user = await models.SuperAdmin.findByPk(userId);
         if (!user) {
            const e = boom.unauthorized('User not found');
            e.data = { code: 'USER_NOT_FOUND' };
            throw e;
         }

         const oldTokenRecord = await this.verifyRefreshToken(userId, refreshTokenPlain, meta);

         const accessToken = this.generateAccessToken(user);
         const { tokenPlain: newRefreshToken, tokenRecord: newRecord } =
            await this.generateAndStoreRefreshToken(user.id, meta);

         await this.revokeRefreshToken(oldTokenRecord, newRecord.id);
         await this.pruneActiveSessions(user.id, [newRecord.id]);

         return {
            accessToken,
            refreshToken: newRefreshToken,
            user: {
               ...user.get(),
               lastLogin: user.last_login ? formatToSantiago(user.last_login) : null
            }
         };
      } catch (err) {
         logError('AUTH_REFRESH_ERR', {
            rid: meta.rid || '-',
            userId,
            code: err?.data?.code || 'UNKNOWN'
         });
         throw err;
      }
   }

   async logout(userId, refreshTokenPlain, meta = {}) {
      try {
         const tokenRecord = await this.verifyRefreshToken(userId, refreshTokenPlain, meta);
         await this.revokeRefreshToken(tokenRecord);
         return { revoked: true };
      } catch (err) {
         logError('AUTH_LOGOUT_ERR', {
            rid: meta.rid || '-',
            userId,
            code: err?.data?.code || 'UNKNOWN'
         });
         throw err;
      }
   }

   // ==========================================
   //  gestion de sesiones (listar / revocar)
   // ==========================================

   async listSessions(userId, { status = 'active', limit = 20, offset = 0 } = {}) {
      try {
         const now = new Date();
         const where = { super_admin_id: userId };

         const norm = String(status || 'active').toLowerCase();
         if (norm === 'active') {
            where.revoked_at = { [Op.is]: null };
            where.expires_at = { [Op.gt]: now };
         } else if (norm === 'revoked') {
            where.revoked_at = { [Op.not]: null };
         }

         const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
         const off = Math.max(Number(offset) || 0, 0);

         const result = await models.RefreshTokenSuperAdmin.findAndCountAll({
            where,
            attributes: ['id', 'ip', 'user_agent', 'createdAt', 'last_used_at', 'expires_at', 'revoked_at'],
            order: [['createdAt', 'DESC']],
            limit: lim,
            offset: off
         });

         return { items: result.rows, total: result.count };
      } catch (err) {
         logError('AUTH_SESS_LIST_ERR', { userId, msg: err?.message || 'unknown' });
         throw err;
      }
   }

   async revokeSessionById(userId, tokenId) {
      try {
         const rt = await models.RefreshTokenSuperAdmin.findOne({
            where: { id: tokenId, super_admin_id: userId }
         });
         if (!rt) {
            const e = boom.notFound('Session not found');
            e.data = { code: 'SESSION_NOT_FOUND' };
            throw e;
         }
         if (rt.revoked_at) {
            return { revoked: true, id: rt.id, alreadyRevoked: true };
         }
         rt.revoked_at = new Date();
         await rt.save({ validate: false });
         return { revoked: true, id: rt.id, alreadyRevoked: false };
      } catch (err) {
         logError('AUTH_SESS_REVOKE_ERR', { userId, tokenId, msg: err?.message || 'unknown' });
         throw err;
      }
   }

   async revokeAllSessions(userId) {
      try {
         const [affected] = await models.RefreshTokenSuperAdmin.update(
            { revoked_at: new Date() },
            { where: { super_admin_id: userId, revoked_at: { [Op.is]: null } } }
         );
         return { revokedCount: affected || 0 };
      } catch (err) {
         logError('AUTH_LOGOUT_ALL_ERR', { userId, msg: err?.message || 'unknown' });
         throw err;
      }
   }

   async revokeAllExcept(userId, keepId) {
      try {
         const keep = await models.RefreshTokenSuperAdmin.findOne({
            where: { id: keepId, super_admin_id: userId }
         });
         if (!keep) {
            const e = boom.notFound('Session not found');
            e.data = { code: 'SESSION_NOT_FOUND' };
            throw e;
         }
         const [affected] = await models.RefreshTokenSuperAdmin.update(
            { revoked_at: new Date() },
            { where: { super_admin_id: userId, revoked_at: { [Op.is]: null }, id: { [Op.ne]: keepId } } }
         );
         return { revokedCount: affected || 0 };
      } catch (err) {
         logError('AUTH_SESS_REVOKE_OTHERS_ERR', { userId, keepId, msg: err?.message || 'unknown' });
         throw err;
      }
   }

   // ==========================================
   //  recuperacion de contrasena
   // ==========================================

   async sendRecoveryLink(email) {
      const user = await models.SuperAdmin.findOne({ where: { email } });

      if (!user) {
         return { message: 'Correo de recuperación enviado' };
      }

      const secret = config.jwtAccessSecret + user.password_hash;
      const payload = { sub: user.id, type: 'recovery' };
      const token = jwt.sign(payload, secret, { expiresIn: '15m' });

      const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}&id=${user.id}`;
      await sendEmailMock(email, link);

      return { message: 'Correo de recuperación enviado' };
   }

   async changePasswordByRecovery(userId, token, newPassword) {
      const user = await models.SuperAdmin.findByPk(userId);
      if (!user) throw boom.unauthorized('Link inválido o expirado');

      try {
         const secret = config.jwtAccessSecret + user.password_hash;
         jwt.verify(token, secret);
      } catch (error) {
         throw boom.unauthorized('Link inválido o expirado');
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await user.update({ password_hash: hash });

      return { message: 'Contraseña reestablecida correctamente' };
   }

   // ==========================================
   //  doble factor de autenticacion (2fa)
   // ==========================================

   // 1. generar secreto y qr para configuracion
   async generate2FA(userId) {
      const user = await models.SuperAdmin.findByPk(userId);
      if (!user) throw boom.notFound('Usuario no encontrado');

      // generamos un secreto unico
      const secret = speakeasy.generateSecret({
         name: `LeinsAdvisor (${user.email})`
      });

      // generamos qr como data url
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      return {
         tempSecret: secret.base32,
         qrCode: qrCodeUrl
      };
   }

   // 2. activar 2fa (verificacion inicial)
   async enable2FA(userId, token, secret) {
      const verified = speakeasy.totp.verify({
         secret: secret,
         encoding: 'base32',
         token: token
      });

      if (!verified) {
         throw boom.unauthorized('Código incorrecto');
      }

      // guardar secreto permanentemente y activar flag
      await models.SuperAdmin.update(
         { two_factor_secret: secret, two_factor_enabled: true },
         { where: { id: userId } }
      );

      return { message: '2FA Activado correctamente' };
   }

   // 3. verificar 2fa durante login (paso 2)
   async verify2FA(userId, token, meta = {}) {
      const user = await models.SuperAdmin.findByPk(userId);

      console.log(user.two_factor_secret);


      if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
         throw boom.badRequest('2FA no está activado o usuario inválido');
      }

      const verified = speakeasy.totp.verify({
         secret: user.two_factor_secret,
         encoding: 'base32',
         token: token
      });

      if (!verified) {
         throw boom.unauthorized('Código 2FA inválido');
      }

      // si es valido, finalizamos el login (generar tokens, etc)
      return await this._finalizeLogin(user, meta);
   }

}

module.exports = AuthService;