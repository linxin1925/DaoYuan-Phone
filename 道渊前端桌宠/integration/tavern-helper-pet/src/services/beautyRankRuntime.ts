import type { BeautyRankEntry } from '../contract/appData';
import { getBeautyRankCandidatePool, selectBeautyRankCandidates, type BeautyRankRealm } from './beautyRankCandidates';
import { DEFAULT_BEAUTY_RANK_PROMPT } from './beautyRankPrompt';
import { parseIndependentBeautyRankData } from './beautyRankService';

export interface BeautyRankApiSettings {
  apiBaseUrl: string;
  apiKey: string;
  apiModel: string;
  autoEnabled: boolean;
  autoInterval: number;
}

export interface BeautyRankLoreEntry {
  uid: string;
  name: string;
  content: string;
  keys: string[];
}

interface JsonPatchOperation {
  op?: unknown;
  path?: unknown;
  value?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  const record = asRecord(value);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message = asRecord(asRecord(choices[0]).message).content;
  if (typeof message === 'string') return message.trim();
  for (const key of ['text', 'content', 'response', 'message']) if (typeof record[key] === 'string') return String(record[key]).trim();
  return '';
}

function parsePatch(text: string): JsonPatchOperation[] {
  if (!/<(?:updatevariable|variableupdate)>[\s\S]*<\/(?:updatevariable|variableupdate)>/i.test(text)) throw new Error('AI 返回中缺少 <UpdateVariable> 块');
  const match = text.match(/<json_?patch>\s*([\s\S]*?)\s*<\/json_?patch>/i);
  if (!match) throw new Error('AI 返回中缺少 <JSONPatch> 块');
  const raw = match[1].replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('JSONPatch 不是合法 JSON'); }
  if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item !== 'object')) throw new Error('JSONPatch 必须是对象数组');
  return parsed as JsonPatchOperation[];
}

function normalizeEntry(name: string, value: unknown, current?: BeautyRankEntry): BeautyRankEntry {
  const row = asRecord(value);
  return {
    id: current?.id || `beauty:${name}`,
    name,
    rank: String(row.排名 ?? current?.rank ?? ''),
    title: String(row.头衔 ?? current?.title ?? ''),
    xianzi: String(row.仙姿 ?? current?.xianzi ?? ''),
    qunfangpu: String(row.群芳谱 ?? current?.qunfangpu ?? ''),
    portrait: current?.portrait,
    updatedAt: new Date().toISOString(),
  };
}

function countHan(value: string): number {
  return value.match(/[\p{Script=Han}]/gu)?.length ?? 0;
}

function assertGeneratedRow(name: string, value: unknown): void {
  const row = asRecord(value);
  const allowed = ['排名', '头衔', '仙姿', '群芳谱'];
  const keys = Object.keys(row);
  if (keys.length !== allowed.length || keys.some(key => !allowed.includes(key))) throw new Error(`${name}的字段必须且只能是排名、头衔、仙姿、群芳谱`);
  if (allowed.some(key => typeof row[key] !== 'string' || !String(row[key]).trim())) throw new Error(`${name}的四个榜单字段都必须是非空字符串`);
}

function validateGeneratedEntry(entry: BeautyRankEntry): void {
  if (!/^[一二三四五六七八九十百千]+$/.test(entry.rank)) throw new Error(`${entry.name}的排名必须是中文数字极简格式`);
  if (!entry.title) throw new Error(`${entry.name}缺少头衔`);
  if (countHan(entry.xianzi) < 80) throw new Error(`${entry.name}的仙姿不足80个汉字`);
  if (countHan(entry.qunfangpu) < 50) throw new Error(`${entry.name}的群芳谱不足50个汉字`);
}

function chineseRankValue(value: string): number {
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0;
  let digit = 0;
  for (const char of value) {
    if (char in digits) { digit = digits[char]; continue; }
    const unit = units[char];
    if (!unit) return Number.NaN;
    total += (digit || 1) * unit;
    digit = 0;
  }
  return total + digit;
}

