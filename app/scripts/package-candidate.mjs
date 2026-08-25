import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const contentBeautifierPath = new URL('./vendor/daoyuan-content-beautify-v26-formal.script.json', projectRoot);
const CONTENT_BEAUTIFIER_ID = 'daoyuan-content-beautify-script-v26';
const CONTENT_BEAUTIFIER_SHA256 = '43e57a3f2b29596f2363d1657857d77b56e3aee31f9d4967aab9f40aa585773d';
const CONTENT_BEAUTIFIER_INSTALLER = '__daoyuanInstallContentBeautifierV26';
const CONTENT_BEAUTIFIER_ENABLED_KEY = 'daoyuan_content_beautifier_enabled_v1';
const formal = process.argv.includes('--formal');
const v11Test = process.argv.includes('--v11-test');
const v11 = formal || v11Test;
const outputPath = new URL(v11 ? `./dist/道渊功能前端-V1.1${formal ? '正式' : '测试'}候选.json` : './dist/道渊功能前端-V1.0测试候选.json', projectRoot);
const packageName = v11 ? `道渊小手机V1.1${formal ? '' : '测试'}` : '道渊小手机V1.0测试';
const importOutputPath = new URL(formal ? '../releases/道渊小手机V1.1.json' : v11Test ? './dist/道渊小手机V1.1测试.json' : './dist/道渊小手机V1.0测试.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');
const contentBeautifierBytes = await readFile(contentBeautifierPath);
const contentBeautifierHash = createHash('sha256').update(contentBeautifierBytes).digest('hex');
if (contentBeautifierHash !== CONTENT_BEAUTIFIER_SHA256) {
  throw new Error(`V26 正文美化快照哈希不匹配：${contentBeautifierHash}`);
}
const contentBeautifier = JSON.parse(contentBeautifierBytes.toString('utf8'));
if (contentBeautifier?.type !== 'script' || contentBeautifier?.id !== CONTENT_BEAUTIFIER_ID || typeof contentBeautifier?.content !== 'string' || !contentBeautifier.content.trim()) {
  throw new Error('V26 正文美化快照结构或稳定 ID 不符合预期');
}
const contentBeautifierBootstrap = `\n;globalThis.${CONTENT_BEAUTIFIER_INSTALLER}=()=>{\n${contentBeautifier.content}\n};\n(()=>{let enabled=true;try{const storage=window.parent?.localStorage??localStorage;enabled=storage.getItem('${CONTENT_BEAUTIFIER_ENABLED_KEY}')!=='false';}catch{}if(enabled)globalThis.${CONTENT_BEAUTIFIER_INSTALLER}();})();\n`;
const bundledSource = v11 ? `${source}${contentBeautifierBootstrap}` : source;

if (importOutputPath.pathname.endsWith('/道渊小手机V0.9.json') || importOutputPath.pathname.endsWith('/道渊小手机V1.0.json')) {
  throw new Error('V1.1 打包护栏：禁止覆盖 V0.9/V1.0 正式文件');
}

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: packageName,
  version: v11 ? '1.1.0' : '1.0.0',
  scriptId: 'daoyuan-feature-frontend-hud-v09',
  enabled: true,
  runtimeStatus: v11 ? 'Chrome/SillyTavern 已完成旧命中区根因测量；最终窄命中修正版仍需导入后人工点击验收' : '待目标 SillyTavern 环境执行回归',
  scope: v11 ? 'V1.1：完整保留 V1.0 功能与 DSH 双 video 桌宠；内置带小手机总开关的 V26 正文美化阅读器，支持姓名大括号对白协议，并保留全局 content 兼容扫描、独立术语注解开关与原有持久化' : 'V1.0 测试候选',
  dataBoundary: {
    chatVariables: ['daoyuan_yujian_data', 'daoyuan_web_beauty_data', 'daoyuan_web_trends_data', 'daoyuan_forum_data', 'daoyuan_news_data', 'daoyuan_map_state'],
    statDataWrites: ['stat_data.主角.储物袋', 'stat_data.主角.器物', 'stat_data.主角.功法', 'stat_data.主角.极品灵石', 'stat_data.主角.上品灵石', 'stat_data.主角.中品灵石', 'stat_data.主角.下品灵石'],
    worldData: 'latest-message-floor-read-and-restricted-write',
  },
  artifact: {
    file: '道渊功能前端.js',
    bytes: Buffer.byteLength(bundledSource),
    content: bundledSource,
  },
};

await mkdir(new URL('./dist/', projectRoot), { recursive: true });
await writeFile(outputPath, JSON.stringify(candidate, null, 2));

// Tavern Helper script-library import shape. Keep this separate from the
// audit candidate above: the latter intentionally carries project metadata,
// while this object matches the script import contract used by the project.
const importableScript = {
  type: 'script',
  version: v11 ? '1.1.0' : '1.0.0',
  enabled: true,
  name: packageName,
  id: 'daoyuan-feature-frontend-hud-v09',
  content: bundledSource,
  info: v11 ? `道渊小手机 V1.1${formal ? '' : ' 测试版'}：完整保留 V1.0 功能与 DSH 双 video 桌宠；内置带小手机总开关的 V26 正文美化阅读器，支持 {角色标准姓名}“台词”协议，兼容旧对白格式，并保留全局 content 扫描、独立术语开关及设置持久化。` : '道渊小手机 V1.0 测试候选。',
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
