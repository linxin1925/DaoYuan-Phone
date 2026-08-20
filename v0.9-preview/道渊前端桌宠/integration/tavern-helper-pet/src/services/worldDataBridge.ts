import { getPortraitUrl } from './portraitService';
import { formatWorldLocation } from './locationFormat';

export interface WorldDataCapability {
  available: boolean;
  reason: 'mvu-ready' | 'mvu-missing' | 'not-probed';
}

export interface MvuReadRuntime {
  getMvuData?: (scope?: unknown) => unknown | Promise<unknown>;
  replaceMvuData?: (data: unknown, scope?: unknown) => unknown | Promise<unknown>;
  events?: { VARIABLE_INITIALIZED?: string; VARIABLE_UPDATE_STARTED?: string; VARIABLE_UPDATE_ENDED?: string };
}

export interface YujianMessageSnapshot {
  from: 'them' | 'me';
  text: string;
  time: string;
}

export interface InventoryItemSnapshot {
  name: string;
  quantity: number | null;
  description: string;
  category: string;
  status: string;
}

export type SpiritStoneGrade = '极品灵石' | '上品灵石' | '中品灵石' | '下品灵石';
export type SpiritStoneMode = 'auto' | 'legacy-bag' | 'combat-separate';
export interface SpiritStoneBalance {
  grade: SpiritStoneGrade;
  quantity: number;
  source: 'legacy-bag' | 'combat-separate' | 'unresolved';
  candidateKey?: string;
}
export interface SpiritStoneSnapshot {
  mode: SpiritStoneMode;
  balances: SpiritStoneBalance[];
  candidates: string[];
  warning?: string;
}

/** Read-only protagonist cultivation realm from stat_data.主角. */
export function projectProtagonistRealm(snapshot: unknown): string {
  const root = asRecord(snapshot);
  const statData = asRecord(root?.stat_data);
  const protagonist = asRecord(statData?.主角);
  return firstString(protagonist ?? {}, ['境界', '修为境界', '修为', 'realm'], '未知');
}

export interface WorldStatusSnapshot {
  time: string;
  location: string;
  energy: string;
}

export interface YujianContactSnapshot {
  name: string;
  portrait?: string;
  affection?: string;
  affectionLabel?: '好感度' | '亲密度';
  preview: string;
  time: string;
  detail: string;
  unread: number;
  history: YujianMessageSnapshot[];
}

export interface WorldDataSnapshot {
  available: boolean;
  contextRevision: number;
  data: unknown;
  reason: WorldDataCapability['reason'] | 'mvu-read-failed' | 'mvu-api-unavailable';
}

export interface ResolvedWorldDataSnapshot extends WorldDataSnapshot {
  messageId: string | number | null;
}

export interface WorldDataWriteResult extends Omit<ResolvedWorldDataSnapshot, 'reason'> {
  written: boolean;
  reason: WorldDataSnapshot['reason'] | 'mvu-write-api-unavailable' | 'invalid-stat-data' | 'mvu-write-failed' | 'mvu-write-not-persisted';
}

export function probeWorldDataCapability(runtime: MvuReadRuntime | undefined = (globalThis as { Mvu?: MvuReadRuntime }).Mvu): WorldDataCapability {
  const mvu = runtime;
  const hasMvu = typeof mvu?.getMvuData === 'function';
  return hasMvu ? { available: true, reason: 'mvu-ready' } : { available: false, reason: 'mvu-missing' };
}

/** 阶段 0/1 只提供能力探测，不暴露通用变量读取或任何 stat_data 写入。 */
export function getWorldDataCapability(runtime?: MvuReadRuntime): WorldDataCapability {
  return probeWorldDataCapability(runtime);
}

