'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn('entity_bank_accounts', 'initial_balance', {
         type: Sequelize.DECIMAL(15, 2),
         allowNull: false,
         defaultValue: 0,
      });
      await queryInterface.addColumn('entity_bank_accounts', 'initial_balance_date', {
         type: Sequelize.DATEONLY,
         allowNull: true,
      });
   },

   async down(queryInterface) {
      await queryInterface.removeColumn('entity_bank_accounts', 'initial_balance_date');
      await queryInterface.removeColumn('entity_bank_accounts', 'initial_balance');
   },
};
