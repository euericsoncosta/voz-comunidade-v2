import 'dotenv/config';
import { sendTestEmail } from '../src/services/emailService.js';

/**
 * Testa o envio de e-mail com a configuração SMTP do .env.
 *
 * Uso:
 *   npm run email:test -- seu-email@exemplo.com
 *
 * Confere conexão e login no servidor SMTP e envia uma mensagem de teste.
 * Serve para validar as credenciais (ex.: da Brevo) antes de colocá-las no Render.
 */

const to = process.argv[2];

if (!to) {
  console.error('Uso: npm run email:test -- destinatario@exemplo.com');
  process.exit(1);
}

console.log(
  `Testando SMTP ${process.env.SMTP_HOST || '(vazio)'}:${process.env.SMTP_PORT || 587} ` +
    `(remetente: ${process.env.SMTP_FROM || process.env.SMTP_USER || '(vazio)'})...`
);

const result = await sendTestEmail(to);

if (result.ok) {
  console.log(`\n[OK] E-mail de teste enviado para ${to}. Confira a caixa de entrada (e o spam).`);
  process.exit(0);
}

console.error(`\n[FALHOU] ${result.reason}`);
process.exit(1);
