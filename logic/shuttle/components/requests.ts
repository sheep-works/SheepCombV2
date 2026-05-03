import type { SheepShuttle } from '../sheepShuttle.js'

export interface GreetResponse {
    status: string
    model_info?: string | null
    error?: string | null
}

export interface ResultResponse {
    status: string
    result?: string | null
    error?: string | null
}

export interface TaskResponse {
    task_id: string
    status: string
}

export interface InitPromptRequest {
    system_instruction: string
    display_name: string
}

export interface UserRequest {
    chunk: string
    prompt?: string | null
    cache_id?: string | null
}

export interface DeleteCacheRequest {
    cache_name?: string | null
}

export interface ShuttleOptions {
    baseUrl?: string
    port?: number | string
    apiKey?: string
    isDev?: boolean
}

export class ShuttleRequests {
    private parent: SheepShuttle
    private BASE_URL: string
    private API_KEY: string
    public cacheName: string = ''

    constructor(parent: SheepShuttle, options?: ShuttleOptions) {
        this.parent = parent
        this.API_KEY = options?.apiKey || ''
        this.BASE_URL = '' // 初期化
        this.updateBaseUrl(options)
    }

    /**
     * 接続オプションを更新し、BASE_URL を再計算する
     */
    public updateOptions(options: Partial<ShuttleOptions>) {
        if (options.apiKey !== undefined) this.API_KEY = options.apiKey
        this.updateBaseUrl(options)
    }

    private updateBaseUrl(options?: Partial<ShuttleOptions>) {
        let host: string
        let port: string | number | undefined

        if (options?.isDev) {
            host = 'http://localhost'
            port = 8000 // ローカル FastAPI のデフォルト
        } else {
            host = (options?.baseUrl || 'http://localhost').replace(/\/$/, '')
            port = options?.port
            if (port === undefined && !host.startsWith('https')) {
                port = 8000
            }
        }
        this.BASE_URL = port ? `${host}:${port}` : host
    }

    private getHeaders(contentType: string = 'application/json'): Record<string, string> {
        const headers: Record<string, string> = {}
        if (contentType) {
            headers['Content-Type'] = contentType
        }
        if (this.API_KEY) {
            headers['X-API-KEY'] = this.API_KEY
        }
        return headers
    }

    public async greet(): Promise<GreetResponse> {
        const url = `${this.BASE_URL}/gen/greet`
        const response = await fetch(url, {
            headers: this.getHeaders('') // GET なので Content-Type は不要
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async initPrompt(params: InitPromptRequest): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/init_prompt`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        const json = await response.json()
        if (json.status === 'success' && json.result) {
            this.cacheName = json.result
        }
        return json
    }

    public async deleteCache(params: DeleteCacheRequest): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/delete_cache`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkSync(chunk: string): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/check/default/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transSync(chunk: string): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/trans/default/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkAsync(chunk: string): Promise<TaskResponse> {
        const url = `${this.BASE_URL}/gen/check/default`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transAsync(chunk: string): Promise<TaskResponse> {
        const url = `${this.BASE_URL}/gen/trans/default`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkUserSync(params: UserRequest): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/check/user/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transUserSync(params: UserRequest): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/gen/trans/user/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkUserAsync(params: UserRequest): Promise<TaskResponse> {
        const url = `${this.BASE_URL}/gen/check/user`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transUserAsync(params: UserRequest): Promise<TaskResponse> {
        const url = `${this.BASE_URL}/gen/trans/user`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async getTaskResult(taskId: string): Promise<ResultResponse> {
        const url = `${this.BASE_URL}/tasks/${taskId}`
        const response = await fetch(url, {
            headers: this.getHeaders('')
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }
    /**
     * API サーバーの接続確認
     */
    public async verifyConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.BASE_URL}/verify_connection`, {
                headers: this.getHeaders('')
            })
            return response.ok
        } catch (error) {
            return false
        }
    }
}
