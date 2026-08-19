export function normalizePlayerAlias(value: unknown): string {
  if (typeof value !== 'string') return '我';
  const clean = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
  return Array.from(clean).slice(0, 24).join('') || '我';
}
