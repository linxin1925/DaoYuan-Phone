import { extractGeneratedText } from './yujianRuntime';
import { extractOpenAIText, fetchAuto } from './openaiProtocol';
import { isArtifactCategory, isTechniqueCategory, normalizeArtifactType } from './merchantCore';

export interface MerchantProduct {
  id: string;
  name: string;
  category: string;
  grade: string;
  description: string;
  priceGrade: '极品灵石' | '上品灵石' | '中品灵石' | '下品灵石';
  price: number;
  stock: number;
  createdAt: string;
  itemDataMode?: 'legacy' | 'combat';
  /** 战斗版只保存世界书规定的定性战力来源；五维数值由战斗脚本独占计算。 */
  战斗属性?: MerchantCombatData;
}

export interface MerchantCombatData {
  类型?: string;
  本源?: string;
  品阶?: '凡阶' | '黄阶' | '玄阶' | '地阶' | '天阶';
  效果类型?: string;
  主维?: '攻伐' | '御守' | '遁速' | '神魂' | '灵压';
  辅维?: Array<'攻伐' | '御守' | '遁速' | '神魂' | '灵压'>;
  时效?: string;
  触发?: string;
  熟练度?: number;
  境界?: string;
  等级?: string;
  祭炼度?: number;
  损耗度?: number;
  状态?: string;
  特效?: string;
  描述?: string;
  技能?: Record<string, { 类型: '攻击' | '防御' | '辅助'; 描述: string }>;
}

export interface MerchantSettings { batchSize: number; maxItems: number; refreshInterval: number; itemDataMode: 'legacy' | 'combat'; minRealm?: string; }
export interface MerchantApiSettings { enabled: boolean; transactionInjectionEnabled: boolean; apiBaseUrl: string; apiKey: string; apiModel: string; }
export interface MerchantQuote { itemId: string; fingerprint: string; priceGrade: MerchantProduct['priceGrade']; price: number; reason: string; quotedAt: string; }
export interface MerchantSellItem { id: string; name: string; category: '储物袋' | '器物'; quantity: number; description: string; quote?: MerchantQuote; }

const STORAGE_KEY = 'daoyuan_wanbao_runtime_v1';
const QUOTE_STORAGE_KEY = 'daoyuan_wanbao_quotes_v1';
const DEBUG_LOG_KEY = 'daoyuan_wanbao_debug_logs_v1';
export const XUANTIAN_REALMS = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'] as const;
function realmIndex(value: string | undefined): number { const text = String(value ?? ''); return XUANTIAN_REALMS.findIndex(realm => text.includes(realm)); }
const WORLD_BOOK_PRICE_GUIDE = `【战斗版世界书灵石与物价】\n灵石品级：下品、中品、上品、极品；100下品=1中品，100中品=1上品，100上品=1极品；仙石只属于仙界，玄天界货单禁止生成仙石。\n丹药：炼气5-20下品/瓶；筑基1-5中品/瓶；金丹10-50中品/瓶；元婴1-5上品/瓶；化神10-50上品/瓶；炼虚100-500上品/瓶；合体10-50极品/瓶；大乘100-500极品/瓶。\n符箓：炼气5-15下品/张；筑基1-5中品/张；金丹10-50中品/张；元婴1-5上品/张；化神10-50上品/张；炼虚100-500上品/张；合体10-50极品/张；大乘100-500极品/张。\n阵盘：炼气30-50下品/套；筑基3-8中品/套；金丹50-150中品/套；元婴5-15上品/套；化神50-150上品/套；炼虚500-1500上品/套；合体50-150极品/套；大乘1000-5000极品/套。\n器物价格带（严格按境界）：炼气10-800下品；筑基10-80中品；金丹100-800中品；元婴10-100上品；化神30-300上品；炼虚100-1000上品；合体100-800极品；大乘1000-10000极品。\n功法秘籍：凡阶/黄阶10-500下品；玄阶500-2000中品；地阶10-50极品；天阶属于传说级资源，不生成固定低价。灵材药植：百年份20-50下品；千年份10-30中品；万年辅药10-50上品。\n禁止渡劫、真仙及以上仙界商品；价格必须遵守上述品类与境界。`;
type XuantianRealm = typeof XUANTIAN_REALMS[number];

