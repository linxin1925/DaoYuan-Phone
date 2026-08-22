import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');
const sources = [
  ['wan_nian_chou_yuan', '道渊世界观剧情拓展/万年仇怨/万年仇怨.json'],
  ['he_huan_zong', '道渊世界观剧情拓展/合欢宗拓展/合欢宗扩展.json'],
  ['luo_yang', '道渊世界观剧情拓展/洛阳拓展/洛阳扩展.json'],
  ['shu_shan', '道渊世界观剧情拓展/蜀山拓展/蜀山扩展2.0.json'],
];

const rows = [];
for (const [id, relativePath] of sources) {
  const absolutePath = resolve(root, relativePath);
  const raw = await readFile(absolutePath);
  const data = JSON.parse(raw);
  const entries = Object.values(data.entries ?? {});
  rows.push({
    id,
    source: relativePath,
    sha256: createHash('sha256').update(raw).digest('hex'),
    bytes: raw.byteLength,
    entryCount: entries.length,
    constantCount: entries.filter((entry) => entry.constant === true).length,
    enabledCount: entries.filter((entry) => entry.disable !== true).length,
    disabledCount: entries.filter((entry) => entry.disable === true).length,
    assistantSourcesExcluded: true,
  });
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'DLC 阶段 0 原始世界书基线；仅供分析，不作为运行时正文真源。',
  sources: rows,
  runtimeProbes: [
    { capability: 'create_standalone_worldbook', status: 'pending_real_host_probe' },
    { capability: 'write_current_character_additional_worldbooks', status: 'pending_real_host_probe' },
    { capability: 'worldbook_scan_order_before_generation', status: 'pending_real_host_probe' },
  ],
};

const output = resolve(root, 'app/reports/dlc-baseline.json');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Wrote ${output}`);
for (const row of rows) console.log(`${row.id}: ${row.sha256} (${row.entryCount} entries, ${row.constantCount} constant)`);
