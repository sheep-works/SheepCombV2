// @ts-nocheck
import type { SheepShuttle } from '../../sheepShuttle.js'
import type { GreetResponse, ResultResponse, TaskResponse, InitPromptRequest, UserRequest, DeleteCacheRequest, ShuttleOptions, SubLlmProvider } from './types.js'

export class RequestHonoxCloud implements SubLlmProvider {
    private parent: SheepShuttle
    private BASE_URL: string
    private API_KEY: string

    constructor(parent: SheepShuttle, options?: ShuttleOptions) {
        this.parent = parent
        this.updateOptions(options)
    }

    public updateOptions(options: Partial<ShuttleOptions> = {}) {
        this.BASE_URL = options.honoxCloudUrl || ''
        this.API_KEY = options.honoxCloudApiKey || ''
    }

    public async greet(): Promise<GreetResponse> {
        return { status: 'error', error: 'UNDER_DEVELOPMENT' }
    }

    public async getModels(): Promise<string[]> {
        return []
    }

    public async initPrompt(params: InitPromptRequest): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async deleteCache(params: DeleteCacheRequest): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async checkSync(chunk: string): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async transSync(chunk: string): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async checkAsync(chunk: string): Promise<TaskResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async transAsync(chunk: string): Promise<TaskResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async checkUserSync(params: UserRequest): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async transUserSync(params: UserRequest): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async checkUserAsync(params: UserRequest): Promise<TaskResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async transUserAsync(params: UserRequest): Promise<TaskResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async getTaskResult(taskId: string): Promise<ResultResponse> {
        throw new Error('UNDER_DEVELOPMENT')
    }

    public async verifyConnection(): Promise<boolean> {
        return false
    }
}
