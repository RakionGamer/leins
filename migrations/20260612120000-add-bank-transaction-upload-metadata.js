'use strict';

const { ENTITY_BANK_TRANSACTION_TABLE } = require('../db/models/entity-bank-transaction.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn(ENTITY_BANK_TRANSACTION_TABLE, 'document_ref', {
         allowNull: true,
         type: Sequelize.STRING(100),
      });

      await queryInterface.addColumn(ENTITY_BANK_TRANSACTION_TABLE, 'branch', {
         allowNull: true,
         type: Sequelize.STRING(120),
      });

      await queryInterface.addIndex(ENTITY_BANK_TRANSACTION_TABLE, ['entity_id', 'entity_bank_account_id', 'issued_at', 'type', 'amount'], {
         name: 'idx_bank_tx_import_lookup',
      });
      await queryInterface.addIndex(ENTITY_BANK_TRANSACTION_TABLE, ['document_ref'], {
         name: 'idx_bank_tx_document_ref',
      });
   },

   async down(queryInterface) {
      await queryInterface.removeIndex(ENTITY_BANK_TRANSACTION_TABLE, 'idx_bank_tx_document_ref').catch(() => {});
      await queryInterface.removeIndex(ENTITY_BANK_TRANSACTION_TABLE, 'idx_bank_tx_import_lookup').catch(() => {});
      await queryInterface.removeColumn(ENTITY_BANK_TRANSACTION_TABLE, 'branch');
      await queryInterface.removeColumn(ENTITY_BANK_TRANSACTION_TABLE, 'document_ref');
   },
};
