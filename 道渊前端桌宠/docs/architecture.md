# 紫薇桌宠前端架构

```text
用户点击
   ↓
PetStateMachine
   ├─ 更新 data-pet-state
   ├─ 控制玉简 UI
   └─ PngSequenceAdapter.setMotion(state)
                         ↓
                manifest.json → PNG 序列帧
```

状态转移：

```text
Idle ──tap──> TapReaction ──timer──> PhoneEnter ──timer──> PhoneLoop
                                      │                     │
                                      └────close────────────┘
                                                            ↓
                              PhoneExit ──timer──────────> Idle
```

CSS 只负责布局、光效、占位框和玉简 UI，不再绘制人物。正式紫薇形象由 `assets/pet/ziwei/` 下的透明 PNG 提供。
