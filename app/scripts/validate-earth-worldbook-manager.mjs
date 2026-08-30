import assert from 'node:assert/strict';
import { EarthWorldbookManager } from '../src/earthSimulation/worldbookManager.ts';
import { EARTH_WORLD_BOOK_NAME } from '../src/earthSimulation/types.ts';
import { earthWorldbookEntries } from '../src/earthSimulation/worldbookSeed.ts';

const books = new Map(); let mounted = []; let primary = '主世界书';
const adapter = {
  async listNames() { return [...books.keys()]; }, async read(name) { return structuredClone(books.get(name) ?? []); }, async getMountedNames() { return [primary, ...mounted]; },
  async create(name, entries) { assert.equal(books.has(name), false); books.set(name, structuredClone(entries)); },
  async appendMissing(name, entries) { books.set(name, [...(books.get(name) ?? []), ...structuredClone(entries)]); },
  async updateContent(name, desired) { let changed = false; books.set(name, books.get(name).map((entry) => { const content = desired.get(entry.name); if (content === undefined || content === entry.content) return entry; changed = true; return { ...entry, content }; })); return changed; },
  async attach(names) { mounted = [...new Set([...mounted, ...names.filter((name) => name !== primary)])]; },
};
const manager = new EarthWorldbookManager({ adapter });
assert.equal((await manager.refresh()).status, 'not-installed');
assert.equal((await manager.install()).status, 'installed-unmounted');
assert.equal((await manager.attach()).status, 'mounted'); assert.equal(primary, '主世界书');
assert.equal((await manager.readMountedEntries()).length, earthWorldbookEntries().length);
books.set(EARTH_WORLD_BOOK_NAME, books.get(EARTH_WORLD_BOOK_NAME).slice(1));
assert.equal((await manager.refresh()).status, 'missing-entries');
assert.equal((await manager.repairMissing()).status, 'mounted');
books.get(EARTH_WORLD_BOOK_NAME)[1].content = 'user edit';
assert.equal((await manager.refresh()).status, 'user-modified');
const route = books.get(EARTH_WORLD_BOOK_NAME).find((entry) => entry.name === 'EJS地球基础路由'); route.content = 'broken route';
await manager.repairMissing();
assert.equal((await manager.readMountedEntries())[1].content, 'user edit', '普通用户修改必须保留');
assert.notEqual(books.get(EARTH_WORLD_BOOK_NAME).find((entry) => entry.name === 'EJS地球基础路由').content, 'broken route', '内置 EJS 路由必须可定向修复');
console.log(`Earth worldbook manager: OK (${earthWorldbookEntries().length} entries, mounted read, safe repair, user edits preserved)`);
