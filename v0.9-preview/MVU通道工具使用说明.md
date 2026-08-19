# MVU通道工具使用说明

## 用途

`MVU通道` 是本脚本中所有功能读取最新消息楼层 MVU 数据的统一工具。

后续功能不应自行访问 `window.Mvu`，也不应自行缓存楼层号。应通过 `MvuChannelTool` 读取或写回数据，避免在新消息、切换聊天或异步任务期间读写错误楼层。

## 代码位置

- 工具实现：`src/services/mvuChannel.ts`
- MVU 底层读写：`src/services/worldDataBridge.ts`
- 宿主接入与 iframe 协议：`src/index.ts`
- 通信 action 定义：`src/contract/bridge.ts`

## 初始化

`MvuChannelTool` 需要两个动态函数：

1. 获取当前可用的 MVU runtime。
2. 获取当前 `contextRevision` 和最新 `messageId`。

```ts
import { MvuChannelTool } from './services/mvuChannel';

const mvuChannel = new MvuChannelTool(
  () => runtime.Mvu ?? hostWindow.Mvu ?? {},
  () => ({
    contextRevision: session.contextRevision,
    messageId: session.messageId,
  }),
);
```

不要把 runtime、`messageId` 或 `contextRevision` 的当前值直接传入构造函数。必须传入可每次重新取值的函数。

## 读取最新楼层 `stat_data`

这是后续功能最常用的接口：

```ts
const statData = await mvuChannel.readLatestStatData();

if (!statData) {
  // MVU 未就绪、楼层无数据，或读取期间上下文已变化。
  return;
}

const world = statData.世界;
const hero = statData.主角;
const yujian = statData.玉简;
```

`readLatestStatData()` 每次都会重新读取当前最新楼层，不使用功能自己保存的旧快照。

### 页面刷新时的就绪顺序

完整刷新时，Tavern Helper 常驻脚本可能早于 MVU 全局完成初始化。MVU通道会先等待 `waitGlobalInitialized('Mvu')`，然后绑定：

- `Mvu.events.VARIABLE_INITIALIZED`：MVU 初始变量完成后刷新通道。
- `Mvu.events.VARIABLE_UPDATE_ENDED`：每轮变量解析和更新完成后刷新通道。

事件绑定完成后会立即补读一次，避免初始化事件在监听器绑定前已经发生。当安装版本没有提供 helper 或事件源时，才使用有限轮询兜底。

## 读取完整 MVU 变量表

仅当功能确实需要 `schema` 或 `initialized_lorebooks` 时使用：

```ts
const snapshot = await mvuChannel.readLatestVariables();

if (!snapshot.ready) {
  console.warn('[MVU通道] 读取失败', snapshot.reason);
  return;
}

console.log(snapshot.messageId);
console.log(snapshot.variables);
console.log(snapshot.statData);
```

快照主要字段：

| 字段 | 含义 |
| --- | --- |
| `name` | 固定为 `MVU通道` |
| `ready` | 是否已成功读取当前楼层 |
| `contextRevision` | 读取时的聊天上下文版本 |
| `messageId` | 本次快照所属消息楼层 |
| `variables` | 完整 MVU 变量表 |
| `statData` | `variables.stat_data` 的便捷引用 |
| `readAt` | 读取完成时间 |
| `reason` | 成功状态或失败原因 |

## 使用最近一次快照

```ts
const snapshot = mvuChannel.getSnapshot();
```

`getSnapshot()` 不会发起新的 MVU 读取。它只适合诊断、展示已有读取状态，不应用于需要“当前最新值”的业务决策。

## 写回 `stat_data`

当后续功能已经明确获得写入授权时，应先读取，再基于同一快照写回：

```ts
const snapshot = await mvuChannel.readLatestVariables();
if (!snapshot.ready || !snapshot.statData) return;

const nextStatData = structuredClone(snapshot.statData);
// 只修改本功能获得授权的字段。
nextStatData.世界 = {
  ...(nextStatData.世界 as Record<string, unknown>),
  某字段: '新值',
};

const result = await mvuChannel.replaceLatestStatData(nextStatData, {
  contextRevision: snapshot.contextRevision,
  messageId: snapshot.messageId,
});

if (!result.written) {
  console.warn('[MVU通道] 写回失败', result.reason);
}
```

写回安全性：

- 写入前检查 `contextRevision`。
- 写入前检查最新 `messageId` 是否仍与读取时一致。
- 只替换 MVU 外层数据中的 `stat_data`。
- 保留 `initialized_lorebooks`、`schema` 和其他 MVU 管理字段。
- 写入后重新读取并确认持久化结果。

## iframe 通信 action

可视 iframe 与宿主脚本之间使用以下协议：

| Action | 方向 | 作用 |
| --- | --- | --- |
| `REQUEST_MVU_CHANNEL` | iframe → 宿主 | 请求最近一次 MVU通道快照 |
| `MVU_CHANNEL_SNAPSHOT` | 宿主 → iframe | 返回完整变量快照 |
| `REPLACE_MVU_CHANNEL_STAT_DATA` | iframe → 宿主 | 请求写回当前楼层 `stat_data` |
| `MVU_CHANNEL_WRITE_STATUS` | 宿主 → iframe | 返回写回与复读结果 |

`REQUEST_CONTEXT` 中也会附带 `mvuChannel`。该数据用于 UI 初始渲染；需要最新值时仍应请求通道刷新。

## 运行时诊断凭据

宿主页面会发布只读快照：

```ts
window.__daoyuanMvuChannel
```

该对象只用于运行时诊断与 CDP 验收，业务功能不得将它当作数据源。

CDP 比对顺序必须是：

1. 先确认 `window.__daoyuanMvuChannel.ready === true`。
2. 记录通道快照的 `messageId`。
3. 再通过 CDP 直读同一楼层的 `stat_data`。
4. 比较通道快照与 CDP 结果。

2026-08-10 真实酒馆验证：MVU通道先读取楼层 `745`，再用 CDP 读取同一楼层；两份 `stat_data` 完整 JSON 相等。

## 禁止事项

- 禁止后续功能直接调用 `window.Mvu.getMvuData()`。
- 禁止缓存一个 `messageId` 并在之后的异步任务中无校验写回。
- 禁止为了修改一个字段而丢弃未识别的 `stat_data` 字段。
- 禁止将 `getSnapshot()` 当作实时数据。
- 未经明确功能授权时，只允许读取，不得调用写回方法。

## 修改后检查

```bash
./node_modules/.bin/vue-tsc --noEmit
node scripts/validate-fixtures.mjs
./node_modules/.bin/vite build
node scripts/package-candidate.mjs
```

真实运行时验收仍需确认：通道楼层号、通道快照、CDP 同楼层快照以及完整数据一致性。
