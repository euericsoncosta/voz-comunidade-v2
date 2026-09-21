import crypto from 'crypto';
import User from '../models/User.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { getBaseUrl } from '../config/baseUrl.js';

/**
 * PasswordResetController — redefinição de senha por e-mail.
 *
 * Fluxo:
 *   1. POST /forgot-password { email }  → gera token, manda o link por e-mail.
 *      Sempre responde igual (exista a conta ou não) pra não revelar
 *      quais e-mails estão cadastrados. Protegido por rate limit (ver
 *      middlewares/rateLimit.js e routes.js).
 *   2. GET  /reset-password/:token      → serve a página HTML com o formulário
 *      de nova senha (mesmo padrão do /verify-email/:token).
 *   3. POST /reset-password { token, password } → grava a nova senha e
 *      invalida o token. Chamado pela própria página do passo 2.
 *
 * O token (32 bytes aleatórios, 64 chars hex) só existe no e-mail; no banco
 * fica apenas o SHA-256 dele. Cada pedido novo invalida o link anterior.
 */

const MIN_PASSWORD_LENGTH = 6; // mesma regra do cadastro
const TOKEN_FORMAT = /^[a-f0-9]{64}$/;

const GENERIC_REQUEST_MESSAGE =
  'Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique sua caixa de entrada.';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const tokenTtlMinutes = () => Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 60;

