import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import './database/index.js';
import routes from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class App {
  constructor() {
    this.server = express();
    this.middlewares();
    this.routes();
    this.errorHandler();
  }

  middlewares() {
    // Atrás de proxy (Render, nginx...), o IP real do cliente vem no header
    // X-Forwarded-For. Sem isto o rate limit por IP enxerga só o IP do proxy
    // e trata todo mundo como a mesma pessoa. TRUST_PROXY = nº de proxies à
    // frente do app; em produção o padrão é 1; "0" desliga.
    const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
    if (trustProxy && trustProxy !== '0' && trustProxy !== 'false') {
      this.server.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
    }

    // CORS
    const origins = (process.env.CORS_ORIGINS || '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.server.use(
      cors({
        origin: origins.includes('*') ? true : origins,
        credentials: false, // JWT vai no header Authorization; não precisamos de cookies.
      })
    );

    this.server.use(express.json());
    this.server.use(express.urlencoded({ extended: true }));

    // Estáticos (uploads locais, caso não use Cloudinary sempre).
    this.server.use(
      '/uploads',
      express.static(path.resolve(__dirname, '..', 'public', 'uploads'))
    );

    // Healthcheck simples.
    this.server.get('/health', (req, res) => res.json({ status: 'ok' }));
  }

  routes() {
    this.server.use(routes);
  }

  errorHandler() {
    // Handler global — evita processo cair por erro não tratado no controller.
    this.server.use((err, req, res, next) => {
      console.error('[UNHANDLED ERROR]:', err);
      if (res.headersSent) return next(err);
      res.status(500).json({
        status: 'error',
        message: 'Erro interno inesperado.',
      });
    });
  }
}

export default new App().server;
