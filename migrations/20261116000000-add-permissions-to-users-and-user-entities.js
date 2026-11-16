'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Agregar columna permissions a users si no existe
    try {
      await queryInterface.addColumn('users', 'permissions', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    } catch (err) {
      // Ignorar si ya existe
    }

    // 2. Agregar columna permissions a user_entities si no existe
    try {
      await queryInterface.addColumn('user_entities', 'permissions', {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: null,
      });
    } catch (err) {
      // Ignorar si ya existe
    }
  },

  down: async (queryInterface) => {
    try {
      await queryInterface.removeColumn('user_entities', 'permissions');
    } catch (err) {}

    try {
      await queryInterface.removeColumn('users', 'permissions');
    } catch (err) {}
  }
};
