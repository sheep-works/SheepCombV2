/**
 * SheepHub API Client
 * Based on sample/openapi.json specification
 */

export interface RequestBody {
  jsonl: string
}

export interface TaskResponse {
  task_id: string
  status: string
}

export interface ResultResponse {
  status: string
  result?: string | null
  error?: string | null
}

export class SheepHubApi {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_BASE_URL || '/api'
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    }
    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error ${response.status}: ${errorText}`)
    }

    return response.json() as Promise<T>
  }

  // --- Check endpoints ---

  /** POST /gen/check/default (async) */
  async checkDefault(jsonl: string): Promise<TaskResponse> {
    return this.request<TaskResponse>('POST', '/gen/check/default', { jsonl })
  }

  /** POST /gen/check/default/sync */
  async checkDefaultSync(jsonl: string): Promise<ResultResponse> {
    return this.request<ResultResponse>('POST', '/gen/check/default/sync', { jsonl })
  }

  // --- Trans endpoints ---

  /** POST /gen/trans/default (async) */
  async transDefault(jsonl: string): Promise<TaskResponse> {
    return this.request<TaskResponse>('POST', '/gen/trans/default', { jsonl })
  }

  /** POST /gen/trans/default/sync */
  async transDefaultSync(jsonl: string): Promise<ResultResponse> {
    return this.request<ResultResponse>('POST', '/gen/trans/default/sync', { jsonl })
  }

  // --- Task status ---

  /** GET /tasks/{task_id} */
  async getTaskResult(taskId: string): Promise<ResultResponse> {
    return this.request<ResultResponse>('GET', `/tasks/${taskId}`)
  }

  // --- Polling helper ---

  /**
   * Poll a task until completion or timeout
   */
  async pollTask(
    taskId: string,
    intervalMs = 2000,
    maxAttempts = 60,
    onProgress?: (response: ResultResponse) => void
  ): Promise<ResultResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.getTaskResult(taskId)
      onProgress?.(result)

      if (result.status === 'completed' || result.status === 'failed') {
        return result
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`)
  }
}

/** Singleton API instance */
let _api: SheepHubApi | null = null

export function getApi(): SheepHubApi {
  if (!_api) {
    _api = new SheepHubApi()
  }
  return _api
}