const PRICE_BANDS: Record<XuantianRealm, Record<'丹药' | '符箓' | '阵盘' | '器物' | '材料', { grade: MerchantProduct['priceGrade']; min: number; max: number }>> = {
  炼气: { 丹药:{grade:'下品灵石',min:5,max:20}, 符箓:{grade:'下品灵石',min:5,max:15}, 阵盘:{grade:'下品灵石',min:30,max:50}, 器物:{grade:'下品灵石',min:10,max:800}, 材料:{grade:'下品灵石',min:5,max:50} },
  筑基: { 丹药:{grade:'中品灵石',min:1,max:5}, 符箓:{grade:'中品灵石',min:1,max:5}, 阵盘:{grade:'中品灵石',min:3,max:8}, 器物:{grade:'中品灵石',min:10,max:80}, 材料:{grade:'中品灵石',min:1,max:30} },
  金丹: { 丹药:{grade:'中品灵石',min:10,max:50}, 符箓:{grade:'中品灵石',min:10,max:50}, 阵盘:{grade:'中品灵石',min:50,max:150}, 器物:{grade:'中品灵石',min:100,max:800}, 材料:{grade:'中品灵石',min:10,max:100} },
  元婴: { 丹药:{grade:'上品灵石',min:1,max:5}, 符箓:{grade:'上品灵石',min:1,max:5}, 阵盘:{grade:'上品灵石',min:5,max:15}, 器物:{grade:'上品灵石',min:10,max:100}, 材料:{grade:'上品灵石',min:1,max:30} },
  化神: { 丹药:{grade:'上品灵石',min:10,max:50}, 符箓:{grade:'上品灵石',min:10,max:50}, 阵盘:{grade:'上品灵石',min:50,max:150}, 器物:{grade:'上品灵石',min:30,max:300}, 材料:{grade:'上品灵石',min:10,max:100} },
  炼虚: { 丹药:{grade:'上品灵石',min:100,max:500}, 符箓:{grade:'上品灵石',min:100,max:500}, 阵盘:{grade:'上品灵石',min:500,max:1500}, 器物:{grade:'上品灵石',min:100,max:1000}, 材料:{grade:'上品灵石',min:50,max:500} },
  合体: { 丹药:{grade:'极品灵石',min:10,max:50}, 符箓:{grade:'极品灵石',min:10,max:50}, 阵盘:{grade:'极品灵石',min:50,max:150}, 器物:{grade:'极品灵石',min:100,max:800}, 材料:{grade:'极品灵石',min:10,max:100} },
  大乘: { 丹药:{grade:'极品灵石',min:100,max:500}, 符箓:{grade:'极品灵石',min:100,max:500}, 阵盘:{grade:'极品灵石',min:1000,max:5000}, 器物:{grade:'极品灵石',min:1000,max:10000}, 材料:{grade:'极品灵石',min:100,max:1000} },
};

function appendMerchantDebugLog(entry: Record<string, unknown>): void {
  const record = { at: new Date().toISOString(), ...entry };
  try {
    const storage = typeof localStorage !== 'undefined' ? localStorage : null;
    const previous = storage ? JSON.parse(storage.getItem(DEBUG_LOG_KEY) || '[]') : [];
    const rows = Array.isArray(previous) ? previous : [];
    rows.push(record);
    storage?.setItem(DEBUG_LOG_KEY, JSON.stringify(rows.slice(-40)));
  } catch { /* diagnostics must never break generation */ }
  try { console.warn(`[万宝商行][诊断] ${JSON.stringify(record)}`); } catch { /* optional console */ }
}

export function readMerchantDebugLogs(hostWindow: Window): Record<string, unknown>[] {
  try {
    const rows = JSON.parse(hostWindow.localStorage.getItem(DEBUG_LOG_KEY) || '[]');
    return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
  } catch { return []; }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function number(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim().replace(/[，,]/g, '').match(/-?\d+(?:\.\d+)?/)?.[0] ?? '') : NaN;
  return Number.isFinite(result) ? result : fallback;
}

function safeId(name: string): string {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) hash = Math.imul(hash ^ name.charCodeAt(index), 16777619);
  return `wanbao-${(hash >>> 0).toString(36)}-${Date.now().toString(36)}`;
}

function realmOf(grade: string): XuantianRealm | null {
  return XUANTIAN_REALMS.find(realm => grade.includes(realm)) ?? null;
}

function priceKind(category: string): keyof (typeof PRICE_BANDS)['炼气'] {
  if (category.includes('丹药')) return '丹药';
  if (category.includes('符')) return '符箓';
  if (category.includes('阵盘')) return '阵盘';
  if (category.includes('器物') || category.includes('法器') || category.includes('法宝')) return '器物';
  return '材料';
}

export function validateMerchantWorldbookPrice(product: Pick<MerchantProduct, 'category' | 'grade' | 'priceGrade' | 'price'>): boolean {
  const realm = realmOf(product.grade);
  if (!realm || /渡劫|仙境|真仙|仙阶/.test(product.grade)) return false;
  if (/功法|心法|武技|秘术/.test(product.category)) {
    if (/天阶/.test(product.grade)) return false;
    if (/玄阶/.test(product.grade)) return product.priceGrade === '中品灵石' && product.price >= 500 && product.price <= 2000;
    if (/地阶/.test(product.grade)) return product.priceGrade === '极品灵石' && product.price >= 10 && product.price <= 50;
    return ['下品灵石'].includes(product.priceGrade) && product.price >= 10 && product.price <= 500;
  }
  const band = PRICE_BANDS[realm][priceKind(product.category)];
  return product.priceGrade === band.grade && product.price >= band.min && product.price <= band.max;
}

