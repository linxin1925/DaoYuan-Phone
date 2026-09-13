import assert from 'node:assert/strict';
import { inferElapsedWorldDays, parseFantasyCalendarDay } from '../src/worldSimulation/time.ts';
import { routeSimulationWorldbook } from '../src/worldSimulation/worldbookRouter.ts';

assert.equal(inferElapsedWorldDays('元会历3726年·12月23日', '元会历3756年·12月23日'), 10800);
assert.equal(inferElapsedWorldDays('元会历三千七百二十六年', '元会历3727年'), null, '复杂中文大数应拒绝猜测');
assert.equal(inferElapsedWorldDays('元会历3726年·腊月廿四', '元会历3727年·正月初一'), 7);
assert.equal(inferElapsedWorldDays('元会历3727年', '元会历3726年'), 0, '回滚不得形成负时间推进');
assert.ok(parseFantasyCalendarDay('元会历3726年12月23日') !== null);

const entries = Array.from({ length: 40 }, (_, index) => ({ name: index === 27 ? '蜀山剑门运行规则' : `普通条目${index}`, content: `${'设定'.repeat(500)} ${index === 27 ? '蜀山剑门' : ''}` }));
const routedA = routeSimulationWorldbook(entries, { requiredTerms:['蜀山剑门'], preferredTerms:['规则'], seed:'chat-a', maxEntries:8, maxChars:6000 });
const routedB = routeSimulationWorldbook(entries, { requiredTerms:['蜀山剑门'], preferredTerms:['规则'], seed:'chat-a', maxEntries:8, maxChars:6000 });
assert.deepEqual(routedA, routedB, '同一聊天种子必须稳定');
assert.equal(routedA[0].name, '蜀山剑门运行规则');
assert.ok(routedA.length <= 8);
assert.ok(routedA.reduce((sum, entry) => sum + entry.name.length + entry.content.length + 8, 0) <= 6000);

const oversized = routeSimulationWorldbook([{ name:'世界规则总览', content:'甲'.repeat(100000) }, { name:'地域', content:'乙'.repeat(1000) }], { requiredTerms:['世界'], preferredTerms:[], seed:'oversized', maxEntries:8, maxChars:34000 });
assert.ok(oversized.length > 0, '超长首条应保留受控摘要');
assert.ok(oversized.reduce((sum, entry) => sum + entry.name.length + entry.content.length + 8, 0) <= 34000, '首条世界书也不得突破字符预算');

console.log('world simulation core validated: clock delta, rollback guard and bounded deterministic lore routing');
