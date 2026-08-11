import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  const forCapacitor = mode === 'capacitor' || process.env.CAPACITOR === '1'
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'pwa-192.png', 'pwa-512.png'],
        manifest: {
          name: 'لوحة مبيعات بنك الرياض',
          short_name: 'مبيعات الرياض',
          description: 'لوحة تحكم مبيعات تمويل المعارض - بنك الرياض',
          lang: 'ar',
          dir: 'rtl',
          theme_color: '#0b5c3b',
          background_color: '#0b5c3b',
          display: 'standalone',
          start_url: forCapacitor ? './' : '/my-project/',
          scope: forCapacitor ? './' : '/my-project/',
          icons: [
            {
              src: 'pwa-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    base: forCapacitor ? './' : command === 'build' ? '/my-project/' : '/',
  }
})
