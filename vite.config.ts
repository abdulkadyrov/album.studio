import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const base = process.env.VITE_BASE_PATH ?? '/';
  const basePath = base.endsWith('/') ? base : `${base}/`;

  return {
    base: basePath,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['app-icon.svg'],
        manifest: {
          name: 'Vakha Album Designer',
          short_name: 'Vakha Album',
          description: 'Локальный редактор выпускных альбомов',
          theme_color: '#11141a',
          background_color: '#0b0d11',
          display: 'standalone',
          lang: 'ru',
          start_url: `${basePath}projects`,
          scope: basePath,
          icons: [
            {
              src: `${basePath}app-icon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: `${basePath}index.html`,
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          cleanupOutdatedCaches: true,
          runtimeCaching: [],
        },
      }),
    ],
  };
});
