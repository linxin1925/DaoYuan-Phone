import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { diagnoseEarthWorldbook } from '../src/earthSimulation/diagnostics.ts';
import { EARTH_WORLD_BOOK_SEED, earthWorldbookEntries } from '../src/earthSimulation/worldbookSeed.ts';

const root = resolve(import.meta.dirname, '..', '..');
const sourceBytes = await readFile(resolve(root, '灵力复苏地球附属世界书/灵力复苏地球附属世界书.json'));
const source = JSON.parse(sourceBytes.toString('utf8')); const entries = earthWorldbookEntries();
assert.equal(EARTH_WORLD_BOOK_SEED.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
assert.equal(entries.length, Object.keys(source.entries).length); assert.equal(entries.length, 187);
assert.equal(new Set(entries.map((entry) => entry.name)).size, entries.length, '种子条目名不得重复');
const allEjsEntries = entries.filter((entry) => /^EJS/.test(entry.name));
assert.equal(allEjsEntries.length, 10, 'EJS 特殊条目数量异常');
for (const entry of allEjsEntries) {
  assert.match(entry.content, /^@@generate_before\n@@always_enabled\n/, `${entry.name} 必须跨兼容模式强制启用`);
  assert.equal(entry.enabled, false, `${entry.name} 必须在世界书界面保持灰色，避免原生扫描重复注入`);
}
const ejsRoutes = entries.filter((entry) => /^EJS(?!预处理)/.test(entry.name));
assert.equal(ejsRoutes.length, 9, '动态 EJS 路由数量异常');
for (const route of ejsRoutes) {
  assert.match(route.content, /const twEarthActive =/, `${route.name} 必须自包含激活状态读取，不能依赖预处理执行顺序`);
  assert.match(route.content, /const twEarthBook =/, `${route.name} 必须自包含世界书名读取`);
}
assert.equal(diagnoseEarthWorldbook(entries, [], []).status, 'not-installed');
assert.equal(diagnoseEarthWorldbook(entries, [], [], { canCreate: false, canAppend: false, canAttach: false }).canCreate, false);
assert.equal(diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries }], []).status, 'installed-unmounted');
assert.equal(diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries }], [EARTH_WORLD_BOOK_SEED.recommendedName]).status, 'mounted');
assert.equal(diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries: [] }], []).status, 'empty-snapshot');
const missing = diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries: entries.slice(1) }], []); assert.equal(missing.status, 'missing-entries'); assert.equal(missing.canRepairMissing, true);
assert.equal(diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries: entries.slice(1) }], [], { canCreate: false, canAppend: false, canAttach: false }).canRepairMissing, false);
assert.equal(diagnoseEarthWorldbook(entries, [{ name: 'a', entries }, { name: 'b', entries }], []).status, 'conflict');
const duplicate = diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries: [...entries, entries[0]] }], []); assert.equal(duplicate.status, 'duplicate-entries'); assert.equal(duplicate.canRepairMissing, false);
const edited = structuredClone(entries); edited[1].content = 'user edit'; assert.equal(diagnoseEarthWorldbook(entries, [{ name: EARTH_WORLD_BOOK_SEED.recommendedName, entries: edited }], []).status, 'user-modified');
console.log(`Earth worldbook seed/diagnostics: OK (${entries.length} entries, ${EARTH_WORLD_BOOK_SEED.sourceSha256})`);
