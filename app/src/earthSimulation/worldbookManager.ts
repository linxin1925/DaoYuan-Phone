import type { WorldbookEntryLike } from '../dlc/diagnostics.ts';
import type { WorldbookAdapter } from '../dlc/worldbookAdapter.ts';
import { diagnoseEarthWorldbook, type EarthWorldbookCapabilities, type EarthWorldbookDiagnostic } from './diagnostics.ts';
import { EARTH_WORLD_BOOK_NAME } from './types.ts';
import { earthWorldbookEntries } from './worldbookSeed.ts';

export interface EarthWorldbookManagerOptions {
  adapter: WorldbookAdapter;
  capabilities?: Partial<EarthWorldbookCapabilities>;
}

const entryName = (entry: WorldbookEntryLike): string => typeof entry.name === 'string' ? entry.name.trim() : '';

export class EarthWorldbookManager {
  private readonly adapter: WorldbookAdapter;
  private readonly capabilities: EarthWorldbookCapabilities;
  private diagnostic: EarthWorldbookDiagnostic | null = null;
  private latestCandidate: string | null = null;
  private latestEntries: WorldbookEntryLike[] = [];
  private operation: Promise<unknown> = Promise.resolve();

  constructor(options: EarthWorldbookManagerOptions) {
    this.adapter = options.adapter;
    this.capabilities = {
      canCreate: options.capabilities?.canCreate ?? Boolean(options.adapter.create),
      canAppend: options.capabilities?.canAppend ?? Boolean(options.adapter.appendMissing),
      canAttach: options.capabilities?.canAttach ?? Boolean(options.adapter.attach),
    };
  }

  getStatus(): EarthWorldbookDiagnostic | null { return this.diagnostic ? structuredClone(this.diagnostic) : null; }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation);
    this.operation = next.then(() => undefined, () => undefined);
    return next;
  }

  private async refreshNow(): Promise<EarthWorldbookDiagnostic> {
    const names = await this.adapter.listNames();
    const mounted = await this.adapter.getMountedNames();
    const matches = names.filter((name) => name === EARTH_WORLD_BOOK_NAME);
    const candidates = await Promise.all(matches.map(async (name) => ({ name, entries: await this.adapter.read(name) })));
    this.latestCandidate = candidates.length === 1 ? candidates[0].name : null;
    this.latestEntries = candidates.length === 1 ? candidates[0].entries : [];
    this.diagnostic = diagnoseEarthWorldbook(earthWorldbookEntries(), candidates, mounted, this.capabilities);
    return this.getStatus()!;
  }

  refresh(): Promise<EarthWorldbookDiagnostic> { return this.enqueue(() => this.refreshNow()); }

  install(): Promise<EarthWorldbookDiagnostic> { return this.enqueue(async () => {
    const names = await this.adapter.listNames();
    if (!names.includes(EARTH_WORLD_BOOK_NAME)) {
      if (!this.adapter.create) throw new Error('当前运行时不支持创建独立世界书');
      await this.adapter.create(EARTH_WORLD_BOOK_NAME, earthWorldbookEntries());
    }
    return this.refreshNow();
  }); }

  attach(): Promise<EarthWorldbookDiagnostic> { return this.enqueue(async () => {
    const status = await this.refreshNow();
    if (status.status === 'not-installed') throw new Error('请先安装地球附属世界书');
    if (status.status === 'conflict' || status.status === 'duplicate-entries' || status.status === 'empty-snapshot') throw new Error(status.reason);
    if (!status.mounted) {
      if (!this.adapter.attach) throw new Error('当前运行时不支持附属世界书挂载');
      await this.adapter.attach([status.candidates[0]]);
    }
    return this.refreshNow();
  }); }

  repairMissing(): Promise<EarthWorldbookDiagnostic> { return this.enqueue(async () => {
    let status = await this.refreshNow();
    if (status.status === 'missing-entries') {
      if (status.duplicateEntries.length) throw new Error('存在重名条目，拒绝自动补缺');
      if (!this.adapter.appendMissing) throw new Error('当前运行时不支持补充世界书条目');
      const missing = new Set(status.missingEntries);
      const entries = earthWorldbookEntries().filter((entry) => missing.has(entryName(entry)));
      if (entries.length) await this.adapter.appendMissing(status.candidates[0], entries);
      status = await this.refreshNow();
    }
    if (status.candidates.length === 1 && this.adapter.updateContent) {
      const managedRuleNames = new Set(['双界基准监控', '灵力复苏开局与时间基准', '地球开放局势']);
      const managedRoutes = new Map(earthWorldbookEntries().filter((entry) => /^EJS/.test(entryName(entry)) || managedRuleNames.has(entryName(entry))).map((entry) => [entryName(entry), String(entry.content ?? '')]));
      await this.adapter.updateContent(status.candidates[0], managedRoutes);
    } else if (status.status === 'user-modified') {
      throw new Error('当前运行时不支持安全更新内置 EJS 路由');
    }
    return this.refreshNow();
  }); }

  readMountedEntries(refresh = true): Promise<WorldbookEntryLike[]> { return this.enqueue(async () => {
    const status = refresh ? await this.refreshNow() : this.diagnostic;
    if (!status) return [];
    if (!status.mounted || status.candidates.length !== 1) return [];
    if (this.latestCandidate === status.candidates[0]) return this.latestEntries;
    return this.adapter.read(status.candidates[0]);
  }); }
}
