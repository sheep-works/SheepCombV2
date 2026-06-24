import { serve } from '@hono/node-server';
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { cors } from 'hono/cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { VertexClient } from './vertex.js';
import { CostCalculator } from './calculator.js';
import {
  RequestBodySchema,
  InitPromptRequestSchema,
  DeleteCacheRequestSchema,
  UserRequestSchema,
  TaskResponseSchema,
  ResultResponseSchema,
  GreetResponseSchema
} from './schemas.js';

// Vercel AI SDK imports
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

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

let serverConfig: any = {};

function loadServerConfig() {
  const userDataPath = process.env.USER_DATA_PATH;
  if (userDataPath) {
    const configPath = path.join(userDataPath, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const data = fs.readFileSync(configPath, 'utf-8');
        serverConfig = JSON.parse(data);
        console.log('[API Info] Loaded configuration from Electron config.json:', serverConfig);
        
        // Copy keys to process.env so existing auth & vertexClient code works out-of-the-box
        if (serverConfig.API_KEY_SHEEP) {
          process.env.API_KEY_SHEEP = serverConfig.API_KEY_SHEEP;
        }
        if (serverConfig.PROJECT_ID) {
          process.env.PROJECT_ID = serverConfig.PROJECT_ID;
        }
      } catch (err) {
        console.error('[API Error] Failed to read config.json:', err);
      }
    }
  } else {
    // Standalone dev mode: use environment variables or defaults
    serverConfig = {
      ACTIVE_PROVIDER: process.env.ACTIVE_PROVIDER || 'vertex-sheep',
      OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
      OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'gemma4:e2b',
      LMSTUDIO_URL: process.env.LMSTUDIO_URL || 'http://127.0.0.1:1234',
      LMSTUDIO_MODEL: process.env.LMSTUDIO_MODEL || 'local-model',
      PROJECT_ID: process.env.PROJECT_ID || '',
      API_KEY_SHEEP: process.env.API_KEY_SHEEP || ''
    };
  }
}
loadServerConfig();

const app = new OpenAPIHono();
const vertexClient = new VertexClient();
const localCalculator = new CostCalculator(150);

// In-memory task store
const tasks = new Map<string, { status: string; result: string | null; error: string | null }>();

// CORS middleware
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://sheepcomb.netlify.app'
  ],
  allowHeaders: ['Content-Type', 'X-API-KEY', 'X-LLM-Provider', 'X-LLM-Model', 'X-LLM-URL'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  credentials: true,
}));

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  const apiKey = c.req.header('X-API-KEY');
  const validKeys = new Set(
    Object.entries(process.env)
      .filter(([k]) => k.startsWith('API_KEY_'))
      .map(([_, v]) => v)
  );

  const mask = (key: string | undefined) => 
    key ? `${key.slice(0, 4)}...${key.slice(-4)} (len: ${key.length})` : 'undefined';

  const isMatched = apiKey && validKeys.has(apiKey);
  console.log(`[API Auth] Path: ${c.req.path} | Request Key: ${mask(apiKey)} | Match: ${isMatched}`);

  if (isMatched) {
    await next();
  } else {
    return c.json({ error: 'Could not validate credentials' }, 403);
  }
};

app.use('/verify_connection', authMiddleware);
app.use('/tasks/*', authMiddleware);

// Vercel AI SDK Helpers
function getLlmProviderAndModel(c: any) {
  const provider = c.req.header('X-LLM-Provider') || serverConfig.ACTIVE_PROVIDER || 'vertex';
  const modelName = c.req.header('X-LLM-Model') || (
    provider === 'ollama' ? serverConfig.OLLAMA_MODEL : 
    provider === 'lmstudio' ? serverConfig.LMSTUDIO_MODEL :
    provider === 'gemini' ? serverConfig.GEMINI_MODEL : undefined
  );
  const url = c.req.header('X-LLM-URL') || (
    provider === 'ollama' ? serverConfig.OLLAMA_URL : 
    provider === 'lmstudio' ? serverConfig.LMSTUDIO_URL : undefined
  );
  return { provider, modelName, url };
}

