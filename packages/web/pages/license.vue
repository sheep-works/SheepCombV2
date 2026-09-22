<script setup lang="ts">
import { ref } from 'vue'
import { ShieldCheck, Package, ExternalLink, ChevronDown, ChevronUp, Copy, Check } from 'lucide-vue-next'

useHead({
  title: 'License - SheepCombWeb',
  meta: [
    { name: 'description', content: 'Licenses and third-party notices for SheepCombWeb' }
  ]
})

definePageMeta({
  title: 'License'
})

const copiedIndex = ref<string | null>(null)

const copyText = async (text: string, id: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedIndex.value = id
    setTimeout(() => {
      if (copiedIndex.value === id) copiedIndex.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const sheepCombLicense = `MIT License

Copyright (c) 2026 Lambuage / sheep-works

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

interface OssItem {
  id: string
  name: string
  version: string
  license: string
  description: string
  url: string
  expanded?: boolean
  licenseText: string
}

const ossList = ref<OssItem[]>([
  {
    id: 'vue',
    name: 'Vue.js',
    version: '^3.5.32',
    license: 'MIT',
    description: 'The Progressive JavaScript Framework for building modern web UI.',
    url: 'https://github.com/vuejs/core',
    expanded: false,
    licenseText: `The MIT License (MIT)

Copyright (c) 2018-present, Yuxi (Evan) You

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.`
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    version: '^4.4.2',
    license: 'MIT',
    description: 'The Intuitive Vue Framework for full-stack and static web applications.',
    url: 'https://github.com/nuxt/nuxt',
    expanded: false,
    licenseText: `MIT License

Copyright (c) 2016-present Nuxt Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
  },
  {
    id: 'pinia',
    name: 'Pinia',
    version: '^3.0.2',
    license: 'MIT',
    description: 'Intuitive, type-safe, lightweight state management for Vue.',
    url: 'https://github.com/vuejs/pinia',
    expanded: false,
    licenseText: `MIT License

Copyright (c) 2019-present Eduardo San Martin Morote

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`
  },
  {
    id: 'lucide',
    name: 'Lucide Vue Next',
    version: '^1.0.0',
    license: 'ISC',
    description: 'Beautiful & consistent icon toolkit for Vue applications.',
    url: 'https://github.com/lucide-icons/lucide',
    expanded: false,
    licenseText: `ISC License

Copyright (c) 2022 Lucide Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`
  },
  {
    id: 'flexsearch',
    name: 'FlexSearch',
    version: '^0.8.212',
    license: 'Apache-2.0',
    description: 'Next-generation full-text search engine for JavaScript & WebAssembly.',
    url: 'https://github.com/nextapps-de/flexsearch',
    expanded: false,
    licenseText: `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2018 Nextapps GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`
  },
  {
    id: 'jszip',
    name: 'JSZip',
    version: '^3.10.1',
    license: 'MIT / GPLv3',
    description: 'Create, read and edit .zip files with JavaScript.',
    url: 'https://github.com/Stuk/jszip',
    expanded: false,
    licenseText: `JSZip is dual-licensed. You may use it under the MIT license or the GPLv3 license.

MIT License:
Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.`
  },
  {
    id: 'xlsx',
    name: 'SheetJS (xlsx)',
    version: '^0.18.5',
    license: 'Apache-2.0',
    description: 'Parser and writer for various spreadsheet formats (Excel, CSV, etc.).',
    url: 'https://sheetjs.com',
    expanded: false,
    licenseText: `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright (C) 2012-present SheetJS LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`
  },
  {
    id: 'difflib-ts',
    name: 'difflib-ts',
    version: '1.0.3',
    license: 'PSF / MIT',
    description: 'TypeScript port of Python difflib module for string comparison and diff sequences.',
    url: 'https://github.com/mailmangroup/difflib-ts',
    expanded: false,
    licenseText: `Based on Python difflib (Python Software Foundation License 2.0 / MIT)
Copyright (c) 2021 George Borrelli / difflib-ts contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`
  },
  {
    id: 'xmldom',
    name: '@xmldom/xmldom',
    version: '^0.9.10',
    license: 'MIT',
    description: 'A JavaScript W3C standard based DOMParser and XMLSerializer.',
    url: 'https://github.com/xmldom/xmldom',
    expanded: false,
    licenseText: `MIT License

Copyright (c) 2009-2022 xmldom team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.`
  }
])

const toggleExpand = (item: OssItem) => {
  item.expanded = !item.expanded
}
</script>

