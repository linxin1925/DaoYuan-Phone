import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const contentBeautifierPath = new URL('./vendor/daoyuan-content-beautify-v26-formal.script.json', projectRoot);
const CONTENT_BEAUTIFIER_ID = 'daoyuan-content-beautify-script-v26';
const CONTENT_BEAUTIFIER_SHA256 = '43e57a3f2b29596f2363d1657857d77b56e3aee31f9d4967aab9f40aa585773d';
const CONTENT_BEAUTIFIER_INSTALLER = '__daoyuanInstallContentBeautifierV26';
const CONTENT_BEAUTIFIER_ENABLED_KEY = 'daoyuan_content_beautifier_enabled_v1';
const CONFIG_HELPER_INSTALLER = '__daoyuanInstallConfigHelperV133';
const CONFIG_HELPER_VISIBILITY_SETTER = '__daoyuanSetConfigHelperLauncherVisibleV133';
const CONFIG_HELPER_ENABLED_KEY = 'daoyuan_config_helper_launcher_visible_v1';
const CONFIG_HELPER_REMOTE_URL = 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@main/%E9%81%93%E6%B8%8A%E9%85%8D%E7%BD%AE%E5%B0%8F%E5%8A%A9%E6%89%8B.min.js';
const CONFIG_HELPER_FALLBACK_URL = 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@master/%E9%81%93%E6%B8%8A%E9%85%8D%E7%BD%AE%E5%B0%8F%E5%8A%A9%E6%89%8B.min.js';
const formal = process.argv.includes('--formal');
const v11Test = process.argv.includes('--v11-test');
const v12Test = process.argv.includes('--v12-test');
const v11 = formal || v11Test;
const packageVersion = v12Test ? '1.2.0' : v11 ? '1.1.0' : '1.0.0';
const outputPath = new URL(v12Test ? './dist/道渊功能前端-V1.2测试候选.json' : v11 ? `./dist/道渊功能前端-V1.1${formal ? '正式' : '测试'}候选.json` : './dist/道渊功能前端-V1.0测试候选.json', projectRoot);
const packageName = v12Test ? '道渊小手机V1.2测试' : v11 ? `道渊小手机V1.1${formal ? '' : '测试'}` : '道渊小手机V1.0测试';
const importOutputPath = new URL(v12Test ? '../releases/candidates/道渊小手机V1.2测试.json' : formal ? '../releases/道渊小手机V1.1.json' : v11Test ? './dist/道渊小手机V1.1测试.json' : './dist/道渊小手机V1.0测试.json', projectRoot);
const source = await readFile(artifactPath, 'utf8');
const contentBeautifierBytes = await readFile(contentBeautifierPath);
const contentBeautifierHash = createHash('sha256').update(contentBeautifierBytes).digest('hex');
if (contentBeautifierHash !== CONTENT_BEAUTIFIER_SHA256) {
  throw new Error(`V26 正文美化快照哈希不匹配：${contentBeautifierHash}`);
}
const contentBeautifier = JSON.parse(contentBeautifierBytes.toString('utf8'));
if (contentBeautifier?.type !== 'script' || contentBeautifier?.id !== CONTENT_BEAUTIFIER_ID || typeof contentBeautifier?.content !== 'string' || !contentBeautifier.content.trim()) {
  throw new Error('V26 正文美化快照结构或稳定 ID 不符合预期');
}
const originalPortraitUrlGuard = "function safePortraitUrl(value) {\n    try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; }\n    catch (_) { return ''; }\n  }";
const customPortraitUrlGuard = "function safePortraitUrl(value) {\n    const source = String(value || '').trim();\n    if (/^data:image\\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\\s]+$/i.test(source)) return source;\n    try { const url = new URL(source); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; }\n    catch (_) { return ''; }\n  }";
if (!contentBeautifier.content.includes(originalPortraitUrlGuard)) {
  throw new Error('V26 正文美化自定义立绘接入点不符合预期');
}
const originalVisibleSpeakerDialoguePromoter = `function promoteVisibleSpeakerDialogues(article) {
    const body = article.querySelector('.dy-reader-v2__body');
    if (!body) return;
    const pattern = /^\\s*[{｛]\\s*([^{}｛｝\\n]{1,40}?)\\s*[}｝]\\s*([“「『][\\s\\S]*[”」』])\\s*$/;
    [...body.querySelectorAll(':scope > p')].forEach(paragraph => {
      const match = paragraph.textContent.match(pattern);
      if (!match) return;
      const speaker = normalizedSpeaker(match[1]);
      const spoken = String(match[2] || '').trim();
      if (!speaker || !spoken) return;
      const dialogue = body.ownerDocument.createElement('dialogue');
      dialogue.setAttribute('speaker', speaker);
      dialogue.textContent = spoken;
      paragraph.replaceWith(dialogue);
    });
  }`;
