import { diagnoseDlc, type DlcDiagnostic, type WorldbookEntryLike } from './diagnostics.ts';
import { BAIHUA_LOCATION_ENTRIES, DLC_REGISTRY, SHUSHAN_BASE_ENTRIES, SHUSHAN_LOCATION_MARKERS, SHUSHAN_PEAK_ENTRIES, WAN_NIAN_PROCESSES, WAN_NIAN_UNLOCK_STAGE, type DlcRegistryItem } from './registry.ts';
import { candidateNames, seedEntries, type WorldbookAdapter } from './worldbookAdapter.ts';
import { DEFAULT_DLC_SETTINGS, type DlcId, type DlcSeed, type DlcSettings } from './types.ts';

export interface ExpansionManagerOptions { adapter: WorldbookAdapter; seeds: Record<DlcId, DlcSeed>; settings?: Partial<DlcSettings>; }

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const entryName = (entry: WorldbookEntryLike): string => typeof entry.name === 'string' ? entry.name.trim() : '';
const seedEnabled = (seed: DlcSeed, name: string): boolean => seed.entries.find((entry) => entry.name === name)?.sourceEntry.disable !== true;
const needsEnabledUpdate = (entries: WorldbookEntryLike[], desired: ReadonlyMap<string, boolean>): boolean =>
  entries.some((entry) => {
    const target = desired.get(entryName(entry));
    return target !== undefined && entry.enabled !== target;
  });
const processIndexForRealm = (realm: string): number => {
  const stages = ['筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'];
  let realmIndex = -1; for (let index = stages.length - 1; index >= 0; index -= 1) if (realm.includes(stages[index])) { realmIndex = index; break; }
  return realmIndex >= 5 ? 4 : realmIndex >= 4 ? 3 : realmIndex >= 2 ? 2 : realmIndex >= 1 ? 1 : realmIndex >= 0 ? 0 : -1;
};

export class ExpansionManager {
  private readonly options: ExpansionManagerOptions;
  private settings: DlcSettings;
  private diagnostics = new Map<DlcId, DlcDiagnostic>();
  private operation: Promise<unknown> = Promise.resolve();

