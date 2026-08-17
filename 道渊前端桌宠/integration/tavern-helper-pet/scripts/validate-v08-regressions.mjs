import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTypescript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = await importTypescript('../src/services/yujianStorage.ts');
const alias = await importTypescript('../src/services/playerAlias.ts');
const location = await importTypescript('../src/services/locationFormat.ts');
const host = { localStorage: new MemoryStorage(), indexedDB: undefined };
const originalWarn = console.warn;
console.warn = () => {};

await storage.writeYujianHistories(host, 'chat-a', { 紫薇: [{ from: 'me', text: '甲对话', time: '10:00' }] });
await storage.writeYujianHistories(host, 'chat-b', { 紫薇: [{ from: 'them', text: '乙对话', time: '10:01' }] });
assert.equal((await storage.readYujianHistories(host, 'chat-a')).紫薇[0].text, '甲对话');
assert.equal((await storage.readYujianHistories(host, 'chat-b')).紫薇[0].text, '乙对话');

const legacyHost = { localStorage: new MemoryStorage(), indexedDB: undefined };
legacyHost.localStorage.setItem('daoyuan_yujian_standalone_v1', JSON.stringify({ 'legacy-chat': { 紫薇: [{ from: 'them', text: '旧记录仍可读', time: '昨日' }] } }));
assert.equal((await storage.readYujianHistories(legacyHost, 'legacy-chat')).紫薇[0].text, '旧记录仍可读');

await storage.writeYujianHistories(host, 'chat-cap', {
  道友: Array.from({ length: 130 }, (_, index) => ({ from: 'me', text: `${index}`.repeat(9000), time: '现在' })),
});
const capped = (await storage.readYujianHistories(host, 'chat-cap')).道友;
assert.equal(capped.length, 100);
assert.equal(capped.at(-1).text.length, 8000);

await storage.writeProcessedYujianStories(host, 'chat-a', Array.from({ length: 700 }, (_, index) => `floor:${index}`));
assert.equal((await storage.readProcessedYujianStories(host, 'chat-a')).length, 600);

assert.equal(alias.normalizePlayerAlias('  道\u0000友  '), '道友');
assert.equal(alias.normalizePlayerAlias('   '), '我');
assert.equal(Array.from(alias.normalizePlayerAlias('甲'.repeat(40))).length, 24);
assert.equal(location.formatWorldLocation('中央神州·东南部·清风坊市·天字号客栈卧房'), '中央神州·东南部·清风坊市');
assert.equal(location.formatWorldLocation('  未知地点  '), '未知地点');
assert.equal(location.formatWorldLocation(''), '未接入');
console.warn = originalWarn;

const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const yujianRuntimeSource = await readFile(new URL('../src/services/yujianRuntime.ts', import.meta.url), 'utf8');
for (const moduleName of ['trends', 'forum', 'news']) {
  assert.match(indexSource, new RegExp(`${moduleName}: parse(?:Trends|Forum|News)Data`));
}
assert.equal((indexSource.match(/triggeredMessageIds\.includes\(messageId\)/g) ?? []).length >= 3, true);
assert.match(yujianRuntimeSource, /getMvuData\(scope\)/);
assert.match(yujianRuntimeSource, /storyTime\.trim\(\) \|\| '未知时间'/);
assert.doesNotMatch(yujianRuntimeSource, /const now = new Date\(\);/);
assert.match(indexSource, /readYujianStoryTime\(mvuWindow, messageId\)/);
assert.match(indexSource, /this\.session\.messageId\);/);

console.log('V0.8 regressions passed: chat isolation / caps / alias / location / reroll guards / story time');
