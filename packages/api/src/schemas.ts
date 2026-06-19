import { z } from '@hono/zod-openapi';

export const RequestBodySchema = z.object({
  chunk: z.string().openapi({ description: 'The input JSONL data to process' }),
}).openapi('RequestBody');
export type RequestBody = z.infer<typeof RequestBodySchema>;

export const InitPromptRequestSchema = z.object({
  system_instruction: z.string().openapi({ description: 'System instruction prompt for Gemini' }),
  display_name: z.string().openapi({ description: 'Display name for cached content' }),
}).openapi('InitPromptRequest');
export type InitPromptRequest = z.infer<typeof InitPromptRequestSchema>;

export const DeleteCacheRequestSchema = z.object({
  cache_name: z.string().nullable().optional().openapi({ description: 'Name of the cache to delete' }),
}).openapi('DeleteCacheRequest');
export type DeleteCacheRequest = z.infer<typeof DeleteCacheRequestSchema>;

export const UserRequestSchema = z.object({
  chunk: z.string().openapi({ description: 'The input JSONL data to process' }),
  prompt: z.string().nullable().optional().openapi({ description: 'Optional user override prompt' }),
  cache_id: z.string().nullable().optional().openapi({ description: 'Optional cache name/ID to use' }),
}).openapi('UserRequest');
export type UserRequest = z.infer<typeof UserRequestSchema>;

export const TaskResponseSchema = z.object({
  task_id: z.string().openapi({ description: 'The UUID of the spawned background task' }),
  status: z.string().openapi({ description: 'Status of the task' }),
}).openapi('TaskResponse');
export type TaskResponse = z.infer<typeof TaskResponseSchema>;

export const ResultResponseSchema = z.object({
  status: z.string().openapi({ description: 'Success or error status' }),
  result: z.string().nullable().optional().openapi({ description: 'Processing result text' }),
  error: z.string().nullable().optional().openapi({ description: 'Error message if any' }),
}).openapi('ResultResponse');
export type ResultResponse = z.infer<typeof ResultResponseSchema>;

export const GreetResponseSchema = z.object({
  status: z.string().openapi({ description: 'Success or error status' }),
  model_info: z.string().nullable().optional().openapi({ description: 'Information about the model' }),
  error: z.string().nullable().optional().openapi({ description: 'Error message if any' }),
}).openapi('GreetResponse');
export type GreetResponse = z.infer<typeof GreetResponseSchema>;
