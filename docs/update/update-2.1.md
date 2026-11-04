# v2.1 更新日志

- **变更日期**：2026-11-04
- **版本号**：v2.1（次版本更新，上一版本 v2.0）
- **变更分类**：新功能 / UI 改进 / 工程整理
- **关联提交**：基线提交 `23e100e` 之后的 v2.1 功能提交

---

## 一、新功能：代码绘制像素风角色头像

原 `Avatar.tsx` 使用「圆形渐变底 + 名字首字 + emoji 职业角标」，在战斗画面中与像素风战场不统一，也不属于真正的像素绘制。本次改为**纯代码生成 SVG 像素图**，不引入任何图片资源文件。

实现要点：

- 16×16 逻辑网格，每个单元 3×3 px，`viewBox="0 0 48 48"`，图形只使用 `<rect>`。
- `shape-rendering="crispEdges"` + `image-rendering: pixelated`，无渐变、无描边、无 opacity，每头像不超过 8 色，全局统一描边色 `#171a24`。
- 头像差异化三层组合：**种族决定轮廓与主色板**、**职业决定底部徽记**、**角色名 hash 决定额饰/眉形/高光**；眼睛焦点固定在第 7 行，保证不同头像对齐。
- `inferRole(stats)` 依据 hp / attack / physicalDef / attackInterval 推断 `tank / dps / ranged / support`。
- 生成结果编码为 `data:image/svg+xml;charset=utf-8,` data URI，并按 `race|role|name` 缓存，避免每帧重复生成。
- 显示尺寸按 16 的整数倍对齐（`Math.max(16, Math.round(size / 16) * 16)`），`UnitSprite.tsx` 中改为 48px，正好是 48 视口的 1:1 渲染。
- 保留导出 `RACE_COLORS` / `RACE_DARK` / `RACE_DARK2` / `RACE_BG` / `ROLE_ICON`，不破坏原有引用。

## 二、新功能：程序化技能音效

新增无外部音频文件的 Web Audio 音效引擎，解决「技能演出只有视觉、没有听觉反馈」的问题。

- `src/audio/SoundEngine.ts`：单例 `sound`，用 `AudioContext` + `OscillatorNode` + 白噪声 buffer + `GainNode` 包络实时合成 9 类音色：`hit / crit / skill / heal / buff / control / death / victory / defeat`。
- 同类音效通过 `lastPlayed` Map 限流，避免高频日志把音频通道打满。
- 浏览器自动播放限制：`unlock()` 在**点击「开始战斗」的用户手势**中调用，`resume()` 挂起的 context。
- 开关与音量持久化到 `localStorage`（`g3-sound` / `g3-volume`），顶栏提供 🔊/🔇 按钮与音量滑杆。
- `src/hooks/useBattleAudio.ts`：以 `battleLog` 增量驱动音效，`cursor` 记录已处理长度；`state.time` 回退视为重开战斗并重置；技能日志按 `heal` / `tags` 分流为治疗、增益、控制、通用技能；伤害日志依据暴击标记区分 `crit` / `hit`；`phase === "finished"` 时按 `winner` 播放胜负音效且只播一次。

## 三、新功能：实时战斗 HUD（更多直观统计）

新增 `src/components/BattleHUD.tsx`，把原本只能在战斗结束后查看的统计搬到战斗画面顶部实时呈现。

- 数据来源：`battle.units`（血量/存活）与 `battle.stats`（累计输出、治疗、击杀、伤害构成）。
- 双方各自展示：总 HP 与百分比、存活数、击杀数、总输出、DPS、治疗量、物理/魔法/纯粹伤害构成堆叠条、实时输出 TOP3。
- 顶部为「输出优势条 + 战斗时钟」，按双方累计输出占比着色。
- `useDamageTimeline` 用**相邻帧累计伤害差分**按 `Math.floor(battle.time)` 逻辑秒分桶，绘制双方每秒伤害双折线；`recentDps` 取近 3 秒均值，因此 1x/2x/4x 速度下时间轴仍对齐战斗内时间。
- `processedRef.current === battle` 去重，防止 React StrictMode 或同一 state 对象重复 effect 造成重复累加。

## 四、UI 改进：双方水平横向 PK 战场

把原来「我方在上 / 敌方在下」的上下堆叠棋盘改为左右对峙，让攻防方向一目了然。

