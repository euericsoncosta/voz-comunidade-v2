'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('reports', 'image_url', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'description', // ignorado fora de MySQL/MariaDB
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('reports', 'image_url');
  },
};
