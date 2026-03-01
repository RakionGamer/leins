'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('entity_sii_documents', 'operation_type', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Define si el documento es de venta (INCOME) o compra (EXPENSE)'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('entity_sii_documents', 'operation_type');
  }
};