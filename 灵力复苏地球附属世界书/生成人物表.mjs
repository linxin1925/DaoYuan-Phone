import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { earthMaleNpcNames, earthNpcApparentAge, earthNpcRows } from './地球NPC数据.mjs';
import { earthNpcDetailRows } from './地球NPC详情.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const details = new Map(earthNpcDetailRows.map(([name, age, appearance, deeds]) => [name, { age, appearance, deeds }]));
const clean = value => String(value).replaceAll('|', '｜').replaceAll('\n', ' ');

const lines = [
  '# 地球关键NPC总表',
  '',
  '> 第一版共72人：女性50人、男性22人。详细外貌和事迹以世界书人物档案为准，本表用于总览与后续逐人细化。',
  '',
  '| # | 姓名 | 性别 | 实际年龄 | 外表年龄 | 归属 | 职位 | 具体外貌 | 体系/能力 | 性格 | 代表事迹 |',
  '|---:|---|:---:|:---:|---|---|---|---|---|---|---|',
];

earthNpcRows.forEach(([name, affiliation, position, system, personality], index) => {
  const detail = details.get(name);
  if (!detail) throw new Error(`缺少人物详情: ${name}`);
  lines.push(`| ${index + 1} | ${clean(name)} | ${earthMaleNpcNames.has(name) ? '男' : '女'} | ${detail.age ?? '未知'} | ${clean(earthNpcApparentAge(detail.age, system))} | ${clean(affiliation)} | ${clean(position)} | ${clean(detail.appearance)} | ${clean(system)} | ${clean(personality)} | ${clean(detail.deeds.join(' '))} |`);
});

fs.writeFileSync(path.join(root, '地球关键NPC总表.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`generated NPC table: ${earthNpcRows.length} rows`);
