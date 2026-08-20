import assert from 'node:assert/strict';
import { applyMerchantTrade } from '../src/services/merchantCore.ts';

const product = { id: 'p1', name: '青霜剑', category: '器物', description: '黄阶法剑', priceGrade: '下品灵石', price: 20, stock: 2 };
const combatProduct = {
  id: 'combat-p1', name: '玄霜定魄剑', category: '法宝', description: '玄霜定魄剑以寒魄玄铁锻成，剑意沉静，可稳定神魂并在祭炼后强化遁行攻势。',
  priceGrade: '中品灵石', price: 3, stock: 2, itemDataMode: 'combat', 战斗属性: {
    等级: '法宝', 类型: '攻伐', 本源: '异种-冰', 品阶: '玄阶', 效果类型: '强攻杀伐', 主维: '攻伐', 辅维: ['御守'],
    祭炼度: 50, 损耗度: 0, 状态: '完好', 特效: '剑气带寒魄定神之效。',
  },
};
const combatTechnique = {
  id: 'combat-technique-1', name: '虚空挪移术', category: '功法', description: '借虚空之力折叠身形，短距离挪移并避开大多数锁定。',
  priceGrade: '中品灵石', price: 4, stock: 1, itemDataMode: 'combat', 战斗属性: {
    类型: '身法遁术', 本源: '概念-空间', 品阶: '玄阶上品', 效果类型: '身法遁术', 主维: '遁速', 辅维: ['神魂'], 熟练度: 50,
    描述: '战斗属性中的简写描述不应覆盖货单正文描述。',
    技能: { 虚空挪移: { 类型: '辅助', 描述: '折叠空间瞬间挪移。' } },
  },
};
const bagProduct = { id: 'bag-p1', name: '千年灵芝', category: '丹药', description: '千年灵芝炼成的温养丹药，可缓慢恢复灵力并稳固经脉。', priceGrade: '下品灵石', price: 5, stock: 1 };
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

const combatOriginal = { 世界: { x: 1 }, 主角: { 中品灵石: 10, 储物袋: {}, 器物: { 玄霜定魄剑: { 数量: 1, 描述: '旧描述', 状态: '完好' } } } };
const combatBought = applyMerchantTrade(combatOriginal, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: combatProduct });
assert.equal(combatBought.statData.主角.器物.玄霜定魄剑.数量, 2);
assert.equal(combatBought.statData.主角.器物.玄霜定魄剑.本源, '异种-冰');
assert.equal(combatBought.statData.主角.器物.玄霜定魄剑.祭炼度, 50);
assert.equal(combatBought.statData.主角.器物.玄霜定魄剑.品阶, '玄阶');
assert.equal(combatBought.statData.主角.器物.玄霜定魄剑.状态, '正常');
const techniqueOriginal = { 世界: { x: 1 }, 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } };
const techniqueBought = applyMerchantTrade(techniqueOriginal, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: combatTechnique });
assert.equal(techniqueBought.statData.主角.功法.虚空挪移术.数量, 1);
assert.equal(techniqueBought.statData.主角.功法.虚空挪移术.本源, '概念-空间');
assert.equal(techniqueBought.statData.主角.功法.虚空挪移术.品阶, '玄阶');
assert.equal(techniqueBought.statData.主角.功法.虚空挪移术.类型, '玄阶-空间系身法遁术');
assert.equal(techniqueBought.statData.主角.功法.虚空挪移术.描述, combatTechnique.description);
const bagBought = applyMerchantTrade({ 世界: {}, 主角: { 储物袋: { 下品灵石: { 数量: 10 }, 千年灵芝: { 数量: 1, 描述: '旧描述' } }, 器物: {}, 功法: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product: bagProduct });
assert.equal(bagBought.statData.主角.储物袋.千年灵芝.描述, bagProduct.description);
assert.deepEqual(techniqueBought.statData.主角.功法.虚空挪移术.技能, combatTechnique.战斗属性.技能);
assert.equal(techniqueBought.statData.主角.储物袋.虚空挪移术, undefined);
assert.deepEqual(bought.statData.世界, original.世界);
assert.deepEqual(bought.statData.其他系统, original.其他系统);
assert.equal(bought.statData.主角.好感度, 88);

const combat = { 世界: { x: 1 }, 主角: { 下品灵石: 50, 储物袋: {}, 器物: {} } };
const combatLegacyBought = applyMerchantTrade(combat, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product });
assert.equal(combatLegacyBought.statData.主角.下品灵石, 30);
assert.equal(combatLegacyBought.statData.主角.器物.青霜剑.数量, 1);

