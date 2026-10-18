/**
 * Cloudflare Worker: прокси Bot API (VPS в РФ часто не достучится до api.telegram.org).
 *
 * Deploy (Dashboard):
 *   Workers & Pages → Create → paste this file → Deploy
 *   URL вида https://vspomni-tg-proxy.<account>.workers.dev
 *
 * Затем на VPS в api/.env:
 *   TELEGRAM_API_BASE=https://vspomni-tg-proxy.<account>.workers.dev
 *   systemctl restart vspomni-api
 *
 * Запросы: {BASE}/bot<token>/sendMessage  →  https://api.telegram.org/bot<token>/sendMessage
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }
    if (!url.pathname.startsWith('/bot')) {
      return new Response('not found', { status: 404 });
    }
    const target = `https://api.telegram.org${url.pathname}${url.search}`;
    const init = {
      method: request.method,
      headers: request.headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer(),
    };
    return fetch(target, init);
  },
};
