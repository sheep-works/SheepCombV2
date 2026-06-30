import type { ShWvData, TranslationPair, TranslationPairWithFile, ShWvFileInfo, ManagedDataType, ProcessorOptions, ProjectInfo, ChunkOptions } from '@sheep-family/types'

import { ShuttleParser } from './components/parser.js'
import { ShuttleProcessor } from './components/processor.js'
import { ShuttleConverter } from './components/converter.js'
import { ShuttleAnalyzer } from './components/analyzer.js'
import { ShuttleManager } from './components/manager.js'
import { ShuttleBuilder } from './components/builder.js'
import { ShuttleSearch } from './components/search.js'
import { ShuttleRequests, type ShuttleOptions, type TaskResponse, type UserRequest, type ResultResponse } from './components/requests.js'

export interface ChunkInfo {
  chunkId: number
  data: string
  status: 'pending' | 'success' | 'error'
  response: string
}

/**
 * Orchestrator class for SheepShuttle data transformations and conversions.
 */
export class SheepShuttle<T extends TranslationPair = TranslationPair> {
  // State properties
  public units: T[] = []
  public files: ShWvFileInfo[] = []
  public data: ShWvData | null = null
  public tms: TranslationPairWithFile[] = []
  public tbs: TranslationPairWithFile[] = []
  public tmFiles: string[] = []
  public tbFiles: string[] = []
  public chunks: ChunkInfo[] = []

  // Sub-components
  public parser: ShuttleParser
  public processor: ShuttleProcessor
  public converter: ShuttleConverter
  public analyzer: ShuttleAnalyzer
  public manager: ShuttleManager
  public builder: ShuttleBuilder
  public searcher: ShuttleSearch
  public requests: ShuttleRequests

  constructor(options?: ShuttleOptions) {
    this.parser = new ShuttleParser(this)
    this.processor = new ShuttleProcessor(this)
    this.converter = new ShuttleConverter(this)
    this.analyzer = new ShuttleAnalyzer(this)
    this.manager = new ShuttleManager(this)
    this.builder = new ShuttleBuilder(this)
    this.searcher = new ShuttleSearch()
    this.requests = new ShuttleRequests(this, options)
  }

  public setNewData(data: ShWvData): void {
    this.data = structuredClone(data)
    if (this.data.meta.tmFiles) {
      this.tmFiles = [...this.data.meta.tmFiles]
    }
    if (this.data.meta.tbFiles) {
      this.tbFiles = [...this.data.meta.tbFiles]
    }
  }

  /**
   * Add a translation memory to the shuttle.
   */
  public async addTms(files: { name: string, content: string | ArrayBuffer | Uint8Array }[]): Promise<void> {
    const result = await this.parser.parse(files)
    const unitsWithFile = result.units.map(u => {
      const file = result.files.find(f => u.idx >= f.start && u.idx < f.end)
      return { ...u, file: file ? file.name : 'Unknown' } as TranslationPairWithFile
    })
    this.tms.push(...unitsWithFile)
    
    // Update file name list
    for (const f of files) {
      if (!this.tmFiles.includes(f.name)) {
        this.tmFiles.push(f.name)
      }
    }

    // Sync with data.meta if exists
    if (this.data) {
      if (!this.data.meta.tmFiles) this.data.meta.tmFiles = []
      for (const name of this.tmFiles) {
        if (!this.data.meta.tmFiles.includes(name)) {
          this.data.meta.tmFiles.push(name)
        }
      }
    }
  }

  /**
   * Add termbase files to the shuttle.
   */
  public async addTbs(files: { name: string, content: string | ArrayBuffer | Uint8Array }[]): Promise<void> {
    const result = await this.parser.parse(files)
    const unitsWithFile = result.units.map(u => {
      const file = result.files.find(f => u.idx >= f.start && u.idx < f.end)
      return { ...u, file: file ? file.name : 'Unknown' } as TranslationPairWithFile
    })
    this.tbs.push(...unitsWithFile)

    // Update file name list
    for (const f of files) {
      if (!this.tbFiles.includes(f.name)) {
        this.tbFiles.push(f.name)
      }
    }

    // Sync with data.meta if exists
    if (this.data) {
      if (!this.data.meta.tbFiles) this.data.meta.tbFiles = []
      for (const name of this.tbFiles) {
        if (!this.data.meta.tbFiles.includes(name)) {
          this.data.meta.tbFiles.push(name)
        }
      }
    }
  }