function getLlmModel(provider: string, modelName: string, url?: string) {
  if (provider === 'lmstudio') {
    const baseUrl = (url || 'http://127.0.0.1:1234').replace(/\/$/, '') + '/v1';
    const lmstudio = createOpenAI({
      baseURL: baseUrl,
      apiKey: 'lm-studio',
    });
    return lmstudio(modelName || 'local-model');
  } else if (provider === 'ollama') {
    const baseUrl = (url || 'http://localhost:11434').replace(/\/$/, '') + '/v1';
    const ollama = createOpenAI({
      baseURL: baseUrl,
      apiKey: 'ollama',
    });
    return ollama(modelName || 'gemma4:e2b');
  } else if (provider === 'gemini') {
    const apiKey = serverConfig.AI_STUDIO_FREE || process.env.AI_STUDIO_FREE || '';
    const google = createGoogleGenerativeAI({
      apiKey,
    });
    return google(modelName || 'gemini-1.5-flash');
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

async function fetchLlmModels(provider: string, url?: string): Promise<string[]> {
  if (provider === 'ollama') {
    try {
      const targetUrl = (url || 'http://localhost:11434').replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/api/tags`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.models ? data.models.map((m: any) => m.name) : [];
    } catch (e) {
      return [];
    }
  } else if (provider === 'lmstudio') {
    try {
      const targetUrl = (url || 'http://127.0.0.1:1234').replace(/\/$/, '');
      const response = await fetch(`${targetUrl}/v1/models`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data ? data.data.map((m: any) => m.id) : [];
    } catch (e) {
      return [];
    }
  } else if (provider === 'gemini') {
    try {
      const apiKey = serverConfig.AI_STUDIO_FREE || process.env.AI_STUDIO_FREE || '';
      if (!apiKey) return [];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!response.ok) return [];
      const data = await response.json();
      if (data.models) {
        return data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => m.name.replace(/^models\//, ''));
      }
      return [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function processChunkWithSdk(
  provider: string,
  modelName: string,
  url: string | undefined,
  chunkText: string,
  systemPrompt: string
): Promise<string> {
  const model = getLlmModel(provider, modelName, url);
  const userContent = `\`\`\`jsonl\n${chunkText}\n\`\`\``;

  try {
    const { text, usage } = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.0,
      maxRetries: 1
    });

    if (usage) {
      const res = localCalculator.calculate(
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        [0, 0]
      );
      console.log(`[API Local LLM] Model: ${modelName}`);
      console.log(localCalculator.formatLog(res));
      console.log(localCalculator.formatTotalLog());
    }

    return text || '';
  } catch (e: any) {
    console.error(`[API Local LLM Error]`, e);
    throw e;
  }
}

// Define verify_connection route
const verifyConnectionRoute = createRoute({
  method: 'get',
  path: '/verify_connection',
  summary: 'Verify Connection',
  description: 'Endpoint to verify that the API server is running and accessible.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            message: z.string()
          })
        }
      },
      description: 'Successful Response'
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Authentication failure'
    }
  }
});

app.openapi(verifyConnectionRoute, async (c) => {
  const { provider, url } = getLlmProviderAndModel(c);
  if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
    try {
      const models = await fetchLlmModels(provider, url);
      if (models.length > 0) {
        return c.json({ status: 'ok', message: `SheepHub Proxy to ${provider} is accessible` }, 200);
      }
      return c.json({ error: `No models found for provider ${provider}` }, 403);
    } catch (e: any) {
      return c.json({ error: e.message }, 403);
    }
  }
  return c.json({ status: 'ok', message: 'SheepHub API is accessible' }, 200);
});

// Define tasks route
const getTaskResultRoute = createRoute({
  method: 'get',
  path: '/tasks/{task_id}',
  summary: 'Get Task Result',
  description: 'Retrieve the status and result of a background task.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({
      task_id: z.string().openapi({ description: 'The UUID of the task' })
    })
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            result: z.string().nullable().optional(),
            error: z.string().nullable().optional()
          })
        }
      },
      description: 'Successful Response'
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Task not found'
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string()
          })
        }
      },
      description: 'Authentication failure'
    }
  }
});

app.openapi(getTaskResultRoute, (c) => {
  const taskId = c.req.param('task_id');
  if (!tasks.has(taskId)) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const task = tasks.get(taskId)!;
  return c.json({
    status: task.status,
    result: task.result ?? undefined,
    error: task.error ?? undefined
  }, 200);
});

