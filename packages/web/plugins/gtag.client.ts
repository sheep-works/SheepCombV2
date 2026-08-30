export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const measurementId = (config.public.gaMeasurementId as string) || 'G-YC7B6J9KQW'

  if (!measurementId) return

  // Google Analytics (gtag.js) スクリプトの読み込み
  useHead({
    script: [
      {
        src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
        async: true,
      },
    ],
  })

  // window.dataLayer と gtag 関数の初期化
  if (typeof window !== 'undefined') {
    (window as any).dataLayer = (window as any).dataLayer || []
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args)
    }
    ;(window as any).gtag = gtag

    gtag('js', new Date())
    gtag('config', measurementId, {
      send_page_view: false, // SPA ルーティングによる二重送信防止
    })

    // 初回表示および SPA ページ遷移時の page_view イベント送信
    const router = useRouter()
    router.afterEach((to) => {
      nextTick(() => {
        gtag('event', 'page_view', {
          page_title: document.title,
          page_location: window.location.href,
          page_path: to.fullPath,
        })
      })
    })

    return {
      provide: {
        gtag,
      },
    }
  }
})
