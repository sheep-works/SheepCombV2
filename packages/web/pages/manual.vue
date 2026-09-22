<script setup lang="ts">
import { BookOpen, Video, ExternalLink, Play, CheckCircle2 } from 'lucide-vue-next'

definePageMeta({
  title: 'Manual',
})

const DOCS_URL = 'https://lambuage.com/sheep-comb'
const YOUTUBE_PLAYLIST_ID = 'PLZo3GhAxn8uE'
const YOUTUBE_URL = `https://www.youtube.com/playlist?list=${YOUTUBE_PLAYLIST_ID}`
const YOUTUBE_EMBED_URL = `https://www.youtube-nocookie.com/embed/videoseries?list=${YOUTUBE_PLAYLIST_ID}&rel=0`
</script>

<template>
  <div class="manual-view">
    <!-- Hero Section -->
    <section class="manual-hero">
      <h1 class="hero-title">
        <span class="emoji">📖</span>
        {{ $t('manual.title') }}
      </h1>
      <p class="hero-subtitle">
        {{ $t('manual.subtitle') }}
      </p>
    </section>

    <!-- Cards Grid -->
    <div class="manual-grid">
      <!-- Detailed Docs Card -->
      <div class="manual-card docs-card">
        <div class="card-header">
          <div class="card-icon docs-icon">
            <BookOpen :size="28" />
          </div>
          <div class="badge docs-badge">{{ $t('manual.docs_badge') }}</div>
        </div>

        <div class="card-body">
          <h2 class="card-title">{{ $t('manual.docs_title') }}</h2>
          <p class="card-desc">{{ $t('manual.docs_desc') }}</p>

          <ul class="feature-list">
            <li>
              <CheckCircle2 :size="16" class="check-icon" />
              <span>全ツールの詳細仕様・パラメータ解説</span>
            </li>
            <li>
              <CheckCircle2 :size="16" class="check-icon" />
              <span>XLIFF / TMX / TBX 等のデータ構造ガイド</span>
            </li>
            <li>
              <CheckCircle2 :size="16" class="check-icon" />
              <span>トラブルシューティング＆FAQ</span>
            </li>
          </ul>
        </div>

        <div class="card-footer">
          <a
            :href="DOCS_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn docs-btn"
          >
            <span>{{ $t('manual.docs_btn') }}</span>
            <ExternalLink :size="18" />
          </a>
        </div>
      </div>

      <!-- Video Tutorial Card -->
      <div class="manual-card video-card">
        <div class="card-header">
          <div class="card-icon video-icon">
            <Video :size="28" />
          </div>
          <div class="badge video-badge">{{ $t('manual.video_badge') }}</div>
        </div>

        <div class="card-body">
          <h2 class="card-title">{{ $t('manual.video_title') }}</h2>
          <p class="card-desc">{{ $t('manual.video_desc') }}</p>

          <!-- Embedded Video Player -->
          <div class="video-container">
            <iframe
              :src="YOUTUBE_EMBED_URL"
              :title="$t('manual.embed_title')"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
        </div>

        <div class="card-footer">
          <a
            :href="YOUTUBE_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="action-btn video-btn"
          >
            <Play :size="16" class="play-icon" />
            <span>{{ $t('manual.video_btn') }}</span>
            <ExternalLink :size="18" />
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manual-view {
  padding: 50px 24px 80px;
  max-width: 1200px;
  margin: 0 auto;
}

.manual-hero {
  text-align: center;
  margin-bottom: 50px;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 800;
  margin-bottom: 12px;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.emoji {
  font-size: 2.5rem;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted);
  line-height: 1.6;
  max-width: 650px;
  margin: 0 auto;
}

/* Grid Layout */
.manual-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
  align-items: stretch;
}

/* Manual Card */
.manual-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  position: relative;
  overflow: hidden;
}

.manual-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
}

/* Card Header */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  background: var(--accent-glow);
  color: var(--accent);
}

.manual-card:hover .card-icon {
  background: var(--accent);
  color: #ffffff;
}

.badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.03em;
  font-family: 'Inter', monospace;
  background: var(--accent-glow);
  color: var(--accent-light);
  border: 1px solid var(--border-accent);
}

/* Card Body */
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 1.4rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.card-desc {
  font-size: 0.95rem;
  color: var(--text-muted);
  line-height: 1.6;
  margin-bottom: 24px;
}

/* Feature List */
.feature-list {
  list-style: none;
  padding: 0;
  margin: 0 0 24px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.check-icon {
  color: var(--accent);
  flex-shrink: 0;
}

/* Video Container (16:9 Aspect Ratio) */
.video-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 */
  height: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: #000;
  margin-bottom: 24px;
  border: 1px solid var(--border);
}

.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Card Footer & Action Buttons */
.card-footer {
  margin-top: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.docs-btn {
  background: var(--accent);
  color: #ffffff;
  border: 1px solid transparent;
}

.docs-btn:hover {
  background: var(--accent-light);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}

.video-btn {
  background: var(--accent-glow);
  color: var(--accent-light);
  border: 1px solid var(--border-accent);
}

.video-btn:hover {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
}

.play-icon {
  fill: currentColor;
}

/* Responsive */
@media (max-width: 900px) {
  .manual-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .hero-title {
    font-size: 2.2rem;
  }
}
</style>
