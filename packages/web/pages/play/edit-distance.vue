<script setup lang="ts">
definePageMeta({
  title: '編集距離の可視化',
  icon: 'sparkles',
})

import { ref, computed, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Sparkles,
  ArrowRightLeft,
  Trash2,
  Layers,
  Play,
  Pause,
  RotateCcw,
  StepForward,
  FastForward,
  Calculator,
  CheckCircle2,
  Percent,
  Activity,
  ArrowDownRight,
  ArrowDown,
  ArrowRight,
  Type,
  AlignLeft,
  Languages
} from 'lucide-vue-next'

const { t } = useI18n()

// Split Mode: 'char' (Character), 'space' (Space-delimited), or 'segmenter' (Intl.Segmenter)
type SplitMode = 'char' | 'space' | 'segmenter'
const splitMode = ref<SplitMode>('char')

// User Input
const sourceStr = ref('kitten')
const targetStr = ref('sitting')

// Helper function for Intl.Segmenter tokenization (JA, ZH, EN, etc.)
function tokenizeBySegmenter(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(['ja', 'zh', 'en'], { granularity: 'word' })
      const segs = Array.from(segmenter.segment(trimmed))
      return segs
        .map((s) => s.segment)
        .filter((s) => s.trim().length > 0)
        .slice(0, 15)
    } catch {
      return trimmed.split(/\s+/).slice(0, 15)
    }
  }
  return trimmed.split(/\s+/).slice(0, 15)
}

// Tokens computed from mode
const tokensA = computed<string[]>(() => {
  if (splitMode.value === 'char') {
    return Array.from(sourceStr.value.slice(0, 20))
  } else if (splitMode.value === 'space') {
    const raw = sourceStr.value.trim()
    return raw ? raw.split(/\s+/).slice(0, 15) : []
  } else {
    return tokenizeBySegmenter(sourceStr.value)
  }
})

const tokensB = computed<string[]>(() => {
  if (splitMode.value === 'char') {
    return Array.from(targetStr.value.slice(0, 20))
  } else if (splitMode.value === 'space') {
    const raw = targetStr.value.trim()
    return raw ? raw.split(/\s+/).slice(0, 15) : []
  } else {
    return tokenizeBySegmenter(targetStr.value)
  }
})

// Animation Speed
type SpeedType = 'slow' | 'normal' | 'fast' | 'instant'
const speed = ref<SpeedType>('normal')
const speedDelays: Record<SpeedType, number> = {
  slow: 600,
  normal: 200,
  fast: 50,
  instant: 0,
}

// Animation Status
type AnimStatus = 'idle' | 'running' | 'paused' | 'backtracking' | 'finished'
const animStatus = ref<AnimStatus>('idle')

// Cell structure for the table
interface CellData {
  r: number
  c: number
  val: number | null
  tokenA?: string
  tokenB?: string
  isMatch?: boolean
  isComputed: boolean
  isPath?: boolean
  costDiag?: number
  costTop?: number
  costLeft?: number
  minCost?: number
  chosenOp?: 'match' | 'replace' | 'insert' | 'delete' | 'base'
}

// Backtrack step
interface BacktrackOp {
  step: number
  type: 'match' | 'replace' | 'insert' | 'delete'
  tokenA: string
  tokenB: string
  r: number
  c: number
  description: string
}

// Alignment tokens
interface AlignmentResult {
  top: string[]
  bottom: string[]
  ops: ('match' | 'replace' | 'insert' | 'delete')[]
}

