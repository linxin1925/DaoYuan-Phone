import { z } from 'zod';

export const ApiModeSchema = z.enum(['current', 'tavern-helper-custom-api', 'openai-compatible-direct']);
export type ApiMode = z.infer<typeof ApiModeSchema>;

export const ApiSettingsSchema = z.object({
  mode: ApiModeSchema,
  apiUrl: z.string().trim().max(2000).default(''),
  apiKey: z.string().max(4000).default(''),
  apiSource: z.string().trim().max(80).default(''),
  model: z.string().trim().max(200).default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().max(65536).default(4096),
  timeoutMs: z.number().int().positive().max(120000).default(120000),
});

export type ApiSettings = z.infer<typeof ApiSettingsSchema>;
export interface ChatCompletionInput { system?: string; user: string; signal?: AbortSignal }
export interface ApiRuntime {
  generate?: (prompt: string, options?: { signal?: AbortSignal }) => Promise<string>;
  generateRaw?: (prompt: string, options?: Record<string, unknown>) => Promise<string>;
}

const defaults: ApiSettings = { mode: 'current', apiUrl: '', apiKey: '', apiSource: '', model: '', temperature: 0.7, maxTokens: 4096, timeoutMs: 120000 };

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('API request timed out')), timeoutMs);
  const abort = (): void => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', abort, { once: true });
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
}

function endpoint(url: string): string {
  const normalized = url.trim().replace(/\/$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

export class ApiService {
  constructor(private readonly runtime: ApiRuntime = {}) {}

  async generate(input: ChatCompletionInput, rawSettings: Partial<ApiSettings> = {}): Promise<string> {
    const settings = ApiSettingsSchema.parse({ ...defaults, ...rawSettings });
    const prompt = input.system ? `${input.system}\n\n${input.user}` : input.user;
    const timed = withTimeout(input.signal, settings.timeoutMs);
    try {
      if (settings.mode === 'current') {
        if (!this.runtime.generate) throw new Error('current generation capability unavailable');
        return await this.runtime.generate(prompt, { signal: timed.signal });
      }
      if (settings.mode === 'tavern-helper-custom-api') {
        if (!this.runtime.generateRaw) throw new Error('Tavern Helper generateRaw capability unavailable');
        return await this.runtime.generateRaw(prompt, { signal: timed.signal, custom_api: { apiUrl: settings.apiUrl, apiKey: settings.apiKey, apiSource: settings.apiSource, model: settings.model } });
      }
      if (!settings.apiUrl) throw new Error('direct API URL is required');
      const response = await fetch(endpoint(settings.apiUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(settings.apiKey ? { authorization: `Bearer ${settings.apiKey}` } : {}) },
        body: JSON.stringify({ model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens, messages: [{ role: 'user', content: prompt }] }),
        signal: timed.signal,
      });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const text = body.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new Error('API response did not contain text');
      return text;
    } finally {
      timed.dispose();
    }
  }
}
