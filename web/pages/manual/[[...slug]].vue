<template>
  <main class="manual-page">
    <div>Current route: {{ $route.path }}</div>
    <ContentDoc :path="$route.path.replace(/\/$/, '') || '/'" />
  </main>
</template>

<style scoped>
.manual-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 24px;
  line-height: 1.6;
}

/* Basic markdown styling */
:deep(h1), :deep(h2), :deep(h3) {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

:deep(h1) {
  font-size: 2.5rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

:deep(h2) {
  font-size: 1.8rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3rem;
}

:deep(p) {
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

:deep(ul), :deep(ol) {
  margin-bottom: 1.5rem;
  padding-left: 2rem;
}

:deep(li) {
  margin-bottom: 0.5rem;
}

:deep(code) {
  background: var(--bg-secondary);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: monospace;
}

:deep(pre) {
  background: var(--bg-secondary);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 1.5rem;
}

:deep(pre code) {
  background: none;
  padding: 0;
}
</style>
