import type { DlcId, DlcSeed } from './types.ts';
import type { WorldbookEntryLike } from './diagnostics.ts';

export interface WorldbookAdapter {
  listNames(): Promise<string[]>; read(name: string): Promise<WorldbookEntryLike[]>; getMountedNames(): Promise<string[]>;
  create?(name: string, entries: WorldbookEntryLike[]): Promise<void>;
  appendMissing?(name: string, entries: WorldbookEntryLike[]): Promise<void>;
  updateEnabled?(name: string, desired: ReadonlyMap<string, boolean>): Promise<boolean>;
  attach?(names: string[]): Promise<void>;
}
export interface TavernWorldbookRuntime {
  getWorldbookNames?: () => string[]; getWorldbook?: (name: string) => Promise<WorldbookEntryLike[]>;
  createWorldbook?: (name: string, entries?: WorldbookEntryLike[]) => Promise<boolean>;
  createWorldbookEntries?: (name: string, entries: WorldbookEntryLike[], options?: { render?: 'debounced' | 'immediate' }) => Promise<unknown>;
  updateWorldbookWith?: (name: string, updater: (entries: WorldbookEntryLike[]) => WorldbookEntryLike[], options?: { render?: 'debounced' | 'immediate' }) => Promise<WorldbookEntryLike[]>;
  getCharWorldbookNames?: (character: 'current') => { primary: string | null; additional: string[] };
  rebindCharWorldbooks?: (character: 'current', books: { primary: string | null; additional: string[] }) => Promise<void>;
  SillyTavern?: { getContext?: () => { reloadWorldInfoEditor?: (name: string, loadIfNotSelected?: boolean) => void } };
}
export interface WorldbookRuntimeProbe { canList: boolean; canRead: boolean; canCreate: boolean; canAppend: boolean; canUpdate: boolean; canAttach: boolean; notes: string[]; }

export function probeWorldbookRuntime(runtime: TavernWorldbookRuntime): WorldbookRuntimeProbe {
  const notes: string[] = []; const canList = typeof runtime.getWorldbookNames === 'function'; const canRead = typeof runtime.getWorldbook === 'function';
  const canCreate = typeof runtime.createWorldbook === 'function'; const canAppend = typeof runtime.createWorldbookEntries === 'function'; const canUpdate = typeof runtime.updateWorldbookWith === 'function';
  const canAttach = typeof runtime.getCharWorldbookNames === 'function' && typeof runtime.rebindCharWorldbooks === 'function';
  if (!canList || !canRead) notes.push('缺少公开世界书读取接口，无法进行只读诊断');
  if (!canCreate) notes.push('未发现公开的独立世界书创建接口 createWorldbook');
  if (!canAppend) notes.push('未发现公开的条目补充接口 createWorldbookEntries');
  if (!canUpdate) notes.push('未发现公开的事务更新接口 updateWorldbookWith');
  if (!canAttach) notes.push('未发现公开的角色附属绑定接口 rebindCharWorldbooks');
  return { canList, canRead, canCreate, canAppend, canUpdate, canAttach, notes };
}

