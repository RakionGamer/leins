'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn('entity_sii_documents', 'accounting_account_id', {
         type: Sequelize.INTEGER,
         allowNull: true,
         comment: 'Cuenta contable asignada individualmente por excepción a esta factura',
      });
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.removeColumn('entity_sii_documents', 'accounting_account_id');
   },
};
