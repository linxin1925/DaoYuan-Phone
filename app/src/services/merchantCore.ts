export type MerchantCurrencyMode = 'auto' | 'legacy-bag' | 'combat-separate';
export type MerchantStoneGrade = '极品灵石' | '上品灵石' | '中品灵石' | '下品灵石';

export interface MerchantTradeProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  priceGrade: MerchantStoneGrade;
  price: number;
  stock: number;
  itemDataMode?: 'legacy' | 'combat';
  战斗属性?: object;
}

export interface MerchantTradeRequest {
  kind: 'buy' | 'sell';
  quantity: number;
  currencyMode: MerchantCurrencyMode;
  product?: MerchantTradeProduct;
  sellItemId?: string;
  sellQuote?: { grade: MerchantStoneGrade; price: number; expectedDescription: string };
}

export interface MerchantTradeOutcome {
  statData: Record<string, unknown>;
  amount: number;
  grade: MerchantStoneGrade;
  itemName: string;
}

const GRADES: readonly MerchantStoneGrade[] = ['极品灵石', '上品灵石', '中品灵石', '下品灵石'];

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const COMBAT_ARTIFACT_FIELDS = [
  '等级', '类型', '本源', '品阶', '效果类型', '主维', '辅维',
  // `描述` 使用货单顶层 description，不能被战斗属性里的简写/技能说明覆盖。
  // 状态栏功法面板读取的是 stat_data 主角.功法[name].描述。
  '祭炼度', '损耗度', '状态', '时效', '触发', '特效', '熟练度', '境界', '技能',
] as const;

const TECHNIQUE_CATEGORY = /功法|心法|武技|秘术/;
const ARTIFACT_CATEGORY = /器物|法器|法宝|古宝|通天灵宝|先天灵宝|仙器/;
const COMBAT_GRADES = ['凡阶', '黄阶', '玄阶', '地阶', '天阶'] as const;
const ARTIFACT_TYPES = ['攻伐', '防御', '遁行', '神魂', '威压', '增幅', '辅助', '探察', '聚灵'] as const;

export function isTechniqueCategory(category: string): boolean {
  return TECHNIQUE_CATEGORY.test(category);
}

export function isArtifactCategory(category: string): boolean {
  return ARTIFACT_CATEGORY.test(category);
}

export function normalizeArtifactType(value: unknown): typeof ARTIFACT_TYPES[number] | undefined {
  const text = String(value ?? '').trim().replace(/类$/u, '');
  const aliases: Record<string, typeof ARTIFACT_TYPES[number]> = {
    攻击: '攻伐', 守护: '防御', 身法: '遁行', 遁术: '遁行', 魂魄: '神魂', 领域: '威压',
  };
  const normalized = aliases[text] ?? text;
  return ARTIFACT_TYPES.includes(normalized as typeof ARTIFACT_TYPES[number]) ? normalized as typeof ARTIFACT_TYPES[number] : undefined;
}

function normalizeArtifactStatus(value: unknown): unknown {
  const status = String(value ?? '').trim();
  if (/^(完好|正常)$/u.test(status)) return '正常';
  if (/^可用$/u.test(status)) return '可用';
  return value;
}

function techniqueDisplayType(source: Record<string, unknown>, fallbackGrade: string): string | undefined {
  const gradeRaw = String(source.品阶 ?? fallbackGrade ?? '').trim();
  const grade = COMBAT_GRADES.find(value => gradeRaw === value || gradeRaw.startsWith(value));
  const rawEffect = String(source.效果类型 ?? source.类型 ?? '').trim();
  const effect = ['强攻杀伐', '防御守护', '身法遁术', '神魂秘术', '辅助领域'].find(value => rawEffect.includes(value)) ?? '';
  const origin = String(source.本源 ?? '').trim();
  if (!grade || !effect || !origin) return undefined;
  const originName = (origin.includes('-') ? origin.slice(origin.indexOf('-') + 1) : origin).trim();
  return originName ? `${grade}-${originName.replace(/系$/u, '')}系${effect}` : undefined;
}

