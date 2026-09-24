'use strict';

// .cjs: o package é ESM ("type": "module"), então migration em CommonJS precisa desta extensão.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'push_token', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'push_token');
  },
};
