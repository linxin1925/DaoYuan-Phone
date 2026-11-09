# 道渊小手机

面向 SillyTavern 的道渊世界观内嵌手机前端。当前正式发行版为 **V1.3.1 R8**。下载见 [GitHub Release](https://github.com/linxin1925/DaoYuan-Phone/releases/tag/v1.3.1)。

## 功能

- DSH 透明 WebM 桌宠、五动作玉简开合状态机与手机比例悬浮界面
- 正文美化支持新旧阅读模式、对白与叙述拆分、窄栏标题换行和任务票据。R8 支持最高 48px 正文字号、独立对白缩放，以及「翼、烛、洄、沄」和「尘」两组专属标签提示词开关。
- 正文立绘读取小手机数据库，支持选图、自定义立绘及本地缓存；配套同步版状态栏可共用选图设置。R8 减少未变正文的重复指纹计算及相同联系人资料的重复存档。
- 玉简联系人、主动传讯、正文玉简通信解析与旧状态栏记录导入
- 万宝商行 AI 货单、批量估价、买卖交易、交易记录与受限 MVU 写回
- 绝色榜、仙网风闻、论坛和天机日报
- MVU 世界时间、地点、人物关系、储物袋和地图只读展示
- 主线信息注入开关及楼层删除后的数据对账
- 用户自主管理 DLC：世界书必选、脚本可选，每套 DLC 使用唯一 ID，可更新、检测/修复挂载、移除脚本或整套登记。旧 DLC 可按需导入
- 桌面浏览器与手机浏览器的基础适配。长期界面计划见 [ROADMAP](./ROADMAP.md)

> 遇到问题时，请记录设备、浏览器、SillyTavern 版本、小手机运行版本和复现步骤。

## 使用

当前 R8 发行提供两份附件：

- [V1.3.1-R8.json — 完整数据库安装版](https://github.com/linxin1925/DaoYuan-Phone/releases/download/v1.3.1/V1.3.1-R8.json)：使用者下载后，在酒馆助手的「脚本」页导入。先停用旧的小手机脚本，避免同时运行两份。
- [V1.3.1-R8-source.zip — 完整原始码](https://github.com/linxin1925/DaoYuan-Phone/releases/download/v1.3.1/V1.3.1-R8-source.zip)：供开发和协作使用，无需导入酒馆助手。

**CDN 外链入口目前仍为 V1.3.0，尚未同步 R8。** 本次发布 Release 附件不会自动切换旧外链入口；需要 R8 的使用者请下载上面的完整数据库安装版。旧发行版见 [Releases 历史](https://github.com/linxin1925/DaoYuan-Phone/releases)，旧包源码归档见 [历史归档](./releases/archive)。

协作开发与更新前请阅读 [开发与发布护栏](./docs/道渊小手机开发与发布护栏.md)。

## 本地开发

R8 的完整原始码以本次 Release 附件 `V1.3.1-R8-source.zip` 为准，要求 Node.js 24.14 或以上、pnpm 10.28.2。主分支的应用源码与 CDN 运行时尚未同步 R8；下方命令用于现有主分支开发流程，不能将其构建结果直接替代 R8 发行包。发布前应按发布护栏核对源码构建与线上运行包的功能差异。

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
