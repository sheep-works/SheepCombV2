/**
 * FileIO utility class
 * Provides a unified interface for file operations that works both in
 * browser (File/Blob) and could be extended for CLI (Node.js streams).
 */
export class FileIO {
  /**
   * Read a File/Blob as text string
   */
  static async readAsText(source: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(source)
    })
  }

  /**
   * Read a File/Blob as ArrayBuffer
   */
  static async readAsArrayBuffer(source: File | Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(source)
    })
  }

  /**
   * Download content as a file in the browser
   */
  static download(content: string | Blob, fileName: string, mimeType = 'application/octet-stream'): void {
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: mimeType })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Download JSON data as a .json file
   */
  static downloadJson(data: unknown, fileName: string): void {
    const content = JSON.stringify(data, null, 2)
    FileIO.download(content, fileName, 'application/json')
  }

  /**
   * Download CSV content as a .csv file
   */
  static downloadCsv(content: string, fileName: string): void {
    // Add BOM for Excel compatibility
    const bom = '\uFEFF'
    FileIO.download(bom + content, fileName, 'text/csv;charset=utf-8')
  }
 
  /**
   * Convert Segment array to CSV string
   */
  static toCsv(segments: any[]): string {
    const header = 'Source,Target,Note'
    const rows = segments.map(s => {
      // Escape double quotes by doubling them
      const src = (s.src || '').toString().replace(/"/g, '""')
      const tgt = (s.tgt || '').toString().replace(/"/g, '""')
      const note = (s.note || '').toString().replace(/"/g, '""')
      return `"${src}","${tgt}","${note}"`
    })
    return [header, ...rows].join('\r\n')
  }
}
