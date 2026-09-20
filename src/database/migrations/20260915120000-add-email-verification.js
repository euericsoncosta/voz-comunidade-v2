'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'email_verified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('users', 'verification_token', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'verification_sent_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Índice para lookup rápido pelo token.
    await queryInterface.addIndex('users', ['verification_token'], {
      name: 'users_verification_token_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('users', 'users_verification_token_idx');
    await queryInterface.removeColumn('users', 'verification_sent_at');
    await queryInterface.removeColumn('users', 'verification_token');
    await queryInterface.removeColumn('users', 'email_verified');
  },
};
