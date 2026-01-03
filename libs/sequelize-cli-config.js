// libs/sequelize-cli-config.js
require('dotenv').config();

const common = {
   username: process.env.DB_USER,
   password: process.env.DB_PASSWORD,
   database: process.env.DB_NAME,
   host: process.env.DB_HOST,
   port: process.env.DB_PORT,
   dialect: 'mysql',
};

module.exports = {
   development: { ...common, logging: process.env.SEQ_LOG === 'true' ? console.log : false },
   test: { ...common, logging: false },
   production: { ...common, logging: false }
};