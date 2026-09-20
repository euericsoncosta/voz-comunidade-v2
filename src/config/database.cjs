require('dotenv').config();

/**
 * Config do Sequelize + CLI de migrations.
 * Um único bloco atende dev/prod — as diferenças vêm das variáveis de ambiente.
 */
module.exports = {
  dialect: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
};
