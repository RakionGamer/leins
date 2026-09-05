const boom = require('@hapi/boom');
const { models, sequelize } = require('../libs/sequelize');
const { config } = require('../config/config');

function parsePositiveInt(value, label) {
   const n = Number(value);
   if (!Number.isInteger(n) || n <= 0) {
      throw boom.badRequest(`${label} invalido`);
   }
   return n;
}

function normalizeType(value) {
   const type = String(value || '').trim().toUpperCase();
   if (!['SII', 'BANK'].includes(type)) {
      throw boom.badRequest('type permitido: SII o BANK');
   }
   return type;
}

function normalizeDv(value) {
   const dv = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
   if (!/^[0-9K]$/.test(dv)) throw boom.badRequest('dv invalido');
   return dv;
}

function splitRut(value) {
   const clean = String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
   if (!/^\d+[0-9K]$/.test(clean)) throw boom.badRequest('rut invalido');
   return {
      rut_sin_dv: clean.slice(0, -1),
      dv: clean.slice(-1)
   };
}

function parseSecretJson(secretJson) {
   try {
      return JSON.parse(secretJson || '{}') || {};
   } catch {
      return {};
   }
}

function decryptedSecretLiteral() {
   const aesKey = String(config.mysqlAesKey || '').trim();
   if (!aesKey) throw boom.badImplementation('clave de cifrado no configurada');

   return sequelize.literal(
      `CAST(AES_DECRYPT(FROM_BASE64(secret_encrypted), ${sequelize.escape(aesKey)}) AS CHAR)`
   );
}

function encryptedSecretLiteral(secret) {
   const aesKey = String(config.mysqlAesKey || '').trim();
   if (!aesKey) throw boom.badImplementation('clave de cifrado no configurada');

   return sequelize.literal(
      `TO_BASE64(AES_ENCRYPT(${sequelize.escape(JSON.stringify(secret))}, ${sequelize.escape(aesKey)}))`
   );
}

function mapCredentialRow(row, { includeSecret = false } = {}) {
   if (!row) return null;

   const secret = parseSecretJson(row.secret_json);
   const type = row.type;
   const entity = {
      id: Number(row['entity.id'] || row.entity_id || 0),
      legal_name: row['entity.legal_name'] || null,
      tax_id: row['entity.tax_id'] || null,
   };

   const base = {
      id: Number(row.id),
      entity_id: Number(row.entity_id),
      user_id: row.user_id == null ? null : Number(row.user_id),
      type,
      created_by: Number(row.created_by),
      created_at: row.createdAt || row.created_at || null,
      entity,
   };

   if (type === 'SII') {
      const rutSinDv = secret.rut_sin_dv || secret.rut || '';
      const dv = secret.dv || '';

      return {
         ...base,
         rut_sin_dv: rutSinDv,
         dv,
         rut: rutSinDv && dv ? `${rutSinDv}-${dv}` : null,
         has_secret: Boolean(secret.clave),
         secret_preview: secret.clave ? '********' : null,
         ...(includeSecret ? { secret: { rut_sin_dv: rutSinDv, dv, clave: secret.clave || '' } } : {})
      };
   }

   return {
      ...base,
      bank: secret.bank || '',
      username: secret.username || secret.rut_sin_dv || '',
      dv: secret.dv || '',
      has_secret: Boolean(secret.password || secret.clave),
      secret_preview: (secret.password || secret.clave) ? '********' : null,
      ...(includeSecret ? {
         secret: {
            bank: secret.bank || '',
            username: secret.username || secret.rut_sin_dv || '',
            dv: secret.dv || '',
            password: secret.password || secret.clave || ''
         }
      } : {})
   };
}

class CredentialsService {
   async assertEntity(entityId) {
      const entity = await models.Entity.findByPk(entityId, {
         attributes: ['id', 'legal_name', 'tax_id'],
         raw: true
      });
      if (!entity) throw boom.notFound('entidad no encontrada');
      return entity;
   }

   async list({ entityId, type = null, limit = 50, offset = 0 } = {}) {
      const parsedEntityId = parsePositiveInt(entityId, 'entityId');
      await this.assertEntity(parsedEntityId);

      const where = { entity_id: parsedEntityId };
      if (type) where.type = normalizeType(type);

      const rows = await models.Credential.findAll({
         where,
         attributes: [
            'id',
            'entity_id',
            'user_id',
            'type',
            'created_by',
            'createdAt',
            [decryptedSecretLiteral(), 'secret_json'],
         ],
         include: [{
            model: models.Entity,
            as: 'entity',
            attributes: ['id', 'legal_name', 'tax_id'],
            required: true,
         }],
         order: [['id', 'DESC']],
         limit,
         offset,
         raw: true,
      });

      const total = await models.Credential.count({ where });
      return {
         ok: true,
         total: Number(total || 0),
         limit,
         offset,
         rows: rows.map((row) => mapCredentialRow(row))
      };
   }

