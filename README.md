# SLG 战斗模拟器 v2.2

基于 v2.2 设计的自动战斗游戏原型（PyTorch-like 自动战斗：React + Vite + TypeScript）。

> **在线地址**：https://wuwiwo.github.io/G3/（GitHub Pages）
>
> 手机电脑均可访问，支持离线 PWA 式使用（Web Audio 程序化音效无外部资源）。

---

## 快速开始

```bash
cd G3/slg-battle
npm install --ignore-scripts
npm run dev              # Vite 默认 http://localhost:5173
npm run dev -- --port 8090
```

构建 & 部署：

```bash
npm run typecheck        # tsc --noEmit
npm run build            # vite build → dist/
npm run deploy           # gh-pages -d dist
```

---

## 项目结构

```
slg-battle/
├── index.html
├── package.json
├── vite.config.ts              # base: './'，未配置 server.port
├── tsconfig.json
├── scripts/                    # 批量平衡测试（esbuild 打包为 .cjs）
│   ├── positionedBalance.ts    # 站位受控跨种族测试（8! 穷举 + Wilson CI）
│   ├── batchBalance.ts         # ROSTER 硬排对照组
│   └── *.ts                    # beastTest / mageBias / symmetryTest 等历史快照
├── docs/
│   ├── update/update-2.1.md
│   ├── update/update-2.1.1.md
│   ├── update/update-2.2.md
│   └── analysis/balance_positioned_2026-11-04_2248.md
└── src/
    ├── main.tsx
    ├── App.tsx                 # 主应用：setup/battle/edit 三页 + v2.1 水平战场 + HUD + 音效 + 技能演出
    ├── index.css               # 全局样式（v2.1 横向战场 + HUD；v2.2 部署页响应式 + 介绍浮层）
    ├── types/
    │   ├── index.ts            # Race(7) / Row / DamageType / StatusType(18) / CharacterDef / ArenaUnit / BattleState
    │   └── stats.ts
    ├── data/
    │   ├── characters.ts       # 57 角色（7 种族），含骷髅兵等召唤物，Lv.100 裸属性
    │   ├── races.ts            # BASE_BONDS 2/3/4 档 + RACE_CONFIG
    │   ├── equipment.ts        # 22 件装备（代达罗斯/奥法护盾/恐鳌之心…）
    │   └── lines.ts            # ALL_LINES 台词库（attack/skill/talent/death/allyDeath）
    ├── engine/
    │   ├── battle.ts           # initBattle / processTick(0.1s tick, 12 子函数）
    │   ├── damage.ts           # calcDamage / calcHeal / 防御分段 v5.2 / 格挡 / 暴击 / 韧性
    │   ├── bonds.ts            # calcBondsFromDefs（TeamSetup 羁绊预览）
    │   ├── SkillRegistry.ts    # scriptId → handler 注册表
    │   └── StatsManager.ts     # 统计入口（recordDamage / recordHeal / recordKill…）
    ├── components/
    │   ├── TeamSetup.tsx       # 3×3 棋盘 + 拖放 + 随机 + 存档；v2.2 宽屏左右对峙 + 右键介绍
│   ├── CharIntroPopover.tsx # v2.2 右键角色介绍浮层（Portal + 视口边界收敛）
    │   ├── BattleField.tsx     # 默认 horizontal 对峙，保留 vertical 兼容
    │   ├── BattleHUD.tsx       # 实时 HUD：HP/存活/输出/DPS/伤害构成/TOP3/每秒曲线
    │   ├── UnitSprite.tsx      # 单位卡（HP/冷却/状态 emoji/飘字）
    │   ├── Avatar.tsx          # 16×16 像素 SVG 头像（种族轮廓+职业徽记+hash 差异）
    │   ├── KillFeed.tsx        # 击杀播报
    │   ├── BattleLog.tsx       # 战斗日志（调试模式显示伤害链路）
    │   ├── StatsPanel.tsx      # 输出/承伤/治疗/物理/魔法/纯粹/普攻/技能 8 标签统计
    │   ├── CharacterInfoCard.tsx / CharDetail.tsx / UnitDetail.tsx
    │   ├── BatchTest.tsx       # 批量测试面板（N 局胜率/面板导出）
    │   └── DataEditor.tsx      # 自定义数据编辑（角色/羁绊覆盖，g3_custom_data）
    ├── audio/
    │   └── SoundEngine.ts      # Web Audio 合成 9 音色：hit/crit/skill/heal/buff/control/death/victory/defeat
    └── hooks/
        ├── useBattleState.ts   # rAF 累积器（0.1s tick × speed 1/2/4x），技能暂停 2s + 手动暂停
        ├── useBattleAudio.ts   # battleLog 增量 → 音效事件映射
        ├── useSavedTeams.ts    # slg_saved_teams 存档
        └── useCustomData.ts    # g3_custom_data 覆盖层
```

