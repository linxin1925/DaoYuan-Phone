import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const projectRoot = new URL('..', import.meta.url);
const artifactPath = new URL('./dist/道渊功能前端.js', projectRoot);
const contentBeautifierPath = new URL('./vendor/daoyuan-content-beautify-v26-formal.script.json', projectRoot);
const ticketRendererPath = new URL('./vendor/daoyuan-ticket-renderer-v08.js', projectRoot);
const bodyPromptPath = new URL('./vendor/正文边界与对白格式CoT-V0.8.txt', projectRoot);
const ticketPromptPath = new URL('./vendor/剧情票据CoT-V0.8.txt', projectRoot);
const CONTENT_BEAUTIFIER_ID = 'daoyuan-content-beautify-script-v26';
const CONTENT_BEAUTIFIER_SHA256 = '43e57a3f2b29596f2363d1657857d77b56e3aee31f9d4967aab9f40aa585773d';
const CONTENT_BEAUTIFIER_INSTALLER = '__daoyuanInstallContentBeautifierV26';
const CONTENT_BEAUTIFIER_ENABLED_KEY = 'daoyuan_content_beautifier_enabled_v1';
const CONTENT_ASSIST_SETTINGS_KEY = 'daoyuan_content_assist_settings_v1';
const TICKET_RENDERER_SHA256 = '27af0aaf3b0b0ba887c96228be4c43afe8a03ba80c6f3ecf6ed0fa3d5facc47c';
const BODY_PROMPT_SHA256 = 'acf0ecd30388af176ad97beebdb52557db7bd149d3caa12181cbaab1e4046d51';
const TICKET_PROMPT_SHA256 = '77db2b49f683a3b04c8015300a8f9ee3e99f03ac70700582bba0697ad0968dcf';
const TICKET_RENDERER_INSTALLER = '__daoyuanInstallOriginalTicketRendererV08';
const CONFIG_HELPER_INSTALLER = '__daoyuanInstallConfigHelperV133';
const CONFIG_HELPER_VISIBILITY_SETTER = '__daoyuanSetConfigHelperLauncherVisibleV133';
const CONFIG_HELPER_ENABLED_KEY = 'daoyuan_config_helper_launcher_visible_v1';
const CONFIG_HELPER_REMOTE_URL = 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@main/%E9%81%93%E6%B8%8A%E9%85%8D%E7%BD%AE%E5%B0%8F%E5%8A%A9%E6%89%8B.min.js';
const CONFIG_HELPER_FALLBACK_URL = 'https://testingcf.jsdelivr.net/gh/NLKASHEI/114514@master/%E9%81%93%E6%B8%8A%E9%85%8D%E7%BD%AE%E5%B0%8F%E5%8A%A9%E6%89%8B.min.js';
const formal = process.argv.includes('--formal');
const v11Test = process.argv.includes('--v11-test');
const v12DisplayTest = process.argv.includes('--v12-display-test');
const v12Test = process.argv.includes('--v12-test') || v12DisplayTest;
const v11 = formal || v11Test;
const packageVersion = v12Test ? '1.2.0' : v11 ? '1.1.0' : '1.0.0';
const outputPath = new URL(v12DisplayTest ? './dist/道渊功能前端-V1.2显示模式测试候选.json' : v12Test ? './dist/道渊功能前端-V1.2测试候选.json' : v11 ? `./dist/道渊功能前端-V1.1${formal ? '正式' : '测试'}候选.json` : './dist/道渊功能前端-V1.0测试候选.json', projectRoot);
const packageName = v12DisplayTest ? '道渊小手机V1.2-显示模式测试' : v12Test ? '道渊小手机V1.2测试' : v11 ? `道渊小手机V1.1${formal ? '' : '测试'}` : '道渊小手机V1.0测试';
const importOutputPath = new URL(v12DisplayTest ? '../releases/candidates/道渊小手机V1.2-显示模式测试.json' : v12Test ? '../releases/candidates/道渊小手机V1.2测试.json' : formal ? '../releases/道渊小手机V1.1.json' : v11Test ? './dist/道渊小手机V1.1测试.json' : './dist/道渊小手机V1.0测试.json', projectRoot);
const importScriptId = v12DisplayTest ? 'daoyuan-feature-frontend-hud-v12-display-test' : v12Test ? 'daoyuan-feature-frontend-hud-v12-embedded' : 'daoyuan-feature-frontend-hud-v09';
const source = await readFile(artifactPath, 'utf8');
const readVerifiedSnapshot = async (path, expectedHash, label) => {
  const bytes = await readFile(path);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== expectedHash) throw new Error(`${label}快照哈希不匹配：${actualHash}`);
  return bytes.toString('utf8');
};
const bodyPromptSource = await readVerifiedSnapshot(bodyPromptPath, BODY_PROMPT_SHA256, 'V0.8 正文边界与对白格式 CoT');
const ticketPromptSource = await readVerifiedSnapshot(ticketPromptPath, TICKET_PROMPT_SHA256, 'V0.8 剧情票据 CoT');
const bodyPromptLiteral = JSON.stringify(bodyPromptSource);
const ticketPromptLiteral = JSON.stringify(ticketPromptSource);
const ticketRendererBytes = await readFile(ticketRendererPath);
const ticketRendererHash = createHash('sha256').update(ticketRendererBytes).digest('hex');
if (ticketRendererHash !== TICKET_RENDERER_SHA256) {
  throw new Error(`V0.8 原版票据渲染脚本快照哈希不匹配：${ticketRendererHash}`);
}
const ticketRendererSource = ticketRendererBytes.toString('utf8');
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
  const contentSignatureByMessage = new WeakMap();
  const dirtyMessages = new Set();
  let eligibleMessagesBefore = new Set();
  let messageWindowDirty = true;
  let presentationSignatureBefore = '';
  let forcePresentationSync = true;

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

  function fastTextSignature(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return text.length + ':' + (hash >>> 0).toString(36);
  }

  function rawMessageForMessage(message) {
    const mesid = Number(message?.getAttribute('mesid'));
    const getter = chatMessageGetter();
    if (!getter || !Number.isInteger(mesid)) return '';
    try {
      const result = getter(mesid, { include_swipes: false });
      const record = Array.isArray(result) ? result[0] : result;
      return String(record?.message || record?.mes || record?.text || '');
    } catch (_) { return ''; }
  }

  function messageContentSignature(message) {
    const raw = rawMessageForMessage(message);
    const preserved = message.querySelector(PAPER_SELECTOR)?.dataset.daoyuanSourceSignature || '';
    if (!raw && preserved) return preserved;
    const fallback = message.querySelector('.mes_text content')?.innerHTML
      || preserved
      || message.querySelector('.mes_text')?.textContent
      || '';
    return [message.getAttribute('mesid') || '', message.getAttribute('swipe_id') || '', fastTextSignature(raw || fallback)].join('|');
  }

  function presentationSignature(doc, moonlit) {
    const storage = storageFor(doc);
    const keys = ['daoyuan-reader-font', 'daoyuan-reader-size', 'daoyuan-reader-terms-enabled', 'daoyuan_statusbar_settings', 'daoyuan_custom_portraits', 'daoyuan_portrait_theme', 'daoyuan_special_portraits', 'daoyuan_female_portraits', 'daoyuan_portrait_theme_index', 'daoyuan_portrait_set_index'];
    let stored = '';
    try { stored = keys.map(key => storage?.getItem(key) || '').join('\\u001f'); } catch (_) {}
    return fastTextSignature(String(moonlit) + '|' + String(Boolean(portraitCharacters)) + '|' + stored);
  }

  function reconcileEligibleWindow(doc) {
    if (!messageWindowDirty && [...eligibleMessagesBefore].every(message => message.isConnected)) return eligibleMessagesBefore;
    const visibleAiMessages = [...doc.querySelectorAll('.mes[is_user="false"]')].filter(isVisibleAiMessage);
    const eligibleMessages = new Set(visibleAiMessages.slice(-READER_MESSAGE_LIMIT));
    eligibleMessagesBefore.forEach(message => {
      if (!eligibleMessages.has(message) && message.isConnected) {
        message.querySelectorAll(PAPER_SELECTOR).forEach(restoreReader);
        contentSignatureByMessage.delete(message);
      }
    });
    eligibleMessages.forEach(message => {
      if (!eligibleMessagesBefore.has(message)) dirtyMessages.add(message);
    });
    eligibleMessagesBefore = eligibleMessages;
    messageWindowDirty = false;
    return eligibleMessages;
  }

  function renderMessageStructure(message, moonlit) {
    const signature = messageContentSignature(message);
    const hasReader = Boolean(message.querySelector(PAPER_SELECTOR));
    const hasPendingVisibleDialogue = [...message.querySelectorAll(PAPER_SELECTOR + ' .dy-reader-v2__body > p')].some(paragraph => {
      const text = paragraph.textContent || '';
      return /[{｛]\\s*[^{}｛｝\\n]{1,40}?\\s*[}｝]\\s*(?:“[\\s\\S]*?”|「[\\s\\S]*?」|『[\\s\\S]*?』)/.test(text);
    });
    if (hasReader && contentSignatureByMessage.get(message) === signature && !hasPendingVisibleDialogue) return [];
    message.querySelectorAll('.mes_text content').forEach(buildReader);
    const articles = [...message.querySelectorAll(PAPER_SELECTOR)];
    articles.forEach(article => {
      article.dataset.daoyuanSourceSignature = signature;
      repairEmptyReader(article);
      trimBoundaryBreaks(article);
      syncChronicle(article);
      promoteVisibleSpeakerDialogues(article);
      promoteCommentDialogues(article);
      renderTaggedDialogues(article);
      mergeSettingsControl(article);
      syncThemeCompatibility(article, moonlit);
      upgradeSettingsPanel(article);
      protectReaderChrome(article);
    });
    contentSignatureByMessage.set(message, signature);
    return articles;
  }

  function syncMessagePresentation(message, moonlit) {
    message.querySelectorAll(PAPER_SELECTOR).forEach(article => {
      syncThemeCompatibility(article, moonlit);
      refreshDialoguePortraits(article);
      upgradeSettingsPanel(article);
      protectReaderChrome(article);
    });
  }

  function renderAll() {
    const doc = hostDocument();
    ensureStyle(doc);
    ensurePortraitCatalog(doc);
    const moonlit = hasMoonlitEchoes(doc);
    const eligibleMessages = reconcileEligibleWindow(doc);
    const structurallyRendered = new Set();
    [...dirtyMessages].forEach(message => {
      dirtyMessages.delete(message);
      if (!message.isConnected || !eligibleMessages.has(message)) return;
      if (renderMessageStructure(message, moonlit).length) structurallyRendered.add(message);
    });
    const nextPresentationSignature = presentationSignature(doc, moonlit);
    const presentationChanged = forcePresentationSync || nextPresentationSignature !== presentationSignatureBefore;
    if (presentationChanged) eligibleMessages.forEach(message => syncMessagePresentation(message, moonlit));
    else structurallyRendered.forEach(message => syncMessagePresentation(message, moonlit));
    forcePresentationSync = false;
    presentationSignatureBefore = nextPresentationSignature;
    const termsEnabled = termPreference(doc);
    setTermScanEnabled(doc, termsEnabled);
    updateTermControls(doc, termsEnabled ? (termWidgetInstance ? 'ready' : 'loading') : 'idle', termsEnabled ? (termWidgetInstance ? '已启用 · 点击正文术语查看 iWiki' : '正在载入术语库…') : '默认关闭');
  }`;
const originalSchedulerAndObserver = `  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; renderAll(); });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(doc.body || doc.documentElement, { childList: true, subtree: true });`;
const deferredSchedulerAndObserver = `  let scheduled = false;
  let generationActive = false;
  let waitingForVariableUpdate = false;
  let pendingRender = false;
  let coordinationQueued = false;
  let coordinationEpoch = 0;
  let rendererDisposed = false;
  let renderChain = Promise.resolve();
  const lifecycleDisposers = [];

  const cancelDeferredRender = () => {
    coordinationEpoch += 1;
    coordinationQueued = false;
  };
  const renderOnce = () => {
    if (rendererDisposed || generationActive || waitingForVariableUpdate || scheduled) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (!rendererDisposed && !generationActive && !waitingForVariableUpdate) renderAll();
    });
  };
  const ticketRendererApi = () => runtimeScopes.map(scope => scope?.__DAOYUAN_TICKET_RENDERER__).find(api => typeof api?.scan === 'function');
  const renderAfterTickets = reason => {
    pendingRender = true;
    if (rendererDisposed || generationActive || waitingForVariableUpdate) return;
    const epoch = coordinationEpoch;
    renderChain = renderChain.catch(() => undefined).then(async () => {
      const ticketApi = ticketRendererApi();
      if (ticketApi) {
        try { await ticketApi.scan(reason); }
        catch (error) { console.warn('[道渊正文美化] 票据前置扫描失败', error); }
      }
      if (rendererDisposed || epoch !== coordinationEpoch || generationActive || waitingForVariableUpdate) return;
      renderOnce();
    });
  };
  const schedule = () => {
    forcePresentationSync = true;
    pendingRender = true;
    if (rendererDisposed || generationActive || waitingForVariableUpdate || coordinationQueued) return;
    coordinationQueued = true;
    queueMicrotask(() => {
      coordinationQueued = false;
      renderAfterTickets('正文结构变化');
    });
  };
  const runtimeScopes = (() => {
    const scopes = [window];
    try { if (window.parent && window.parent !== window) scopes.push(window.parent); } catch (_) {}
    return scopes;
  })();
  const hostRuntime = runtimeScopes.find(scope => scope?.SillyTavern?.getContext?.()?.eventSource) || runtimeScopes[0];
  const eventSource = hostRuntime?.SillyTavern?.getContext?.()?.eventSource;
  const tavernEvents = hostRuntime?.TavernHelper?.tavern_events;
  const mvuRuntime = runtimeScopes.find(scope => scope?.Mvu?.events)?.Mvu;
  const subscribeLifecycle = (eventName, listener) => {
    if (typeof eventName !== 'string' || !eventName) return false;
    if (eventSource && typeof eventSource.on === 'function') {
      eventSource.on(eventName, listener);
      lifecycleDisposers.push(() => eventSource.removeListener?.(eventName, listener));
      return true;
    }
    const eventOn = runtimeScopes.find(scope => typeof scope?.eventOn === 'function')?.eventOn;
    if (typeof eventOn !== 'function') return false;
    const disposer = eventOn(eventName, listener);
    if (typeof disposer === 'function') lifecycleDisposers.push(disposer);
    return true;
  };
  subscribeLifecycle(tavernEvents?.GENERATION_STARTED, (_type, _params, isDryRun) => {
    if (isDryRun) return;
    generationActive = true;
    waitingForVariableUpdate = false;
    pendingRender = true;
    cancelDeferredRender();
  });
  subscribeLifecycle(tavernEvents?.GENERATION_STOPPED, () => {
    generationActive = false;
    waitingForVariableUpdate = false;
    renderAfterTickets('生成停止');
  });
  subscribeLifecycle(tavernEvents?.GENERATION_ENDED, () => {
    generationActive = false;
    waitingForVariableUpdate = false;
    renderAfterTickets('正文生成完成');
  });
  subscribeLifecycle(mvuRuntime?.events?.VARIABLE_UPDATE_STARTED, () => {
    waitingForVariableUpdate = true;
    pendingRender = true;
    cancelDeferredRender();
  });
  subscribeLifecycle(mvuRuntime?.events?.VARIABLE_UPDATE_ENDED, () => {
    waitingForVariableUpdate = false;
    renderAfterTickets('变量更新完成');
  });
  const invalidateMessageWindow = () => {
    messageWindowDirty = true;
    eligibleMessagesBefore.forEach(message => dirtyMessages.add(message));
    schedule();
  };
  [tavernEvents?.MESSAGE_DELETED, tavernEvents?.MESSAGE_SWIPED, tavernEvents?.MESSAGE_EDITED, tavernEvents?.MESSAGE_UPDATED, tavernEvents?.CHAT_CHANGED]
    .forEach(eventName => subscribeLifecycle(eventName, invalidateMessageWindow));

  const observer = new MutationObserver(records => {
    let relevant = false;
    records.forEach(record => {
      const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
      const targetMessage = target?.closest?.('.mes');
      if (targetMessage) { dirtyMessages.add(targetMessage); relevant = true; }
      [...record.addedNodes].forEach(node => {
        if (node.nodeType !== 1) return;
        const messages = node.matches?.('.mes') ? [node] : [...(node.querySelectorAll?.('.mes') || [])];
        if (messages.length) messageWindowDirty = true;
        messages.forEach(message => dirtyMessages.add(message));
        const ownerMessage = node.closest?.('.mes');
        if (ownerMessage) dirtyMessages.add(ownerMessage);
        if (messages.length || ownerMessage) relevant = true;
      });
      [...record.removedNodes].forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('.mes') || node.querySelector?.('.mes')) {
          messageWindowDirty = true;
          relevant = true;
        }
      });
    });
    if (relevant) schedule();
  });
  observer.observe(doc.querySelector('#chat') || doc.body || doc.documentElement, { childList: true, subtree: true });`;
const originalDestroyStart = `  window[INSTANCE_KEY] = { destroy() {
    observer.disconnect();`;
const deferredDestroyStart = `  window[INSTANCE_KEY] = { destroy() {
    observer.disconnect();
    rendererDisposed = true;
    cancelDeferredRender();
    lifecycleDisposers.splice(0).forEach(dispose => { try { dispose(); } catch (_) {} });`;

let contentBeautifierSource = contentBeautifier.content
  .replace(originalPortraitUrlGuard, customPortraitUrlGuard)
  .replace(originalVisibleSpeakerDialoguePromoter, enhancedVisibleSpeakerDialoguePromoter)
  .replace("'HEADER','HR','MENU','NAV','OL','P','PRE','SECTION','TABLE','UL'", "'HEADER','HR','MENU','NAV','OL','P','PRE','SECTION','TABLE','UL','DETAILS'");
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalReaderEntry, limitedReaderEntry, '阅读器限额');
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalReaderCommit, limitedReaderCommit, '阅读器回退');
const renderAllStartIndex = contentBeautifierSource.indexOf(renderAllStart);
const renderAllEndIndex = contentBeautifierSource.indexOf(renderAllEnd, renderAllStartIndex);
if (renderAllStartIndex < 0 || renderAllEndIndex < 0) throw new Error('V26 阅读器渲染范围接入点不符合预期');
contentBeautifierSource = `${contentBeautifierSource.slice(0, renderAllStartIndex)}${limitedRenderAll}${contentBeautifierSource.slice(renderAllEndIndex)}`;
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalSchedulerAndObserver, deferredSchedulerAndObserver, '阅读器流式渲染门控');
contentBeautifierSource = replaceChecked(contentBeautifierSource, originalDestroyStart, deferredDestroyStart, '阅读器生命周期清理');
const contentPresentationBootstrap = `
;globalThis.${CONTENT_BEAUTIFIER_INSTALLER}=()=>{
${contentBeautifierSource}
};
;globalThis.${TICKET_RENDERER_INSTALLER}=()=>{
${ticketRendererSource}
};
(()=>{
  const host=()=>{try{return window.parent??window;}catch{return window;}};
  const runtimeScopes=()=>{const result=[window];try{if(window.parent&&window.parent!==window)result.push(window.parent);}catch{}return result;};
  const apiScope=()=>runtimeScopes().find(scope=>typeof scope?.eventOn==='function'||typeof scope?.injectPrompts==='function'||Boolean(scope?.SillyTavern?.getContext?.()?.eventSource))||window;
  const tavernEvents=()=>runtimeScopes().map(scope=>scope?.TavernHelper?.tavern_events||scope?.tavern_events).find(Boolean)||{};
  const storage=()=>{try{return host().localStorage??localStorage;}catch{return null;}};
  const read=()=>{let bodyRendererEnabled=false,assist={bodyPromptEnabled:false,ticketPromptEnabled:false,ticketRendererEnabled:false};try{bodyRendererEnabled=storage()?.getItem('${CONTENT_BEAUTIFIER_ENABLED_KEY}')==='true';const parsed=JSON.parse(storage()?.getItem('${CONTENT_ASSIST_SETTINGS_KEY}')||'{}');assist={bodyPromptEnabled:parsed?.bodyPromptEnabled===true,ticketPromptEnabled:parsed?.ticketPromptEnabled===true,ticketRendererEnabled:parsed?.ticketRendererEnabled===true};}catch{}return{bodyRendererEnabled,...assist};};
  const bodyPrompt=${bodyPromptLiteral};
  const ticketPrompt=${ticketPromptLiteral};
  const installPrompt=()=>{
    if(globalThis.__daoyuanContentFormatPromptV12)return;
    const scope=apiScope();
    const events=typeof tavern_events!=='undefined'?tavern_events:tavernEvents();
    const injectApi=typeof injectPrompts==='function'?injectPrompts:runtimeScopes().find(item=>typeof item?.injectPrompts==='function')?.injectPrompts;
    const removeApi=typeof uninjectPrompts==='function'?uninjectPrompts:runtimeScopes().find(item=>typeof item?.uninjectPrompts==='function')?.uninjectPrompts;
    const subscribe=typeof eventOn==='function'?eventOn:scope?.eventOn;
    const subscribeFirst=typeof eventMakeFirst==='function'?eventMakeFirst:runtimeScopes().find(item=>typeof item?.eventMakeFirst==='function')?.eventMakeFirst||subscribe;
    if(typeof injectApi!=='function'||typeof subscribe!=='function'||!events.GENERATION_AFTER_COMMANDS)
      throw new Error('正文/票据提示词未启动：Tavern Helper 注入接口或生成事件不可用');
    const disposers=[];
    const ids=['daoyuan-content-format-v12','daoyuan-body-format-v12','daoyuan-ticket-format-v12'];
    let cleanup=null;
    const clear=()=>{const previous=cleanup;cleanup=null;try{previous?.();}finally{removeApi?.(ids);}};
    const inject=(_type,_options,dryRun)=>{
      if(dryRun)return;
      clear();
      const state=read();
      const prompts=[];
      const make=(id,content)=>({id,position:'in_chat',depth:1,role:'system',content,should_scan:true});
      if(state.bodyPromptEnabled)prompts.push(make(ids[1],bodyPrompt));
      if(state.ticketPromptEnabled)prompts.push(make(ids[2],ticketPrompt));
      if(prompts.length)cleanup=injectApi(prompts,{once:true})?.uninject??null;
    };
    const on=(name,fn,subscriber=subscribe)=>{
      if(!name)return;
      const off=subscriber(name,fn);
      if(typeof off==='function')disposers.push(off);
      else if(typeof off?.stop==='function')disposers.push(()=>off.stop());
      else throw new Error('正文/票据提示词监听器未返回可清理句柄');
    };
    const destroy=()=>{try{clear();}finally{disposers.splice(0).forEach(off=>off());window.removeEventListener('pagehide',destroy);delete globalThis.__daoyuanContentFormatPromptV12;}};
    try{
      on(events.GENERATION_AFTER_COMMANDS,inject,subscribeFirst);
      [events.GENERATION_ENDED,events.GENERATION_STOPPED,events.CHAT_CHANGED].forEach(name=>on(name,clear));
      window.addEventListener('pagehide',destroy,{once:true});
      globalThis.__daoyuanContentFormatPromptV12={destroy,clear,revision:'content-injection-v3'};
    }catch(error){destroy();throw error;}
  };
  globalThis.__daoyuanConfigureContentPresentationV12=()=>{const state=read();installPrompt();globalThis.__daoyuanContentFormatPromptV12.clear();try{host().__DAOYUAN_TICKET_RENDERER_CLEANUP__?.();}catch{}globalThis.__daoyuanCultivationReaderV2?.destroy?.();if(state.ticketRendererEnabled)globalThis.${TICKET_RENDERER_INSTALLER}();if(state.bodyRendererEnabled)globalThis.${CONTENT_BEAUTIFIER_INSTALLER}();};
  globalThis.__daoyuanConfigureContentPresentationV12();
})();
`;
if (!contentPresentationBootstrap.includes('ShopReceipt、QuestBoard与CombatRound是正文流程中的专用交互票据')
  || !contentPresentationBootstrap.includes('在<content>内展示货单的正文之后立即插入本模板')
  || !contentPresentationBootstrap.includes('必须在<content>内正文实际展示任务之后就地插入')
  || contentPresentationBootstrap.includes('票据必须放在完整的 </content> 之后')) {
  throw new Error('票据提示词必须保持正文内原位渲染协议');
}
for (const marker of ['dx-shop-receipt', 'dx-quest-board', 'data-dx-buy-confirm', '最近三层 AI 楼层', 'VARIABLE_UPDATE_ENDED']) {
  if (!contentPresentationBootstrap.includes(marker)) throw new Error(`V0.8 原版票据渲染脚本缺少标记：${marker}`);
}
if (contentPresentationBootstrap.includes('dy-ticket--shop') || contentPresentationBootstrap.includes('__daoyuanShopQuestTicketsV12')) {
  throw new Error('检测到简化票据渲染器残留');
}
const configHelperBootstrap = `\n;const __daoyuanConfigHelperRemoteUrl='${CONFIG_HELPER_REMOTE_URL}';const __daoyuanConfigHelperFallbackUrl='${CONFIG_HELPER_FALLBACK_URL}';\nlet __daoyuanConfigHelperLoadPromise=null;\nconst __daoyuanFindConfigHelperBubble=()=>{const host=window.parent??window;return host.document.getElementById('bp-switch-bubble')??host.document.getElementById('jmzq-bubble');};\nglobalThis.${CONFIG_HELPER_VISIBILITY_SETTER}=(visible)=>{try{const host=window.parent??window;const bubble=__daoyuanFindConfigHelperBubble();const panel=host.document.getElementById('bp-switch-panel')??host.document.getElementById('jmzq-panel');if(bubble)bubble.style.display=visible?'':'none';if(!visible&&panel)panel.style.display='none';}catch{}};\nglobalThis.${CONFIG_HELPER_INSTALLER}=async()=>{\ntry{const host=window.parent??window;if(!__daoyuanFindConfigHelperBubble()){if(!__daoyuanConfigHelperLoadPromise)__daoyuanConfigHelperLoadPromise=import(__daoyuanConfigHelperRemoteUrl).catch(()=>import(__daoyuanConfigHelperFallbackUrl)).catch(error=>{__daoyuanConfigHelperLoadPromise=null;throw error;});await __daoyuanConfigHelperLoadPromise;}let visible=true;try{const storage=host.localStorage??localStorage;visible=storage.getItem('${CONFIG_HELPER_ENABLED_KEY}')!=='false';}catch{}globalThis.${CONFIG_HELPER_VISIBILITY_SETTER}(visible);}catch(error){console.warn('[道渊配置小助手] 远程脚本加载失败',error);}\n};\nconst __daoyuanEnsureConfigHelperV133=()=>{try{if(!__daoyuanFindConfigHelperBubble())void globalThis.${CONFIG_HELPER_INSTALLER}();else globalThis.${CONFIG_HELPER_VISIBILITY_SETTER}(true);}catch{}};\nvoid globalThis.${CONFIG_HELPER_INSTALLER}();\nsetTimeout(__daoyuanEnsureConfigHelperV133,1200);\nsetTimeout(__daoyuanEnsureConfigHelperV133,3500);\n`;
const baseBundledSource = v11 || v12Test ? `${source}${contentPresentationBootstrap}` : source;
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
  scriptId: importScriptId,
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
  id: importScriptId,
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