  constructor(options: ExpansionManagerOptions) { this.options = options; this.settings = { ...DEFAULT_DLC_SETTINGS, ...options.settings }; }
  getSettings(): DlcSettings { return { ...this.settings }; }
  setSettings(settings: Partial<DlcSettings>): DlcSettings { this.settings = { ...this.settings, ...settings }; return this.getSettings(); }
  getStatus(): DlcDiagnostic[] { return DLC_REGISTRY.map((item) => this.diagnostics.get(item.id)).filter((value): value is DlcDiagnostic => Boolean(value)); }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation); this.operation = next.then(() => undefined, () => undefined); return next;
  }

  private async refreshNow(): Promise<DlcDiagnostic[]> {
    const names = await this.options.adapter.listNames(); const mounted = await this.options.adapter.getMountedNames();
    for (const item of DLC_REGISTRY) {
      const expected = seedEntries(this.options.seeds[item.id]);
      const allowed = candidateNames(item.id, item.recommendedName, item.aliases);
      const resolved = await Promise.all(names.filter((name) => allowed.includes(name)).map(async (name) => ({ name, entries: await this.options.adapter.read(name) })));
      this.diagnostics.set(item.id, diagnoseDlc(item, expected, resolved, mounted));
    }
    return this.getStatus();
  }

  refresh(): Promise<DlcDiagnostic[]> { return this.enqueue(() => this.refreshNow()); }
  installMissing(): Promise<DlcDiagnostic[]> { return this.enqueue(async () => {
    const names = await this.options.adapter.listNames();
    for (const item of DLC_REGISTRY) {
      const matches = candidateNames(item.id, item.recommendedName, item.aliases).filter((name) => names.includes(name));
      if (matches.length || !this.options.adapter.create) continue;
      await this.options.adapter.create(item.recommendedName, seedEntries(this.options.seeds[item.id])); names.push(item.recommendedName);
    }
    return this.refreshNow();
  }); }
  repairMissing(): Promise<DlcDiagnostic[]> { return this.enqueue(async () => {
    await this.refreshNow(); if (!this.options.adapter.appendMissing) return this.getStatus();
    const names = await this.options.adapter.listNames();
    for (const item of DLC_REGISTRY) {
      const match = candidateNames(item.id, item.recommendedName, item.aliases).find((name) => names.includes(name)); const diagnostic = this.diagnostics.get(item.id);
      if (match && diagnostic?.status === 'incompatible' && diagnostic.duplicateEntries.length === 0) {
        const missing = seedEntries(this.options.seeds[item.id]).filter((entry) => diagnostic.missingEntries.includes(entryName(entry)));
        if (missing.length) await this.options.adapter.appendMissing(match, missing);
      }
    }
    return this.refreshNow();
  }); }
  attachMissing(): Promise<DlcDiagnostic[]> { return this.enqueue(async () => {
    if (!this.options.adapter.attach) return this.refreshNow();
    const mounted = await this.options.adapter.getMountedNames(); const names = await this.options.adapter.listNames();
    const attachable = DLC_REGISTRY.flatMap((item) => candidateNames(item.id, item.recommendedName, item.aliases).filter((name) => names.includes(name) && !mounted.includes(name)));
    if (attachable.length) await this.options.adapter.attach(attachable); return this.refreshNow();
  }); }

  applyAutomation(worldData: unknown): Promise<DlcDiagnostic[]> { return this.enqueue(async () => {
    await this.refreshNow(); if (!this.options.adapter.updateEnabled) return this.getStatus();
    const statData = record(record(worldData).stat_data); const protagonist = record(statData.主角); const world = record(statData.世界);
    const realm = String(protagonist.境界 ?? ''); const location = String(world.当前地点 ?? '');
    for (const item of DLC_REGISTRY) {
      const diagnostic = this.diagnostics.get(item.id);
      if (!diagnostic || diagnostic.status === 'not-installed' || diagnostic.status === 'conflict' || diagnostic.status === 'incompatible') continue;
      const bookName = diagnostic.candidates[0]; const entries = await this.options.adapter.read(bookName); const desired = this.desiredState(item, this.options.seeds[item.id], entries, realm, location);
      // updateWorldbookWith 会整本保存。状态无变化时绝不能调用，避免酒馆启动期的瞬时空读取被回写成空世界书。
      if (needsEnabledUpdate(entries, desired)) await this.options.adapter.updateEnabled(bookName, desired);
    }
    return this.refreshNow();
  }); }

  private desiredState(item: DlcRegistryItem, seed: DlcSeed, entries: WorldbookEntryLike[], realm: string, location: string): Map<string, boolean> {
    const enabled = this.settings[item.id]; const desired = new Map<string, boolean>();
    if (!enabled) { for (const entry of entries) desired.set(entryName(entry), false); return desired; }
    if (item.activation === 'luoyang-location') { const active = location.includes('洛阳'); for (const entry of entries) desired.set(entryName(entry), active); return desired; }
    if (item.activation === 'baihua-location') {
      const active = location.includes('百花谷');
      for (const entry of entries) { const name = entryName(entry); desired.set(name, BAIHUA_LOCATION_ENTRIES.has(name) ? active : seedEnabled(seed, name)); }
      return desired;
    }
    if (item.activation === 'shushan-hybrid') {
      const inShushan = SHUSHAN_LOCATION_MARKERS.some((marker) => location.includes(marker));
      for (const entry of entries) {
        const name = entryName(entry);
        if (SHUSHAN_BASE_ENTRIES.has(name)) desired.set(name, inShushan);
        else if (SHUSHAN_PEAK_ENTRIES.has(name)) desired.set(name, location.includes(name));
        else desired.set(name, seedEnabled(seed, name));
      }
      return desired;
    }
    const targetProcess = processIndexForRealm(realm);
    const currentProcess = Math.max(-1, ...entries.filter((entry) => entry.enabled === true).map((entry) => WAN_NIAN_PROCESSES.indexOf(entryName(entry) as typeof WAN_NIAN_PROCESSES[number])));
    const process = Math.max(currentProcess, targetProcess);
    for (const entry of entries) {
      const name = entryName(entry); const processEntry = WAN_NIAN_PROCESSES.indexOf(name as typeof WAN_NIAN_PROCESSES[number]); const unlockStage = WAN_NIAN_UNLOCK_STAGE[name];
      if (processEntry >= 0) desired.set(name, processEntry === process);
      else if (unlockStage !== undefined) desired.set(name, process >= unlockStage);
      else desired.set(name, seedEnabled(seed, name));
    }
    return desired;
  }
}
