import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://toiture-des-alpes-maritimes.fr',
  output: 'static',
  adapter: cloudflare({
    imageService: 'passthrough'
  }),
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !['/mentions-legales', '/politique-confidentialite', '/confirmation'].some(
          (excluded) => path.startsWith(excluded) || path.startsWith(excluded + '/')
        );
      }
    })
  ]
});
