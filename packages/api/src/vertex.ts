import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CostCalculator, MODEL_PRICING } from './calculator.js';
import { logLlmResponse } from './index.js';

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

// Mock functions for vertex-sheep authorization and logging
export async function authorizeSheepMock(): Promise<void> {
  console.log('[Mock Auth] authorizeSheepMock called. Authorization successful.');
}

export async function setLogToAirtableMock(res: any): Promise<void> {
  console.log('[Mock Log] setLogToAirtableMock called. Logging to Airtable:', JSON.stringify(res));
}

export class VertexClient {
  private aiUser: GoogleGenAI | null = null;
  private aiSheep: GoogleGenAI | null = null;
  private modelName = process.env.VERTEX_MODEL || 'gemini-3.1-pro-preview';
  public cachedContentName: string | null = null;
  private calculator = new CostCalculator(150);

  constructor() {}

  public setModelName(name?: string) {
    if (name && name.trim()) {
      this.modelName = name.trim();
    }
  }

  public getModelName(): string {
    return this.modelName;
  }

  async listModels(provider = 'vertex'): Promise<string[]> {
    try {
      const ai = this.getAiClient(provider);
      const pager = await ai.models.list();
      const models: string[] = [];
      for await (const model of pager) {
        if (model.name) {
          models.push(model.name.replace(/^publishers\/google\/models\//, '').replace(/^models\//, ''));
        }
      }
      return models;
    } catch (e: any) {
      console.warn(`[Vertex AI] Failed to list models: ${e.message}`);
      return [];
    }
  }

  private currentProjectSheep: string | null = null;
  private currentProjectUser: string | null = null;

  private getAiClient(provider: string): GoogleGenAI {
    const defaultSheepProject = 'project-5c3c5988-edd9-4109-907';
    
    if (provider === 'vertex-sheep') {
      const projectId = (process.env.PROJECT_ID_SHEEP || process.env.PROJECT_ID || defaultSheepProject).trim();
      if (!projectId) {
        throw new Error('GCP Project ID is not configured. Please enter GCP Project ID in SheepBobbin Settings.');
      }
      if (!this.aiSheep || this.currentProjectSheep !== projectId) {
        this.currentProjectSheep = projectId;
        this.aiSheep = new GoogleGenAI({
          enterprise: true,
          project: projectId,
          location: 'global' // Global Vertex AI location
        });
      }
      return this.aiSheep;
    } else {
      const projectId = (process.env.PROJECT_ID || '').trim();
      if (!projectId) {
        throw new Error('GCP Project ID is not configured. Please enter GCP Project ID in SheepBobbin Settings.');
      }
      if (!this.aiUser || this.currentProjectUser !== projectId) {
        this.currentProjectUser = projectId;
        this.aiUser = new GoogleGenAI({
          enterprise: true,
          project: projectId,
          location: 'global' // Global Vertex AI location
        });
      }
      return this.aiUser;
    }
  }

  private logUsage(response: any, provider = 'vertex') {
    if (response && response.usageMetadata) {
      const promptTokens = response.usageMetadata.promptTokenCount || 0;
      const completionTokens = response.usageMetadata.candidatesTokenCount || 0;
      const cachedTokens = response.usageMetadata.cachedContentTokenCount || 0;

      const pricing = MODEL_PRICING[this.modelName] || { input_cost: 0, output_cost: 0 };
      const costData: [number, number] = [pricing.input_cost, pricing.output_cost];

      const res = this.calculator.calculate(promptTokens, completionTokens, costData, cachedTokens);
      console.log(`[API Vertex AI] Model: ${this.modelName} (Provider: ${provider})`);
      console.log(this.calculator.formatLog(res));
      console.log(this.calculator.formatTotalLog());

      if (provider === 'vertex-sheep') {
        setLogToAirtableMock(res).catch(err => {
          console.error('[Mock Log Error] Failed to log to Airtable:', err);
        });
      }
    }
  }

  async greet(provider = 'vertex'): Promise<string> {
    const project = provider === 'vertex-sheep'
      ? (process.env.PROJECT_ID_SHEEP || process.env.PROJECT_ID)
      : process.env.PROJECT_ID;

    console.log(`--- Vertex AI Connection Check ---`);
    console.log(`Provider   : ${provider}`);
    console.log(`Project ID : ${project}`);
    console.log(`Location   : global`);
    console.log(`Model Name : ${this.modelName}`);
    console.log(`-----------------------------`);

    try {
      const ai = this.getAiClient(provider);
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: 'Tell me your model name',
      });
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI Connection Error: ${e.message}`);
    }
  }

  async setupCache(systemInstruction: string, displayName: string, provider = 'vertex'): Promise<string> {
    try {
      const ai = this.getAiClient(provider);
      const cache = await ai.caches.create({
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

  async deleteCache(cacheName?: string | null, provider = 'vertex'): Promise<void> {
    const targetName = cacheName || this.cachedContentName;
    if (!targetName) {
      throw new Error('No cache name provided and no stored cache name found.');
    }

    try {
      const ai = this.getAiClient(provider);
      await ai.caches.delete({ name: targetName });
      if (targetName === this.cachedContentName) {
        this.cachedContentName = null;
      }
    } catch (e: any) {
      throw new Error(`Error deleting cache: ${e.message}`);
    }
  }

  async processChunk(prompt: string, chunk: string, provider = 'vertex'): Promise<string> {
    if (provider === 'vertex-sheep') {
      await authorizeSheepMock();
    }
    const fullPrompt = `${prompt}\n\n\`\`\`jsonl\n${chunk}\n\`\`\``;
    try {
      const ai = this.getAiClient(provider);
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: fullPrompt,
        config: {
          temperature: 0.0,
          maxOutputTokens: 8192,
        }
      });
      this.logUsage(response, provider);
      logLlmResponse(provider, response.text || '');
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI Error: ${e.message}`);
    }
  }

  async processWithUserParams(chunk: string, prompt?: string | null, cacheId?: string | null, provider = 'vertex'): Promise<string> {
    if (provider === 'vertex-sheep') {
      await authorizeSheepMock();
    }
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
      const ai = this.getAiClient(provider);
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: contents,
        config: configParams
      });
      this.logUsage(response, provider);
      logLlmResponse(provider, response.text || '');
      return response.text || '';
    } catch (e: any) {
      throw new Error(`Vertex AI User Request Error: ${e.message}`);
    }
  }
}
