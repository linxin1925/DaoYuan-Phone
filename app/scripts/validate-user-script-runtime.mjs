import assert from 'node:assert/strict';
import { normalizeUserScripts } from '../src/services/userScriptRuntime.ts';

const normalized = normalizeUserScripts([{ id: 'a', name: '任意拓展助手', content: 'void 0', enabled: true, importedAt: 'now' }, { id: '', name: '坏包', content: '' }]);
assert.equal(normalized.length, 1);
assert.equal(normalized[0].dlcId, null, '独立脚本不得再按旧 DLC 名称猜测归属');
assert.equal(normalized[0].enabled, true);

const uiSource = await (await import('node:fs/promises')).readFile(new URL('../src/ui/renderUi.ts', import.meta.url), 'utf8');
assert.match(uiSource, /requestAnimationFrame\(\(\) => \{ restoreScroll\(\); uiView\.requestAnimationFrame\(restoreScroll\); \}\)/, '重绘后应跨两帧恢复滚动位置');
assert.doesNotMatch(uiSource, /content-package-import[\s\S]{0,500}render\(false\)/, '内容包按钮不得用回顶重绘');
for (const section of ['pet', 'content-beautifier', 'config-helper']) {
  assert.ok(uiSource.includes(`settingsSection === '${section}'`), `缺少独立设置页：${section}`);
  assert.ok(uiSource.includes(`key: '${section}'`), `缺少独立设置入口：${section}`);
}
assert.doesNotMatch(uiSource, /reroll|REROLL|重 Roll/i, '仙网重 Roll 兼容不应有界面残留');
assert.match(uiSource, /content\.append\(grid\);\s*content\.append\(element\(doc, 'p', 'notice muted'/, '设置首页只应放置功能入口与底部提示');
for (const removedLabel of ['创建不存在的 DLC 世界书', '挂载已有 DLC 到当前角色', '补回缺失的世界书条目', '将已安装 DLC 更新到内置版本', '保存并应用 DLC 开关']) {
  assert.ok(!uiSource.includes(removedLabel), `手动导入模式不应显示旧 DLC 操作：${removedLabel}`);
}
for (const requiredLabel of ['DLC 名称（必填）', '更新世界书/脚本', '修复挂载', '移除脚本', '移除 DLC']) {
  assert.ok(uiSource.includes(requiredLabel), `规范化 DLC 管理缺少界面能力：${requiredLabel}`);
}
assert.match(uiSource, /addFile\('世界书 JSON', 'worldbook', true, Boolean\(userDlcWorldbookDraft\)\)/, '世界书文件必须标记为必选并显示选择状态');
assert.match(uiSource, /addFile\('脚本 JSON', 'script', false, Boolean\(userDlcScriptDraft\)\)/, '脚本文件必须标记为可选并显示选择状态');
assert.ok(uiSource.includes("selected ? '已选择 1 个文件' : '未选择任何文件'"), '文件选择控件重绘后必须保留已选择数量提示');
const userDlcFileHandler = uiSource.match(/if \(target\?\.matches\('\[data-user-dlc-file\]'\)\) \{[\s\S]*?reader\.readAsText\(file\); return;\s*\}/)?.[0] ?? '';
assert.ok(userDlcFileHandler, '应存在 DLC 文件选择处理块');
assert.ok(!userDlcFileHandler.includes('render('), 'DLC 文件选择后的任何结果都禁止整页重绘');
const userDlcClickHandlers = uiSource.match(/else if \(action === 'user-dlc-import'[\s\S]*?else if \(action === 'wanbao-settings-save'\)/)?.[0] ?? '';
assert.ok(userDlcClickHandlers, '应存在 DLC 管理按钮处理块');
assert.ok(!userDlcClickHandlers.includes('render('), 'DLC 页所有管理按钮点击都禁止立即整页重绘');
assert.ok(!uiSource.includes("doc.createElement('select'); targetSelect.dataset.userDlcTarget"), 'DLC 操作目标禁止使用会弹到顶部的原生 select');
assert.ok(!uiSource.includes("select.dataset.contentPackageMode = 'true'"), '同名世界书处理禁止使用会弹到顶部的原生 select');
assert.match(uiSource, /action === 'user-dlc-target'[\s\S]{0,1600}action === 'user-dlc-mode'/, '两个选择器应使用页面内按钮处理');
assert.match(uiSource, /function upgradeNativeSelects\(doc: Document, root: HTMLElement\): void/, '所有剩余原生 select 必须统一转换为页面内菜单');
assert.match(uiSource, /root\.querySelectorAll<HTMLSelectElement>\('select'\)/, '页面内菜单升级必须覆盖小手机中的全部 select');
assert.match(uiSource, /root\.append\(topbar, workspace, mobile\);\s*upgradeNativeSelects\(doc, root\);/, '每次渲染后都必须升级全部原生 select');
assert.match(uiSource, /interactive\.focus\(\{ preventScroll: true \}\)/, '文本输入框获得焦点时必须禁止酒馆改变小手机滚动位置');
assert.match(uiSource, /root\.addEventListener\('pointerdown', onPointerDown, true\)/, '表单滚动锁必须在捕获阶段先于宿主默认聚焦执行');
assert.match(uiSource, /button, input, textarea, label, a, \[role="option"\], \[data-action\]/, '小手机内容区全部可点击元素都必须进入滚动锁');
assert.match(uiSource, /root\.addEventListener\('click', onPointerClick\)/, '点击逻辑执行后必须再次恢复用户点击前的滚动位置');
assert.match(uiSource, /root\.addEventListener\('scroll', onContentScroll, true\)/, '点击后的延迟程序性滚动必须被持续拦截');
assert.match(uiSource, /root\.addEventListener\('wheel', onWheelIntent, \{ capture: true, passive: false \}\)/, '第一次滚轮操作必须立即解除滚动锁并应用本次滚动量');
assert.match(uiSource, /root\.addEventListener\('touchstart', onManualScrollIntent, true\)/, '用户触摸滑动必须解除滚动锁');
assert.match(uiSource, /root\.addEventListener\('focusout', onFocusOut, true\)/, '取消输入时必须立即解除滚动锁');
assert.match(uiSource, /content\.style\.overflowY = 'hidden'/, '点击控件时必须从源头冻结滚动容器，不能先移动再拉回');

const indexSource = await (await import('node:fs/promises')).readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
assert.match(indexSource, /DEFAULT_FEATURE_MODULE_FLAGS:[^=]+\= \{ yujian:false, beauty:false, xianwang:false, wanbao:false, world:false \}/, '小手机功能模块首次默认必须全部关闭');
assert.match(indexSource, /DEFAULT_WORLD_SIMULATION_FEATURES:[^=]+\= \{ xuantianEnabled:false, earthEnabled:false \}/, '双界推演入口首次默认必须全部关闭');
assert.match(indexSource, /getItem\(CONTENT_BEAUTIFIER_ENABLED_KEY\) === 'true'/, '正文美化必须仅在玩家明确开启后运行');
assert.match(indexSource, /getItem\(CONFIG_HELPER_ENABLED_KEY\) !== 'false'/, '道渊配置小助手必须保持首次默认开启');
for (const seedImport of ['wanNianChouYuan.json', 'heHuanZong.json', 'luoYang.json', 'shuShan.json', 'wanFaZong.json']) {
  assert.ok(!indexSource.includes(seedImport), `运行包不应再内置 DLC 种子：${seedImport}`);
}
for (const obsoleteModule of ['expansionManager', 'detectScriptDlcId']) {
  assert.ok(!indexSource.includes(obsoleteModule), `运行包不应再引用旧内置 DLC 管理逻辑：${obsoleteModule}`);
}

const packageSource = await (await import('node:fs/promises')).readFile(new URL('./package-candidate.mjs', import.meta.url), 'utf8');
assert.match(packageSource, /bodyPromptEnabled:false,ticketPromptEnabled:false,ticketRendererEnabled:false/, '正文与票据辅助开关必须默认关闭');
assert.match(packageSource, /storage\(\)\?\.getItem\('\$\{CONTENT_BEAUTIFIER_ENABLED_KEY\}'\)==='true'/, '候选包中的正文美化必须仅在玩家明确开启后运行');
assert.match(packageSource, /GENERATION_AFTER_COMMANDS/, '正文格式协议必须在生成命令完成后注入');
assert.match(packageSource, /const subscribeFirst=typeof eventMakeFirst==='function'/, '生成协议必须优先注册，避免被后续监听器覆盖');
assert.match(packageSource, /on\(events\.GENERATION_AFTER_COMMANDS,inject,subscribeFirst\)/, '生成注入必须使用优先监听器');
assert.match(packageSource, /should_scan:true/, '正文与票据协议必须允许酒馆扫描处理');
assert.match(packageSource, /position:'in_chat',depth:1,role:'system'/, '正文与票据协议必须保持 V0.8 原版的聊天内系统深度 1');
assert.match(packageSource, /const runtimeScopes=\(\)=>\{const result=\[window\]/, '提示词注入必须同时探测脚本 iframe 与父页面');
assert.match(packageSource, /find\(item=>typeof item\?\.injectPrompts==='function'\)/, '提示词注入必须选择实际提供 injectPrompts 的运行域');
assert.doesNotMatch(packageSource, /__DAOYUAN_WRITING_COT_LISTENER__/, '其他写作监听器不得阻断道渊独立的正文与票据协议注入');
assert.match(packageSource, /removeApi\?\.\(ids\)/, '格式协议清理必须使用固定 ID 数组');
assert.match(packageSource, /typeof off\?\.stop==='function'/, 'Tavern Helper EventOnReturn.stop 必须进入销毁链');
assert.match(packageSource, /BODY_PROMPT_SHA256 = 'acf0ecd30388af176ad97beebdb52557db7bd149d3caa12181cbaab1e4046d51'/, '正文协议必须锁定 V0.8 原版快照');
assert.match(packageSource, /TICKET_PROMPT_SHA256 = '77db2b49f683a3b04c8015300a8f9ee3e99f03ac70700582bba0697ad0968dcf'/, '剧情票据协议必须锁定 V0.8 原版快照');
assert.match(packageSource, /const bodyPrompt=\$\{bodyPromptLiteral\}/, '正文提示词必须由原版快照嵌入');
assert.match(packageSource, /const ticketPrompt=\$\{ticketPromptLiteral\}/, '商店与任务提示词必须由原版快照嵌入');
assert.match(packageSource, /data:image\\\\\/\(\?:png\|jpe\?g\|webp\|gif\);base64/, '正文美化必须允许状态栏本地导入后保存的 data:image 立绘');
assert.match(packageSource, /url\.protocol === 'https:' \|\| url\.protocol === 'http:'/, '正文美化必须允许状态栏保存的自定义 HTTP(S) 立绘 URL');
assert.match(packageSource, /\.replace\(originalPortraitUrlGuard, customPortraitUrlGuard\)/, '正文美化打包时必须接入自定义立绘协议白名单');
assert.match(packageSource, /const enhancedVisibleSpeakerDialoguePromoter = `function promoteVisibleSpeakerDialogues/, '正文美化必须扩展第二种显式角色对白解析');
assert.match(packageSource, /const pattern = \/\[\{｛\].*?\(\?:“\[\\\\s\\\\S\]\*\?”\).*?\/g;/s, '显式角色对白应支持在同段中扫描一个或多个标记');
assert.match(packageSource, /source\.slice\(cursor, match\.index\)/, '显式角色对白前的叙述必须保留');
assert.match(packageSource, /source\.slice\(cursor\)/, '显式角色对白后的叙述必须保留');
assert.match(packageSource, /createDocumentFragment\(\)/, '同段对白与叙述必须按原顺序拆分');
assert.match(packageSource, /const __daoyuanEnsureConfigHelperV133=/, '配置小助手应在旧脚本清理后复查入口');
assert.match(packageSource, /CONFIG_HELPER_REMOTE_URL = 'https:\/\/testingcf\.jsdelivr\.net\/gh\/NLKASHEI\/114514@main\//, '配置小助手必须使用更正后的远程入口，不再嵌入源码');
assert.match(packageSource, /getElementById\('bp-switch-bubble'\)/, '配置小助手复查应以远程真实悬浮球入口为准');
assert.match(packageSource, /__daoyuanConfigHelperLoadPromise=import\(__daoyuanConfigHelperRemoteUrl\)/, '配置小助手远程模块必须使用单例加载承诺');
assert.match(packageSource, /setTimeout\(__daoyuanEnsureConfigHelperV133,1200\)/, '配置小助手应进行首轮延迟复查');
assert.match(packageSource, /setTimeout\(__daoyuanEnsureConfigHelperV133,3500\)/, '配置小助手应覆盖慢速 CDN 加载');
for (const marker of ['GENERATION_STARTED', 'GENERATION_STOPPED', 'GENERATION_ENDED', 'VARIABLE_UPDATE_STARTED', 'VARIABLE_UPDATE_ENDED']) {
  assert.ok(packageSource.includes(marker), `正文美化缺少生成生命周期门控：${marker}`);
}
assert.match(packageSource, /generationActive \|\| waitingForVariableUpdate \|\| coordinationQueued/, '流式生成或变量更新期间 DOM 变化不得触发正文美化');
assert.match(packageSource, /VARIABLE_UPDATE_STARTED[\s\S]{0,180}waitingForVariableUpdate = true/, 'MVU 开始时正文美化必须进入等待态');
assert.match(packageSource, /VARIABLE_UPDATE_ENDED[\s\S]{0,180}renderAfterTickets\('变量更新完成'\)/, 'MVU 完成后必须先走票据前置扫描');
assert.match(packageSource, /await ticketApi\.scan\(reason\)[\s\S]{0,260}renderOnce\(\)/, '正文美化必须等待票据扫描完成后再渲染');
for (const staleTimerMarker of ['scheduleQuietFallback', 'variableFallbackTimer', 'quietTimer']) {
  assert.ok(!packageSource.includes(staleTimerMarker), `正文/票据协调不得残留定时器：${staleTimerMarker}`);
}
assert.match(packageSource, /lifecycleDisposers\.splice\(0\)/, '正文美化销毁时必须解除生成生命周期监听');
assert.match(packageSource, /const contentSignatureByMessage = new WeakMap\(\)/, '正文美化必须缓存楼层内容签名');
assert.match(packageSource, /const dirtyMessages = new Set\(\)/, '正文美化必须使用脏楼层队列');
assert.match(packageSource, /const hasPendingVisibleDialogue = \[\.\.\.message\.querySelectorAll\(PAPER_SELECTOR \+ ' \.dy-reader-v2__body > p'\)\]/, '票据插入后必须检查正文中遗留的显式角色对白');
assert.match(packageSource, /contentSignatureByMessage\.get\(message\) === signature && !hasPendingVisibleDialogue/, '正文未变化且没有遗留对白时才可跳过结构解析');
assert.match(packageSource, /function syncMessagePresentation\(message, moonlit\)/, '设置、主题与立绘同步必须从正文结构解析中拆分');
assert.match(packageSource, /eligibleMessagesBefore\.forEach\(message => \{[\s\S]{0,260}!eligibleMessages\.has\(message\)[\s\S]{0,180}restoreReader/, '退出最近五层窗口的楼层必须恢复原文');
assert.match(packageSource, /eligibleMessages\.forEach\(message => \{[\s\S]{0,180}!eligibleMessagesBefore\.has\(message\)[\s\S]{0,100}dirtyMessages\.add/, '删楼后重新进入最近五层窗口的旧楼层必须加入脏队列');
assert.match(packageSource, /removedNodes[\s\S]{0,260}messageWindowDirty = true/, '删除楼层必须使最近五层窗口失效并重新计算');
for (const marker of ['MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHAT_CHANGED']) {
  assert.ok(packageSource.includes(marker), `正文美化缺少楼层变化事件兜底：${marker}`);
}
assert.match(packageSource, /const invalidateMessageWindow = \(\) => \{[\s\S]{0,220}eligibleMessagesBefore\.forEach\(message => dirtyMessages\.add\(message\)\)/, '删楼、编辑和切换回复时必须重新核验当前美化窗口');

const stylesSource = await (await import('node:fs/promises')).readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
assert.match(stylesSource, /\.content-package-panel\s*\{[^}]*margin-top:\s*18px;/, 'DLC 操作按钮与导入面板之间必须保留稳定间距');
const shellSource = await (await import('node:fs/promises')).readFile(new URL('../src/shell.css', import.meta.url), 'utf8');
assert.match(shellSource, /width:\s*clamp\(130px,\s*14\.95vw,\s*192\.4px\)/, '桌宠大号宽度应比原值放大 30%');
assert.match(shellSource, /@media \(max-width: 600px\), \(pointer: coarse\)[\s\S]*?#daoyuan-feature-orb \{ width: 80\.6px; height: 98\.8px; \}/, '移动端桌宠与点击外框应同步放大 30%');
assert.doesNotMatch(shellSource, /data-pet-kind="ziwei"/, '桌宠外壳不得再包含紫薇分支');
console.log('User script runtime and scroll fixtures: OK');
