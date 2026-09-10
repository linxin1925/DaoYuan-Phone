import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { XUANTIAN_RULE_BOOK_SEED, xuantianRulebookEntries } from '../src/xuantianSimulation/worldbookSeed.ts';

const root = resolve(import.meta.dirname, '..', '..');
const sourceBytes = await readFile(resolve(root, '玄天界推演规则书/道渊·玄天界世界推演规则书.json'));
const source = JSON.parse(sourceBytes.toString('utf8'));
const entries = xuantianRulebookEntries();
assert.equal(XUANTIAN_RULE_BOOK_SEED.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
assert.equal(entries.length, Object.keys(source.entries).length);
assert.equal(entries.length, 16);
assert.equal(new Set(entries.map(entry => entry.name)).size, entries.length);
const ejs = entries.filter(entry => entry.name.startsWith('玄天界EJS'));
assert.equal(ejs.length, 2);
for (const entry of ejs) {
  assert.match(entry.content, /^@@generate_before\n@@always_enabled\n/);
  assert.equal(entry.enabled, false);
  assert.match(entry.content, /getwi/);
}
assert.match(ejs.find(entry => entry.name.includes('事件路由')).content, /daoyuan_xuantian_simulation_v1/);
assert.match(entries.find(entry => entry.name.includes('事件因果')).content, /5%只表示刚出现苗头/);
assert.match(entries.find(entry => entry.name.includes('作品技法')).content, /凡人修仙传/);
assert.match(entries.find(entry => entry.name.includes('质量门')).content, /自由游玩|保持安静/);
console.log('Xuantian simulation worldbook validation passed.');
