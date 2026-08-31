declare global {
  interface Window {
    dataLayer: any[]
    gtag: (...args: any[]) => void
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const measurementId = (config.public.gaMeasurementId as string) || 'G-YC7B6J9KQW'

  if (typeof window === 'undefined') return

  // gtag を arguments を渡す標準形式で初期化（未定義時のフォールバック）
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function () {
      window.dataLayer.push(arguments)
    }
  }

  // SPA ページ遷移時の page_view イベント送信
  // 初回ロード時は gtag('config', '...') により自動送信されるため、2回目以降の遷移で送信
  const router = useRouter()
  let isFirstLoad = true

  router.afterEach((to) => {
    if (isFirstLoad) {
      isFirstLoad = false
      return
    }
    nextTick(() => {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: to.fullPath,
        send_to: measurementId,
      })
    })
  })

  return {
    provide: {
      gtag: window.gtag,
    },
  }
})
