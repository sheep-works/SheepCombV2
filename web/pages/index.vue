<script setup lang="ts">
import { Database, Layers, Zap, Code2, Cloud, Split, ArrowRight, Search } from 'lucide-vue-next'

definePageMeta({
  title: 'Home',
})

const shuttleLinks = [
  { to: '/shuttle/parser', label: 'パーサー', desc: 'Rawファイルからセグメントを抽出', icon: Database },
  { to: '/shuttle/shuttle-parser', label: '構造化', desc: 'ユニットをShWvデータに変換', icon: Layers },
  { to: '/shuttle/shuttle-analyzer', label: '解析', desc: 'TM/TBを使用したマッチング処理', icon: Zap },
  { to: '/shuttle/shuttle-manage', label: '管理', desc: 'データの分割・結合・管理', icon: Code2 },
  { to: '/shuttle/api', label: 'API', desc: 'LLMリクエストとキャッシュ設定', icon: Cloud },
]

const toolLinks = [
  { to: '/tools/batch', label: '一括差分', desc: '左右のテキストを高速に一括比較', icon: Split },
  { to: '/tools/concordance', label: 'コンコーダンス', desc: 'FlexSearchによる高速な一致検索', icon: Search },
]
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
          次世代の翻訳データ処理・解析プラットフォーム。
          <br />
          多言語アセットを自在にパース、構造化、そしてAIで強化。
        </p>
      </div>
    </section>

    <div class="nav-grid-container">
      <div class="category-section">
        <h2 class="category-title">
          <Database :size="20" />
          Shuttle ワークフロー
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
          ユーティリティ
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
