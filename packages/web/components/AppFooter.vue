<script setup lang="ts">
import { ExternalLink, ShieldCheck, Github, Globe } from 'lucide-vue-next'

const config = useRuntimeConfig()
const appVersion = computed(() => {
  return config.public.appVersion || '1.0.0'
})
</script>

<template>
  <footer class="app-footer">
    <div class="footer-container">
      <div class="footer-brand">
        <NuxtLink to="/" class="brand-link">
          <span class="brand-icon">🐑</span>
          <span class="brand-title">SheepComb</span>
          <span class="brand-version-badge">v{{ appVersion }}</span>
        </NuxtLink>
        <p class="brand-desc">{{ $t('footer.desc') }}</p>
      </div>

      <nav class="footer-links" aria-label="Footer Navigation">
        <a
          href="https://lambuage.com"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <Globe :size="15" class="link-icon" />
          <span>{{ $t('footer.official_site') }}</span>
          <ExternalLink :size="12" class="ext-icon" />
        </a>

        <a
          href="https://github.com/sheep-works/SheepCombV2"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
        >
          <Github :size="15" class="link-icon" />
          <span>{{ $t('footer.github') }}</span>
          <ExternalLink :size="12" class="ext-icon" />
        </a>

        <NuxtLink to="/license" class="footer-link">
          <ShieldCheck :size="15" class="link-icon" />
          <span>{{ $t('footer.license') }}</span>
        </NuxtLink>
      </nav>
    </div>

    <div class="footer-bottom">
      <p class="copyright">{{ $t('footer.copyright') }}</p>
      <div class="footer-meta">
        <span class="version-label">Release v{{ appVersion }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  margin-top: auto;
  padding: 32px 24px 20px;
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-primary);
  font-weight: 700;
  font-size: 1.05rem;
  transition: opacity var(--transition);
}

.brand-link:hover {
  opacity: 0.85;
}

.brand-icon {
  font-size: 1.15rem;
}

.brand-title {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-version-badge {
  font-size: 0.65rem;
  font-family: 'Inter', monospace;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--accent-glow);
  color: var(--accent-light);
  border: 1px solid var(--border-accent);
}

.brand-desc {
  font-size: 0.76rem;
  color: var(--text-muted);
  max-width: 380px;
}

.footer-links {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.82rem;
  padding: 6px 10px;
  border-radius: var(--radius-xs);
  transition: var(--transition);
}

.footer-link:hover {
  color: var(--accent-light);
  background: var(--bg-hover);
}

.link-icon {
  color: var(--text-muted);
  transition: color var(--transition);
}

.footer-link:hover .link-icon {
  color: var(--accent);
}

.ext-icon {
  opacity: 0.5;
  margin-left: -2px;
}

.footer-bottom {
  max-width: 1200px;
  margin: 16px auto 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.74rem;
  color: var(--text-muted);
}

.copyright {
  margin: 0;
}

.footer-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.version-label {
  font-family: 'Inter', monospace;
  font-size: 0.7rem;
  padding: 2px 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .footer-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 20px;
  }

  .footer-links {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
  }

  .footer-link {
    padding: 6px 0;
  }

  .footer-bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
