<script setup lang="ts">
import { BookOpen, ExternalLink } from 'lucide-vue-next'

interface Props {
  href: string
  label?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  compact: false,
})
</script>

<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="manual-step-link"
    :class="{ compact }"
    :title="label || $t('common.manual_link', 'マニュアルを開く')"
  >
    <BookOpen :size="compact ? 13 : 14" class="manual-icon" />
    <span v-if="label" class="manual-label">{{ label }}</span>
    <ExternalLink :size="compact ? 11 : 12" class="external-icon" />
  </a>
</template>

<style scoped>
.manual-step-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--accent-light, #38bdf8);
  background: var(--accent-glow, rgba(56, 189, 248, 0.1));
  border: 1px solid var(--border-accent, rgba(56, 189, 248, 0.25));
  border-radius: var(--radius-sm, 6px);
  text-decoration: none;
  line-height: 1;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.manual-step-link:hover {
  background: var(--accent, #0284c7);
  color: #ffffff;
  border-color: var(--accent, #0284c7);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25);
}

.manual-step-link.compact {
  padding: 3px 6px;
  font-size: 0.72rem;
  gap: 4px;
}

.manual-icon {
  flex-shrink: 0;
  opacity: 0.9;
}

.manual-label {
  letter-spacing: 0.01em;
}

.external-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.manual-step-link:hover .external-icon,
.manual-step-link:hover .manual-icon {
  opacity: 1;
}
</style>
