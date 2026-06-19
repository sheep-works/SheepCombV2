import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const devEnvPath = path.resolve(__dirname, '../../../.env');
  if (fs.existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
    return;
  }
  const exeDir = path.dirname(process.execPath);
  const prodEnvPath1 = path.join(exeDir, '.env');
  if (fs.existsSync(prodEnvPath1)) {
    dotenv.config({ path: prodEnvPath1 });
    return;
  }
  if ((process as any).resourcesPath) {
    const prodEnvPath2 = path.join((process as any).resourcesPath, '.env');
    if (fs.existsSync(prodEnvPath2)) {
      dotenv.config({ path: prodEnvPath2 });
      return;
    }
  }
  dotenv.config();
}
loadEnv();

export class VertexClient {
  private ai: GoogleGenAI;
  private modelName = 'gemini-3.1-flash-lite-preview';
  public cachedContentName: string | null = null;

  constructor() {
    this.ai = new GoogleGenAI({
      enterprise: true,
      project: process.env.PROJECT_ID,
      location: 'global' // Global Vertex AI location
    });
  }

  async greet(): Promise<string> {
    console.log(`--- Vertex AI Connection Check ---`);
    console.log(`Project ID : ${process.env.PROJECT_ID}`);
    console.log(`Location   : global`);
    console.log(`Model Name : ${this.modelName}`);
    console.log(`-----------------------------`);

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: 'Tell me your model name',
      });
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI Connection Error: ${e.message}`);
    }
  }

  async setupCache(systemInstruction: string, displayName: string): Promise<string> {
    try {
      const cache = await this.ai.caches.create({
        model: this.modelName,
        config: {
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          displayName: displayName,
          ttl: '10800s' // 3 hours
        }
      });
      this.cachedContentName = cache.name || null;
      if (!cache.name) {
        throw new Error('Cache name is undefined');
      }
      return cache.name;
    } catch (e: any) {
      this.cachedContentName = null;
      throw new Error(`Cache Creation Error: ${e.message}`);
    }
  }

  async deleteCache(cacheName?: string | null): Promise<void> {
    const targetName = cacheName || this.cachedContentName;
    if (!targetName) {
      throw new Error('No cache name provided and no stored cache name found.');
    }

    try {
      await this.ai.caches.delete({ name: targetName });
      if (targetName === this.cachedContentName) {
        this.cachedContentName = null;
      }
    } catch (e: any) {
      throw new Error(`Error deleting cache: ${e.message}`);
    }
  }

  async processChunk(prompt: string, chunk: string): Promise<string> {
    const fullPrompt = `${prompt}\n\n\`\`\`jsonl\n${chunk}\n\`\`\``;
    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: fullPrompt,
        config: {
          temperature: 0.0,
          maxOutputTokens: 8192,
        }
      });
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI Error: ${e.message}`);
    }
  }

  async processWithUserParams(chunk: string, prompt?: string | null, cacheId?: string | null): Promise<string> {
    const configParams: any = {
      temperature: 0.0,
      maxOutputTokens: 8192,
    };

    let contents = '';
    if (cacheId) {
      configParams.cachedContent = cacheId;
      contents = chunk;
    } else {
      contents = prompt ? `${prompt}\n\n\`\`\`jsonl\n${chunk}\n\`\`\`` : chunk;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: contents,
        config: configParams
      });
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI User Request Error: ${e.message}`);
    }
  }
}