function combatArtifactFields(product: MerchantTradeProduct): Record<string, unknown> {
  const source = record(product.战斗属性);
  if (product.itemDataMode !== 'combat' || !source) return {};
  const fields = Object.fromEntries(COMBAT_ARTIFACT_FIELDS
    .filter(field => Object.prototype.hasOwnProperty.call(source, field))
    .map(field => {
      const value = source[field];
      if (field === '品阶' && typeof value === 'string') {
        return [field, COMBAT_GRADES.find(grade => value === grade || value.startsWith(grade)) ?? value];
      }
      if (field === '状态') return [field, normalizeArtifactStatus(value)];
      if (field === '类型' && isArtifactCategory(product.category)) return [field, normalizeArtifactType(value) ?? value];
      return [field, value];
    }));
  if (isTechniqueCategory(product.category)) {
    const displayType = techniqueDisplayType(source, '');
    if (displayType) fields.类型 = displayType;
  }
  return fields;
}

function assertCombatArtifactWrite(product: MerchantTradeProduct, item: Record<string, unknown>): void {
  if (product.itemDataMode !== 'combat' || !isArtifactCategory(product.category)) return;
  const required = ['等级', '类型', '本源', '品阶', '主维', '祭炼度', '损耗度', '状态', '特效'];
  const missing = required.filter(field => item[field] === undefined || item[field] === null || String(item[field]).trim() === '');
  if (missing.length) throw new Error(`V0.7器物字段缺失：${missing.join('、')}`);
  if (item.状态 !== '正常' && item.状态 !== '可用') throw new Error('V0.7器物状态必须为正常或可用');
  if (!normalizeArtifactType(item.类型)) throw new Error('V0.7器物类型无法识别');
}

function assertCombatTechniqueWrite(product: MerchantTradeProduct, item: Record<string, unknown>): void {
  if (product.itemDataMode !== 'combat' || !isTechniqueCategory(product.category)) return;
  const required = ['类型', '本源', '品阶', '效果类型', '主维', '技能'];
  const missing = required.filter(field => {
    const value = item[field];
    return value === undefined || value === null || String(value).trim() === '' || (field === '技能' && Array.isArray(value) && value.length === 0);
  });
  if (missing.length) throw new Error(`V0.7功法字段缺失：${missing.join('、')}`);
  if (!/^(凡阶|黄阶|玄阶|地阶|天阶)-.+系(强攻杀伐|防御守护|身法遁术|神魂秘术|辅助领域)$/u.test(String(item.类型))) {
    throw new Error('V0.7功法类型无法生成规范组合格式');
  }
}

