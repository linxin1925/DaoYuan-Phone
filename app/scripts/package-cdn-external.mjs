import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const projectRoot = new URL('../..', import.meta.url);
const embeddedPackagePath = new URL('./releases/candidates/道渊小手机V1.2测试.json', projectRoot);
const runtimeOutputPath = new URL('./releases/cdn/道渊小手机V1.2外链运行时.js', projectRoot);
const manifestOutputPath = new URL('./releases/cdn/道渊小手机V1.2版本清单.json', projectRoot);
const loaderOutputPath = new URL('./releases/candidates/道渊小手机V1.2-CDN外链版.json', projectRoot);
const runtimeOnly = process.argv.includes('--runtime-only');
const refIndex = process.argv.indexOf('--ref');
const gitRef = refIndex >= 0 ? process.argv[refIndex + 1] : '';

const embeddedPackage = JSON.parse(await readFile(embeddedPackagePath, 'utf8'));
if (embeddedPackage?.type !== 'script' || typeof embeddedPackage?.content !== 'string' || !embeddedPackage.content.trim()) {
  throw new Error('道渊小手机 V1.2 内嵌测试包结构无效');
}

await mkdir(new URL('./releases/cdn/', projectRoot), { recursive: true });
await writeFile(runtimeOutputPath, embeddedPackage.content);
console.log(`CDN runtime written: ${runtimeOutputPath.pathname}`);

if (runtimeOnly) process.exit(0);
if (!/^[0-9a-f]{7,40}$/i.test(gitRef)) throw new Error('请通过 --ref 传入已包含 CDN 运行时的 Git 提交号');

const encodedRuntimePath = '%E9%81%93%E6%B8%8A%E5%B0%8F%E6%89%8B%E6%9C%BAV1.2%E5%A4%96%E9%93%BE%E8%BF%90%E8%A1%8C%E6%97%B6.js';
const encodedManifestPath = '%E9%81%93%E6%B8%8A%E5%B0%8F%E6%89%8B%E6%9C%BAV1.2%E7%89%88%E6%9C%AC%E6%B8%85%E5%8D%95.json';
const primaryUrl = `https://gcore.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@${gitRef}/releases/cdn/${encodedRuntimePath}`;
const fallbackUrl = `https://testingcf.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@${gitRef}/releases/cdn/${encodedRuntimePath}`;
const manifest = {
  schemaVersion: 1,
  channel: 'v1.2-main',
  version: embeddedPackage.version ?? '1.2.0',
  commit: gitRef,
  runtimePath: 'releases/cdn/道渊小手机V1.2外链运行时.js',
  runtimeSha256: createHash('sha256').update(embeddedPackage.content).digest('hex'),
  publishedAt: new Date().toISOString(),
};
await writeFile(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`CDN manifest written: ${manifestOutputPath.pathname}`);

const manifestUrls = [
  `https://raw.githubusercontent.com/linxin1925/DaoYuan-Phone/main/releases/cdn/${encodedManifestPath}`,
  `https://testingcf.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@main/releases/cdn/${encodedManifestPath}`,
];
const loaderSource = `(()=>{const manifests=${JSON.stringify(manifestUrls)},fallback=${JSON.stringify([primaryUrl, fallbackUrl])},path='${encodedRuntimePath}',validRef=value=>/^[0-9a-f]{7,40}$/i.test(value);const runtimeUrls=ref=>[\`https://gcore.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@\${ref}/releases/cdn/\${path}\`,\`https://testingcf.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@\${ref}/releases/cdn/\${path}\`];const readManifest=async()=>{let lastError;for(const base of manifests){try{const response=await fetch(\`\${base}?t=\${Date.now()}\`,{cache:'no-store'});if(!response.ok)throw new Error(\`HTTP \${response.status}\`);const value=await response.json();if(value?.schemaVersion!==1||!validRef(value?.commit))throw new Error('版本清单格式无效');return value;}catch(error){lastError=error;}}console.warn('[道渊小手机] 版本清单读取失败，将使用内置回退版本',lastError);return null;};const load=async()=>{const manifest=await readManifest(),urls=manifest?runtimeUrls(manifest.commit):fallback;let lastError;for(const url of urls){try{await import(url);return;}catch(error){lastError=error;}}console.error('[道渊小手机] CDN 外链运行时加载失败',lastError);};void load();})();`;

const loaderPackage = {
  type: 'script',
  version: '1.2.0-cdn',
  enabled: true,
  name: '道渊小手机V1.2',
  id: 'daoyuan-feature-frontend-hud-v12-cdn',
  content: loaderSource,
  info: `酒馆助手外链加载版；启动时读取 main 版本清单并加载固定提交运行时，清单不可用时回退至 ${gitRef}。`,
  button: { enabled: false, buttons: [] },
  data: {},
  export_with: { data: true, button: true },
};

await writeFile(loaderOutputPath, JSON.stringify(loaderPackage, null, 2));
console.log(`Tavern Helper CDN loader written: ${loaderOutputPath.pathname}`);
