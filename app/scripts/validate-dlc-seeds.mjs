import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const cases = [
  ['wanNianChouYuan.json', '道渊世界观剧情拓展/万年仇怨/万年仇怨.json', 'wan_nian_chou_yuan'],
  ['heHuanZong.json', '道渊世界观剧情拓展/合欢宗拓展/合欢宗扩展.json', 'he_huan_zong'],
  ['luoYang.json', '道渊世界观剧情拓展/洛阳拓展/洛阳扩展.json', 'luo_yang'],
  ['shuShan.json', '道渊世界观剧情拓展/蜀山拓展/蜀山扩展2.0.json', 'shu_shan'],
];

for (const [seedName, sourceName, expectedId] of cases) {
  const seed = JSON.parse(await readFile(resolve(root, 'app/src/dlc/seeds', seedName), 'utf8'));
  const source = JSON.parse(await readFile(resolve(root, sourceName), 'utf8'));
  const sourceEntries = Object.values(source.entries ?? {});
  if (seed.schemaVersion !== 1 || seed.id !== expectedId) throw new Error(`${seedName}: invalid identity`);
  if (seed.entries.length !== sourceEntries.length) throw new Error(`${seedName}: entry count mismatch`);
  const sourceByUid = new Map(sourceEntries.map((entry, index) => [String(entry.uid ?? Object.keys(source.entries)[index]), entry]));
  for (const entry of seed.entries) {
    const original = sourceByUid.get(entry.uid);
    if (!original || JSON.stringify(original) !== JSON.stringify(entry.sourceEntry)) throw new Error(`${seedName}: source mismatch for ${entry.uid}`);
    if (!['core', 'detail', 'stage', 'unmanaged'].includes(entry.entryClass)) throw new Error(`${seedName}: invalid class`);
  }
  console.log(`${seedName}: OK (${seed.entries.length} entries)`);
}
