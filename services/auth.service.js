// services/auth.service.js
const boom = require('@hapi/boom');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { models } = require('./../libs/sequelize');
const { config } = require('./../config/config');
const { formatToSantiago } = require('./../utils/helpers/dateHelper');
const { logInfo, logError } = require('../utils/logger');

const sendEmailMock = async (email, link) => {
   console.log(`[EMAIL SERVICE] Enviando correo a ${email}`);
   console.log(`[EMAIL SERVICE] Link de recuperación: ${link}`);
   return true;
};

class AuthService {

   // helper: sanea meta para respetar longitudes de DB
   sanitizeMeta(meta = {}) {
      const ip = meta.ip ? String(meta.ip).slice(0, 45) : null;                 // varchar(45)
      const userAgent = meta.userAgent ? String(meta.userAgent).slice(0, 255) : null; // varchar(255)
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

   // genera un token
   generateAccessToken(user) {
      const payload = { sub: user.id, username: user.username };
      return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.jwtAccessExpires });
   }

   // crea y guarda refresh token en la table de tokens
   async generateAndStoreRefreshToken(userId, meta = {}) {
      const tokenPlain = crypto.randomBytes(64).toString('hex');
      const token_hash = await bcrypt.hash(tokenPlain, 10); // se almacena en token_hash (CHAR/VARCHAR ok)
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

   // Verifica refresh token activo
   async verifyRefreshToken(userId, refreshTokenPlain, meta = {}) {
      const now = new Date();
      const clean = this.sanitizeMeta(meta);

      // 1) activos recientes
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
            await rec.save({ validate: false }); // 👈 evita validation error
            return rec; // este es el que se rota
         }
      }

      // 3) replay en revocados recientes
      await this.detectReplayAndHandle(userId, refreshTokenPlain);

      // 4) inválido/expirado
      const err = boom.unauthorized('Invalid or expired refresh token');
      err.data = { code: 'REFRESH_INVALID' };
      throw err;
   }

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
         // no bloqueante
      }
   }

   // Revoca la cadena descendiente (replaced_by_token_id)
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

   // Replay detection
   async detectReplayAndHandle(userId, refreshTokenPlain) {
      const lookbackDays = parseInt(process.env.REFRESH_REPLAY_LOOKBACK_DAYS || '30', 10);
      const cutoff = new Date(Date.now() - (lookbackDays * 24 * 60 * 60 * 1000));

      const revokedRecent = await models.RefreshTokenSuperAdmin.findAll({
         where: {
            super_admin_id: userId,             // 👈 variable correcta
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

   // inicia sesion al usuario admin
   async login(username, password, meta = {}) {
      try {
         // busca usuario
         const user = await this.validateUser(username, password);

         // modifica fecha de ultimo inicio de sesion del usuario
         await models.SuperAdmin.update(
            { last_login: new Date() },
            { where: { id: user.id } }
         );
         // genera token
         const accessToken = this.generateAccessToken(user);
         // crea un refresh token y lo guarda en la tabla de tokens
         const { tokenPlain: refreshToken, tokenRecord } = await this.generateAndStoreRefreshToken(user.id, meta);

         // limpia los inicio de sesion anteriores limpiando y revokando las sesion del usuario
         await this.pruneActiveSessions(user.id, [tokenRecord.id]);

         // success!
         return {
            accessToken,
            refreshToken,
            user: {
               ...user.get(),
               lastLogin: user.last_login ? formatToSantiago(user.last_login) : null
            },
            refreshTokenId: tokenRecord.id
         };

      } catch (err) {
         // en caso de error lo guardamos en la consola de monitoreo
         logError('AUTH_LOGIN_ERR', {
            rid: meta.rid || '-',
            code: err?.data?.code || 'UNKNOWN',
            ip: meta.ip || '-',
            ua: meta.userAgent || '-'
         });
         throw err;

      }
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

   parseMs(timeStr) {
      const match = /^(\d+)(ms|s|m|h|d)$/i.exec(timeStr);
      if (!match) return 30 * 24 * 60 * 60 * 1000;
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      const multipliers = { ms: 1, s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
      return value * multipliers[unit];
   }

   // lista sesiones (refresh tokens) del usuario
   async listSessions(userId, { status = 'active', limit = 20, offset = 0 } = {}) {
      try {
         const now = new Date();
         const where = { super_admin_id: userId }; // 👈 FK correcta

         const norm = String(status || 'active').toLowerCase();
         if (norm === 'active') {
            where.revoked_at = { [Op.is]: null };
            where.expires_at = { [Op.gt]: now };
         } else if (norm === 'revoked') {
            where.revoked_at = { [Op.not]: null };
         } // 'all' => sin filtro extra

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

   // revoca una sesión por id (perteneciente al usuario)
   async revokeSessionById(userId, tokenId) {
      try {
         const rt = await models.RefreshTokenSuperAdmin.findOne({
            where: { id: tokenId, super_admin_id: userId } // 👈 FK correcta
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

   // revoca todas las sesiones activas del usuario
   async revokeAllSessions(userId) {
      try {
         const [affected] = await models.RefreshTokenSuperAdmin.update(
            { revoked_at: new Date() },
            { where: { super_admin_id: userId, revoked_at: { [Op.is]: null } } } // 👈 FK correcta
         );
         return { revokedCount: affected || 0 };
      } catch (err) {
         logError('AUTH_LOGOUT_ALL_ERR', { userId, msg: err?.message || 'unknown' });
         throw err;
      }
   }

   // revoca todas las sesiones activas excepto una
   async revokeAllExcept(userId, keepId) {
      try {
         const keep = await models.RefreshTokenSuperAdmin.findOne({
            where: { id: keepId, super_admin_id: userId } // 👈 FK correcta
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

   // solicitar recuperacion
   async sendRecoveryLink(email) {
      const user = await models.SuperAdmin.findOne({ where: { email } });
      console.log(user);

      if (!user) {
         // por seguridad, no decimos si el email no existe, pero retornamos 'exito' simulado
         return { message: 'Correo de recuperación enviado' };
      }

      // generamos un token JWT de corta duración (ej: 15 min) firmado con el secret + password_hash del usuario
      // usar el password_hash en el secret hace que el token muera automáticamente si el usuario cambia su clave.
      const secret = config.jwtAccessSecret + user.password_hash;
      const payload = { sub: user.id, type: 'recovery' };
      const token = jwt.sign(payload, secret, { expiresIn: '15m' });

      // link para el frontend
      const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}&id=${user.id}`;

      await sendEmailMock(email, link);

      return { message: 'Correo de recuperación enviado' };
   }

   // 2. Cambiar contraseña con Token de Recuperación
   async changePasswordByRecovery(userId, token, newPassword) {
      const user = await models.SuperAdmin.findByPk(userId);
      if (!user) throw boom.unauthorized('Link inválido o expirado');

      try {
         // Verificar token con el "secret dinámico"
         const secret = config.jwtAccessSecret + user.password_hash;
         jwt.verify(token, secret);
      } catch (error) {
         throw boom.unauthorized('Link inválido o expirado');
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await user.update({ password_hash: hash });

      return { message: 'Contraseña reestablecida correctamente' };
   }
}

module.exports = AuthService;