> **当前角色数**：`ALL_CHARACTERS` 共 57 条（含骷髅兵 `klb` 召唤物），7 种族。`Avatar.tsx` 注释仍写「52 个角色」为历史遗留，未同步。

---

## 战斗规则（v2.1）

### 棋盘

- 3×3 九宫格，前/中/后三排（Row 0/1/2）
- 每方最多 8 个角色（MAX_UNITS = 8），至少留 1 空位
- v2.1 起 BattleField 默认 horizontal：我方列序 `[Back, Mid, Front]`，敌方 `[Front, Mid, Back]`，双方前排均朝向中央
- 选中单位走 `initBattle(allyChars, enemyChars)`，`row/col` 由 TeamSetup 写入

### 战斗流程

- `useBattleState`：rAF 累积器每 100ms 推进一帧 `processTick(state)`，`state.time += 0.1`
- 速度：1x / 2x / 4x（`speed.current` 循环切换）
- 暂停：手动暂停（⏸/▶）+ 技能暂停聚焦（默认开启，`g3-pause-skill`）——技能释放时冻结 2s，演出序列为 大字 → 台词 → 箭头 → 目标高亮 → 受击
- 普攻初始间隔 = `attackInterval × (0.5 + Math.random()×0.5)`
- 技能起始冷却 = `CD × 0.9 × (0.85 + Math.random()×0.3)`（±15% 随机，消除镜像先手固定；龙族羁绊在此基础上再 ×0.8 / ×0.7）
- 施法可被打断（control / 攻击 / 伤害三级，快照机制）：本 tick 新施加的控制/伤害不打断同 tick 施法，下一 tick 生效；重拳者 `zqz_strike` 打断进完整 CD，其他角色按施法时间重读条（≥0.5s）
- 战斗狂热：100s 后全体 伤害+50% / 攻速+30% / CD-30%（`cooldownRemaining -= 0.13` 而非 0.1）

### 伤害公式（damage.ts v5.2）

```
物理/魔法伤害：
  原始伤害 = 有效攻击力 × 技能倍率 + 固定附加
    有效攻击力含：灼烧×0.9、诅咒×0.9、卷曲×0.8、狼吼×_ylRoarMult、
    魂能层数、龙族数量、激怒、决斗击杀、法师羁绊等覆盖倍率（见 calcDamage）
  防御减伤率 = calcDefReduction(def)        # 分段：
    def 0~500:   1 - 1/(1 + def/680)^1.6
    def 500~1500: 0.585 + (def-500)*0.000215   # cap 0.8
    def >1500:   0.8
  前排减伤 = ×0.9（目标在前排时）
  其他减伤 = (1 - Σ百分比减伤)（含 Inspire、智慧猩物减15%/魔减25%、狂战士叠层、圣灵守护、战士阈值减伤…）
  格挡 = 概率触发则减 floor(def/4)(兽族) 或 floor(def/6)(其他)
    概率：兽/战/龙 35%，猎/法/圣 25%，亡 15%
  暴击 = 基础 7.5% × 韧性修正 (1 - 0.0025×min(tenacity,100))，倍率 1.35×(1 - 0.004×min(tenacity,100))
    致命一击（地狱之犬 dyq）独立判定 25%/45%，与暴击取高，复活后 ×1.9
  最终 = max(中间 - 格挡, 0) 再套暴击倍率

纯粹伤害：
  原始 → 前排0.9 → 其他减伤
  不计算防御减伤、不格挡（可走 defMultiplier / defSquaredDiv / targetMaxHpRatio / targetCurrentHpRatio 等特殊路径）
```

### 命中与闪避

