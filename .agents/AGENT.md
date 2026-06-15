# Agent Rules — SLG Battle Simulator

## Version Log Requirement

每次更新（bug修复、功能添加、数值调整、UI变更）都必须创建或更新版本日志文档：

1. 文档路径：`docs/v{版本号}.md`
2. 内容要求：
   - 变更日期、版本号
   - 变更分类（新功能 / Bug修复 / 数值调整 / UI改进 / 战斗规则变更）
   - 每项变更的详细说明
   - 文件变更清单（路径 + 摘要）
   - 已知问题（如果有）

## 版本号规则

- 主版本号：重大功能更新（如装备系统）
- 次版本号：常规功能添加（如新角色、新羁绊）
- 修订号：Bug修复、数值调整、UI改进

## 提交规范

- 每次提交前运行 `npm run typecheck` 确保无类型错误
- 每次提交前运行 `npm run build` 确保构建通过
- 主分支（main）提交后运行 `npm run deploy` 部署到 gh-pages
