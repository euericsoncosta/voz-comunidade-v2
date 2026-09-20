import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 3000;

// Checagem básica de env crítico. Sem JWT_SECRET, o server nem sobe.
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET não definido. Configure no .env antes de subir o servidor.');
  process.exit(1);
}

const server = app.listen(port, () => {
  console.log(`[HTTP] Servidor rodando em http://localhost:${port}`);
});

// Graceful shutdown.
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    console.log(`\n[HTTP] Recebido ${sig}, encerrando...`);
    server.close(() => process.exit(0));
  });
});
