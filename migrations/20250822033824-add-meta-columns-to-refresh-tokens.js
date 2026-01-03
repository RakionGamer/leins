'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('refresh_tokens_super_admins', 'ip', {
      type: Sequelize.STRING(45), allowNull: true,
    });
    await queryInterface.addColumn('refresh_tokens_super_admins', 'user_agent', {
      type: Sequelize.STRING(255), allowNull: true,
    });
    await queryInterface.addColumn('refresh_tokens_super_admins', 'last_used_at', {
      type: Sequelize.DATE, allowNull: true,
    });
    await queryInterface.addIndex('refresh_tokens_super_admins', ['super_admin_id', 'last_used_at'], {
      name: 'rtsa_super_lastused_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('refresh_tokens_super_admins', 'rtsa_super_lastused_idx');
    await queryInterface.removeColumn('refresh_tokens_super_admins', 'ip');
    await queryInterface.removeColumn('refresh_tokens_super_admins', 'user_agent');
    await queryInterface.removeColumn('refresh_tokens_super_admins', 'last_used_at');
  },
};
