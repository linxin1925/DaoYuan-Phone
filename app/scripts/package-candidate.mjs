import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const outputPath = new URL('./dist/道渊功能前端-V0.9正式候选.json', projectRoot);
const formal = process.argv.includes('--formal');
const packageName = formal ? '道渊小手机V0.9' : '道渊小手机V0.9测试';
const importOutputPath = new URL(formal ? '../releases/道渊小手机V0.9.json' : './dist/道渊小手机V0.9测试.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');

if (importOutputPath.pathname.endsWith('/道渊小手机V0.8.json')) {
  throw new Error('V0.9 打包护栏：禁止写入 V0.8 正式文件');
}

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: '道渊小手机V0.9',
  version: '0.9.0',
  scriptId: 'daoyuan-feature-frontend-hud-v09',
  enabled: true,
  runtimeStatus: '待目标 SillyTavern 环境执行正式发布回归',
  scope: 'V0.9：万宝商行功能；万年仇怨、合欢宗、洛阳、蜀山四本 DLC 世界书的缺失安装、附属挂载、只补缺失条目、独立开关及地点/境界自动控制；受限 MVU 读写和状态栏同步',
  dataBoundary: {
    chatVariables: ['daoyuan_yujian_data', 'daoyuan_web_beauty_data', 'daoyuan_web_trends_data', 'daoyuan_forum_data', 'daoyuan_news_data', 'daoyuan_map_state'],
    statDataWrites: ['stat_data.主角.储物袋', 'stat_data.主角.器物', 'stat_data.主角.功法', 'stat_data.主角.极品灵石', 'stat_data.主角.上品灵石', 'stat_data.主角.中品灵石', 'stat_data.主角.下品灵石'],
    worldData: 'latest-message-floor-read-and-restricted-write',
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
  name: packageName,
  id: 'daoyuan-feature-frontend-hud-v09',
  content: source,
  info: `道渊小手机 V0.9${formal ? '' : ' 测试版'}：包含万宝商行，以及万年仇怨、合欢宗·百花谷、洛阳、蜀山剑门四本 DLC 世界书的缺失安装、附属挂载、只补缺失条目、独立开关和地点/境界自动控制。默认关闭 DLC，不覆盖角色主世界书。`,
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