// Full computed solution
const fullSolution = computed(() => {
  const tokA = tokensA.value
  const tokB = tokensB.value
  const lenA = tokA.length
  const lenB = tokB.length

  const numRows = lenB + 2
  const numCols = lenA + 2

  // 2D grid matrix
  const matrix: CellData[][] = []

  for (let r = 0; r < numRows; r++) {
    const row: CellData[] = []
    for (let c = 0; c < numCols; c++) {
      let val: number | null = null
      let isComputed = false
      let chosenOp: CellData['chosenOp'] = undefined

      if (r === 1 && c === 1) {
        val = 0
        isComputed = true
        chosenOp = 'base'
      } else if (r === 1 && c >= 2) {
        val = c - 1
        isComputed = true
        chosenOp = 'base'
      } else if (c === 1 && r >= 2) {
        val = r - 1
        isComputed = true
        chosenOp = 'base'
      }

      row.push({
        r,
        c,
        val,
        tokenA: c >= 2 ? tokA[c - 2] : undefined,
        tokenB: r >= 2 ? tokB[r - 2] : undefined,
        isComputed,
        chosenOp,
      })
    }
    matrix.push(row)
  }

  // Calculate full DP values
  const dp: number[][] = Array.from({ length: lenB + 1 }, () => Array(lenA + 1).fill(0))
  for (let i = 0; i <= lenB; i++) {
    const r = dp[i]
    if (r) r[0] = i
  }
  const row0 = dp[0]
  if (row0) {
    for (let j = 0; j <= lenA; j++) row0[j] = j
  }

  const cellDetails: Record<string, {
    diagVal: number
    topVal: number
    leftVal: number
    tokenA: string
    tokenB: string
    isMatch: boolean
    costDiag: number
    costTop: number
    costLeft: number
    minCost: number
    chosenOp: 'match' | 'replace' | 'insert' | 'delete'
    prefixA: string[]
    prefixB: string[]
    prefixTextA: string
    prefixTextB: string
    prefixLenA: number
    prefixLenB: number
  }> = {}

  for (let r = 2; r < numRows; r++) {
    const i = r - 1
    const curRow = dp[i]
    const prevRow = dp[i - 1]
    const tokenB = tokB[r - 2] ?? ''

    if (!curRow || !prevRow) continue

    for (let c = 2; c < numCols; c++) {
      const tokenA = tokA[c - 2] ?? ''
      const isMatch = tokenA === tokenB
      const j = c - 1

      const diagVal = prevRow[j - 1] ?? 0
      const topVal = prevRow[j] ?? 0
      const leftVal = curRow[j - 1] ?? 0

      const costDiag = diagVal + (isMatch ? 0 : 1)
      const costTop = topVal + 1
      const costLeft = leftVal + 1

      const minCost = Math.min(costDiag, costTop, costLeft)
      curRow[j] = minCost

      let chosenOp: 'match' | 'replace' | 'insert' | 'delete' = 'replace'
      if (isMatch && minCost === costDiag) {
        chosenOp = 'match'
      } else if (minCost === costDiag) {
        chosenOp = 'replace'
      } else if (minCost === costLeft) {
        chosenOp = 'insert'
      } else {
        chosenOp = 'delete'
      }

      const prefixA = tokA.slice(0, c - 1)
      const prefixB = tokB.slice(0, r - 1)
      const prefixTextA = splitMode.value === 'char' ? prefixA.join('') : prefixA.join(splitMode.value === 'space' ? ' ' : ' / ')
      const prefixTextB = splitMode.value === 'char' ? prefixB.join('') : prefixB.join(splitMode.value === 'space' ? ' ' : ' / ')

      cellDetails[`${r},${c}`] = {
        diagVal,
        topVal,
        leftVal,
        tokenA,
        tokenB,
        isMatch,
        costDiag,
        costTop,
        costLeft,
        minCost,
        chosenOp,
        prefixA,
        prefixB,
        prefixTextA,
        prefixTextB,
        prefixLenA: c - 1,
        prefixLenB: r - 1,
      }
    }
  }

  // Backtracking path
  const pathCells: { r: number; c: number }[] = []
  const backtrackSteps: BacktrackOp[] = []
  const alignTop: string[] = []
  const alignBottom: string[] = []
  const alignOps: ('match' | 'replace' | 'insert' | 'delete')[] = []

  let currI = lenB
  let currJ = lenA

  pathCells.push({ r: currI + 1, c: currJ + 1 })

  while (currI > 0 || currJ > 0) {
    const tokenA = currJ > 0 ? (tokA[currJ - 1] ?? '') : ''
    const tokenB = currI > 0 ? (tokB[currI - 1] ?? '') : ''
    const curVal = dp[currI]?.[currJ] ?? 0
    const diagVal = (currI > 0 && currJ > 0) ? (dp[currI - 1]?.[currJ - 1] ?? 0) : undefined
    const leftVal = currJ > 0 ? (dp[currI]?.[currJ - 1] ?? 0) : undefined
    const topVal = currI > 0 ? (dp[currI - 1]?.[currJ] ?? 0) : undefined

    if (
      currI > 0 &&
      currJ > 0 &&
      tokenA === tokenB &&
      curVal === diagVal
    ) {
      backtrackSteps.push({
        step: 0,
        type: 'match',
        tokenA,
        tokenB,
        r: currI + 1,
        c: currJ + 1,
        description: `一致 (Keep): '${tokenA}'`,
      })
      alignTop.push(tokenA)
      alignBottom.push(tokenB)
      alignOps.push('match')
      currI--
      currJ--
    } else if (
      currI > 0 &&
      currJ > 0 &&
      diagVal !== undefined &&
      curVal === diagVal + 1
    ) {
      backtrackSteps.push({
        step: 0,
        type: 'replace',
        tokenA,
        tokenB,
        r: currI + 1,
        c: currJ + 1,
        description: `置換 (Replace): '${tokenA}' → '${tokenB}'`,
      })
      alignTop.push(tokenA)
      alignBottom.push(tokenB)
      alignOps.push('replace')
      currI--
      currJ--
    } else if (currJ > 0 && leftVal !== undefined && curVal === leftVal + 1) {
      backtrackSteps.push({
        step: 0,
        type: 'insert',
        tokenA: tokenA,
        tokenB: '',
        r: currI + 1,
        c: currJ + 1,
        description: `挿入 (Ins): '${tokenA}'`,
      })
      alignTop.push(tokenA)
      alignBottom.push('-')
      alignOps.push('insert')
      currJ--
    } else if (currI > 0 && topVal !== undefined && curVal === topVal + 1) {
      backtrackSteps.push({
        step: 0,
        type: 'delete',
        tokenA: '',
        tokenB: tokenB,
        r: currI + 1,
        c: currJ + 1,
        description: `削除 (Del): '${tokenB}'`,
      })
      alignTop.push('-')
      alignBottom.push(tokenB)
      alignOps.push('delete')
      currI--
    } else {
      break
    }
    pathCells.push({ r: currI + 1, c: currJ + 1 })
  }

  // Reverse backtracked steps to display in forward chronological order
  const stepsForward = backtrackSteps.reverse().map((st, idx) => ({
    ...st,
    step: idx + 1,
  }))
  const alignment: AlignmentResult = {
    top: alignTop.reverse(),
    bottom: alignBottom.reverse(),
    ops: alignOps.reverse(),
  }

  const finalDistance = dp[lenB]?.[lenA] ?? 0
  const maxLen = Math.max(lenA, lenB)
  const distanceRatio = maxLen === 0 ? 0 : Math.round((finalDistance / maxLen) * 10000) / 100
  const matchRate = maxLen === 0 ? 100 : Math.round((1 - finalDistance / maxLen) * 10000) / 100

  return {
    tokA,
    tokB,
    lenA,
    lenB,
    numRows,
    numCols,
    matrix,
    cellDetails,
    pathCells,
    pathSet: new Set(pathCells.map((p) => `${p.r},${p.c}`)),
    stepsForward,
    alignment,
    finalDistance,
    maxLen,
    distanceRatio,
    matchRate,
  }
})

// Current Step in Animation (row by row: r from 2 to numRows-1, c from 2 to numCols-1)
const currentStep = ref<number>(-1)
const currentBacktrackIdx = ref<number>(-1)
let timerId: ReturnType<typeof setTimeout> | null = null

// Total calculation cells
const totalCalcCells = computed(() => {
  return fullSolution.value.lenA * fullSolution.value.lenB
})

// Current cell coordinates from currentStep
const currentCell = computed<{ r: number; c: number } | null>(() => {
  if (currentStep.value < 0 || currentStep.value >= totalCalcCells.value) {
    return null
  }
  const lenA = fullSolution.value.lenA
  if (lenA === 0) return null
  const r = Math.floor(currentStep.value / lenA) + 2
  const c = (currentStep.value % lenA) + 2
  return { r, c }
})

// Current cell computation detail
const currentDetail = computed(() => {
  if (!currentCell.value) return null
  const key = `${currentCell.value.r},${currentCell.value.c}`
  return fullSolution.value.cellDetails[key] || null
})

