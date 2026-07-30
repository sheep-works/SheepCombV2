<script setup lang="ts">
definePageMeta({
  title: 'テキストチャンク',
  icon: 'scissors',
})

import { ref, computed } from 'vue'
import { Scissors, Trash2 } from 'lucide-vue-next'

const inputText = ref('')
const chunkSize = ref(3000)
const removeDuplicates = ref(false)

const chunkCount = computed(() => {
  if (!inputText.value) return 0
  const matches = inputText.value.match(/--- CHUNK \d+ ---/g)
  return (matches ? matches.length : 0) + 1
})

const runChunk = () => {
  // First clear any existing chunk marks to avoid nesting/duplication
  let text = inputText.value.replace(/--- CHUNK \d+ ---\n?/g, '')
  if (!text) return
  
  let lines = text.split('\n')
  
  if (removeDuplicates.value) {
    const seen = new Set<string>()
    lines = lines.filter(line => {
      if (line.trim() === '') return true // 空行は重複除外しない
      if (seen.has(line)) return false
      seen.add(line)
      return true
    })
  }

  const chunks = []
  let currentChunk = []
  let currentLength = 0
  
  for (const line of lines) {
    if (currentLength + line.length > chunkSize.value && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
      currentChunk = [line]
      currentLength = line.length + 1
    } else {
      currentChunk.push(line)
      currentLength += line.length + 1
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'))
  }
  
  let result = chunks[0] || ''
  for (let i = 1; i < chunks.length; i++) {
    result += `\n--- CHUNK ${i} ---\n` + chunks[i]
  }
  
  inputText.value = result
}

const clearChunks = () => {
  inputText.value = inputText.value.replace(/--- CHUNK \d+ ---\n?/g, '')
}
</script>

<template>
  <div class="chunk-view">
    <div class="chunk-layout">
      <!-- Sidebar: Controls -->
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h2>テキストチャンクツール</h2>
          </div>
          <div class="action-list">
            <div class="input-group">
              <label for="chunk-size">チャンクサイズ</label>
              <input 
                id="chunk-size"
                type="number" 
                v-model.number="chunkSize" 
                min="1" 
                class="num-input" 
              />
            </div>

            <label class="checkbox-label">
              <input type="checkbox" v-model="removeDuplicates" />
              <span>重複する行を削除する</span>
            </label>
            
            <button class="btn primary" @click="runChunk" :disabled="!inputText">
              <Scissors :size="18" /> 実行
            </button>
            
            <button class="btn outline" @click="clearChunks" :disabled="!inputText">
              <Trash2 :size="18" /> チャンクマーク消去
            </button>
          </div>
          
          <div class="stats-box" v-if="inputText">
            <div class="stat-item">
              <span class="stat-label">現在のチャンク数</span>
              <span class="stat-value">{{ chunkCount }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="card fill-height">
          <div class="card-header">
            <h3>テキスト入力</h3>
          </div>
          <div class="editor-area">
            <textarea
              v-model="inputText"
              placeholder="ここにテキストを入力してください..."
              class="text-area"
            ></textarea>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.chunk-view {
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.chunk-layout {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fill-height {
  height: 100%;
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.card-header h2, .card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--text-primary);
}

.action-list {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.input-group label {
  font-size: 0.9rem;
  color: var(--text-primary);
  font-weight: 500;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text-primary);
  cursor: pointer;
}

.checkbox-label input {
  cursor: pointer;
}

.stats-box {
  padding: 16px 20px;
  background: var(--bg-hover);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: var(--text-muted, #6b7280);
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: var(--text-primary);
}

.num-input {
  padding: 10px 12px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition, all 0.2s);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--accent);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn.outline {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.btn.outline:hover:not(:disabled) {
  background: var(--bg-hover);
}

.editor-area {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.text-area {
  flex: 1;
  width: 100%;
  resize: none;
  padding: 16px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
}

.text-area:focus {
  outline: none;
  border-color: var(--accent);
}
</style>
