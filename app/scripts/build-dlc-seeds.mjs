import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const specs = [
  ['wan_nian_chou_yuan', '道渊DLC·万年仇怨', '道渊世界观剧情拓展/万年仇怨/万年仇怨.json', 'wanNianChouYuan.json', (name) => name.startsWith('进程') ? 'stage' : name.includes('机关生成') ? 'core' : 'detail'],
  ['he_huan_zong', '道渊DLC·合欢宗', '道渊世界观剧情拓展/合欢宗拓展/合欢宗扩展.json', 'heHuanZong.json', (name) => name.includes('设定') || name.includes('日常') ? 'core' : name.startsWith('人物详情') || name.startsWith('设施-') ? 'detail' : 'unmanaged'],
  ['luo_yang', '道渊DLC·洛阳', '道渊世界观剧情拓展/洛阳拓展/洛阳扩展.json', 'luoYang.json', (name) => name === '洛阳总览' || name === '洛阳日常' ? 'core' : 'detail'],
  ['shu_shan', '道渊DLC·蜀山', '道渊世界观剧情拓展/蜀山拓展/蜀山扩展2.0.json', 'shuShan.json', (name) => ['叙事基调', '入门登记', '日常课程与修炼', '年度大事', '部门总纲', '蜀山剑门', '各峰特化'].includes(name) ? 'core' : name.startsWith('人物详情') ? 'detail' : 'detail'],
];

for (const [id, recommendedName, source, filename, classify] of specs) {
  const input = JSON.parse(await readFile(resolve(root, source), 'utf8'));
  const entries = Object.entries(input.entries ?? {}).map(([uid, entry]) => ({
    uid: String(entry.uid ?? uid),
    name: String(entry.comment ?? `entry-${uid}`),
    entryClass: classify(String(entry.comment ?? '')),
    sourceEntry: entry,
  }));
  const output = resolve(root, 'app/src/dlc/seeds', filename);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify({ schemaVersion: 1, id, recommendedName, entries }, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${output} (${entries.length} entries)`);
}