function loreDirectlyMatches(entry: BeautyRankLoreEntry, candidate: string): boolean {
  return entry.name.includes(candidate) || entry.keys.some(key => key === candidate || key.includes(candidate));
}

function loreContains(entry: BeautyRankLoreEntry, candidate: string): boolean {
  return loreDirectlyMatches(entry, candidate) || entry.content.includes(candidate);
}

function resolveCandidateLore(
  realm: BeautyRankRealm,
  loreEntries: readonly BeautyRankLoreEntry[],
): { availableNames: Set<string>; entriesByName: Map<string, BeautyRankLoreEntry[]> } {
  const entriesByName = new Map<string, BeautyRankLoreEntry[]>();
  for (const candidate of getBeautyRankCandidatePool(realm)) {
    const direct = loreEntries.filter(entry => loreDirectlyMatches(entry, candidate));
    const matches = direct.length ? direct : loreEntries.filter(entry => loreContains(entry, candidate));
    if (matches.length) entriesByName.set(candidate, matches.slice(0, 3));
  }
  return { availableNames: new Set(entriesByName.keys()), entriesByName };
}

function formatCandidateLore(candidates: readonly string[], entriesByName: ReadonlyMap<string, BeautyRankLoreEntry[]>): string {
  let remaining = 24000;
  return candidates.map(candidate => {
    const entries = entriesByName.get(candidate) ?? [];
    const text = entries.map(entry => `【条目：${entry.name}｜关键词：${entry.keys.join('、') || '无'}】\n${entry.content}`).join('\n\n');
    const clipped = text.slice(0, Math.min(8000, remaining));
    remaining -= clipped.length;
    return `===== ${candidate}的世界书资料 =====\n${clipped}`;
  }).join('\n\n');
}

export function applyBeautyRankJsonPatch(
  current: BeautyRankEntry[],
  operations: JsonPatchOperation[],
  expectedNames: readonly string[],
): BeautyRankEntry[] {
  if (operations.length !== 1) throw new Error('绝色榜 JSONPatch 必须且只能包含一次整体替换');
  const operation = operations[0];
  if (operation.op !== 'replace' || operation.path !== '/绝色榜') throw new Error('绝色榜必须使用 replace 整体替换 /绝色榜');
  const value = asRecord(operation.value);
  const names = Object.keys(value);
  if (names.length !== 5) throw new Error('绝色榜完整新榜必须包含5位人物');
  if (names.length !== expectedNames.length || names.some(name => !expectedNames.includes(name))) {
    throw new Error('AI 返回人物与本次随机候选名单不一致');
  }
  const previous = new Map(current.map(entry => [entry.name, entry]));
  const entries = names.map(name => {
    assertGeneratedRow(name, value[name]);
    return normalizeEntry(name, value[name], previous.get(name));
  });
  entries.forEach(validateGeneratedEntry);
  if (new Set(entries.map(entry => entry.rank)).size !== entries.length) throw new Error('绝色榜人物排名不得重复');
  const rankValues = entries.map(entry => chineseRankValue(entry.rank)).sort((left, right) => left - right);
  if (rankValues.some(rank => !Number.isFinite(rank) || rank < 1 || rank > 100)) throw new Error('绝色榜排名必须位于一至一百名');
  if (rankValues[rankValues.length - 1] - rankValues[0] < 5) throw new Error('绝色榜排名过于集中，最高与最低名次至少相差5位');
  if (rankValues.every((rank, index) => index === 0 || rank - rankValues[index - 1] === 1)) throw new Error('绝色榜不得使用连续排名');
  return parseIndependentBeautyRankData({ entries, source: 'daoyuan-beauty-api' }).entries;
}

export function parseBeautyRankGeneration(text: string, current: BeautyRankEntry[], expectedNames: readonly string[]): BeautyRankEntry[] {
  return applyBeautyRankJsonPatch(current, parsePatch(text), expectedNames);
}

