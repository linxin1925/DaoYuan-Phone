import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const outputPath = new URL('./dist/道渊功能前端-V0.8正式候选.json', projectRoot);
const importOutputPath = new URL('../../道渊小手机V0.8.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: '道渊小手机V0.8',
  version: '0.8.0',
  scriptId: 'daoyuan-feature-frontend-hud',
  enabled: true,
  runtimeStatus: '待真机探测：Tavern Helper 导入包装与目标版本能力',
  scope: '阶段 0/1：常驻脚本、宿主悬浮球、桌面浮窗/手机抽屉、单例 iframe UI',
  dataBoundary: {
    chatVariables: ['daoyuan_yujian_data', 'daoyuan_web_beauty_data', 'daoyuan_web_trends_data', 'daoyuan_forum_data', 'daoyuan_news_data', 'daoyuan_map_state'],
    statDataWrites: [],
    worldData: 'optional-read-only-probe',
  },
  artifact: {
    file: '道渊功能前端.js',
    bytes: Buffer.byteLength(source),
    content: source,
  },
};

await mkdir(new URL('./dist/', projectRoot), { recursive: true });
await writeFile(outputPath, JSON.stringify(candidate, null, 2));

// Tavern Helper script-library import shape. Keep this separate from the
// audit candidate above: the latter intentionally carries project metadata,
// while this object matches the script import contract used by the project.
const importableScript = {
  type: 'script',
  enabled: true,
  name: '道渊小手机V0.8',
  id: 'daoyuan-feature-frontend-hud',
  content: source,
  info: '道渊小手机 V0.8：玉简历史迁移至按酒馆 chatId 隔离的 IndexedDB，并按对应楼层 stat_data 显示故事时间；新增玩家网名、缩小三档紫薇桌宠、三段式地点，并修正论坛与日报重 Roll。',
  button: {
    enabled: false,
    buttons: [],
  },
  data: {},
  export_with: {
    data: true,
    button: true,
  },
};

await writeFile(importOutputPath, JSON.stringify(importableScript, null, 2));
console.log(`candidate package written: ${outputPath.pathname}`);
console.log(`Tavern Helper import package written: ${importOutputPath.pathname}`);