- `BattleField.tsx` 新增 `layout` 属性，默认 `horizontal`，保留 `layout="vertical"` 兼容旧布局。
- 列顺序镜像：我方 `[Back, Mid, Front]`、敌方 `[Front, Mid, Back]`，双方**前排均朝向中央**。
- 删除旧的 DOM 测量、攻击箭头计算等失效逻辑（`CELL_W` / `CELL_H` / `arrowLines` / `DMG_ARROW_COLOR` 等）。
- 每个队伍面板增加 `alive/total` 与队伍总输出的队内小统计。
- `App.tsx` 用 `.arena-wrap` + `.arena-stage` 左右排布两个 `BattleField`，中央插入对阵区：`VS`、实时战斗时间、⚔ 呼吸动画、存活比分、水平对峙提示。
- `index.css` 中横向战场内的单位卡片改为「头像在上、信息在下」的棋子造型；补充窄屏（≤700px）横向滚动与尺寸适配。

## 五、工程整理

- `App.tsx` 版本号 `v2.0` → `v2.1`。
- 依 `.agents/AGENT.md` 补齐 `docs/update/update-2.1.md` 版本日志（此前 `docs/` 目录尚未建立）。
- `dist/` 已被 `.gitignore` 忽略，但 `dist/index.html`、`dist/favicon.svg`、`dist/icons.svg` 属历史误跟踪。本次从 Git 索引移除（`git rm --cached`，**不删除本地文件**），构建产物统一由 `npm run deploy`（`gh-pages -d dist`）从本地 `dist/` 推送，避免 main 分支上的 `index.html` 引用不存在的 hash 资源。

---

## 六、文件变更清单

| 路径                                                    | 类型     | 摘要                                                                                   |
| ------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `src/components/Avatar.tsx`                             | 重写     | 文字/渐变头像 → 代码生成像素 SVG data URI（16×16 网格、种族+职业+hash 差异、URI 缓存） |
| `src/components/UnitSprite.tsx`                         | 修改     | 头像尺寸 42 → 48，匹配像素网格整数倍                                                   |
| `src/audio/SoundEngine.ts`                              | 新增     | Web Audio 程序化音效引擎，9 类音色、ADSR、限流、localStorage 配置                      |
| `src/hooks/useBattleAudio.ts`                           | 新增     | 战斗日志增量 → 音效事件映射，含重开检测与胜负音效去重                                  |
| `src/components/BattleHUD.tsx`                          | 新增     | 实时 HUD：HP/存活/击杀/输出/DPS/治疗/伤害构成/TOP3/每秒伤害曲线                        |
| `src/components/BattleField.tsx`                        | 重写     | 默认水平横向对峙、列镜像、vertical 兼容、队内小统计                                    |
| `src/App.tsx`                                           | 修改     | 接入 HUD 与音效 Hook、顶栏音效开关与音量、水平战场布局、版本号 v2.1                    |
| `src/index.css`                                         | 修改     | 新增 v2.1 水平战场、中央对阵区、HUD 样式与窄屏适配                                     |
| `docs/update/update-2.1.md`                             | 新增     | 本版本日志                                                                             |
| `dist/index.html`、`dist/favicon.svg`、`dist/icons.svg` | 索引移除 | 构建产物不再入库（本地文件保留）                                                       |

## 七、验证结果

- `npm run typecheck`：通过（`tsc --noEmit` 无输出）。
- `npm run build`：通过，Vite 6.4.3，56 modules；产物 `dist/assets/index-Pi76lE0Z.css`（14.00 kB）、`dist/assets/index-CXVT6H20.js`（438.79 kB）。
- 浏览器实跑（自动随机双方阵容并开战）：`.panel-controls` 随机按钮 2 个、开始按钮存在、单位格 16 个、像素头像 `<img>` 16 个、中央对阵区 `VS | 4.8s | ⚔ | 8 : 8 | 水平对峙`。
- HUD 数据一致性：顶部优势条 `4,380 / 5,056` 与双方队伍块「总输出」完全一致，占比 46% / 54%，DPS 1,254 / 1,223，伤害构成与 TOP3 均有数值。
- 目视验收截图：战斗结束态（我方 0/8、敌方 6/8），HUD、水平对峙、中央 VS 区、像素头像均正常渲染。

## 八、已知问题

- 音效为程序化合成，尚未做人工听感验收；浏览器需用户手势解锁 AudioContext，静音开关默认开启但首次开战前不会发声。
- 战斗结束后 DPS 为「近 3 秒均值」窗口，全灭方会显示 0，属预期口径而非统计错误。
- `README.md` 仍停留在 v1.7.2，项目结构未包含 `Avatar.tsx` / `BattleHUD.tsx` / `audio/` / `scripts/` 等新增内容，且声称 `npm run dev` 即 8090 端口——`vite.config.ts` 实际未配置 `server.port`，默认 5173，需显式 `--port 8090`。本次未改动这两处。
- 水平战场 `min-width: 660px`，窄屏需横向滚动；`@media (max-width: 700px)` 已做头像与卡片尺寸降级。
- `src/data/characters.ts.bak`、`.workbuddy-ai/` 为本地备份/工作记忆，未纳入版本库。
