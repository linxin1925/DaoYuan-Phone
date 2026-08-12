import { readFile } from 'node:fs/promises';

const projectRoot = new URL('..', import.meta.url);
const v07Path = new URL('../../道渊小手机V0.7.json', projectRoot);
const v15Path = new URL('./dist/道渊小手机V1.5-preview.json', projectRoot);
const v15CandidatePath = new URL('./dist/道渊功能前端-常驻脚本候选.json', projectRoot);

const [v07Raw, v15Raw, candidateRaw] = await Promise.all([
  readFile(v07Path, 'utf8'),
  readFile(v15Path, 'utf8'),
  readFile(v15CandidatePath, 'utf8'),
]);
const v07 = JSON.parse(v07Raw);
const v15 = JSON.parse(v15Raw);
const candidate = JSON.parse(candidateRaw);

if (v15.type !== 'script' || v15.id !== 'daoyuan-feature-frontend-hud-v15') {
  throw new Error('V1.5 import package identity is invalid');
}
if (candidate.format !== 'daoyuan-tavern-helper-script-candidate' || candidate.scriptId !== v15.id) {
  throw new Error('V1.5 audit candidate does not match import package identity');
}
if (v15.content !== candidate.artifact.content) {
  throw new Error('V1.5 import package content differs from audit candidate');
}
if (v07.id === v15.id || v07.name === v15.name) {
  throw new Error('V0.7 and V1.5 identities collide');
}
if (!v15.content.includes('daoyuan-feature-hud-v15') || !v15.content.includes('daoyuan-feature-orb-v15')) {
  throw new Error('V1.5 runtime does not use isolated HUD/orb identifiers');
}
if (v15.content.includes('__daoyuanFeatureCleanup =')) {
  throw new Error('V1.5 runtime still uses the shared cleanup hook');
}

console.log(`release validation passed: V0.7=${v07.id ?? v07.name} / V1.5=${v15.id}`);
console.log(`V1.5 bytes: ${Buffer.byteLength(v15.content, 'utf8')}`);
