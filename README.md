# Voz da Comunidade — API v2.1

Backend com **autenticação JWT** e **verificação de e-mail obrigatória**.
Todos os endpoints (exceto os públicos abaixo) exigem token válido.

---

## O que mudou nesta versão (v2.1)

- **Verificação de e-mail** obrigatória antes do primeiro login.
- Novo `VerificationController` com duas rotas públicas:
  - `GET /verify-email/:token` — página HTML servida pelo próprio backend
  - `POST /resend-verification` — reenvia link (mensagem genérica pra não
    revelar quais e-mails têm conta)
- Signup **não faz mais auto-login**. Retorna 201 pedindo pro usuário
  conferir a caixa de entrada.
- Login retorna `403 { code: 'email_not_verified' }` se a conta ainda
  não foi confirmada — o app pode usar esse `code` pra oferecer o botão
  "reenviar e-mail".
- Novos campos em `users`: `email_verified`, `verification_token`,
  `verification_sent_at`. Migration inclusa.
- Nova dependência: `nodemailer`.
- Admin criado via `npm run admin:create` já vem com `email_verified=true`.

## Atualizações depois da v2.1

### Nota de resolução nos relatos

Quando o admin marca um relato como resolvido, ele pode explicar **o que foi
feito** — o morador vê esse texto no detalhe do relato.

- Nova coluna `reports.resolution_note` (TEXT, opcional) — migration
  `20260919120000-add-resolution-note`. O campo sai como `resolutionNote`
  (`null` quando não há) em `/feed`, `/reports/view/:id` e `/admin/dashboard`.
- `POST /reports/update/:id` (admin) agora aceita `{ status, resolutionNote? }`:
  - `resolutionNote` ausente → mantém a nota que já existia;
  - string preenchida → grava; string vazia → apaga (vira `null`).
  - Reabrir um relato (`pendente`) sem mandar a nota mantém a anterior, como
    histórico.

### Redefinição de senha por e-mail + rate limit

