import type { ShWvData, TranslationPair, TranslationPairWithFile, ShWvFileInfo } from '../types/shwv.js'

import { ShuttleParser } from './components/parser.js'
import { ShuttleProcessor } from './components/processor.js'
import { ShuttleConverter } from './components/converter.js'
import { ShuttleAnalyzer } from './components/analyzer.js'
import { ShuttleManager } from './components/manager.js'
import { ShuttleBuilder } from './components/builder.js'
import type { ManagedDataType } from './components/manager.js'

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

  // Sub-components
  public parser: ShuttleParser
  public processor: ShuttleProcessor
  public converter: ShuttleConverter
  public analyzer: ShuttleAnalyzer
  public manager: ShuttleManager
  public builder: ShuttleBuilder

  constructor() {
    this.parser = new ShuttleParser(this)
    this.processor = new ShuttleProcessor(this)
    this.converter = new ShuttleConverter(this)
    this.analyzer = new ShuttleAnalyzer(this)
    this.manager = new ShuttleManager(this)
    this.builder = new ShuttleBuilder(this)
  }

  /**
   * Add a translation memory to the shuttle.
   */
  public async addTms(files: { name: string, content: string | ArrayBuffer | Buffer }[]): Promise<void> {
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
  public async addTbs(files: { name: string, content: string | ArrayBuffer | Buffer }[]): Promise<void> {
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
  public async parse(files: { name: string, content: string | ArrayBuffer | Buffer }[]): Promise<void> {
    const result = await this.parser.parse(files)
    this.units = result.units
    this.files = result.files
  }

  /**
   * Process (filter) the current units.
   */
  public process(): void {
    this.units = this.processor.filter(this.units)
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
   * Helper to reset state if needed.
   */
  public reset(): void {
    this.units = []
    this.files = []
    this.data = null
    this.tms = []
    this.tbs = []
  }
}
