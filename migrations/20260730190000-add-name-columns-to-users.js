'use strict';

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn('users', 'name', {
         type: Sequelize.STRING(255),
         allowNull: true,
      });
      await queryInterface.addColumn('users', 'last_name', {
         type: Sequelize.STRING(255),
         allowNull: true,
      });
   },

   async down(queryInterface) {
      await queryInterface.removeColumn('users', 'name');
      await queryInterface.removeColumn('users', 'last_name');
   },
};