  /**
   * Parse main source files and store result in units/files.
   */
  public async parse(files: { name: string, content: string | ArrayBuffer | Uint8Array }[], onProgress?: (msg: string) => void, splitByNewline: boolean = true) {
    const result = await this.parser.parse(files, onProgress, splitByNewline);
    this.units = result.units as T[]
    this.files = result.files
  }

  /**
   * Process (filter) the current units.
   */
  public process(options?: ProcessorOptions): void {
    this.units = this.processor.filter(this.units, options) as T[]
  }

  /**
   * Sample translation pairs for evaluation.
   */
  public sampling(sampledTotal: number, seed?: number): T[] {
    return this.processor.sampling(sampledTotal, seed) as T[]
  }

  /**
   * Convert the current units/files into ShWvData.
   */
  public convert(projectInfo?: ProjectInfo): void {
    this.data = this.converter.fromUnits(this.units, this.files, projectInfo)
  }

  /**
   * Analyze the current data using TM/TB and WASM.
   */
  public async analyze(analyzeAll?: any): Promise<void> {
    if (!this.data) return
    await this.analyzer.analyze(this.data, this.tms, this.tbs, analyzeAll)
  }

  /**
   * Build an output file from original content and current data.
   */
  public async build(originalContent: string): Promise<string> {
    if (!this.data) return ''
    return await this.builder.build(originalContent, this.data)
  }

  /**
   * Get the current ShWvData as a JSON string.
   */
  public getShwvJson(): string {
    return JSON.stringify(this.data, null, 2)
  }