function endpoint(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  return normalized.endsWith('/chat/completions') ? normalized : `${normalized}/chat/completions`;
}

export async function generateBeautyRank(
  settings: BeautyRankApiSettings,
  current: BeautyRankEntry[],
  realm: BeautyRankRealm,
  loreEntries: readonly BeautyRankLoreEntry[],
): Promise<{ raw: string; entries: BeautyRankEntry[]; candidates: string[] }> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先填写绝色榜 API 基础 URL 和模型');
  const lore = resolveCandidateLore(realm, loreEntries);
  const desiredCount = 5;
  const candidates = selectBeautyRankCandidates(realm, current.map(entry => entry.name), desiredCount, Math.random, lore.availableNames);
  const candidateLore = formatCandidateLore(candidates, lore.entriesByName);
  const userPrompt = `【本次绝色榜独立生成任务】\n所在界域：${realm}\n原版随机占位符已抽取人物：${candidates.join('、')}\n\n【候选人物世界书资料】\n${candidateLore}\n\n请严格依据上述世界书资料，为以上${candidates.length}位且仅限以上人物生成完整新榜，并使用一次 replace 整体替换 /绝色榜。不要读取或假定任何聊天、剧情上下文。排名必须合理分散，禁止按候选顺序填写一、二、三或其他连续名次。`;
  const response = await fetch(endpoint(settings.apiBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({
      model: settings.apiModel.trim(),
      messages: [
        { role: 'system', content: DEFAULT_BEAUTY_RANK_PROMPT },
        { role: 'system', content: `【世界书资料，仅用于本次绝色榜人物身份校准】\n${candidateLore}` },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 7000,
    }),
  });
  if (!response.ok) throw new Error(`绝色榜 API 请求失败：${response.status} ${(await response.text()).slice(0, 200)}`);
  const raw = extractText(await response.json());
  if (!raw) throw new Error('绝色榜 API 返回为空');
  return { raw, entries: parseBeautyRankGeneration(raw, current, candidates), candidates };
}

export async function generateBeautyRankReply(
  settings: BeautyRankApiSettings,
  name: string,
  xianzi: string,
  qunfangpu: string,
  userReply: string,
  history: readonly string[],
): Promise<string> {
  if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('请先配置绝色榜 API 和模型');
  const injectContent = `[绝色榜人物]\n角色: ${name}\n仙姿: ${xianzi}\n\n[群芳谱原作]\n${qunfangpu}\n\n${history.length ? `[历史回帖记录]\n${history.map((item, index) => `#${index + 1}楼 匿名道友: ${item}`).join('\n')}\n\n` : ''}[上一条评论]\n匿名道友说: ${userReply}\n\n(你现在正在群芳谱论坛上，以匿名道友的身份参与讨论。群芳谱是修仙界坊间流传的绝色榜，众道友在此对各路上榜女修品头论足，言辞下流猥琐、毫无底线，尽是意淫挑衅之语。你必须互喷、抬杠或吐槽上一条评论，言辞下流猥琐，绝不可附和赞同。请直接输出你的回帖内容，必须贴合坊间泼皮流氓的语气，粗俗直白，100字以内。\n【绝对禁令】：除了你要说的回帖内容本身，禁止输出任何其他内容！禁止带角色署名，禁止加任何括号、标签或特殊符号，禁止分段换行！直接开口！)`;
  const response = await fetch(endpoint(settings.apiBaseUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
    body: JSON.stringify({ model: settings.apiModel.trim(), temperature: 0.85, max_tokens: 900, messages: [
      { role: 'system', content: injectContent },
      { role: 'user', content: userReply },
    ] }),
  });
  if (!response.ok) throw new Error(`回帖 API 请求失败：${response.status}`);
  const raw = extractText(await response.json()).replace(/^['"“”]+|['"“”]+$/g, '').trim();
  if (!raw) throw new Error('AI 回帖为空');
  return raw.slice(0, 4000);
}
