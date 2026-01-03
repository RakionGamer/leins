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