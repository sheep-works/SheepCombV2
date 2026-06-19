// @ts-nocheck
import type { SheepShuttle } from '../sheepShuttle.js'
import type { GreetResponse, ResultResponse, TaskResponse, InitPromptRequest, UserRequest, DeleteCacheRequest, ShuttleOptions, SubLlmProvider } from './subllm/types.js'

export * from './subllm/types.js'

import { RequestFastApi } from './subllm/requestFastApi.js'
import { RequestOllama } from './subllm/requestOllama.js'
import { RequestLmStudio } from './subllm/requestLmStudio.js'
import { RequestHonoxLocal } from './subllm/requestHonoxLocal.js'
import { RequestHonoxCloud } from './subllm/requestHonoxCloud.js'

export class ShuttleRequests implements SubLlmProvider {
    private parent: SheepShuttle
    private activeProvider: 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud' = 'fastapi'
    public cacheName: string = ''

    private fastapi: RequestFastApi
    private ollama: RequestOllama
    private lmstudio: RequestLmStudio
    private honoxLocal: RequestHonoxLocal
    private honoxCloud: RequestHonoxCloud

    constructor(parent: SheepShuttle, options?: ShuttleOptions) {
        this.parent = parent
        this.fastapi = new RequestFastApi(parent, options)
        this.ollama = new RequestOllama(parent, options)
        this.lmstudio = new RequestLmStudio(parent, options)
        this.honoxLocal = new RequestHonoxLocal(parent, options)
        this.honoxCloud = new RequestHonoxCloud(parent, options)
        
        if (options?.provider) {
            this.activeProvider = options.provider
        }
    }

    public updateOptions(options: Partial<ShuttleOptions>) {
        if (options.provider) {
            this.activeProvider = options.provider
        }
        this.fastapi.updateOptions(options)
        this.ollama.updateOptions(options)
        this.lmstudio.updateOptions(options)
        this.honoxLocal.updateOptions(options)
        this.honoxCloud.updateOptions(options)
    }

    private get currentProvider(): SubLlmProvider {
        switch (this.activeProvider) {
            case 'ollama': return this.ollama;
            case 'lmstudio': return this.lmstudio;
            case 'honox-local': return this.honoxLocal;
            case 'honox-cloud': return this.honoxCloud;
            case 'fastapi':
            default:
                return this.fastapi;
        }
    }

    public setProvider(provider: 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud') {
        this.activeProvider = provider
    }

    public getProvider(): 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud' {
        return this.activeProvider
    }

    // Proxy methods to current provider
    public async greet(): Promise<GreetResponse> {
        return this.currentProvider.greet()
    }

    public async getModels(): Promise<string[]> {
        return this.currentProvider.getModels()
    }

    public async initPrompt(params: InitPromptRequest): Promise<ResultResponse> {
        const res = await this.currentProvider.initPrompt(params)
        if (res.status === 'success' && res.result) {
            this.cacheName = res.result
        }
        return res
    }

    public async deleteCache(params: DeleteCacheRequest): Promise<ResultResponse> {
        return this.currentProvider.deleteCache(params)
    }

    public async checkSync(chunk: string): Promise<ResultResponse> {
        return this.currentProvider.checkSync(chunk)
    }

    public async transSync(chunk: string): Promise<ResultResponse> {
        return this.currentProvider.transSync(chunk)
    }

    public async checkAsync(chunk: string): Promise<TaskResponse> {
        return this.currentProvider.checkAsync(chunk)
    }

    public async transAsync(chunk: string): Promise<TaskResponse> {
        return this.currentProvider.transAsync(chunk)
    }

    public async checkUserSync(params: UserRequest): Promise<ResultResponse> {
        return this.currentProvider.checkUserSync(params)
    }

    public async transUserSync(params: UserRequest): Promise<ResultResponse> {
        return this.currentProvider.transUserSync(params)
    }

    public async checkUserAsync(params: UserRequest): Promise<TaskResponse> {
        return this.currentProvider.checkUserAsync(params)
    }

    public async transUserAsync(params: UserRequest): Promise<TaskResponse> {
        return this.currentProvider.transUserAsync(params)
    }

    public async getTaskResult(taskId: string): Promise<ResultResponse> {
        return this.currentProvider.getTaskResult(taskId)
    }

    public async verifyConnection(): Promise<boolean> {
        return this.currentProvider.verifyConnection()
    }
}