const enhancedVisibleSpeakerDialoguePromoter = `function promoteVisibleSpeakerDialogues(article) {
    const body = article.querySelector('.dy-reader-v2__body');
    if (!body) return;
    const pattern = /[{｛]\\s*([^{}｛｝\\n]{1,40}?)\\s*[}｝]\\s*((?:“[\\s\\S]*?”)|(?:「[\\s\\S]*?」)|(?:『[\\s\\S]*?』))/g;
    [...body.querySelectorAll(':scope > p')].forEach(paragraph => {
      const source = paragraph.textContent || '';
      const parts = [];
      let cursor = 0;
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(source))) {
        const speaker = normalizedSpeaker(match[1]);
        const spoken = String(match[2] || '').trim();
        if (!speaker || !spoken) continue;
        const before = source.slice(cursor, match.index);
        if (before.trim()) parts.push({ type: 'narration', text: before });
        parts.push({ type: 'dialogue', speaker, text: spoken });
        cursor = pattern.lastIndex;
      }
      if (!parts.length) return;
      const after = source.slice(cursor);
      if (after.trim()) parts.push({ type: 'narration', text: after });
      const fragment = body.ownerDocument.createDocumentFragment();
      parts.forEach(part => {
        if (part.type === 'dialogue') {
          const dialogue = body.ownerDocument.createElement('dialogue');
          dialogue.setAttribute('speaker', part.speaker);
          dialogue.textContent = part.text;
          fragment.appendChild(dialogue);
          return;
        }
        const narration = body.ownerDocument.createElement('p');
        narration.textContent = part.text.trim();
        fragment.appendChild(narration);
      });
      paragraph.replaceWith(fragment);
    });
  }`;
if (!contentBeautifier.content.includes(originalVisibleSpeakerDialoguePromoter)) {
  throw new Error('V26 正文美化显式角色对白接入点不符合预期');
}
const replaceChecked = (sourceText, originalText, replacementText, label) => {
  if (!sourceText.includes(originalText)) throw new Error(`V26 ${label}接入点不符合预期`);
  return sourceText.replace(originalText, replacementText);
};
const originalReaderEntry = `  function buildReader(content) {
    if (!content?.isConnected || content.closest(PAPER_SELECTOR)) return;`;
const limitedReaderEntry = `  const READER_MESSAGE_LIMIT = 5;
  const originalContentByReader = new WeakMap();

  function buildReader(content) {
    if (!content?.isConnected || content.closest(PAPER_SELECTOR)) return;
    const originalContentSnapshot = content.cloneNode(true);`;
const originalReaderCommit = `    if (isEmptyParagraphHost) parent.replaceWith(article);
    else content.replaceWith(article);
    repairEmptyReader(article);`;
const limitedReaderCommit = `    originalContentByReader.set(article, {
      content: originalContentSnapshot,
      wrappedByParagraph: isEmptyParagraphHost,
    });
    if (isEmptyParagraphHost) parent.replaceWith(article);
    else content.replaceWith(article);
    repairEmptyReader(article);`;
