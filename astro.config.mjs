// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://nosdicengeeks.com',
  output: 'static',

  build: {
    format: 'directory',
  },

  integrations: [sitemap()],
});