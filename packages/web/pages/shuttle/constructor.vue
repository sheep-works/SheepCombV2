<script setup lang="ts">
/**
 * web/pages/shuttle/constructor.vue
 * 構造化機能は「解析・構造化 (/shuttle/analyzer)」に統合されました。
 */
definePageMeta({
  title: '構造化 (統合済み)',
  icon: 'layers',
  middleware: [
    () => {
      return navigateTo('/shuttle/analyzer')
    }
  ]
})
</script>

<template>
  <div style="padding: 40px; text-align: center;">
    <p>「構造化」機能は「解析・構造化」ページに統合されました。自動的に移動します...</p>
    <NuxtLink to="/shuttle/analyzer" style="color: var(--accent);">移動しない場合はこちらをクリック</NuxtLink>
  </div>
</template>
