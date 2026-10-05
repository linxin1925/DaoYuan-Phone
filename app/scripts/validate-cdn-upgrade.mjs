import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../..', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const candidate = JSON.parse(read('releases/candidates/道渊小手机V1.3数据库版.json'));
const runtimePath = 'releases/cdn/道渊小手机V1.2外链运行时.js';
const manifestPath = 'releases/cdn/道渊小手机V1.2版本清单.json';
const loaderPath = 'releases/candidates/道渊小手机V1.2-CDN外链版.json';
const loader = JSON.parse(read(loaderPath));
assert.equal(sha(read(runtimePath)), sha(candidate.content));
assert.equal(candidate.version, '1.3.0');
assert.equal(loader.id, 'daoyuan-feature-frontend-hud-v12-cdn');
new vm.Script(candidate.content);

// A stale ref must fail before touching any output, including the runtime.
const before = [runtimePath, manifestPath, loaderPath].map(path => sha(read(path)));
const stale = spawnSync(process.execPath, ['app/scripts/package-cdn-external.mjs', '--ref', '1d68e4e87a846d1e2b7d9752d9a0cbfa9701559d'], { cwd: fileURLToPath(root), encoding: 'utf8' });
assert.notEqual(stale.status, 0);
assert.match(stale.stderr, /运行时与 V1.3 输入不一致/);
assert.deepEqual([runtimePath, manifestPath, loaderPath].map(path => sha(read(path))), before);

// Execute the already-distributed loader in a sandbox: no CDN network calls.
const nextRef = 'a'.repeat(40);
const encodedPath = encodeURIComponent('道渊小手机V1.2外链运行时.js');
async function runLoader({ manifestsFail = false, primaryFails = false } = {}) {
  const fetches = [], imports = [], errors = [], warnings = [];
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const script = new vm.Script(loader.content, {
    importModuleDynamically: async url => {
      imports.push(url);
      if (primaryFails && imports.length === 1) throw new Error('mock primary unavailable');
      finish();
      return import('data:text/javascript,export default null');
    },
  });
  script.runInNewContext({
    fetch: async (url, options) => {
      fetches.push({ url, options });
      if (manifestsFail) throw new Error('mock manifest unavailable');
      return { ok: true, json: async () => ({ schemaVersion: 1, commit: nextRef, version: '1.3.0' }) };
    },
    Date,
    console: { warn: (...args) => warnings.push(args), error: (...args) => { errors.push(args); finish(); } },
  });
  await finished;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 0);
  assert(fetches.every(item => item.options.cache === 'no-store'));
  assert(fetches[0].url.startsWith('https://raw.githubusercontent.com/linxin1925/DaoYuan-Phone/main/'));
  return { fetches, imports, warnings };
}
const upgraded = await runLoader();
assert.equal(upgraded.imports[0], `https://gcore.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@${nextRef}/releases/cdn/${encodedPath}`);
const secondary = await runLoader({ primaryFails: true });
assert.equal(secondary.imports[1], `https://testingcf.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@${nextRef}/releases/cdn/${encodedPath}`);
const offlineManifest = await runLoader({ manifestsFail: true });
assert.equal(offlineManifest.fetches.length, 2);
assert.equal(offlineManifest.warnings.length, 1);
assert(!offlineManifest.imports[0].includes(`@${nextRef}/`));
console.log('CDN upgrade OK: V1.3 runtime matches; stale ref leaves outputs intact; installed loader follows new manifest; CDN and manifest fallbacks work.');
