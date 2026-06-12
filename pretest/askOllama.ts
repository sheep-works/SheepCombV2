// pretest/askOllama.ts
// Ollamaにプロンプトとテキストを投げて応答をテストするスクリプト

import fs from 'fs';
import path from 'path';

export interface LlmRequestPayload {
    systemPrompt: string;
    sourceText: string;
    targetText: string;
}

async function testOllama() {
    // ユーザーが作成した sample.jsonl を読み込む
    const chunkPath = path.resolve('./pretest/sample.jsonl');
    const chunkText = fs.readFileSync(chunkPath, 'utf8').trim();
    const lines = chunkText.split('\n').filter(line => line.trim().length > 0);

    const systemPrompt = "あなたは優秀な翻訳チェッカーです。渡された原文と訳文を比較し、誤訳や不自然な箇所があれば指摘してください。問題がなければ 空文字 または 'OK' を返してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"指摘内容\" }";

    console.log(`=== Found ${lines.length} chunks. Processing... ===\n`);

    for (let i = 0; i < lines.length; i++) {
        // 余分なカンマと改行文字がある場合は除去してパース
        const rawLine = lines[i].trim().replace(/,$/, '');
        let chunkArray = [];
        try {
            chunkArray = JSON.parse(rawLine);
        } catch (e) {
            console.error(`Chunk ${i + 1} parse error:`, e);
            continue;
        }

        console.log(`\n[Chunk ${i + 1}] Processing ${chunkArray.length} items...`);

        for (const data of chunkArray) {
            const prompt = `
${systemPrompt}

【原文】
${data.src}

【訳文】
${data.tgt}
`;

            console.log(`--- [idx: ${data.idx}] Request ---`);
            console.log(`src: ${data.src}`);
            console.log(`tgt: ${data.tgt}`);

            try {
                const modelName = "gemma4:e2b"; 

                const startTime = performance.now();
                const response = await fetch('http://127.0.0.1:11434/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: modelName,
                        prompt: prompt,
                        stream: false,
                        format: 'json'
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }

                const responseData = await response.json();
                const endTime = performance.now();
                const duration = ((endTime - startTime) / 1000).toFixed(2);

                console.log(`--> Response (${duration}s):`);
                console.log(responseData.response);
                console.log("------------------------\n");
                
            } catch (e) {
                console.error(`Error on idx ${data.idx}:`, e);
            }
        }
    }
}

testOllama();
