import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/parser',
    },
    {
      path: '/parser',
      name: 'parser',
      component: () => import('@/views/ParserView.vue'),
      meta: { title: 'ファイルパーサー', icon: 'database' },
    },
    {
      path: '/shuttle',
      name: 'shuttle',
      component: () => import('@/views/ShuttleView.vue'),
      meta: { title: 'SheepShuttle', icon: 'shuffle' },
    },
    {
      path: '/api',
      name: 'api',
      component: () => import('@/views/ApiView.vue'),
      meta: { title: 'API クライアント', icon: 'cloud' },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const title = (to.meta.title as string) || 'SheepCombWeb'
  document.title = `${title} | SheepCombWeb`
  next()
})

export default router
