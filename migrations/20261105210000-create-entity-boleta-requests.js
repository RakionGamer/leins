'use strict';

const { ENTITY_BOLETA_REQUEST_TABLE } = require('../db/models/entity-boleta-request.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(ENTITY_BOLETA_REQUEST_TABLE, {
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
         bank_transaction_id: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         amount: {
            allowNull: false,
            type: Sequelize.DECIMAL(15, 2),
         },
         net_amount: {
            allowNull: true,
            type: Sequelize.DECIMAL(15, 2),
         },
         vat_amount: {
            allowNull: true,
            type: Sequelize.DECIMAL(15, 2),
         },
         description: {
            allowNull: true,
            type: Sequelize.STRING(500),
         },
         customer_rut: {
            allowNull: true,
            type: Sequelize.STRING(20),
         },
         customer_name: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         is_exempt: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: true,
         },
         doc_type_code: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 41,
         },
         status: {
            allowNull: false,
            type: Sequelize.STRING(30),
            defaultValue: 'pending',
         },
         folio: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         pdf_path: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         pdf_filename: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         sii_document_id: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         error_message: {
            allowNull: true,
            type: Sequelize.TEXT,
         },
         created_by: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         completed_at: {
            allowNull: true,
            type: Sequelize.DATE,
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

      await queryInterface.addIndex(ENTITY_BOLETA_REQUEST_TABLE, ['status'], {
         name: 'idx_boleta_requests_status',
      });
      await queryInterface.addIndex(ENTITY_BOLETA_REQUEST_TABLE, ['bank_transaction_id'], {
         name: 'idx_boleta_requests_bank_tx',
      });
      await queryInterface.addIndex(ENTITY_BOLETA_REQUEST_TABLE, ['entity_id', 'status'], {
         name: 'idx_boleta_requests_entity_status',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(ENTITY_BOLETA_REQUEST_TABLE);
   },
};