// Gen router
const genRouter = new OpenAPIHono();
genRouter.use('*', authMiddleware);

// Greet route
const greetRoute = createRoute({
  method: 'get',
  path: '/greet',
  summary: 'Greet Endpoint',
  description: 'Greet endpoint to fetch AI model information.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GreetResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(greetRoute, async (c) => {
  try {
    const { provider, url } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const models = await fetchLlmModels(provider, url);
      return c.json({ status: 'success', model_info: `${provider === 'gemini' ? 'Google AI Studio' : provider === 'ollama' ? 'Ollama' : 'LM Studio'} Models: ${models.join(', ')}` }, 200);
    }
    const modelInfo = await vertexClient.greet(provider);
    return c.json({ status: 'success', model_info: modelInfo }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// Models Endpoint
genRouter.get('/models', async (c) => {
  try {
    const { provider, url } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const models = await fetchLlmModels(provider, url);
      return c.json(models, 200);
    }
    return c.json([], 200);
  } catch (e) {
    return c.json([], 200);
  }
});

// Settings Endpoint
const getSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  summary: 'Settings Endpoint',
  description: 'Get current LLM provider and model settings.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            provider: z.string(),
            model: z.string(),
            url: z.string().optional()
          })
        }
      },
      description: 'Successful Response'
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            provider: z.string(),
            model: z.string()
          })
        }
      },
      description: 'Error Response'
    }
  }
});

genRouter.openapi(getSettingsRoute, async (c) => {
  try {
    const { provider, modelName, url } = getLlmProviderAndModel(c);
    return c.json({
      provider: provider || 'unknown',
      model: modelName || 'unknown',
      url: url || ''
    }, 200);
  } catch (e: any) {
    return c.json({ provider: 'error', model: e.message }, 500);
  }
});

