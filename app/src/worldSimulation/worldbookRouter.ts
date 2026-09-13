export interface RoutedWorldbookEntry { name: string; content: string; }

export interface WorldbookRouteOptions {
  requiredTerms: readonly string[];
  preferredTerms: readonly string[];
  seed: string;
  maxEntries?: number;
  maxChars?: number;
}
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function routeSimulationWorldbook(entries: readonly RoutedWorldbookEntry[], options: WorldbookRouteOptions): RoutedWorldbookEntry[] {
  const maxEntries = Math.max(1, options.maxEntries ?? 18);
  const maxChars = Math.max(2000, options.maxChars ?? 24000);
  const required = options.requiredTerms.filter(Boolean);
  const preferred = options.preferredTerms.filter(Boolean);
  const scored = entries
    .filter(entry => entry.content.trim())
    .map((entry, index) => {
      const haystack = `${entry.name}\n${entry.content.slice(0, 1600)}`;
      const requiredHits = required.filter(term => haystack.includes(term)).length;
      const preferredHits = preferred.filter(term => haystack.includes(term)).length;
      const foundation = /规则|总览|世界观|时间|历法|地域|国家|势力|组织|阶段|事件|运行/.test(entry.name) ? 1 : 0;
      return { entry, index, score: requiredHits * 100 + preferredHits * 15 + foundation * 8, tie: hash(`${options.seed}:${entry.name}:${index}`) };
    })
    .sort((a, b) => b.score - a.score || a.tie - b.tie || a.index - b.index);

  const selected: RoutedWorldbookEntry[] = [];
  let chars = 0;
  for (const item of scored) {
    if (selected.length >= maxEntries) break;
    const cost = item.entry.name.length + item.entry.content.length + 8;
    if (chars + cost > maxChars) {
      if (selected.length) continue;
      const contentBudget = maxChars - item.entry.name.length - 8;
      if (contentBudget <= 0) continue;
      selected.push({ ...item.entry, content: item.entry.content.slice(0, contentBudget) });
      chars = maxChars;
      continue;
    }
    selected.push(item.entry);
    chars += cost;
  }
  return selected;
}