function quantityOf(value: unknown): number {
  const row = record(value);
  const raw = row?.数量 ?? value;
  const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function withQuantity(value: unknown, quantity: number): unknown {
  const row = record(value);
  return row ? { ...row, 数量: quantity } : quantity;
}

function resolveCurrency(protagonist: Record<string, unknown>, bag: Record<string, unknown>, grade: MerchantStoneGrade, mode: MerchantCurrencyMode): { source: 'legacy-bag' | 'combat-separate'; key: string; quantity: number } {
  const combatQuantity = quantityOf(protagonist[grade]);
  const exactBag = Object.keys(bag).find(key => key === grade);
  const candidateBag = exactBag ?? Object.keys(bag).find(key => key.replace(/[\s·_\-]/g, '') === grade);
  const bagQuantity = candidateBag ? quantityOf(bag[candidateBag]) : 0;
  if (mode === 'combat-separate') {
    if (!(grade in protagonist)) throw new Error(`战斗版字段中没有${grade}`);
    return { source: 'combat-separate', key: grade, quantity: combatQuantity };
  }
  if (mode === 'legacy-bag') {
    if (!candidateBag) throw new Error(`储物袋中无法确认${grade}候选`);
    return { source: 'legacy-bag', key: candidateBag, quantity: bagQuantity };
  }
  if (grade in protagonist) return { source: 'combat-separate', key: grade, quantity: combatQuantity };
  if (candidateBag) return { source: 'legacy-bag', key: candidateBag, quantity: bagQuantity };
  throw new Error(`无法确认${grade}结构`);
}

function setCurrency(protagonist: Record<string, unknown>, bag: Record<string, unknown>, resolved: ReturnType<typeof resolveCurrency>, quantity: number): void {
  if (resolved.source === 'combat-separate') protagonist[resolved.key] = withQuantity(protagonist[resolved.key], quantity);
  else bag[resolved.key] = withQuantity(bag[resolved.key], quantity);
}

export function applyMerchantTrade(latestStatData: Record<string, unknown>, request: MerchantTradeRequest): MerchantTradeOutcome {
  const quantity = Math.floor(request.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) throw new Error('交易数量无效');
  const protagonistSource = record(latestStatData.主角);
  if (!protagonistSource) throw new Error('找不到 stat_data.主角');
  const protagonist = { ...protagonistSource };
  const bag = { ...(record(protagonistSource.储物袋) ?? {}) };
  const apparatus = { ...(record(protagonistSource.器物) ?? {}) };
  const techniques = { ...(record(protagonistSource.功法) ?? {}) };

  let grade: MerchantStoneGrade;
  let unitPrice: number;
  let itemName: string;
  if (request.kind === 'buy') {
    const product = request.product;
    if (!product || !GRADES.includes(product.priceGrade)) throw new Error('货单商品不存在');
    if (product.stock < quantity) throw new Error('货品库存不足');
    if (!product.name.trim()) throw new Error('货品名称无效');
    if (!product.description.trim()) throw new Error('货品描述缺失');
    grade = product.priceGrade;
    unitPrice = Math.max(1, Math.floor(product.price));
    itemName = product.name;
  } else {
    const match = /^(储物袋|器物):(.+)$/.exec(request.sellItemId ?? '');
    if (!match) throw new Error('出售物品标识无效');
    const containerName = match[1] as '储物袋' | '器物';
    itemName = match[2];
    if (/灵石/.test(itemName)) throw new Error('灵石不能作为普通物品出售');
    const container = containerName === '器物' ? apparatus : bag;
    if (!(itemName in container) || quantityOf(container[itemName]) < quantity) throw new Error('出售数量超过当前持有数量');
    const quote = request.sellQuote;
    if (!quote || !GRADES.includes(quote.grade) || !Number.isSafeInteger(quote.price) || quote.price < 1) throw new Error('该物品尚未完成有效估价');
    const currentRow = record(container[itemName]);
    const currentDescription = String(currentRow?.描述 ?? currentRow?.description ?? '');
    if (currentDescription !== quote.expectedDescription) throw new Error('物品信息已变化，请重新估价');
    grade = quote.grade;
    unitPrice = quote.price;
  }

  const amount = unitPrice * quantity;
  if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('交易金额无效');
  const currency = resolveCurrency(protagonistSource, bag, grade, request.currencyMode);
  if (request.kind === 'buy' && currency.quantity < amount) throw new Error(`${grade}不足`);

  if (request.kind === 'buy') {
    const product = request.product!;
    const destination = isArtifactCategory(product.category) ? apparatus : isTechniqueCategory(product.category) ? techniques : bag;
    const current = destination[itemName];
    const currentRow = record(current);
    const nextItem: Record<string, unknown> = currentRow
      ? { ...currentRow, 数量: quantityOf(current) + quantity }
      : { 描述: product.description, 数量: quantity };
    if (!currentRow) Object.assign(nextItem, combatArtifactFields(product));
    else if (product.itemDataMode === 'combat') Object.assign(nextItem, combatArtifactFields(product));
    // 三类目标（储物袋、器物、功法）统一以货单正文为唯一描述来源。
    // 战斗属性只提供结构化战斗字段，禁止覆盖 MVU 的描述字段。
    nextItem.描述 = product.description;
    if (product.itemDataMode === 'combat' && destination === apparatus) assertCombatArtifactWrite(product, nextItem);
    if (product.itemDataMode === 'combat' && destination === techniques) assertCombatTechniqueWrite(product, nextItem);
    destination[itemName] = nextItem;
    setCurrency(protagonist, bag, currency, currency.quantity - amount);
  } else {
    const containerName = request.sellItemId!.startsWith('器物:') ? '器物' : '储物袋';
    const container = containerName === '器物' ? apparatus : bag;
    const remaining = quantityOf(container[itemName]) - quantity;
    if (remaining === 0) delete container[itemName];
    else container[itemName] = withQuantity(container[itemName], remaining);
    setCurrency(protagonist, bag, currency, currency.quantity + amount);
  }
  protagonist.储物袋 = bag;
  protagonist.器物 = apparatus;
  protagonist.功法 = techniques;
  return { statData: { ...latestStatData, 主角: protagonist }, amount, grade, itemName };
}
