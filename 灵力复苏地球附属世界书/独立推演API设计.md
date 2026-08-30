# 灵力复苏地球：独立推演API设计草案

## 定位

独立推演API负责低频演算后台世界，不负责主对话角色扮演。API只返回候选状态补丁，本地脚本负责验证和提交，EJS只负责把已确认状态对应的世界书条目装入提示词。

## 推进流水线

`主对话完成 → 识别有效正向推进 → 本地账本累计 → 命中检查点 → 构造状态快照 → 调用推演API → 校验候选补丁 → 原子提交 → 建立检查点 → 更新EJS路由`

重抽、重生成、回滚、失败回复和中止回复不得重复触发推演。每次请求携带聊天ID、推演序号、父检查点ID和请求指纹，用于拒绝重复提交与过期响应。

## 建议请求结构

```json
{
  "schema_version": 1,
  "simulation_id": "chat-id:sequence",
  "parent_checkpoint": "checkpoint-id",
  "request_fingerprint": "hash",
  "world_clock": {
    "opening_date": "YYYY-MM-DD",
    "earth_date": "YYYY-MM-DD",
    "xuantian_date": "YYYY-MM-DD",
    "revival_year": 0
  },
  "state": {
    "revival_stage": "复苏初现",
    "contact_stage": "互不知情",
    "secret_realm_stage": "未激活",
    "swarm_earth_stage": "零星迹象",
    "swarm_xuantian_stage": "零星迹象",
    "regions": [],
    "factions": [],
    "schools": [],
    "active_events": []
  },
  "confirmed_changes": [],
  "unresolved_pressures": [],
  "limits": {
    "max_elapsed_days": 30,
    "max_stage_changes": 1,
    "protected_player_agency": true,
    "forbidden_mutations": []
  },
  "random_seed": "stable-seed"
}
```

请求中的`confirmed_changes`只收录已经在主对话中发生并可观察的事实。玩家计划、猜测、梦境和未确认传闻不能作为确定事实提交。

## 建议响应结构

```json
{
  "schema_version": 1,
  "simulation_id": "chat-id:sequence",
  "parent_checkpoint": "checkpoint-id",
  "summary": "本次后台演化摘要",
  "elapsed_time": { "days": 7 },
  "patches": [
    {
      "op": "replace",
      "path": "/schools/first_school/stage",
      "from": "筹议",
      "value": "选址",
      "reason": "筹备委员会完成初步方案",
      "evidence": ["confirmed-fact-id"]
    }
  ],
  "new_events": [],
  "closed_events": [],
  "next_check": {
    "minimum_world_days": 7,
    "pressure_tags": ["学校筹建"]
  },
  "warnings": []
}
```

补丁路径必须来自白名单；`from`必须与当前状态一致。任何涉及玩家身份、行动、台词、关系选择或不可逆重大决定的补丁直接拒绝。

## 本地校验顺序

1. 校验JSON与版本。
2. 校验聊天ID、推演序号、父检查点和请求指纹。
3. 拒绝未知字段、未知补丁路径和越权操作。
4. 校验地球与玄天界日期按玩家选择的受控比例推进；默认1比1，慢速档累计不足一日的余数。
5. 校验经过时间、阶段跨度和事件数量未超过本次限制。
6. 校验每项变化具有可追溯原因，不覆盖玩家未完成的关键选择。
7. 在临时副本应用全部补丁并检查不变量。
8. 全部通过后一次性提交；任一失败则整批拒绝。

## 初始低速参数建议

- 普通正向回复只记账，不逐轮调用API。
- 至少经过若干有效回复且世界内出现明确时间流逝后才检查推演。
- 普通调用最多推进30个世界日，默认远低于上限。
- 普通调用最多推动一个事件进入下一阶段。
- “复苏逐年增强”由世界日期决定，不能靠连续聊天快速刷取。
- 双界正式接触、秘境激活、首次公开超凡、虫群全面入侵等关键跃迁需要明确前置事实，建议设置高等级检查点。

具体轮数、天数、概率和API模型等参数，等触发条件与参考模板到位后再定。

## 故障策略

- 超时或断网：不提交变化，保留最后确认状态。
- 响应无法解析：记录原始诊断摘要，不把散文注入世界书。
- 重复响应：依据请求指纹和推演序号忽略。
- 过期响应：父检查点不一致时拒绝。
- 部分补丁非法：整批拒绝，不做半提交。
- 成本超限：暂停API推演，确定性日期系统仍可运行。

## 密钥与隐私

API密钥只保存在宿主扩展设置或安全配置中，绝不写进角色卡、世界书、聊天变量、EJS内容或导出JSON。默认只发送结构化摘要，不发送完整聊天记录。
