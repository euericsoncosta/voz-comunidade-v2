import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * SessionController — autenticação via JWT.
 *
 * v3: bloqueia login se email_verified=false. O cliente recebe um código
 * específico ("email_not_verified") pra oferecer o botão de "reenviar".
 */
class SessionController {
  async store(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail e senha são obrigatórios.',
        });
      }

      const user = await User.findOne({ where: { email } });

      // Mesma mensagem para credenciais inválidas — evita enumeração de contas.
      if (!user || !(await user.checkPassword(password))) {
        return res.status(401).json({
          status: 'error',
          message: 'E-mail ou senha incorretos.',
        });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          status: 'error',
          code: 'email_not_verified',
          message: 'Confirme seu e-mail para ativar a conta. Verifique sua caixa de entrada.',
          email: user.email,
        });
      }

      const token = jwt.sign(
        {
          userId: user.id,
          name: user.name,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
      );

      return res.json({
        status: 'success',
        message: 'Autenticação realizada com sucesso.',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('[API LOGIN ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao processar o login.',
      });
    }
  }
}

export default new SessionController();
