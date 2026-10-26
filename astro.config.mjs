// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://nosdicengeeks.com',
  output: 'static',

  redirects: {
    '/about': '/nosotros',
  },

  build: {
    format: 'directory',
    // CSS en línea en cada HTML (~4-5 KB con brotli): quita las hojas
    // /_astro/*.css que bloqueaban el primer pintado en móvil.
    inlineStylesheets: 'always',
  },

  integrations: [sitemap()],
});