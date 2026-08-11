import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const outputPath = new URL('./dist/道渊功能前端-常驻脚本候选.json', projectRoot);
const importOutputPath = new URL('./dist/道渊功能前端-酒馆助手脚本.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: '道渊功能前端 · 天机阁随身玉简',
  version: '0.1.0',
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
  name: '道渊功能前端 · 天机阁随身玉简',
  id: 'daoyuan-feature-frontend-hud',
  content: source,
  info: '道渊功能前端：常驻脚本、玉简悬浮入口、390×844 手机比例 UI。绝色榜使用独立 API；仙网风闻、仙网论坛与天机日报共用另一套仙网内容 API。四项 AI 内容均可按用户设置的楼层间隔，在 MVU VARIABLE_UPDATE_STARTED 时自动生成；风闻、论坛和日报分别支持生成数量与旧内容保留上限。论坛采用列表与全文详情，日报采用报纸列表与整期详情，最新内容置顶。自管数据写入 chat 变量，不读取或写回 MVU stat_data。',
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
