import Sequelize, { Model } from 'sequelize';

export default class Like extends Model {
  static init(sequelize) {
    super.init(
      {
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
      },
      {
        sequelize,
        tableName: 'likes',
        underscored: true,
        timestamps: true,
      }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.Report, { foreignKey: 'report_id', as: 'report' });
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}
