'use strict';

module.exports = {
   up: async (queryInterface, Sequelize) => {
      await queryInterface.addColumn('accounting_accounts', 'require_rut', {
         type: Sequelize.BOOLEAN,
         allowNull: false,
         defaultValue: false,
      });

      await queryInterface.addColumn('accounting_accounts', 'require_reference', {
         type: Sequelize.BOOLEAN,
         allowNull: false,
         defaultValue: false,
      });

      await queryInterface.addColumn('accounting_accounts', 'is_auxiliary', {
         type: Sequelize.BOOLEAN,
         allowNull: false,
         defaultValue: false,
      });

      await queryInterface.addColumn('accounting_accounts', 'cash_flow_classification', {
         type: Sequelize.ENUM("OPERACIONAL", "INVERSION", "FINANCIAMIENTO", "NONE"),
         allowNull: false,
         defaultValue: "NONE",
      });
   },

   down: async (queryInterface, Sequelize) => {
      await queryInterface.removeColumn('accounting_accounts', 'require_rut');
      await queryInterface.removeColumn('accounting_accounts', 'require_reference');
      await queryInterface.removeColumn('accounting_accounts', 'is_auxiliary');
      await queryInterface.removeColumn('accounting_accounts', 'cash_flow_classification');
   }
};
