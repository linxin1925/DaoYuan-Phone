import { toRuntimeEntry, type WorldbookAdapter } from '../dlc/worldbookAdapter.ts';
import type { WorldbookEntryLike } from '../dlc/diagnostics.ts';

export type ContentPackage =
  | { kind: 'worldbook'; name: string; entries: WorldbookEntryLike[] }
  | { kind: 'script'; id: string; name: string; content: string; source: Record<string, unknown> };

const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function parseContentPackage(value: unknown, fallbackName = '用户导入内容'): ContentPackage {
  const root = object(value);
  if (!root) throw new Error('内容包必须是 JSON 对象');
  if (root.type === 'script') {
    const content = typeof root.content === 'string' ? root.content : '';
    const name = String(root.name ?? fallbackName).trim();
    if (!name || !content.trim()) throw new Error('脚本缺少名称或正文');
    if (content.length > 2_000_000) throw new Error('脚本超过 2 MB 限制');
    return { kind: 'script', id: String(root.id ?? crypto.randomUUID()), name, content, source: root };
  }
  const rawEntries = object(root.entries) ?? object(object(root.originalData)?.entries);
  if (!rawEntries) throw new Error('未识别到世界书 entries 或酒馆助手 script 结构');
  const name = String(object(root.originalData)?.name ?? root.name ?? fallbackName).trim();
  const entries = Object.values(rawEntries).map((entry) => {
    const source = object(entry);
    if (!source) throw new Error('世界书包含非对象条目');
    return toRuntimeEntry(source);
  });
  if (!name || entries.length === 0) throw new Error('世界书缺少名称或条目');
  if (entries.length > 2000) throw new Error('世界书超过 2000 条限制');
  const names = entries.map((entry) => String(entry.name ?? '').trim());
  if (names.some((entryName) => !entryName)) throw new Error('世界书包含空名称条目');
  if (new Set(names).size !== names.length) throw new Error('世界书包含重名条目，请先整理后再导入');
  return { kind: 'worldbook', name, entries };
}

const retiredEntriesFor = (pkg: Extract<ContentPackage, { kind: 'worldbook' }>): string[] =>
  pkg.entries.some((entry) => String(entry.name ?? '').trim() === '往昔历史') ? ['天华帝国历史'] : [];

export async function importWorldbookPackage(adapter: WorldbookAdapter, pkg: Extract<ContentPackage, { kind: 'worldbook' }>, mode: 'safe-merge' | 'replace-matching'): Promise<{ created: boolean; added: number; updated: number; removed: number }> {
  const names = await adapter.listNames();
  if (!names.includes(pkg.name)) {
    if (!adapter.create) throw new Error('当前酒馆缺少世界书创建接口');
    await adapter.create(pkg.name, pkg.entries);
    return { created: true, added: pkg.entries.length, updated: 0, removed: 0 };
  }
  const current = await adapter.read(pkg.name);
  const currentNames = new Set(current.map((entry) => String(entry.name ?? '').trim()));
  const missing = pkg.entries.filter((entry) => !currentNames.has(String(entry.name ?? '').trim()));
  if (mode === 'safe-merge') {
    if (missing.length && !adapter.appendMissing) throw new Error('当前酒馆缺少世界书条目追加接口');
    if (missing.length) await adapter.appendMissing!(pkg.name, missing);
    return { created: false, added: missing.length, updated: 0, removed: 0 };
  }
  if (!adapter.mergeEntries) throw new Error('当前酒馆缺少世界书事务更新接口');
  const result = await adapter.mergeEntries(pkg.name, pkg.entries, retiredEntriesFor(pkg));
  return { created: false, ...result };
}
