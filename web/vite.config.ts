import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * The production origin, as known at BUILD time.
 *
 * `BETTER_AUTH_URL` is already required in production (see DEPLOY.md), so the
 * domain is configured exactly once and this reads the same value rather than
 * introducing a second place to keep in sync. The Vercel-provided variables are
 * the fallback for preview deployments.
 */
function siteOrigin(): string | null {
  const raw =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    null;
  return raw ? raw.replace(/\/+$/, '') : null;
}

/**
 * Make the social-preview URLs absolute.
 *
 * Slack, LinkedIn and iMessage drop a relative `og:image` without saying so —
 * the link then previews as a bare URL, which is the whole thing we are trying
 * to avoid. The tags stay relative in `index.html` so they still resolve while
 * developing; the origin is stamped in when it is known.
 */
function absoluteSocialUrls(): Plugin {
  return {
    name: 'declaro-absolute-social-urls',
    transformIndexHtml(html) {
      const origin = siteOrigin();
      if (!origin) {
        // Loud, because a silent miss here only shows up when someone shares a link.
        console.warn('[declaro] BETTER_AUTH_URL/VERCEL_URL not set — og:image stays relative and link previews may not render an image.');
        return html;
      }
      return html
        .replace(
          /(<meta (?:property="og:image"|name="twitter:image") content=")(\/[^"]*)(")/g,
          (_m, head, p, tail) => `${head}${origin}${p}${tail}`,
        )
        .replace('<meta property="og:type"', `<meta property="og:url" content="${origin}/" />\n    <meta property="og:type"`);
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), absoluteSocialUrls()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { proxy: { '/api': 'http://127.0.0.1:8899' } },
  build: { chunkSizeWarningLimit: 1500 },
});