export function readMerchantProducts(hostWindow: Window, chatId: string): MerchantProduct[] {
  try {
    const root = JSON.parse(hostWindow.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>;
    const rows = root[chatId];
    return Array.isArray(rows) ? rows.filter(item => asRecord(item)?.name && asRecord(item)?.priceGrade).map(item => {
      const row = asRecord(item)!;
      return {
        id: typeof row.id === 'string' ? row.id : safeId(String(row.name)), name: String(row.name), category: String(row.category || '器物'), grade: String(row.grade || '黄阶下品'), description: String(row.description || ''),
        priceGrade: ['极品灵石', '上品灵石', '中品灵石', '下品灵石'].includes(String(row.priceGrade)) ? row.priceGrade as MerchantProduct['priceGrade'] : '中品灵石', price: Math.max(1, Math.floor(number(row.price, 1))), stock: Math.max(0, Math.floor(number(row.stock, 1))), createdAt: String(row.createdAt || new Date().toISOString()), itemDataMode: row.itemDataMode === 'combat' ? 'combat' as const : 'legacy' as const, 战斗属性: row.itemDataMode === 'combat' ? normalizeCombatData(row, String(row.category || '')) : undefined,
      };
    }).filter(product => product.itemDataMode !== 'combat' || (!isArtifactCategory(product.category) && !isTechniqueCategory(product.category)) || Boolean(product.战斗属性)).filter(validateMerchantWorldbookPrice) : [];
  } catch { return []; }
}

export function writeMerchantProducts(hostWindow: Window, chatId: string, products: MerchantProduct[]): void {
  try {
    const root = JSON.parse(hostWindow.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, unknown>;
    root[chatId] = products;
    hostWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  } catch { /* local persistence is optional; UI remains usable */ }
}

export function merchantItemFingerprint(item: Pick<MerchantSellItem, 'id' | 'name' | 'category' | 'description'>): string {
  return JSON.stringify([item.id, item.name, item.category, item.description]);
}

export function readMerchantQuotes(hostWindow: Window, chatId: string): Record<string, MerchantQuote> {
  try {
    const root = JSON.parse(hostWindow.localStorage.getItem(QUOTE_STORAGE_KEY) || '{}') as Record<string, unknown>;
    const rows = asRecord(root[chatId]) ?? {};
    return Object.fromEntries(Object.entries(rows).flatMap(([id, value]) => {
      const row = asRecord(value); const grade = String(row?.priceGrade ?? ''); const price = Math.floor(number(row?.price));
      if (!row || !['极品灵石','上品灵石','中品灵石','下品灵石'].includes(grade) || price < 1) return [];
      return [[id, { itemId:id, fingerprint:String(row.fingerprint ?? ''), priceGrade:grade as MerchantProduct['priceGrade'], price, reason:String(row.reason ?? ''), quotedAt:String(row.quotedAt ?? '') }]];
    }));
  } catch { return {}; }
}

export function writeMerchantQuotes(hostWindow: Window, chatId: string, quotes: Record<string, MerchantQuote>): void {
  try { const root = JSON.parse(hostWindow.localStorage.getItem(QUOTE_STORAGE_KEY) || '{}') as Record<string, unknown>; root[chatId] = quotes; hostWindow.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(root)); } catch { /* optional local persistence */ }
}

function parseRows(raw: string): unknown[] {
  // 酒馆模型有时会在 JSON 外包解释文字、代码围栏、content 数组，或再套一层 JSON 字符串。
  // 这里只负责“找出候选行”，字段和世界书价格校验仍由 normalizeProducts 完成。
  const text = String(raw ?? '').trim();
  const candidates = new Set<string>([text, text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()]);
  const addBalanced = (open: string, close: string): void => {
    let start = text.indexOf(open);
    while (start >= 0) {
      let depth = 0; let inString = false; let escaped = false;
      for (let index = start; index < text.length; index += 1) {
        const char = text[index];
        if (inString) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') inString = false; continue; }
        if (char === '"') { inString = true; continue; }
        if (char === open) depth += 1;
        else if (char === close && --depth === 0) { candidates.add(text.slice(start, index + 1)); break; }
      }
      start = text.indexOf(open, start + 1);
    }
  };
  addBalanced('{', '}'); addBalanced('[', ']');
  const unwrap = (value: unknown, depth = 0): unknown[] => {
    if (depth > 5) return [];
    if (typeof value === 'string') {
      const nested = parseRows(value);
      return nested.length ? nested : [];
    }
    if (Array.isArray(value)) return value;
    const record = asRecord(value);
    if (!record) return [];
    for (const key of ['items', 'products', 'data', 'result', '货品', '货品列表', '商品', '商品列表']) {
      const child = record[key];
      if (Array.isArray(child)) return child;
      const nested = unwrap(child, depth + 1);
      if (nested.length) return nested;
    }
    return [];
  };
  for (const candidate of candidates) {
    try { const rows = unwrap(JSON.parse(candidate)); if (rows.length) return rows; } catch { /* try next candidate */ }
  }
  return [];
}

const PRICE_GRADES: MerchantProduct['priceGrade'][] = ['极品灵石', '上品灵石', '中品灵石', '下品灵石'];
const COMBAT_DIMENSIONS = ['攻伐', '御守', '遁速', '神魂', '灵压'] as const;
const COMBAT_GRADES = ['凡阶', '黄阶', '玄阶', '地阶', '天阶'] as const;
const TECHNIQUE_EFFECT_TYPES = ['强攻杀伐', '防御守护', '身法遁术', '神魂秘术', '辅助领域'] as const;

function techniqueSkillCountRange(grade: typeof COMBAT_GRADES[number]): readonly [number, number] {
  if (grade === '凡阶') return [1, 1];
  if (grade === '黄阶') return [1, 2];
  if (grade === '玄阶') return [2, 2];
  if (grade === '地阶') return [2, 3];
  return [3, 3];
}

function readField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
  return undefined;
}