   async findOne({ entityId, credentialId, includeSecret = false } = {}) {
      const parsedEntityId = parsePositiveInt(entityId, 'entityId');
      const parsedCredentialId = parsePositiveInt(credentialId, 'credentialId');

      const row = await models.Credential.findOne({
         where: { id: parsedCredentialId, entity_id: parsedEntityId },
         attributes: [
            'id',
            'entity_id',
            'user_id',
            'type',
            'created_by',
            'createdAt',
            [decryptedSecretLiteral(), 'secret_json'],
         ],
         include: [{
            model: models.Entity,
            as: 'entity',
            attributes: ['id', 'legal_name', 'tax_id'],
            required: true,
         }],
         raw: true,
      });

      if (!row) throw boom.notFound('credencial no encontrada');
      return mapCredentialRow(row, { includeSecret });
   }

   buildSiiSecret(payload = {}, currentSecret = {}, entity = {}) {
      let rutParts = null;

      if (payload.rut != null && String(payload.rut).trim() !== '') {
         rutParts = splitRut(payload.rut);
      } else if (payload.rut_sin_dv != null || payload.dv != null) {
         const rutSinDv = String(payload.rut_sin_dv ?? currentSecret.rut_sin_dv ?? currentSecret.rut ?? '')
            .replace(/\D/g, '');
         if (!rutSinDv) throw boom.badRequest('rut_sin_dv es requerido');
         rutParts = {
            rut_sin_dv: rutSinDv,
            dv: normalizeDv(payload.dv ?? currentSecret.dv)
         };
      } else if (currentSecret.rut_sin_dv || currentSecret.rut) {
         rutParts = {
            rut_sin_dv: currentSecret.rut_sin_dv || currentSecret.rut,
            dv: normalizeDv(currentSecret.dv)
         };
      } else {
         rutParts = splitRut(entity.tax_id);
      }

      const clave = payload.clave ?? payload.password ?? currentSecret.clave;
      if (clave == null || String(clave).trim() === '') {
         throw boom.badRequest('clave es requerida');
      }

      return {
         rut_sin_dv: rutParts.rut_sin_dv,
         dv: rutParts.dv,
         clave: String(clave)
      };
   }

   buildBankSecret(payload = {}, currentSecret = {}) {
      const bank = payload.bank ?? currentSecret.bank;
      const username = payload.username ?? currentSecret.username ?? currentSecret.rut_sin_dv;
      const dv = payload.dv ?? currentSecret.dv ?? '';
      const password = payload.password ?? payload.clave ?? currentSecret.password ?? currentSecret.clave;

      if (!bank || String(bank).trim() === '') throw boom.badRequest('bank es requerido');
      if (!username || String(username).trim() === '') throw boom.badRequest('username es requerido');
      if (password == null || String(password).trim() === '') throw boom.badRequest('password es requerido');

      return {
         bank: String(bank).trim().toLowerCase(),
         username: String(username).trim(),
         dv: dv == null ? '' : String(dv).trim().toUpperCase(),
         password: String(password)
      };
   }

   buildSecret({ type, payload, currentSecret = {}, entity }) {
      if (type === 'SII') return this.buildSiiSecret(payload, currentSecret, entity);
      return this.buildBankSecret(payload, currentSecret);
   }

   async create({ entityId, actorId, payload = {} } = {}) {
      const parsedEntityId = parsePositiveInt(entityId, 'entityId');
      const parsedActorId = parsePositiveInt(actorId, 'actorId');
      const entity = await this.assertEntity(parsedEntityId);
      const type = normalizeType(payload.type);
      const secret = this.buildSecret({ type, payload, entity });

      const created = await models.Credential.create({
         entity_id: parsedEntityId,
         user_id: payload.user_id || null,
         type,
         secret_encrypted: encryptedSecretLiteral(secret),
         created_by: parsedActorId,
      });

      return this.findOne({ entityId: parsedEntityId, credentialId: created.id });
   }

   async update({ entityId, credentialId, payload = {} } = {}) {
      const parsedEntityId = parsePositiveInt(entityId, 'entityId');
      const parsedCredentialId = parsePositiveInt(credentialId, 'credentialId');
      const entity = await this.assertEntity(parsedEntityId);

      const current = await this.findOne({
         entityId: parsedEntityId,
         credentialId: parsedCredentialId,
         includeSecret: true
      });

      const credential = await models.Credential.findOne({
         where: { id: parsedCredentialId, entity_id: parsedEntityId }
      });
      if (!credential) throw boom.notFound('credencial no encontrada');

      const type = payload.type ? normalizeType(payload.type) : current.type;
      const secret = this.buildSecret({
         type,
         payload,
         currentSecret: current.secret || {},
         entity
      });

      const changes = {
         type,
         secret_encrypted: encryptedSecretLiteral(secret),
      };

      if (payload.user_id !== undefined) {
         changes.user_id = payload.user_id || null;
      }

      await credential.update(changes);
      return this.findOne({ entityId: parsedEntityId, credentialId: parsedCredentialId });
   }

   async delete({ entityId, credentialId } = {}) {
      const parsedEntityId = parsePositiveInt(entityId, 'entityId');
      const parsedCredentialId = parsePositiveInt(credentialId, 'credentialId');

      const credential = await models.Credential.findOne({
         where: { id: parsedCredentialId, entity_id: parsedEntityId }
      });
      if (!credential) throw boom.notFound('credencial no encontrada');

      await credential.destroy();
      return { ok: true, id: parsedCredentialId, deleted: true };
   }

   async reveal({ entityId, credentialId } = {}) {
      const row = await this.findOne({ entityId, credentialId, includeSecret: true });
      return { ok: true, row };
   }
}

module.exports = CredentialsService;
