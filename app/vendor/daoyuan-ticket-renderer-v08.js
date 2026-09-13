// 道渊票据渲染脚本 V0.8
// 只在正文生成/变量解析生命周期事件或聊天页面恢复时读取最近三层 AI 回复。
// 不修改聊天原文、不写入 MVU、不使用 MutationObserver，不持续扫描正文。
(function installDaoyuanTicketRenderer(rootWindow) {
  'use strict';

  const VERSION = '0.8.15-preview';
  const SCRIPT_ID = 'daoyuan-ticket-renderer-v08';
  const CLEANUP_KEY = '__DAOYUAN_TICKET_RENDERER_CLEANUP__';
  const API_KEY = '__DAOYUAN_TICKET_RENDERER__';
  const localWindow = rootWindow;
  const hostWindow = localWindow.parent && localWindow.parent !== localWindow ? localWindow.parent : localWindow;
  const hostDocument = hostWindow.document;
  const disposers = [];
  let chain = Promise.resolve();
  let scheduledReasons = new Set();
  let lastMvuStartedMessageId = null;

  const TICKET_CSS = `
.dx-combat-round{margin:12px auto;padding:12px 14px;border-radius:5px;font-family:'DaoYuan Serif','Noto Serif SC','Songti SC','STSongti SC','SimSun',serif;font-size:13px;line-height:1.7;color:#ddd9c4;max-width:680px;position:relative;overflow:hidden;background:radial-gradient(ellipse 60% 40% at 20% 0%,rgba(168,136,212,.08),transparent 70%),radial-gradient(ellipse 50% 50% at 85% 15%,rgba(95,179,196,.06),transparent 65%),linear-gradient(180deg,rgba(23,28,38,.96),rgba(12,15,20,.98));border:1px solid rgba(216,193,136,.28);border-left:3px solid #d8c188;box-shadow:0 2px 12px rgba(0,0,0,.4),inset 0 0 40px rgba(216,193,136,.03)}
.dx-round-head{display:flex;align-items:center;justify-content:center;gap:10px;position:relative;color:#d8c188;font-weight:700;font-size:13.5px;letter-spacing:.08em;padding:0 64px 8px;margin-bottom:10px;border-bottom:1px solid rgba(216,193,136,.18);cursor:pointer;list-style:none;user-select:none}
.dx-round-head::-webkit-details-marker{display:none}.dx-round-head::marker{display:none;content:''}
.dx-round-toggle{position:absolute;right:0;top:50%;transform:translateY(-50%);min-width:42px;padding:1px 7px;border:1px solid rgba(216,193,136,.28);border-radius:3px;color:#8a8676;background:rgba(0,0,0,.18);font-size:10px;font-weight:400;line-height:1.55;letter-spacing:.05em;text-align:center}
.dx-round-toggle::before{content:'展开'}.dx-combat-round[open] .dx-round-toggle::before{content:'收起'}
.dx-combat-round:not([open]) .dx-round-head{padding-bottom:0;margin-bottom:0;border-bottom-color:transparent}.dx-round-body{display:block}
.dx-roundline{margin-left:auto;font-size:11.5px;color:#8a8676;font-weight:400;letter-spacing:.04em}
.dx-enemy{display:flex;flex-direction:column;gap:3px;padding:6px 10px;margin-bottom:8px;background:rgba(196,102,91,.05);border:1px solid rgba(196,102,91,.22);border-radius:4px}
.dx-enemy-top{display:flex;align-items:baseline;gap:8px}.dx-enemy-name{color:#ddd9c4;font-weight:700;font-size:13px;letter-spacing:.04em}.dx-enemy-realm{color:#d9a441;font-size:11px}
.dx-enemy-state{margin-left:auto;padding:0 6px;border-radius:2px;font-size:10px;line-height:1.55;letter-spacing:.06em;border:1px solid currentColor}.dx-enemy-state[data-s="完好"]{color:#6fb39a;background:rgba(111,179,154,.1)}.dx-enemy-state[data-s="轻伤"]{color:#d8c188;background:rgba(216,193,136,.1)}.dx-enemy-state[data-s="重伤"]{color:#d9a441;background:rgba(217,164,65,.12)}.dx-enemy-state[data-s="濒死"]{color:#c4665b;background:rgba(196,102,91,.14)}.dx-enemy-state[data-s="死亡"]{color:#8a8676;background:rgba(0,0,0,.28)}
.dx-enemy-hp{font-size:11px;color:#8a8676;font-variant-numeric:tabular-nums}.dx-hpbar{height:6px;background:rgba(0,0,0,.4);border-radius:3px;overflow:hidden}.dx-hpfill{height:100%;border-radius:3px;background:linear-gradient(90deg,#c4665b,#d9a441);box-shadow:0 0 6px rgba(196,102,91,.35)}
.dx-ticket{display:flex;flex-direction:column;padding:5px 10px;margin-bottom:4px;background:rgba(0,0,0,.22);border:1px solid #2a2f3a;border-radius:4px}.dx-ticket-main{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dx-ticket .dx-skill{color:#d8c188;font-weight:700;font-size:12.5px;letter-spacing:.03em}.dx-ticket .dx-actor{color:#ddd9c4;font-weight:600;font-size:12.5px}.dx-ticket .dx-arrow{color:#5d5a4f}.dx-ticket .dx-dmg{margin-left:auto;font-size:15px;font-weight:800;color:#c4665b;text-shadow:0 0 8px rgba(196,102,91,.4);font-variant-numeric:tabular-nums}.dx-ticket .dx-dmg small{font-size:10px;font-weight:400;color:#5d5a4f;margin-right:2px}.dx-ticket .dx-formula{margin-top:2px;font-size:10px;color:#5d5a4f;line-height:1.5;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.dx-ticket.mini{flex-direction:row;align-items:center;padding:2px 10px;margin-bottom:2px;background:rgba(0,0,0,.14)}.dx-ticket.mini .dx-actor{font-size:11px;font-weight:400}.dx-ticket.mini .dx-result{font-size:9.5px;margin-left:8px}.dx-ticket.mini .dx-dmg{font-size:12px}
.dx-timeline{display:grid;grid-template-columns:26px minmax(0,1fr);gap:6px 8px;align-items:start;padding:5px 9px;margin-bottom:3px;background:rgba(216,193,136,.035);border-left:2px solid rgba(216,193,136,.3);border-radius:2px}.dx-timeline-seq{color:#d8c188;font-size:10px;font-weight:700;font-variant-numeric:tabular-nums}.dx-timeline-text{overflow-wrap:anywhere;color:#aaa693;font-size:10.5px;line-height:1.5}.dx-timeline[data-side="敌方"]{border-left-color:rgba(196,102,91,.5);background:rgba(196,102,91,.04)}.dx-timeline[data-side="玩家"]{border-left-color:rgba(111,179,154,.5);background:rgba(111,179,154,.04)}
.dx-result{font-size:10.5px;padding:1px 7px;border-radius:2px;letter-spacing:.06em}.dx-result[data-r="暴击"]{color:#f0e0c0;background:rgba(196,102,91,.28);border:1px solid rgba(196,102,91,.5)}.dx-result[data-r="命中"]{color:#6fb39a;background:rgba(111,179,154,.14);border:1px solid rgba(111,179,154,.4)}.dx-result[data-r="擦伤"]{color:#d9a441;background:rgba(217,164,65,.12);border:1px solid rgba(217,164,65,.4)}.dx-result[data-r="落空"]{color:#8a8676;background:rgba(0,0,0,.25);border:1px solid #2a2f3a}.dx-result[data-r="合法处决"]{color:#e0b8e8;background:rgba(168,136,212,.2);border:1px solid rgba(168,136,212,.5)}
.dx-footer{margin-top:8px;padding-top:8px;border-top:1px dashed #2a2f3a;font-size:11px;color:#8a8676;line-height:1.6}
.dx-receipt{color-scheme:dark;--dx-accent:#d8c188;--dx-accent-dim:#8a7a4a;--dx-border:rgba(216,193,136,.3);--dx-glow:rgba(216,193,136,.08);position:relative;max-width:680px;margin:14px auto;padding:0 15px 13px;overflow:hidden;color:#ddd9c4;background:radial-gradient(circle at 10% 0,var(--dx-glow),transparent 34%),repeating-linear-gradient(135deg,transparent 0 22px,rgba(216,193,136,.018) 23px,transparent 24px),linear-gradient(145deg,rgba(8,13,18,.98),rgba(17,24,32,.97));border:1px solid var(--dx-border);border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,.28),inset 0 0 44px rgba(216,193,136,.025);font-family:'DaoYuan Serif','Noto Serif SC','Songti SC','STSongti SC','SimSun',serif;font-size:13px;line-height:1.65;isolation:isolate}.dx-receipt::before{position:absolute;right:18px;bottom:-34px;z-index:-1;color:var(--dx-accent);font-size:112px;line-height:1;opacity:.035;content:'市';pointer-events:none}.dx-quest-receipt{--dx-accent:#78b7aa;--dx-accent-dim:#477e74;--dx-border:rgba(111,179,154,.32);--dx-glow:rgba(95,179,196,.08)}.dx-quest-receipt::before{content:'令'}
.dx-receipt-head{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:62px;margin:0 -15px 11px;padding:9px 14px;color:var(--dx-accent);background:linear-gradient(90deg,rgba(216,193,136,.07),transparent 72%);border-bottom:1px solid var(--dx-border);cursor:pointer;list-style:none;user-select:none}.dx-receipt-head::-webkit-details-marker{display:none}.dx-receipt-head::marker{display:none;content:''}.dx-receipt:not([open]){padding-bottom:0}.dx-receipt:not([open]) .dx-receipt-head{margin-bottom:0;border-bottom-color:transparent}
.dx-receipt-emblem{position:relative;display:grid;width:38px;aspect-ratio:1;place-items:center;color:var(--dx-accent);background:radial-gradient(circle,rgba(216,193,136,.11),rgba(7,12,17,.12) 66%);border:1px solid currentColor;border-radius:50%;box-shadow:inset 0 0 0 3px rgba(7,12,17,.82),inset 0 0 0 4px color-mix(in srgb,currentColor 42%,transparent);font-size:17px;font-weight:500}.dx-receipt-emblem::after{position:absolute;inset:-4px;border:1px dashed color-mix(in srgb,currentColor 42%,transparent);border-radius:50%;content:''}
.dx-heading-copy{display:flex;min-width:0;flex-direction:column}.dx-receipt-kicker{color:var(--dx-accent-dim);font-size:9px;letter-spacing:.2em}.dx-receipt-title{overflow-wrap:anywhere;color:#e8e1c9;font-size:15px;font-weight:500;letter-spacing:.08em;text-shadow:0 1px 12px rgba(0,0,0,.8)}.dx-receipt-toggle{min-width:42px;padding:2px 7px;color:#807c6e;background:rgba(7,11,16,.62);border:1px solid var(--dx-border);border-radius:2px;font-size:9px;line-height:1.55;letter-spacing:.06em;text-align:center}.dx-receipt-toggle::before{content:'展卷'}.dx-receipt[open] .dx-receipt-toggle::before{content:'收卷'}
.dx-receipt-meta{display:flex;gap:5px;margin:0 0 10px;flex-wrap:wrap}.dx-meta{display:inline-flex;min-width:0;align-items:baseline;gap:5px;padding:2px 7px;color:#8a8676;background:rgba(7,12,17,.52);border-left:2px solid var(--dx-accent-dim)}.dx-meta-label{color:#5d5a4f;font-size:9px;letter-spacing:.08em}.dx-meta-value{overflow-wrap:anywhere;color:#bdb8a5;font-size:10.5px}
.dx-section-title{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:7px;margin:10px 0 6px;color:var(--dx-accent-dim);font-size:9px;letter-spacing:.18em}.dx-section-title::before{content:'◇';color:var(--dx-accent)}.dx-section-title::after{height:1px;background:linear-gradient(90deg,var(--dx-border),transparent);content:''}
.dx-receipt-list{display:flex;flex-direction:column}.dx-shop-receipt .dx-receipt-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:8px}.dx-market-item{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:start;align-self:start;column-gap:6px;row-gap:1px;min-height:0;padding:6px 4px;border-top:1px solid rgba(216,193,136,.09)}.dx-market-item:last-child{border-bottom:1px solid rgba(216,193,136,.09)}.dx-item-glyph{display:grid;width:20px;aspect-ratio:1;place-items:center;color:var(--dx-accent-dim);border:1px solid var(--dx-border);border-radius:50%;font-size:8px}.dx-item-main{min-width:0}.dx-item-top{display:flex;align-items:baseline;gap:5px;flex-wrap:wrap}.dx-item-name{color:#ddd9c4;font-size:12px;font-weight:600;letter-spacing:.03em}.dx-item-rank,.dx-item-stock{color:#7f7b6d;font-size:9px}.dx-item-stock::before{content:'余 '}.dx-item-desc{grid-column:2/-1;grid-row:2;margin:0;overflow-wrap:anywhere;color:#706d61;font-size:9px;line-height:1.45}.dx-item-price{grid-column:3;grid-row:1;display:flex;align-items:center;justify-content:flex-end;gap:5px;color:#d8c188;text-align:right}.dx-item-price small{display:none}.dx-item-price strong{max-width:86px;color:#cdb77f;font-size:9px;font-weight:500;line-height:1.3}
.dx-buy-actions{display:flex;align-items:center;justify-content:flex-end;margin:0}.dx-buy-button,.dx-buy-step{min-height:22px;padding:2px 6px;color:#d8c188;background:#101820;border:1px solid rgba(216,193,136,.36);border-radius:3px;font:inherit;font-size:9px;line-height:1;cursor:pointer}.dx-buy-button:hover,.dx-buy-step:hover{color:#f1dfaa;background:#18232c;border-color:rgba(216,193,136,.62)}.dx-buy-button:focus-visible,.dx-buy-step:focus-visible{outline:2px solid #d8c188;outline-offset:2px}.dx-buy-button:disabled,.dx-buy-step:disabled{color:#5d5a4f;background:#0b1015;border-color:#252a2d;cursor:not-allowed;opacity:.7}.dx-buy-dock{position:sticky;bottom:8px;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;margin:12px 0 2px;padding:9px 10px;background:rgba(8,14,19,.96);border:1px solid rgba(216,193,136,.42);border-left:3px solid #d8c188;border-radius:4px;box-shadow:0 8px 24px rgba(0,0,0,.45)}.dx-buy-dock[hidden]{display:none}.dx-buy-name{min-width:0;overflow:hidden;color:#ddd9c4;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.dx-buy-name small{display:block;color:#676356;font-size:8px;letter-spacing:.12em}.dx-buy-stepper{display:flex;align-items:center;gap:4px}.dx-buy-count{display:grid;min-width:30px;min-height:32px;place-items:center;color:#ddd9c4;background:#080e13;border:1px solid #293139;border-radius:3px;font-size:11px;font-variant-numeric:tabular-nums}.dx-buy-dock .dx-buy-button,.dx-buy-dock .dx-buy-step{min-height:32px;padding:5px 10px;font-size:10px}.dx-buy-status{grid-column:1/-1;min-height:0;color:#78b7aa;font-size:9px;line-height:1.4;text-align:right}
.dx-bullet{position:relative;padding:5px 7px 5px 21px;color:#b7b2a0;background:linear-gradient(90deg,rgba(111,179,154,.055),transparent 72%);border-left:1px solid var(--dx-border);font-size:11px}.dx-bullet::before{position:absolute;left:8px;top:6px;color:var(--dx-accent);font-size:7px;content:'◆'}.dx-quest-actions{display:flex;align-items:center;gap:7px}.dx-quest-seal{display:grid;width:34px;aspect-ratio:1;place-items:center;color:#ddb3a8;background:rgba(119,43,38,.35);border:1px solid rgba(196,102,91,.65);box-shadow:inset 0 0 0 2px rgba(12,15,20,.7);font-size:10px;line-height:1.05;letter-spacing:.08em;transform:rotate(-3deg)}.dx-receipt-note{margin-top:9px;padding:7px 8px;color:#777466;background:rgba(7,12,17,.38);border-left:2px solid var(--dx-accent-dim);font-size:10px;line-height:1.55}.dx-receipt-note::before{margin-right:6px;color:var(--dx-accent-dim);content:'附注 ·'}
.dx-quest-board-list{display:flex;flex-direction:column;gap:7px}.dx-quest-board-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:8px 9px;background:rgba(0,0,0,.2);border:1px solid rgba(111,179,154,.2);border-radius:3px}.dx-quest-board-main{min-width:0}.dx-quest-board-title{display:block;color:#e2dfcc;font-size:12px;font-weight:600;letter-spacing:.04em;overflow-wrap:anywhere}.dx-quest-board-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:3px;color:#8a8676;font-size:9px;line-height:1.5}.dx-quest-board-meta span{padding:1px 5px;background:rgba(95,179,196,.06);border-left:1px solid var(--dx-border)}.dx-quest-board-summary{grid-column:1/-1;margin:0;color:#9b9889;font-size:10px;line-height:1.55;overflow-wrap:anywhere}.dx-quest-accept{align-self:center;min-width:45px;min-height:28px;padding:3px 7px;color:#d8c188;background:#101820;border:1px solid rgba(216,193,136,.4);border-radius:3px;font:inherit;font-size:10px;cursor:pointer}.dx-quest-accept:hover{color:#f1dfaa;background:#18232c;border-color:rgba(216,193,136,.7)}.dx-quest-accept:focus-visible{outline:2px solid #d8c188;outline-offset:2px}.dx-quest-accept[data-written="true"]{color:#78b7aa;border-color:rgba(111,179,154,.58)}
@media(max-width:560px){.dx-receipt,.dx-combat-round{margin:10px 0}.dx-receipt{padding:0 11px 11px}.dx-receipt-head{grid-template-columns:38px minmax(0,1fr) auto;margin:0 -11px 9px;padding:8px 10px}.dx-shop-receipt .dx-receipt-list{grid-template-columns:1fr}.dx-market-item{grid-template-columns:22px minmax(0,1fr) auto;padding-block:7px}.dx-item-desc{white-space:normal}.dx-item-price strong{max-width:110px}.dx-buy-button{min-height:34px;padding-inline:9px}.dx-buy-dock{grid-template-columns:1fr auto}.dx-buy-name{grid-column:1/-1}.dx-buy-status{text-align:left}.dx-buy-dock .dx-buy-button,.dx-buy-dock .dx-buy-step,.dx-buy-count{min-height:38px}.dx-receipt-toggle{min-width:38px;padding-inline:5px}}
@media(prefers-reduced-motion:reduce){.dx-receipt *{scroll-behavior:auto!important}}`;

  function runtimeFunction(name) {
    if (typeof localWindow[name] === 'function') return localWindow[name].bind(localWindow);
    if (typeof hostWindow[name] === 'function') return hostWindow[name].bind(hostWindow);
    if (typeof localWindow.TavernHelper?.[name] === 'function') return localWindow.TavernHelper[name].bind(localWindow.TavernHelper);
    if (typeof hostWindow.TavernHelper?.[name] === 'function') return hostWindow.TavernHelper[name].bind(hostWindow.TavernHelper);
    return null;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function activeMessageText(message) {
    if (typeof message?.message === 'string') return message.message;
    if (!Array.isArray(message?.swipes)) return '';
    const swipeId = Number(message.swipe_id);
    const index = Number.isInteger(swipeId) && swipeId >= 0 && swipeId < message.swipes.length ? swipeId : 0;
    return typeof message.swipes[index] === 'string' ? message.swipes[index] : '';
  }

  function messageId(message) {
    const id = Number(message?.message_id);
    return Number.isSafeInteger(id) ? id : -1;
  }

  function isAssistant(message) {
    return message?.role === 'assistant' || (message?.is_user === false && message?.is_system !== true);
  }

  function getRecentAssistantMessages() {
    const getChatMessages = runtimeFunction('getChatMessages');
    if (!getChatMessages) return [];
    const messages = getChatMessages('0-{{lastMessageId}}', { role: 'assistant', include_swipes: true }) || [];
    return messages.filter(isAssistant).sort((a, b) => messageId(a) - messageId(b)).slice(-3);
  }

  function latestAssistantId() {
    return getRecentAssistantMessages().at(-1)?.message_id ?? null;
  }

  function enemyState(after) {
    const hp = Math.max(0, Math.min(100, Number(after) || 0));
    if (hp === 0) return '死亡';
    if (hp <= 30) return '濒死';
    if (hp <= 70) return '重伤';
    if (hp <= 79) return '轻伤';
    return '完好';
  }

  function enrichMissingCombatSettlements(body) {
    const source = String(body || '').replace(/\r/g, '');
    const lines = source.split('\n');
    const settled = new Set(lines.map(line => line.match(/^\s*-?\s*(R\d+-T\d+-A)\s*\|/)?.[1]).filter(Boolean));
    const recovered = [];
    for (const line of lines) {
      const action = line.match(/^\s*\d{2}\s*\|\s*敌方:([^|\n]+)\s*\|\s*基础攻击→([^|\n]+).*?\|\s*票据:(R\d+-T\d+-A)\s*\|\s*检定:(D20:[^|\n]+).*?\|\s*结果:([^|\n]+)\s*\|\s*伤害:(\d+)/);
      if (!action || settled.has(action[3])) continue;
      recovered.push(`- ${action[3]} | ${action[1].trim()}→${action[2].trim()} | ${action[4].trim()} | 结果:${action[5].trim()} | 最终伤害:${action[6]}`);
      settled.add(action[3]);
    }
    if (!recovered.length) return source;
    const footer = lines.findIndex(line => /^\s*轮末\s*[:：]/.test(line));
    lines.splice(footer >= 0 ? footer : lines.length, 0, ...recovered);
    return lines.join('\n');
  }

  function renderCombatRound(body) {
    // 先转义整段机器票据，再把白名单行变成 HTML；未识别行只能作为纯文本进入宿主 DOM。
    let content = escapeHtml(enrichMissingCombatSettlements(body));
    content = content.replace(/^\s*轮数\s*[:：]\s*(\d+)\s*$/m, (_, round) => `<span class="dx-roundline">第 ${round} 轮</span>`);
    content = content.replace(/^\s*([^|\n]+?)\s*\|\s*境界:\s*([^|\n]*?(?:（DC:\d+）)?)(?:\s+DC:\d+)?\s*\|\s*(?:五维:[^|\n]*\|\s*)?生命:\s*(\d+)→(\d+)\s*$/gm, (_, name, realm, before, after) => {
      const state = enemyState(after);
      return `<div class="dx-enemy"><div class="dx-enemy-top"><span class="dx-enemy-name">${name.trim()}</span><span class="dx-enemy-realm">${realm.trim()}</span><span class="dx-enemy-state" data-s="${state}">${state}</span><span class="dx-enemy-hp">${before}→${after}</span></div><div class="dx-hpbar"><div class="dx-hpfill" style="width:${Number(after) || 0}%"></div></div></div>`;
    });
    content = content.replace(/^\s*(?:敌情|行动|结算|NPC行动)\s*[:：]\s*$/gm, '');
    content = content.replace(/^\s*(\d{2})\s*\|\s*(玩家|敌方):([^|\n]+)\s*\|\s*(.+)$/gm, (_, seq, side, actor, detail) => `<div class="dx-timeline" data-side="${side}"><span class="dx-timeline-seq">${seq}</span><span class="dx-timeline-text"><strong>${side} · ${actor.trim()}</strong> ｜ ${detail.trim()}</span></div>`);
    content = content.replace(/^-?\s*R\d+-T\d+-A \| ([^→|\n]+)→([^|\n]+) \| 技能:([^|\n]+) \| (.+?) \| 结果:([^|\n]+) \| 最终伤害:(\d+)/gm, (_, actor, target, skill, formula, result, damage) => `<div class="dx-ticket"><div class="dx-ticket-main"><span class="dx-skill">${skill.trim()}</span><span class="dx-arrow">·</span><span class="dx-actor">${actor.trim()}</span><span class="dx-arrow">→</span><span class="dx-actor">${target.trim()}</span><span class="dx-result" data-r="${result.trim()}">${result.trim()}</span><span class="dx-dmg"><small>伤害</small>${damage}</span></div><div class="dx-formula">${formula.trim()}</div></div>`);
    content = content.replace(/^-?\s*R\d+-T\d+-A \| ([^→|\n]+)→([^|\n]+) \| (.+?) \| 结果:([^|\n]+) \| 最终伤害:(\d+)/gm, (_, actor, target, formula, result, damage) => `<div class="dx-ticket"><div class="dx-ticket-main"><span class="dx-actor">${actor.trim()}</span><span class="dx-arrow">→</span><span class="dx-actor">${target.trim()}</span><span class="dx-result" data-r="${result.trim()}">${result.trim()}</span><span class="dx-dmg"><small>伤害</small>${damage}</span></div><div class="dx-formula">${formula.trim()}</div></div>`);
    content = content.replace(/^-?\s*R\d+-T\d+-S \| ([^→|\n]+)→([^|\n]+) \| (.+?) \| 结果:([^|\n]+)/gm, (_, actor, target, formula, result) => `<div class="dx-ticket mini"><span class="dx-actor">${actor.trim()}</span><span class="dx-arrow">→</span><span class="dx-actor">${target.trim()}</span><span class="dx-result" data-r="${result.trim()}" style="color:#a888d4;border-color:rgba(168,136,212,.5);background:rgba(168,136,212,.14)">神魂·${result.trim()}</span></div>`);
    content = content.replace(/^-?\s*N\d+-\d+ \| ([^→|\n]+)→([^|\n]+) \| 行动:([^|\n]+) \| 结果:([^|\n]+)/gm, (_, actor, target, action, result) => `<div class="dx-ticket npc" style="flex-direction:row;align-items:center;gap:8px;background:rgba(95,179,196,.07);border-color:rgba(95,179,196,.28)"><span style="color:#5fb3c4;font-size:10px;font-weight:700;letter-spacing:.08em">NPC</span><span class="dx-actor">${actor.trim()}</span><span class="dx-arrow">→</span><span class="dx-actor">${target.trim()}</span><span style="color:#d8c188;font-size:11.5px">${action.trim()}</span><span style="margin-left:auto;color:#6fb39a;font-size:11px">${result.trim()}</span></div>`);
    content = content.replace(/^轮末\s*[:：]\s*(.+)$/gm, (_, footer) => `<div class="dx-footer">${footer.trim()}</div>`);
    return `<style>${TICKET_CSS}</style><details class="dx-combat-round"><summary class="dx-round-head"><span>⚔ 本轮战斗结算 ⚔</span><span class="dx-round-toggle" aria-hidden="true"></span></summary><div class="dx-round-body">${content}</div></details>`;
  }

  function normalizedLines(body) {
    return String(body || '').replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
  }

  function fieldValue(lines, label) {
    const matcher = new RegExp(`^${label}\\s*[:：]\\s*(.+)$`);
    return lines.map(line => line.match(matcher)).find(Boolean)?.[1]?.trim() || '';
  }

  function sectionItems(lines, heading, stopHeadings) {
    const start = lines.findIndex(line => new RegExp(`^${heading}\\s*[:：]\\s*$`).test(line));
    if (start < 0) return [];
    const stop = new RegExp(`^(?:${stopHeadings.join('|')})\\s*[:：]`);
    const items = [];
    for (const line of lines.slice(start + 1)) {
      if (stop.test(line)) break;
      if (/^-\s*/.test(line)) items.push(line.replace(/^-\s*/, '').trim());
    }
    return items;
  }

  function renderMeta(entries) {
    const visible = entries.filter(([, value]) => value);
    if (!visible.length) return '';
    return `<div class="dx-receipt-meta">${visible.map(([label, value]) => `<div class="dx-meta"><span class="dx-meta-label">${escapeHtml(label)}</span><span class="dx-meta-value">${escapeHtml(value)}</span></div>`).join('')}</div>`;
  }

  function renderShopItem(item) {
    const parts = item.split('|').map(part => part.trim()).filter(Boolean);
    const name = parts.shift() || '未命名商品';
    const partValue = label => parts.find(part => new RegExp(`^${label}\\s*[:：]`).test(part))?.replace(new RegExp(`^${label}\\s*[:：]\\s*`), '') || '';
    const rank = partValue('品阶');
    const price = partValue('价格') || '价格面议';
    const stock = partValue('库存');
    const description = partValue('说明');
    const stockCount = stock.match(/^\s*(\d+)/)?.[1] || '';
    return `<article class="dx-market-item" data-dx-item-name="${escapeHtml(name)}" data-dx-stock-count="${stockCount}"><span class="dx-item-glyph" aria-hidden="true">◇</span><div class="dx-item-main"><div class="dx-item-top"><span class="dx-item-name">${escapeHtml(name)}</span>${rank ? `<span class="dx-item-rank">${escapeHtml(rank)}</span>` : ''}${stock ? `<span class="dx-item-stock">${escapeHtml(stock)}</span>` : ''}</div></div><div class="dx-item-price"><strong>${escapeHtml(price)}</strong><div class="dx-buy-actions"><button class="dx-buy-button" type="button" data-dx-buy-open aria-pressed="false">购买</button></div></div>${description ? `<div class="dx-item-desc">${escapeHtml(description)}</div>` : ''}</article>`;
  }

  function renderShopPurchaseDock() {
    return '<div class="dx-buy-dock" data-dx-buy-dock hidden><div class="dx-buy-name"><small>当前选购</small><span data-dx-buy-name></span></div><div class="dx-buy-stepper"><button class="dx-buy-step" type="button" data-dx-buy-minus aria-label="减少购买数量">−</button><output class="dx-buy-count" data-dx-buy-count aria-label="购买数量">1</output><button class="dx-buy-step" type="button" data-dx-buy-plus aria-label="增加购买数量">+</button></div><button class="dx-buy-button" type="button" data-dx-buy-confirm>写入输入栏</button><div class="dx-buy-status" data-dx-buy-status aria-live="polite"></div></div>';
  }

  function renderShopReceiptMarkup(body) {
    const lines = normalizedLines(body);
    const title = fieldValue(lines, '商店') || '无名商铺';
    const items = sectionItems(lines, '商品', ['备注']);
    const note = fieldValue(lines, '备注');
    return `<style>${TICKET_CSS}</style><details class="dx-receipt dx-shop-receipt" open><summary class="dx-receipt-head"><span class="dx-receipt-emblem" aria-hidden="true">市</span><span class="dx-heading-copy"><span class="dx-receipt-kicker">坊市 · 玉简货单</span><strong class="dx-receipt-title">${escapeHtml(title)}</strong></span><span class="dx-receipt-toggle" aria-hidden="true"></span></summary><div class="dx-receipt-body">${renderMeta([['地点', fieldValue(lines, '地点')], ['掌柜', fieldValue(lines, '店主')]])}<div class="dx-section-title">在售灵珍</div><div class="dx-receipt-list">${items.length ? items.map(renderShopItem).join('') : '<div class="dx-bullet">今日玉简未录可售灵珍</div>'}</div>${note ? `<div class="dx-receipt-note">${escapeHtml(note)}</div>` : ''}</div></details>`;
  }

  function renderShopReceipt(body) {
    return renderShopReceiptMarkup(body)
      .replace('dx-shop-receipt" open', 'dx-shop-receipt"')
      .replace('</div></details>', `${renderShopPurchaseDock()}</div></details>`);
  }

  function renderBulletList(items, emptyText) {
    return items.length ? items.map(item => `<div class="dx-bullet">${escapeHtml(item)}</div>`).join('') : `<div class="dx-bullet">${escapeHtml(emptyText)}</div>`;
  }

  function renderQuestBoardItem(item) {
    const parts = item.split('|').map(part => part.trim()).filter(Boolean);
    const title = parts.shift() || '未命名任务';
    const partValue = label => parts.find(part => new RegExp(`^${label}\\s*[:：]`).test(part))?.replace(new RegExp(`^${label}\\s*[:：]\\s*`), '') || '';
    const issuer = partValue('委托方');
    const type = partValue('类型');
    const difficulty = partValue('难度');
    const location = partValue('地点');
    const deadline = partValue('时限');
    const goal = partValue('目标');
    const reward = partValue('奖励');
    const details = [goal && `目标：${goal}`, reward && `奖励：${reward}`].filter(Boolean).join('｜');
    const meta = [issuer, type, difficulty, location, deadline].filter(Boolean).map(value => `<span>${escapeHtml(value)}</span>`).join('');
    return `<article class="dx-quest-board-item" data-dx-quest-name="${escapeHtml(title)}"><div class="dx-quest-board-main"><strong class="dx-quest-board-title">${escapeHtml(title)}</strong>${meta ? `<div class="dx-quest-board-meta">${meta}</div>` : ''}</div><button class="dx-quest-accept" type="button" data-dx-quest-accept aria-pressed="false">接取</button>${details ? `<p class="dx-quest-board-summary">${escapeHtml(details)}</p>` : ''}</article>`;
  }

  function renderQuestBoard(body) {
    const lines = normalizedLines(body);
    const title = fieldValue(lines, '任务列表') || fieldValue(lines, '任务板') || '可接取任务';
    const items = sectionItems(lines, '任务', ['备注']);
    const note = fieldValue(lines, '备注');
    return `<style>${TICKET_CSS}</style><details class="dx-receipt dx-quest-receipt dx-quest-board"><summary class="dx-receipt-head"><span class="dx-receipt-emblem" aria-hidden="true">令</span><span class="dx-heading-copy"><span class="dx-receipt-kicker">宗门 · 悬令玉牒</span><strong class="dx-receipt-title">${escapeHtml(title)}</strong></span><span class="dx-quest-actions"><span class="dx-quest-seal" aria-label="可接取">可<br>接</span><span class="dx-receipt-toggle" aria-hidden="true"></span></span></summary><div class="dx-receipt-body"><div class="dx-section-title">可接取任务</div><div class="dx-quest-board-list">${items.length ? items.map(renderQuestBoardItem).join('') : '<div class="dx-bullet">当前没有可接取任务</div>'}</div>${note ? `<div class="dx-receipt-note">${escapeHtml(note)}</div>` : ''}</div></details>`;
  }

  function writeQuestToComposer(button) {
    const item = button?.closest?.('[data-dx-quest-name]');
    const name = String(item?.dataset?.dxQuestName || '').trim();
    const textarea = hostDocument?.querySelector?.('#send_textarea');
    if (!name || !textarea) return false;
    const draft = `接取${name}任务`;
    const current = String(textarea.value || '').trimEnd();
    textarea.value = current ? `${current}\\n${draft}` : draft;
    textarea.dispatchEvent?.(new hostWindow.Event('input', { bubbles: true }));
    textarea.focus?.();
    button.textContent = '已写入';
    button.dataset.written = 'true';
    button.setAttribute('aria-pressed', 'true');
    return true;
  }

  function bindQuestInteractions() {
    const onClick = event => {
      const control = event.target?.closest?.('[data-dx-quest-accept]');
      if (!control) return;
      writeQuestToComposer(control);
    };
    hostDocument?.addEventListener?.('click', onClick);
    disposers.push(() => hostDocument?.removeEventListener?.('click', onClick));
  }

  const TICKET_TYPES = Object.freeze([
    { tag: 'CombatRound', selector: 'combatround, [data-combat-round]', render: renderCombatRound },
    { tag: 'ShopReceipt', selector: 'shopreceipt, [data-shop-receipt]', render: renderShopReceipt },
    { tag: 'QuestBoard', selector: 'questboard, [data-quest-board]', render: renderQuestBoard },
  ]);

  function replaceCombatRounds(text) {
    return String(text || '').replace(/<CombatRound\b[^>]*>([\s\S]*?)<\/CombatRound>/gi, (_, body) => renderCombatRound(body));
  }

  function replaceTicketBlocks(text) {
    const rendered = TICKET_TYPES.reduce((content, ticket) => {
      const pattern = new RegExp(`<${ticket.tag}\\b[^>]*>([\\s\\S]*?)<\\/${ticket.tag}>`, 'gi');
      return content.replace(pattern, (_, body) => ticket.render(body));
    }, String(text || ''));
    // 旧版已接取任务票据已取消：历史楼层残留的机器标签也不得泄漏到正文显示。
    return rendered.replace(/<QuestReceipt\b[^>]*>[\s\S]*?<\/QuestReceipt>/gi, '');
  }

  function findMessageTextNode(id) {
    const retrieve = runtimeFunction('retrieveDisplayedMessage');
    if (retrieve) {
      try {
        const result = retrieve(id);
        const textNode = result?.hasClass?.('mes_text') ? result : result?.find?.('.mes_text');
        if (textNode?.length) return textNode;
      } catch { /* 使用宿主 DOM 兜底。 */ }
    }
    const dollar = hostWindow.$;
    if (typeof dollar === 'function') return dollar(`#chat > .mes[mesid="${Number(id)}"] .mes_text`);
    return null;
  }

  function replaceNodeWithHtml(node, html, floorId) {
    const document = node?.ownerDocument || hostDocument;
    const fragment = document.createElement('template');
    fragment.innerHTML = html;
    for (const ticket of fragment.content.querySelectorAll('.dx-combat-round, .dx-receipt')) {
      ticket.dataset.daoyuanTicketFloor = String(floorId);
    }
    node.replaceWith(fragment.content.cloneNode(true));
  }

  function applyTicketFloorLimit(elements, recentIds) {
    const allowed = new Set((recentIds || []).map(id => String(id)));
    let hidden = 0;
    for (const element of elements || []) {
      const floor = element?.dataset?.daoyuanTicketFloor
        || element?.closest?.('#chat > .mes[mesid]')?.getAttribute?.('mesid');
      if (floor == null) continue;
      if (element.dataset) element.dataset.daoyuanTicketFloor = String(floor);
      element.hidden = !allowed.has(String(floor));
      if (element.hidden) hidden += 1;
    }
    return hidden;
  }

  function syncTicketFloorLimit(recentIds) {
    const elements = hostDocument?.querySelectorAll?.('#chat > .mes .mes_text .dx-combat-round, #chat > .mes .mes_text .dx-receipt') || [];
    return applyTicketFloorLimit(elements, recentIds);
  }

  function findRenderedTickets(node, selector) {
    const root = node?.[0] || node;
    if (!root?.querySelectorAll) return [];
    return [...root.querySelectorAll(selector)];
  }

  function isTicketElement(element) {
    return Boolean(element?.matches?.('.dx-combat-round, .dx-receipt'));
  }

  function isReaderReceiptElement(element) {
    return Boolean(element?.matches?.('.dx-receipt'));
  }

  function isReaderTailBoundary(element) {
    if (!element?.tagName) return false;
    if (element.matches?.('.TH-render, [data-daoyuan-reader], .dy-reader-v2__source-time-card')) return true;
    if (element.tagName === 'STYLE' || element.tagName === 'IFRAME') return true;
    if (element.tagName === 'DETAILS' && !isTicketElement(element)) return true;
    if (element.tagName === 'DIV' && !isTicketElement(element)) return true;
    if (element.tagName === 'P' && /^\s*\d+\s*$/.test(String(element.textContent || ''))) return true;
    return false;
  }

  function isReaderTailContent(element) {
    if (!element?.tagName) return false;
    // 商店/任务票据属于正文阅读流；战斗票据必须留在正文美化容器之外。
    if (isReaderReceiptElement(element)) return true;
    if (element.matches?.('.dx-combat-round')) return false;
    return /^(?:P|BLOCKQUOTE|FIGURE|IMG|UL|OL|HR)$/.test(element.tagName)
      && Boolean(String(element.textContent || element.getAttribute?.('alt') || '').trim() || element.tagName === 'HR');
  }

  function integrateTicketsIntoReader(node) {
    const root = node?.[0] || node;
    if (!root?.querySelector || !root?.children) return 0;
    const reader = root.querySelector('[data-daoyuan-reader], .dy-reader-v2');
    const readerBody = reader?.querySelector?.('.dy-reader-v2__body');
    if (!readerBody) return 0;

    const firstTicket = [...root.children].find(isReaderReceiptElement);
    if (!firstTicket || reader.contains(firstTicket)) return 0;

    let moved = 0;
    let cursor = firstTicket;
    while (cursor) {
      const next = cursor.nextElementSibling;
      if (cursor !== firstTicket && isReaderTailBoundary(cursor)) break;
      if (isReaderTailContent(cursor)) {
        readerBody.append(cursor);
        moved += 1;
      }
      cursor = next;
    }
    return moved;
  }

  function separateCombatTicketsFromReader(node) {
    const root = node?.[0] || node;
    if (!root?.querySelector || !root?.insertBefore) return 0;
    const reader = root.querySelector('[data-daoyuan-reader], .dy-reader-v2');
    if (!reader) return 0;
    const tickets = [...reader.querySelectorAll('.dx-combat-round')];
    if (!tickets.length) return 0;
    const anchor = reader.nextSibling;
    for (const ticket of tickets) root.insertBefore(ticket, anchor);
    return tickets.length;
  }

  function replaceStrippedShopReceipt(node, body, floorId) {
    const root = node?.[0] || node;
    if (!root?.querySelectorAll || root.querySelector('.dx-shop-receipt')) return false;

    const lines = normalizedLines(body);
    const shop = fieldValue(lines, '商店');
    const location = fieldValue(lines, '地点');
    const owner = fieldValue(lines, '店主');
    const expectedItems = sectionItems(lines, '商品', ['备注']);
    if (!shop || !expectedItems.length) return false;

    const paragraphs = [...root.querySelectorAll('p')];
    const heading = paragraphs.find(element => {
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      return text.includes(`商店: ${shop}`) || text.includes(`商店：${shop}`);
    });
    if (!heading) return false;

    const headingText = String(heading.textContent || '').replace(/\s+/g, ' ');
    if (location && !headingText.includes(location)) return false;
    if (owner && !headingText.includes(owner)) return false;

    let list = heading.nextElementSibling;
    while (list && list.tagName === 'P' && !String(list.textContent || '').trim()) list = list.nextElementSibling;
    if (!list || !/^(?:UL|OL)$/.test(list.tagName)) return false;
    const renderedItems = [...list.querySelectorAll(':scope > li')];
    if (renderedItems.length < expectedItems.length) return false;
    const matchesSource = expectedItems.every((item, index) => {
      const expectedName = item.split('|')[0]?.trim();
      return expectedName && String(renderedItems[index]?.textContent || '').includes(expectedName);
    });
    if (!matchesSource) return false;

    const document = root.ownerDocument || hostDocument;
    const fragment = document.createElement('template');
    fragment.innerHTML = renderShopReceipt(body);
    const receipt = fragment.content.querySelector('.dx-shop-receipt');
    if (!receipt) return false;
    receipt.dataset.daoyuanTicketFloor = String(floorId);
    heading.before(fragment.content.cloneNode(true));
    heading.remove();
    list.remove();
    return true;
  }

  // 正文美化完成后，CombatRound 可能已被宿主拆成“说明段落 + 行动列表”。
  // 仍在同一个票据脚本入口中按原文严格匹配并重建，不改变正文美化脚本。
  function replaceRenderedCombatRound(node, body, floorId) {
    const root = node?.[0] || node;
    if (!root?.querySelectorAll) return false;
    const sourceLines = normalizedLines(body);
    const round = sourceLines.find(line => /^轮数\s*[:：]/.test(line))?.match(/^轮数\s*[:：]\s*(\d+)/)?.[1];
    const enemyLine = sourceLines.find(line => /\|\s*境界\s*[:：]/.test(line) && /\|\s*(?:五维:[^|]+\|\s*)?生命\s*[:：]/.test(line));
    const enemyName = enemyLine?.split('|')[0]?.trim();
    const actionIds = sourceLines.map(line => line.match(/^(?:-\s*)?((?:R\d+-T\d+-[AS])|(?:N\d+-\d+))\s*\|/)?.[1]).filter(Boolean);
    if (!round || !enemyName || !actionIds.length) return false;

    for (const heading of [...root.querySelectorAll('p')]) {
      const headingText = String(heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!new RegExp(`轮数\\s*[:：]\\s*${round}(?:\\D|$)`).test(headingText) || !headingText.includes(enemyName)) continue;
      let list = heading.nextElementSibling;
      while (list && list.tagName === 'P' && !String(list.textContent || '').trim()) list = list.nextElementSibling;
      if (!list || !/^(?:UL|OL)$/.test(list.tagName)) continue;
      const listText = [...list.querySelectorAll(':scope > li')].map(item => item.textContent || '').join(' ').replace(/\s+/g, ' ');
      if (!actionIds.some(id => listText.includes(id))) continue;

      const document = root.ownerDocument || hostDocument;
      const fragment = document.createElement('template');
      fragment.innerHTML = renderCombatRound(body);
      const ticket = fragment.content.querySelector('.dx-combat-round');
      if (!ticket) continue;
      ticket.dataset.daoyuanTicketFloor = String(floorId);
      heading.before(fragment.content.cloneNode(true));
      heading.remove();
      list.remove();
      return true;
    }
    return false;
  }

  // 正文美化会把 QuestBoard 拆成“任务列表段落 + 任务段落 + ul/li”。
  // 在不修改正文美化脚本的前提下，依据原文任务名重建任务票据。
  function replaceRenderedQuestBoard(node, body, floorId) {
    const root = node?.[0] || node;
    if (!root?.querySelectorAll || root.querySelector('.dx-quest-board')) return false;
    const sourceLines = normalizedLines(body);
    const title = fieldValue(sourceLines, '任务列表') || fieldValue(sourceLines, '任务板');
    const expectedItems = sectionItems(sourceLines, '任务', ['备注']);
    if (!title || !expectedItems.length) return false;

    for (const heading of [...root.querySelectorAll('p')]) {
      const headingText = String(heading.textContent || '').replace(/\s+/g, ' ').trim();
      if (!(headingText.includes(`任务列表: ${title}`) || headingText.includes(`任务列表：${title}`))) continue;

      const between = [];
      let cursor = heading.nextElementSibling;
      while (cursor && cursor.tagName === 'P' && !/^(?:UL|OL)$/.test(cursor.tagName)) {
        const text = String(cursor.textContent || '').replace(/\s+/g, ' ').trim();
        if (text && !/^任务\s*[:：]\s*$/.test(text)) break;
        between.push(cursor);
        cursor = cursor.nextElementSibling;
      }
      const list = cursor;
      if (!list || !/^(?:UL|OL)$/.test(list.tagName)) continue;
      const renderedItems = [...list.querySelectorAll(':scope > li')];
      if (renderedItems.length < expectedItems.length) continue;
      const matchesSource = expectedItems.every((item, index) => {
        const expectedName = item.split('|')[0]?.trim();
        return expectedName && String(renderedItems[index]?.textContent || '').includes(expectedName);
      });
      if (!matchesSource) continue;

      const document = root.ownerDocument || hostDocument;
      const fragment = document.createElement('template');
      fragment.innerHTML = renderQuestBoard(body);
      const ticket = fragment.content.querySelector('.dx-quest-board');
      if (!ticket) continue;
      ticket.dataset.daoyuanTicketFloor = String(floorId);
      heading.before(fragment.content.cloneNode(true));
      heading.remove();
      between.forEach(element => element.remove());
      list.remove();
      return true;
    }
    return false;
  }

  function isValidCombatRoundBody(body) {
    const lines = normalizedLines(body);
    if (!/^轮数\s*[:：]\s*\d+$/.test(lines[0] || '')) return false;
    const hasEnemy = lines.some(line => /\|\s*境界\s*[:：]/.test(line) && /\|\s*(?:五维:[^|]+\|\s*)?生命\s*[:：]\s*\d+→\d+/.test(line));
    const hasAction = lines.some(line => /^(?:-\s*)?(?:R\d+-T\d+-[AS]|N\d+-\d+)\s*\|/.test(line));
    return hasEnemy && hasAction;
  }

  function isValidQuestBoardBody(body) {
    const lines = normalizedLines(body);
    const hasTitle = /^任务列表\s*[:：]\s*.+$/.test(lines[0] || '') || /^任务板\s*[:：]\s*.+$/.test(lines[0] || '');
    const hasItems = sectionItems(lines, '任务', ['备注']);
    return hasTitle && hasItems.length > 0;
  }

  function rawTicketBodies(text, tag) {
    if (tag === 'CombatRound' || tag === 'QuestBoard') {
      // 思维链/提示词经常会用反引号展示“<CombatRound>/<QuestBoard>标签”模板。
      // 不能从第一个伪开标签一直贪婪吃到真正的闭标签；逐个候选开标签配对，
      // 只接受通过对应结构校验的真实正文票据。
      const source = String(text || '');
      const opening = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
      const closing = new RegExp(`</${tag}\\s*>`, 'i');
      const bodies = [];
      let match;
      while ((match = opening.exec(source))) {
        const rest = source.slice(match.index + match[0].length);
        const end = rest.search(closing);
        if (end < 0) continue;
        const body = rest.slice(0, end);
        if (tag === 'CombatRound' ? isValidCombatRoundBody(body) : isValidQuestBoardBody(body)) bodies.push(body);
      }
      return bodies;
    }
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    return [...String(text || '').matchAll(pattern)].map(match => match[1]);
  }

  function purchaseDraft(name, quantity) {
    const safeQuantity = Math.max(1, Math.trunc(Number(quantity) || 1));
    return `购买${String(name || '').trim()}x${safeQuantity}`;
  }

  function setShopQuantity(dock, nextQuantity) {
    const output = dock?.querySelector?.('[data-dx-buy-count]');
    if (!output) return 1;
    const stock = Math.trunc(Number(dock.dataset?.dxStockCount));
    const maximum = Number.isFinite(stock) && stock > 0 ? stock : Number.MAX_SAFE_INTEGER;
    const quantity = Math.max(1, Math.min(maximum, Math.trunc(Number(nextQuantity) || 1)));
    output.textContent = String(quantity);
    const minus = dock.querySelector('[data-dx-buy-minus]');
    const plus = dock.querySelector('[data-dx-buy-plus]');
    if (minus) minus.disabled = quantity <= 1;
    if (plus) plus.disabled = quantity >= maximum;
    return quantity;
  }

  function writePurchaseToComposer(dock) {
    const name = String(dock?.dataset?.dxItemName || '').trim();
    const quantity = setShopQuantity(dock, dock?.querySelector?.('[data-dx-buy-count]')?.textContent);
    const textarea = hostDocument?.querySelector?.('#send_textarea');
    if (!name || !textarea) return false;
    const draft = purchaseDraft(name, quantity);
    const current = String(textarea.value || '').trimEnd();
    textarea.value = current ? `${current}\n${draft}` : draft;
    textarea.dispatchEvent?.(new hostWindow.Event('input', { bubbles: true }));
    textarea.focus?.();
    const status = dock.querySelector('[data-dx-buy-status]');
    if (status) status.textContent = `已写入：${draft}`;
    return true;
  }

  function bindShopInteractions() {
    const onClick = event => {
      const control = event.target?.closest?.('[data-dx-buy-open], [data-dx-buy-minus], [data-dx-buy-plus], [data-dx-buy-confirm]');
      const receipt = control?.closest?.('.dx-shop-receipt');
      const dock = receipt?.querySelector?.('[data-dx-buy-dock]');
      if (!control || !receipt || !dock) return;
      if (control.matches('[data-dx-buy-open]')) {
        const item = control.closest('[data-dx-item-name]');
        if (!item) return;
        receipt.querySelectorAll('[data-dx-buy-open]').forEach(button => {
          button.setAttribute('aria-pressed', String(button === control));
          button.textContent = button === control ? '已选' : '购买';
        });
        dock.dataset.dxItemName = item.dataset.dxItemName || '';
        dock.dataset.dxStockCount = item.dataset.dxStockCount || '';
        const name = dock.querySelector('[data-dx-buy-name]');
        const status = dock.querySelector('[data-dx-buy-status]');
        if (name) name.textContent = dock.dataset.dxItemName;
        if (status) status.textContent = '';
        dock.hidden = false;
        setShopQuantity(dock, 1);
        dock.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      const current = Number(dock.querySelector('[data-dx-buy-count]')?.textContent) || 1;
      if (control.matches('[data-dx-buy-minus]')) setShopQuantity(dock, current - 1);
      if (control.matches('[data-dx-buy-plus]')) setShopQuantity(dock, current + 1);
      if (control.matches('[data-dx-buy-confirm]')) writePurchaseToComposer(dock);
    };
    hostDocument?.addEventListener?.('click', onClick);
    disposers.push(() => hostDocument?.removeEventListener?.('click', onClick));
  }

  async function renderMessage(message) {
    const raw = activeMessageText(message);
    const ticketGroups = TICKET_TYPES.map(ticket => ({ ticket, bodies: rawTicketBodies(raw, ticket.tag) })).filter(group => group.bodies.length);
    // 没有票据的楼层绝对不重绘，避免破坏已有的状态栏/自定义UI节点。
    if (!ticketGroups.length) return false;
    const node = findMessageTextNode(messageId(message));
    if (!node?.length) return false;
    let rendered = 0;
    for (const { ticket, bodies } of ticketGroups) {
      const renderedTickets = findRenderedTickets(node, ticket.selector);
      for (const [index, element] of renderedTickets.entries()) {
        const body = bodies[index];
        if (body === undefined) continue;
        if (ticket.tag === 'CombatRound' && !isValidCombatRoundBody(body)) {
          // 过滤提示词中的CombatRound模板或截断残片，避免把整段规则文本塞进战斗票据。
          element.remove?.();
          continue;
        }
        replaceNodeWithHtml(element, ticket.render(body), messageId(message));
        rendered += 1;
      }
      if (ticket.tag === 'ShopReceipt' && renderedTickets.length === 0) {
        for (const body of bodies) if (replaceStrippedShopReceipt(node, body, messageId(message))) rendered += 1;
      }
      if (ticket.tag === 'CombatRound' && renderedTickets.length === 0) {
        for (const body of bodies) if (replaceRenderedCombatRound(node, body, messageId(message))) rendered += 1;
      }
      if (ticket.tag === 'QuestBoard' && renderedTickets.length === 0) {
        for (const body of bodies) if (replaceRenderedQuestBoard(node, body, messageId(message))) rendered += 1;
      }
    }
    const separated = separateCombatTicketsFromReader(node);
    const integrated = integrateTicketsIntoReader(node);
    return rendered > 0 || separated > 0 || integrated > 0;
  }

  async function scanRecent(reason) {
    const messages = getRecentAssistantMessages();
    let rendered = 0;
    for (const message of messages) if (await renderMessage(message)) rendered += 1;
    const ids = messages.map(messageId);
    const hidden = syncTicketFloorLimit(ids);
    console.info(`[道渊票据渲染] ${reason}：检查 ${messages.length} 层 AI 楼层，重绘 ${rendered} 层，隐藏 ${hidden} 张越界票据`);
    return { reason, scanned: messages.length, rendered, hidden, ids };
  }

  function enqueueScan(reason) {
    chain = chain.catch(() => undefined).then(() => scanRecent(reason));
    return chain;
  }

  function requestScan(reason) {
    if (scheduledReasons.has(reason)) return;
    scheduledReasons.add(reason);
    queueMicrotask(() => {
      scheduledReasons.delete(reason);
      enqueueScan(reason).catch(error => console.warn('[道渊票据渲染] 扫描失败', error));
    });
  }

  function bindEvent(eventName, handler) {
    if (!eventName) return;
    const eventOn = runtimeFunction('eventOn');
    if (typeof eventOn !== 'function') return;
    const subscription = eventOn(eventName, handler);
    if (subscription?.stop) disposers.push(() => subscription.stop());
  }

  function bindEvents() {
    const events = localWindow.tavern_events || hostWindow.tavern_events || {};
    const mvuEvents = localWindow.Mvu?.events || hostWindow.Mvu?.events || {};
    bindEvent(mvuEvents.VARIABLE_UPDATE_STARTED, () => {
      lastMvuStartedMessageId = latestAssistantId();
      requestScan('变量解析开始');
    });
    bindEvent(mvuEvents.VARIABLE_UPDATE_ENDED, () => requestScan('变量更新完成'));
    bindEvent(events.GENERATION_ENDED, () => {
      if (latestAssistantId() !== lastMvuStartedMessageId) requestScan('正文生成完成兜底');
    });
    bindEvent(events.APP_READY, () => requestScan('酒馆页面就绪'));
    bindEvent(events.CHAT_CHANGED, () => requestScan('聊天切换/页面恢复'));
    for (const [eventName, reason] of [
      [events.MESSAGE_UPDATED, '楼层更新'],
      [events.MESSAGE_SWIPED, '楼层重Roll'],
      [events.MESSAGE_EDITED, '楼层编辑'],
      [events.MESSAGE_DELETED, '楼层删除'],
    ]) bindEvent(eventName, () => requestScan(reason));
  }

  function cleanup() {
    while (disposers.length) {
      try { disposers.pop()(); } catch { /* best effort */ }
    }
    if (hostWindow[API_KEY]?.scriptId === SCRIPT_ID) delete hostWindow[API_KEY];
    if (hostWindow[CLEANUP_KEY] === cleanup) delete hostWindow[CLEANUP_KEY];
  }

  function install() {
    try { hostWindow[CLEANUP_KEY]?.(); } catch { /* 清理旧实例失败不阻断新实例。 */ }
    bindEvents();
    bindShopInteractions();
    bindQuestInteractions();
    hostWindow[API_KEY] = Object.freeze({ scriptId: SCRIPT_ID, version: VERSION, scan: reason => enqueueScan(reason || '手动扫描'), renderText: replaceTicketBlocks, cleanup });
    hostWindow[CLEANUP_KEY] = cleanup;
    requestScan('酒馆页面初次恢复');
    console.info('[道渊票据渲染] V' + VERSION + ' 已加载；仅事件驱动扫描最近三层 AI 楼层');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { activeMessageText, getRecentAssistantMessages, renderCombatRound, renderShopReceipt, renderQuestBoard, replaceCombatRounds, replaceTicketBlocks, enrichMissingCombatSettlements, rawTicketBodies, applyTicketFloorLimit, enemyState, isReaderTailBoundary, isReaderTailContent, isValidCombatRoundBody, isValidQuestBoardBody, replaceRenderedQuestBoard, purchaseDraft };
  } else {
    install();
    localWindow.addEventListener?.('pagehide', cleanup, { once: true });
  }
})(typeof window !== 'undefined' ? window : globalThis);
