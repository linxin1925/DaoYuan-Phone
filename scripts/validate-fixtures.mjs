import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../src/fixtures/appData.fixtures.json', import.meta.url);
const fixtures = JSON.parse(await readFile(path, 'utf8'));

assert.deepEqual(Object.keys(fixtures), ['empty', 'normal-v5-3-compatible', 'dirty-value', 'long-text']);
for (const fixture of [fixtures.empty, fixtures['normal-v5-3-compatible'], fixtures['long-text']]) {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(typeof fixture.revision, 'number');
  assert.ok(fixture.webBeauty.label === '绝色榜');
  assert.ok(fixture.webTrends.label === '仙网风闻，可能失真');
}
assert.equal(fixtures['dirty-value'].stat_data['绝色榜'], 'must remain untouched');
console.log('fixture validation passed: empty / normal-v5.3-compatible / dirty / long-text');
