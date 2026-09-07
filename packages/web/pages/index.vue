<script setup lang="ts">
import { Database, Layers, Zap, Code2, Cloud, Split, ArrowRight, Search, Box, Percent, Scissors, Gamepad2, Sparkles } from 'lucide-vue-next'

definePageMeta({
  title: 'Home',
})

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const shuttleLinks = computed(() => [
  { to: '/shuttle/parser', label: t('header.nav.parser'), desc: t('index.parser_desc'), icon: Database },
  { to: '/shuttle/constructor', label: t('header.nav.constructor'), desc: t('index.constructor_desc'), icon: Layers },
  { to: '/shuttle/analyzer', label: t('header.nav.analyzer'), desc: t('index.analyzer_desc'), icon: Zap },
  { to: '/shuttle/manage', label: t('header.nav.manage'), desc: t('index.manage_desc'), icon: Code2 },
  { to: '/shuttle/builder', label: t('header.nav.builder'), desc: t('header.nav.builder_desc'), icon: Box },
  { to: '/shuttle/api', label: t('header.nav.api'), desc: t('index.api_desc'), icon: Cloud },
])

const toolLinks = computed(() => [
  { to: '/tools/batch', label: t('header.nav.batch'), desc: t('index.batch_desc'), icon: Split },
  { to: '/tools/concordance', label: t('header.nav.concordance'), desc: t('index.concordance_desc'), icon: Search },
  { to: '/tools/check-percentage', label: t('header.nav.check_percentage'), desc: t('header.nav.check_percentage_desc'), icon: Percent },
  { to: '/tools/chunk', label: t('header.nav.chunk', 'テキストチャンク'), desc: t('index.chunk_desc', 'テキストを指定サイズで分割'), icon: Scissors },
])

const playLinks = computed(() => [
  { to: '/play/edit-distance', label: t('header.nav.edit_distance'), desc: t('index.edit_distance_desc'), icon: Sparkles },
])
</script>

<template>
  <div class="home-view">
    <section class="hero">
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="emoji">🐑</span>
          SheepComb<span class="gradient-text">Web</span>
        </h1>
        <p class="hero-subtitle">
          {{ $t('index.hero_subtitle_1') }}
          <br />
          {{ $t('index.hero_subtitle_2') }}
        </p>
      </div>
    </section>

    <div class="nav-grid-container">
      <div class="category-section">
        <h2 class="category-title">
          <Database :size="20" />
          {{ $t('index.category_shuttle') }}
        </h2>
        <div class="nav-grid">
          <NuxtLink v-for="link in shuttleLinks" :key="link.to" :to="link.to" class="nav-card">
            <div class="card-icon">
              <component :is="link.icon" :size="24" />
            </div>
            <div class="card-body">
              <h3>{{ link.label }}</h3>
              <p>{{ link.desc }}</p>
            </div>
            <ArrowRight class="arrow" :size="16" />
          </NuxtLink>
        </div>
      </div>

      <div class="category-section">
        <h2 class="category-title">
          <Split :size="20" />
          {{ $t('index.category_tools') }}
        </h2>
        <div class="nav-grid">
          <NuxtLink v-for="link in toolLinks" :key="link.to" :to="link.to" class="nav-card tool-card">
            <div class="card-icon">
              <component :is="link.icon" :size="24" />
            </div>
            <div class="card-body">
              <h3>{{ link.label }}</h3>
              <p>{{ link.desc }}</p>
            </div>
            <ArrowRight class="arrow" :size="16" />
          </NuxtLink>
        </div>
      </div>

      <div class="category-section">
        <h2 class="category-title">
          <Gamepad2 :size="20" />
          {{ $t('index.category_play') }}
        </h2>
        <div class="nav-grid">
          <NuxtLink v-for="link in playLinks" :key="link.to" :to="link.to" class="nav-card play-card">
            <div class="card-icon">
              <component :is="link.icon" :size="24" />
            </div>
            <div class="card-body">
              <h3>{{ link.label }}</h3>
              <p>{{ link.desc }}</p>
            </div>
            <ArrowRight class="arrow" :size="16" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  padding: 60px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  margin-bottom: 80px;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 900;
  margin-bottom: 16px;
  letter-spacing: -0.02em;
}

.gradient-text {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.emoji {
  margin-right: 12px;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 700px;
  margin: 0 auto;
}

.nav-grid-container {
  display: flex;
  flex-direction: column;
  gap: 60px;
}

.category-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.9;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.nav-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.nav-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
  background: var(--bg-hover);
}

.card-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  color: var(--accent);
  transition: var(--transition);
}

.nav-card:hover .card-icon {
  background: var(--accent);
  color: white;
}

.card-body h3 {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.card-body p {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.arrow {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%) translateX(10px);
  opacity: 0;
  transition: all 0.3s ease;
  color: var(--accent);
}

.nav-card:hover .arrow {
  opacity: 1;
  transform: translateY(-50%) translateX(0);
}

.tool-card .card-icon {
  color: var(--secondary);
}

.tool-card:hover .card-icon {
  background: var(--secondary);
  color: white;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .nav-grid {
    grid-template-columns: 1fr;
  }
}
</style>