<template>
  <div class="license-page">
    <div class="page-header">
      <div class="header-icon-wrapper">
        <ShieldCheck :size="28" class="header-icon" />
      </div>
      <div class="header-text">
        <h1 class="page-title">{{ $t('license.title') }}</h1>
        <p class="page-subtitle">{{ $t('license.subtitle') }}</p>
      </div>
    </div>

    <!-- Main Project License -->
    <section class="license-section">
      <div class="section-card app-license-card">
        <div class="card-header-row">
          <div class="title-with-badge">
            <span class="app-icon">🐑</span>
            <h2>{{ $t('license.app_license_title') }}</h2>
            <span class="badge-license badge-mit">MIT License</span>
          </div>
          <button
            class="btn-copy"
            @click="copyText(sheepCombLicense, 'main')"
            :title="copiedIndex === 'main' ? 'Copied!' : 'Copy License'"
          >
            <Check v-if="copiedIndex === 'main'" :size="14" class="copy-done" />
            <Copy v-else :size="14" />
            <span>{{ copiedIndex === 'main' ? 'Copied' : 'Copy' }}</span>
          </button>
        </div>

        <p class="section-desc">{{ $t('license.app_license_desc') }}</p>

        <pre class="license-pre"><code>{{ sheepCombLicense }}</code></pre>
      </div>
    </section>

    <!-- OSS Licenses Section -->
    <section class="license-section">
      <div class="section-title-group">
        <div class="section-title-with-icon">
          <Package :size="20" class="section-icon" />
          <h2>{{ $t('license.oss_license_title') }}</h2>
        </div>
        <p class="section-desc">{{ $t('license.oss_license_desc') }}</p>
      </div>

      <div class="oss-grid">
        <div v-for="item in ossList" :key="item.id" class="oss-card">
          <div class="oss-card-header">
            <div class="oss-info">
              <div class="oss-name-row">
                <a
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="oss-name"
                >
                  {{ item.name }}
                  <ExternalLink :size="12" class="oss-ext-icon" />
                </a>
                <span class="oss-version">{{ item.version }}</span>
              </div>
              <p class="oss-desc">{{ item.description }}</p>
            </div>
            <div class="oss-meta">
              <span
                class="badge-license"
                :class="{
                  'badge-mit': item.license.includes('MIT') || item.license.includes('ISC'),
                  'badge-apache': item.license.includes('Apache')
                }"
              >
                {{ item.license }}
              </span>
            </div>
          </div>

          <div class="oss-card-actions">
            <button class="btn-toggle-license" @click="toggleExpand(item)">
              <span>{{ item.expanded ? $t('license.hide_license') : $t('license.view_license') }}</span>
              <ChevronUp v-if="item.expanded" :size="14" />
              <ChevronDown v-else :size="14" />
            </button>
            <button
              v-if="item.expanded"
              class="btn-copy-small"
              @click="copyText(item.licenseText, item.id)"
              :title="copiedIndex === item.id ? 'Copied!' : 'Copy'"
            >
              <Check v-if="copiedIndex === item.id" :size="13" class="copy-done" />
              <Copy v-else :size="13" />
            </button>
          </div>

          <transition name="expand">
            <div v-if="item.expanded" class="oss-license-body">
              <pre class="license-pre-compact"><code>{{ item.licenseText }}</code></pre>
            </div>
          </transition>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.license-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px 60px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 36px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border);
}

.header-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: var(--radius);
  background: var(--accent-glow);
  border: 1px solid var(--border-accent);
}

.header-icon {
  color: var(--accent);
}

.page-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 0.88rem;
  color: var(--text-secondary);
}

.license-section {
  margin-bottom: 40px;
}

.section-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}

.app-license-card {
  border-color: rgba(16, 185, 129, 0.25);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.app-icon {
  font-size: 1.3rem;
}

.title-with-badge h2 {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-title-group {
  margin-bottom: 20px;
}

.section-title-with-icon {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.section-title-with-icon h2 {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.section-icon {
  color: var(--accent);
}

.section-desc {
  font-size: 0.84rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.badge-license {
  font-family: 'Inter', monospace;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.badge-mit {
  background: var(--accent-glow);
  color: var(--accent-light);
  border-color: var(--border-accent);
}

.badge-apache {
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
}

.btn-copy,
.btn-copy-small {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--transition);
}

.btn-copy {
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 600;
}

.btn-copy-small {
  padding: 4px 8px;
  font-size: 0.72rem;
}

.btn-copy:hover,
.btn-copy-small:hover {
  color: var(--text-primary);
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.copy-done {
  color: var(--success);
}

.license-pre {
  margin-top: 16px;
  padding: 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: 'Inter', monospace;
  font-size: 0.8rem;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.license-pre-compact {
  padding: 12px 16px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  font-family: 'Inter', monospace;
  font-size: 0.76rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* OSS Grid */
.oss-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.oss-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px 20px;
  transition: var(--transition);
}

.oss-card:hover {
  border-color: var(--border-hover);
}

.oss-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.oss-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.oss-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.oss-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--transition);
}

.oss-name:hover {
  color: var(--accent-light);
}

.oss-ext-icon {
  opacity: 0.5;
}

.oss-version {
  font-family: 'Inter', monospace;
  font-size: 0.72rem;
  color: var(--text-muted);
}

.oss-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.oss-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.btn-toggle-license {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
  transition: opacity var(--transition);
}

.btn-toggle-license:hover {
  opacity: 0.8;
}

.oss-license-body {
  margin-top: 12px;
}

/* Animations */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease-out;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
