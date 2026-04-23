// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-04-03',

  srcDir: 'web/',
  devtools: { enabled: false },
  modules: ['@pinia/nuxt'],
  nitro: {
    preset: 'netlify',
    devProxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        prependPath: true,
      },
    },
  },
  devServer: {
    host: '127.0.0.1',
    port: 3000
  },
  alias: {

    '~': './web',
    '@': './web',
    '~~': './',
    '@@': './',
    '#logic': './logic',
    '#types': './logic/types',
  },
  css: ['~/assets/main.css'],
  vite: {
    optimizeDeps: {
      include: [
        'lucide-vue-next',
        'jszip',
        'xlsx',
        'difflib-ts',
      ]
    }
  },
  // Nuxt 3 uses file-based routing, so we don't need explicit router config here
})