Novas rotas públicas `POST /forgot-password`, `GET /reset-password/:token` e
`POST /reset-password` (detalhes na seção [Redefinição de senha](#redefinição-de-senha)).

- Pedido de reset com **rate limit em duas camadas** (por IP e por e-mail),
  usando `express-rate-limit` (nova dependência) — ver `src/middlewares/rateLimit.js`.
- Novos campos em `users`: `password_reset_token` (guarda o SHA-256 do token,
  nunca o token) e `password_reset_expires_at` — migration
  `20260919130000-add-password-reset`.
- Novas variáveis de ambiente: `PASSWORD_RESET_TTL_MINUTES`,
  `RESET_LIMIT_IP_MAX`, `RESET_LIMIT_IP_WINDOW_MIN`, `RESET_LIMIT_EMAIL_MAX`,
  `RESET_LIMIT_EMAIL_WINDOW_MIN` e `TRUST_PROXY` (ver `.env.example`).
- `app.js` passou a configurar `trust proxy` (padrão `1` em produção) pro
  limite por IP enxergar o IP real atrás do Render.
- `GET /usuarios` também deixa de expor os campos de reset.

### Migrations novas usam `.cjs`

O package é ESM (`"type": "module"`), e o `sequelize-cli` não consegue carregar
migrations `.js` escritas em CommonJS (erro `module is not defined`). As migrations
antigas continuam `.js` porque já estão registradas no `SequelizeMeta` com esse
nome — **renomear uma migration já aplicada faz o CLI tratá-la como pendente**.
Toda migration nova deve ser criada com a extensão `.cjs`.

## O que mudou na v2.0 (contexto)

- Auth via JWT (fim do `req.body.userId` como identidade).
- Permissões corrigidas em `UserController.update`, `ReportController.update`,
  `CommentController.delete`.
- Hook `beforeSave` do User agora só re-hasheia senha quando ela muda.
- Fail-fast no `database/index.js`.
- Seeder de admin com senha `123456` removido; substituído por script CLI.

---

## Como rodar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar `.env`

Copie `.env.example` para `.env` e preencha:

```env
JWT_SECRET=<gere com openssl rand -hex 64>
APP_BASE_URL=http://localhost:3000    # em prod: https://sua-api.com

DB_HOST=...
DB_USER=...
DB_PASS=...
DB_NAME=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=<senha de app do Gmail>
SMTP_FROM="Voz da Comunidade <seu-email@gmail.com>"
```

**Sobre `APP_BASE_URL`:** essa URL é usada para construir os links do
e-mail (`APP_BASE_URL/verify-email/TOKEN`). Em produção, precisa ser a
URL pública do backend (ex: `https://voz-da-comunidade-api-1.onrender.com`).

### 3. Configurar o Gmail SMTP

1. Ative 2FA em https://myaccount.google.com/security
2. Gere uma **Senha de app** em https://myaccount.google.com/apppasswords
3. Cole os 16 caracteres em `SMTP_PASS` (sem espaços)

Se `SMTP_HOST/USER/PASS` estiverem vazios, o servidor **não envia**
e-mails — só loga o link no console. Útil pra desenvolver sem SMTP.

#### Hospedando no Render: o Gmail não funciona (`Connection timeout`)

Serviços **gratuitos** do Render não conseguem abrir conexões de saída nas portas
**25, 465 e 587** ([docs](https://render.com/docs/free)). O Gmail só oferece SMTP
nessas portas, então em produção o envio falha com
`[EMAIL ERROR]: Connection timeout` — tanto o e-mail de verificação quanto o de
reset de senha — e o pedido responde `200` do mesmo jeito (a resposta não revela
se o e-mail saiu). Funciona normalmente na sua máquina, o que engana.

Soluções:

- **Provedor com SMTP na porta 2525** (não bloqueada): Brevo, Mailjet, SendGrid e
  Mailgun oferecem. Só troca as variáveis de ambiente no painel do Render, sem
  mexer no código — exemplo com a Brevo (`SMTP_HOST` e login aparecem em
  *SMTP & API* na conta; use a **chave SMTP**, não a chave de API):
  ```env
  SMTP_HOST=smtp-relay.brevo.com
  SMTP_PORT=2525
  SMTP_USER=<login SMTP>
  SMTP_PASS=<chave SMTP>
  SMTP_FROM="Voz da Comunidade <remetente-verificado@seu-dominio>"
  ```
  O remetente (`SMTP_FROM`) precisa estar verificado no provedor. Um remetente
  `@gmail.com` costuma cair em spam por falha de autenticação do domínio (SPF/DKIM);
  o ideal é um domínio próprio.
- Um plano pago do Render, ou uma API HTTP de e-mail (Resend, Brevo API...), que usa
  a porta 443.

O log agora mostra o host:porta e explica esse caso, e a conexão desiste em 10 s
(antes o padrão do nodemailer esperava 2 minutos, deixando o cadastro "pendurado").

### 4. Rodar migrations

```bash
npm run db:migrate
```

Isso aplica todas as migrations pendentes, incluindo
`20260915120000-add-email-verification` (campos de verificação em `users`),
`20260919120000-add-resolution-note` (nota de resolução em `reports`) e
`20260919130000-add-password-reset` (campos de reset de senha em `users`).
Para desfazer a última: `npm run db:rollback`.

> Migrations novas precisam ser `.cjs` — veja
> [Migrations novas usam `.cjs`](#migrations-novas-usam-cjs).

**Já tem usuários no banco?** Eles ficam com `email_verified=false` por
padrão. Você tem duas opções:

- Marcar todos como verificados (aceita legacy):
  ```sql
  UPDATE users SET email_verified = true WHERE email_verified = false;
  ```
- Forçar todos a verificar antes do próximo login: não faz nada (o
  próximo login vai retornar 403; eles pedem reenvio).

### 5. Criar admin

```bash
npm run admin:create
```

Admin criado por aqui já vem com `email_verified=true`.

### 6. Iniciar

```bash
npm start
# ou:
npm run dev
```

---

## Endpoints

> Referência completa (body, respostas, códigos de erro e modelos de dados):
> **[docs/API.md](docs/API.md)**. As tabelas abaixo são só um resumo.

### Públicos

| Método | Rota                        | Descrição                                   |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/login`                    | Autentica; 403 se `email_not_verified`      |
| POST   | `/signup`                   | Cadastra + envia e-mail de verificação      |
| GET    | `/verify-email/:token`      | Confirma e-mail; serve HTML                 |
| POST   | `/resend-verification`      | Reenvia link `{ email }`                    |
| POST   | `/forgot-password`          | Pede link de nova senha `{ email }` (429 se passar do limite) |
| GET    | `/reset-password/:token`    | Formulário de nova senha; serve HTML        |
| POST   | `/reset-password`           | Grava a nova senha `{ token, password }`    |

### Autenticados (JWT no header `Authorization: Bearer ...`)

| Método | Rota                          | Descrição              |
| ------ | ----------------------------- | ---------------------- |
| GET    | `/`                           | Dados do mapa          |
| GET    | `/feed`                       | Timeline               |
| GET    | `/reports/view/:id`           | Detalhe do relato      |
| POST   | `/reports/store`              | Novo relato (com foto) |
| POST   | `/reports/:id/like`           | Toggle apoio           |
| POST   | `/reports/:reportId/comments` | Comentar               |
| POST   | `/comments/delete/:id`        | Apagar comentário      |
| POST   | `/usuarios/update/:id`        | Editar próprios dados  |

### Somente admin

| Método | Rota                       | Descrição                 |
| ------ | -------------------------- | ------------------------- |
| GET    | `/admin/dashboard`         | Todos os relatos          |
| POST   | `/reports/update/:id`      | Mudar status `{ status, resolutionNote? }` |
| POST   | `/reports/delete/:id`      | Apagar relato             |
| GET    | `/usuarios`                | Listar usuários           |
| POST   | `/usuarios/delete/:id`     | Apagar usuário            |

---

## Redefinição de senha

1. `POST /forgot-password { "email": "..." }` gera um token, guarda só o
   **SHA-256** dele no banco (`users.password_reset_token`) e manda o link
   `APP_BASE_URL/reset-password/TOKEN` por e-mail. A resposta é sempre a
   mesma (`200`), exista a conta ou não — não revela quais e-mails estão
   cadastrados. Cada pedido novo invalida o link anterior.
2. O link abre uma página HTML do próprio backend com o formulário de nova
   senha (mesmo padrão do `/verify-email`).
3. A página chama `POST /reset-password { token, password }`: grava a nova
   senha (bcrypt), apaga o token (uso único) e responde `200`. Link
   expirado → `410`; link inválido/já usado → `400`.

Validade do link: `PASSWORD_RESET_TTL_MINUTES` (padrão 60).

### Rate limit do `POST /forgot-password`

Duas camadas, ambas devolvem `429` com `{ code: "rate_limited", retryAfter }`
e o header `Retry-After` (segundos):

| Camada    | Padrão                | Variáveis                                            |
| --------- | --------------------- | ---------------------------------------------------- |
| Por IP    | 5 pedidos / 15 min    | `RESET_LIMIT_IP_MAX`, `RESET_LIMIT_IP_WINDOW_MIN`    |
| Por e-mail| 3 pedidos / 60 min    | `RESET_LIMIT_EMAIL_MAX`, `RESET_LIMIT_EMAIL_WINDOW_MIN` |

O limite por e-mail vale para qualquer endereço digitado (existente ou
não), então o `429` também não revela se a conta existe.

- Os contadores ficam **em memória**: zeram ao reiniciar e não são
  compartilhados entre instâncias (com várias instâncias, use um store
  compartilhado, como Redis).
- Atrás de proxy (Render), o IP real vem em `X-Forwarded-For`. Por isso
  `TRUST_PROXY` vale `1` por padrão em `NODE_ENV=production` (`0` desliga).
  Sem isso todos os clientes caem no mesmo contador.

### Testar

```bash
curl -X POST http://localhost:3000/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@exemplo.com"}'
# Sem SMTP configurado, o link aparece no console: [EMAIL/DEV] Reset de senha para ...
# Abra o link no navegador, defina a nova senha e faça login com ela.
```

---

## Como testar o fluxo de verificação

```bash
# 1. Cadastra
curl -X POST http://localhost:3000/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"teste@exemplo.com","password":"senha123"}'

# resposta:
# { "status":"success", "message":"Cadastro realizado. Verifique seu e-mail...", ... }

# 2. Sem verificar, tenta logar:
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teste@exemplo.com","password":"senha123"}'

# resposta 403:
# { "status":"error", "code":"email_not_verified", ... }

# 3. Abre o link do e-mail (ou copia do console em modo dev):
# GET http://localhost:3000/verify-email/<TOKEN>
# → serve página HTML de sucesso

# 4. Agora o login funciona e retorna token.
```

---

## O que o app mobile precisa mudar

> ✅ Tudo abaixo já foi feito no app mobile (`voz-comunidade-mobile`). Fica
> aqui como referência do contrato entre API e app.

1. **Após signup:** não tentar entrar direto. Mostrar tela "Verifique
   seu e-mail" com botão "reenviar" que chama `POST /resend-verification`.
2. **Ao receber 403 no login com `code: 'email_not_verified'`:** mostrar
   a mesma tela com botão de reenviar.
3. **Salvar o token** no login (não é retornado no signup):
   ```js
   const data = await res.json();
   if (data.token) {
     await AsyncStorage.setItem('vcom_token', data.token);
     await AsyncStorage.setItem('vcom_user', JSON.stringify(data.user));
   }
   ```
4. **Mandar o token** em toda request autenticada (via `apiFetch`):
   ```js
   const token = await AsyncStorage.getItem('vcom_token');
   const headers = {
     ...(options.headers || {}),
     ...(token ? { Authorization: `Bearer ${token}` } : {}),
   };
   ```
5. **Parar de mandar `userId` no body** nas ações (like, comment, etc.).
6. **401 → logout local:** limpar token e mandar pra tela de login.

Se quiser, mando o `helpers.js` e as telas de signup/login/verify
ajustadas na próxima etapa.

---

## Estrutura

```
voz-comunidade-api/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── routes.js
│   ├── config/
│   ├── database/migrations/
│   ├── models/
│   ├── controllers/
│   │   ├── SessionController.js
│   │   ├── UserController.js
│   │   ├── VerificationController.js       ← novo
│   │   ├── PasswordResetController.js      ← novo (reset de senha)
│   │   ├── HomeController.js
│   │   ├── ReportController.js
│   │   ├── CommentController.js
│   │   └── LikeController.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── requireAdmin.js
│   │   └── rateLimit.js                    ← novo (limites do reset de senha)
│   └── services/
│       └── emailService.js                 ← verificação + reset de senha
├── scripts/create-admin.js
└── ...
```

---

## Pendências e possíveis melhorias

O que ainda não foi feito, do mais próximo ao mais opcional.

### Pendências conhecidas

- Rate limiting em `/login`, `/signup` e `/resend-verification` (só o
  `/forgot-password` tem, por enquanto). O `/login` é o mais urgente
  (força bruta de senha) e dá pra reaproveitar o padrão de `rateLimit.js`.
- Refresh tokens / revogação de sessão: hoje o JWT dura 30 dias sem
  revogação — por isso trocar a senha **não derruba** sessões que já
  estejam logadas.
- Logs estruturados.
- Testes automatizados.

### Segurança

- **Derrubar sessões ao redefinir a senha**: guardar `password_changed_at`
  (ou um `token_version`) no usuário e conferir no middleware `auth`.
- Store compartilhado (Redis) para o rate limit se a API passar a rodar em
  mais de uma instância — hoje os contadores ficam em memória.
- `helmet` para cabeçalhos de segurança em todas as rotas (hoje só a página
  de reset define os seus) e `CORS_ORIGINS` restrito em produção (o padrão é `*`).
- Validação de entrada com schema (zod/joi) nos controllers.
- Política de senha única: o cadastro exige 6 caracteres, `admin:create` exige 8.
- Guardar quem fez cada ação de admin (`resolved_by`, `resolved_at`, log de
  auditoria de exclusões).

### Robustez e dados

- **Paginação** em `/feed`, `/admin/dashboard` e `/usuarios` (hoje devolvem
  tudo; o feed só limita aos últimos 60 dias).
- Contagem de curtidas/comentários via SQL (`COUNT`) em vez de carregar todas
  as linhas de `likes` e `comments` de cada relato.
- **Idempotência**: aceitar um `Idempotency-Key` em comentários e relatos. A
  fila offline do app reenvia ações ao reconectar; se a resposta se perder, um
  comentário ou relato pode ser duplicado.
- Erros do `multer` (tipo de arquivo inválido, foto acima de 8 MB) caem no
  handler global e voltam como **500 "Erro interno inesperado."**; deveriam ser
  **400/413** com a mensagem certa (o app tenta reenviar 5xx, então uma foto
  inválida gasta as tentativas antes de o usuário ser avisado).
- *Soft delete* (`paranoid`) em relatos, comentários e usuários apagados por
  admin, pra dar pra desfazer.
- Normalizar `reports.type`: o ENUM usa `'segurança'` (com acento) e o app já
  mandou `'seguranca'` por engano. Aceitar os dois ou migrar para slugs ASCII.
- Rotina periódica para limpar tokens de verificação/reset expirados.
- Padronizar as migrations em `.cjs` (renomear as antigas exige atualizar a
  tabela `SequelizeMeta`) ou migrar o projeto para migrations ESM.

### Funcionalidades

- **Eventos da comunidade** (mutirão de limpeza, vacinação, castração) com
  confirmação de participação — ideia detalhada no README do app mobile.
  Pede tabelas `events` e `event_participants` e, talvez, um papel `agent`.
- **Notificações push** (Expo Push) quando um relato mudar de status, receber
  nota de resolução ou novo comentário.
- Status `rejeitado`: a API já aceita, mas o app não tem tela pra isso — vale
  incluir um motivo da rejeição (nota, como na resolução).
- Rotas que existem e o app ainda não usa: `POST /comments/delete/:id`
  (apagar o próprio comentário), `POST /usuarios/update/:id` (editar perfil)
  e `GET /` (`HomeController`).
- Trocar a senha estando logado (exigindo a senha atual).
- Foto de "depois" ao resolver, e várias fotos por relato.
- Denúncia de relato/comentário para a moderação.
- Filtros no servidor por status, bairro e busca por texto.

### Qualidade e operação

- Testes automatizados. Bons pontos de partida: os cenários do reset de senha
  (fluxo feliz, expiração, reuso de token, não vazar quais e-mails existem,
  limites por IP e por e-mail) e o fluxo de verificação de e-mail.
- `/health` só responde `ok`; poderia checar também a conexão com o banco.
- Documentação OpenAPI/Swagger (a referência em Markdown já existe em
  [docs/API.md](docs/API.md); um `openapi.yaml` permitiria gerar cliente e
  testar as rotas por uma UI).
- `docker-compose` com API + MySQL para subir o ambiente de desenvolvimento.
- Templates de e-mail e páginas HTML compartilhados (hoje o layout está
  repetido no `emailService` e nos controllers de verificação e reset).
- Colocar o envio de e-mail da verificação em segundo plano — o de reset já
  não bloqueia a resposta.
