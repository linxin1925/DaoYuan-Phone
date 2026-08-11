# 开发说明

当前实现使用浏览器原生 ES Modules，不引入 Live2D 或其他运行时依赖。

```bash
npm run dev
```

然后打开 <http://localhost:4173>。语法检查：

```bash
npm run check
```

## PNG 资源约定

资源根目录是 `assets/pet/ziwei/`，入口清单是 `manifest.json`。状态机只发送 `Idle`、`TapReaction`、`PhoneEnter`、`PhoneLoop`、`PhoneExit` 五种状态；`PngSequenceAdapter` 负责读取清单、循环序列帧和缺图占位。

正式素材到位后，只需按目录和命名规范放入 PNG，通常不需要修改业务代码。若帧数或播放速度不同，调整 `manifest.json` 即可；当前普通动作帧间隔为 260ms，PhoneLoop 暂时使用稳定单帧，避免不匹配的动作跳变。

## 宿主接口

页面仍提供 `window.pet`：

```js
window.pet.openJadeUI();
window.pet.closeJadeUI();
window.pet.getState();
window.pet.on('jade-open', () => {
  // 后续玉简前端可以在这里挂载或显示自己的 UI
});
window.pet.on('jade-close', () => {
  // 后续玉简前端可以在这里卸载或隐藏自己的 UI
});
```

可监听事件：`jade-open`、`jade-close`、`statechange`。事件由桌宠通过 `window` 派发，玉简前端不需要直接依赖 `PetStateMachine`。

点击桌宠会触发 `Idle → TapReaction → PhoneEnter → PhoneLoop`，打开玉简 UI；点击关闭、按 `Escape` 或调用 `closeJadeUI()` 会进入 `PhoneExit → Idle`。
