export function chatCompletionsEndpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

export function modelsEndpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  return normalized.endsWith('/models') ? normalized : `${normalized}/models`;
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
  return '';
}
