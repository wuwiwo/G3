# v2.2 更新日志

- **变更日期**：2026-11-04
- **版本号**：v2.2（`App.tsx` 的 `VERSION` 同步由 `v2.1` 升至 `v2.2`）
- **变更分类**：UI 改进（部署页响应式布局）/ 新功能（右键角色介绍）/ 缺陷修复（种族展示配置）
- **应用版本**：v2.2

---

## 一、变更说明

### 1. 部署页宽屏下改为左右对峙

原实现把「我方 / VS / 敌方」上下堆叠，且外层容器硬编码 `maxWidth: 640`，宽屏下大片留白，与 v2.1 已改成的水平横向 PK 战斗页不呼应。

- `TeamSetup` 外层容器改由 `.setup-page` 控制最大宽度：窄屏 `640px`，宽屏 `min(1480px, 96vw)`。
- 两个 `TeamPanel` 与中央分隔条包进 `.setup-arena`：
  - 窄屏（`<1080px`）：`flex-direction: column`，保持原上下堆叠，VS 为横向分隔线。
  - 宽屏（`≥1080px`）：`grid-template-columns: minmax(0,1fr) 46px minmax(0,1fr)`，两侧同高并排，中央 VS 竖排 + 上下延伸的竖线，与战斗页中央对阵区视觉统一。
- 每侧包一层 `.setup-side { min-width: 0 }`，避免角色池横向滚动撑破 grid 列。

### 2. 部署时右键查看角色介绍

新增 `src/components/CharIntroPopover.tsx`，以跟随鼠标的浮层展示角色档案，替代原先「右键 = 直接移除」的单一行为。

- **入口**：右键布阵格子上的角色、右键角色池中的角色卡，均弹出介绍；原有 `👁` 按钮打开的全屏 `CharDetail` 保留不变。
- **内容**：像素头像（复用 v2.1 的 `Avatar`）、名字、种族 + 职业定位（`inferRole`）、所在格与已装备装备、6 项面板（生命/攻击/物防减伤/魔防减伤/攻速/技能 CD）、天赋、技能（描述 + CD + 施法时间 + 标签）。
- **定位**：`createPortal` 挂到 `document.body`，规避 `TeamPanel` 的 `overflow: hidden` 与祖先 containing block；`useLayoutEffect` 测量自身尺寸后把 `left/top` 收敛进视口边界。
- **关闭**：左键点击浮层外部、`Esc`、页面滚动、窗口尺寸变化。

### 3. 与原有右键操作的兼容

右键语义变更后，下列原有能力全部保留：

| 操作                           | 行为                                        |
| ------------------------------ | ------------------------------------------- |
| 右键布阵角色                   | 打开介绍浮层（浮层内提供「🗑 移除该角色」） |
| 右键角色池角色                 | 打开介绍浮层（不含移除按钮）                |
| `Shift` / `Alt` + 右键布阵格子 | 直接移除该角色（旧快捷方式）                |
| 装备模式下右键已装备格子       | 卸下该格装备（与原逻辑一致）                |
| 拖到「🗑 拖到这里移除」        | 移除角色（未改动）                          |

底部提示同步改为「拖拽或点击角色 → 上阵 · 右键看介绍 · Shift+右键移除 · ⚡一键部署」。

### 4. 顺带修复

- `src/data/races.ts` 的 `RACE_CONFIG` 与 `RACE_BG` 缺少 `Race.Holy`，导致圣职者在全屏角色详情（`CharacterInfoCard`）和统计面板里回退成 `?` / 灰色；补齐为「圣职者 / #ffd54f / 圣」。
- 布阵格补 `className="setup-slot"` 与 `data-slot-index`，作为稳定的样式与自动化验收钩子。

## 二、文件变更清单

| 路径                                  | 类型 | 摘要                                                                               |
| ------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| `src/components/CharIntroPopover.tsx` | 新增 | 右键介绍浮层：Portal、边界收敛、关闭策略、完整角色档案                             |
| `src/components/TeamSetup.tsx`        | 修改 | 引入浮层与 `intro` 状态、格子/角色池右键、宽屏三栏结构、提示文案                   |
| `src/index.css`                       | 修改 | `.setup-page` / `.setup-arena` / `.setup-vs` 响应式布局 + `.char-intro-*` 浮层样式 |
| `src/data/races.ts`                   | 修改 | 补齐 `Race.Holy` 的 `RACE_CONFIG` / `RACE_BG` 展示配置                             |
| `src/App.tsx`                         | 修改 | 版本号 `v2.1` → `v2.2`                                                             |
| `docs/update/update-2.2.md`           | 新增 | 本版本日志                                                                         |

## 三、验证结果

- `npm run typecheck`：通过（0 错误）。
- `npm run build`：通过，`dist/assets/index-BVT2tFsl.css`（17.67 kB）/ `dist/assets/index-Cnj5pbuu.js`（443.42 kB）。
- 浏览器 DOM 断言（本地 `http://127.0.0.1:8090/`）：
  - 视口 1600×1000：`.setup-arena` 为 `grid`，列宽 `701px 46px 701px`，两侧 `y` 同为 72（左右并排）。
  - 视口 800×1000：`.setup-arena` 回退 `flex`，`.setup-page` 上限 `640px`，两侧 `y` 为 72 / 892（上下堆叠）。
  - 一键部署双方共 16 名角色 / 18 个格子；右键弹出浮层，显示「彭彭猪 · 兽族 · 🛡 前排坦克 · 📍 前排·第1格」，含 6 项面板、2 个说明段、移除按钮。
  - 右下角极端坐标（`innerWidth-5, innerHeight-5`）：浮层 `rect = [1126, 515, 1438, 899]`，完全位于 1440×900 视口内。
  - `Esc` 关闭、左键点击外部关闭、角色池右键打开（且无移除按钮）、`Shift+右键` 直接移除（16→15）、浮层内移除按钮（16→15 且自动关闭）：全部通过。
- 目视验收：宽屏左右对峙截图、宽屏 + 介绍浮层截图均正常渲染。

## 四、已知问题与后续建议

- `npm run deploy` 仍受本机代理 `127.0.0.1:6491` 影响（GitHub 返回 `CONNECT tunnel failed, 502`，直连超时），代码与 `dist` 产物已就绪，网络恢复后重跑。
- `README.md` 仍停留在 v1.7.2，未覆盖 v2.x 的像素头像、音效、HUD、平衡测试脚本与本次改造。
- 引擎遗留问题未修：`battle.ts:2385` 的 `sjny` 应为 `sjsn`，`battle.ts:2374` 的 `xlds` 应为 `xdds`；历史测试脚本 ROSTER 含已删除 id。详见 `docs/update/update-2.1.1.md`。
- 技能音效仍缺人工听感验收。
- 本次**未改动任何战斗数值、技能或天赋**；`RACE_CONFIG` / `RACE_BG` 仅影响展示文案与配色。
