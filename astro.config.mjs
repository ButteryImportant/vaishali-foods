import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://vaishali-foods.pages.dev',
  output: 'server',
  adapter: cloudflare()
});
