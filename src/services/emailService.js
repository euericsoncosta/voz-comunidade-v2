import nodemailer from 'nodemailer';

/**
 * emailService — envio de emails transacionais.
 *
 * Config vem do .env. O transporter é criado uma vez (não a cada envio).
 * Se as variáveis SMTP não estiverem definidas, os métodos apenas logam
 * e retornam — útil para desenvolvimento sem SMTP.
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[EMAIL] SMTP não configurado. Emails não serão enviados.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL direto; 587 = STARTTLS
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Envia o email de verificação.
 * Retorna true se enviado (ou logado em modo dev), false em erro.
 */
export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const tx = getTransporter();

  const subject = 'Voz da Comunidade — confirme seu e-mail';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = buildVerificationHtml({ name, verifyUrl });
  const text =
    `Olá, ${name}!\n\n` +
    `Confirme seu e-mail para ativar sua conta no Voz da Comunidade:\n\n` +
    `${verifyUrl}\n\n` +
    `Este link expira em 24 horas.\n\n` +
    `Se você não criou uma conta, ignore este e-mail.\n`;

  if (!tx) {
    // Modo dev sem SMTP: loga o link no console pra o desenvolvedor testar.
    console.log(`[EMAIL/DEV] Verificação para ${to}: ${verifyUrl}`);
    return true;
  }

  try {
    await tx.sendMail({ from, to, subject, text, html });
    console.log(`[EMAIL] Verificação enviada para ${to}`);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR]:', err.message);
    return false;
  }
}

/**
 * Envia o email de redefinição de senha.
 * Retorna true se enviado (ou logado em modo dev), false em erro.
 */
export async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const tx = getTransporter();

  const subject = 'Voz da Comunidade — redefinição de senha';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const html = buildPasswordResetHtml({ name, resetUrl, expiresInMinutes });
  const text =
    `Olá, ${name}!\n\n` +
    `Recebemos um pedido para redefinir a senha da sua conta no Voz da Comunidade.\n` +
    `Para criar uma nova senha, abra o link abaixo:\n\n` +
    `${resetUrl}\n\n` +
    `Este link expira em ${expiresInMinutes} minutos e só pode ser usado uma vez.\n\n` +
    `Se você não pediu isso, ignore este e-mail — sua senha continua a mesma.\n`;

  if (!tx) {
    // Modo dev sem SMTP: loga o link no console pra o desenvolvedor testar.
    console.log(`[EMAIL/DEV] Reset de senha para ${to}: ${resetUrl}`);
    return true;
  }

  try {
    await tx.sendMail({ from, to, subject, text, html });
    console.log(`[EMAIL] Reset de senha enviado para ${to}`);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR]:', err.message);
    return false;
  }
}

function buildPasswordResetHtml({ name, resetUrl, expiresInMinutes }) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(resetUrl);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fdfcf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcf0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:2px;">VOZ DA COMUNIDADE</h1>
          <p style="margin:4px 0 0;font-size:11px;font-weight:900;letter-spacing:3px;color:#64748b;text-transform:uppercase;">Identidade Cidadã Horizonte</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;">Olá, ${safeName}!</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">
            Recebemos um pedido para redefinir a senha da sua conta.
            Clique no botão abaixo para criar uma nova senha.
          </p>
          <div style="text-align:center;padding:16px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:3px;padding:16px 32px;border-radius:14px;">REDEFINIR SENHA</a>
          </div>
          <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#64748b;">
            Ou copie e cole este link no navegador:<br>
            <a href="${safeUrl}" style="color:#3b82f6;word-break:break-all;">${safeUrl}</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            Este link expira em ${Number(expiresInMinutes)} minutos e só pode ser usado uma vez.
            Se você não pediu a redefinição, ignore este e-mail — sua senha continua a mesma.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:10px;color:#94a3b8;text-align:center;">
            Voz da Comunidade · Horizonte/CE
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildVerificationHtml({ name, verifyUrl }) {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(verifyUrl);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fdfcf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcf0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:900;letter-spacing:2px;">VOZ DA COMUNIDADE</h1>
          <p style="margin:4px 0 0;font-size:11px;font-weight:900;letter-spacing:3px;color:#64748b;text-transform:uppercase;">Identidade Cidadã Horizonte</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;">Olá, ${safeName}!</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334155;">
            Obrigado por se cadastrar. Para ativar sua conta e começar a
            usar o aplicativo, confirme seu e-mail clicando no botão abaixo.
          </p>
          <div style="text-align:center;padding:16px 0;">
            <a href="${safeUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-weight:900;font-size:12px;letter-spacing:3px;padding:16px 32px;border-radius:14px;">CONFIRMAR E-MAIL</a>
          </div>
          <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#64748b;">
            Ou copie e cole este link no navegador:<br>
            <a href="${safeUrl}" style="color:#3b82f6;word-break:break-all;">${safeUrl}</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
            Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;font-size:10px;color:#94a3b8;text-align:center;">
            Voz da Comunidade · Horizonte/CE
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
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
