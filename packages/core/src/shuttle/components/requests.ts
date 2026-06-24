// @ts-nocheck
import type { SheepShuttle } from '../sheepShuttle.js'
import type { GreetResponse, ResultResponse, TaskResponse, InitPromptRequest, UserRequest, DeleteCacheRequest, ShuttleOptions, SubLlmProvider } from './subllm/types.js'

export * from './subllm/types.js'

export class ShuttleRequests implements SubLlmProvider {
    private parent: SheepShuttle
    private activeProvider: 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud' = 'fastapi'
    public cacheName: string = ''
    public cachedPromptText: string = ''
    private options: ShuttleOptions = {}

    constructor(parent: SheepShuttle, options?: ShuttleOptions) {
        this.parent = parent
        if (options) {
            this.options = { ...options }
            if (options.provider) {
                this.activeProvider = options.provider
            }
        }
    }

    public updateOptions(options: Partial<ShuttleOptions>) {
        this.options = { ...this.options, ...options }
        if (options.provider) {
            this.activeProvider = options.provider
        }
    }

    public setProvider(provider: 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud') {
        this.activeProvider = provider
    }

    public getProvider(): 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud' {
        return this.activeProvider
    }

    private getGatewayBaseUrl(): string {
        const target = (this.activeProvider === 'ollama' || this.activeProvider === 'lmstudio')
            ? 'honox-local'
            : this.activeProvider;

        if (target === 'fastapi') {
            let host: string
            let port: string | number | undefined

            if (this.options.isDev) {
                host = 'http://localhost'
                port = 8000
            } else {
                host = (this.options.baseUrl || 'http://localhost').replace(/\/$/, '')
                port = this.options.port
                if (port === undefined && !host.startsWith('https')) {
                    port = 8000
                }
            }
            return port ? `${host}:${port}` : host
        } else if (target === 'honox-local') {
            return (this.options.honoxUrl || 'http://localhost:8000').replace(/\/$/, '')
        } else if (target === 'honox-cloud') {
            return (this.options.honoxCloudUrl || '').replace(/\/$/, '')
        }
        return ''
    }

    private getGatewayHeaders(contentType: string = 'application/json'): Record<string, string> {
        const target = (this.activeProvider === 'ollama' || this.activeProvider === 'lmstudio')
            ? 'honox-local'
            : this.activeProvider;

        const headers: Record<string, string> = {}
        if (contentType) {
            headers['Content-Type'] = contentType
        }
        let apiKey = ''
        if (target === 'fastapi') {
            apiKey = this.options.apiKey || ''
        } else if (target === 'honox-local') {
            apiKey = this.options.honoxApiKey || ''
        } else if (target === 'honox-cloud') {
            apiKey = this.options.honoxCloudApiKey || ''
        }
        if (apiKey) {
            headers['X-API-KEY'] = apiKey
        }

        // Add routing headers for direct LLM integrations proxied by Hono server
        if (this.activeProvider === 'ollama') {
            headers['X-LLM-Provider'] = 'ollama'
            headers['X-LLM-Model'] = this.options.ollamaModel || ''
            headers['X-LLM-URL'] = this.options.ollamaUrl || 'http://localhost:11434'
        } else if (this.activeProvider === 'lmstudio') {
            headers['X-LLM-Provider'] = 'lmstudio'
            headers['X-LLM-Model'] = this.options.lmStudioModel || ''
            headers['X-LLM-URL'] = this.options.lmStudioUrl || 'http://127.0.0.1:1234'
        }

        return headers
    }

    public async greet(): Promise<GreetResponse> {
        if (this.activeProvider === 'honox-cloud') {
            return { status: 'error', error: 'UNDER_DEVELOPMENT' }
        }
        const url = `${this.getGatewayBaseUrl()}/gen/greet`
        const response = await fetch(url, {
            headers: this.getGatewayHeaders('')
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async getModels(): Promise<string[]> {
        const target = (this.activeProvider === 'ollama' || this.activeProvider === 'lmstudio')
            ? 'honox-local'
            : this.activeProvider;
        if (target !== 'honox-local' && target !== 'honox-cloud') {
            return []
        }
        try {
            const url = `${this.getGatewayBaseUrl()}/gen/models`
            const response = await fetch(url, {
                headers: this.getGatewayHeaders('')
            })
            if (!response.ok) return []
            const data = await response.json()
            return Array.isArray(data) ? data : []
        } catch (e) {
            return []
        }
    }

    public async getSettings(): Promise<{ provider: string, model: string, url: string }> {
        const url = `${this.getGatewayBaseUrl()}/gen/settings`
        const response = await fetch(url, {
            headers: this.getGatewayHeaders('')
        })
        if (!response.ok) {
            throw new Error(`Failed to fetch settings: ${response.status}`)
        }
        return await response.json()
    }

    public async initPrompt(params: InitPromptRequest): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/init_prompt`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
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
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/delete_cache`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkSync(chunk: string): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/check/default/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transSync(chunk: string): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/trans/default/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkUserSync(params: UserRequest): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/check/user/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transUserSync(params: UserRequest): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/trans/user/sync`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkAsync(chunk: string): Promise<TaskResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/check/default`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transAsync(chunk: string): Promise<TaskResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/trans/default`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify({ chunk })
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async checkUserAsync(params: UserRequest): Promise<TaskResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/check/user`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async transUserAsync(params: UserRequest): Promise<TaskResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/gen/trans/user`
        const response = await fetch(url, {
            method: 'POST',
            headers: this.getGatewayHeaders(),
            body: JSON.stringify(params)
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async getTaskResult(taskId: string): Promise<ResultResponse> {
        if (this.activeProvider === 'honox-cloud') {
            throw new Error('UNDER_DEVELOPMENT')
        }
        const url = `${this.getGatewayBaseUrl()}/tasks/${taskId}`
        const response = await fetch(url, {
            headers: this.getGatewayHeaders('')
        })
        if (!response.ok) {
            const body = await response.text()
            throw new Error(`HTTP error! status: ${response.status}, body: ${body}`)
        }
        return await response.json()
    }

    public async verifyConnection(): Promise<boolean> {
        if (this.activeProvider === 'honox-cloud') {
            return false
        }
        try {
            const response = await fetch(`${this.getGatewayBaseUrl()}/verify_connection`, {
                headers: this.getGatewayHeaders('')
            })
            return response.ok
        } catch (error) {
            return false
        }
    }
}
