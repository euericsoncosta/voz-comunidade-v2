/**
 * requireAdmin — usar SEMPRE depois do middleware auth.
 * Rejeita qualquer request cujo token não tenha role='admin'.
 */
export default (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Acesso restrito a administradores.',
    });
  }
  return next();
};