const renderAllStart = '  function renderAll() {';
const renderAllEnd = '\n\n  window[INSTANCE_KEY]?.destroy?.();';
const limitedRenderAll = `  function isVisibleAiMessage(message) {
    if (!message?.isConnected || message.getAttribute('is_user') !== 'false') return false;
    if (message.getAttribute('is_system') === 'true' || message.hidden || message.getAttribute('aria-hidden') === 'true') return false;
    const style = message.ownerDocument.defaultView?.getComputedStyle(message);
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function restoreReader(article) {
    if (!article?.isConnected) return;
    const snapshot = originalContentByReader.get(article);
    if (snapshot) {
      const content = snapshot.content.cloneNode(true);
      if (snapshot.wrappedByParagraph) {
        const paragraph = article.ownerDocument.createElement('p');
        paragraph.appendChild(content);
        article.replaceWith(paragraph);
      } else article.replaceWith(content);
      return;
    }
    const content = article.ownerDocument.createElement('content');
    const body = article.querySelector(':scope > .dy-reader-v2__body');
    if (body) content.append(...body.childNodes);
    article.replaceWith(content);
  }

  function renderAll() {
    const doc = hostDocument();
    ensureStyle(doc);
    ensurePortraitCatalog(doc);
    const moonlit = hasMoonlitEchoes(doc);
    const visibleAiMessages = [...doc.querySelectorAll('.mes[is_user="false"]')].filter(isVisibleAiMessage);
    const eligibleMessages = new Set(visibleAiMessages.slice(-READER_MESSAGE_LIMIT));

    doc.querySelectorAll(PAPER_SELECTOR).forEach(article => {
      if (!eligibleMessages.has(article.closest('.mes'))) restoreReader(article);
    });
    eligibleMessages.forEach(message => message.querySelectorAll('.mes_text content').forEach(buildReader));
    doc.querySelectorAll(PAPER_SELECTOR).forEach(article => {
      if (!eligibleMessages.has(article.closest('.mes'))) return;
      repairEmptyReader(article);
      mergeSettingsControl(article);
      trimBoundaryBreaks(article);
      syncThemeCompatibility(article, moonlit);
      syncChronicle(article);
      promoteVisibleSpeakerDialogues(article);
      promoteCommentDialogues(article);
      renderTaggedDialogues(article);
      refreshDialoguePortraits(article);
      upgradeSettingsPanel(article);
      protectReaderChrome(article);
    });
    const termsEnabled = termPreference(doc);
    setTermScanEnabled(doc, termsEnabled);
    updateTermControls(doc, termsEnabled ? (termWidgetInstance ? 'ready' : 'loading') : 'idle', termsEnabled ? (termWidgetInstance ? '已启用 · 点击正文术语查看 iWiki' : '正在载入术语库…') : '默认关闭');
  }`;
const originalObserver = `  const observer = new MutationObserver(schedule);
  observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });`;
const limitedObserver = `  const observer = new MutationObserver(records => {
    const relevant = records.some(record => {
      const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      if (target?.closest?.('.mes')) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches?.('.mes') || node.querySelector?.('.mes'))
      );
    });
    if (relevant) schedule();
  });
  observer.observe(doc.querySelector('#chat') || doc.body || doc.documentElement, { childList: true, subtree: true });`;

