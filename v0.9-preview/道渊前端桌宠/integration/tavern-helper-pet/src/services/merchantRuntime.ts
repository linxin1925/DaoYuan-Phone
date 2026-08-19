import { extractGeneratedText } from './yujianRuntime';
import { extractOpenAIText, fetchAuto } from './openaiProtocol';

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
  五维?: Record<string, number>;
  技能?: Array<Record<string, string>>;
}

export interface MerchantSettings { batchSize: number; maxItems: number; refreshInterval: number; itemDataMode: 'legacy' | 'combat'; }
export interface MerchantApiSettings { enabled: boolean; transactionInjectionEnabled: boolean; apiBaseUrl: string; apiKey: string; apiModel: string; }
export interface MerchantQuote { itemId: string; fingerprint: string; priceGrade: MerchantProduct['priceGrade']; price: number; reason: string; quotedAt: string; }
export interface MerchantSellItem { id: string; name: string; category: '储物袋' | '器物'; quantity: number; description: string; quote?: MerchantQuote; }

const STORAGE_KEY = 'daoyuan_wanbao_runtime_v1';
const QUOTE_STORAGE_KEY = 'daoyuan_wanbao_quotes_v1';
const XUANTIAN_REALMS = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘'] as const;
const WORLD_BOOK_PRICE_GUIDE = `【玄天界世界书强制物价（相邻灵石品级100:1）】\n丹药：炼气5-20下品；筑基1-5中品；金丹10-50中品；元婴1-5上品；化神10-50上品；炼虚100-500上品；合体10-50极品；大乘100-500极品。\n符箓：炼气5-15下品；筑基1-5中品；金丹10-50中品；元婴1-5上品；化神10-50上品；炼虚100-500上品；合体10-50极品；大乘100-500极品。\n阵盘：炼气30-50下品；筑基3-8中品；金丹50-150中品；元婴5-15上品；化神50-150上品；炼虚500-1500上品；合体50-150极品；大乘1000-5000极品。\n器物：炼气10-800下品；筑基10-80中品；金丹100-800中品；元婴10-100上品；化神30-300上品；炼虚100-1000上品；合体100-800极品；大乘1000-10000极品。\n炼丹/炼器/阵法材料：炼气5-50下品；筑基1-30中品；金丹10-100中品；元婴1-30上品；化神10-100上品；炼虚50-500上品；合体10-100极品；大乘100-1000极品。价格必须严格落在对应类型和境界区间内。`;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function number(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
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
        priceGrade: ['极品灵石', '上品灵石', '中品灵石', '下品灵石'].includes(String(row.priceGrade)) ? row.priceGrade as MerchantProduct['priceGrade'] : '中品灵石', price: Math.max(1, Math.floor(number(row.price, 1))), stock: Math.max(0, Math.floor(number(row.stock, 1))), createdAt: String(row.createdAt || new Date().toISOString()), itemDataMode: row.itemDataMode === 'combat' ? 'combat' as const : 'legacy' as const, 五维: asRecord(row.五维) ? Object.fromEntries(Object.entries(row.五维 as Record<string, unknown>).flatMap(([key, value]) => Number.isFinite(Number(value)) ? [[key, Number(value)]] : [])) : undefined, 技能: Array.isArray(row.技能) ? row.技能.filter(value => asRecord(value)).slice(0, 12) as Array<Record<string, string>> : undefined,
      };
    }).filter(validateMerchantWorldbookPrice) : [];
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
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const candidates = [cleaned];
  const objectStart = cleaned.indexOf('{'); const objectEnd = cleaned.lastIndexOf('}');
  const arrayStart = cleaned.indexOf('['); const arrayEnd = cleaned.lastIndexOf(']');
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(cleaned.slice(objectStart, objectEnd + 1));
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));
  for (const candidate of candidates) try {
    const parsed = JSON.parse(candidate);
    if (Array.isArray(parsed)) return parsed;
    const record = asRecord(parsed);
    return Array.isArray(record?.items) ? record.items : [];
  } catch { /* try next extract */ }
  return [];
}

