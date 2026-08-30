import assert from 'node:assert/strict';
import { importWorldbookPackage, parseContentPackage } from '../src/services/contentPackage.ts';
import { createUserDlcId, normalizeUserDlcs } from '../src/services/userDlcRegistry.ts';

const worldbook = parseContentPackage({ originalData: { name: '测试剧情' }, entries: { 0: { uid: 0, comment: '开端', content: '旧', key: [], disable: false } } });
assert.equal(worldbook.kind, 'worldbook');
assert.equal(worldbook.name, '测试剧情');
assert.equal(worldbook.entries.length, 1);
const script = parseContentPackage({ type: 'script', id: 's1', name: '测试脚本', content: 'void 0' });
assert.equal(script.kind, 'script');
assert.equal(script.name, '测试脚本');
assert.throws(() => parseContentPackage({ entries: { 0: { comment: '重复' }, 1: { comment: '重复' } } }), /重名/);

const books = new Map();
const adapter = {
  async listNames() { return [...books.keys()]; },
  async read(name) { return books.get(name) ?? []; },
  async create(name, entries) { books.set(name, entries); },
  async appendMissing(name, entries) { books.set(name, [...(books.get(name) ?? []), ...entries]); },
  async mergeEntries(name, incoming, retiredNames = []) {
    const retired = new Set(retiredNames); const before = books.get(name) ?? []; const current = before.filter(entry => !retired.has(entry.name));
    const byName = new Map(incoming.map(entry => [entry.name, entry])); let updated = 0;
    const merged = current.map(entry => { const replacement = byName.get(entry.name); if (!replacement) return entry; byName.delete(entry.name); updated += 1; return replacement; });
    books.set(name, [...merged, ...byName.values()]); return { added: byName.size, updated, removed: before.length - current.length };
  },
};
assert.deepEqual(await importWorldbookPackage(adapter, worldbook, 'safe-merge'), { created: true, added: 1, updated: 0, removed: 0 });
const update = parseContentPackage({ name: '测试剧情', entries: { 0: { comment: '开端', content: '新' }, 1: { comment: '后续', content: '增' } } });
assert.deepEqual(await importWorldbookPackage(adapter, update, 'safe-merge'), { created: false, added: 1, updated: 0, removed: 0 });
assert.equal(books.get('测试剧情')[0].content, '旧');
assert.deepEqual(await importWorldbookPackage(adapter, update, 'replace-matching'), { created: false, added: 0, updated: 2, removed: 0 });
assert.equal(books.get('测试剧情')[0].content, '新');
books.set('万年仇怨', [{ name: '天华帝国历史', content: '旧史' }]);
const wanNian = parseContentPackage({ name: '万年仇怨', entries: { 0: { comment: '往昔历史', content: '新史' }, 1: { comment: '人物详情: 中枢-迷', content: '新角色' } } });
assert.deepEqual(await importWorldbookPackage(adapter, wanNian, 'replace-matching'), { created: false, added: 2, updated: 0, removed: 1 });
assert.deepEqual(books.get('万年仇怨').map(entry => entry.name), ['往昔历史', '人物详情: 中枢-迷']);
const firstId = createUserDlcId('测试 DLC'); const secondId = createUserDlcId('测试 DLC');
assert.notEqual(firstId, secondId, '同名新建 DLC 也必须获得不同唯一 ID');
assert.deepEqual(normalizeUserDlcs([{ id: firstId, name: '测试 DLC', worldbookName: '测试剧情', scriptId: null, scriptName: null, importedAt: 'now' }]), [{ id: firstId, name: '测试 DLC', worldbookName: '测试剧情', scriptId: null, scriptName: null, importedAt: 'now' }]);
console.log('Content package fixtures: OK');
