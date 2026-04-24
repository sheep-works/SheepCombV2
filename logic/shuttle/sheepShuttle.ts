import type { ShWvData, TranslationPair, TranslationPairWithFile, ShWvFileInfo, ManagedDataType, ProcessorOptions } from '../types/shwv.js'

import { ShuttleParser } from './components/parser.js'
import { ShuttleProcessor } from './components/processor.js'
import { ShuttleConverter } from './components/converter.js'
import { ShuttleAnalyzer } from './components/analyzer.js'
import { ShuttleManager } from './components/manager.js'
import { ShuttleBuilder } from './components/builder.js'
import { ShuttleRequests, type ShuttleOptions, type TaskResponse, type UserRequest } from './components/requests.js'

export interface ChunkInfo {
  chunkId: number
  data: string
  status: 'pending' | 'success' | 'error'
  response: string
}

/**
 * Orchestrator class for SheepShuttle data transformations and conversions.
 */
export class SheepShuttle {
  // State properties
  public units: TranslationPair[] = []
  public files: ShWvFileInfo[] = []
  public data: ShWvData | null = null
  public tms: TranslationPairWithFile[] = []
  public tbs: TranslationPairWithFile[] = []
  public chunks: ChunkInfo[] = []

  // Sub-components
  public parser: ShuttleParser
  public processor: ShuttleProcessor
  public converter: ShuttleConverter
  public analyzer: ShuttleAnalyzer
  public manager: ShuttleManager
  public builder: ShuttleBuilder
  public requests: ShuttleRequests

  constructor(options?: ShuttleOptions) {
    this.parser = new ShuttleParser(this)
    this.processor = new ShuttleProcessor(this)
    this.converter = new ShuttleConverter(this)
    this.analyzer = new ShuttleAnalyzer(this)
    this.manager = new ShuttleManager(this)
    this.builder = new ShuttleBuilder(this)
    this.requests = new ShuttleRequests(this, options)
  }

  public setNewData(data: ShWvData): void {
    this.data = structuredClone(data)
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
  }

  /**
   * Parse main source files and store result in units/files.
   */
  public async parse(files: { name: string, content: string | ArrayBuffer | Uint8Array }[]): Promise<void> {
    const result = await this.parser.parse(files)
    this.units = result.units
    this.files = result.files
  }

  /**
   * Process (filter) the current units.
   */
  public process(options?: ProcessorOptions): void {
    this.units = this.processor.filter(this.units, options)
  }

  /**
   * Convert the current units/files into ShWvData.
   */
  public convert(): void {
    this.data = this.converter.fromUnits(this.units, this.files)
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
    const header = ['idx', 'src', 'tgt', 'note'].join(delimiter)
    const rows = this.units.map(u => {
      const row = [
        u.idx,
        u.src || '',
        u.tgt || '',
        u.note || ''
      ]
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
  public createChunks(type: 'units' | 'data', maxCharsPerChunk: number = 4000): void {
    this.chunks = []

    if (type === 'units') {
      const chunkStrings = this.processor.chunkUnits(this.units, maxCharsPerChunk)
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
      const rawData = this.manager.getManagedData('JSONL_CHUNKED', this.data, maxCharsPerChunk)
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
    requestTarget: 'CHECK' | 'TRANSLATE' = 'CHECK',
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

    try {
      let taskResponse: TaskResponse;

      // 2. Execute Request
      // prompt がある、もしくは requests.cacheName が存在する場合は UserRequest を使用
      if ((prompt && prompt.trim() !== '') || this.requests.cacheName) {
        const params: UserRequest = {
          chunk: chunk.data,
          prompt: prompt && prompt.trim() !== '' ? prompt : undefined,
          cache_id: (!prompt || prompt.trim() === '') ? this.requests.cacheName : undefined
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
    this.chunks = []
  }
}
