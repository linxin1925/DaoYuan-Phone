import assert from 'node:assert/strict';
import { applyMerchantTrade } from '../src/services/merchantCore.ts';

const product = { id: 'p1', name: '青霜剑', category: '器物', description: '黄阶法剑', priceGrade: '下品灵石', price: 20, stock: 2 };
const original = {
  世界: { 当前时间: '原值', 不得修改: true },
  主角: {
    储物袋: { 下品灵石: { 描述: '通货', 数量: 100 }, 赤炎藤: { 描述: '丹材', 数量: 2 } },
    器物: { 旧剑: { 描述: '旧器', 数量: 1 } },
    好感度: 88,
  },
  其他系统: { token: 'preserve' },
};

const bought = applyMerchantTrade(structuredClone(original), { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product });
assert.equal(bought.statData.主角.储物袋.下品灵石.数量, 80);
assert.equal(bought.statData.主角.器物.青霜剑.数量, 1);
assert.equal(bought.statData.主角.器物.青霜剑.描述, '黄阶法剑');
assert.deepEqual(bought.statData.世界, original.世界);
assert.deepEqual(bought.statData.其他系统, original.其他系统);
assert.equal(bought.statData.主角.好感度, 88);

const combat = { 世界: { x: 1 }, 主角: { 下品灵石: 50, 储物袋: {}, 器物: {} } };
const combatBought = applyMerchantTrade(combat, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product });
assert.equal(combatBought.statData.主角.下品灵石, 30);
assert.equal(combatBought.statData.主角.器物.青霜剑.数量, 1);

const sold = applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 2, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤', sellQuote: { grade: '下品灵石', price: 15, expectedDescription: '丹材' } });
assert.equal(sold.statData.主角.储物袋.赤炎藤, undefined);
assert.equal(sold.statData.主角.储物袋.下品灵石.数量, 130);

const apparatusSold = applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '器物:旧剑', sellQuote: { grade: '下品灵石', price: 50, expectedDescription: '旧器' } });
assert.equal(apparatusSold.statData.主角.器物.旧剑, undefined);
assert.equal(apparatusSold.statData.主角.储物袋.下品灵石.数量, 150);

assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'buy', quantity: 3, currencyMode: 'legacy-bag', product }), /库存不足/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product: { ...product, description: '' } }), /描述缺失/);
assert.throws(() => applyMerchantTrade({ 主角: { 储物袋: { 下品灵石: { 数量: 1 } }, 器物: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product }), /不足/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:不存在' }), /持有数量/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:下品灵石' }), /不能作为普通物品出售/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤' }), /尚未完成有效估价/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤', sellQuote: { grade: '下品灵石', price: 15, expectedDescription: '已变化' } }), /重新估价/);

console.log('wanbao transaction behavior passed: authoritative inventory, stock, currency modes, deletion, boundary preservation');
