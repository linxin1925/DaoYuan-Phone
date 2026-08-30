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
for (const seedImport of ['wanNianChouYuan.json', 'heHuanZong.json', 'luoYang.json', 'shuShan.json', 'wanFaZong.json']) {
  assert.ok(!indexSource.includes(seedImport), `运行包不应再内置 DLC 种子：${seedImport}`);
}
for (const obsoleteModule of ['expansionManager', 'detectScriptDlcId']) {
  assert.ok(!indexSource.includes(obsoleteModule), `运行包不应再引用旧内置 DLC 管理逻辑：${obsoleteModule}`);
}

const packageSource = await (await import('node:fs/promises')).readFile(new URL('./package-candidate.mjs', import.meta.url), 'utf8');
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

const stylesSource = await (await import('node:fs/promises')).readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
assert.match(stylesSource, /\.content-package-panel\s*\{[^}]*margin-top:\s*18px;/, 'DLC 操作按钮与导入面板之间必须保留稳定间距');
const shellSource = await (await import('node:fs/promises')).readFile(new URL('../src/shell.css', import.meta.url), 'utf8');
assert.match(shellSource, /width:\s*clamp\(130px,\s*14\.95vw,\s*192\.4px\)/, '桌宠大号宽度应比原值放大 30%');
assert.match(shellSource, /@media \(max-width: 600px\), \(pointer: coarse\)[\s\S]*?#daoyuan-feature-orb \{ width: 80\.6px; height: 98\.8px; \}/, '移动端桌宠与点击外框应同步放大 30%');
assert.match(shellSource, /data-pet-kind="ziwei"[^}]*\.dsh-pet-image \{ display: block; transform: scale\(\.445\); transform-origin: center bottom; \}/, '紫薇可见主体应按鲸鱼娘标准校准，且保持底部锚点');
console.log('User script runtime and scroll fixtures: OK');
