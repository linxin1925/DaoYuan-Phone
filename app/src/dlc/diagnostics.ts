import type { DlcId } from './types.ts';
import type { DlcRegistryItem } from './registry.ts';

export type DlcStatus = 'not-installed' | 'installed-unmounted' | 'mounted' | 'incompatible' | 'user-modified' | 'conflict';
export interface WorldbookEntryLike {
  uid?: unknown; name?: unknown; enabled?: unknown; content?: unknown; probability?: unknown; extra?: unknown;
  strategy?: { type?: unknown; keys?: unknown[]; keys_secondary?: { logic?: unknown; keys?: unknown[] }; scan_depth?: unknown };
  position?: { type?: unknown; role?: unknown; depth?: unknown; order?: unknown };
  recursion?: { prevent_incoming?: unknown; prevent_outgoing?: unknown; delay_until?: unknown };
  effect?: { sticky?: unknown; cooldown?: unknown; delay?: unknown };
}
export interface DlcDiagnostic { id: DlcId; label: string; status: DlcStatus; candidates: string[]; mounted: boolean; entryCount: number; missingEntries: string[]; duplicateEntries: string[]; unknownEntries: string[]; userModified: boolean; reason: string; }

const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const normalizeKeys = (value: unknown): string[] => Array.isArray(value) ? value.map((key) => String(key)) : [];
export function normalizeWorldbookEntry(entry: WorldbookEntryLike): Record<string, unknown> {
  return {
    name: asString(entry.name).trim(), content: asString(entry.content),
    strategy: { type: entry.strategy?.type ?? 'selective', keys: normalizeKeys(entry.strategy?.keys), keys_secondary: { logic: entry.strategy?.keys_secondary?.logic ?? 'and_any', keys: normalizeKeys(entry.strategy?.keys_secondary?.keys) }, scan_depth: entry.strategy?.scan_depth ?? 'same_as_global' },
    position: { type: entry.position?.type ?? 'at_depth', role: entry.position?.role ?? 'system', depth: entry.position?.depth ?? 4, order: entry.position?.order ?? 100 },
    probability: entry.probability ?? 100,
    recursion: { prevent_incoming: entry.recursion?.prevent_incoming ?? false, prevent_outgoing: entry.recursion?.prevent_outgoing ?? false, delay_until: entry.recursion?.delay_until ?? null },
    effect: { sticky: entry.effect?.sticky ?? null, cooldown: entry.effect?.cooldown ?? null, delay: entry.effect?.delay ?? null }, extra: entry.extra ?? null,
  };
}
const fingerprint = (entry: WorldbookEntryLike): string => JSON.stringify(normalizeWorldbookEntry(entry));

export function diagnoseDlc(item: DlcRegistryItem, expectedEntries: WorldbookEntryLike[], candidates: Array<{ name: string; entries: WorldbookEntryLike[] }>, mountedNames: string[]): DlcDiagnostic {
  const base = { id: item.id, label: item.label };
  if (!candidates.length) return { ...base, status: 'not-installed', candidates: [], mounted: false, entryCount: 0, missingEntries: expectedEntries.map((entry) => asString(entry.name)), duplicateEntries: [], unknownEntries: [], userModified: false, reason: '未发现推荐名称或旧名称别名对应的世界书' };
  if (candidates.length > 1) return { ...base, status: 'conflict', candidates: candidates.map((candidate) => candidate.name), mounted: false, entryCount: 0, missingEntries: [], duplicateEntries: [], unknownEntries: [], userModified: false, reason: '发现多个候选世界书，已阻止自动选择' };
  const candidate = candidates[0]; const names = candidate.entries.map((entry) => asString(entry.name).trim()); const required = expectedEntries.map((entry) => asString(entry.name).trim());
  const missingEntries = required.filter((name) => !names.includes(name));
  const duplicateEntries = [...new Set(names.filter((name, index) => name && names.indexOf(name) !== index))];
  const unknownEntries = names.filter((name) => name && !required.includes(name));
  const expectedByName = new Map(expectedEntries.map((entry) => [asString(entry.name).trim(), entry]));
  const userModified = candidate.entries.some((entry) => { const expected = expectedByName.get(asString(entry.name).trim()); return expected ? fingerprint(entry) !== fingerprint(expected) : false; });
  const mounted = mountedNames.includes(candidate.name); const incompatible = missingEntries.length > 0 || duplicateEntries.length > 0;
  return { ...base, status: incompatible ? 'incompatible' : userModified ? 'user-modified' : mounted ? 'mounted' : 'installed-unmounted', candidates: [candidate.name], mounted, entryCount: candidate.entries.length, missingEntries, duplicateEntries, unknownEntries, userModified, reason: incompatible ? '必需条目缺失或重名' : userModified ? '正文或受控字段已被用户修改，默认保留' : mounted ? '已安装并挂载到当前角色' : '已安装但尚未挂载到当前角色' };
}
