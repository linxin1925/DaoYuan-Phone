import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { loadCdnPhone } from './cdn-phone-loader.mjs';

// The deployed database runtime predates the source tree's database build.
const [input, output, builtAt] = process.argv.slice(2);
if (!input || !output || input === output || !Number.isFinite(Date.parse(builtAt))) {
  throw new Error('Usage: node attach-phone-update-to-cdn.mjs <deployed-runtime> <output> <built-at>');
}
const baseline = await readFile(input, 'utf8');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
if (sha256(baseline) !== 'aa8414718d7def26c071dd3570ebce16fe73f12ba17fd729961565b24bb0d6d2') {
  throw new Error('Unexpected deployed runtime baseline');
}

const updatePage = `if(ot==="phone-update"){
const update=globalThis.__daoyuanPhoneUpdate;
const state=update.state();
b.append(G(e,"settings-back-button","← 返回设置","settings-home"));
it(e,b,"小手机更新","更新会刷新酒馆，并保留现有设置。");
const panel=ze(e,b,"当前运行 · "+state.current,state.available?"可更新到 · "+state.available:"手动检查小手机外链版本");
const status=c(e,"p","notice",state.failed?"上次更新未能启动，已回退。 "+state.status:state.status);
status.setAttribute("role","status");
const check=G(e,"secondary-button settings-panel-save","检查更新","phone-update-check");
check.disabled=state.busy;
panel.append(status,check);
if(state.available){
const apply=G(e,"primary-button settings-panel-save","一键更新","phone-update-apply");
apply.disabled=state.busy;
panel.append(apply);
}
return
}`;
const edits = [
  ['if(ot==="config-helper"){', updatePage + 'if(ot==="config-helper"){'],
  ['scope:"显示设置"}],E=new Set', 'scope:"显示设置"},{key:"phone-update",icon:"更",title:"小手机更新",note:"检查并重新加载外链脚本",scope:globalThis.__daoyuanPhoneUpdate.state().available?"有更新":"外链版本"}],E=new Set'],
  ['"app-card-title",v.label)', '"app-card-title",v.key==="settings"&&globalThis.__daoyuanPhoneUpdate.state().available?"设置 · 有更新":v.label)'],
  ['else if(E==="settings-open")', 'else if(E==="phone-update-check")void globalThis.__daoyuanPhoneUpdate.check();else if(E==="phone-update-apply")void globalThis.__daoyuanPhoneUpdate.apply();else if(E==="settings-open")'],
  ['return C(),o("APP_READY"),{destroy:()=>{Ha?.(),qE(),', 'const unsubscribePhoneUpdate=globalThis.__daoyuanPhoneUpdate.subscribe(()=>{if(A==="home"||A==="settings"&&(ot==="home"||ot==="phone-update"))C()});return C(),o("APP_READY"),{destroy:()=>{Ha?.(),qE(),unsubscribePhoneUpdate(),'],
];
let runtime = baseline;
for (const [before, after] of edits) {
  if (runtime.split(before).length !== 2) throw new Error(`Ambiguous runtime anchor: ${before}`);
  runtime = runtime.replace(before, () => after);
}
let restored = runtime;
for (const [before, after] of edits.toReversed()) restored = restored.replace(after, () => before);
if (restored !== baseline) throw new Error('Unexpected changes to the deployed runtime');

const manifestName = '道渊小手机V1.2版本清单.json';
const runtimeName = '道渊小手机V1.2外链运行时.js';
const options = {
  manifests: [],
  api: `https://api.github.com/repos/linxin1925/DaoYuan-Phone/contents/releases/cdn/${encodeURIComponent(manifestName)}?ref=main`,
  fallback: [],
  fallbackRef: '9c59658a0d55732e54c053539f281bf55e0aebbd',
  path: encodeURIComponent(runtimeName),
  manifestPath: `releases/cdn/${runtimeName}`,
  embeddedBaseline: builtAt,
  bundledLabel: '外链随包版本',
};
const content = `const bootDaoyuanPhone=async()=>{\n${runtime}\n};\n`
  + `if(globalThis.__daoyuanPhoneUpdate) await bootDaoyuanPhone();\n`
  + `else {\nconst options=${JSON.stringify(options)};\n`
  + `const loadedRef=new URL(import.meta.url).pathname.match(/@([a-f0-9]{40})\\//i)?.[1];\n`
  + `if(loadedRef){options.fallbackRef=loadedRef;options.bundledLabel=loadedRef.slice(0,7)}\n`
  + `await (${loadCdnPhone.toString()})(options,bootDaoyuanPhone);\n}\n`;
await writeFile(output, content);
console.log(sha256(content));
