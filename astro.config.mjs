// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'http://dev.nosdicengeeks.com',
  output: 'static',
  build: {
    format: 'directory',
  },
});
