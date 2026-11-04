# Agent Rules — SLG Battle Simulator

## Version Log Requirement

每次更新（bug修复、功能添加、数值调整、UI变更）都必须创建版本日志文档：

1. 文档路径：`docs/update/update-xx.yy.md`（如 `docs/update/update-1.8.3.md`）
2. 内容要求：
   - 变更日期、版本号
   - 变更分类（新功能 / Bug修复 / 数值调整 / UI改进 / 战斗规则变更）
   - 每项变更的详细说明
   - 文件变更清单（路径 + 摘要）
   - 已知问题（如果有）

## Docs 目录结构

```
docs/
├── v2.0.md / v1.9.md    ← 最新版本主文档（根目录，仅1份）
├── 项目分析报告.md       ← 最新项目分析报告
├── update/               ← 更新日志（每次版本更新）
├── review/               ← AI审查代码结果
├── report/               ← AI实施结果报告
├── analysis/             ← 分析文档（防御/输出/治疗等分析）
└── history/              ← 主文档历史版本（旧版本移入此处）
```

### 根目录归档规则

- 根目录始终保留 **最新版本主文档**（如 `v2.0.md`）和 **项目分析报告.md**
- 新版本发布时，旧版本主文档移入 `docs/history/`
- 示例：发布 v2.0.md 时，v1.9.md 移入 history/

## 版本号规则

- 主版本号：重大功能更新（如装备系统）
- 次版本号：常规功能添加（如新角色、新羁绊）
- 修订号：Bug修复、数值调整、UI改进

## 提交规范

- 每次提交前运行 `npm run typecheck` 确保无类型错误
- 每次提交前运行 `npm run build` 确保构建通过
- 主分支（main）提交后运行 `npm run deploy` 部署到 gh-pages

## 待办 Backlog

### 统计系统

- [ ] 角色面板 CSV 导出（52 角色 Lv.100 面板数据，用于 AI 验证伤害公式）
- [ ] 按技能拆分输出统计（追踪每个 skillId 的伤害/次数）
- [ ] SkillRegistry handler 中标记 damageType 用于承伤统计

### 批量测试

- [ ] 预设多种族 matchup（兽vs猎、猎vs法、战vs亡、龙混搭、同族内战）
- [ ] 首杀时间 / 减员时间线统计
- [ ] 护盾吸收量追踪（shieldAbsorbed 字段已预留）

### 战斗规则

- [ ] 多阵容交叉测试框架（自动切换 lineup 跑 N 场）