export async function readWorldDataSnapshot(
  runtime: MvuReadRuntime,
  contextRevision: number,
  messageId: string | number = 'latest',
): Promise<WorldDataSnapshot> {
  if (typeof runtime.getMvuData !== 'function') return { available: false, contextRevision, data: null, reason: 'mvu-api-unavailable' };
  try {
    return {
      available: true,
      contextRevision,
      data: await runtime.getMvuData({ type: 'message', message_id: messageId }),
      reason: 'mvu-ready',
    };
  } catch {
    return { available: false, contextRevision, data: null, reason: 'mvu-read-failed' };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Replace only stat_data on one explicit message floor. The surrounding MVU
 * envelope is re-read immediately before the write so initialized_lorebooks
 * and extension-owned fields are preserved.
 */
export async function replaceWorldStatData(
  runtime: MvuReadRuntime,
  contextRevision: number,
  messageId: string | number,
  statData: unknown,
): Promise<WorldDataWriteResult> {
  if (!isRecord(statData)) {
    return { available: false, written: false, contextRevision, messageId, data: null, reason: 'invalid-stat-data' };
  }
  if (typeof runtime.getMvuData !== 'function') {
    return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-api-unavailable' };
  }
  if (typeof runtime.replaceMvuData !== 'function') {
    return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-write-api-unavailable' };
  }
  const scope = { type: 'message', message_id: messageId };
  try {
    const latestEnvelope = await runtime.getMvuData(scope);
    if (!isRecord(latestEnvelope)) {
      return { available: false, written: false, contextRevision, messageId, data: latestEnvelope, reason: 'mvu-read-failed' };
    }
    const nextEnvelope = { ...latestEnvelope, stat_data: structuredClone(statData) };
    await runtime.replaceMvuData(nextEnvelope, scope);
    const persisted = await runtime.getMvuData(scope);
    const persistedStatData = isRecord(persisted) ? persisted.stat_data : undefined;
    const written = JSON.stringify(persistedStatData) === JSON.stringify(statData);
    return {
      available: true,
      written,
      contextRevision,
      messageId,
      data: persisted,
      reason: written ? 'mvu-ready' : 'mvu-write-not-persisted',
    };
  } catch {
    return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-write-failed' };
  }
}

/**
 * Re-read the target floor and derive the next stat_data from that latest
 * value. This prevents a merchant transaction from replacing unrelated MVU
 * updates with a stale snapshot captured by the UI.
 */
export async function mutateWorldStatData(
  runtime: MvuReadRuntime,
  contextRevision: number,
  messageId: string | number,
  mutate: (latestStatData: Record<string, unknown>) => Record<string, unknown>,
): Promise<WorldDataWriteResult> {
  if (typeof runtime.getMvuData !== 'function') return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-api-unavailable' };
  if (typeof runtime.replaceMvuData !== 'function') return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-write-api-unavailable' };
  const scope = { type: 'message', message_id: messageId };
  try {
    const latestEnvelope = await runtime.getMvuData(scope);
    const latestStatData = isRecord(latestEnvelope) && isRecord(latestEnvelope.stat_data) ? latestEnvelope.stat_data : null;
    if (!isRecord(latestEnvelope) || !latestStatData) return { available: false, written: false, contextRevision, messageId, data: latestEnvelope, reason: 'mvu-read-failed' };
    const nextStatData = mutate(structuredClone(latestStatData));
    if (!isRecord(nextStatData)) return { available: false, written: false, contextRevision, messageId, data: latestEnvelope, reason: 'invalid-stat-data' };
    const nextEnvelope = { ...latestEnvelope, stat_data: nextStatData };
    await runtime.replaceMvuData(nextEnvelope, scope);
    const persisted = await runtime.getMvuData(scope);
    const written = isRecord(persisted) && JSON.stringify(persisted.stat_data) === JSON.stringify(nextStatData);
    return { available: true, written, contextRevision, messageId, data: persisted, reason: written ? 'mvu-ready' : 'mvu-write-not-persisted' };
  } catch {
    return { available: false, written: false, contextRevision, messageId, data: null, reason: 'mvu-write-failed' };
  }
}

export function hasYujianWorldData(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const statData = (snapshot as { stat_data?: unknown }).stat_data;
  if (!statData || typeof statData !== 'object' || Array.isArray(statData)) return false;
  const yujian = (statData as { 玉简?: unknown }).玉简;
  return Boolean(yujian && typeof yujian === 'object' && !Array.isArray(yujian));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim();
  }
  return fallback;
}

function valueText(record: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

const SPIRIT_STONE_GRADES: readonly SpiritStoneGrade[] = ['极品灵石', '上品灵石', '中品灵石', '下品灵石'];

function normalizeCandidateKey(value: string): string {
  return value.replace(/[\s_\-·．。:：]/g, '').toLocaleLowerCase();
}

function matchesSpiritStoneGrade(key: string, grade: SpiritStoneGrade): boolean {
  const normalized = normalizeCandidateKey(key);
  const gradeToken = grade.slice(0, 2);
  return normalized === normalizeCandidateKey(grade)
    || normalized === normalizeCandidateKey(`${grade}数量`)
    || normalized === normalizeCandidateKey(gradeToken)
    || normalized === normalizeCandidateKey(`${gradeToken}灵石`)
    || normalized === normalizeCandidateKey(`${gradeToken}灵石数量`);
}

function quantityFromCandidate(value: unknown): number | null {
  const direct = numberOrNull(value);
  if (direct !== null) return Math.max(0, Math.floor(direct));
  const record = asRecord(value);
  if (!record) return null;
  return numberOrNull(record.数量 ?? record.quantity ?? record.数量值);
}

/** Read-only recognition for the two known card layouts; never rewrites or renames keys. */
export function projectSpiritStones(snapshot: unknown, requestedMode: SpiritStoneMode = 'auto'): SpiritStoneSnapshot {
  const root = asRecord(snapshot);
  const statData = asRecord(root?.stat_data);
  const protagonist = asRecord(statData?.主角);
  const bag = asRecord(protagonist?.储物袋);
  const candidates = bag ? Object.keys(bag).filter(key => /灵石|灵石数量/.test(key)) : [];
  const hasSeparate = SPIRIT_STONE_GRADES.some(grade => quantityFromCandidate(protagonist?.[grade]) !== null);
  const mode: SpiritStoneMode = requestedMode === 'auto'
    ? (hasSeparate ? 'combat-separate' : candidates.length ? 'legacy-bag' : 'auto')
    : requestedMode;
  const balances = SPIRIT_STONE_GRADES.map(grade => {
    if (mode === 'combat-separate') {
      const quantity = quantityFromCandidate(protagonist?.[grade]);
      return { grade, quantity: quantity ?? 0, source: quantity === null ? 'unresolved' : 'combat-separate' } as SpiritStoneBalance;
    }
    const key = candidates.find(candidate => matchesSpiritStoneGrade(candidate, grade));
    const quantity = key ? quantityFromCandidate(bag?.[key]) : null;
    return { grade, quantity: quantity ?? 0, source: quantity === null ? 'unresolved' : 'legacy-bag', ...(key ? { candidateKey: key } : {}) } as SpiritStoneBalance;
  });
  const unresolved = balances.filter(balance => balance.source === 'unresolved').length;
  return {
    mode,
    balances,
    candidates,
    warning: unresolved ? `有 ${unresolved} 档灵石未找到明确候选，已按 0 显示；不会修改原始变量。` : undefined,
  };
}

/** Project the read-only MVU field stat_data.主角.储物袋 for the UI. */
export function projectInventory(snapshot: unknown): InventoryItemSnapshot[] {
  const root = asRecord(snapshot);
  const statData = asRecord(root?.stat_data);
  const protagonist = asRecord(statData?.主角);
  const bag = protagonist?.储物袋;
  const entries: Array<[string, unknown]> = Array.isArray(bag)
    ? bag.map((value, index) => [String(index + 1), value])
    : Object.entries(asRecord(bag) ?? {});

  return entries.flatMap(([name, value]) => {
    const record = asRecord(value);
    if (!record) {
      const quantity = numberOrNull(value);
      return [{ name, quantity, description: '', category: '', status: '' }];
    }
    return [{
      name,
      quantity: numberOrNull(record.数量 ?? record.quantity),
      description: firstString(record, ['描述', '描述/效果', 'description']),
      category: firstString(record, ['类别', 'category']),
      status: firstString(record, ['当前状态', '物品当前状态', 'current_status', 'status']),
    }];
  });
}

/** Project the read-only world status used by the shell header and map. */
export function projectWorldStatus(snapshot: unknown): WorldStatusSnapshot {
  const root = asRecord(snapshot);
  const statData = asRecord(root?.stat_data);
  const world = asRecord(statData?.世界);
  const protagonist = asRecord(statData?.主角);
  return {
    time: firstString(world ?? {}, ['当前时间', 'cur_time'], '未接入'),
    location: formatWorldLocation(firstString(world ?? {}, ['当前地点', 'current_location'], '未接入')),
    energy: valueText(protagonist ?? {}, ['灵力', 'mana'], '未知'),
  };
}

/**
 * MVU 数据属于消息楼层，页面刷新后的最新楼层不一定携带 stat_data。
 * 从当前末楼向前寻找最近一个真正包含玉简数据的楼层，使读写始终绑定同一 scope。
 */
export async function resolveYujianWorldDataSnapshot(
  runtime: MvuReadRuntime,
  contextRevision: number,
  preferredMessageId: string | number = 'latest',
): Promise<ResolvedWorldDataSnapshot> {
  const preferred = await readWorldDataSnapshot(runtime, contextRevision, preferredMessageId);
  if (!preferred.available || hasYujianWorldData(preferred.data)) {
    return { ...preferred, messageId: preferred.available ? preferredMessageId : null };
  }

  const numericId = typeof preferredMessageId === 'number'
    ? preferredMessageId
    : /^\d+$/.test(preferredMessageId) ? Number(preferredMessageId) : null;
  if (numericId === null) return { ...preferred, messageId: null };

  for (let messageId = numericId - 1; messageId >= 0; messageId -= 1) {
    const candidate = await readWorldDataSnapshot(runtime, contextRevision, messageId);
    if (candidate.available && hasYujianWorldData(candidate.data)) return { ...candidate, messageId };
    // Avoid monopolising the UI thread in unusually long chats.
    if (messageId % 50 === 0) await Promise.resolve();
  }
  return { ...preferred, messageId: null };
}

function isPlayerSender(sender: unknown): boolean {
  if (typeof sender !== 'string') return false;
  return /^(主角|玩家|我|自己|你)$/.test(sender.trim());
}

export function projectYujianContacts(snapshot: unknown): YujianContactSnapshot[] {
  const statData = snapshot && typeof snapshot === 'object' ? (snapshot as { stat_data?: unknown }).stat_data : undefined;
  const yujian = statData && typeof statData === 'object' ? (statData as { 玉简?: unknown }).玉简 : undefined;
  if (!yujian || typeof yujian !== 'object' || Array.isArray(yujian)) return [];
  return Object.entries(yujian).flatMap(([name, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const record = value as { 性别?: unknown; 关系?: unknown; 境界?: unknown; 历史记录?: unknown };
    const history = record.历史记录 && typeof record.历史记录 === 'object' && !Array.isArray(record.历史记录)
      ? Object.values(record.历史记录 as Record<string, unknown>).flatMap((entry): YujianMessageSnapshot[] => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const item = entry as { 发送者?: unknown; 内容?: unknown; 时间?: unknown };
        if (typeof item.内容 !== 'string') return [];
        return [{
          from: isPlayerSender(item.发送者) ? 'me' : 'them',
          text: item.内容,
          time: typeof item.时间 === 'string' ? item.时间 : '未知时间',
        }];
      })
      : [];
    const last = history.at(-1);
    const relation = typeof record.关系 === 'string' ? record.关系 : '';
    const realm = typeof record.境界 === 'string' ? record.境界 : '';
    return [{
      name,
      portrait: getPortraitUrl(name, typeof record.性别 === 'string' ? record.性别 : undefined) || undefined,
      preview: last?.text ?? '暂无最近传讯',
      time: last?.time ?? '未知时间',
      detail: [relation, realm].filter(Boolean).join(' · ') || '状态栏玉简联系人',
      unread: 0,
      history,
    }];
  });
}

export function projectNpcContacts(
  snapshot: unknown,
  histories: Record<string, YujianMessageSnapshot[]> = {},
): YujianContactSnapshot[] {
  const statData = snapshot && typeof snapshot === 'object' ? (snapshot as { stat_data?: unknown }).stat_data : undefined;
  if (!statData || typeof statData !== 'object' || Array.isArray(statData)) return [];
  const root = statData as Record<string, unknown>;
  // “所有联系人”只表示当前剧情已建档、主角确实认识的人物；
  // 立绘库只是图片资源，不能作为人物相识关系的依据。
  const contacts = new Map<string, Record<string, unknown>>();
  for (const groupName of ['人物', '道侣']) {
    const group = root[groupName];
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    for (const [name, value] of Object.entries(group)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        contacts.set(name, { ...(contacts.get(name) ?? {}), ...value as Record<string, unknown> });
      }
    }
  }
  return [...contacts.entries()].map(([name, record]) => {
    const history = Array.isArray(histories[name]) ? histories[name] : [];
    const last = history.at(-1);
    const relation = typeof record.关系阶段 === 'string' ? record.关系阶段 : typeof record.关系 === 'string' ? record.关系 : '';
    const realm = typeof record.境界 === 'string' ? record.境界 : '';
    const partnerGroup = root.道侣 && typeof root.道侣 === 'object' && !Array.isArray(root.道侣)
      ? root.道侣 as Record<string, unknown>
      : {};
    const isPartner = Boolean(partnerGroup[name]);
    // 道渊真实结构：人物使用“好感”，道侣使用“亲密”。
    const affectionValue = isPartner
      ? record.亲密 ?? record.亲密度
      : record.好感 ?? record.好感度;
    const affection = typeof affectionValue === 'number' || typeof affectionValue === 'string'
      ? `${isPartner ? '亲密' : '好感'} ${String(affectionValue)}`
      : '';
    return {
      name,
      portrait: getPortraitUrl(name, typeof record.性别 === 'string' ? record.性别 : undefined) || undefined,
      affection: affection ? String(affectionValue) : undefined,
      affectionLabel: affection ? (isPartner ? '亲密度' : '好感度') : undefined,
      preview: last?.text ?? '尚未开始传讯',
      time: last?.time ?? '',
      detail: [affection, relation, realm].filter(Boolean).join(' · ') || 'NPC 联系人',
      unread: 0,
      history,
    };
  });
}

/** 只读取状态栏玉简的好感度，不读取联系人名单或历史记录。 */
export function projectYujianAffections(snapshot: unknown): Record<string, string> {
  const statData = snapshot && typeof snapshot === 'object' ? (snapshot as { stat_data?: unknown }).stat_data : undefined;
  const yujian = statData && typeof statData === 'object' && !Array.isArray(statData)
    ? (statData as { 玉简?: unknown }).玉简
    : undefined;
  if (!yujian || typeof yujian !== 'object' || Array.isArray(yujian)) return {};
  return Object.fromEntries(Object.entries(yujian).flatMap(([name, raw]) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const value = (raw as { 好感度?: unknown }).好感度;
    return typeof value === 'number' || (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value)))
      ? [[name, String(value)]]
      : [];
  }));
}
