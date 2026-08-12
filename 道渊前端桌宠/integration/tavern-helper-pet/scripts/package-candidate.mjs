import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const outputPath = new URL('./dist/道渊功能前端-常驻脚本候选.json', projectRoot);
const importOutputPath = new URL('./dist/道渊小手机V1.5-preview.json', projectRoot);
const testOutputPath = new URL('./dist/道渊功能前端-紫薇桌宠-主线注入测试.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: '道渊小手机V1.5 Preview',
  version: '1.5.0-preview.0',
  scriptId: 'daoyuan-feature-frontend-hud-v15',
  enabled: true,
  runtimeStatus: '测试中：等待真实酒馆双包导入与运行时回归',
  scope: 'V1.5 阶段 5：Vue UI、手机/桌面双布局与 V0.7 并行兼容预览验证',
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
  name: '道渊小手机V1.5 Preview',
    id: 'daoyuan-feature-frontend-hud-v15',
  content: source,
  info: '道渊小手机 V1.5 Vue 重构预览版：仅用于分支验收，不覆盖 V0.7 正式包。',
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
