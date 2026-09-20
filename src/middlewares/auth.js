import jwt from 'jsonwebtoken';

/**
 * Auth Middleware — valida o JWT do header Authorization.
 *
 * Depois de passar aqui, todo controller pode confiar em:
 *   req.userId    — id do usuário autenticado
 *   req.userName  — nome do usuário (para gravar autoria)
 *   req.userRole  — 'citizen' ou 'admin'
 *
 * NUNCA mais leia userId do req.body ou req.query — é a origem
 * dos bugs de impersonação que a versão anterior tinha.
 */
export default (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Autenticação necessária.',
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Token vazio.',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    req.userName = payload.name;
    req.userRole = payload.role;
    return next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({
      status: 'error',
      message: isExpired ? 'Sessão expirada. Faça login novamente.' : 'Token inválido.',
    });
  }
};