  /**
   * Get the current units as a CSV/TSV string.
   */
  public getCsv(delimiter: string = ','): string {
    const hasFile = this.units.some(u => 'file' in u && (u as any).file)
    const headers = ['idx', 'src', 'tgt', 'note']
    if (hasFile) {
      headers.push('file')
    }
    const header = headers.join(delimiter)

    const rows = this.units.map(u => {
      const row = [
        u.idx,
        u.src || '',
        u.tgt || '',
        u.note || ''
      ]
      if (hasFile) {
        row.push((u as any).file || '')
      }
      return row.map(val => {
        const str = String(val).replace(/"/g, '""').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
        return `"${str}"`
      }).join(delimiter)
    })
    return [header, ...rows].join('\n')
  }

  public getManagedData(type: ManagedDataType, maxCharsPerChunk: number = 4000): string {
    if (!this.data) {
      throw new Error('No data available')
    }
    return this.manager.getManagedData(type, this.data, maxCharsPerChunk)
  }

  /**
   * Create chunks for API processing and store them in this.chunks.
   */
  public createChunks(type: 'units' | 'data' | 'similarity', maxCharsPerChunk: number = 4000, requestTarget: 'CHECK' | 'TRANSLATE' | 'PROOF' = 'CHECK', options?: ChunkOptions): void {
    this.chunks = []

    if (type === 'units') {
      const chunkStrings = this.processor.chunkUnits(this.units, maxCharsPerChunk, requestTarget, options)
      this.chunks = chunkStrings.map((s, i) => ({
        chunkId: i,
        data: s,
        status: 'pending',
        response: ''
      }))
    } else if (type === 'data') {
      if (!this.data) {
        throw new Error('No data available')
      }
      // manager.getManagedData('JSONL_CHUNKED', ...) returns newline-separated chunk strings
      const rawData = this.manager.getManagedData('JSONL_CHUNKED', this.data, maxCharsPerChunk, false, options)
      const chunkStrings = rawData.split('\n').filter(s => s.trim().length > 0)
      this.chunks = chunkStrings.map((s, i) => ({
        chunkId: i,
        data: s,
        status: 'pending',
        response: ''
      }))
    } else if (type === 'similarity') {
      if (!this.data) {
        throw new Error('No data available')
      }
      const rawData = this.manager.chunkJsonlBySimilarity(this.data, maxCharsPerChunk, options)
      const chunkStrings = rawData.split('\n').filter(s => s.trim().length > 0)
      this.chunks = chunkStrings.map((s, i) => ({
        chunkId: i,
        data: s,
        status: 'pending',
        response: ''
      }))
    }
  }

  public async processRequests(
    chunkIndex: number = -1,
    requestTarget: 'CHECK' | 'TRANSLATE' | 'PROOF' = 'CHECK',
    prompt?: string): Promise<void> {

    // 1. Target chunk selection
    // chunkIndex が -1 (デフォルト) なら、'success' でない最初のチャンクを探す
    let targetIdx = chunkIndex;
    if (targetIdx < 0 || targetIdx >= this.chunks.length) {
      targetIdx = this.chunks.findIndex(c => c.status !== 'success');
    }

    if (targetIdx === -1 || targetIdx >= this.chunks.length) {
      console.warn('No chunk available for processing.');
      return;
    }

    const chunk = this.chunks[targetIdx]!;

    // Auto-caching logic for long prompts (> 3000 chars)
    if (prompt && prompt.length > 3000) {
      if (!this.requests.cacheName || this.requests.cachedPromptText !== prompt) {
        if (this.requests.cacheName) {
          try {
            await this.requests.deleteCache({ cache_name: this.requests.cacheName });
          } catch (e) {
            console.warn('Failed to delete old prompt cache:', e);
          }
        }
        const displayName = `auto-prompt-${Date.now()}`;
        try {
          const res = await this.requests.initPrompt({
            system_instruction: prompt,
            display_name: displayName
          });
          if (res.status === 'success' && res.result) {
            this.requests.cacheName = res.result;
            this.requests.cachedPromptText = prompt;
          }
        } catch (e) {
          console.error('Failed to initialize prompt cache:', e);
        }
      }
    }

    try {
      const isSyncProvider = this.requests.getProvider() !== 'fastapi';
      
      let finalPrompt = prompt && prompt.trim() !== '' ? prompt : undefined;
      let finalCacheId = (!prompt || prompt.trim() === '') ? this.requests.cacheName : undefined;

      if (prompt && prompt.length > 3000 && this.requests.cacheName) {
        finalPrompt = undefined;
        finalCacheId = this.requests.cacheName;
      }

      if (isSyncProvider) {
        // 同期プロバイダー (Ollama, LM Studio) の場合、そのまま結果を待つ
        chunk.status = 'pending';
        let resultResponse: ResultResponse;

        if (finalPrompt || finalCacheId) {
          const params: UserRequest = {
            chunk: chunk.data,
            prompt: finalPrompt,
            cache_id: finalCacheId
          };
          if (requestTarget === 'CHECK') {
            resultResponse = await this.requests.checkUserSync(params);
          } else {
            resultResponse = await this.requests.transUserSync(params);
          }
        } else {
          if (requestTarget === 'CHECK') {
            resultResponse = await this.requests.checkSync(chunk.data);
          } else {
            resultResponse = await this.requests.transSync(chunk.data);
          }
        }

        if (resultResponse.status === 'success') {
          chunk.status = 'success';
          chunk.response = resultResponse.result || '';
        } else {
          chunk.status = 'error';
          chunk.response = resultResponse.error || 'Unknown error';
        }
        
      } else {
        // 非同期プロバイダー (FastAPI) の場合
        let taskResponse: TaskResponse;

        if (finalPrompt || finalCacheId) {
          const params: UserRequest = {
            chunk: chunk.data,
            prompt: finalPrompt,
            cache_id: finalCacheId
          };

          if (requestTarget === 'CHECK') {
            taskResponse = await this.requests.checkUserAsync(params);
          } else {
            taskResponse = await this.requests.transUserAsync(params);
          }
        } else {
          // デフォルトのプロンプトを使用
          if (requestTarget === 'CHECK') {
            taskResponse = await this.requests.checkAsync(chunk.data);
          } else {
            taskResponse = await this.requests.transAsync(chunk.data);
          }
        }

        const taskId = taskResponse.task_id;
        chunk.status = 'pending';

        // 3. Polling
        while (true) {
          // 5秒待機
          await new Promise(resolve => setTimeout(resolve, 5000));

          const result = await this.requests.getTaskResult(taskId);
          if (result.status === 'success') {
            chunk.status = 'success';
            chunk.response = result.result || '';
            break;
          } else if (result.status === 'error') {
            chunk.status = 'error';
            chunk.response = result.error || 'Unknown error';
            break;
          }
          // 成功・エラー以外（pending等）の場合はループ継続
        }
      }

    } catch (error) {
      chunk.status = 'error';
      chunk.response = (error as Error).message;
      throw error;
    }
  }

  /**
   * Helper to reset state if needed.
   */
  public reset(): void {
    this.units = []
    this.files = []
    this.data = null
    this.tms = []
    this.tbs = []
    this.tmFiles = []
    this.tbFiles = []
    this.chunks = []
  }
}