function normalizePriceGrade(value: unknown): MerchantProduct['priceGrade'] {
  const text = String(value ?? '').trim();
  const grade = PRICE_GRADES.find(item => text === item || text === item.replace('灵石', '') || text.includes(item) || text.includes(item.replace('灵石', '')));
  return grade ?? '中品灵石';
}

function normalizeCombatData(row: Record<string, unknown>, category: string): MerchantCombatData | undefined {
  const source = asRecord(readField(row, '战斗属性', 'combatData', 'combat')) ?? row;
  const rawGrade = String(readField(source, '品阶', 'combatGrade') ?? '').trim();
  const grade = COMBAT_GRADES.find(value => rawGrade === value || rawGrade.startsWith(value)) ?? '';
  const mainDimension = String(readField(source, '主维', '主维度') ?? '').trim();
  const auxiliary = readField(source, '辅维', '辅维度');
  const auxList = Array.isArray(auxiliary) ? auxiliary.map(String).filter(value => COMBAT_DIMENSIONS.includes(value as typeof COMBAT_DIMENSIONS[number])).slice(0, 2) as MerchantCombatData['辅维'] : [];
  const rawSkills = readField(source, '技能', 'skills', 'skill');
  const skills: NonNullable<MerchantCombatData['技能']> = {};
  const addSkill = (nameValue: unknown, value: unknown): void => {
    const name = String(nameValue ?? '').trim();
    const skill = asRecord(value);
    if (!name || !skill) return;
    const type = String(readField(skill, '类型', 'type') ?? '辅助');
    skills[name.slice(0, 40)] = {
      类型: type === '攻击' || type === '防御' ? type : '辅助',
      描述: String(readField(skill, '描述', 'description') ?? '').trim().slice(0, 240),
    };
  };
  if (rawSkills && typeof rawSkills === 'object' && !Array.isArray(rawSkills)) {
    for (const [name, value] of Object.entries(rawSkills as Record<string, unknown>)) addSkill(name, value);
  } else if (Array.isArray(rawSkills)) {
    for (const value of rawSkills) {
      const skill = asRecord(value);
      addSkill(readField(skill ?? {}, '技能名', '名称', 'name'), value);
    }
  }
  const data: MerchantCombatData = {
    类型: isArtifactCategory(category)
      ? normalizeArtifactType(readField(source, '类型', 'itemType'))
      : String(readField(source, '类型', 'itemType') ?? '').trim() || undefined,
    本源: String(readField(source, '本源', 'source') ?? '').trim() || undefined,
    品阶: COMBAT_GRADES.includes(grade as typeof COMBAT_GRADES[number]) ? grade as MerchantCombatData['品阶'] : undefined,
    效果类型: String(readField(source, '效果类型', 'effectType') ?? '').trim() || undefined,
    主维: COMBAT_DIMENSIONS.includes(mainDimension as typeof COMBAT_DIMENSIONS[number]) ? mainDimension as MerchantCombatData['主维'] : undefined,
    辅维: auxList,
    时效: String(readField(source, '时效', 'duration') ?? '').trim() || undefined,
    触发: String(readField(source, '触发', 'trigger') ?? '').trim() || undefined,
    熟练度: Number.isFinite(number(readField(source, '熟练度', 'mastery'), NaN)) ? Math.max(0, Math.min(100, Math.floor(number(readField(source, '熟练度', 'mastery'))))) : undefined,
    境界: String(readField(source, '境界', 'realm') ?? '').trim() || undefined,
    等级: String(readField(source, '等级', 'level') ?? '').trim() || undefined,
    祭炼度: Number.isFinite(number(readField(source, '祭炼度', 'refinement'), NaN)) ? Math.max(0, Math.min(100, Math.floor(number(readField(source, '祭炼度', 'refinement'))))) : undefined,
    损耗度: Number.isFinite(number(readField(source, '损耗度', 'damage'), NaN)) ? Math.max(0, Math.min(100, Math.floor(number(readField(source, '损耗度', 'damage'))))) : undefined,
    状态: (() => {
      const value = String(readField(source, '状态', 'status') ?? '').trim();
      if (/^(完好|正常)$/u.test(value)) return '正常';
      if (value === '可用') return '可用';
      return value || undefined;
    })(),
    特效: String(readField(source, '特效', 'specialEffect') ?? '').trim() || undefined,
    描述: String(readField(source, '描述', 'description') ?? '').trim() || undefined,
    技能: Object.keys(skills).length ? skills : undefined,
  };
  const isArtifact = isArtifactCategory(category);
  const isTechnique = isTechniqueCategory(category);
  if (isArtifact) {
    if (!data.等级 || !data.类型 || !data.本源 || !data.品阶 || !data.主维 || data.祭炼度 === undefined || data.损耗度 === undefined || !data.特效 || (data.状态 !== '正常' && data.状态 !== '可用')) return undefined;
  } else if (isTechnique) {
    if (!data.类型 || !data.本源 || !data.品阶 || !data.效果类型 || !TECHNIQUE_EFFECT_TYPES.includes(data.效果类型 as typeof TECHNIQUE_EFFECT_TYPES[number]) || !data.主维 || !data.技能) return undefined;
  } else {
    // 丹药、材料、符箓、阵盘、储物袋等不是战斗来源，不要求五维/战斗属性。
    return undefined;
  }
  if (isTechnique) {
    if (!data.技能) return undefined;
    const [minimum, maximum] = techniqueSkillCountRange(grade as typeof COMBAT_GRADES[number]);
    const skillCount = Object.keys(data.技能).length;
    if (!COMBAT_GRADES.includes(grade as typeof COMBAT_GRADES[number]) || skillCount < minimum || skillCount > maximum) return undefined;
  }
  return data;
}

