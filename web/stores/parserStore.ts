// Note: Using relative paths instead of Nuxt aliases (~~, ~, @) to ensure stable resolution.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Segment } from '../../logic/simple/parsers.js'


export const useParserStore = defineStore('parser', () => {
  // --- State ---
  const segments = ref<Segment[]>([])
  const srcFiles = ref<File[]>([])
  const tmFiles = ref<File[]>([])
  const isMatched = ref(false)
  const isLoading = ref(false)
  const statusMsg = ref<{ text: string; type: 'info' | 'success' | 'error' }>({
    text: '',
    type: 'info',
  })

  // --- Getters ---
  const segmentCount = computed(() => segments.value.length)
  const hasSegments = computed(() => segments.value.length > 0)
  const hasSrcFiles = computed(() => srcFiles.value.length > 0)

  // --- Actions ---
  function setSegments(newSegments: Segment[]) {
    segments.value = newSegments
  }

  function setSrcFiles(files: File[]) {
    srcFiles.value = files
  }

  function addTmFiles(files: File[]) {
    tmFiles.value = [...tmFiles.value, ...files]
  }

  function clearSrcFiles() {
    srcFiles.value = []
  }

  function clearTmFiles() {
    tmFiles.value = []
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setStatus(text: string, type: 'info' | 'success' | 'error') {
    statusMsg.value = { text, type }
  }

  function setMatched(matched: boolean) {
    isMatched.value = matched
  }

  function clear() {
    segments.value = []
    srcFiles.value = []
    tmFiles.value = []
    isMatched.value = false
    isLoading.value = false
    statusMsg.value = { text: '', type: 'info' }
  }

  return {
    // State
    segments,
    srcFiles,
    tmFiles,
    isMatched,
    isLoading,
    statusMsg,
    // Getters
    segmentCount,
    hasSegments,
    hasSrcFiles,
    // Actions
    setSegments,
    setSrcFiles,
    addTmFiles,
    clearSrcFiles,
    clearTmFiles,
    setLoading,
    setStatus,
    setMatched,
    clear,
  }
})