- 基础命中率 100%
- 最终命中率 = min(1, max(0.3, 1 + 命中修正 - 闪避率))
- 石化 🗿 使闪避失效；闪避生效时伤害全免

### 种族羁绊（2/3/4 档，races.ts BASE_BONDS）

| 种族   | 2 人                                                           | 3 人                                                              | 4 人                                                            |
| ------ | -------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| 兽族   | 攻+5% 防+10% 韧性+10%                                          | 攻+10% 防+15% 韧性+18% + 对<50%HP敌人 6%攻击纯粹伤害              | 攻+20% 防+25% 韧性+35% + 对<75%HP敌人 25%攻击纯粹伤害           |
| 猎人   | 攻+10% 命中+10%                                                | 攻+20% 命中+15% 反击40%伤害+12%吸血+每6次攻击额外1目标(40%伤害)   | 攻+30% 命中+30% 反击75%伤害+20%吸血+每5次攻击额外1目标(80%伤害) |
| 战士   | HP+12% 每13s恢复3%HP+HP>50%时10%减伤(魔伤1.5倍)                | HP+20% 每11s恢复5%HP+HP>40%时12%减伤(魔伤1.5倍)+HP<60%时额外10%攻 | HP+35% 每9s恢复6%HP+HP>30%时15%减伤(魔伤2倍)+HP<80%时额外15%攻  |
| 法师   | -15%魔防                                                       | -20%魔防+冷却-7%+施法30%概率全体+3%攻20s                          | -22%魔防+冷却-9%+施法30%概率全体+3%攻20s                        |
| 亡灵   | 攻+5% 闪避+5%                                                  | 攻+10% 闪避+10% 复活10s+每秒2%HP/8s+无敌2s                        | 攻+12% 闪避+15% 物理减伤9%+复活5s+每秒2.5%HP/10s+无敌2s         |
| 龙族   | （无）                                                         | 起始冷却-20%+减伤8%+开局2倍减伤6s                                 | 起始冷却-35%+减伤12%+开局2倍减伤10s\*                           |
| 圣职者 | 敌方#增益/#治疗效果-10%：我方全体获得2%相同增益/平分3%治疗效果 | 敌方#增益/#治疗/#控制效果-8%：我方4%增益/平分5%治疗/控制反制5%    | 敌方#增益/#治疗/#控制效果-12%：我方6%增益/平分8%治疗/控制反制8% |

> \*龙族开局倍率：`races.ts` 文案写 2.5x，`battle.ts:249` 实际为 `2x`（`openMult = 2`），以代码为准。龙族起始冷却实际在 `battle.ts` 用 `cdMult = 0.7/0.8` 实现（-30%/-20%），与文案 -35% 有出入，同样以代码为准。

战斗开始时 `initBattle` 内 `apply()` 会直接叠加攻/防/HP/命中/闪避；兽族韧性（10/20/40）、亡灵物理减伤 9%、法师 CD-8%/-12% 为引擎平坦值，与 `BASE_BONDS.special` 文案配合生效。

### 状态效果（StatusType，共 18）

| 状态               | 说明                                                |
| ------------------ | --------------------------------------------------- |
| 眩晕 stun 💫       | 无法行动                                            |
| 睡眠 sleep 💤      | 无法行动，受击 20% 提前醒（彭彭猪睡眠时驱散+回复）  |
| 石化 petrify 🗿    | 无法行动，闪避失效，魔防 +100%                      |
| 冰冻 freeze ❄️     | 无法行动，受治疗 -50%，免疫物理伤害（寒冰飞龙冰封） |
| 束缚 bind 🔗       | 禁止 #切入/#移动 技能                               |
| 灼烧 burn 🔥       | 攻 -10%，每 tick 受计数值伤害                       |
| 破甲 armorBreak 💔 | 物防/魔防 ×0.5                                      |
| 缴械 disarm        | 无法普攻（部分技能施加）                            |
| 诅咒 curse ☠️      | 攻防 -10%，受治疗 -25%                              |
| 毁灭 ruin          | 紫金色天赋压制（isRuined 检测）                     |
| 沉默 silence 🔇    | 无法使用技能                                        |
| 鼓舞 inspire ✨    | 增益（value 作乘数，如 0.55 = -45%）                |
| 狂暴 bloodrage     | 狂战士/激怒路径                                     |
| 潜行 stealth       | 仅免疫普攻（夜行狼人）                              |
| 护盾 shield 🛡     | 吸收伤害                                            |
| 中毒 poison ☣️     | 受治疗 -25%，每秒/每 tick 伤害                      |
| 减疗 antiHeal 🚫   | 治疗归零；末日减疗 -75% 走 `_healReduction` 通道    |
| 回复 regen ♻️      | 回血增益                                            |

