export interface WorldbookEntryLike {
  uid?: unknown; name?: unknown; enabled?: unknown; content?: unknown; probability?: unknown; extra?: unknown;
  strategy?: { type?: unknown; keys?: unknown[]; keys_secondary?: { logic?: unknown; keys?: unknown[] }; scan_depth?: unknown };
  position?: { type?: unknown; role?: unknown; depth?: unknown; order?: unknown };
  recursion?: { prevent_incoming?: unknown; prevent_outgoing?: unknown; delay_until?: unknown };
  effect?: { sticky?: unknown; cooldown?: unknown; delay?: unknown };
}

const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const normalizeKeys = (value: unknown): string[] => Array.isArray(value) ? value.map((key) => String(key)) : [];
export function normalizeWorldbookEntry(entry: WorldbookEntryLike): Record<string, unknown> {
  return {
    name: asString(entry.name).trim(), content: asString(entry.content),
    strategy: { type: entry.strategy?.type ?? 'selective', keys: normalizeKeys(entry.strategy?.keys), keys_secondary: { logic: entry.strategy?.keys_secondary?.logic ?? 'and_any', keys: normalizeKeys(entry.strategy?.keys_secondary?.keys) }, scan_depth: entry.strategy?.scan_depth ?? 'same_as_global' },
    position: { type: entry.position?.type ?? 'at_depth', role: entry.position?.role ?? 'system', depth: entry.position?.depth ?? 4, order: entry.position?.order ?? 100 },
    probability: entry.probability ?? 100,
    recursion: { prevent_incoming: entry.recursion?.prevent_incoming ?? false, prevent_outgoing: entry.recursion?.prevent_outgoing ?? false, delay_until: entry.recursion?.delay_until ?? null },
    effect: { sticky: entry.effect?.sticky ?? null, cooldown: entry.effect?.cooldown ?? null, delay: entry.effect?.delay ?? null }, extra: entry.extra ?? null,
  };
}
