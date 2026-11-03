// Serialized into the Tavern Helper import package. Keep all runtime dependencies inside.
export async function loadCdnPhone({ manifests, api, fallback, fallbackRef, path, manifestPath, loadedRef, embeddedBaseline, bundledLabel = '本地内置版' }, bootLocal) {
  const storageKey = 'daoyuan-phone-cdn-selection-v1';
  const runtimeUrls = (ref) => ['gcore', 'testingcf'].map(
    (node) => `https://${node}.jsdelivr.net/gh/linxin1925/DaoYuan-Phone@${ref}/releases/cdn/${path}`,
  );
  const valid = (value) => value?.schemaVersion === 1 && value.channel === 'v1.2-main'
    && /^[a-f0-9]{40}$/i.test(value.commit) && /^[a-f0-9]{64}$/i.test(value.runtimeSha256)
    && value.runtimePath === manifestPath && Number.isFinite(Date.parse(value.publishedAt));
  const read = async (url, headers) => {
    const response = await fetch(url, { cache: 'no-store', headers, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  };
  const readManifest = async (url, headers) => {
    const value = await (await read(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, headers)).json();
    if (!valid(value)) throw new Error('版本清单格式无效');
    return value;
  };

  let selection;
  try { selection = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
  const selected = valid(selection?.current) ? selection.current : null;
  const pending = valid(selection?.pending) ? selection.pending : null;
  const save = (current, next = null) => localStorage.setItem(storageKey, JSON.stringify({ current, pending: next }));
  let current = null;
  let latest = null;
  let failed = false;
  let status = '';
  let busy = false;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const check = async () => {
    if (busy) return;
    busy = true;
    status = '正在检查更新…';
    notify();
    try {
      const candidate = await readManifest(api, { Accept: 'application/vnd.github.raw+json' });
      latest = candidate.commit !== (current?.commit ?? fallbackRef)
        && Date.parse(candidate.publishedAt) > (Date.parse(current?.publishedAt ?? embeddedBaseline) || 0) ? candidate : null;
      status = latest ? '发现新版' : '已是当前发布版本';
    } catch {
      status = '检查失败，可以重试。';
    } finally {
      busy = false;
      notify();
    }
  };
  const apply = async () => {
    if (!latest || busy) return;
    busy = true;
    status = '正在下载并校验更新…';
    notify();
    for (const url of runtimeUrls(latest.commit)) {
      try {
        const bytes = await (await read(url)).arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (byte) => byte.toString(16).padStart(2, '0')).join('');
        if (hash !== latest.runtimeSha256) throw new Error('脚本校验失败');
        save(current, latest);
        window.parent.location.reload();
        return;
      } catch {}
    }
    busy = false;
    status = '更新失败，继续使用当前版本。';
    notify();
  };
  globalThis.__daoyuanPhoneUpdate = {
    state: () => ({ current: current?.commit.slice(0, 7) ?? (bootLocal ? bundledLabel : fallbackRef.slice(0, 7)),
      available: latest?.commit.slice(0, 7), busy, status, failed }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    check,
    apply,
  };

  let published = null;
  if (!pending && !selected) {
    for (const url of manifests) {
      try { published = await readManifest(url); break; } catch {}
    }
  }
  for (const manifest of [...[pending, selected, published].filter(Boolean), null]) {
    const isLoadedModule = bootLocal && manifest?.commit === loadedRef;
    const urls = isLoadedModule ? [null] : manifest ? runtimeUrls(manifest.commit) : bootLocal ? [null] : fallback;
    for (const url of urls) {
      try {
        if (url === null) await bootLocal();
        else await import(url);
      } catch { continue; }
      current = manifest;
      failed = Boolean(pending && pending.commit !== current?.commit);
      if (pending) {
        try { save(current); } catch {}
      }
      void check();
      return;
    }
  }
  console.error('[道渊小手机] CDN 外链运行时加载失败');
}