`UnitSprite.tsx` 仅展示其中 11 种的 emoji/颜色（stun/sleep/petrify/freeze/bind/burn/curse/silence/inspire/poison/antiHeal），其余状态在日志与结算中体现。

### 治疗公式

`calcHeal`：`healer.attack × atkRatio + fixedAdd (+ maxHp×targetMaxHpRatio / lostHp×targetLostHpRatio)`，再依次乘 诅咒0.75 / 冰冻0.5 / 中毒0.75 / antiHeal清零 / 末日减疗。

### 装备系统（v1.8，22 件）

见 `src/data/equipment.ts`：代达罗斯之殇、奥法护盾、恐鳌之心、圣剑、破败大剑、圣灵护符、淬毒之刃、不屈头巾、黑色头巾、魔法调试器、波动抑制器、阵型破坏器、龙之心脏、碎骨弩、战斗互助器、胜利号角、诅咒之书、斩魔剑、坚硬头盔、瞩目头饰、缩小护镜、金箍棒。`updateEquipment()` 在每 tick 结算覆写/到期/转移逻辑。

---

## 角色一览（57）

### 兽族（8）

彭彭猪 `pp` · 嚎叫巨牛 `hl` · 夜行狼人 `yl` · 虎啸 `hx` · 智慧猩 `zzx` · 独行马 `dxm` · 裂地蛮熊 `lbmx` · 猛犸象 `mmx`

### 猎人（8）

森之射手 `sszs` · 冰霜猎人 `bslr` · 火枪手 `hqs` · 美杜莎 `mds` · 追风游侠 `zfyx` · 灵弦歌者 `lxgz` · 西部猎人 `xblr` · 林地守护者 `ldshz`

### 战士（8）

炽热战士 `crzs` · 辉刀 `hd` · 分析者 `fxz` · 风之斗士 `fdzs` · 狂战士 `kzs` · 圣灵战士 `slzs` · 重拳者 `zqz` · 决斗大师 `jdds`

### 法师（8）

秀逗大师 `xdds` · 水晶室女 `sjsn` · 白马行者 `bmxz` · 食人魔魔法师 `srm` · 湮灭法师 `ynfs` · 神谕者 `syz` · 宙斯 `zs` · 小精灵 `xjl`

### 亡灵（9）

亡魂骑士 `wqqs` · 亡灵歌咏者 `wlgyz` · 骷髅大帝 `kldd` · 幽暗密行者 `yammxz` · 地狱之犬 `dyq` · 魂之引渡者 `hyz` · 末日使者 `mrsz` · 死亡先知 `swxz` · 骷髅兵 `klb`（召唤物）

### 龙族（8）

火焰翼龙 `hlyl` · 冰霜邪龙 `bsxl` · 血翼飞龙 `xyfl` · 寒冰飞龙 `hbfl` · 暴君龙 `bjl` · 龙吟者 `lyz` · 星辰龙 `xcl` · 地龙 `dl`

### 圣职者（8）

符咒大师 `fz` · 驱魔者 `qm` · 圣骑士 `sq` · 祈祷者 `qd` · 圣拳者 `sqz` · 朱雀之神 `zq` · 圣裁者 `sc` · 殉道者 `xd`

> README 历史版本曾写「52 个可用角色（6 种族）」；实际 `ALL_CHARACTERS` 已扩至 57 条、7 种族（新增圣职者整族）。以代码为准。

---

## 功能特性

### 阵容配置

- 3×3 九宫格自由摆放，拖放装备；**右键查看角色介绍**（面板/天赋/技能/站位/装备），`Shift`/`Alt`+右键或浮层内按钮移除
- v2.2 宽屏（≥1080px）下我方 / VS / 敌方左右对峙，窄屏保持上下堆叠
- 种族羁绊实时预览（`calcBondsFromDefs`）
- 存档保存/读取/删除（`localStorage: slg_saved_teams`，最多 30 队）
- 🎲 随机阵容一键生成