// Interactive Grid reflecting step progress
const displayGrid = computed(() => {
  const sol = fullSolution.value
  const grid: CellData[][] = []

  for (let r = 0; r < sol.numRows; r++) {
    const row: CellData[] = []
    for (let c = 0; c < sol.numCols; c++) {
      let isComputed = false
      let val: number | null = null
      let isPath = false

      if (r < 2 || c < 2) {
        isComputed = true
        if (r === 1 && c === 1) val = 0
        else if (r === 1 && c >= 2) val = c - 1
        else if (c === 1 && r >= 2) val = r - 1
      } else {
        const stepOfCell = (r - 2) * sol.lenA + (c - 2)
        if (animStatus.value === 'finished' || stepOfCell <= currentStep.value) {
          isComputed = true
          val = sol.cellDetails[`${r},${c}`]?.minCost ?? null
        }
      }

      // Check path status during backtracking or finished
      if (
        (animStatus.value === 'finished' || animStatus.value === 'backtracking') &&
        sol.pathSet.has(`${r},${c}`)
      ) {
        if (animStatus.value === 'finished') {
          isPath = true
        } else if (currentBacktrackIdx.value >= 0) {
          const revealedPath = sol.pathCells.slice(0, currentBacktrackIdx.value + 1)
          if (revealedPath.some((p) => p.r === r && p.c === c)) {
            isPath = true
          }
        }
      }

      const tokenA = c >= 2 ? sol.tokA[c - 2] : undefined
      const tokenB = r >= 2 ? sol.tokB[r - 2] : undefined
      const isMatch = r >= 2 && c >= 2 ? tokenA !== undefined && tokenB !== undefined && tokenA === tokenB : undefined

      row.push({
        r,
        c,
        val,
        tokenA,
        tokenB,
        isMatch,
        isComputed,
        isPath,
      })
    }
    grid.push(row)
  }
  return grid
})

// Progress percentage
const progressPercent = computed(() => {
  if (totalCalcCells.value === 0) return 100
  if (animStatus.value === 'finished') return 100
  if (currentStep.value < 0) return 0
  return Math.min(100, Math.round(((currentStep.value + 1) / totalCalcCells.value) * 100))
})

// Clear timers
const clearTimer = () => {
  if (timerId) {
    clearTimeout(timerId)
    timerId = null
  }
}

// Reset everything
const handleReset = () => {
  clearTimer()
  animStatus.value = 'idle'
  currentStep.value = -1
  currentBacktrackIdx.value = -1
}

// Switch Mode
const handleModeChange = (mode: SplitMode) => {
  if (splitMode.value === mode) return
  splitMode.value = mode
  handleReset()
  if (mode === 'space') {
    sourceStr.value = 'The quick brown fox'
    targetStr.value = 'The fast brown dog'
  } else if (mode === 'segmenter') {
    sourceStr.value = '今日はいい天気ですね'
    targetStr.value = '明日はいい天気ですね'
  } else {
    sourceStr.value = 'kitten'
    targetStr.value = 'sitting'
  }
}

// Single step execution
const stepForwardOne = () => {
  if (totalCalcCells.value === 0) {
    animStatus.value = 'finished'
    return
  }

  if (currentStep.value < totalCalcCells.value - 1) {
    currentStep.value++
  } else {
    startBacktracking()
  }
}

// Step back loop
const loopBacktrack = () => {
  clearTimer()
  const sol = fullSolution.value
  if (currentBacktrackIdx.value < sol.pathCells.length - 1) {
    currentBacktrackIdx.value++
    const delay = speedDelays[speed.value]
    if (delay === 0) {
      currentBacktrackIdx.value = sol.pathCells.length - 1
      animStatus.value = 'finished'
    } else {
      timerId = setTimeout(loopBacktrack, delay)
    }
  } else {
    animStatus.value = 'finished'
  }
}

const startBacktracking = () => {
  clearTimer()
  animStatus.value = 'backtracking'
  currentBacktrackIdx.value = 0
  const delay = speedDelays[speed.value]
  if (delay === 0) {
    currentBacktrackIdx.value = fullSolution.value.pathCells.length - 1
    animStatus.value = 'finished'
  } else {
    timerId = setTimeout(loopBacktrack, delay)
  }
}

// Main run loop
const loopRun = () => {
  clearTimer()
  if (animStatus.value !== 'running') return

  if (currentStep.value < totalCalcCells.value - 1) {
    currentStep.value++
    const delay = speedDelays[speed.value]
    if (delay === 0) {
      currentStep.value = totalCalcCells.value - 1
      startBacktracking()
    } else {
      timerId = setTimeout(loopRun, delay)
    }
  } else {
    startBacktracking()
  }
}

// Start / Resume
const handleRun = () => {
  if (totalCalcCells.value === 0) {
    animStatus.value = 'finished'
    return
  }
  if (animStatus.value === 'finished') {
    handleReset()
  }
  animStatus.value = 'running'
  loopRun()
}

// Pause
const handlePause = () => {
  clearTimer()
  animStatus.value = 'paused'
}

// Skip to end
const handleSkipToEnd = () => {
  clearTimer()
  currentStep.value = totalCalcCells.value - 1
  currentBacktrackIdx.value = fullSolution.value.pathCells.length - 1
  animStatus.value = 'finished'
}

// Swap inputs
const handleSwap = () => {
  handleReset()
  const temp = sourceStr.value
  sourceStr.value = targetStr.value
  targetStr.value = temp
}

// Clear inputs
const handleClear = () => {
  handleReset()
  sourceStr.value = ''
  targetStr.value = ''
}

// Reset when input strings change
watch([sourceStr, targetStr], () => {
  handleReset()
})

onUnmounted(() => {
  clearTimer()
})
</script>

