import { parseBeautyRankData, type BeautyRankData, type BeautyRankEntry } from '../contract/appData';

/** Independent beauty-rank data. It deliberately has no MVU or stat_data dependency. */
export function parseIndependentBeautyRankData(value: unknown): BeautyRankData {
  const data = value && typeof value === 'object' && 'data' in value
    ? (value as { data?: unknown }).data
    : value;
  const parsed = parseBeautyRankData(data);
  return {
    ...parsed,
    entries: parsed.entries
      .map(normalizeBeautyRankEntry)
      .sort((left, right) => rankValue(left.rank) - rankValue(right.rank) || left.name.localeCompare(right.name, 'zh-CN')),
  };
}

function normalizeBeautyRankEntry(entry: BeautyRankEntry): BeautyRankEntry {
  return {
    ...entry,
    id: entry.id || `beauty:${entry.name}`,
    name: entry.name.trim(),
    title: entry.title.trim(),
    xianzi: entry.xianzi.trim(),
    qunfangpu: entry.qunfangpu.trim(),
  };
}

function rankValue(value: string): number {
  const digits: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const text = value.replace(/[第名]/g, '').trim();
  if (/^\d+$/.test(text)) return Number(text);
  if (text === '十') return 10;
  if (text.startsWith('十')) return 10 + (digits[text.slice(1)] ?? 0);
  if (text.endsWith('十')) return (digits[text[0]] ?? 0) * 10;
  if (text.includes('十')) return (digits[text[0]] ?? 0) * 10 + (digits[text[2]] ?? 0);
  return digits[text] ?? Number.MAX_SAFE_INTEGER;
}

export function createBeautyRankData(entries: BeautyRankEntry[] = []): BeautyRankData {
  return parseIndependentBeautyRankData({ entries, replies: [], source: 'daoyuan-beauty-api' });
}
