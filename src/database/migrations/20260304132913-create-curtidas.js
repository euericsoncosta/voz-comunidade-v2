'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('likes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      report_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'reports', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { allowNull: false, type: Sequelize.DATE },
      updated_at: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex('likes', ['report_id', 'user_id'], {
      unique: true,
      name: 'unique_like_per_user',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('likes');
  },
};
