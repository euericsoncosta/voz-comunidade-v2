import Sequelize, { Model } from 'sequelize';

export default class Report extends Model {
  static init(sequelize) {
    super.init(
      {
        city: Sequelize.STRING,
        type: Sequelize.ENUM('segurança', 'ambiente', 'infraestrutura'),
        neighborhood: Sequelize.STRING,
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        imageUrl: {
          type: Sequelize.STRING,
          field: 'image_url',
        },
        lat: Sequelize.DECIMAL(10, 8),
        lng: Sequelize.DECIMAL(11, 8),
        status: {
          type: Sequelize.STRING,
          defaultValue: 'pendente',
        },
        resolutionNote: {
          type: Sequelize.TEXT,
          allowNull: true,
          field: 'resolution_note',
        },
        userId: {
          type: Sequelize.INTEGER,
          field: 'user_id',
        },
        userName: {
          type: Sequelize.STRING,
          field: 'user_name',
        },
      },
      {
        sequelize,
        tableName: 'reports',
        underscored: true,
        timestamps: true,
      }
    );

    return this;
  }

  static associate(models) {
    this.hasMany(models.Comment, { foreignKey: 'report_id', as: 'comments' });
    this.hasMany(models.Like, { foreignKey: 'report_id', as: 'likes_list' });
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'author' });
  }
}
