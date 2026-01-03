'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // índices compuestos para acelerar verifyRefreshToken (super_admin_id + revoked_at / created_at)
    await queryInterface.addIndex('refresh_tokens_super_admins', ['super_admin_id', 'revoked_at'], {
      name: 'rtsa_super_revoked_idx',
    });
    await queryInterface.addIndex('refresh_tokens_super_admins', ['super_admin_id', 'created_at'], {
      name: 'rtsa_super_created_idx',
    });
    // índice por expiración
    await queryInterface.addIndex('refresh_tokens_super_admins', ['expires_at'], {
      name: 'rtsa_expires_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('refresh_tokens_super_admins', 'rtsa_super_revoked_idx');
    await queryInterface.removeIndex('refresh_tokens_super_admins', 'rtsa_super_created_idx');
    await queryInterface.removeIndex('refresh_tokens_super_admins', 'rtsa_expires_idx');
  },
};
