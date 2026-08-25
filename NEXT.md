# 道渊功能前端：当前进度与交接

> 这是跨对话唯一进度文档。新对话先读本文件、`README.md`、`CHANGELOG.md`，再读任务涉及的源码。

## 当前版本

- 正式版本：V1.1 / `1.1.0`
- 权威源码：`app/`
- 正式酒馆助手脚本：`releases/道渊小手机V1.1.json`
- 稳定脚本 ID：`daoyuan-feature-frontend-hud-v09`
- V1.0 正式包必须继续保留。

## V1.1 已完成

- 用 DSH 透明 WebM 替换旧紫薇 PNG 序列，资产位于 `app/src/assets/pet-v11/`。
- `petAssets.ts` 映射五个动作；`petController.ts` 使用双 video、播放代际和 `ended/error` 回退管理状态。
- `openJadeUI()` / `closeJadeUI()` 挂到宿主窗口，并在销毁时清理。
- `PhoneExit` 可被新点击打断，解决关闭后立刻点不开。
- 角色向右贴边；命中区不能使用整张 16:9 透明 WebM。
- 最终命中策略：外层 `#daoyuan-feature-orb` 与 `.dsh-pet-stage` 为 `pointer-events: none`，仅 `.dsh-pet-stage::after` 为 `pointer-events: auto`；命中层 `left:30%; top:5%; width:40%; height:95%`。
- V1.1 打包链内置 V26 正文美化正式快照；小手机设置页提供默认开启的总开关；打包时核对稳定 ID `daoyuan-content-beautify-script-v26` 与冻结 SHA-256，原样保留广域 `<content>` 扫描和独立术语开关。

## 真实酒馆证据

2026-08-24 使用 Chrome 连接 `http://127.0.0.1:8000/` 的真实 SillyTavern。旧修正版在最小尺寸下实测：外层按钮 `101×121px`、舞台约 `135×161px`、窄命中层约 `54×153px`。发现即使伪命中层已缩窄，外层按钮仍会响应左侧空白，因此追加外层 `pointer-events: none` 修复。

Chrome 扩展当时没有本地文件访问权限，无法自动导入最终 JSON，所以“最终包的人物本体可点、两侧透明区不可点”仍是人工验收项，不能写成已通过。

## 验证命令

```bash
cd app
pnpm typecheck
pnpm build
pnpm package:formal
```

完整回归使用 `pnpm check`，但它默认生成候选包；正式发布后再执行 `pnpm package:formal`。

## 下一步

1. 在目标 SillyTavern 导入 `releases/道渊小手机V1.1.json` 覆盖旧同 ID 脚本。
2. 切换小/中/大，分别点人物头、身体和左右透明区；只允许人物活动区触发。
3. 验证打开、关闭、关闭后立刻重开。
4. 若命中仍偏移，只调整 `shell.css` 的 `::after` 百分比，不要重新放开整个舞台或外层按钮。
5. 验证 V26：小手机总开关开/关/刷新持久化、`{角色标准姓名}“台词”` 与旧对白协议、标准/非标准 `<content>`、字体字号、术语默认关闭、开启后刷新持久化、关闭及跨楼层同步。
6. 后续版本再增加随机动作、转向、拖拽动作和屏幕漫游；不要混入 V1.1 修补。
