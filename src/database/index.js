import Sequelize from 'sequelize';
import config from '../config/database.cjs';

import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
import Report from '../models/Report.js';
import User from '../models/User.js';

const models = [User, Report, Comment, Like];

const connection = new Sequelize(config);

// Inicializa e associa modelos.
// Se algo estiver errado aqui, queremos que o processo caia.
try {
  models.forEach((model) => model.init(connection));
  models.forEach((model) => {
    if (model.associate) model.associate(connection.models);
  });
} catch (error) {
  console.error('[DB INIT ERROR]:', error);
  process.exit(1);
}

// Ping opcional na conexão (não trava se o banco demorar; só loga).
connection
  .authenticate()
  .then(() => console.log('[DB] Conexão estabelecida.'))
  .catch((err) => {
    console.error('[DB] Falha na conexão:', err.message);
    process.exit(1);
  });

export default connection;