<template>
  <div class="edit-distance-view">
    <!-- Header -->
    <header class="page-header">
      <div class="header-icon">
        <Sparkles :size="28" />
      </div>
      <div class="header-content">
        <h1>{{ $t('play.edit_distance.title', '編集距離の可視化（動的計画法 DP）') }}</h1>
        <p class="subtitle">
          {{ $t('play.edit_distance.subtitle', 'レーベンシュタイン距離の計算過程・セル遷移・CATツール一致率をステップアニメーションで体験') }}
        </p>
      </div>
    </header>

    <div class="main-layout">
      <!-- Input & Configuration Card -->
      <section class="card input-section">
        <div class="card-header">
          <div class="header-title-group">
            <h2>
              <Layers :size="18" />
              入力設定
            </h2>
            <!-- Mode Selector Toggle -->
            <div class="mode-toggle">
              <span class="mode-label">{{ $t('play.edit_distance.mode_label', '比較単位:') }}</span>
              <div class="mode-pill-group">
                <button
                  class="mode-btn"
                  :class="{ active: splitMode === 'char' }"
                  @click="handleModeChange('char')"
                  title="1文字単位で比較します (日本語・CJK・単語内タイポ)"
                >
                  <Type :size="14" />
                  {{ $t('play.edit_distance.mode_char', '文字') }}
                </button>
                <button
                  class="mode-btn"
                  :class="{ active: splitMode === 'space' }"
                  @click="handleModeChange('space')"
                  title="スペースで区切った単語列として比較します (英語文・CATツール)"
                >
                  <AlignLeft :size="14" />
                  {{ $t('play.edit_distance.mode_space', '単語') }}
                </button>
                <button
                  class="mode-btn"
                  :class="{ active: splitMode === 'segmenter' }"
                  @click="handleModeChange('segmenter')"
                  title="ブラウザ標準のIntl.Segmenterで日本語・中国語などの形態素・分かち書き単位で比較します"
                >
                  <Languages :size="14" />
                  {{ $t('play.edit_distance.mode_segmenter', 'トークン') }}
                </button>
              </div>
            </div>
          </div>

          <div class="header-actions">
            <button class="btn-tool" @click="handleSwap" :title="$t('play.edit_distance.swap', '入れ替え')">
              <ArrowRightLeft :size="15" />
              <span>{{ $t('play.edit_distance.swap', '入れ替え') }}</span>
            </button>
            <button class="btn-tool" @click="handleClear" :title="$t('play.edit_distance.clear', 'クリア')">
              <Trash2 :size="15" />
              <span>{{ $t('play.edit_distance.clear', 'クリア') }}</span>
            </button>
          </div>
        </div>

        <div class="inputs-grid">
          <div class="input-group">
            <label for="src-input">
              <span class="badge src">A (横 / 列)</span>
              {{ $t('play.edit_distance.str1_label', '文字列 A (Source)') }}
              <span class="len-badge" :class="{ 'at-limit': tokensA.length >= (splitMode === 'char' ? 20 : 15) }">
                {{ tokensA.length }} / {{ splitMode === 'char' ? '20 文字' : '15 単語' }}
              </span>
            </label>
            <input
              id="src-input"
              type="text"
              v-model="sourceStr"
              :maxlength="splitMode === 'char' ? 20 : 120"
              :placeholder="
                splitMode === 'char'
                  ? $t('play.edit_distance.str1_placeholder_char')
                  : splitMode === 'space'
                  ? $t('play.edit_distance.str1_placeholder_space')
                  : $t('play.edit_distance.str1_placeholder_segmenter')
              "
              class="text-input"
            />
          </div>

          <div class="input-group">
            <label for="tgt-input">
              <span class="badge tgt">B (縦 / 行)</span>
              {{ $t('play.edit_distance.str2_label', '文字列 B (Target)') }}
              <span class="len-badge" :class="{ 'at-limit': tokensB.length >= (splitMode === 'char' ? 20 : 15) }">
                {{ tokensB.length }} / {{ splitMode === 'char' ? '20 文字' : '15 単語' }}
              </span>
            </label>
            <input
              id="tgt-input"
              type="text"
              v-model="targetStr"
              :maxlength="splitMode === 'char' ? 20 : 120"
              :placeholder="
                splitMode === 'char'
                  ? $t('play.edit_distance.str2_placeholder_char')
                  : splitMode === 'space'
                  ? $t('play.edit_distance.str2_placeholder_space')
                  : $t('play.edit_distance.str2_placeholder_segmenter')
              "
              class="text-input"
            />
          </div>
        </div>
      </section>

      <!-- Control Bar -->
      <section class="card control-bar">
        <div class="control-actions">
          <button
            v-if="animStatus !== 'running'"
            class="btn btn-primary"
            @click="handleRun"
            :disabled="fullSolution.lenA === 0 && fullSolution.lenB === 0"
          >
            <Play :size="16" />
            <span>{{ animStatus === 'paused' ? $t('play.edit_distance.btn_resume', '再開') : $t('play.edit_distance.btn_run', '計算を開始') }}</span>
          </button>
          <button
            v-else
            class="btn btn-warning"
            @click="handlePause"
          >
            <Pause :size="16" />
            <span>{{ $t('play.edit_distance.btn_pause', '一時停止') }}</span>
          </button>

          <button
            class="btn btn-secondary"
            @click="stepForwardOne"
            :disabled="animStatus === 'running' || animStatus === 'finished'"
          >
            <StepForward :size="16" />
            <span>{{ $t('play.edit_distance.btn_step', '1ステップ進める') }}</span>
          </button>

          <button
            class="btn btn-outline"
            @click="handleSkipToEnd"
            :disabled="animStatus === 'finished'"
          >
            <FastForward :size="16" />
            <span>{{ $t('play.edit_distance.btn_skip', '最後までスキップ') }}</span>
          </button>

          <button
            class="btn btn-outline"
            @click="handleReset"
            :disabled="animStatus === 'idle' && currentStep === -1"
          >
            <RotateCcw :size="16" />
            <span>{{ $t('play.edit_distance.btn_reset', 'リセット') }}</span>
          </button>
        </div>

        <div class="speed-controls">
          <span class="speed-label">速度:</span>
          <div class="speed-pill-group">
            <button
              class="speed-btn"
              :class="{ active: speed === 'slow' }"
              @click="speed = 'slow'"
            >
              {{ $t('play.edit_distance.speed_slow', '低速') }}
            </button>
            <button
              class="speed-btn"
              :class="{ active: speed === 'normal' }"
              @click="speed = 'normal'"
            >
              {{ $t('play.edit_distance.speed_normal', '標準') }}
            </button>
            <button
              class="speed-btn"
              :class="{ active: speed === 'fast' }"
              @click="speed = 'fast'"
            >
              {{ $t('play.edit_distance.speed_fast', '高速') }}
            </button>
            <button
              class="speed-btn"
              :class="{ active: speed === 'instant' }"
              @click="speed = 'instant'"
            >
              {{ $t('play.edit_distance.speed_instant', '即時') }}
            </button>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="progress-wrap">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="progress-text">
            {{ currentStep >= 0 ? currentStep + 1 : 0 }} / {{ totalCalcCells }} セル ({{ progressPercent }}%)
          </span>
        </div>
      </section>

      <!-- Main Visual Grid: Matrix (Left) + Live Commentary (Right) -->
      <div class="visual-grid">
        <!-- DP Matrix Table -->
        <section class="card matrix-card">
          <div class="card-header">
            <div>
              <h2>
                <Layers :size="18" />
                {{ $t('play.edit_distance.matrix_title', '動的計画法（DP）マトリックス') }}
                <span class="dim-badge">{{ fullSolution.numRows }} × {{ fullSolution.numCols }}</span>
              </h2>
            </div>
            <div class="legend">
              <span class="legend-item"><span class="legend-dot active"></span>計算中</span>
              <span class="legend-item"><span class="legend-dot source-diag"></span>斜め参照</span>
              <span class="legend-item"><span class="legend-dot source-top"></span>上参照</span>
              <span class="legend-item"><span class="legend-dot source-left"></span>左参照</span>
              <span class="legend-item"><span class="legend-dot path"></span>最短パス</span>
              <span class="legend-divider">|</span>
              <span class="legend-item"><span class="legend-symbol match">〇</span> 一致 (Cost: 0)</span>
              <span class="legend-item"><span class="legend-symbol mismatch">×</span> 不一致 (Cost: +1)</span>
            </div>
          </div>

          <div class="table-container">
            <table class="dp-table" :class="{ 'is-word-mode': splitMode !== 'char' }">
              <tbody>
                <tr v-for="(row, rIdx) in displayGrid" :key="'r-' + rIdx">
                  <td
                    v-for="(cell, cIdx) in row"
                    :key="'c-' + rIdx + '-' + cIdx"
                    class="dp-cell"
                    :class="{
                      'cell-header-corner': rIdx === 0 && cIdx === 0,
                      'cell-char-header-top': rIdx === 0 && cIdx >= 1,
                      'cell-char-header-left': cIdx === 0 && rIdx >= 1,
                      'cell-base-row': rIdx === 1 && cIdx >= 1,
                      'cell-base-col': cIdx === 1 && rIdx >= 1,
                      'is-active': currentCell && currentCell.r === rIdx && currentCell.c === cIdx,
                      'is-source-diag': currentCell && currentCell.r - 1 === rIdx && currentCell.c - 1 === cIdx,
                      'is-source-top': currentCell && currentCell.r - 1 === rIdx && currentCell.c === cIdx,
                      'is-source-left': currentCell && currentCell.r === rIdx && currentCell.c - 1 === cIdx,
                      'is-computed': cell.isComputed,
                      'is-match-cell': rIdx >= 2 && cIdx >= 2 && cell.isMatch,
                      'is-mismatch-cell': rIdx >= 2 && cIdx >= 2 && !cell.isMatch,
                      'is-path': cell.isPath,
                      'is-goal': rIdx === fullSolution.numRows - 1 && cIdx === fullSolution.numCols - 1 && cell.isComputed
                    }"
                    :title="
                      rIdx >= 2 && cIdx >= 2
                        ? cell.isMatch
                          ? `一致 (〇): A='${cell.tokenA}' === B='${cell.tokenB}' (斜め遷移コスト: 0)\n部分問題: '${tokensA.slice(0, cIdx - 1).join(splitMode === 'char' ? '' : ' ')}' ➔ '${tokensB.slice(0, rIdx - 1).join(splitMode === 'char' ? '' : ' ')}' の編集コスト`
                          : `不一致 (×): A='${cell.tokenA}' ≠ B='${cell.tokenB}' (斜め遷移コスト: +1)\n部分問題: '${tokensA.slice(0, cIdx - 1).join(splitMode === 'char' ? '' : ' ')}' ➔ '${tokensB.slice(0, rIdx - 1).join(splitMode === 'char' ? '' : ' ')}' の編集コスト`
                        : undefined
                    "
                  >
                    <!-- Row 0: Top char/token labels -->
                    <template v-if="rIdx === 0">
                      <span v-if="cIdx === 0" class="corner-label">B \ A</span>
                      <span v-else-if="cIdx === 1" class="eps-label">ε</span>
                      <span v-else class="char-label top" :title="cell.tokenA">{{ cell.tokenA }}</span>
                    </template>

                    <!-- Col 0: Left char/token labels -->
                    <template v-else-if="cIdx === 0">
                      <span v-if="rIdx === 1" class="eps-label">ε</span>
                      <span v-else class="char-label left" :title="cell.tokenB">{{ cell.tokenB }}</span>
                    </template>

                    <!-- Base row (r=1) or base col (c=1) -->
                    <template v-else-if="rIdx === 1 || cIdx === 1">
                      <span class="cell-val">{{ cell.val }}</span>
                    </template>

                    <!-- Core DP Grid (r >= 2 && c >= 2) -->
                    <template v-else>
                      <!-- When computed: show DP calculated number with mini match badge -->
                      <div v-if="cell.isComputed" class="cell-computed-wrap">
                        <span class="cell-val">{{ cell.val }}</span>
                        <span class="cell-mini-match" :class="cell.isMatch ? 'match' : 'mismatch'">
                          {{ cell.isMatch ? '〇' : '×' }}
                        </span>
                      </div>
                      <!-- When uncomputed (Initial/Idle state): show 〇 / × with cost hint -->
                      <div v-else class="cell-pre-match" :class="cell.isMatch ? 'match' : 'mismatch'">
                        <span class="match-symbol">{{ cell.isMatch ? '〇' : '×' }}</span>
                        <span class="match-cost-hint">{{ cell.isMatch ? '0' : '+1' }}</span>
                      </div>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Right Side: Live Calculation Commentary Panel -->
        <section class="card commentary-card">
          <!-- Active Calculating State -->
          <template v-if="currentDetail && animStatus !== 'finished'">
            <div class="commentary-header">
              <Activity :size="18" class="pulse-icon" />
              <h3>現在計算中のセル (Row {{ currentCell?.r }}, Col {{ currentCell?.c }})</h3>
              <span class="comp-badge" :class="currentDetail.isMatch ? 'match' : 'mismatch'">
                {{ currentDetail.isMatch ? '一致 (Cost = 0)' : '不一致 (Cost = 1)' }}
              </span>
            </div>
            <div class="commentary-body">
              <div class="commentary-slice-section">
                <div class="char-compare">
                  <div class="compare-item">
                    <span class="compare-lbl">{{ splitMode === 'char' ? '文字' : '単語' }} A (列 {{ (currentCell?.c ?? 2) - 1 }}):</span>
                    <strong class="char-highlight a">'{{ currentDetail.tokenA }}'</strong>
                  </div>
                  <span class="vs">vs</span>
                  <div class="compare-item">
                    <span class="compare-lbl">{{ splitMode === 'char' ? '文字' : '単語' }} B (行 {{ (currentCell?.r ?? 2) - 1 }}):</span>
                    <strong class="char-highlight b">'{{ currentDetail.tokenB }}'</strong>
                  </div>
                </div>

                <!-- Substring Slice Meaning (動的計画法の部分問題スライス) -->
                <div class="slice-meaning-box">
                  <div class="slice-meaning-header">
                    <span class="slice-badge">部分問題（スライス）</span>
                    <span class="slice-summary">
                      先頭 <strong>{{ currentDetail.prefixLenA }}</strong> {{ splitMode === 'char' ? '文字' : '単語' }} ⇄ 先頭 <strong>{{ currentDetail.prefixLenB }}</strong> {{ splitMode === 'char' ? '文字' : '単語' }}
                    </span>
                  </div>
                  <div class="slice-preview-row">
                    <div class="slice-target a">
                      <span class="target-lbl">スライス A:</span>
                      <code class="slice-code a">"{{ currentDetail.prefixTextA }}"</code>
                    </div>
                    <span class="arrow-trans">➔</span>
                    <div class="slice-target b">
                      <span class="target-lbl">スライス B:</span>
                      <code class="slice-code b">"{{ currentDetail.prefixTextB }}"</code>
                    </div>
                  </div>
                  <p class="slice-desc">
                    ※ このセル <code>dp[{{ currentDetail.prefixLenB }}][{{ currentDetail.prefixLenA }}]</code> に入る数値は、部分文字列 <code>"{{ currentDetail.prefixTextA }}"</code> を <code>"{{ currentDetail.prefixTextB }}"</code> に変換するための最小編集コストです。
                  </p>
                </div>
              </div>

              <div class="candidates-grid">
                <div
                  class="candidate-box diag"
                  :class="{ chosen: currentDetail.chosenOp === 'match' || currentDetail.chosenOp === 'replace' }"
                >
                  <div class="cand-title">
                    <ArrowDownRight :size="14" />
                    斜め左上 ({{ currentDetail.isMatch ? '一致 / Match' : '置換 / Replace' }})
                  </div>
                  <div class="cand-math">
                    {{ currentDetail.diagVal }} + {{ currentDetail.isMatch ? '0' : '1' }} = <strong>{{ currentDetail.costDiag }}</strong>
                  </div>
                </div>

                <div
                  class="candidate-box top"
                  :class="{ chosen: currentDetail.chosenOp === 'delete' }"
                >
                  <div class="cand-title">
                    <ArrowDown :size="14" />
                    上 (削除 / Delete)
                  </div>
                  <div class="cand-math">
                    {{ currentDetail.topVal }} + 1 = <strong>{{ currentDetail.costTop }}</strong>
                  </div>
                </div>

                <div
                  class="candidate-box left"
                  :class="{ chosen: currentDetail.chosenOp === 'insert' }"
                >
                  <div class="cand-title">
                    <ArrowRight :size="14" />
                    左 (挿入 / Insert)
                  </div>
                  <div class="cand-math">
                    {{ currentDetail.leftVal }} + 1 = <strong>{{ currentDetail.costLeft }}</strong>
                  </div>
                </div>
              </div>

              <div class="decision-box">
                計算結果: <code>min({{ currentDetail.costDiag }}, {{ currentDetail.costTop }}, {{ currentDetail.costLeft }})</code> = <strong class="result-highlight">{{ currentDetail.minCost }}</strong>
                <span class="op-tag" :class="'badge-' + currentDetail.chosenOp">
                  {{ currentDetail.chosenOp }}
                </span>
              </div>
            </div>
          </template>

          <!-- Finished State -->
          <template v-else-if="animStatus === 'finished'">
            <div class="commentary-header">
              <CheckCircle2 :size="18" class="text-success" />
              <h3>計算完了 (Finished)</h3>
              <span class="comp-badge match">距離: {{ fullSolution.finalDistance }}</span>
            </div>
            <div class="commentary-body">
              <div class="finished-summary-box">
                <p class="finished-summary-text">
                  最短経路（バックトラック）の探索が完了しました。
                </p>
                <div class="finished-stats">
                  <div class="f-stat-item">
                    <span class="f-lbl">最終編集距離</span>
                    <span class="f-val">{{ fullSolution.finalDistance }}</span>
                  </div>
                  <div class="f-stat-item">
                    <span class="f-lbl">一致率 (概算)</span>
                    <span class="f-val highlight">{{ fullSolution.matchRate }}%</span>
                  </div>
                </div>
                <p class="finished-sub-note">
                  ※ 詳しいCATツール一致率の計算内訳および最短変換手順は下部のカードに表示されています。
                </p>
              </div>
            </div>
          </template>

          <!-- Idle State -->
          <template v-else>
            <div class="commentary-header">
              <Activity :size="18" />
              <h3>{{ $t('play.edit_distance.live_commentary', '計算解説') }}</h3>
            </div>
            <div class="commentary-body">
              <div class="idle-guide-box">
                <p class="idle-title">💡 動的計画法（DP）の計算推移</p>
                <p class="idle-text">
                  「<strong>計算を開始</strong>」または「<strong>1ステップ進める</strong>」を押すと、左側のマトリックスで現在計算しているセルの詳細、部分文字列スライス、3方向の候補比較がここにリアルタイム表示されます。
                </p>
                <div class="idle-symbols">
                  <div class="idle-sym"><span class="sym-dot match">〇</span> 一致 (斜めコスト: 0)</div>
                  <div class="idle-sym"><span class="sym-dot mismatch">×</span> 不一致 (斜めコスト: +1)</div>
                </div>
              </div>
            </div>
          </template>
        </section>
      </div>

      <!-- Bottom Results Section: CAT Tool Metric Card & Transformation Steps -->
      <div class="bottom-results-grid">
        <!-- CAT Tool Metric Card (User Requested Formula) -->
        <section class="card cat-card">
          <div class="card-header">
            <h2>
              <Calculator :size="18" />
              {{ $t('play.edit_distance.cat_title', 'CAT ツール一致率・計算式') }}
            </h2>
          </div>
          <p class="section-desc">
            {{ $t('play.edit_distance.cat_desc', 'CATツール（Trados, memoQ, Phrase等）で用いられるファジーマッチ率（概算）') }}
          </p>

          <div class="cat-stats-grid">
            <div class="cat-stat-item">
              <div class="stat-lbl">編集距離 (Distance)</div>
              <div class="stat-num highlight">
                {{ fullSolution.finalDistance }}
              </div>
            </div>

            <div class="cat-stat-item">
              <div class="stat-lbl">最大長 max(len(a), len(b))</div>
              <div class="stat-num">
                {{ fullSolution.maxLen }} {{ splitMode === 'char' ? '文字' : '単語' }}
              </div>
            </div>

            <div class="cat-stat-item">
              <div class="stat-lbl">CAT ファジー一致率</div>
              <div
                class="stat-num rate"
                :class="{
                  high: fullSolution.matchRate >= 80,
                  mid: fullSolution.matchRate >= 50 && fullSolution.matchRate < 80,
                  low: fullSolution.matchRate < 50
                }"
              >
                {{ fullSolution.matchRate }}%
              </div>
            </div>
          </div>

          <!-- Detailed Math Breakdown Box -->
          <div class="formula-box">
            <div class="formula-title">
              <Percent :size="14" />
              {{ $t('play.edit_distance.formula_label', '計算式:') }}
            </div>
            <div class="formula-math">
              <div class="formula-line">
                一致率 = <code>(1 - (編集距離 ÷ max(len(a), len(b)))) × 100</code>
              </div>
              <div class="formula-substituted" v-if="fullSolution.maxLen > 0">
                = (1 - ({{ fullSolution.finalDistance }} ÷ {{ fullSolution.maxLen }})) × 100
                = <strong>{{ fullSolution.matchRate }}%</strong>
              </div>
              <div class="formula-distance-ratio">
                ※ 差異比率 (Distance Ratio) = ({{ fullSolution.finalDistance }} ÷ {{ fullSolution.maxLen }}) × 100 = <strong>{{ fullSolution.distanceRatio }}%</strong>
              </div>
            </div>
          </div>

          <!-- Alignment Visualization -->
          <div class="alignment-box" v-if="animStatus === 'finished' && fullSolution.alignment.top.length > 0">
            <div class="align-title">{{ $t('play.edit_distance.alignment_title', 'シーケンス・アライメント') }}:</div>
            <div class="align-display">
              <div class="align-row">
                <span class="align-lbl">A:</span>
                <span
                  v-for="(tok, idx) in fullSolution.alignment.top"
                  :key="'top-' + idx"
                  class="align-token"
                  :class="fullSolution.alignment.ops[idx]"
                >
                  {{ tok }}
                </span>
              </div>
              <div class="align-row">
                <span class="align-lbl">B:</span>
                <span
                  v-for="(tok, idx) in fullSolution.alignment.bottom"
                  :key="'bot-' + idx"
                  class="align-token"
                  :class="fullSolution.alignment.ops[idx]"
                >
                  {{ tok }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Optimal Transformation Steps -->
        <section class="card steps-card" v-if="animStatus === 'finished'">
          <div class="card-header">
            <h2>
              <CheckCircle2 :size="18" />
              {{ $t('play.edit_distance.operations_title', '最適変換ステップ') }}
              <span class="dim-badge">{{ fullSolution.stepsForward.length }} ステップ</span>
            </h2>
          </div>
          <p class="section-desc">
            {{ $t('play.edit_distance.operations_desc', 'A から B への最短変換手順') }}
          </p>

          <div class="step-timeline">
            <div
              v-for="st in fullSolution.stepsForward"
              :key="st.step"
              class="step-item"
              :class="'op-' + st.type"
            >
              <div class="step-num">{{ st.step }}</div>
              <div class="step-badge" :class="'badge-' + st.type">
                {{ st.type }}
              </div>
              <div class="step-desc">
                {{ st.description }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-distance-view {
  max-width: 1300px;
  margin: 0 auto;
  padding: 32px 24px 60px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.header-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius);
  background: var(--accent-glow);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-accent);
}

