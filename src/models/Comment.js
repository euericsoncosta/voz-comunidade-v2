import Sequelize, { Model } from 'sequelize';

export default class Comment extends Model {
  static init(sequelize) {
    super.init(
      {
        content: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        reportId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'report_id',
        },
        userId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          field: 'user_id',
        },
        userName: {
          type: Sequelize.STRING,
          allowNull: false,
          field: 'user_name',
        },
      },
      {
        sequelize,
        tableName: 'comments',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Report, { foreignKey: 'report_id', as: 'report' });
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
  }
}
