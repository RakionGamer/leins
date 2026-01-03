// services/entities.service.js
const { sequelize } = require('../libs/sequelize');   // ← tu instancia
const { QueryTypes } = require('sequelize');          // ← tipos de query

class EntitiesService {


   // Lista todo es para el super admin
   async listAll({ q = null, limit = 20, offset = 0, activeOnly = false } = {}) {
      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);
      const whereQ = q ? `
      AND (e.legal_name LIKE CONCAT('%', :q, '%')
      OR e.tax_id    LIKE CONCAT('%', :q, '%'))
      ` : '';

      const whereActive = activeOnly ? `AND e.state_id = ${ACTIVE_STATE_ID}` : '';

      const sql = `
         SELECT e.id, e.legal_name AS name, e.tax_id AS rut, e.state_id
         FROM entities e
         WHERE 1=1 ${whereQ} ${whereActive}
         ORDER BY e.legal_name ASC
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `
         SELECT COUNT(*) AS total
         FROM entities e
         WHERE 1=1 ${whereQ} ${whereActive}
      `;

      const params = { q, limit, offset };

      const [{ total }] = await sequelize.query(sqlCount, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rows = await sequelize.query(sql, {
         type: QueryTypes.SELECT,
         replacements: params
      });

      return { ok: true, total: Number(total || 0), limit, offset, rows };
   }

   // lista filtrado para el usuario
   async listForUser({ userId, q = null, limit = 20, offset = 0, activeOnly = false } = {}) {

      const ACTIVE_STATE_ID = Number(process.env.ACTIVE_STATE_ID || 1);
      
      if (!userId) throw new Error('userId is required');

      const whereQ = q ? `
         AND (e.legal_name LIKE CONCAT('%', :q, '%')
         OR e.tax_id    LIKE CONCAT('%', :q, '%'))
      ` : '';

      const whereActive = activeOnly ? `AND e.state_id = ${ACTIVE_STATE_ID}` : '';

      const baseJoin = `
         FROM entities e
         JOIN user_entities ue ON ue.entity_id = e.id
         WHERE ue.user_id = :userId
         ${whereQ} ${whereActive}
      `;
      const sql = `
         SELECT e.id, e.legal_name AS name, e.tax_id AS rut, e.state_id
         ${baseJoin}
         ORDER BY e.legal_name ASC
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `SELECT COUNT(*) AS total ${baseJoin}`;

      const params = { userId, q, limit, offset };

      const [{ total }] = await sequelize.query(sqlCount, {
         type: QueryTypes.SELECT,
         replacements: params
      });
      const rows = await sequelize.query(sql, {
         type: QueryTypes.SELECT,
         replacements: params
      });

      return { ok: true, total: Number(total || 0), limit, offset, rows };
   }
}

module.exports = EntitiesService;