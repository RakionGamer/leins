'use strict';

const { DataTypes } = require('sequelize');
const { NOTIFICATION_TABLE } = require('../db/models/notification.model'); // asegurate de que la ruta sea correcta

module.exports = {
   async up(queryInterface, Sequelize) {
      // creamos la tabla notifications
      await queryInterface.createTable('notifications', {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER
         },
         user_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            // si quieres llave foranea con usuarios, descomenta esto:
            // references: { model: 'users', key: 'id' },
            // onUpdate: 'CASCADE',
            // onDelete: 'CASCADE'
         },
         type: {
            allowNull: false,
            type: Sequelize.STRING
         },
         title: {
            allowNull: false,
            type: Sequelize.STRING
         },
         message: {
            allowNull: false,
            type: Sequelize.TEXT
         },
         is_read: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: false
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
         },
         updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW
         }
      });
   },

   async down(queryInterface, Sequelize) {
      // revertir cambios (borrar tabla)
      await queryInterface.dropTable('notifications');
   }
};