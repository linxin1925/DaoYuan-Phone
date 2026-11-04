# 道渊小手机

面向 SillyTavern 的道渊世界观内嵌手机前端。当前正式发行版为 **V1.3.0**。下载见 [GitHub Release](https://github.com/linxin1925/DaoYuan-Phone/releases/tag/v1.3.0)，开发交接见 [NEXT.md](./NEXT.md)。

## 功能

- DSH 透明 WebM 桌宠、五动作玉简开合状态机与手机比例悬浮界面
- 正文美化支持新旧阅读模式、对白与叙述拆分、窄栏标题换行和任务票据。点击正文立绘可选图或使用自定义立绘，配套同步版状态栏可共用选图设置。
- 玉简联系人、主动传讯、正文玉简通信解析与旧状态栏记录导入
- 万宝商行 AI 货单、批量估价、买卖交易、交易记录与受限 MVU 写回
- 绝色榜、仙网风闻、论坛和天机日报
- MVU 世界时间、地点、人物关系、储物袋和地图只读展示
- 主线信息注入开关及楼层删除后的数据对账
- 用户自主管理 DLC：世界书必选、脚本可选，每套 DLC 使用唯一 ID，可更新、检测/修复挂载、移除脚本或整套登记。旧 DLC 可按需导入
- 桌面浏览器与手机浏览器的基础适配。长期界面计划见 [ROADMAP](./ROADMAP.md)

> 遇到问题时，请记录设备、浏览器、SillyTavern 版本、小手机运行版本和复现步骤。

## 使用

当前分发提供 [V1.3 数据库版](./releases/candidates/道渊小手机V1.3数据库版.json)和 [V1.3 CDN 外链版](./releases/candidates/道渊小手机V1.3-CDN外链版.json)。在酒馆助手的「脚本」页选择其中一份导入。外链版可在「小手机 → 设置 → 小手机更新」检查并安装新版。一键更新会刷新酒馆，请先保存聊天编辑和草稿，并等待生成结束。旧包见 [历史归档](./releases/archive)。后续开发先读 [NEXT](./NEXT.md)。

## 本地开发

要求 Node.js 与 pnpm。开发源码位于 `app/`。发布前应按发布护栏核对源码构建与线上运行包的功能差异。

```bash
cd app
pnpm install
pnpm check
node scripts/package-candidate.mjs --v13-database
```

`pnpm check` 会执行类型检查、数据样例校验、界面契约校验、生产构建和候选包生成。

## 发布说明

- 更新记录见 [CHANGELOG](./CHANGELOG.md)。
- 长期技术计划见 [ROADMAP](./ROADMAP.md)。
- API 密钥只保存在使用者浏览器本地，不应提交任何真实密钥或 `.env` 文件。
- 桌宠素材来源为 `PC2005-cloud/dsh-pet`。代码与角色媒体的授权范围分别以上游说明为准。当前发布按非商用用途交付。
- 当前尚未选定开源许可证；添加 `LICENSE` 前请先确认代码与非桌宠美术资源的授权范围。