class PasswordResetController {
  /**
   * POST /forgot-password { email }
   */
  async request(req, res) {
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'E-mail obrigatório.',
        });
      }

      const user = await User.findOne({ where: { email } });

      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const ttl = tokenTtlMinutes();

        user.passwordResetToken = hashToken(token);
        user.passwordResetExpiresAt = new Date(Date.now() + ttl * 60 * 1000);
        await user.save();

        // Não espera o SMTP: a resposta demora o mesmo com ou sem conta,
        // então o tempo de resposta também não denuncia e-mails cadastrados.
        sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: `${getBaseUrl()}/reset-password/${token}`,
          expiresInMinutes: ttl,
        }).catch((err) => console.error('[RESET EMAIL ERROR]:', err.message));
      }

      return res.json({ status: 'success', message: GENERIC_REQUEST_MESSAGE });
    } catch (error) {
      console.error('[FORGOT PASSWORD ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao processar o pedido de redefinição.',
      });
    }
  }

  /**
   * GET /reset-password/:token
   * Página pública. Serve HTML.
   */
  async showForm(req, res) {
    try {
      const { token } = req.params;

      if (!TOKEN_FORMAT.test(token)) {
        return servePage(res, 400, renderStatusPage('invalid'));
      }

      const user = await User.findOne({ where: { passwordResetToken: hashToken(token) } });

      if (!user) {
        return servePage(res, 404, renderStatusPage('invalid'));
      }

      if (!user.isPasswordResetTokenValid()) {
        return servePage(res, 410, renderStatusPage('expired'));
      }

      const nonce = crypto.randomBytes(16).toString('base64');
      return servePage(res, 200, renderFormPage({ token, nonce }), nonce);
    } catch (error) {
      console.error('[RESET FORM ERROR]:', error);
      return servePage(res, 500, renderStatusPage('error'));
    }
  }

  /**
   * POST /reset-password { token, password }
   */
  async reset(req, res) {
    try {
      const token = req.body?.token;
      const password = req.body?.password;

      if (typeof token !== 'string' || !TOKEN_FORMAT.test(token)) {
        return res.status(400).json({
          status: 'error',
          code: 'invalid_token',
          message: 'Link inválido. Peça um novo pelo aplicativo.',
        });
      }

      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          status: 'error',
          code: 'weak_password',
          message: `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
        });
      }

      const user = await User.findOne({ where: { passwordResetToken: hashToken(token) } });

      if (!user) {
        return res.status(400).json({
          status: 'error',
          code: 'invalid_token',
          message: 'Este link é inválido ou já foi usado. Peça um novo pelo aplicativo.',
        });
      }

      if (!user.isPasswordResetTokenValid()) {
        return res.status(410).json({
          status: 'error',
          code: 'token_expired',
          message: 'Este link expirou. Peça um novo pelo aplicativo.',
        });
      }

      // O hook beforeSave do model faz o hash (bcrypt) da nova senha.
      user.password = password;
      user.passwordResetToken = null;
      user.passwordResetExpiresAt = null;
      await user.save();

      return res.json({
        status: 'success',
        message: 'Senha redefinida com sucesso. Agora você já pode entrar com a nova senha.',
      });
    } catch (error) {
      console.error('[RESET PASSWORD ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao redefinir a senha.',
      });
    }
  }
}

/**
 * Envia a página HTML com cabeçalhos de segurança. O token está na URL,
 * então: nada de cache, nada de Referer, e a página não pode ser embutida
 * em iframe. O script inline só roda com o nonce gerado nesta resposta.
 */
function servePage(res, status, html, nonce) {
  const scriptSrc = nonce ? `'nonce-${nonce}'` : "'none'";
  return res
    .status(status)
    .set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        `script-src ${scriptSrc}`,
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    })
    .type('html')
    .send(html);
}

const PAGE_STYLES = `
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
      font-size: 40px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
    }
    h1 { font-size: 24px; font-weight: 900; margin: 0 0 8px; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: #64748b; margin: 0 0 24px; }
    p { font-size: 14px; line-height: 22px; color: #475569; margin: 0; }
    label {
      display: block; text-align: left; margin: 16px 0 6px;
      font-size: 10px; font-weight: 900; letter-spacing: 2px; color: #64748b; text-transform: uppercase;
    }
    input {
      width: 100%; padding: 14px 16px; font-size: 16px;
      border: 1px solid #e5e4d7; border-radius: 14px; background: #fff; color: #0f172a;
    }
    input:focus { outline: 2px solid #0f172a; outline-offset: 1px; }
    button {
      width: 100%; margin-top: 24px; padding: 16px; border: 0; border-radius: 14px;
      background: #0f172a; color: #fff; cursor: pointer;
      font-size: 12px; font-weight: 900; letter-spacing: 3px;
    }
    button:disabled { opacity: 0.5; cursor: default; }
    .msg { margin-top: 16px; font-size: 13px; font-weight: 700; min-height: 20px; }
    .msg.error { color: #ea580c; }
    .brand { margin-top: 32px; font-size: 10px; letter-spacing: 3px; font-weight: 900; color: #94a3b8; text-transform: uppercase; }
`;

function renderStatusPage(kind) {
  const configs = {
    expired: {
      emoji: '⏳',
      color: '#f59e0b',
      title: 'Link expirado',
      subtitle: 'Este link de redefinição não vale mais.',
      body: 'Volte ao aplicativo e toque em "Esqueci minha senha" para receber um novo link.',
    },
    invalid: {
      emoji: '×',
      color: '#ef4444',
      title: 'Link inválido',
      subtitle: 'Não conseguimos identificar este link.',
      body: 'Ele pode ter sido usado, substituído por um mais recente ou alterado. Peça um novo pelo aplicativo.',
    },
    error: {
      emoji: '!',
      color: '#ef4444',
      title: 'Algo deu errado',
      subtitle: 'Ocorreu um erro ao abrir a redefinição de senha.',
      body: 'Tente novamente em alguns instantes.',
    },
  };

  const c = configs[kind] || configs.error;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Voz da Comunidade — ${escapeHtml(c.title)}</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="card">
    <div class="icon" style="background:${c.color}22;color:${c.color};">${c.emoji}</div>
    <h1>${escapeHtml(c.title)}</h1>
    <p class="subtitle">${escapeHtml(c.subtitle)}</p>
    <p>${escapeHtml(c.body)}</p>
    <div class="brand">Voz da Comunidade</div>
  </div>
</body>
</html>`;
}

function renderFormPage({ token, nonce }) {
  // `token` já foi validado contra /^[a-f0-9]{64}$/ — seguro de embutir no script.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Voz da Comunidade — nova senha</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="card">
    <div id="view-form">
      <div class="icon" style="background:#0f172a22;color:#0f172a;">&#128274;</div>
      <h1>Nova senha</h1>
      <p class="subtitle">Escolha uma senha nova para a sua conta.</p>
      <form id="form" novalidate>
        <label for="p1">Nova senha</label>
        <input id="p1" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD_LENGTH}" placeholder="Mínimo ${MIN_PASSWORD_LENGTH} caracteres" required>
        <label for="p2">Confirmar nova senha</label>
        <input id="p2" type="password" autocomplete="new-password" placeholder="Digite novamente" required>
        <div id="msg" class="msg" role="alert"></div>
        <button id="btn" type="submit">REDEFINIR SENHA</button>
      </form>
    </div>
    <div id="view-done" hidden>
      <div class="icon" style="background:#10b98122;color:#10b981;">✓</div>
      <h1>Senha alterada!</h1>
      <p>Pronto. Volte ao aplicativo e entre com a sua nova senha.</p>
    </div>
    <div class="brand">Voz da Comunidade</div>
  </div>
  <script nonce="${nonce}">
    (function () {
      var token = ${JSON.stringify(token)};
      var minLength = ${MIN_PASSWORD_LENGTH};
      var form = document.getElementById('form');
      var btn = document.getElementById('btn');
      var msg = document.getElementById('msg');

      function showError(text) {
        msg.className = 'msg error';
        msg.textContent = text;
      }
      function resetButton() {
        btn.disabled = false;
        btn.textContent = 'REDEFINIR SENHA';
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var p1 = document.getElementById('p1').value;
        var p2 = document.getElementById('p2').value;

        if (p1.length < minLength) return showError('A senha deve ter no mínimo ' + minLength + ' caracteres.');
        if (p1 !== p2) return showError('As senhas não coincidem.');

        msg.textContent = '';
        btn.disabled = true;
        btn.textContent = 'SALVANDO...';

        fetch('/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, password: p1 })
        })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
              return { ok: res.ok, data: data };
            });
          })
          .then(function (result) {
            if (result.ok && result.data.status === 'success') {
              document.getElementById('view-form').hidden = true;
              document.getElementById('view-done').hidden = false;
            } else {
              showError(result.data.message || 'Não foi possível redefinir a senha.');
              resetButton();
            }
          })
          .catch(function () {
            showError('Erro de conexão. Tente novamente.');
            resetButton();
          });
      });
    })();
  </script>
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

export default new PasswordResetController();
