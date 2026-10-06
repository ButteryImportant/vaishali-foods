import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://vaishali-foods.pages.dev',
  output: 'server',
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
  })
});
