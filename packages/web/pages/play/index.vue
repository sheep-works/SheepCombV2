<script setup lang="ts">
definePageMeta({
  title: '遊ぶ（Play）',
})

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sparkles, ArrowRight, Gamepad2 } from 'lucide-vue-next'

const { t } = useI18n()

const playItems = computed(() => [
  {
    to: '/play/edit-distance',
    label: t('play.edit_distance.title', '編集距離の可視化'),
    desc: t('play.edit_distance.subtitle', 'レーベンシュタイン距離の計算と変換ステップを視覚的に体験・確認'),
    icon: Sparkles,
  },
])
</script>

<template>
  <div class="play-index-view">
    <div class="play-header">
      <div class="header-icon">
        <Gamepad2 :size="32" />
      </div>
      <div class="header-text">
        <h1>{{ $t('index.category_play', '遊ぶ（実験・学び）') }}</h1>
        <p class="subtitle">
          アルゴリズムの挙動やテキスト処理のロジックを直感的に学べる実験スペースです。
        </p>
      </div>
    </div>

    <div class="play-grid">
      <NuxtLink v-for="item in playItems" :key="item.to" :to="item.to" class="play-card">
        <div class="card-icon">
          <component :is="item.icon" :size="28" />
        </div>
        <div class="card-content">
          <h3>{{ item.label }}</h3>
          <p>{{ item.desc }}</p>
        </div>
        <div class="card-arrow">
          <ArrowRight :size="18" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.play-index-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
}

.play-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 36px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.header-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  background: var(--accent-glow);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-accent);
}

.header-text h1 {
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.play-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.play-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  transition: var(--transition);
}

.play-card:hover {
  border-color: var(--border-accent);
  background: var(--bg-card-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  background: var(--accent-glow);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-content h3 {
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.card-content p {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.card-arrow {
  color: var(--text-muted);
  transition: var(--transition);
}

.play-card:hover .card-arrow {
  color: var(--accent);
  transform: translateX(4px);
}
</style>
