const { Sequelize } = require('sequelize');
const { config } = require('./../config/config');
const setupModels = require('./../db/models');

const USER = encodeURIComponent(config.dbUser);
const PASSWORD = encodeURIComponent(config.dbPassword);
const URI = `mysql://${USER}:${PASSWORD}@${config.dbHost}:${config.dbPort}/${config.dbName}`;

const isProd = process.env.NODE_ENV === 'production';

// ✅ sin logs SQL en producción (puedes activar con SEQ_LOG=true si quieres)
const isLogOn = process.env.SEQ_LOG === 'true';

const sequelize = new Sequelize(URI, {
   dialect: 'mysql',
   logging: isProd ? false : (isLogOn ? console.log : false),
   // si quieres medir tiempos de consulta, activa SEQ_LOG y benchmark
   benchmark: !isProd && isLogOn,
   pool: { max: 10, min: 1, idle: 10_000, acquire: 30_000 },
});

// Registra modelos
setupModels(sequelize);

// Inicia conexión (sin sync en prod)
(async () => {
   try {
      await sequelize.authenticate();

      // Asegurar columna de excepción contable en entity_sii_documents si no existe
      try {
         const [results] = await sequelize.query(`
            SELECT COUNT(*) AS cnt 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'entity_sii_documents' 
              AND COLUMN_NAME = 'accounting_account_id'
         `);
         const count = Number(results[0]?.cnt || results[0]?.CNT || 0);
         if (count === 0) {
            await sequelize.query(`
               ALTER TABLE entity_sii_documents 
               ADD COLUMN accounting_account_id INT NULL
            `);
         }
      } catch {
         // Silently ignore si la tabla aun no existe
      }

      // Asegurar índices de alto rendimiento para búsqueda instantánea de conciliaciones
      try {
         await sequelize.query(`CREATE INDEX idx_btd_doc ON bank_transaction_documents (entity_sii_document_id)`);
      } catch {}
      try {
         await sequelize.query(`CREATE INDEX idx_btd_tx ON bank_transaction_documents (entity_bank_transaction_id)`);
      } catch {}

      if (!isProd) {
         // Ejecuta sync solo si lo pides explícitamente en dev
         if (process.env.DB_SYNC === 'true') {
            await sequelize.sync(process.env.DB_SYNC_FORCE === 'true'
               ? { force: true }
               : process.env.DB_SYNC_ALTER === 'true'
                  ? { alter: true }
                  : {}
            );
         }
      }
   } catch (error) {
      // en prod evita imprimir detalles sensibles
      if (!isProd) console.error('Error al conectar o sincronizar la base de datos:', error);
      else console.error('Error al iniciar la base de datos');
   }
})();

module.exports = { sequelize, models: sequelize.models };