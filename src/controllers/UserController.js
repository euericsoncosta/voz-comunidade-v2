import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { dispatchVerification } from './VerificationController.js';

/**
 * UserController — cadastro e gestão de usuários.
 *
 * v3: signup NÃO faz mais auto-login. Cria a conta com email_verified=false,
 * dispara o e-mail de verificação e devolve uma mensagem pro cliente.
 * O usuário só consegue logar depois de clicar no link do e-mail.
 */
class UserController {
  async index(req, res) {
    try {
      const users = await User.findAll({
        order: [['name', 'ASC']],
        attributes: {
          exclude: ['password', 'verificationToken', 'passwordResetToken', 'passwordResetExpiresAt'],
        },
      });
      return res.json({ status: 'success', data: users });
    } catch (error) {
      console.error('[API USER INDEX ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao carregar usuários.',
      });
    }
  }

  async store(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          status: 'error',
          message: 'Nome, e-mail e senha são obrigatórios.',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'A senha deve ter no mínimo 6 caracteres.',
        });
      }

      const exists = await User.findOne({ where: { email } });
      if (exists) {
        return res.status(400).json({
          status: 'error',
          message: 'Este e-mail já está cadastrado.',
        });
      }

      const newUser = await User.create({
        name,
        email,
        password,
        role: 'citizen',
        emailVerified: false,
      });

      // Dispara e-mail de verificação. Se falhar, o cadastro segue e o
      // usuário pode pedir reenvio depois.
      await dispatchVerification(newUser);

      return res.status(201).json({
        status: 'success',
        message: 'Cadastro realizado. Verifique seu e-mail para ativar a conta.',
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          emailVerified: newUser.emailVerified,
        },
      });
    } catch (error) {
      console.error('[API USER STORE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro interno ao processar o cadastro.',
      });
    }
  }

  async update(req, res) {
    try {
      const targetId = Number(req.params.id);
      const { name, email, role } = req.body;

      if (Number.isNaN(targetId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' });
      }

      const isSelfEdit = targetId === req.userId;
      const isAdmin = req.userRole === 'admin';

      if (!isSelfEdit && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Você só pode editar sua própria conta.',
        });
      }

      const user = await User.findByPk(targetId);
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
      }

      const patch = {};
      if (typeof name === 'string' && name.trim()) patch.name = name.trim();
      if (typeof email === 'string' && email.trim()) patch.email = email.trim();
      if (isAdmin && (role === 'citizen' || role === 'admin')) patch.role = role;

      await user.update(patch);

      return res.json({
        status: 'success',
        message: 'Dados atualizados.',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      console.error('[API USER UPDATE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Falha ao atualizar os dados.',
      });
    }
  }

  async delete(req, res) {
    try {
      const targetId = Number(req.params.id);
      if (Number.isNaN(targetId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' });
      }

      const user = await User.findByPk(targetId);
      if (!user) {
        return res.status(404).json({ status: 'error', message: 'Usuário não encontrado.' });
      }

      if (user.id === req.userId) {
        return res.status(400).json({
          status: 'error',
          message: 'Você não pode excluir a própria conta administrativa por esta rota.',
        });
      }

      await user.destroy();
      return res.json({ status: 'success', message: 'Usuário removido.' });
    } catch (error) {
      console.error('[API USER DELETE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao tentar remover o usuário.',
      });
    }
  }
}

export default new UserController();