.header-content h1 {
  font-size: 1.4rem;
  font-weight: 800;
  margin-bottom: 4px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.main-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.card-header h2 {
  font-size: 1rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

/* Mode Toggle */
.mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-label {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.mode-pill-group {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 2px;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.mode-btn.active {
  background: var(--accent);
  color: #0f172a;
  font-weight: 800;
}

.dim-badge {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-weight: 600;
}

.section-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}

.btn-tool:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}

/* Inputs */
.inputs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .inputs-grid {
    grid-template-columns: 1fr;
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
}

.badge.src {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.badge.tgt {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.len-badge {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: normal;
  margin-left: auto;
}

.len-badge.at-limit {
  color: var(--warning);
  font-weight: 700;
}

.text-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: var(--transition);
}

.text-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.samples-row {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.samples-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.samples-list {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sample-pill {
  padding: 4px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: var(--transition);
}

.sample-pill:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent);
}

/* Controls */
.control-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
}

.control-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 0.85rem;
  font-weight: 700;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  border: 1px solid transparent;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #0f172a;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: 0 0 12px var(--accent-glow-strong);
}

.btn-warning {
  background: var(--warning);
  color: #0f172a;
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-color: var(--border);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-accent);
}

.btn-outline {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}

.btn-outline:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.speed-pill-group {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: 2px;
}