const logic = ['and_any', 'not_all', 'not_any', 'and_all'] as const;
const positions = ['before_character_definition', 'after_character_definition', 'before_author_note', 'after_author_note', 'at_depth', 'before_example_messages', 'after_example_messages', 'outlet'] as const;
const roles = ['system', 'user', 'assistant'] as const;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function toRuntimeEntry(source: Record<string, unknown>): WorldbookEntryLike {
  const position = typeof source.position === 'number' ? source.position : 4; const role = typeof source.role === 'number' ? source.role : 0;
  return {
    uid: typeof source.uid === 'number' ? source.uid : undefined, name: String(source.comment ?? source.name ?? ''), enabled: source.disable !== true,
    strategy: { type: source.constant === true ? 'constant' : source.vectorized === true ? 'vectorized' : 'selective', keys: Array.isArray(source.key) ? source.key : [], keys_secondary: { logic: logic[typeof source.selectiveLogic === 'number' ? source.selectiveLogic : 0] ?? 'and_any', keys: Array.isArray(source.keysecondary) ? source.keysecondary : [] }, scan_depth: typeof source.scanDepth === 'number' ? source.scanDepth : 'same_as_global' },
    position: { type: positions[position] ?? 'at_depth', role: roles[role] ?? 'system', depth: typeof source.depth === 'number' ? source.depth : 4, order: typeof source.order === 'number' ? source.order : 100 },
    content: String(source.content ?? ''), probability: source.useProbability === false ? 100 : typeof source.probability === 'number' ? source.probability : 100,
    recursion: { prevent_incoming: source.excludeRecursion === true, prevent_outgoing: source.preventRecursion === true, delay_until: typeof source.delayUntilRecursion === 'number' && source.delayUntilRecursion > 0 ? source.delayUntilRecursion : null },
    effect: { sticky: typeof source.sticky === 'number' && source.sticky > 0 ? source.sticky : null, cooldown: typeof source.cooldown === 'number' && source.cooldown > 0 ? source.cooldown : null, delay: typeof source.delay === 'number' && source.delay > 0 ? source.delay : null },
    ...(Object.keys(record(source.extra)).length ? { extra: record(source.extra) } : {}),
  };
}
export function seedEntries(seed: DlcSeed): WorldbookEntryLike[] { return seed.entries.map((entry) => toRuntimeEntry(entry.sourceEntry)); }
export function candidateNames(_id: DlcId, recommendedName: string, aliases: string[]): string[] { return [recommendedName, ...aliases].filter((name, index, all) => all.indexOf(name) === index); }

export function createTavernWorldbookAdapter(runtime: TavernWorldbookRuntime): WorldbookAdapter {
  const probe = probeWorldbookRuntime(runtime); if (!probe.canList || !probe.canRead) throw new Error(probe.notes.join('；'));
  const refreshOpenEditor = (name: string): void => {
    try { runtime.SillyTavern?.getContext?.().reloadWorldInfoEditor?.(name, false); }
    catch { /* 保存已经成功；编辑器刷新失败不应回滚世界书内容 */ }
  };
  return {
    async listNames() { return [...runtime.getWorldbookNames!()]; }, async read(name) { return runtime.getWorldbook!(name); },
    ...(probe.canCreate ? { async create(name: string, entries: WorldbookEntryLike[]) { const created = await runtime.createWorldbook!(name, entries); if (!created) throw new Error(`世界书「${name}」已存在，已停止覆盖`); refreshOpenEditor(name); } } : {}),
    ...(probe.canAppend ? { async appendMissing(name: string, entries: WorldbookEntryLike[]) { await runtime.createWorldbookEntries!(name, entries, { render: 'debounced' }); refreshOpenEditor(name); } } : {}),
    ...(probe.canUpdate ? { async updateEnabled(name: string, desired: ReadonlyMap<string, boolean>) {
      if (desired.size === 0) throw new Error(`拒绝更新世界书「${name}」：期望条目为空`);
      let changed = false;
      await runtime.updateWorldbookWith!(name, (entries) => {
        const actualNames = new Set(entries.map((entry) => String(entry.name ?? '').trim()));
        const snapshotComplete = entries.length === desired.size && [...desired.keys()].every((entryName) => actualNames.has(entryName));
        if (!snapshotComplete) throw new Error(`拒绝更新世界书「${name}」：运行时快照不完整（读取 ${entries.length} 条，期望 ${desired.size} 条）`);
        return entries.map((entry) => {
          const target = desired.get(String(entry.name ?? '').trim());
          if (target === undefined || entry.enabled === target) return entry;
          changed = true; return { ...entry, enabled: target };
        });
      }, { render: 'immediate' });
      return changed;
    } } : {}),
    async getMountedNames() { const books = runtime.getCharWorldbookNames?.('current'); return books ? [books.primary, ...books.additional].filter((name): name is string => Boolean(name)) : []; },
    ...(probe.canAttach ? { async attach(names: string[]) { const current = runtime.getCharWorldbookNames!('current'); const additional = [...new Set([...current.additional, ...names.filter((name) => name !== current.primary)])]; await runtime.rebindCharWorldbooks!('current', { primary: current.primary, additional }); const verified = runtime.getCharWorldbookNames!('current'); const missing = additional.filter((name) => !verified.additional.includes(name)); if (verified.primary !== current.primary || missing.length) throw new Error(`附属世界书复读失败：${missing.join('、') || '主世界书发生变化'}`); } } : {}),
  };
}
