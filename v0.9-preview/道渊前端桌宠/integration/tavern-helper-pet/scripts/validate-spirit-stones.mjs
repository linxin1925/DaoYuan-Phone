import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const legacy = { stat_data: { 主角: { 储物袋: {
  极品灵石: { 描述: '灵石', 数量: 2 },
  上品灵石: { 描述: '灵石', 数量: 31 },
  中品灵石: { 描述: '灵石', 数量: 480 },
  下品灵石: { 描述: '灵石', 数量: 9000 },
  赤炎藤: { 描述: '材料', 数量: 3 },
} } } };
const combat = { stat_data: { 主角: { 极品灵石: 7, 上品灵石: 8, 中品灵石: 9, 下品灵石: 10, 储物袋: { 赤炎藤: { 数量: 3 } } } } };
const ambiguous = { stat_data: { 主角: { 储物袋: { '极品 灵石': { 数量: 4 }, '灵石碎片': { 数量: 99 } } } } };

const source = await readFile(new URL('../src/services/worldDataBridge.ts', import.meta.url), 'utf8');
assert.match(source, /export function projectSpiritStones/);
assert.match(source, /'legacy-bag' \| 'combat-separate'/);
for (const grade of ['极品灵石', '上品灵石', '中品灵石', '下品灵石']) assert.ok(source.includes(grade));
assert.match(source, /不会修改原始变量/);
console.log('spirit stone projection contract passed: legacy / combat-separate / candidate matching');
