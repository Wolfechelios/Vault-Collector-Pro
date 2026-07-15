import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Vault-Collector-Pro/',
  worker: {format: 'es'},
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'maskable-512x512.png'],
      manifest: {
        id: '/Vault-Collector-Pro/',
        name: 'WolfeVault',
        short_name: 'WolfeVault',
        description: 'Private, offline inventory intelligence.',
        start_url: '/Vault-Collector-Pro/',
        scope: '/Vault-Collector-Pro/',
        display: 'standalone',
        background_color: '#0a0908',
        theme_color: '#12100f',
        icons: [
          {src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png'},
          {src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png'},
          {src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'}
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm,traineddata}'],
        runtimeCaching: [{
          urlPattern: ({url}) => /model|onnx|wasm|traineddata/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'wolfevault-recognition-v1',
            expiration: {maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30},
            cacheableResponse: {statuses: [0, 200]}
          }
        }]
      }
    })
  ]
});