function normalizeProducts(raw: string, settings: MerchantSettings, requireRealmCoverage = true): MerchantProduct[] {
  const now = new Date().toISOString();
  // 不要先截前 N 条：模型偶尔会把说明/无效占位项放在前面，先过滤再截取才能得到真实货品。
  const products = parseRows(raw).flatMap(item => {
    const row = asRecord(item); if (!row) return [];
    const name = String(readField(row, 'name', '物品名', '名称') ?? '').trim();
    const description = String(readField(row, 'description', '描述', '说明', '效果') ?? '').trim();
    if (!name || !description) return [];
    const category = String(readField(row, 'category', '类别', '类型') ?? '器物').trim().slice(0, 30);
    const gradeName = String(readField(row, 'grade', '品阶', '品级') ?? '黄阶下品').trim();
    const declaredRealm = String(readField(row, 'realm', '境界') ?? '').trim().replace(/境界?$/, '');
    // realm 是提示词要求的结构化字段；若模型漏写，则从同一条 grade 的合法境界前缀回读，避免格式漏项吞掉整件商品。
    const realm = (XUANTIAN_REALMS.includes(declaredRealm as XuantianRealm) ? declaredRealm : XUANTIAN_REALMS.find(value => gradeName.includes(value))) ?? '';
    if (!realm) return [];
    const minimumRealmIndex = realmIndex(settings.minRealm);
    if (minimumRealmIndex >= 0 && realmIndex(realm) < minimumRealmIndex) return [];
    const grade = (realm && !gradeName.includes(realm) ? `${realm}境·${gradeName}` : gradeName) || '炼气境·黄阶下品';
    const priceValue = readField(row, 'price', '售价', '价格');
    const priceGrade = normalizePriceGrade(readField(row, 'priceGrade', '价格品级', '灵石品级', 'price_grade') ?? priceValue);
    const normalizedPrice = Math.max(1, Math.min(999999999, Math.floor(number(priceValue, 1))));
    const combatBearing = isArtifactCategory(category) || isTechniqueCategory(category);
    const 战斗属性 = settings.itemDataMode === 'combat' && combatBearing ? normalizeCombatData(row, category) : undefined;
    if (settings.itemDataMode === 'combat' && combatBearing && (!战斗属性 || !COMBAT_GRADES.some(value => gradeName.includes(value)) || /荒阶|仙阶|仙品/.test(gradeName) || description.length < 20)) return [];
    const product = { id: safeId(name), name: name.slice(0, 80), category, grade: grade.slice(0, 30), description: description.slice(0, 300), priceGrade, price: normalizedPrice, stock: Math.max(1, Math.min(999, Math.floor(number(readField(row, 'stock', '库存', '数量'), 1)))), createdAt: now, itemDataMode: settings.itemDataMode, 战斗属性 };
    return validateMerchantWorldbookPrice(product) ? [product] : [];
  }).slice(0, settings.batchSize);
  return !requireRealmCoverage || XUANTIAN_REALMS.every(realm => products.some(product => product.grade.includes(realm))) ? products : [];
}

function selectMerchantBatch(products: MerchantProduct[], batchSize: number, requiredRealms: readonly string[] = XUANTIAN_REALMS): MerchantProduct[] {
  const selected: MerchantProduct[] = [];
  const seen = new Set<string>();
  const add = (product: MerchantProduct | undefined): void => {
    if (!product) return;
    const key = `${product.name}\\u0000${product.category}`;
    if (seen.has(key) || selected.length >= batchSize) return;
    seen.add(key); selected.push(product);
  };
  for (const realm of requiredRealms) add(products.find(product => product.grade.includes(realm)) as MerchantProduct);
  products.forEach(add);
  return selected;
}

