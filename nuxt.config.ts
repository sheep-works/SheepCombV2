// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-04-03',

  srcDir: 'web/',
  devtools: { enabled: false },
  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@nuxtjs/i18n'
  ],
  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'zh', file: 'zh.json', name: '中文' }
    ],
    langDir: 'locales/',
    defaultLocale: 'ja',
    strategy: 'prefix_except_default'
  },
  nitro: {
    preset: 'static',
    devProxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        prependPath: true,
      },
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || '/api',
      apiPort: process.env.NUXT_PUBLIC_API_PORT || '',
      apiKey: process.env.NUXT_PUBLIC_API_KEY,  // 追加
      apiDev: process.env.NUXT_PUBLIC_API_DEV
    }
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

