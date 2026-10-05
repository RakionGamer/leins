require('dotenv').config();
const { sequelize, models } = require('../libs/sequelize');
const AccountingService = require('../services/accounting.service');
const accountingService = new AccountingService();

async function run() {
   let exitCode = 0;
   try {
      console.log('----------------------------------------------------');
      console.log(`[${new Date().toISOString()}] Iniciando generacion automatica de asientos SII...`);

      await sequelize.authenticate();

      // La tabla entities no tiene is_active ni business_name. Se procesan solo las entidades
      // que ya usan contabilidad (tienen plan de cuentas) o que tienen documentos SII, para no
      // sembrar planes de cuentas en entidades sin actividad.
      const [accRows, docRows] = await Promise.all([
         models.AccountingAccount.findAll({ attributes: ['entity_id'], group: ['entity_id'], raw: true }),
         models.EntitySiiDocument.findAll({ attributes: ['entity_id'], group: ['entity_id'], raw: true }),
      ]);
      const entityIds = [...new Set([...accRows, ...docRows].map((r) => r.entity_id))].sort((a, b) => a - b);
      const entities = await models.Entity.findAll({ where: { id: entityIds }, order: [['id', 'ASC']] });

      console.log(`Se encontraron ${entities.length} entidades a procesar.`);

      // generateSiiEntries sin filtros procesa TODOS los documentos que aun no tienen asiento
      // y retro-sincroniza conciliaciones: igual que el boton "Sincronizar SII".
      for (const entity of entities) {
         try {
            console.log(`Procesando entidad ID: ${entity.id} - ${entity.legal_name}`);
            const result = await accountingService.generateSiiEntries(entity.id, {});
            console.log(`  -> Generados: ${result.createdCount} | Omitidos (ya existian): ${result.skippedCount}`);
         } catch (err) {
            exitCode = 1;
            console.error(`  -> ERROR procesando entidad ${entity.id}:`, err.message);
         }
      }

      console.log(`[${new Date().toISOString()}] Proceso completado.`);
   } catch (error) {
      exitCode = 1;
      console.error('Error fatal durante la generacion automatica de asientos:', error);
   } finally {
      try { await sequelize.close(); } catch (_) { }
      process.exit(exitCode);
   }
}

run();
