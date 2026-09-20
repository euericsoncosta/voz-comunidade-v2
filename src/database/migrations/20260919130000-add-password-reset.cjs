'use strict';

// .cjs: o package é ESM ("type": "module"), então migration em CommonJS precisa desta extensão.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Guarda o HASH (SHA-256, 64 chars hex) do token — o token em si só existe no e-mail.
    await queryInterface.addColumn('users', 'password_reset_token', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'password_reset_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'users_password_reset_token_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('users', 'users_password_reset_token_idx');
    await queryInterface.removeColumn('users', 'password_reset_expires_at');
    await queryInterface.removeColumn('users', 'password_reset_token');
  },
};
