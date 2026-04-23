// ShWvData type definitions for the SheepCombWeb SPA
// Ported from sample/converter/type.d.ts

export interface TranslationPair {
  idx: number
  src: string
  tgt: string
  note?: string
  isSub?: boolean
}

export interface TranslationPairWithFile extends TranslationPair {
  file: string
}

export interface ShWvFileInfo {
  name: string
  start: number
  end: number
}

export interface ShWvMeta {
  bilingualPath: string
  files: ShWvFileInfo[]
  sourceLang: string
  targetLang: string
}

export interface ShWvBody {
  units: ShWvUnit[]
  terms: { src: string; tgt: string }[]
}

export interface ShWvUnit {
  idx: number
  src: string
  pre: string
  tgt: string
  note?: string
  isSub?: boolean
  ref: ShWvRef
  placeholders?: Record<number, string>
}

export interface ShWvRef {
  tms: ShWvRefTm[]
  tb: ShWvRefTb[]
  quoted: [number, number][]
  quoted100: number[]
}

export interface ShWvRefTm {
  idx: number
  src: string
  diff?: string
  tgt: string
  ratio: number
  freeze?: boolean
}

export interface ShWvRefTb {
  src: string
  tgts: string[]
  note?: string
}

export interface ShWvData {
  meta: ShWvMeta
  body: ShWvBody
}

// Manager用
export interface ExportPair {
  src: string
  tgt: string
}

export interface ChunkedJsonlItem {
  index: number
  src: string
  tgt: string
  history: ExportPair[]
}

export type ManagedDataType = 'UNITS' | 'TMS' | 'TBS' | 'JSONL' | 'JSONL_CHUNKED' | 'CSV' | 'SPLIT_BY_FILE' | 'SPLIT_BY_LENGTH'

export type DntFilterType = 'digit' | 'eng' | 'digit eng' | null

export interface ProcessorOptions {
  toFilterDuplicate?: boolean
  toFilterDnt?: DntFilterType
  toFilterLock?: boolean
}
