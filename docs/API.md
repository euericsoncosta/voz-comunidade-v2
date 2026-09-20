# Voz da Comunidade — Referência da API

Documentação de todos os endpoints da API v2.1. Para instalar e rodar o
projeto, veja o [README](../README.md).

## Índice

- [Convenções](#convenções)
- [Autenticação](#autenticação)
- [Erros comuns](#erros-comuns)
- [Rotas públicas](#rotas-públicas)
  - [GET /health](#get-health)
  - [POST /signup](#post-signup)
  - [POST /login](#post-login)
  - [GET /verify-email/:token](#get-verify-emailtoken)
  - [POST /resend-verification](#post-resend-verification)
  - [POST /forgot-password](#post-forgot-password)
  - [GET /reset-password/:token](#get-reset-passwordtoken)
  - [POST /reset-password](#post-reset-password)
- [Rotas autenticadas (cidadão)](#rotas-autenticadas-cidadão)
  - [GET /](#get-)
  - [GET /feed](#get-feed)
  - [GET /reports/view/:id](#get-reportsviewid)
  - [POST /reports/store](#post-reportsstore)
  - [POST /reports/:id/like](#post-reportsidlike)
  - [POST /reports/:reportId/comments](#post-reportsreportidcomments)
  - [POST /comments/delete/:id](#post-commentsdeleteid)
  - [POST /usuarios/update/:id](#post-usuariosupdateid)
- [Rotas de administrador](#rotas-de-administrador)
  - [GET /admin/dashboard](#get-admindashboard)
  - [POST /reports/update/:id](#post-reportsupdateid)
  - [POST /reports/delete/:id](#post-reportsdeleteid)
  - [GET /usuarios](#get-usuarios)
  - [POST /usuarios/delete/:id](#post-usuariosdeleteid)
- [Modelos de dados](#modelos-de-dados)
- [Rate limit](#rate-limit)
- [Variáveis de ambiente](#variáveis-de-ambiente)

---

## Convenções

- **URL base:** `http://localhost:3000` em desenvolvimento; em produção, o valor
  de `APP_BASE_URL`.
- **Formato:** as requisições enviam `application/json` (ou
  `application/x-www-form-urlencoded`). A única exceção é
  [`POST /reports/store`](#post-reportsstore), que usa `multipart/form-data`.
- **Respostas:** JSON, sempre com o campo `status` igual a `"success"` ou
  `"error"`. As exceções são as páginas HTML de `/verify-email/:token` e
  `/reset-password/:token`.
- **Mensagens:** o campo `message` vem em português e pode ser exibido ao
  usuário. Quando existe, o campo `code` é estável e serve para o app decidir o
  que fazer (ex.: `email_not_verified`).
- **Identidade:** o usuário autenticado vem **sempre do token JWT**. Nenhuma
  rota aceita `userId` no body; se enviado, é ignorado.
- **IDs:** `:id` e `:reportId` são inteiros. Valor não numérico retorna `400`.
- **Ações destrutivas usam POST**, não DELETE (`/reports/delete/:id`,
  `/comments/delete/:id`, `/usuarios/delete/:id`).
- **CORS:** controlado por `CORS_ORIGINS` (padrão `*`).

Formato padrão de erro:

```json
{ "status": "error", "message": "Descrição do problema." }
```

## Autenticação

O login devolve um JWT. Todas as rotas fora de [Rotas públicas](#rotas-públicas)
exigem o token no header:

```
Authorization: Bearer <token>
```

- O token carrega `userId`, `name` e `role` e expira em `JWT_EXPIRES_IN`
  (padrão `30d`). Não há refresh token nem revogação: o app deve descartar o
  token e mandar o usuário para o login ao receber `401`.
- Rotas de administrador exigem `role = "admin"` no token; caso contrário,
  respondem `403`.

## Erros comuns

Valem para qualquer rota autenticada:

| HTTP | Quando | `message` |
| ---- | ------ | --------- |
| 401 | Sem header `Authorization` ou sem prefixo `Bearer ` | `Autenticação necessária.` |
| 401 | Token vazio | `Token vazio.` |
| 401 | Token expirado | `Sessão expirada. Faça login novamente.` |
| 401 | Token inválido ou adulterado | `Token inválido.` |
| 403 | Rota de admin com token de cidadão | `Acesso restrito a administradores.` |
| 500 | Erro não tratado (inclui erros do upload, veja [POST /reports/store](#post-reportsstore)) | `Erro interno inesperado.` |

---

# Rotas públicas

Não exigem token.

## GET /health

Verifica se o servidor está no ar.

**200**

```json
{ "status": "ok" }
```

---

## POST /signup

Cria uma conta de cidadão (`role = "citizen"`) e envia o e-mail de
verificação. **Não faz login:** o usuário só entra depois de confirmar o e-mail.

**Body**

| Campo | Tipo | Obrigatório | Regra |
| ----- | ---- | ----------- | ----- |
| `name` | string | sim | |
| `email` | string | sim | Único; formato de e-mail |
| `password` | string | sim | Mínimo de 6 caracteres |

**201**

```json
{
  "status": "success",
  "message": "Cadastro realizado. Verifique seu e-mail para ativar a conta.",
  "user": {
    "id": 12,
    "name": "Maria",
    "email": "maria@exemplo.com",
    "role": "citizen",
    "emailVerified": false
  }
}
```

**Erros**

| HTTP | `message` |
| ---- | --------- |
| 400 | `Nome, e-mail e senha são obrigatórios.` |
| 400 | `A senha deve ter no mínimo 6 caracteres.` |
| 400 | `Este e-mail já está cadastrado.` |
| 500 | `Erro interno ao processar o cadastro.` |

> Se o envio do e-mail falhar, o cadastro **continua válido** e a resposta é
> `201` do mesmo jeito. O usuário pode pedir novo link em
> [`/resend-verification`](#post-resend-verification).

---

## POST /login

Autentica e devolve o token JWT.

**Body**

| Campo | Tipo | Obrigatório |
| ----- | ---- | ----------- |
| `email` | string | sim |
| `password` | string | sim |

**200**

```json
{
  "status": "success",
  "message": "Autenticação realizada com sucesso.",
  "token": "eyJhbGciOi...",
  "user": { "id": 12, "name": "Maria", "email": "maria@exemplo.com", "role": "citizen" }
}
```

**Erros**

| HTTP | `code` | Quando |
| ---- | ------ | ------ |
| 400 | — | Falta `email` ou `password` |
| 401 | — | E-mail inexistente **ou** senha errada (mesma mensagem: `E-mail ou senha incorretos.`) |
| 403 | `email_not_verified` | Credenciais corretas, mas o e-mail ainda não foi confirmado |
| 500 | — | Erro interno |

O `403` inclui o e-mail para o app oferecer o botão "reenviar":

```json
{
  "status": "error",
  "code": "email_not_verified",
  "message": "Confirme seu e-mail para ativar a conta. Verifique sua caixa de entrada.",
  "email": "maria@exemplo.com"
}
```

---

## GET /verify-email/:token

Link enviado por e-mail. Confirma a conta e **responde uma página HTML** (não
JSON). O token é o valor de 64 caracteres hexadecimais do e-mail e vale por
**24 horas**.

| HTTP | Situação |
| ---- | -------- |
| 200 | Confirmado (também quando a conta já estava confirmada) |
| 400 | Token com menos de 32 caracteres |
| 404 | Token não encontrado (inválido ou já usado) |
| 410 | Token expirado |
| 500 | Erro interno |

---

## POST /resend-verification

Gera um novo link de confirmação e reenvia. Cada novo link invalida o anterior.

**Body**

| Campo | Tipo | Obrigatório |
| ----- | ---- | ----------- |
| `email` | string | sim |

**200** — resposta idêntica exista a conta ou não (e também se ela já estiver
confirmada), para não revelar quais e-mails estão cadastrados:

```json
{
  "status": "success",
  "message": "Se este e-mail estiver cadastrado e pendente de confirmação, um novo link foi enviado."
}
```

**Erros:** `400` (`E-mail obrigatório.`), `500`.

> Esta rota **não tem rate limit** (veja [Rate limit](#rate-limit)).

---

## POST /forgot-password

Pede o e-mail de redefinição de senha. O e-mail traz um link para
[`GET /reset-password/:token`](#get-reset-passwordtoken), válido por
`PASSWORD_RESET_TTL_MINUTES` (padrão **60 minutos**). Um novo pedido invalida o
link anterior.

**Body**

| Campo | Tipo | Obrigatório |
| ----- | ---- | ----------- |
| `email` | string | sim |

**200** — sempre a mesma resposta, exista a conta ou não. O envio do e-mail não
é aguardado, então o tempo de resposta também não revela nada.

```json
{
  "status": "success",
  "message": "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Verifique sua caixa de entrada."
}
```

**Erros**

| HTTP | `code` | Quando |
| ---- | ------ | ------ |
| 400 | — | `email` ausente ou vazio (`E-mail obrigatório.`) |
| 429 | `rate_limited` | Limite por IP ou por e-mail excedido |
| 500 | — | Erro interno |

O `429` traz o header `Retry-After` (segundos) e o mesmo valor no corpo:

```json
{
  "status": "error",
  "code": "rate_limited",
  "message": "Muitos pedidos de redefinição de senha. Aguarde alguns minutos e tente novamente.",
  "retryAfter": 540
}
```

---

## GET /reset-password/:token

Link enviado por e-mail. **Responde uma página HTML** com o formulário de nova
senha; o próprio formulário chama [`POST /reset-password`](#post-reset-password).
O app mobile não precisa consumir esta rota: basta o usuário abrir o link no
navegador.

| HTTP | Situação |
| ---- | -------- |
| 200 | Formulário de nova senha |
| 400 | Token fora do formato (64 caracteres hexadecimais minúsculos) |
| 404 | Token não encontrado (inválido, já usado ou substituído por um pedido mais novo) |
| 410 | Token expirado |
| 500 | Erro interno |

A página é servida sem cache e sem `Referer`, e não pode ser embutida em
`iframe`, porque o token está na URL.

---

## POST /reset-password

Grava a nova senha e invalida o token. Chamada pela página do passo anterior,
mas também pode ser usada diretamente.

**Body**

| Campo | Tipo | Obrigatório | Regra |
| ----- | ---- | ----------- | ----- |
| `token` | string | sim | 64 caracteres hexadecimais minúsculos |
| `password` | string | sim | Mínimo de 6 caracteres |

**200**

```json
{
  "status": "success",
  "message": "Senha redefinida com sucesso. Agora você já pode entrar com a nova senha."
}
```

**Erros**

| HTTP | `code` | Quando |
| ---- | ------ | ------ |
| 400 | `invalid_token` | Token fora do formato, inexistente ou já usado |
| 400 | `weak_password` | Senha com menos de 6 caracteres |
| 410 | `token_expired` | Token expirado |
| 500 | — | Erro interno |

> Redefinir a senha **não invalida os JWTs já emitidos**: sessões abertas
> continuam válidas até o token expirar.

---

# Rotas autenticadas (cidadão)

Exigem `Authorization: Bearer <token>`. Valem para cidadãos e administradores.

## GET /

Dados do mapa de uma cidade: centro do mapa, estatísticas e relatos.

**Query**

| Parâmetro | Padrão | Descrição |
| --------- | ------ | --------- |
| `city` | `horizonte` | Cidade dos relatos. Centros de mapa conhecidos: `fortaleza`, `horizonte`, `sobral`, `juazeiro` |
| `type` | (todos) | Filtra por tipo: `segurança`, `ambiente` ou `infraestrutura` |

**200**

```json
{
  "status": "success",
  "data": {
    "cityInfo": { "id": "horizonte", "lat": -4.1011, "lng": -38.5086, "zoom": 14 },
    "filters": { "activeType": "" },
    "stats": {
      "total": 42,
      "likes": 130,
      "resolutionRate": 35,
      "ranking": [{ "name": "Centro", "count": 12 }]
    },
    "reports": [ /* relatos, veja abaixo */ ]
  }
}
```

- `stats.resolutionRate` é a porcentagem (inteiro) de relatos com status
  `resolvido`. `stats.ranking` traz os 5 bairros com mais relatos.
- Cada item de `reports` é um [relato](#report) com `comments`, `likes_list` e
  `userLiked`. **Não** traz `likes_count` nem `comments_count` (esses campos só
  existem em `/feed`, `/reports/view/:id` e `/admin/dashboard`).
- Se `city` não estiver na lista de cidades conhecidas, os relatos são
  filtrados por esse valor, mas `cityInfo` devolve o centro de Horizonte com
  o `id` informado.

**Erro:** `500` (`Falha ao carregar dados do mapa.`).

---

## GET /feed

Timeline de relatos, do mais recente para o mais antigo. **Sem paginação:**
devolve todos os relatos que casam com o filtro.

**Query**

| Parâmetro | Padrão | Descrição |
| --------- | ------ | --------- |
| `type` | (todos) | `segurança`, `ambiente` ou `infraestrutura` |
| `period` | `60` | Janela em dias (número positivo). `all` desativa o filtro. Valor inválido também não filtra |

**200**

```json
{ "status": "success", "data": [ /* relatos */ ] }
```

Cada item é um [relato](#report) com `comments`, `likes_list`, `likes_count`,
`comments_count` e `userLiked`.

**Erro:** `500` (`Erro ao carregar o feed.`).

---

## GET /reports/view/:id

Detalhe de um relato.

**200**

```json
{ "status": "success", "data": { /* relato */ } }
```

**Erros:** `404` (`Relato não encontrado.`), `500`.

---

## POST /reports/store

Cria um relato, com foto opcional. O relato nasce com status `pendente`, e o
autor (`userId`, `userName`) vem do token.

**Content-Type:** `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `title` | string | sim | |
| `description` | string | sim | |
| `type` | string | sim | `segurança`, `ambiente` ou `infraestrutura` |
| `neighborhood` | string | sim | Bairro |
| `lat` | número | sim | Latitude |
| `lng` | número | sim | Longitude |
| `city` | string | não | Padrão `horizonte` |
| `image` | arquivo | não | JPEG, PNG, GIF ou WebP; até **8 MB** |

A imagem passa por moderação automática (Cloudinary + AWS Rekognition) antes de
o relato ser salvo.

**201**

```json
{ "status": "success", "data": { /* relato criado */ } }
```

**Erros**

| HTTP | `message` | Quando |
| ---- | --------- | ------ |
| 400 | `Campos obrigatórios ausentes.` | Falta algum campo obrigatório |
| 400 | `A imagem contém conteúdo impróprio e foi bloqueada.` | Reprovada na moderação |
| 400 | `Falha ao registrar relato.` | Erro ao salvar (ex.: `type` fora dos valores permitidos) |
| 500 | `Erro ao processar a imagem.` | Falha no upload para o Cloudinary |
| 500 | `Erro interno inesperado.` | Arquivo com tipo inválido ou maior que 8 MB (o erro do upload cai no handler global) |

---

## POST /reports/:id/like

Alterna o apoio (curtida) do usuário no relato: se já existe, remove; se não,
cria. Sem body.

**200**

```json
{
  "status": "success",
  "message": "Apoio registrado.",
  "data": { "action": "added", "reportId": 7, "userId": 12 }
}
```

`data.action` é `"added"` (`Apoio registrado.`) ou `"removed"` (`Apoio removido.`).

**Erros:** `400` (`ID de relato inválido.`), `404` (`Relato não encontrado.`), `500`.

---

## POST /reports/:reportId/comments

Comenta em um relato. Autor vem do token.

**Body**

| Campo | Tipo | Obrigatório | Regra |
| ----- | ---- | ----------- | ----- |
| `content` | string | sim | Não pode ser vazio nem só espaços; é salvo sem espaços nas pontas |

**201**

```json
{
  "status": "success",
  "message": "Comentário publicado.",
  "data": { /* comentário, veja Comment */ }
}
```

**Erros:** `400` (`ID de relato inválido.` / `O conteúdo do comentário não pode estar vazio.`),
`404` (`Relato não encontrado.`), `500`.

---

## POST /comments/delete/:id

Apaga um comentário. Permitido ao **autor do comentário** ou a um **administrador**.

**200**

```json
{ "status": "success", "message": "Comentário removido." }
```

**Erros:** `400` (`ID inválido.`), `403` (`Você não tem permissão para remover este comentário.`),
`404` (`Comentário não encontrado.`), `500`.

---

## POST /usuarios/update/:id

Edita dados de um usuário. O próprio usuário edita a si mesmo; um administrador
edita qualquer conta.

**Body** (todos opcionais; campos ausentes ou vazios são ignorados)

| Campo | Tipo | Quem pode |
| ----- | ---- | --------- |
| `name` | string | Dono da conta ou admin |
| `email` | string | Dono da conta ou admin |
| `role` | `"citizen"` \| `"admin"` | **Somente admin**; para cidadão o campo é ignorado |

A senha não é alterada por esta rota. Use o fluxo de
[redefinição de senha](#post-forgot-password).

**200**

```json
{
  "status": "success",
  "message": "Dados atualizados.",
  "data": { "id": 12, "name": "Maria S.", "email": "maria@exemplo.com", "role": "citizen" }
}
```

**Erros**

| HTTP | `message` |
| ---- | --------- |
| 400 | `ID inválido.` |
| 403 | `Você só pode editar sua própria conta.` |
| 404 | `Usuário não encontrado.` |
| 500 | `Falha ao atualizar os dados.` (inclui e-mail já usado por outra conta) |

> Trocar o `email` por esta rota **não** dispara nova verificação: o novo
> endereço continua marcado como confirmado.

---

# Rotas de administrador

Exigem token com `role = "admin"`. Cidadão recebe `403`
(`Acesso restrito a administradores.`).

## GET /admin/dashboard

Todos os relatos (sem filtro de período), do mais recente para o mais antigo.

**200**

```json
{ "status": "success", "data": [ /* relatos com likes_count, comments_count, userLiked */ ] }
```

**Erro:** `500` (`Erro ao carregar dados do painel.`).

---

## POST /reports/update/:id

Muda o status de um relato e, opcionalmente, a nota de resolução. Só esses dois
campos são aceitos.

**Body**

| Campo | Tipo | Obrigatório | Regra |
| ----- | ---- | ----------- | ----- |
| `status` | string | sim | `pendente`, `resolvido` ou `rejeitado` |
| `resolutionNote` | string | não | Ausente = mantém a nota atual. String (mesmo vazia) = atualiza; vazia vira `null` |

**200**

```json
{ "status": "success", "data": { /* relato atualizado */ } }
```

**Erros:** `400` (`Status inválido. Use um de: pendente, resolvido, rejeitado.` /
`Falha ao atualizar relato.`), `404` (`Relato não encontrado.`).

---

## POST /reports/delete/:id

Apaga um relato.

**200**

```json
{ "status": "success", "message": "Relato removido." }
```

**Erros:** `404` (`Relato não encontrado.`), `500` (`Erro ao remover relato.`).

---

## GET /usuarios

Lista todos os usuários, em ordem alfabética por nome. Senha e tokens
(verificação e redefinição) nunca são devolvidos.

**200**

```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Ana",
      "email": "ana@exemplo.com",
      "role": "admin",
      "emailVerified": true,
      "verificationSentAt": null,
      "createdAt": "2026-09-01T12:00:00.000Z",
      "updatedAt": "2026-09-01T12:00:00.000Z"
    }
  ]
}
```

**Erro:** `500` (`Erro ao carregar usuários.`).

---

## POST /usuarios/delete/:id

Apaga um usuário. Um administrador não pode apagar a própria conta por esta rota.

**200**

```json
{ "status": "success", "message": "Usuário removido." }
```

**Erros:** `400` (`ID inválido.` / `Você não pode excluir a própria conta administrativa por esta rota.`),
`404` (`Usuário não encontrado.`), `500`.

---

# Modelos de dados

Os nomes abaixo são os que aparecem no JSON.

## Report

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `id` | inteiro | |
| `city` | string | Ex.: `horizonte` |
| `type` | string | `segurança`, `ambiente` ou `infraestrutura` |
| `neighborhood` | string | Bairro |
| `title` | string | |
| `description` | string | |
| `imageUrl` | string \| null | URL da imagem no Cloudinary |
| `lat`, `lng` | decimal | Podem chegar como **string** (o driver do MySQL devolve `DECIMAL` como texto); converta no app |
| `status` | string | `pendente` (padrão), `resolvido` ou `rejeitado` |
| `resolutionNote` | string \| null | Nota do administrador ao resolver/rejeitar |
| `userId`, `userName` | inteiro, string | Autor |
| `createdAt`, `updatedAt` | data ISO 8601 | |
| `comments` | [Comment](#comment)[] | |
| `likes_list` | [Like](#like)[] | |
| `likes_count` | inteiro | Só em `/feed`, `/reports/view/:id`, `/admin/dashboard` |
| `comments_count` | inteiro | Idem |
| `userLiked` | booleano | `true` se o usuário do token já apoiou o relato |

## Comment

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `id` | inteiro | |
| `content` | string | |
| `reportId` | inteiro | |
| `userId`, `userName` | inteiro, string | Autor |
| `created_at`, `updated_at` | data ISO 8601 | Em `snake_case`, ao contrário dos outros modelos |

## Like

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `id` | inteiro | |
| `reportId` | inteiro | |
| `userId` | inteiro | |
| `createdAt`, `updatedAt` | data ISO 8601 | |

## User

Devolvido em `/signup`, `/login`, `/usuarios/update/:id` (subconjunto) e
`/usuarios` (completo, sem segredos).

| Campo | Tipo | Descrição |
| ----- | ---- | --------- |
| `id` | inteiro | |
| `name` | string | |
| `email` | string | Único |
| `role` | string | `citizen` (padrão) ou `admin` |
| `emailVerified` | booleano | |

---

# Rate limit

Somente [`POST /forgot-password`](#post-forgot-password) tem limite, em duas
camadas (nesta ordem):

| Camada | Padrão | Variáveis |
| ------ | ------ | --------- |
| Por IP | 5 pedidos / 15 min | `RESET_LIMIT_IP_MAX`, `RESET_LIMIT_IP_WINDOW_MIN` |
| Por e-mail | 3 pedidos / 60 min | `RESET_LIMIT_EMAIL_MAX`, `RESET_LIMIT_EMAIL_WINDOW_MIN` |

- O contador por e-mail vale para **qualquer** e-mail digitado, exista a conta
  ou não. Assim, um `429` nunca revela se a conta existe.
- As respostas incluem os headers padrão `RateLimit` e `RateLimit-Policy`
  (IETF draft-7); o `429` inclui também `Retry-After`.
- Os contadores ficam **em memória**: zeram ao reiniciar o servidor e não são
  compartilhados entre instâncias. Com mais de uma instância, troque o `store`
  por um compartilhado (ex.: Redis).
- Atrás de proxy (Render, nginx…), defina `TRUST_PROXY` para o limite por IP
  enxergar o IP real do cliente. Em produção o padrão é `1`.
- `/login`, `/signup` e `/resend-verification` **ainda não têm** limite.

# Variáveis de ambiente

Referência completa em [`.env.example`](../.env.example). As que afetam o
comportamento da API descrito aqui:

| Variável | Padrão | Efeito |
| -------- | ------ | ------ |
| `JWT_SECRET` | — | Chave de assinatura do JWT (obrigatória) |
| `JWT_EXPIRES_IN` | `30d` | Validade do token |
| `APP_BASE_URL` | `http://localhost:3000` | Base dos links de e-mail (`/verify-email/…`, `/reset-password/…`) |
| `PASSWORD_RESET_TTL_MINUTES` | `60` | Validade do link de redefinição |
| `RESET_LIMIT_*` | veja [Rate limit](#rate-limit) | Limites do `/forgot-password` |
| `TRUST_PROXY` | `1` em produção | Nº de proxies à frente do app |
| `CORS_ORIGINS` | `*` | Origens permitidas, separadas por vírgula |
| `SMTP_*` | — | Envio de e-mail. Sem `SMTP_HOST/USER/PASS`, os links só são logados no console |
