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
    provider?: 'fastapi' | 'ollama' | 'lmstudio' | 'honox-local' | 'honox-cloud'
    ollamaUrl?: string
    lmStudioUrl?: string
    honoxUrl?: string
    honoxCloudUrl?: string
    ollamaModel?: string
    lmStudioModel?: string
    honoxApiKey?: string
    honoxCloudApiKey?: string
}

export interface SubLlmProvider {
    greet(): Promise<GreetResponse>;
    getModels(): Promise<string[]>;
    initPrompt(params: InitPromptRequest): Promise<ResultResponse>;
    deleteCache(params: DeleteCacheRequest): Promise<ResultResponse>;
    checkSync(chunk: string): Promise<ResultResponse>;
    transSync(chunk: string): Promise<ResultResponse>;
    checkAsync(chunk: string): Promise<TaskResponse>;
    transAsync(chunk: string): Promise<TaskResponse>;
    checkUserSync(params: UserRequest): Promise<ResultResponse>;
    transUserSync(params: UserRequest): Promise<ResultResponse>;
    checkUserAsync(params: UserRequest): Promise<TaskResponse>;
    transUserAsync(params: UserRequest): Promise<TaskResponse>;
    getTaskResult(taskId: string): Promise<ResultResponse>;
    verifyConnection(): Promise<boolean>;
}
