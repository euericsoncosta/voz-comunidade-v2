import rateLimit from 'express-rate-limit';

/**
 * Rate limit para pedidos de redefinição de senha.
 *
 * Duas camadas, na ordem em que aparecem no routes.js:
 *   1. por IP     — freia quem dispara pedidos em massa de uma origem só.
 *   2. por e-mail — protege a caixa de entrada de uma pessoa contra
 *                   "mail bombing", mesmo vindo de vários IPs.
 *
 * O contador do e-mail vale para QUALQUER e-mail digitado (existente ou
 * não), então um 429 nunca revela se a conta existe.
 *
 * Os contadores ficam em memória: zeram ao reiniciar o servidor e não são
 * compartilhados entre instâncias. Com mais de uma instância, troque o
 * `store` por um compartilhado (ex.: Redis).
 *
 * Ajustáveis por env (valores padrão entre parênteses):
 *   RESET_LIMIT_IP_MAX (5)        / RESET_LIMIT_IP_WINDOW_MIN (15)
 *   RESET_LIMIT_EMAIL_MAX (3)     / RESET_LIMIT_EMAIL_WINDOW_MIN (60)
 */

const positiveNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const normalizedEmail = (req) => {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const tooManyRequests = (message) => (req, res) => {
  const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
  res.set('Retry-After', String(retryAfter));
  return res.status(429).json({
    status: 'error',
    code: 'rate_limited',
    message,
    retryAfter,
  });
};

export const passwordResetIpLimiter = rateLimit({
  windowMs: positiveNumber(process.env.RESET_LIMIT_IP_WINDOW_MIN, 15) * 60 * 1000,
  limit: positiveNumber(process.env.RESET_LIMIT_IP_MAX, 5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooManyRequests(
    'Muitos pedidos de redefinição de senha. Aguarde alguns minutos e tente novamente.'
  ),
});

export const passwordResetEmailLimiter = rateLimit({
  windowMs: positiveNumber(process.env.RESET_LIMIT_EMAIL_WINDOW_MIN, 60) * 60 * 1000,
  limit: positiveNumber(process.env.RESET_LIMIT_EMAIL_MAX, 3),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `reset-email:${normalizedEmail(req)}`,
  // Sem e-mail no corpo não há o que contar: o controller responde 400
  // (e o limitador por IP já cobre esse caso).
  skip: (req) => !normalizedEmail(req),
  handler: tooManyRequests(
    'Já enviamos pedidos de redefinição para este e-mail recentemente. Aguarde antes de pedir de novo.'
  ),
});