const prefixedArtifact = applyMerchantTrade(
  { 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } },
  { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatProduct, id: 'prefixed-artifact', name: '破阵玄霜剑', category: '攻击法宝' } },
);
assert.equal(prefixedArtifact.statData.主角.器物.破阵玄霜剑.数量, 1);
assert.equal(prefixedArtifact.statData.主角.储物袋.破阵玄霜剑, undefined);

const aliasedArtifact = applyMerchantTrade(
  { 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } },
  { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatProduct, id: 'aliased-artifact', name: '镇魂试炼盏', 战斗属性: { ...combatProduct.战斗属性, 类型: '防御类' } } },
);
assert.equal(aliasedArtifact.statData.主角.器物.镇魂试炼盏.类型, '防御');

const prefixedTechnique = applyMerchantTrade(
  { 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } },
  { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatTechnique, id: 'prefixed-technique', name: '太虚挪移术', category: '空间秘术' } },
);
assert.equal(prefixedTechnique.statData.主角.功法.太虚挪移术.数量, 1);
assert.equal(prefixedTechnique.statData.主角.储物袋.太虚挪移术, undefined);

const sold = applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 2, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤', sellQuote: { grade: '下品灵石', price: 15, expectedDescription: '丹材' } });
assert.equal(sold.statData.主角.储物袋.赤炎藤, undefined);
assert.equal(sold.statData.主角.储物袋.下品灵石.数量, 130);

const apparatusSold = applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '器物:旧剑', sellQuote: { grade: '下品灵石', price: 50, expectedDescription: '旧器' } });
assert.equal(apparatusSold.statData.主角.器物.旧剑, undefined);
assert.equal(apparatusSold.statData.主角.储物袋.下品灵石.数量, 150);

assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'buy', quantity: 3, currencyMode: 'legacy-bag', product }), /库存不足/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product: { ...product, description: '' } }), /描述缺失/);
assert.throws(() => applyMerchantTrade({ 主角: { 中品灵石: 10, 储物袋: {}, 器物: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatProduct, 战斗属性: { 等级: '法宝' } } }), /V0.7器物字段缺失/);
assert.throws(() => applyMerchantTrade({ 主角: { 中品灵石: 10, 储物袋: {}, 器物: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatProduct, 战斗属性: { ...combatProduct.战斗属性, 状态: '已损毁' } } }), /状态必须为正常或可用/);
assert.throws(() => applyMerchantTrade({ 主角: { 中品灵石: 10, 储物袋: {}, 器物: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatProduct, 战斗属性: { ...combatProduct.战斗属性, 类型: '防御加强型' } } }), /器物类型无法识别/);
assert.throws(() => applyMerchantTrade({ 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatTechnique, 战斗属性: { ...combatTechnique.战斗属性, 效果类型: undefined } } }), /效果类型/);
assert.throws(() => applyMerchantTrade({ 主角: { 中品灵石: 10, 储物袋: {}, 器物: {}, 功法: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'combat-separate', product: { ...combatTechnique, 战斗属性: { ...combatTechnique.战斗属性, 效果类型: '未知效果', 类型: '未知效果' } } }), /组合格式/);
assert.throws(() => applyMerchantTrade({ 主角: { 储物袋: { 下品灵石: { 数量: 1 } }, 器物: {} } }, { kind: 'buy', quantity: 1, currencyMode: 'legacy-bag', product }), /不足/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:不存在' }), /持有数量/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:下品灵石' }), /不能作为普通物品出售/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤' }), /尚未完成有效估价/);
assert.throws(() => applyMerchantTrade(structuredClone(original), { kind: 'sell', quantity: 1, currencyMode: 'legacy-bag', sellItemId: '储物袋:赤炎藤', sellQuote: { grade: '下品灵石', price: 15, expectedDescription: '已变化' } }), /重新估价/);

console.log('wanbao transaction behavior passed: authoritative inventory, stock, currency modes, deletion, boundary preservation');
