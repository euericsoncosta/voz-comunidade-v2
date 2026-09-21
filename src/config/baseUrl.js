/**
 * URL pública da API, usada para montar os links dos e-mails
 * (verificação de e-mail e redefinição de senha).
 *
 * Ordem de escolha:
 *   1. APP_BASE_URL (configurada à mão)
 *   2. RENDER_EXTERNAL_URL (o Render define sozinho em web services)
 *   3. http://localhost:3000 (desenvolvimento)
 *
 * Se estiver no Render e APP_BASE_URL apontar para localhost (ex.: copiada do
 * .env local), ela é ignorada: um link para localhost nunca funcionaria no
 * celular de quem recebe o e-mail.
 */

const isLocalhost = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);

let warned = false;

export function getBaseUrl() {
  const configured = process.env.APP_BASE_URL;
  const renderUrl = process.env.RENDER_EXTERNAL_URL;

  let url = configured || renderUrl || 'http://localhost:3000';

  if (renderUrl && configured && isLocalhost(configured)) {
    if (!warned) {
      console.warn(
        `[CONFIG] APP_BASE_URL aponta para ${configured}, mas a API roda no Render. ` +
          `Usando ${renderUrl} nos links dos e-mails. Corrija ou apague APP_BASE_URL nas variáveis de ambiente.`
      );
      warned = true;
    }
    url = renderUrl;
  }

  return url.replace(/\/$/, '');
}