export async function generateMerchantProducts(generate: (prompt: string) => unknown | Promise<unknown>, settings: MerchantSettings, worldContext: string, existingNames: string[] = []): Promise<MerchantProduct[]> {
  const splitCombatBatches = settings.itemDataMode === 'combat';
  const requiresFullRealmCoverage = true;
  const requestedBatchSize = splitCombatBatches ? 4 : settings.batchSize;
  const expectedTotal = splitCombatBatches ? 8 : settings.batchSize;
  const minimumRealmIndex = realmIndex(settings.minRealm);
  const requiredRealms = (minimumRealmIndex >= 0 ? XUANTIAN_REALMS.slice(minimumRealmIndex) : XUANTIAN_REALMS) as readonly XuantianRealm[];
  const slotRealms = Array.from({ length: expectedTotal }, (_, index) => requiredRealms[index % requiredRealms.length]);
  const realmCoverage = splitCombatBatches
    ? `本次合计生成八件货品，主角当前境界为${settings.minRealm || '未知'}；只允许生成主角境界及以上的货品。必须覆盖这些可用境界：${requiredRealms.join('、')}，每个可用境界至少一件，其余名额在可用境界中重复；不得生成更低境界。每件必须额外填写 realm 字段，且 realm 只能是这八个值之一；grade 必须以 realm 对应境界开头。品阶只能使用凡阶、黄阶、玄阶、地阶、天阶，严禁极阶、荒阶、仙阶、仙品等自造品阶。价格必须逐项严格符合世界书价格表，禁止自行估价、换品级或超出区间；不符合价格的条目视为失败。战斗版会分两次调用，每次四件。禁止生成渡劫、仙境、真仙或任何仙界货品。`
    : `本次合计生成十件货品，主角当前境界为${settings.minRealm || '未知'}；只允许生成主角境界及以上的货品。必须覆盖这些可用境界：${requiredRealms.join('、')}，每个可用境界至少一件，其余名额在可用境界中重复；不得生成更低境界。每件必须额外填写 realm 字段，且 realm 只能是这八个值之一；grade 必须以 realm 对应境界开头。品阶只能使用凡阶、黄阶、玄阶、地阶、天阶，严禁极阶、荒阶、仙阶、仙品等自造品阶。价格必须逐项严格符合世界书价格表，禁止自行估价、换品级或超出区间；不符合价格的条目视为失败。禁止生成渡劫、仙境、真仙或任何仙界货品。`;
  const schema = settings.itemDataMode === 'combat' ? '战斗版严格遵守世界书：五维数值由战斗脚本计算，AI绝对禁止输出攻击/防御/速度/暴击/暴伤等数字，也禁止输出“战斗版五维”字段。只有功法/心法/武技/秘术和器物/法器/法宝/古宝/灵宝是战斗来源，才填写定性战斗属性；丹药、材料、符箓、阵盘、储物袋等严禁添加战斗属性。战斗属性只允许使用定性维度名：攻伐、御守、遁速、神魂、灵压。功法类必须填写类型、本源、品阶、效果类型、主维、辅维、境界、熟练度、描述，以及技能对象映射；技能数量必须严格按品阶：凡阶1、黄阶1-2、玄阶2、地阶2-3、天阶3，少一个或多一个都无效。器物类必须填写等级（法器/法宝/古宝/通天灵宝/先天灵宝等）、类型、本源、品阶、主维、辅维、祭炼度、损耗度、状态、特效；器物状态只能写“正常”或“可用”，不得写“完好”；不可用、已损毁、被毁、封印、失效的器物不得计入五维。所有商品描述至少30字。' : '原版：只返回描述和数量相关字段，禁止添加五维、技能或战斗专用字段。';
  const blockedNames = [...new Set(existingNames.map(name => String(name).trim()).filter(Boolean))];
  const blockedText = blockedNames.length ? `当前已有货单名称（绝对禁止重名）：${blockedNames.join('、')}。` : '当前没有既有货单名称。';
  const prompt = `你是“万宝商行”货单生成器，只生成符合道渊修真世界观的可售商品。不要读取或复述聊天剧情，只依据本提示中的世界书物价规则生成。\n${worldContext}\n${blockedText}\n本次请求生成 ${requestedBatchSize} 件。${realmCoverage}\n${WORLD_BOOK_PRICE_GUIDE}\n${schema}\n输出预算很紧：只返回一个可解析的 JSON 对象，不要 Markdown、解释、换行前后缀或重复字段；description 控制在30-45个汉字；字段名使用示例中的短字段；不要输出任何额外说明。顶层必须是 items 数组（也兼容 products 数组）：{"items":[{"name":"物品名","realm":"炼气","category":"器物/功法/丹药/炼丹材料/炼器材料/符箓/阵盘/阵材/傀儡/材料/杂物","grade":"炼气境·黄阶","description":"符合世界书的简明效果与用途描述","priceGrade":"下品灵石","price":10,"stock":1,"战斗属性":{"类型":"身法遁术","本源":"概念-空间","品阶":"黄阶","效果类型":"身法遁术","主维":"遁速","辅维":["神魂"],"境界":"未入门","熟练度":0,"描述":"功法的简明用途描述","技能":{"虚空挪移":{"类型":"辅助","描述":"折叠空间完成短距挪移。"}}}}]}. 只有功法和器物填写战斗属性；丹药、材料、符箓、阵盘、储物袋不得填写战斗属性。器物战斗属性必须包含等级、类型、本源、品阶、主维、辅维、祭炼度、损耗度、状态、特效；功法战斗属性必须使用技能对象映射（技能名作为键，值为类型与描述），并包含类型、本源、品阶、效果类型、主维、辅维、境界、熟练度、描述；任何商品都不得包含五维数值。每件商品的 name、realm、category、grade、description 都必须非空；价格与库存必须为正整数且严格符合世界书区间；不要生成灵石、仙石、角色、剧情事实或变量指令。`;
  if (splitCombatBatches) {
    const combined: MerchantProduct[] = [];
    for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
      const slotRule = batchIndex === 0
        ? `严格按槽位输出：${slotRealms.slice(0, 4).map((realm, index) => `第${index + 1}件 realm=${realm}`).join('，')}。每个槽位只能有一件，先按世界书选择品类，再使用该境界对应的 priceGrade、price 区间。`
        : `严格按槽位输出：${slotRealms.slice(4, 8).map((realm, index) => `第${index + 1}件 realm=${realm}`).join('，')}。每个槽位只能有一件，先按世界书选择品类，再使用该境界对应的 priceGrade、price 区间；大乘禁止功法和天阶功法。`;
      const batchPrompt = `${prompt}\n这是战斗版第 ${batchIndex + 1}/2 次调用。严格只输出恰好 ${requestedBatchSize} 件，JSON 尽量紧凑（不要空格和换行）；${slotRule} 两次结果会合并后统一校验八个境界各一件，不得增加随机货品。每件商品名称必须唯一，不得与本批其他商品重名；不要用同一件商品冒充多个槽位。`;
      const raw = extractGeneratedText(await generate(batchPrompt));
      const parsedRows = parseRows(raw);
      const valid = normalizeProducts(raw, settings, false);
      appendMerchantDebugLog({ phase: 'batch', batch: batchIndex + 1, expected: requestedBatchSize, rawLength: raw.length, rawTail: raw.slice(-240), raw: raw.slice(0, 20000), parsedRows: parsedRows.length, validCount: valid.length, valid: valid.map(product => ({ name: product.name, realm: realmOf(product.grade), category: product.category, grade: product.grade, priceGrade: product.priceGrade, price: product.price })) });
      combined.push(...valid);
    }
    const merged = selectMerchantBatch(combined, expectedTotal, requiredRealms);
    const realms = new Set(merged.map(product => realmOf(product.grade)).filter(Boolean));
    if (merged.length === expectedTotal && requiredRealms.every(realm => realms.has(realm))) return merged;
    const missing = requiredRealms.filter(realm => !realms.has(realm));
    appendMerchantDebugLog({ phase: 'merged-failure', expected: expectedTotal, validCount: merged.length, missingRealms: missing, merged: merged.map(product => ({ name: product.name, grade: product.grade, category: product.category })) });
    throw new Error(`AI 返回的有效货品为 ${merged.length} 件，应为 ${expectedTotal} 件${missing.length ? `；缺少境界：${missing.join('、')}` : ''}`);
  }
  const firstRaw = extractGeneratedText(await generate(prompt));
  const firstProducts = normalizeProducts(firstRaw, settings, false);
  appendMerchantDebugLog({ phase: 'batch', batch: 1, expected: settings.batchSize, rawLength: firstRaw.length, rawTail: firstRaw.slice(-240), raw: firstRaw.slice(0, 20000), parsedRows: parseRows(firstRaw).length, validCount: firstProducts.length, valid: firstProducts.map(product => ({ name: product.name, realm: realmOf(product.grade), category: product.category, grade: product.grade, priceGrade: product.priceGrade, price: product.price })) });
  const firstBatch = selectMerchantBatch(firstProducts, settings.batchSize, requiredRealms);
  const hasRequiredRealmCoverage = (batch: MerchantProduct[]): boolean => {
    const realms = new Set(batch.map(product => realmOf(product.grade)).filter(Boolean));
    return requiredRealms.every(realm => realms.has(realm));
  };
  if (firstBatch.length === settings.batchSize && hasRequiredRealmCoverage(firstBatch)) return firstBatch;
  let pool = firstProducts;
  let batch = firstBatch;
  // 模型偶尔会在修复轮少补 1 件；最多再给两次“只补缺口”的机会，避免等待过久。
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const missingRealms = requiresFullRealmCoverage ? requiredRealms.filter(realm => !batch.some(product => product.grade.includes(realm))) : [];
    const missingCount = Math.max(0, settings.batchSize - batch.length);
    const existingNames = batch.map(product => product.name).join('、') || '无';
    const repairPrompt = `${prompt}\n\n当前已有 ${batch.length} 件通过校验，还缺 ${missingCount} 件；缺少境界：${missingRealms.join('、') || '无'}。已存在商品名（绝对不能重复）：${existingNames}。本次只需补齐缺口，至少返回 ${Math.max(1, missingCount)} 件全新货品；若缺少境界则优先补齐。功法技能数量必须再次核对：凡1、黄1-2、玄2、地2-3、天3。不要复述错误，不要代码围栏，不要把 JSON 放进字符串。每件都必须有 name、category、grade、description、priceGrade、price、stock；战斗版器物还必须完整填写战斗属性字段。`;
    const repairedRaw = extractGeneratedText(await generate(repairPrompt));
    const repairedProducts = normalizeProducts(repairedRaw, settings, false);
    appendMerchantDebugLog({ phase: 'repair', attempt: attempt + 1, expected: settings.batchSize, raw: repairedRaw.slice(0, 20000), parsedRows: parseRows(repairedRaw).length, validCount: repairedProducts.length, valid: repairedProducts.map(product => ({ name: product.name, realm: realmOf(product.grade), category: product.category, grade: product.grade, priceGrade: product.priceGrade, price: product.price })) });
    pool = [...repairedProducts, ...pool];
    batch = selectMerchantBatch(pool, settings.batchSize, requiredRealms);
    if (batch.length === settings.batchSize && hasRequiredRealmCoverage(batch)) return batch;
  }
  const missing = requiresFullRealmCoverage ? requiredRealms.filter(realm => !batch.some(product => product.grade.includes(realm))) : [];
  console.warn(`[万宝商行] 货单补齐失败 ${JSON.stringify({ validCount: batch.length, expected: settings.batchSize, missingRealms: missing })}`);
  throw new Error(`AI 返回的有效货品为 ${batch.length} 件，应为 ${settings.batchSize} 件${missing.length ? `；缺少境界：${missing.join('、')}` : ''}`);
}

