// scripts/cleanup-refresh-tokens.js
// housekeeping de refresh tokens para mantener la tabla liviana y segura
// uso:
//  - node scripts/cleanup-refresh-tokens.js           -> ejecuta limpieza real
//  - node scripts/cleanup-refresh-tokens.js --dry-run -> muestra lo que haria sin modificar
//
// requiere: REFRESH_RETENTION_DAYS (dias), REFRESH_MARK_EXPIRED (true/false)

require('dotenv').config();
const { Op } = require('sequelize');

// Soporta ambos exports:
// 1) module.exports = { sequelize, models }
// 2) module.exports = sequelize (instancia)
const sequelizeExport = require('../libs/sequelize');
const sequelize =
   sequelizeExport.sequelize || sequelizeExport; // instancia
const models =
   sequelizeExport.models || (sequelize && sequelize.models) || {};

const { logInfo, logError } = require('../utils/logger');

(async function main() {
   const dryRun = process.argv.includes('--dry-run');
   const retentionDays = parseInt(process.env.REFRESH_RETENTION_DAYS || '60', 10);
   const markExpired = String(process.env.REFRESH_MARK_EXPIRED || 'true').toLowerCase() === 'true';

   const now = new Date();
   const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

   const RT = models.RefreshTokenSuperAdmin; // ← modelo correcto

   if (!RT) {
      logError('CLEANUP_REFRESH_ERR', { msg: 'RefreshTokenSuperAdmin model not found' });
      process.exit(1);
   }

   let markedAsRevoked = 0;
   let deletedCount = 0;

   try {
      await sequelize.authenticate();

      await sequelize.transaction(async (t) => {
         // a) marcar como revocados los tokens expirados y aun activos
         if (markExpired) {
            const [affected] = await RT.update(
               { revoked_at: now }, // ← snake_case
               {
                  where: {
                     revoked_at: { [Op.is]: null },
                     expires_at: { [Op.lt]: now }, // ← snake_case
                  },
                  transaction: t,
               }
            );
            markedAsRevoked = affected || 0;
         }

         // b) borrar definitivos: tokens muy viejos (revocados o expirados hace mas del cutoff)
         // nota: si no quieres borrar, ejecuta con --dry-run
         const whereVeryOld = {
            [Op.or]: [
               { revoked_at: { [Op.lt]: cutoff } },
               { expires_at: { [Op.lt]: cutoff } },
            ],
         };

         if (!dryRun) {
            deletedCount = await RT.destroy({ where: whereVeryOld, transaction: t });
         } else {
            deletedCount = await RT.count({ where: whereVeryOld, transaction: t });
         }
      });

      logInfo('CLEANUP_REFRESH_OK', {
         dryRun,
         retentionDays,
         markExpired,
         markedAsRevoked,
         deletedCount,
      });
   } catch (err) {
      logError('CLEANUP_REFRESH_ERR', {
         msg: err?.message || 'unknown error',
         stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
      });
      process.exitCode = 1;
   } finally {
      // cierra conexion para que el proceso termine
      try { await sequelize.close(); } catch (_) { }
   }
})();