let contentBeautifierSource = contentBeautifier.content
  .replace(originalPortraitUrlGuard, customPortraitUrlGuard)
  .replace(originalVisibleSpeakerDialoguePromoter, enhancedVisibleSpeakerDialoguePromoter);
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalReaderEntry, limitedReaderEntry, '阅读器限额');
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalReaderCommit, limitedReaderCommit, '阅读器回退');
const renderAllStartIndex = contentBeautifierSource.indexOf(renderAllStart);
const renderAllEndIndex = contentBeautifierSource.indexOf(renderAllEnd, renderAllStartIndex);
if (renderAllStartIndex < 0 || renderAllEndIndex < 0) throw new Error('V26 阅读器渲染范围接入点不符合预期');
contentBeautifierSource = `${contentBeautifierSource.slice(0, renderAllStartIndex)}${limitedRenderAll}${contentBeautifierSource.slice(renderAllEndIndex)}`;
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalObserver, limitedObserver, '阅读器增量观察');
const contentBeautifierBootstrap = `\n;globalThis.${CONTENT_BEAUTIFIER_INSTALLER}=()=>{\n${contentBeautifierSource}\n};\n(()=>{let enabled=true;try{const storage=window.parent?.localStorage??localStorage;enabled=storage.getItem('${CONTENT_BEAUTIFIER_ENABLED_KEY}')!=='false';}catch{}if(enabled)globalThis.${CONTENT_BEAUTIFIER_INSTALLER}();})();\n`;
const configHelperBootstrap = `\n;const __daoyuanConfigHelperRemoteUrl='${CONFIG_HELPER_REMOTE_URL}';const __daoyuanConfigHelperFallbackUrl='${CONFIG_HELPER_FALLBACK_URL}';\nlet __daoyuanConfigHelperLoadPromise=null;\nconst __daoyuanFindConfigHelperBubble=()=>{const host=window.parent??window;return host.document.getElementById('bp-switch-bubble')??host.document.getElementById('jmzq-bubble');};\nglobalThis.${CONFIG_HELPER_VISIBILITY_SETTER}=(visible)=>{try{const host=window.parent??window;const bubble=__daoyuanFindConfigHelperBubble();const panel=host.document.getElementById('bp-switch-panel')??host.document.getElementById('jmzq-panel');if(bubble)bubble.style.display=visible?'':'none';if(!visible&&panel)panel.style.display='none';}catch{}};\nglobalThis.${CONFIG_HELPER_INSTALLER}=async()=>{\ntry{const host=window.parent??window;if(!__daoyuanFindConfigHelperBubble()){if(!__daoyuanConfigHelperLoadPromise)__daoyuanConfigHelperLoadPromise=import(__daoyuanConfigHelperRemoteUrl).catch(()=>import(__daoyuanConfigHelperFallbackUrl)).catch(error=>{__daoyuanConfigHelperLoadPromise=null;throw error;});await __daoyuanConfigHelperLoadPromise;}let visible=true;try{const storage=host.localStorage??localStorage;visible=storage.getItem('${CONFIG_HELPER_ENABLED_KEY}')!=='false';}catch{}globalThis.${CONFIG_HELPER_VISIBILITY_SETTER}(visible);}catch(error){console.warn('[道渊配置小助手] 远程脚本加载失败',error);}\n};\nconst __daoyuanEnsureConfigHelperV133=()=>{try{if(!__daoyuanFindConfigHelperBubble())void globalThis.${CONFIG_HELPER_INSTALLER}();else globalThis.${CONFIG_HELPER_VISIBILITY_SETTER}(true);}catch{}};\nvoid globalThis.${CONFIG_HELPER_INSTALLER}();\nsetTimeout(__daoyuanEnsureConfigHelperV133,1200);\nsetTimeout(__daoyuanEnsureConfigHelperV133,3500);\n`;
const baseBundledSource = v11 || v12Test ? `${source}${contentBeautifierBootstrap}` : source;
const configHelperVisibilityGuard = `\n;(()=>{const previous=globalThis.${CONFIG_HELPER_VISIBILITY_SETTER};if(typeof previous==='function')globalThis.${CONFIG_HELPER_VISIBILITY_SETTER}=(requested)=>{let visible=requested;try{const host=window.parent??window;visible=(host.localStorage??localStorage).getItem('${CONFIG_HELPER_ENABLED_KEY}')!=='false';}catch{}previous(visible);};})();\n`;
const bundledSource = v12Test ? `${baseBundledSource}${configHelperBootstrap}${configHelperVisibilityGuard}` : baseBundledSource;

if (importOutputPath.pathname.endsWith('/道渊小手机V0.9.json') || importOutputPath.pathname.endsWith('/道渊小手机V1.0.json')) {
  throw new Error('V1.1 打包护栏：禁止覆盖 V0.9/V1.0 正式文件');
}

