import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const outputPath = new URL('./dist/道渊功能前端-常驻脚本候选.json', projectRoot);
const importOutputPath = new URL('./dist/道渊小手机V0.7.json', projectRoot);
const testOutputPath = new URL('./dist/道渊功能前端-紫薇桌宠-主线注入测试.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: '道渊小手机V0.7',
  version: '0.7.0',
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
  name: '道渊小手机V0.7',
  id: 'daoyuan-feature-frontend-hud',
  content: source,
  info: '道渊功能前端正式集成版：紫薇序列帧桌宠、天机阁随身玉简与 390×844 手机比例 UI。绝色榜使用独立 API；仙网风闻、仙网论坛与天机日报共用仙网内容 API。自动生成只在 AI 正文完成且 MVU 开始解析该正文层时触发；设置中可分别选择玉简、风闻、论坛、日报是否注入后续主线，默认全部关闭；注入不写改 MVU stat_data。',
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
await writeFile(testOutputPath, JSON.stringify({
  ...importableScript,
  name: '道渊功能前端 · 紫薇桌宠 · 主线注入测试',
  id: 'daoyuan-feature-frontend-hud-injection-test',
  info: `${importableScript.info}｜仅供本地酒馆手机兼容性验收，不作为正式交付。`,
}, null, 2));
console.log(`candidate package written: ${outputPath.pathname}`);
console.log(`Tavern Helper import package written: ${importOutputPath.pathname}`);
console.log(`mobile injection test package written: ${testOutputPath.pathname}`);
