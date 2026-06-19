// @ts-nocheck
import type { SheepShuttle } from '../../sheepShuttle.js'
import type { GreetResponse, ResultResponse, TaskResponse, InitPromptRequest, UserRequest, DeleteCacheRequest, ShuttleOptions, SubLlmProvider } from './types.js'

export class RequestLmStudio implements SubLlmProvider {
    private parent: SheepShuttle
    private LMSTUDIO_URL: string
    private MODEL: string
    public cacheName: string = ''

    private defaultCheckPrompt = "あなたは優秀な翻訳チェッカーです。渡された原文と訳文を比較し、誤訳や不自然な箇所があれば指摘してください。問題がなければ 空文字 または 'OK' を返してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"指摘内容\" }";
    private defaultTransPrompt = "あなたは優秀な翻訳家です。渡された原文を翻訳してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"翻訳文\" }";

    constructor(parent: SheepShuttle, options?: ShuttleOptions) {
        this.parent = parent
        this.updateOptions(options)
    }

    public updateOptions(options: Partial<ShuttleOptions> = {}) {
        this.LMSTUDIO_URL = (options.lmStudioUrl || 'http://127.0.0.1:1234').replace(/\/$/, '')
        this.MODEL = options.lmStudioModel || 'local-model'
    }

    public async greet(): Promise<GreetResponse> {
        try {
            const models = await this.getModels();
            return { status: 'success', model_info: `LM Studio Models: ${models.join(', ')}` }
        } catch (e: any) {
            return { status: 'error', error: e.message }
        }
    }

    public async getModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.LMSTUDIO_URL}/v1/models`)
            if (!response.ok) return []
            const data = await response.json()
            return data.data ? data.data.map((m: any) => m.id) : []
        } catch (e) {
            return []
        }
    }

    public async initPrompt(params: InitPromptRequest): Promise<ResultResponse> {
        return { status: 'success', result: 'lmstudio-dummy-cache' }
    }

    public async deleteCache(params: DeleteCacheRequest): Promise<ResultResponse> {
        return { status: 'success' }
    }

    private async processChunkLineByLine(chunkText: string, systemPrompt: string): Promise<string> {
        const lines = chunkText.split('\n').filter(line => line.trim().length > 0);
        let results = [];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i].trim().replace(/,$/, '');
            let chunkArray = [];
            try {
                chunkArray = JSON.parse(rawLine);
                if (!Array.isArray(chunkArray)) {
                    chunkArray = [chunkArray];
                }
            } catch (e) {
                console.error(`LM Studio chunk ${i} parse error:`, e);
                continue;
            }

            for (const data of chunkArray) {
                const userContent = `【原文】\n${data.src || ''}\n\n【訳文】\n${data.tgt || ''}`;
                try {
                    const response = await fetch(`${this.LMSTUDIO_URL}/v1/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: this.MODEL,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userContent }
                            ],
                            temperature: 0.7
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }

                    const responseData = await response.json();
                    let parsedResult = responseData.choices[0].message.content;
                    try {
                        const j = JSON.parse(parsedResult);
                        if (j.result !== undefined) {
                            parsedResult = j.result;
                        }
                    } catch (e) {}

                    results.push(JSON.stringify({ idx: data.idx, src: data.src, tgt: data.tgt, result: parsedResult }));
                } catch (e: any) {
                    console.error(`LM Studio error on idx ${data.idx}:`, e);
                    results.push(JSON.stringify({ idx: data.idx, error: e.message }));
                }
            }
        }
        return results.join('\n');
    }

    public async checkSync(chunk: string): Promise<ResultResponse> {
        const result = await this.processChunkLineByLine(chunk, this.defaultCheckPrompt);
        return { status: 'success', result };
    }

    public async transSync(chunk: string): Promise<ResultResponse> {
        const result = await this.processChunkLineByLine(chunk, this.defaultTransPrompt);
        return { status: 'success', result };
    }

    public async checkUserSync(params: UserRequest): Promise<ResultResponse> {
        const prompt = params.prompt || this.defaultCheckPrompt;
        const result = await this.processChunkLineByLine(params.chunk, prompt);
        return { status: 'success', result };
    }

    public async transUserSync(params: UserRequest): Promise<ResultResponse> {
        const prompt = params.prompt || this.defaultTransPrompt;
        const result = await this.processChunkLineByLine(params.chunk, prompt);
        return { status: 'success', result };
    }

    public async checkAsync(chunk: string): Promise<TaskResponse> {
        throw new Error('LM Studio provider does not support async task polling yet.');
    }

    public async transAsync(chunk: string): Promise<TaskResponse> {
        throw new Error('LM Studio provider does not support async task polling yet.');
    }

    public async checkUserAsync(params: UserRequest): Promise<TaskResponse> {
        throw new Error('LM Studio provider does not support async task polling yet.');
    }

    public async transUserAsync(params: UserRequest): Promise<TaskResponse> {
        throw new Error('LM Studio provider does not support async task polling yet.');
    }

    public async getTaskResult(taskId: string): Promise<ResultResponse> {
        throw new Error('LM Studio provider does not support async task polling yet.');
    }

    public async verifyConnection(): Promise<boolean> {
        const res = await this.greet();
        return res.status === 'success';
    }
}
