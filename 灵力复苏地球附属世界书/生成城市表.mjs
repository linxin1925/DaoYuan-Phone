import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { earthCityRows } from './地球城市数据.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const clean = value => String(value).replaceAll('|', '｜').replaceAll('\n', ' ');
const lines = [
  '# 地球城市与特殊节点总表',
  '',
  '> 共30个节点：26个地球城市或分布式网络节点，4个相交秘境阶段性功能区。未来发展不是开局既成事实。',
  '',
  '| # | 节点 | 归属 | 类型 | 主要定位 | 开局状态 | 关键NPC | 核心矛盾 | 当前异常 | 未来可能 |',
  '|---:|---|---|---|---|---|---|---|---|---|',
];

earthCityRows.forEach(([name, affiliation, nodeType, , role, openingState, , npcs, conflict, anomaly, development], index) => {
  lines.push(`| ${index + 1} | ${clean(name)} | ${clean(affiliation)} | ${clean(nodeType)} | ${clean(role)} | ${clean(openingState)} | ${clean(npcs.length ? npcs.join('、') : '随剧情产生')} | ${clean(conflict)} | ${clean(anomaly)} | ${clean(development)} |`);
});

fs.writeFileSync(path.join(root, '地球城市与特殊节点总表.md'), `${lines.join('\n')}\n`, 'utf8');
console.log(`generated city table: ${earthCityRows.length} rows`);
