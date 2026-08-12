export function chatCompletionsEndpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

export function modelsEndpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  return normalized.endsWith('/models') ? normalized : `${normalized}/models`;
}

export function modelEndpoints(url: string): string[] {
  const normalized = url.trim().replace(/\/+$/, '').replace(/\/(?:chat\/completions|responses|messages|models)$/i, '');
  if (/\/v\d+$/i.test(normalized)) return [`${normalized}/models`];
  return [`${normalized}/v1/models`, `${normalized}/models`];
}

export function extractModelIds(value: unknown): string[] {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const rows = Array.isArray(value) ? value : Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : [];
  return rows.map(item => typeof item === 'string' ? item : item && typeof item === 'object' ? String((item as Record<string, unknown>).id ?? (item as Record<string, unknown>).name ?? '') : '').filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function protocolFor(url: string): 'anthropic' | 'responses' | 'chat' {
  const value = url.toLowerCase();
  if (value.endsWith('/messages')) return 'anthropic';
  if (value.endsWith('/responses')) return 'responses';
  if (value.endsWith('/chat/completions')) return 'chat';
  if (value.includes('/api/coding/v3')) return 'responses';
  if (value.includes('/api/coding')) return 'anthropic';
  return 'chat';
}

export async function fetchAuto(url: string, init: RequestInit & { body?: string }): Promise<Response> {
  const protocol = protocolFor(url);
  const source = init.body ? JSON.parse(init.body) as Record<string, unknown> : {};
  const messages = Array.isArray(source.messages) ? source.messages as Array<Record<string, unknown>> : [];
  const model = typeof source.model === 'string' ? source.model : '';
  const system = messages.filter(message => message.role === 'system').map(message => String(message.content ?? '')).join('\n\n');
  const input = messages.filter(message => message.role !== 'system').map(message => ({ role: message.role, content: message.content }));
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (protocol === 'anthropic') {
    headers.delete('Authorization');
    const key = headers.get('x-api-key') || headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (key) headers.set('x-api-key', key);
    headers.delete('authorization');
    return fetch(url.replace(/\/+$/, ''), { ...init, headers, body: JSON.stringify({ model, max_tokens: source.max_tokens ?? 4096, temperature: source.temperature, ...(system ? { system } : {}), messages: input }) });
  }
  if (protocol === 'responses') {
    const responseInput = [...(system ? [{ role: 'system', content: system }] : []), ...input];
    return fetch(url.replace(/\/+$/, ''), { ...init, headers, body: JSON.stringify({ model, input: responseInput, temperature: source.temperature, max_output_tokens: source.max_tokens ?? 4096 }) });
  }
  return fetch(url.toLowerCase().endsWith('/chat/completions') ? url.replace(/\/+$/, '') : chatCompletionsEndpoint(url), { ...init, headers, body: init.body });
}

export function extractOpenAIText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0] && typeof choices[0] === 'object' ? choices[0] as Record<string, unknown> : {};
  const message = first.message && typeof first.message === 'object' ? first.message as Record<string, unknown> : {};
  const content = message.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => {
    if (typeof part === 'string') return part;
    if (!part || typeof part !== 'object') return '';
    const row = part as Record<string, unknown>;
    return typeof row.text === 'string' ? row.text : typeof row.content === 'string' ? row.content : '';
  }).join('').trim();
  for (const key of ['text', 'response', 'message']) if (typeof record[key] === 'string') return String(record[key]).trim();
  if (typeof record.output_text === 'string') return record.output_text.trim();
  const output = Array.isArray(record.output) ? record.output : [];
  const responseText = output.flatMap(item => item && typeof item === 'object' ? ((item as Record<string, unknown>).content as unknown[] ?? []) : []).map(item => item && typeof item === 'object' ? String((item as Record<string, unknown>).text ?? '') : '').join('').trim();
  if (responseText) return responseText;
  if (Array.isArray(record.content)) return record.content.map(item => item && typeof item === 'object' ? String((item as Record<string, unknown>).text ?? '') : '').join('').trim();
  return '';
}
