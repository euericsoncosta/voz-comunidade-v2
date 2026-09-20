import 'dotenv/config';
import readline from 'readline';
import connection from '../src/database/index.js';
import User from '../src/models/User.js';

/**
 * Cria (ou promove) um usuário admin no banco.
 *
 * Uso:
 *   npm run admin:create
 *
 * O script pede nome, email e senha via prompt. Se o email já existir,
 * apenas promove o usuário existente a admin (mantendo a senha).
 * A senha é hasheada pelo hook beforeSave do model User — nunca é
 * gravada em plaintext.
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    if (!silent) {
      rl.question(question, (answer) => resolve(answer.trim()));
      return;
    }
    // Esconde eco da senha no terminal.
    const stdin = process.openStdin();
    process.stdout.write(question);
    let value = '';
    process.stdin.on('data', function handler(char) {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.removeListener('data', handler);
        stdin.pause();
        process.stdout.write('\n');
        resolve(value.trim());
      } else if (char === '\u0003') {
        process.exit(1);
      } else {
        value += char;
      }
    });
  });
}

async function main() {
  console.log('\n=== Criar/promover administrador ===\n');

  const name = await ask('Nome completo: ');
  const email = await ask('E-mail: ');
  const password = await ask('Senha (mín. 8 caracteres): ', { silent: true });
  const confirm = await ask('Confirme a senha: ', { silent: true });

  rl.close();

  if (!name || !email || !password) {
    console.error('\n[ERRO] Nome, e-mail e senha são obrigatórios.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n[ERRO] Senha deve ter no mínimo 8 caracteres.');
    process.exit(1);
  }

  if (password !== confirm) {
    console.error('\n[ERRO] As senhas não coincidem.');
    process.exit(1);
  }

  try {
    const existing = await User.findOne({ where: { email } });

    if (existing) {
      existing.role = 'admin';
      existing.emailVerified = true;
      // Não sobrescreve a senha se o usuário já existir — apenas promove.
      await existing.save();
      console.log(`\n[OK] Usuário existente promovido a admin (e e-mail marcado como verificado): ${email}`);
    } else {
      const user = await User.create({
        name,
        email,
        password,
        role: 'admin',
        emailVerified: true, // admin criado via CLI já vem verificado
      });
      console.log(`\n[OK] Novo administrador criado: ${user.email} (id=${user.id})`);
    }

    await connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[ERRO]', err.message);
    process.exit(1);
  }
}

main();
