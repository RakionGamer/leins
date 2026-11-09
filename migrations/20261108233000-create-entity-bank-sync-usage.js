'use strict';

const { ENTITY_BANK_SYNC_USAGE_TABLE } = require('../db/models/entity-bank-sync-usage.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(ENTITY_BANK_SYNC_USAGE_TABLE, {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
         },
         entity_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
         },
         period: {
            allowNull: false,
            type: Sequelize.CHAR(7),
         },
         manual_sync_count: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         last_manual_sync_at: {
            allowNull: true,
            type: Sequelize.DATE,
         },
         last_sync_account_id: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
         },
         updated_at: {
            allowNull: true,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
         },
      });

      await queryInterface.addIndex(ENTITY_BANK_SYNC_USAGE_TABLE, ['entity_id', 'period'], {
         name: 'uq_entity_bank_sync_usage_entity_period',
         unique: true,
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(ENTITY_BANK_SYNC_USAGE_TABLE);
   },
};
