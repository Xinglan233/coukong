import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

function helpRoutes() {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = req.url?.split('?')[0]
    if (path && /^\/help(?:\/[a-z_-]+)?\/?$/.test(path)) {
      const target = `${path.replace(/\/$/, '')}/index.html`
      if (existsSync(resolve('public', target.slice(1)))) req.url = target
    }
    next()
  }
  return { name: 'help-directory-routes', configureServer(server: { middlewares: { use: (handler: typeof rewrite) => void } }) { server.middlewares.use(rewrite) }, configurePreviewServer(server: { middlewares: { use: (handler: typeof rewrite) => void } }) { server.middlewares.use(rewrite) } }
}

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  plugins: [
    helpRoutes(),
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '同野·游',
        short_name: '同野·游',
        description: '一起找到能碰面的空档',
        lang: 'zh-CN',
        theme_color: '#0c8578',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/help(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
})