### 战斗观察

- 技能暂停聚焦（默认开启）：卡片高亮 + 技能名大字 + 台词 + 箭头 + 目标高亮 + 受击（5 阶段 2s 演出）
- 冷却倒计时 ⏳：CD 中显示剩余秒数
- 伤害数字浮动（物理🔴 / 魔法🟣 / 纯粹⬜）
- 攻击动作：物理→刀割，魔法→抖动
- 状态 emoji：🔥 💫 ❄️ ☠️ 等
- 实时 HUD：顶部输出优势条 + 战斗时钟 + HP/存活/击杀/DPS/治疗/伤害构成/TOP3 + 每秒伤害双折线（差分分桶，速度无关）
- 击杀播报 KillFeed + 台词气泡（`lines.ts`，技能/攻击/阵亡触发）

### 统计面板

- 输出/承伤/治疗/物理/魔法/纯粹/普攻/技能 8 标签切换
- 我方/敌方分开统计，含击杀/死亡/吸血/存活时间/技能次数
- 技能统计 `skillStats` 记录 casts / hits / interrupts / 分类型伤害

### 调试模式 🐛

App 顶栏 `DFF/DN` 切换，默认开启。日志显示完整伤害计算链路：

```
raw=原始伤害 def=防御值 dr=减伤率%
front=前排后 other=其他减伤后 block=格挡值
```

### 批量测试与数据编辑

- `BatchTest`：面板内 N 局批量对战（`initBattle + processTick`），按角色/队伍输出胜率与面板 CSV
- `DataEditor`：编辑角色面板/天赋/技能（写入 `g3_custom_data`，刷新 `CHARACTER_MAP` 即时生效）
- `scripts/positionedBalance.ts`：站位穷举优化 + Wilson CI 平衡报告（见 v2.1.1 报告）

### 一键复制

将战斗日志（`[time] text`）/ 统计表（TSV）/ 角色面板（CSV）复制到剪贴板，方便分享和分析。

---

## 技术架构

|       层       | 说明                                                                                                                                                                                                                                                                              |
| :------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   **Types**    | Race(7) / StatusType(18) / CharacterDef / ArenaUnit / BattleState 分层                                                                                                                                                                                                            |
|   **Engine**   | `processTick` = `updateStatuses` → `processDelayedDamage` → `updateCasting` → `updateCooldowns` → `updateSkills` → `updateAutoAttacks` → `updateDeaths` → `updateRevivals` → `updateWarriorBonds` → `updateEquipment` → `updateVictory` → `updateBonds`；`SkillRegistry` 脚本驱动 |
|   **Hooks**    | `useBattle`：rAF 累积器（0.1s tick × speed），解耦帧率与逻辑帧；技能暂停 & 手动暂停 & cinemaStage                                                                                                                                                                                 |
| **Components** | 纯展示（BattleLog / StatsPanel / KillFeed / Avatar / UnitSprite）与容器（TeamSetup / BattleField / BattleHUD / DataEditor / BatchTest）分离                                                                                                                                       |

### 数据流

```
阵容配置 → initBattle() → BattleState（羁绊/装备/开场天赋在此叠加）
                                ↓
       useBattleState (requestAnimationFrame 累积器，0.1s tick，1/2/4x)
                                ↓
                processTick() → 12 子函数（状态/施法/技能/普攻/死亡/复活/羁绊/装备/胜负）
                                ↓
       setState({...stateRef.current}) → React 重渲染
                                ↓
       BattleField + UnitSprite + BattleHUD + BattleLog + StatsPanel + KillFeed
```

### 技能演出与音效链路

```
技能日志 → useBattleState 检测 → pauseUntilRef = now + 2000ms → 冻结推进
         → App.tsx cinemaStage 0→4（大字→台词→箭头→高亮→受击）
         → useBattleAudio 增量扫描 battleLog → SoundEngine 合成 9 类音效
```

---

## 部署

```bash
npm run build        # 构建到 dist/
npm run deploy       # 部署到 gh-pages 分支
```

GitHub Pages 地址：`https://wuwiwo.github.io/G3/`