export function createMerchantApiGenerator(settings: MerchantApiSettings): (prompt: string) => Promise<string> {
  return async prompt => {
    if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('已启用独立 API，请先填写基础 URL 和模型');
    const response = await fetchAuto(settings.apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
      body: JSON.stringify({ model: settings.apiModel.trim(), messages: [{ role: 'system', content: '你只输出符合用户指定结构的严格 JSON。' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 8000 }),
    });
    if (!response.ok) throw new Error(`万宝商行 API 请求失败：${response.status} ${(await response.text()).slice(0, 200)}`);
    const text = extractOpenAIText(await response.json());
    if (!text) throw new Error('万宝商行 API 返回为空');
    return text;
  };
}

export async function estimateMerchantItems(generate: (prompt: string) => unknown | Promise<unknown>, items: MerchantSellItem[], products: MerchantProduct[]): Promise<Record<string, MerchantQuote>> {
  if (!items.length) return {};
  const ownedList = items.map(item => ({ itemId:item.id, name:item.name, source:item.category, quantity:item.quantity, description:item.description || '无明确描述' }));
  const marketList = products.filter(product => product.stock > 0).map(product => ({ name:product.name, category:product.category, grade:product.grade, description:product.description, priceGrade:product.priceGrade, price:product.price, stock:product.stock }));
  const prompt = `你是万宝商行鉴宝师。本次必须一次性为全部玩家物品给出每件回收价，不修改物品，也不得遗漏或新增 itemId。\n【玩家物品】\n${JSON.stringify(ownedList)}\n【当前完整在售货单】\n${JSON.stringify(marketList)}\n估价时先查找完全同名的在售商品：同名商品必须使用相同灵石品级，回收价必须为当前售价的50%-90%；没有同名商品时，结合物品名称、描述、类别和下列世界书灵石体系估算。\n${WORLD_BOOK_PRICE_GUIDE}\n只返回严格JSON，不要Markdown：{"items":[{"itemId":"储物袋:物品名","priceGrade":"上品灵石","price":1,"reason":"一句话估价依据"}]}。price必须为正整数，priceGrade只能是极品灵石、上品灵石、中品灵石、下品灵石。`;
  const rows = parseRows(extractGeneratedText(await generate(prompt)));
  if (rows.length !== items.length) throw new Error(`AI 返回 ${rows.length} 条估价，应为 ${items.length} 条`);
  const itemById = new Map(items.map(item => [item.id, item]));
  const quotes: Record<string, MerchantQuote> = {};
  for (const raw of rows) {
    const row = asRecord(raw); const itemId = String(row?.itemId ?? ''); const item = itemById.get(itemId);
    if (!item || quotes[itemId]) throw new Error('AI 返回了未知或重复的估价物品');
    const grade = String(row?.priceGrade ?? '') as MerchantProduct['priceGrade']; const price = Math.floor(number(row?.price));
    if (!['极品灵石','上品灵石','中品灵石','下品灵石'].includes(grade) || price < 1) throw new Error(`「${item.name}」没有有效估价`);
    const matchingProduct = products.find(product => product.stock > 0 && product.name.trim() === item.name.trim());
    if (matchingProduct) {
      const minimum = Math.max(1, Math.ceil(matchingProduct.price * 0.5));
      const maximum = Math.max(minimum, Math.floor(matchingProduct.price * 0.9));
      if (grade !== matchingProduct.priceGrade || price < minimum || price > maximum) throw new Error(`「${item.name}」同名商品回收价须为当前售价的50%-90%（${minimum}-${maximum} ${matchingProduct.priceGrade}）`);
    }
    quotes[itemId] = { itemId, fingerprint:merchantItemFingerprint(item), priceGrade:grade, price, reason:String(row?.reason ?? '万宝商行鉴定价').slice(0,160), quotedAt:new Date().toISOString() };
  }
  return quotes;
}

export function projectSellItems(snapshot: unknown, quotes: Record<string, MerchantQuote> = {}): MerchantSellItem[] {
  const stat = asRecord(asRecord(snapshot)?.stat_data); const protagonist = asRecord(stat?.主角); const items: MerchantSellItem[] = [];
  for (const [containerName, container] of [['储物袋', protagonist?.储物袋], ['器物', protagonist?.器物]] as const) {
    const record = asRecord(container); if (!record) continue;
    for (const [name, value] of Object.entries(record)) {
      const row = asRecord(value); const quantity = Math.max(0, Math.floor(number(row?.数量 ?? value, 0))); if (!quantity) continue;
      const item: MerchantSellItem = { id: `${containerName}:${name}`, name, category: containerName, quantity, description: String(row?.描述 ?? row?.description ?? '') };
      const quote = quotes[item.id]; if (quote?.fingerprint === merchantItemFingerprint(item)) item.quote = quote;
      items.push(item);
    }
  }
  return items.filter(item => !/灵石/.test(item.name));
}
