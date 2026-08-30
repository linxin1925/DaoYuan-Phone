import { normalizeWorldbookEntry, type WorldbookEntryLike } from '../dlc/diagnostics.ts';
import { EARTH_WORLD_BOOK_ID, EARTH_WORLD_BOOK_NAME } from './types.ts';

export type EarthWorldbookStatus = 'not-installed' | 'installed-unmounted' | 'mounted' | 'missing-entries' | 'duplicate-entries' | 'conflict' | 'empty-snapshot' | 'user-modified';
export interface EarthWorldbookCapabilities { canCreate: boolean; canAppend: boolean; canAttach: boolean; }
export interface EarthWorldbookDiagnostic { id: typeof EARTH_WORLD_BOOK_ID; status: EarthWorldbookStatus; candidates: string[]; mounted: boolean; entryCount: number; missingEntries: string[]; duplicateEntries: string[]; userModified: boolean; canCreate: boolean; canRepairMissing: boolean; canAttach: boolean; reason: string; }
const nameOf = (entry: WorldbookEntryLike): string => typeof entry.name === 'string' ? entry.name.trim() : '';
const fingerprint = (entry: WorldbookEntryLike): string => JSON.stringify(normalizeWorldbookEntry(entry));

export function diagnoseEarthWorldbook(expected: WorldbookEntryLike[], candidates: Array<{ name: string; entries: WorldbookEntryLike[] }>, mountedNames: string[], capabilities: EarthWorldbookCapabilities = { canCreate: true, canAppend: true, canAttach: true }): EarthWorldbookDiagnostic {
  const base = { id: EARTH_WORLD_BOOK_ID, candidates: candidates.map((item) => item.name), mounted: false, entryCount: 0, missingEntries: [] as string[], duplicateEntries: [] as string[], userModified: false, canCreate: false, canRepairMissing: false, canAttach: false };
  if (!candidates.length) return { ...base, status: 'not-installed', canCreate: capabilities.canCreate, reason: capabilities.canCreate ? `未发现世界书「${EARTH_WORLD_BOOK_NAME}」` : '未安装，且当前运行时缺少公开创建能力' };
  if (candidates.length > 1) return { ...base, status: 'conflict', reason: '发现多个候选世界书，已停止自动修改' };
  const candidate = candidates[0]; const mounted = mountedNames.includes(candidate.name);
  if (!candidate.entries.length) return { ...base, candidates: [candidate.name], mounted, status: 'empty-snapshot', reason: '运行时读取为空，拒绝写回' };
  const actualNames = candidate.entries.map(nameOf); const expectedNames = expected.map(nameOf);
  const duplicateEntries = [...new Set(actualNames.filter((name, index) => name && actualNames.indexOf(name) !== index))];
  const missingEntries = expectedNames.filter((name) => !actualNames.includes(name));
  const expectedByName = new Map(expected.map((entry) => [nameOf(entry), entry]));
  const userModified = candidate.entries.some((entry) => { const original = expectedByName.get(nameOf(entry)); return original ? fingerprint(entry) !== fingerprint(original) : false; });
  const common = { ...base, candidates: [candidate.name], mounted, entryCount: candidate.entries.length, missingEntries, duplicateEntries, userModified, canAttach: !mounted && capabilities.canAttach };
  if (duplicateEntries.length) return { ...common, status: 'duplicate-entries', canAttach: false, reason: '条目重名，已停止自动修改' };
  if (missingEntries.length) return { ...common, status: 'missing-entries', canRepairMissing: capabilities.canAppend, reason: capabilities.canAppend ? `缺少 ${missingEntries.length} 个种子条目，只允许补回缺失项` : `缺少 ${missingEntries.length} 个种子条目，但当前运行时缺少公开补缺能力` };
  if (userModified) return { ...common, status: 'user-modified', reason: '已检测到用户修改，保留现有正文' };
  return { ...common, status: mounted ? 'mounted' : 'installed-unmounted', reason: mounted ? '已安装并作为当前角色附属世界书挂载' : '已安装，尚未附属挂载' };
}
