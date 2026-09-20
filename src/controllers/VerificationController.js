import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { sendVerificationEmail } from '../services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * VerificationController — confirmação de e-mail.
 *
 * Fluxo:
 *   1. Usuário se cadastra → UserController.store gera token e chama
 *      dispatchVerification(user) (helper abaixo). O token vai por e-mail.
 *   2. Usuário clica no link → GET /verify-email/:token → verifyEmail
 *      valida, marca email_verified=true e serve página HTML.
 *   3. Se o link expirou → POST /resend-verification { email } →
 *      resend gera novo token e reenvia.
 */
class VerificationController {
  /**
   * GET /verify-email/:token
   * Página pública. Serve HTML.
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;

      if (!token || token.length < 32) {
        return servePage(res, 400, 'invalid');
      }

      const user = await User.findOne({ where: { verificationToken: token } });

      if (!user) {
        return servePage(res, 404, 'invalid');
      }

      if (user.emailVerified) {
        // Já verificado antes — trata como sucesso.
        return servePage(res, 200, 'success', { name: user.name });
      }

      if (!user.isVerificationTokenValid()) {
        return servePage(res, 410, 'expired', { email: user.email });
      }

      user.emailVerified = true;
      user.verificationToken = null;
      user.verificationSentAt = null;
      await user.save();

      return servePage(res, 200, 'success', { name: user.name });
    } catch (error) {
      console.error('[VERIFY EMAIL ERROR]:', error);
      return servePage(res, 500, 'error');
    }
  }

  /**
   * POST /resend-verification { email }
   * Público. Nunca revela se o e-mail existe (retorna 200 mesmo se não).
   */
  async resend(req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail obrigatório.',
        });
      }

      const user = await User.findOne({ where: { email } });

      // Respostas idênticas para email inexistente e email já verificado —
      // evita que um atacante descubra se determinado email tem conta.
      if (!user || user.emailVerified) {
        return res.json({
          status: 'success',
          message: 'Se este e-mail estiver cadastrado e pendente de confirmação, um novo link foi enviado.',
        });
      }

      await dispatchVerification(user);

      return res.json({
        status: 'success',
        message: 'Se este e-mail estiver cadastrado e pendente de confirmação, um novo link foi enviado.',
      });
    } catch (error) {
      console.error('[RESEND VERIFICATION ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao processar reenvio.',
      });
    }
  }
}

/**
 * Gera novo token, salva no usuário e dispara o e-mail.
 * Usado pelo UserController (após signup) e pelo resend acima.
 */
export async function dispatchVerification(user) {
  const token = crypto.randomBytes(32).toString('hex'); // 64 chars
  user.verificationToken = token;
  user.verificationSentAt = new Date();
  await user.save();

  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const verifyUrl = `${baseUrl}/verify-email/${token}`;

  return sendVerificationEmail({
    to: user.email,
    name: user.name,
    verifyUrl,
  });
}

/**
 * Serve a página HTML de status.
 * kind ∈ { success, expired, invalid, error }
 */
function servePage(res, status, kind, params = {}) {
  const html = renderPage(kind, params);
  return res
    .status(status)
    .set('Content-Type', 'text/html; charset=utf-8')
    .send(html);
}

function renderPage(kind, { name = '', email = '' } = {}) {
  const configs = {
    success: {
      emoji: '✓',
      color: '#10b981',
      title: 'E-mail confirmado!',
      subtitle: name ? `Bem-vindo(a), ${escapeHtml(name)}.` : '',
      body: 'Sua conta está ativada. Agora você já pode abrir o app e fazer login.',
      button: null,
    },
    expired: {
      emoji: '⏳',
      color: '#f59e0b',
      title: 'Link expirado',
      subtitle: 'Este link tem validade de 24 horas.',
      body: 'Volte ao aplicativo e solicite um novo e-mail de confirmação na tela de login.',
      button: null,
    },
    invalid: {
      emoji: '×',
      color: '#ef4444',
      title: 'Link inválido',
      subtitle: 'Não conseguimos identificar este link de confirmação.',
      body: 'Ele pode ter sido usado, alterado ou já expirado. Solicite um novo pelo aplicativo.',
      button: null,
    },
    error: {
      emoji: '!',
      color: '#ef4444',
      title: 'Algo deu errado',
      subtitle: 'Ocorreu um erro ao processar sua confirmação.',
      body: 'Tente novamente em alguns instantes. Se o problema persistir, solicite um novo link.',
      button: null,
    },
  };

  const c = configs[kind] || configs.error;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voz da Comunidade — ${escapeHtml(c.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: #fdfcf0; color: #0f172a;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff; border-radius: 20px; padding: 40px 32px;
      max-width: 440px; width: 100%;
      box-shadow: 0 8px 40px rgba(0,0,0,0.06);
      text-align: center;
    }
    .icon {
      width: 72px; height: 72px; border-radius: 50%;
      background: ${c.color}22; color: ${c.color};
      font-size: 40px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 24px; font-weight: 900;
      margin: 0 0 8px; letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px; color: #64748b; margin: 0 0 24px;
    }
    p {
      font-size: 14px; line-height: 22px; color: #475569;
      margin: 0;
    }
    .brand {
      margin-top: 32px; font-size: 10px; letter-spacing: 3px;
      font-weight: 900; color: #94a3b8; text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${c.emoji}</div>
    <h1>${escapeHtml(c.title)}</h1>
    ${c.subtitle ? `<p class="subtitle">${escapeHtml(c.subtitle)}</p>` : ''}
    <p>${escapeHtml(c.body)}</p>
    <div class="brand">Voz da Comunidade</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default new VerificationController();
