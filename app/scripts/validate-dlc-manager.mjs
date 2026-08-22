import assert from 'node:assert/strict';
import { ExpansionManager } from '../src/dlc/expansionManager.ts';
import { createTavernWorldbookAdapter, probeWorldbookRuntime } from '../src/dlc/worldbookAdapter.ts';

const seed = (id, name, entries) => ({ schemaVersion: 1, id, recommendedName: name, entries: entries.map((comment, index) => ({ uid: String(index), name: comment, entryClass: 'core', sourceEntry: { uid: index, comment, content: `content-${comment}`, key: [], constant: true } })) });
const seeds = {
  wan_nian_chou_yuan: seed('wan_nian_chou_yuan', '道渊DLC·万年仇怨', ['进程一: 萌动', '进程二: 爆发']),
  he_huan_zong: seed('he_huan_zong', '道渊DLC·合欢宗', ['百花谷设定补充【开始】', '地点-百花坊']),
  luo_yang: seed('luo_yang', '道渊DLC·洛阳', ['洛阳总览']),
  shu_shan: seed('shu_shan', '道渊DLC·蜀山', ['蜀山剑门', '飞霜峰', '镇岳峰', '人物详情: 姜梦']),
};
const books = new Map();
const mounted = [];
let managerUpdateCalls = 0;
const adapter = {
  async listNames() { return [...books.keys()]; },
  async read(name) { return books.get(name) ?? []; },
  async create(name, entries) { books.set(name, entries); },
  async appendMissing(name, entries) { books.set(name, [...(books.get(name) ?? []), ...entries.filter((entry) => !(books.get(name) ?? []).some((current) => current.comment === entry.comment))]); },
  async getMountedNames() { return [...mounted]; },
  async attach(names) { mounted.splice(0, mounted.length, ...names); },
  async updateEnabled(name, desired) { managerUpdateCalls += 1; let changed=false; books.set(name,(books.get(name)??[]).map(entry=>{const enabled=desired.get(entry.name);if(enabled===undefined||enabled===entry.enabled)return entry;changed=true;return{...entry,enabled};}));return changed; },
};
const manager = new ExpansionManager({ adapter, seeds });
assert.equal((await manager.refresh()).filter((item) => item.status === 'not-installed').length, 4);
assert.equal((await manager.installMissing()).filter((item) => item.status === 'installed-unmounted').length, 4);
assert.equal((await manager.attachMissing()).filter((item) => item.status === 'mounted').length, 4);
books.get('道渊DLC·洛阳').pop();
assert.equal((await manager.refresh()).find((item) => item.id === 'luo_yang')?.status, 'incompatible');
await manager.repairMissing();
assert.equal((await manager.refresh()).find((item) => item.id === 'luo_yang')?.status, 'mounted');
manager.setSettings({ wan_nian_chou_yuan: true, he_huan_zong: true, luo_yang: true, shu_shan: true });
await manager.applyAutomation({ stat_data: { 主角: { 境界: '金丹初期' }, 世界: { 当前地点: '大周仙朝·洛阳' } } });
assert.equal(books.get('道渊DLC·洛阳')[0].enabled, true, '洛阳地点应启用洛阳条目');
assert.equal(books.get('道渊DLC·合欢宗')[0].enabled, false, '不在百花谷时应关闭百花谷条目');
assert.equal(books.get('道渊DLC·合欢宗').find(entry=>entry.name==='地点-百花坊').enabled, false, '不在百花谷时应关闭新版百花坊地点条目');
assert.equal(books.get('道渊DLC·万年仇怨').find(entry=>entry.name==='进程二: 爆发').enabled, true, '金丹应进入进程二');
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='蜀山剑门').enabled, false, '不在蜀山时不应常驻蜀山基础设定');
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='人物详情: 姜梦').enabled, true, '不在蜀山时仍应保留人物关键词条目');
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='飞霜峰').enabled, false, '不在蜀山时不应启用峰脉详情');
const convergedUpdateCalls = managerUpdateCalls;
await manager.applyAutomation({ stat_data: { 主角: { 境界: '金丹初期' }, 世界: { 当前地点: '大周仙朝·洛阳' } } });
assert.equal(managerUpdateCalls, convergedUpdateCalls, '状态已收敛时不应调用整本世界书更新接口');
await manager.applyAutomation({ stat_data: { 主角: { 境界: '金丹初期' }, 世界: { 当前地点: '百花谷·百花坊' } } });
assert.equal(books.get('道渊DLC·合欢宗').find(entry=>entry.name==='地点-百花坊').enabled, true, '进入百花谷后应启用新版百花坊地点条目');
await manager.applyAutomation({ stat_data: { 主角: { 境界: '金丹初期' }, 世界: { 当前地点: '蜀山剑门·飞霜峰' } } });
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='蜀山剑门').enabled, true, '进入蜀山后应启用基础设定');
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='飞霜峰').enabled, true, '进入飞霜峰后应启用对应峰脉详情');
assert.equal(books.get('道渊DLC·蜀山').find(entry=>entry.name==='镇岳峰').enabled, false, '进入飞霜峰时不应启用其他峰脉详情');
books.get('道渊DLC·洛阳')[0].enabled = false;
assert.equal((await manager.refresh()).find((item) => item.id === 'luo_yang')?.status, 'mounted', '自动启停不应被误判为用户修改');
books.get('道渊DLC·洛阳')[0].content = 'user edit';
assert.equal((await manager.refresh()).find((item) => item.id === 'luo_yang')?.status, 'user-modified', '正文变化应标记用户修改版');
const probe = probeWorldbookRuntime({ getWorldbookNames(){return[];}, getWorldbook:async()=>[], createWorldbook:async()=>true, createWorldbookEntries:async()=>({}), updateWorldbookWith:async(_name,updater)=>updater([]), getCharWorldbookNames:()=>({primary:'main',additional:[]}), rebindCharWorldbooks:async()=>{} });
assert.deepEqual({ list:probe.canList, read:probe.canRead, create:probe.canCreate, append:probe.canAppend, update:probe.canUpdate, attach:probe.canAttach }, { list:true, read:true, create:true, append:true, update:true, attach:true });
let runtimeEntries = [{ uid: 1, name: '百花谷设定', enabled: false }];
let runtimeRenderMode = '';
const runtimeAdapter = createTavernWorldbookAdapter({
  getWorldbookNames: () => ['道渊DLC·合欢宗'], getWorldbook: async () => runtimeEntries,
  updateWorldbookWith: async (_name, updater, options) => { runtimeRenderMode = options?.render ?? ''; runtimeEntries = updater(runtimeEntries); return runtimeEntries; },
});
assert.equal(await runtimeAdapter.updateEnabled('道渊DLC·合欢宗', new Map([['百花谷设定', true]])), true);
assert.equal(runtimeRenderMode, 'immediate', '状态变化应由酒馆助手在保存后立即刷新编辑器');
assert.equal(await runtimeAdapter.updateEnabled('道渊DLC·合欢宗', new Map([['百花谷设定', true]])), false);
const emptySnapshotAdapter = createTavernWorldbookAdapter({
  getWorldbookNames: () => ['道渊DLC·合欢宗'], getWorldbook: async () => [],
  updateWorldbookWith: async (_name, updater) => updater([]),
});
await assert.rejects(() => emptySnapshotAdapter.updateEnabled('道渊DLC·合欢宗', new Map([['百花谷设定', true]])), /运行时快照不完整/);
await assert.rejects(() => runtimeAdapter.updateEnabled('道渊DLC·合欢宗', new Map()), /期望条目为空/);
console.log('DLC manager fixtures: OK');
