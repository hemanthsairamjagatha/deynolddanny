import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://deynolddanny.com',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false
    })
  ],
  vite: {
    server: {
      proxy: {
        '/api': {
          target: process.env.PUBLIC_BACKEND_URL || 'https://deynold-danny-backend.deynolddanny.workers.dev',
          changeOrigin: true,
        },
        '/health': {
          target: process.env.PUBLIC_BACKEND_URL || 'https://deynold-danny-backend.deynolddanny.workers.dev',
          changeOrigin: true,
        },
      },
    },
  },
});