// Init Prompt route
const initPromptRoute = createRoute({
  method: 'post',
  path: '/init_prompt',
  summary: 'Initialize Prompt Cache',
  description: 'Configure and initialize system prompt cache in Vertex AI.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: InitPromptRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResultResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(initPromptRoute, async (c) => {
  const body = c.req.valid('json');
  try {
    const { provider } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      return c.json({ status: 'success', result: `${provider}-dummy-cache` }, 200);
    }
    const cacheId = await vertexClient.setupCache(body.system_instruction, body.display_name, provider);
    return c.json({ status: 'success', result: cacheId }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// Delete cache route
const deleteCacheRoute = createRoute({
  method: 'post',
  path: '/delete_cache',
  summary: 'Delete Cache',
  description: 'Clean up/delete initialized system prompt cache.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: DeleteCacheRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResultResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(deleteCacheRoute, async (c) => {
  const body = c.req.valid('json');
  try {
    const { provider } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      return c.json({ status: 'success' }, 200);
    }
    await vertexClient.deleteCache(body.cache_name, provider);
    return c.json({ status: 'success', result: 'Cache deleted successfully' }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// User task helpers
async function runUserTaskBackground(
  taskId: string,
  chunk: string,
  prompt?: string | null,
  cacheId?: string | null,
  provider?: string | null,
  modelName?: string | null,
  url?: string | null
) {
  tasks.set(taskId, { status: 'processing', result: null, error: null });
  try {
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const systemPrompt = prompt || "あなたは優秀な翻訳チェッカーです。渡された原文と訳文を比較し、誤訳や不自然な箇所があれば指摘してください。問題がなければ 空文字 または 'OK' を返してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"指摘内容\" }";
      const result = await processChunkWithSdk(provider, modelName || '', url || undefined, chunk, systemPrompt);
      tasks.set(taskId, { status: 'success', result, error: null });
      return;
    }
    const result = await vertexClient.processWithUserParams(chunk, prompt, cacheId, provider || undefined);
    tasks.set(taskId, { status: 'success', result, error: null });
  } catch (e: any) {
    tasks.set(taskId, { status: 'error', result: null, error: e.message });
  }
}

// User check route (async)
const checkUserRoute = createRoute({
  method: 'post',
  path: '/check/user',
  summary: 'Check User (Async)',
  description: 'Asynchronously run quality check with user parameters.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UserRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(checkUserRoute, async (c) => {
  const body = c.req.valid('json');
  const taskId = crypto.randomUUID();
  tasks.set(taskId, { status: 'pending', result: null, error: null });
  const { provider, modelName, url } = getLlmProviderAndModel(c);
  runUserTaskBackground(taskId, body.chunk, body.prompt, body.cache_id, provider, modelName, url);
  return c.json({ task_id: taskId, status: 'pending' }, 200);
});

// User check route (sync)
const checkUserSyncRoute = createRoute({
  method: 'post',
  path: '/check/user/sync',
  summary: 'Check User (Sync)',
  description: 'Synchronously run quality check with user parameters.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UserRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResultResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(checkUserSyncRoute, async (c) => {
  const body = c.req.valid('json');
  try {
    const { provider, modelName, url } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const systemPrompt = body.prompt || "あなたは優秀な翻訳チェッカーです。渡された原文と訳文を比較し、誤訳や不自然な箇所があれば指摘してください。問題がなければ 空文字 または 'OK' を返してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"指摘内容\" }";
      const result = await processChunkWithSdk(provider, modelName || '', url || undefined, body.chunk, systemPrompt);
      return c.json({ status: 'success', result }, 200);
    }
    const result = await vertexClient.processWithUserParams(body.chunk, body.prompt, body.cache_id, provider);
    return c.json({ status: 'success', result }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// User trans route (async)
const transUserRoute = createRoute({
  method: 'post',
  path: '/trans/user',
  summary: 'Translate User (Async)',
  description: 'Asynchronously run translation with user parameters.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UserRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(transUserRoute, async (c) => {
  const body = c.req.valid('json');
  const taskId = crypto.randomUUID();
  tasks.set(taskId, { status: 'pending', result: null, error: null });
  const { provider, modelName, url } = getLlmProviderAndModel(c);
  runUserTaskBackground(taskId, body.chunk, body.prompt, body.cache_id, provider, modelName, url);
  return c.json({ task_id: taskId, status: 'pending' }, 200);
});

// User trans route (sync)
const transUserSyncRoute = createRoute({
  method: 'post',
  path: '/trans/user/sync',
  summary: 'Translate User (Sync)',
  description: 'Synchronously run translation with user parameters.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: UserRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ResultResponseSchema
        }
      },
      description: 'Successful Response'
    }
  }
});

genRouter.openapi(transUserSyncRoute, async (c) => {
  const body = c.req.valid('json');
  try {
    const { provider, modelName, url } = getLlmProviderAndModel(c);
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const systemPrompt = body.prompt || "あなたは優秀な翻訳家です。渡された原文を翻訳してください。出力は必ず以下の形式のJSONで返してください：\n{ \"result\": \"翻訳文\" }";
      const result = await processChunkWithSdk(provider, modelName || '', url || undefined, body.chunk, systemPrompt);
      return c.json({ status: 'success', result }, 200);
    }
    const result = await vertexClient.processWithUserParams(body.chunk, body.prompt, body.cache_id, provider);
    return c.json({ status: 'success', result }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// Background helper for dynamic routes
async function runTaskBackground(
  taskId: string,
  prompt: string,
  chunk: string,
  provider?: string | null,
  modelName?: string | null,
  url?: string | null
) {
  tasks.set(taskId, { status: 'processing', result: null, error: null });
  try {
    if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
      const result = await processChunkWithSdk(provider, modelName || '', url || undefined, chunk, prompt);
      tasks.set(taskId, { status: 'success', result, error: null });
      return;
    }
    const result = await vertexClient.processChunk(prompt, chunk, provider || undefined);
    tasks.set(taskId, { status: 'success', result, error: null });
  } catch (e: any) {
    tasks.set(taskId, { status: 'error', result: null, error: e.message });
  }
}

// Dynamic prompt routes registration
const promptsDir = path.join(__dirname, '../prompts');
if (fs.existsSync(promptsDir)) {
  const files = fs.readdirSync(promptsDir);
  for (const file of files) {
    if (file.endsWith('.md') && file.includes('-')) {
      const stem = path.basename(file, '.md');
      const dashIdx = stem.indexOf('-');
      const category = stem.slice(0, dashIdx);
      const name = stem.slice(dashIdx + 1);

      const promptContent = fs.readFileSync(path.join(promptsDir, file), 'utf-8');

      // Async Route
      const asyncRoute = createRoute({
        method: 'post',
        path: `/${category}/${name}`,
        summary: `Process ${category}/${name} (Async)`,
        description: `Asynchronously run task for category ${category} and prompt ${name}.`,
        security: [{ ApiKeyAuth: [] }],
        request: {
          body: {
            content: {
              'application/json': {
                schema: RequestBodySchema
              }
            }
          }
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: TaskResponseSchema
              }
            },
            description: 'Successful Response'
          },
          400: {
            content: {
              'application/json': {
                schema: z.object({ error: z.string() })
              }
            },
            description: 'Bad Request'
          }
        }
      });

      // Sync Route
      const syncRoute = createRoute({
        method: 'post',
        path: `/${category}/${name}/sync`,
        summary: `Process ${category}/${name} (Sync)`,
        description: `Synchronously run task for category ${category} and prompt ${name}.`,
        security: [{ ApiKeyAuth: [] }],
        request: {
          body: {
            content: {
              'application/json': {
                schema: RequestBodySchema
              }
            }
          }
        },
        responses: {
          200: {
            content: {
              'application/json': {
                schema: ResultResponseSchema
              }
            },
            description: 'Successful Response'
          },
          400: {
            content: {
              'application/json': {
                schema: z.object({ error: z.string() })
              }
            },
            description: 'Bad Request'
          }
        }
      });

      genRouter.openapi(asyncRoute, async (c) => {
        const body = c.req.valid('json');
        if (body.chunk.length > 4000) {
          return c.json({ error: 'JSONL data exceeds 4000 characters limit.' }, 400);
        }
        const taskId = crypto.randomUUID();
        tasks.set(taskId, { status: 'pending', result: null, error: null });
        const { provider, modelName, url } = getLlmProviderAndModel(c);
        runTaskBackground(taskId, promptContent, body.chunk, provider, modelName, url);
        return c.json({ task_id: taskId, status: 'pending' }, 200);
      });

      genRouter.openapi(syncRoute, async (c) => {
        const body = c.req.valid('json');
        if (body.chunk.length > 4000) {
          return c.json({ error: 'JSONL data exceeds 4000 characters limit.' }, 400);
        }
        try {
          const { provider, modelName, url } = getLlmProviderAndModel(c);
          if (provider === 'ollama' || provider === 'lmstudio' || provider === 'gemini') {
            const result = await processChunkWithSdk(provider, modelName || '', url || undefined, body.chunk, promptContent);
            return c.json({ status: 'success', result }, 200);
          }
          const result = await vertexClient.processChunk(promptContent, body.chunk, provider);
          return c.json({ status: 'success', result }, 200);
        } catch (e: any) {
          return c.json({ status: 'error', error: e.message }, 200);
        }
      });
    }
  }
}

app.route('/gen', genRouter);

// Set up OpenAPI JSON endpoint
const openApiConfig = {
  openapi: '3.1.0',
  info: {
    title: 'SheepHub API',
    version: '1.0.0',
    description: 'Hono-based API server for SheepHub providing translation and quality checks via Vertex AI.'
  },
  security: [
    {
      ApiKeyAuth: []
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-KEY'
      }
    }
  }
};

app.doc('/openapi.json', openApiConfig);

// Set up Swagger UI
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

// Generate static openapi.json file on startup (only in development)
if (!__dirname.includes('app.asar')) {
  try {
    const openApiDoc = app.getOpenAPI31Document(openApiConfig);
    const outputPath = path.join(__dirname, '../openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(openApiDoc, null, 2), 'utf-8');
    console.log(`Generated OpenAPI spec saved to: ${outputPath}`);
  } catch (err) {
    console.error('Failed to generate static openapi.json file:', err);
  }
}

const port = Number(process.env.PORT) || 8000;
console.log(`Server is running on port ${port}`);
const loadedKeys = Object.entries(process.env)
  .filter(([k]) => k.startsWith('API_KEY_'))
  .map(([k, v]) => `${k}=${v ? v.slice(0, 4) + '...' + v.slice(-4) + ' (len: ' + v.length + ')' : 'empty'}`);
console.log(`[API Info] Loaded API Keys: [${loadedKeys.join(', ')}]`);

serve({
  fetch: app.fetch,
  port
});
