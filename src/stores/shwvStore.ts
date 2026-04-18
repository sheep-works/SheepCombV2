import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ShWvData, ShWvUnit, ShWvFileInfo } from '@/types/shwv'

export const useShwvStore = defineStore('shwv', () => {
  // --- State ---
  const data = ref<ShWvData | null>(null)
  const fileName = ref('')

  // --- Getters ---
  const hasData = computed(() => data.value !== null)
  const unitCount = computed(() => data.value?.body.units.length ?? 0)
  const fileList = computed<ShWvFileInfo[]>(() => data.value?.meta.files ?? [])
  const units = computed<ShWvUnit[]>(() => data.value?.body.units ?? [])
  const terms = computed(() => data.value?.body.terms ?? [])
  const sourceLang = computed(() => data.value?.meta.sourceLang ?? '')
  const targetLang = computed(() => data.value?.meta.targetLang ?? '')

  // --- Actions ---
  function loadFromJson(jsonStr: string, name: string) {
    try {
      const parsed = JSON.parse(jsonStr) as ShWvData
      data.value = parsed
      fileName.value = name
    } catch (e) {
      console.error('Failed to parse ShWvData JSON:', e)
      throw new Error('Invalid ShWvData JSON')
    }
  }

  async function loadFromFile(file: File) {
    const text = await file.text()
    loadFromJson(text, file.name)
  }

  function setData(newData: ShWvData, name: string = '') {
    data.value = newData
    fileName.value = name
  }

  function clear() {
    data.value = null
    fileName.value = ''
  }

  return {
    // State
    data,
    fileName,
    // Getters
    hasData,
    unitCount,
    fileList,
    units,
    terms,
    sourceLang,
    targetLang,
    // Actions
    loadFromJson,
    loadFromFile,
    setData,
    clear,
  }
})
