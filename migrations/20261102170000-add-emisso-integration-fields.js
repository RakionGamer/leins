'use strict';

const { ENTITY_BANK_ACCOUNT_TABLE } = require('../db/models/entity-bank-account.model');
const { ENTITY_BANK_TRANSACTION_TABLE } = require('../db/models/entity-bank-transaction.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      // 1. Columnas en entity_bank_accounts
      await queryInterface.addColumn(ENTITY_BANK_ACCOUNT_TABLE, 'emisso_connection_id', {
         type: Sequelize.STRING(120),
         allowNull: true,
      });

      await queryInterface.addColumn(ENTITY_BANK_ACCOUNT_TABLE, 'emisso_system', {
         type: Sequelize.STRING(60),
         allowNull: true,
      });

      await queryInterface.addColumn(ENTITY_BANK_ACCOUNT_TABLE, 'last_synced_at', {
         type: Sequelize.DATE,
         allowNull: true,
      });

      await queryInterface.addColumn(ENTITY_BANK_ACCOUNT_TABLE, 'sync_status', {
         type: Sequelize.STRING(30),
         allowNull: true,
         defaultValue: 'idle',
      });

      await queryInterface.addIndex(ENTITY_BANK_ACCOUNT_TABLE, ['emisso_connection_id'], {
         name: 'idx_bank_account_emisso_conn',
      });

      // 2. Columnas en entity_bank_transactions
      await queryInterface.addColumn(ENTITY_BANK_TRANSACTION_TABLE, 'external_id', {
         type: Sequelize.STRING(100),
         allowNull: true,
      });

      await queryInterface.addColumn(ENTITY_BANK_TRANSACTION_TABLE, 'status', {
         type: Sequelize.STRING(30),
         allowNull: true,
         defaultValue: 'definitivo',
      });

      await queryInterface.addIndex(ENTITY_BANK_TRANSACTION_TABLE, ['external_id'], {
         name: 'idx_bank_tx_external_id',
      });
   },

   async down(queryInterface) {
      await queryInterface.removeIndex(ENTITY_BANK_TRANSACTION_TABLE, 'idx_bank_tx_external_id').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_TRANSACTION_TABLE, 'status').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_TRANSACTION_TABLE, 'external_id').catch(() => {});

      await queryInterface.removeIndex(ENTITY_BANK_ACCOUNT_TABLE, 'idx_bank_account_emisso_conn').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_ACCOUNT_TABLE, 'sync_status').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_ACCOUNT_TABLE, 'last_synced_at').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_ACCOUNT_TABLE, 'emisso_system').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_ACCOUNT_TABLE, 'emisso_connection_id').catch(() => {});
   },
};
