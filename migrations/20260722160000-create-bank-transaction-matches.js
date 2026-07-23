'use strict';

const { BANK_TRANSACTION_MATCH_TABLE } = require('../db/models/bank-transaction-match.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(BANK_TRANSACTION_MATCH_TABLE, {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
         },
         source_bank_transaction_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: { model: 'entity_bank_transactions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
         },
         target_bank_transaction_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: { model: 'entity_bank_transactions', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
         },
         amount_applied: {
            allowNull: false,
            type: Sequelize.DECIMAL(15, 2),
         },
         method: {
            allowNull: false,
            type: Sequelize.STRING(32),
            defaultValue: 'manual',
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
         },
      });

      await queryInterface.addIndex(BANK_TRANSACTION_MATCH_TABLE, ['source_bank_transaction_id'], {
         name: 'idx_bank_tx_matches_source',
      });
      await queryInterface.addIndex(BANK_TRANSACTION_MATCH_TABLE, ['target_bank_transaction_id'], {
         name: 'idx_bank_tx_matches_target',
      });
      await queryInterface.addIndex(BANK_TRANSACTION_MATCH_TABLE, ['source_bank_transaction_id', 'target_bank_transaction_id'], {
         name: 'idx_bank_tx_matches_pair',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(BANK_TRANSACTION_MATCH_TABLE);
   },
};
