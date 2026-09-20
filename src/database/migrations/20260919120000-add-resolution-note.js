'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('reports', 'resolution_note', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'status', // ignorado fora de MySQL/MariaDB
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('reports', 'resolution_note');
  },
};
