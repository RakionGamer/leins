require('dotenv').config();
const { sequelize } = require('../db/models');
const models = require('../db/models');
const AccountingService = require('../services/accounting.service');
const accountingService = new AccountingService();

async function run() {
   try {
      console.log('----------------------------------------------------');
      console.log(`[${new Date().toISOString()}] Iniciando generacion automatica de asientos SII...`);
      
      // Obtener todas las entidades activas
      const entities = await models.Entity.findAll({
         where: { is_active: true }
      });

      console.log(`Se encontraron ${entities.length} entidades activas.`);

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // 1-12

      // Opcional: También podríamos pasar el mes anterior si estamos en los primeros días del mes.
      // Para estar seguros, mandaremos a generar sin filtros restrictivos para que genere lo pendiente
      // Pero generateSiiEntries sin parámetros procesa TODOS los documentos que no tienen asiento contable.
      // Eso es perfecto para un cronjob.

      for (const entity of entities) {
         try {
            console.log(`Procesando entidad ID: ${entity.id} - ${entity.business_name}`);
            const result = await accountingService.generateSiiEntries(entity.id, {});
            console.log(`  -> Generados: ${result.createdCount} | Omitidos (ya existían): ${result.skippedCount}`);
         } catch (err) {
            console.error(`  -> ERROR procesando entidad ${entity.id}:`, err.message);
         }
      }

      console.log(`[${new Date().toISOString()}] Proceso completado exitosamente.`);
   } catch (error) {
      console.error('Error fatal durante la generacion automatica de asientos:', error);
      process.exit(1);
   } finally {
      await sequelize.close();
   }
}

run();
