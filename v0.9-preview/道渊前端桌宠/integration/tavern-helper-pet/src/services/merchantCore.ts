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
  五维?: Record<string, number>;
  技能?: Array<Record<string, string>>;
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
    const destination = product.category === '器物' ? apparatus : bag;
    const current = destination[itemName];
    const currentRow = record(current);
    destination[itemName] = currentRow
      ? { ...currentRow, 数量: quantityOf(current) + quantity }
      : { 描述: product.description, 数量: quantity, ...(product.itemDataMode === 'combat' ? { 五维: product.五维, 技能: product.技能 } : {}) };
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
  return { statData: { ...latestStatData, 主角: protagonist }, amount, grade, itemName };
}
