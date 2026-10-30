'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      try {
         const table = await queryInterface.describeTable('entity_sii_documents');
         if (!table.accounting_account_id) {
            await queryInterface.addColumn('entity_sii_documents', 'accounting_account_id', {
               type: Sequelize.INTEGER,
               allowNull: true,
               comment: 'Cuenta contable asignada individualmente por excepción a esta factura',
            });
         }
      } catch (err) {
         if (!err.message?.includes('Duplicate column') && !err.original?.code?.includes('ER_DUP_FIELDNAME')) {
            throw err;
         }
      }
   },

   async down(queryInterface, Sequelize) {
      try {
         const table = await queryInterface.describeTable('entity_sii_documents');
         if (table.accounting_account_id) {
            await queryInterface.removeColumn('entity_sii_documents', 'accounting_account_id');
         }
      } catch {
         // ignore
      }
   },
};
