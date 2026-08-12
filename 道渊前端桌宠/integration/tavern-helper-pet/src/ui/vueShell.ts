import { createApp, type App as VueApp } from 'vue';
import type { BridgeAction } from '../contract/bridge';
import VueShell from './App.vue';
import tokensCss from './tokens.css?inline';

const STYLE_ID = 'daoyuan-v15-vue-shell-style';
const STYLE_TEXT = `
.v15-vue-shell{position:absolute;z-index:4;top:var(--dy-space-2);left:var(--dy-space-3);display:inline-flex;align-items:center;gap:var(--dy-space-1);min-height:var(--dy-control-min);padding:var(--dy-space-1) var(--dy-space-2);border:1px solid var(--dy-color-border);border-radius:var(--dy-radius-pill);background:color-mix(in srgb,var(--dy-color-bg) 88%,transparent);color:var(--dy-color-text);font:500 10px/1.2 var(--dy-font-body);pointer-events:none;user-select:none}.v15-vue-shell__dot{width:6px;height:6px;border-radius:50%;background:#8a7d63;box-shadow:0 0 0 2px rgba(138,125,99,.15)}.v15-vue-shell__dot[data-ready=true]{background:var(--dy-color-accent);box-shadow:0 0 0 2px rgba(115,198,161,.18)}.v15-vue-shell__status{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dy-color-text-muted)}
.dy-card{display:flex;flex-direction:column;gap:var(--dy-space-2);min-width:0;padding:var(--dy-space-3);border:1px solid var(--dy-color-border);border-radius:var(--dy-radius-md);background:var(--dy-color-surface);color:var(--dy-color-text)}.dy-card__header{display:grid;gap:var(--dy-space-1)}.dy-card__title{margin:0;font:600 12px/1.3 var(--dy-font-display)}.dy-card__description{margin:0;color:var(--dy-color-text-muted);font:400 10px/1.4 var(--dy-font-body)}.dy-card__body{display:flex;align-items:center;gap:var(--dy-space-2)}.dy-button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--dy-control-min);min-height:var(--dy-control-min);padding:var(--dy-space-2) var(--dy-space-3);border:1px solid transparent;border-radius:var(--dy-radius-sm);cursor:pointer;transition:background var(--dy-motion-fast),border-color var(--dy-motion-fast),color var(--dy-motion-fast);font:600 11px/1.2 var(--dy-font-body)}.dy-button:disabled{cursor:default;opacity:.62}.dy-button--primary{background:var(--dy-color-primary);color:var(--dy-color-bg)}.dy-button--ghost{border-color:var(--dy-color-border);background:transparent;color:var(--dy-color-text)}.dy-button--danger{border-color:rgba(223,129,119,.55);background:transparent;color:var(--dy-color-danger)}.v15-vue-shell__status-row{display:inline-flex;align-items:center;gap:var(--dy-space-1);white-space:nowrap}
.dy-tag{display:inline-flex;align-items:center;min-height:24px;padding:var(--dy-space-1) var(--dy-space-2);border:1px solid var(--dy-color-border);border-radius:var(--dy-radius-pill);font:600 10px/1 var(--dy-font-body)}.dy-tag--neutral{color:var(--dy-color-text-muted)}.dy-tag--accent{border-color:rgba(115,198,161,.4);color:var(--dy-color-accent)}.dy-tag--danger{border-color:rgba(223,129,119,.5);color:var(--dy-color-danger)}.dy-field{display:grid;gap:var(--dy-space-1);color:var(--dy-color-text)}.dy-field__label{font:600 12px/1.3 var(--dy-font-body)}.dy-field__hint{color:var(--dy-color-text-muted);font:400 10px/1.3 var(--dy-font-body)}.dy-field__error{color:var(--dy-color-danger);font:500 10px/1.3 var(--dy-font-body)}
.dy-settings-page{position:absolute;z-index:10;top:0;right:0;width:min(320px,calc(100% - 16px));height:100%;overflow:auto;display:grid;align-content:start;gap:var(--dy-space-3);padding:var(--dy-space-4);background:var(--dy-color-bg);color:var(--dy-color-text);pointer-events:auto}.dy-settings-page__header{display:flex;align-items:center;justify-content:space-between;gap:var(--dy-space-2)}.dy-settings-page__eyebrow{margin:0;color:var(--dy-color-primary);font:600 10px/1.2 var(--dy-font-body)}.dy-settings-page h1{margin:var(--dy-space-1) 0 0;font:600 22px/1.2 var(--dy-font-display)}.dy-control{width:100%;min-height:var(--dy-control-min);padding:var(--dy-space-2);border:1px solid var(--dy-color-border);border-radius:var(--dy-radius-sm);background:var(--dy-color-surface-raised);color:var(--dy-color-text)}.dy-switch-row{display:flex;align-items:center;gap:var(--dy-space-2);min-height:var(--dy-control-min);font-size:12px}.dy-switch-row input{width:20px;height:20px;accent-color:var(--dy-color-accent)}.dy-settings-page__saved{margin:0;color:var(--dy-color-accent);font-size:11px}
`;

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${tokensCss}\n${STYLE_TEXT}\n.dy-settings-actions{display:flex;flex-wrap:wrap;gap:var(--dy-space-2)}`;
  doc.head.append(style);
}

export interface VueShellMount { destroy(): void; }

export function mountVueShell(doc: Document, sendToHost: (action: BridgeAction, payload?: Record<string, unknown>) => void): VueShellMount {
  const view = doc.defaultView;
  if (!view) return { destroy() {} };
  ensureStyle(doc);
  const container = doc.createElement('div');
  container.id = 'daoyuan-v15-vue-shell';
  doc.body.append(container);
  const app: VueApp = createApp(VueShell, { view, sendToHost });
  app.mount(container);
  return {
    destroy() {
      app.unmount();
      container.remove();
    },
  };
}
