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
import {
  RequestBodySchema,
  InitPromptRequestSchema,
  DeleteCacheRequestSchema,
  UserRequestSchema,
  TaskResponseSchema,
  ResultResponseSchema,
  GreetResponseSchema
} from './schemas.js';

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

const app = new OpenAPIHono();
const vertexClient = new VertexClient();

// In-memory task store
const tasks = new Map<string, { status: string; result: string | null; error: string | null }>();

// CORS middleware
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://sheepcomb.netlify.app'
  ],
  allowHeaders: ['Content-Type', 'X-API-KEY'],
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

app.openapi(verifyConnectionRoute, (c) => {
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
    const modelInfo = await vertexClient.greet();
    return c.json({ status: 'success', model_info: modelInfo }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
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
    const cacheId = await vertexClient.setupCache(body.system_instruction, body.display_name);
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
    await vertexClient.deleteCache(body.cache_name);
    return c.json({ status: 'success', result: 'Cache deleted successfully' }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// User task helpers
async function runUserTaskBackground(taskId: string, chunk: string, prompt?: string | null, cacheId?: string | null) {
  tasks.set(taskId, { status: 'processing', result: null, error: null });
  try {
    const result = await vertexClient.processWithUserParams(chunk, prompt, cacheId);
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
  runUserTaskBackground(taskId, body.chunk, body.prompt, body.cache_id);
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
    const result = await vertexClient.processWithUserParams(body.chunk, body.prompt, body.cache_id);
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
  runUserTaskBackground(taskId, body.chunk, body.prompt, body.cache_id);
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
    const result = await vertexClient.processWithUserParams(body.chunk, body.prompt, body.cache_id);
    return c.json({ status: 'success', result }, 200);
  } catch (e: any) {
    return c.json({ status: 'error', error: e.message }, 200);
  }
});

// Background helper for dynamic routes
async function runTaskBackground(taskId: string, prompt: string, chunk: string) {
  tasks.set(taskId, { status: 'processing', result: null, error: null });
  try {
    const result = await vertexClient.processChunk(prompt, chunk);
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
        runTaskBackground(taskId, promptContent, body.chunk);
        return c.json({ task_id: taskId, status: 'pending' }, 200);
      });

      genRouter.openapi(syncRoute, async (c) => {
        const body = c.req.valid('json');
        if (body.chunk.length > 4000) {
          return c.json({ error: 'JSONL data exceeds 4000 characters limit.' }, 400);
        }
        try {
          const result = await vertexClient.processChunk(promptContent, body.chunk);
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