.speed-btn {
  padding: 4px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
}

.speed-btn.active {
  background: var(--accent);
  color: #0f172a;
  font-weight: 800;
}

.progress-wrap {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-gradient);
  transition: width 0.15s ease-out;
}

.progress-text {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-family: monospace;
  white-space: nowrap;
}

/* Live Commentary */
.commentary-card {
  background: rgba(16, 185, 129, 0.05);
  border-color: var(--border-accent);
}

.commentary-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.commentary-header h3 {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--accent-light);
}

.pulse-icon {
  color: var(--accent);
  animation: pulse 1.5s infinite;
}

.comp-badge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
}

.comp-badge.match {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.comp-badge.mismatch {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.commentary-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.commentary-slice-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.char-compare {
  font-size: 0.88rem;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.compare-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.compare-lbl {
  color: var(--text-secondary);
  font-size: 0.82rem;
}

.char-highlight {
  font-family: monospace;
  font-size: 0.95rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.char-highlight.a {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.char-highlight.b {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.vs {
  color: var(--text-muted);
  font-weight: bold;
  font-size: 0.8rem;
}

/* Slice Subproblem Meaning Box */
.slice-meaning-box {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-xs);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slice-meaning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.76rem;
}

.slice-badge {
  background: var(--accent-glow);
  color: var(--accent-light);
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.68rem;
}

.slice-summary {
  color: var(--text-muted);
}

.slice-summary strong {
  color: var(--text-primary);
}

.slice-preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.86rem;
}

.slice-target {
  display: flex;
  align-items: center;
  gap: 5px;
}

.target-lbl {
  font-size: 0.74rem;
  color: var(--text-muted);
  font-weight: 600;
}

.slice-code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}

.slice-code.a {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.25);
}

.slice-code.b {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.arrow-trans {
  color: var(--accent);
  font-weight: 800;
}

.slice-desc {
  margin: 0;
  font-size: 0.74rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.slice-desc code {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  color: var(--text-secondary);
}

.candidates-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

@media (max-width: 640px) {
  .candidates-grid {
    grid-template-columns: 1fr;
  }
}

.candidate-box {
  padding: 10px;
  border-radius: var(--radius-xs);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  transition: var(--transition);
}

.candidate-box.chosen {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.cand-title {
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.cand-math {
  font-size: 0.85rem;
  font-family: monospace;
  color: var(--text-primary);
}

.decision-box {
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.result-highlight {
  font-size: 1.1rem;
  color: var(--accent-light);
  font-weight: 800;
}

.op-tag {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

/* Visual Layout */
.visual-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 1080px) {
  .visual-grid {
    grid-template-columns: 1fr;
  }
}

.legend {
  display: flex;
  gap: 10px;
  font-size: 0.72rem;
  color: var(--text-muted);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.active {
  background: #fbbf24;
}

.legend-dot.source-diag {
  background: #34d399;
}

.legend-dot.source-top {
  background: #f87171;
}

.legend-dot.source-left {
  background: #60a5fa;
}

.legend-dot.path {
  background: #38bdf8;
}

.legend-divider {
  color: var(--border);
  font-weight: 300;
  margin: 0 2px;
}

.legend-symbol {
  font-weight: 800;
  font-size: 0.82rem;
  line-height: 1;
}

.legend-symbol.match {
  color: #34d399;
}

.legend-symbol.mismatch {
  color: #94a3b8;
}

/* DP Table */
.table-container {
  overflow: auto;
  max-height: 540px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.dp-table {
  border-collapse: collapse;
  width: 100%;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  text-align: center;
  user-select: none;
}

.dp-cell {
  padding: 8px 10px;
  border: 1px solid var(--border);
  min-width: 38px;
  height: 38px;
  position: relative;
  transition: all 0.15s ease-out;
  font-size: 0.85rem;
}

.dp-table.is-word-mode .dp-cell {
  min-width: 64px;
  padding: 8px 12px;
}

/* Row 0 and Col 0 Header cells */
.cell-header-corner {
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 700;
  position: sticky;
  top: 0;
  left: 0;
  z-index: 3;
}

.cell-char-header-top {
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  font-weight: 800;
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 2px solid rgba(59, 130, 246, 0.4);
  white-space: nowrap;
}

.cell-char-header-left {
  background: rgba(16, 185, 129, 0.12);
  color: #6ee7b7;
  font-weight: 800;
  position: sticky;
  left: 0;
  z-index: 2;
  border-right: 2px solid rgba(16, 185, 129, 0.4);
  white-space: nowrap;
}

.eps-label {
  font-style: italic;
  opacity: 0.6;
}

.cell-base-row,
.cell-base-col {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
  font-weight: 600;
}

/* Interactive States */
.dp-cell.is-active {
  background: rgba(245, 158, 11, 0.3) !important;
  color: #fef08a !important;
  font-weight: 900;
  box-shadow: inset 0 0 0 2px #f59e0b;
  transform: scale(1.06);
  z-index: 1;
}

.dp-cell.is-source-diag {
  background: rgba(16, 185, 129, 0.25) !important;
  color: #6ee7b7 !important;
  box-shadow: inset 0 0 0 1.5px #10b981;
}

.dp-cell.is-source-top {
  background: rgba(239, 68, 68, 0.22) !important;
  color: #fca5a5 !important;
  box-shadow: inset 0 0 0 1.5px #ef4444;
}

.dp-cell.is-source-left {
  background: rgba(59, 130, 246, 0.25) !important;
  color: #93c5fd !important;
  box-shadow: inset 0 0 0 1.5px #3b82f6;
}

.dp-cell.is-path {
  background: rgba(56, 189, 248, 0.3) !important;
  color: #e0f2fe !important;
  font-weight: 800;
  box-shadow: inset 0 0 0 2px #38bdf8;
}

.dp-cell.is-goal {
  box-shadow: inset 0 0 0 2.5px var(--accent);
}

.dp-cell.is-match-cell:not(.is-computed) {
  background: rgba(16, 185, 129, 0.08);
}

.dp-cell.is-match-cell:not(.is-computed):hover {
  background: rgba(16, 185, 129, 0.18);
}

.dp-cell.is-mismatch-cell:not(.is-computed):hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Pre-calculation Match Preview (〇 and ×) */
.cell-pre-match {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 100%;
  height: 100%;
  cursor: default;
}

.cell-pre-match.match {
  color: #34d399;
}

.cell-pre-match.mismatch {
  color: rgba(255, 255, 255, 0.22);
}

.match-symbol {
  font-size: 0.95rem;
  line-height: 1;
  font-weight: 800;
}

.match-cost-hint {
  font-size: 0.62rem;
  line-height: 1;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.85;
}

.cell-pre-match.match .match-cost-hint {
  color: #6ee7b7;
}

.cell-pre-match.mismatch .match-cost-hint {
  color: rgba(255, 255, 255, 0.28);
}

/* Computed state with mini badge in corner */
.cell-computed-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.cell-mini-match {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 0.58rem;
  font-weight: 800;
  line-height: 1;
  padding: 1px 2px;
  border-radius: 2px;
}

.cell-mini-match.match {
  color: #34d399;
  background: rgba(16, 185, 129, 0.2);
}

.cell-mini-match.mismatch {
  color: rgba(255, 255, 255, 0.25);
}

/* Idle & Finished States for Commentary Card */
.idle-guide-box,
.finished-summary-box {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.idle-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--accent-light);
  margin: 0;
}

.idle-text {
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.idle-symbols {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 8px 12px;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.idle-sym {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sym-dot {
  font-weight: 800;
  font-size: 0.9rem;
}

.sym-dot.match {
  color: #34d399;
}

.sym-dot.mismatch {
  color: #94a3b8;
}

.finished-summary-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

.finished-stats {
  display: flex;
  gap: 12px;
}

.f-stat-item {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.f-lbl {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

.f-val {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text-primary);
}

.f-val.highlight {
  color: var(--success);
}

.finished-sub-note {
  font-size: 0.74rem;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.4;
}

.text-success {
  color: var(--success);
}

/* Bottom Results Grid */
.bottom-results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 960px) {
  .bottom-results-grid {
    grid-template-columns: 1fr;
  }
}

.bottom-results-grid:has(> :only-child) {
  grid-template-columns: 1fr;
}

/* CAT Tool Metric Card */
.cat-card {
  background: var(--bg-card);
  border: 1px solid var(--border-accent);
}

.cat-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin: 16px 0;
}

@media (max-width: 600px) {
  .cat-stats-grid {
    grid-template-columns: 1fr;
  }
}

.cat-stat-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-lbl {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
}

.stat-num {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-primary);
}

.stat-num.highlight {
  color: var(--accent-light);
}

.stat-num.rate.high {
  color: var(--success);
}

.stat-num.rate.mid {
  color: var(--warning);
}

.stat-num.rate.low {
  color: var(--error);
}

/* Formula Box */
.formula-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 14px;
  margin-bottom: 16px;
}

.formula-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent-light);
  margin-bottom: 8px;
}

.formula-math {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--text-secondary);
}

.formula-line code {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.formula-substituted {
  color: var(--text-primary);
  font-size: 0.85rem;
}

.formula-substituted strong {
  color: var(--accent-light);
  font-size: 0.95rem;
}

.formula-distance-ratio {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 4px;
  border-top: 1px dashed var(--border);
  padding-top: 6px;
}

/* Alignment Box */
.alignment-box {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: 12px;
}

.align-title {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 700;
  margin-bottom: 8px;
}

.align-display {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  overflow-x: auto;
}

.align-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.align-lbl {
  font-size: 0.75rem;
  color: var(--text-muted);
  width: 18px;
  flex-shrink: 0;
}

.align-token {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 700;
  white-space: nowrap;
}

.align-token.match {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.align-token.replace {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.align-token.insert {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.align-token.delete {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

/* Step Timeline */
.steps-card {
  max-height: 400px;
  overflow-y: auto;
}

.step-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  font-size: 0.8rem;
}

.step-num {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  width: 20px;
  text-align: right;
  flex-shrink: 0;
}

.step-badge {
  font-size: 0.65rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.badge-match {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.badge-replace {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
}

.badge-insert {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.badge-delete {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.step-desc {
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.9);
  }
}
</style>
