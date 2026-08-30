import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const sourcePath = resolve(root, '灵力复苏地球附属世界书/灵力复苏地球附属世界书.json');
const outputPath = resolve(root, 'app/src/dlc/seeds/lingLiFuSuEarth.json');
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes.toString('utf8'));
const entries = Object.entries(source.entries ?? {}).map(([sourceKey, entry]) => ({
  uid: String(entry.uid ?? sourceKey),
  name: String(entry.comment ?? `entry-${sourceKey}`).trim(),
  sourceEntry: entry,
}));

const seed = {
  schemaVersion: 1,
  id: 'ling_li_fu_su_earth',
  recommendedName: '灵力复苏地球附属世界书',
  displayName: '灵力复苏地球',
  installType: 'simulation-routed',
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  entries,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath} (${entries.length} entries, ${seed.sourceSha256})`);