function normalizeProducts(raw: string, settings: MerchantSettings): MerchantProduct[] {
  const now = new Date().toISOString();
  const products = parseRows(raw).slice(0, settings.batchSize).flatMap(item => {
    const row = asRecord(item); if (!row || typeof row.name !== 'string' || !row.name.trim() || typeof row.description !== 'string' || !row.description.trim()) return [];
    const priceGrade = ['极品灵石', '上品灵石', '中品灵石', '下品灵石'].includes(String(row.priceGrade)) ? row.priceGrade as MerchantProduct['priceGrade'] : '中品灵石';
    const 五维 = asRecord(row.五维); const product = { id: safeId(row.name), name: row.name.trim().slice(0, 80), category: String(row.category || '器物').slice(0, 30), grade: String(row.grade || '炼气境·黄阶下品').slice(0, 30), description: row.description.trim().slice(0, 300), priceGrade, price: Math.max(1, Math.min(999999999, Math.floor(number(row.price, 1)))), stock: Math.max(1, Math.min(999, Math.floor(number(row.stock, 1)))), createdAt: now, itemDataMode: settings.itemDataMode, 五维: settings.itemDataMode === 'combat' && 五维 ? Object.fromEntries(Object.entries(五维).flatMap(([key, value]) => Number.isFinite(Number(value)) ? [[key, Number(value)]] : [])) : undefined, 技能: settings.itemDataMode === 'combat' && Array.isArray(row.技能) ? row.技能.filter(value => asRecord(value)).slice(0, 12) as Array<Record<string, string>> : undefined };
    return validateMerchantWorldbookPrice(product) ? [product] : [];
  });
  return XUANTIAN_REALMS.every(realm => products.some(product => product.grade.includes(realm))) ? products : [];
}

export async function generateMerchantProducts(generate: (prompt: string) => unknown | Promise<unknown>, settings: MerchantSettings, worldContext: string): Promise<MerchantProduct[]> {
  const realmCoverage = '十件货品必须覆盖炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘八个玄天界境界，每境至少一件，另外两件可从八境中任选。禁止生成渡劫、仙境、真仙或任何仙界货品。grade 字段必须以这八个境界之一开头并写明物品品阶。';
  const schema = settings.itemDataMode === 'combat' ? '战斗版：每件商品必须额外返回“ itemDataMode":"combat","五维":{"攻击":数值,"防御":数值,"速度":数值,"暴击":数值,"暴伤":数值}；若 category 为功法，必须额外返回“技能":[{"技能名称":"…","技能类型":"…","效果":"…"}]。五维和技能必须是该物品自身属性，不得省略。' : '原版：只返回描述和数量相关字段，禁止添加五维、技能或战斗专用字段。';
  const prompt = `你是“万宝商行”货单生成器，只生成符合道渊修真世界观的可售商品。\n${worldContext}\n本轮固定生成 ${settings.batchSize} 件。${realmCoverage}\n${WORLD_BOOK_PRICE_GUIDE}\n${schema}\n只返回严格 JSON，不要 Markdown、解释或前后缀：{"items":[{"name":"物品名","category":"器物/丹药/炼丹材料/炼器材料/符箓/阵盘/阵材/功法","grade":"炼气境·黄阶下品","description":"说明物品材质、用途或效果的简短描述","priceGrade":"下品灵石","price":10,"stock":1}]}。每件商品的 name、category、grade、description 都必须非空，description 必须是可写入储物袋“描述”字段的简短完整说明；价格与库存必须为正整数；不要生成灵石、角色、剧情事实、储物袋字段或任何变量指令。`;
  const firstRaw = extractGeneratedText(await generate(prompt));
  let products = normalizeProducts(firstRaw, settings);
  if (products.length === settings.batchSize) return products;
  const repairPrompt = `${prompt}\n\n上一次返回未通过解析或数量不足。请重新输出完整的 ${settings.batchSize} 件，不要复述错误，不要代码围栏。上一次内容仅供纠错：\n${firstRaw.slice(0, 12000)}`;
  const repairedRaw = extractGeneratedText(await generate(repairPrompt));
  products = normalizeProducts(repairedRaw, settings);
  if (products.length !== settings.batchSize) throw new Error(`AI 返回的有效货品为 ${products.length} 件，应为 ${settings.batchSize} 件`);
  return products;
}

export function createMerchantApiGenerator(settings: MerchantApiSettings): (prompt: string) => Promise<string> {
  return async prompt => {
    if (!settings.apiBaseUrl.trim() || !settings.apiModel.trim()) throw new Error('已启用独立 API，请先填写基础 URL 和模型');
    const response = await fetchAuto(settings.apiBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
      body: JSON.stringify({ model: settings.apiModel.trim(), messages: [{ role: 'system', content: '你只输出符合用户指定结构的严格 JSON。' }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 6000 }),
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