const candidate = {
  format: 'daoyuan-tavern-helper-script-candidate',
  formatVersion: 1,
  name: packageName,
  version: packageVersion,
  scriptId: 'daoyuan-feature-frontend-hud-v09',
  enabled: true,
  runtimeStatus: v12Test ? 'V1.2 离线候选；地球附属世界书安装、挂载、复读、补缺及小手机交互待真实 SillyTavern 验收' : v11 ? 'Chrome/SillyTavern 已完成旧命中区根因测量；最终窄命中修正版仍需导入后人工点击验收' : '待目标 SillyTavern 环境执行回归',
  scope: v12Test ? 'V1.2 测试：完整保留 V1.1 功能；正文美化仅处理最近 5 条可见 AI 回复并支持删楼回退，小手机隐藏时暂停上下文同步；包含地球独立推演，以及基于原版主世界书的玄天界五域、势力与并行事件线推演。' : v11 ? 'V1.1：完整保留 V1.0 功能与 DSH 双 video 桌宠；内置带小手机总开关的 V26 正文美化阅读器，支持姓名大括号对白协议，并保留全局 content 兼容扫描、独立术语注解开关与原有持久化' : 'V1.0 测试候选',
  dataBoundary: {
    chatVariables: ['daoyuan_yujian_data', 'daoyuan_web_beauty_data', 'daoyuan_web_trends_data', 'daoyuan_forum_data', 'daoyuan_news_data', 'daoyuan_map_state'],
    statDataWrites: ['stat_data.主角.储物袋', 'stat_data.主角.器物', 'stat_data.主角.功法', 'stat_data.主角.极品灵石', 'stat_data.主角.上品灵石', 'stat_data.主角.中品灵石', 'stat_data.主角.下品灵石'],
    worldData: 'latest-message-floor-read-and-restricted-write',
    externalSnapshots: v12Test ? [{ name: '道渊配置小助手', delivery: 'remote-runtime', url: CONFIG_HELPER_REMOTE_URL, fallbackUrl: CONFIG_HELPER_FALLBACK_URL, observedVersion: '1.3.4', observedSha256: '9028ff8d9031b0dae9f0f158ab9d9f82c343c6bbeb3d5942f06508fe1296967b', mutableRef: 'main', alwaysRunning: true, launcherVisibleByDefault: true }] : [],
  },
  artifact: {
    file: '道渊功能前端.js',
    bytes: Buffer.byteLength(bundledSource),
    content: bundledSource,
  },
};

await mkdir(new URL('./dist/', projectRoot), { recursive: true });
if (v12Test) await mkdir(new URL('../releases/candidates/', projectRoot), { recursive: true });
await writeFile(outputPath, JSON.stringify(candidate, null, 2));

// Tavern Helper script-library import shape. Keep this separate from the
// audit candidate above: the latter intentionally carries project metadata,
// while this object matches the script import contract used by the project.
const importableScript = {
  type: 'script',
  version: packageVersion,
  enabled: true,
  name: packageName,
  id: 'daoyuan-feature-frontend-hud-v09',
  content: bundledSource,
  info: v12Test ? '道渊小手机 V1.2 测试版：补齐玄天界独立推演执行器，读取原版主世界书与最近 5 条可见 AI 回复，多条事件线并行推进；地球与玄天界 API、状态账本完全隔离。配置助手保持 V1.3.3 原样。需在真实 SillyTavern 验收。' : v11 ? `道渊小手机 V1.1${formal ? '' : ' 测试版'}：完整保留 V1.0 功能与 DSH 双 video 桌宠；内置带小手机总开关的 V26 正文美化阅读器，支持 {角色标准姓名}“台词”协议，兼容旧对白格式，并保留全局 content 扫描、独立术语开关及设置持久化。` : '道渊小手机 V1.0 测试候选。',
  button: {
    enabled: false,
    buttons: [],
  },
  data: {},
  export_with: {
    data: true,
    button: true,
  },
};

await writeFile(importOutputPath, JSON.stringify(importableScript, null, 2));
console.log(`candidate package written: ${outputPath.pathname}`);
console.log(`Tavern Helper import package written: ${importOutputPath.pathname}`);
