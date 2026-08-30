export interface UserScriptPackage {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  importedAt: string;
  dlcId: string | null;
}

export function normalizeUserScripts(value: unknown): UserScriptPackage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>; const id = String(source.id ?? '').trim(); const name = String(source.name ?? '').trim(); const content = String(source.content ?? '');
    if (!id || !name || !content.trim()) return [];
    const explicitDlc = typeof source.dlcId === 'string' && source.dlcId.trim() ? source.dlcId.trim() : null;
    return [{ id, name, content, enabled: source.enabled === true, importedAt: String(source.importedAt ?? ''), dlcId: explicitDlc }];
  });
}

export class UserScriptRuntime {
  private readonly executionWindow: Window;
  private readonly activeIds = new Set<string>();
  constructor(executionWindow: Window) { this.executionWindow = executionWindow; }
  start(packages: readonly UserScriptPackage[]): Array<{ id: string; ok: boolean; error?: string }> {
    return packages.filter((pkg) => pkg.enabled).map((pkg) => this.run(pkg));
  }
  run(pkg: UserScriptPackage): { id: string; ok: boolean; error?: string } {
    if (this.activeIds.has(pkg.id)) return { id: pkg.id, ok: false, error: '旧版本仍在运行，刷新酒馆后启用替换版本' };
    try {
      const script = this.executionWindow.document.createElement('script');
      script.dataset.daoyuanUserScript = pkg.id; script.textContent = `${pkg.content}\n//# sourceURL=daoyuan-user-script-${encodeURIComponent(pkg.id)}.js`;
      this.executionWindow.document.documentElement.append(script); script.remove(); this.activeIds.add(pkg.id);
      return { id: pkg.id, ok: true };
    } catch (error) { return { id: pkg.id, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }
  isActive(id: string): boolean { return this.activeIds.has(id); }
}
