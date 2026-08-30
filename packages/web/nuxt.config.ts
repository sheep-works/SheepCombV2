// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: '2024-04-03',

  devtools: { enabled: false },
  app: {
    head: {
      link: [
        { rel: 'canonical', href: 'https://comb.lambuage.com' }
      ]
    }
  },
  modules: [
    '@pinia/nuxt',
    '@pinia-plugin-persistedstate/nuxt',
    '@nuxtjs/i18n',
    '@nuxt/content'
  ],

  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'zh', file: 'zh.json', name: '中文' }
    ],
    langDir: 'locales/',
    defaultLocale: 'ja',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root', // ルートアクセス時にCookieを見てリダイレクト
      alwaysRedirect: true
    }
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
  css: ['~/assets/main.css'],
  vite: {
    optimizeDeps: {
      include: [
        'lucide-vue-next',
        'jszip',
        'xlsx',
        'difflib-ts',
        'flexsearch',
      ]
    }
  },
  // Nuxt 3 uses file-based routing, so we don't need explicit router config here
})


