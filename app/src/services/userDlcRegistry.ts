export interface UserDlcRecord {
  id: string;
  name: string;
  worldbookName: string;
  scriptId: string | null;
  scriptName: string | null;
  importedAt: string;
}

export interface UserDlcStatus extends UserDlcRecord {
  worldbookExists: boolean;
  mounted: boolean;
  scriptStored: boolean;
  scriptEnabled: boolean;
  scriptActive: boolean;
}

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function normalizeUserDlcs(value: unknown): UserDlcRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry) => {
    const source = object(entry); if (!source) return [];
    const id = String(source.id ?? '').trim(); const name = String(source.name ?? '').trim(); const worldbookName = String(source.worldbookName ?? '').trim();
    if (!id || !name || !worldbookName || seen.has(id)) return [];
    seen.add(id);
    const scriptId = typeof source.scriptId === 'string' && source.scriptId.trim() ? source.scriptId.trim() : null;
    const scriptName = scriptId && typeof source.scriptName === 'string' && source.scriptName.trim() ? source.scriptName.trim() : null;
    return [{ id, name, worldbookName, scriptId, scriptName, importedAt: typeof source.importedAt === 'string' ? source.importedAt : '' }];
  });
}

export function createUserDlcId(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `user-dlc-${slug || 'custom'}-${crypto.randomUUID()}`;
}
