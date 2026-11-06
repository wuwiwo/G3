"""v3.3 平衡调整 —— 数据层 + 引擎硬编码层的集中补丁（可复核、可重跑）。

设计源: docs/V3.3平衡性调整.md  纪律: skills/battle-balance-workflow/SKILL.md 第四节
用法: python scripts/v33_apply.py [--dry-run]

原则:
  1. 每条替换先验证锚点唯一；任一失败则整份不写入（原子性），并列出失败清单。
  2. 数据层(description/talent)与实际数值字段(cooldown/castTime/atkRatio/duration/heal)同步改。
  3. 引擎 handler 里的硬编码倍率同步改，避免「描述改了数值没改」。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
DRY = "--dry-run" in sys.argv

# ---------------------------------------------------------------- 数据层
# cd/cast: 单值 | dmg/dur: 按出现顺序覆盖 | heal: heal.atkRatio | desc/talent: 文本
CHARS: dict[str, dict] = {
    # ===== 兽族 =====
    "pp": {"cd": 12, "cast": 0,
           "talent": "睡眠时驱散异常+每秒回1%+Lv×0.01%HP（v3.3 回复减半）",
           "desc": "催眠: 随机发动1个效果：①自身与随机1名敌人(优先后排)同睡4s ②自身睡5s+随机2名敌人困意6s命中率-75%"},
    "hl": {"cd": 999,
           "talent": "开场怒吼: 敌方全体攻击-30%持续5s，之后-15%持续8s",
           "desc": "激怒: 自身HP首次降至60%进入激怒，每3s失去2%最大HP，获得20%减伤+30%攻+50%攻速，免疫异常至战斗结束(每场一次)"},
    "yl": {"cd": 7, "dmg": [2.4],
           "desc": "潜行: 无法被普攻选中(技能可选)、期间不回血；攻击240%+50%吸血，优先后排(前10/中40/后50)，攻击后解除"},
    "zzx": {"cd": 8,
            "talent": "战斗开始，使敌方同阵型位置所有敌人前7s天赋与技能禁用并失效（不视为异常，无法驱散）",
            "desc": "使自身以外1名随机友方(优先兽族)+25%攻7s；自身与目标获得10%物理减伤+20%魔法减伤7s"},
    "dxm": {"cd": 6,
            "talent": "所有友方角色技能冷却减少12%（含自身）",
            "desc": "治疗我方最低血量1名(优先兽族)：7×等级+攻击×190%；每发动2次，下次治疗+50%并驱散"},
    "lbmx": {"cd": 8, "dmg": [2.0],
             "talent": "开场咆哮: 嘲讽敌方随机3名强制攻击自身4s，期间敌方无法使用技能(每场一次)",
             "desc": "拍击地面: 随机1排全体攻击×200%物理+降20%物防6s（优先前中排，后排-35%，命中3人-35%）"},
    "mmx": {"cd": 10, "dmg": [0.75],
            "talent": "每间隔12s进入卷曲6s: 攻-20% 防+40%，额外格挡自身防御总和×20%的技能伤害",
            "desc": "踩踏1名敌人: 75%攻击物理+自身防御×2纯粹（前排+25%，后排缴械3s）"},
    # ===== 猎人 =====
    "sszs": {"cd": 5, "dmg": [2.7], "dur": [4],
             "talent": "获得30%+等级×0.1%闪避(100级40%)；每累计受2次#切入技能，下次#切入技能100%闪避",
             "desc": "对1名敌方射击: 攻击×270%物理+束缚4s"},
    "bslr": {"cd": 7, "dmg": [0.9],
             "talent": "造成伤害37.5%几率无视基础防御并降低目标50%受疗4s；自身受攻击时天赋暂失效1s（技能视为攻击，几率55%）",
             "desc": "对敌方1排持续射击1.5s，每0.5秒攻击×90%物理；每次降10%攻或20%攻速4s(最多3层)"},
    "hqs": {"talent": "自身无法被#切入技能选为对象，受到#切入技能伤害为0，自身对后排敌人伤害+10%"},
    "mds": {"cd": 8, "dmg": [1.35], "dur": [3],
            "talent": "自身攻-12%，同时攻击2名敌人；每攻击2次，下次60%束缚4s / 40%石化2s",
            "desc": "前中后排各1名敌人: 攻击×135%纯粹+石化3s，自身恢复30%伤害血量"},
    "zfyx": {"cd": 8, "dmg": [1.25],
             "talent": "敌方每次发动#切入技能，敌人先受35%伤害，我方全体+10%攻9s(最多4层)",
             "desc": "发射3枚弓箭，每次攻击×125%随机敌人；每次发射后移动至空位+闪避40% 5s"},
    "lxgz": {"cd": 8, "heal": 0.25,
             "talent": "自身治疗或攻击，使我方随机1名获得[激昂]: +10%+等级×0.1%攻与15%攻速，持续5s",
             "desc": "弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20%"},
    "xblr": {"cd": 8,
             "talent": "我方全体猎人每次攻击，自身额外对该目标进行一次10%伤害的攻击，该攻击暴击率+35%",
             "desc": "跳至空位后，对2名敌人各3发攻击：90%/100%/120%，第3发必暴击"},
    "ldshz": {"cd": 8,
              "talent": "自身HP>90%时受伤-60%，HP>40%时受伤-30%",
              "desc": "使自身及随机2名友方获得护盾(自身攻×600%)6s；护盾破碎时我方全场获得30%护盾值治疗"},
    # ===== 战士 =====
    "crzs": {"cd": 4, "dmg": [2.2], "dur": [3],
             "talent": "每秒失去1%最大HP，受伤+10%，受疗+20%；对敌方同阵型全体每秒造成攻击×1.5%+等级×0.02%纯粹(100级3.5%)",
             "desc": "攻击×220%物理+灼烧3s，自受10%反伤（敌方前·中排有角色时不会对后排发动）"},
    "hd": {"cd": 7, "dmg": [2.5],
           "talent": "攻击+10%，魔法防御+20%，命中率-15%；攻击未命中受到50%反伤",
           "desc": "随机1排全体: 攻击×250%物理（命中3人-35%）"},
    "fxz": {"cd": 6,
            "talent": "标记敌人与自身对称的1名角色，其闪避/额外防御归0直到分析者阵亡；之后每35s可分析另一名",
            "desc": "提升自身及2名随机友方最低一项防御6%，持续30s，最多叠10次并重置持续时间"},
    "fdzs": {"cd": 6, "dmg": [0.8],
             "talent": "对前排造成伤害提升20%+等级×0.1%",
             "desc": "1.8s内5次快速攻击，每次攻击目标随机，攻击×80%且无视基础防御"},
    "kzs": {"cd": 10, "dur": [7],
            "talent": "每损失12%最大HP，提升3%+等级×0.05%攻与8%减伤，最多5层",
            "desc": "消耗10%当前HP进入嗜血: 7s内攻速+80%，每次攻击附加目标当前HP×5%纯粹"},
    "slzs": {"talent": "每次受魔法伤害50%几率对施法者造成攻×60%+等级×0.25%纯粹并眩晕2s；50%使该次魔伤-50%并治疗随机1名友方",
             "desc": "消耗6%最大HP进入守护8s: 自身25%减伤、受疗+30%，我方全体友方受到魔法伤害75%几率转移至自身"},
    "zqz": {"cd": 10, "dmg": [4.4], "dur": [2],
            "talent": "每普通攻击3次，下次攻击附带40%吸血与持续6s的[破甲]",
            "desc": "施法1s，对1名敌方造成攻击×440%物理并眩晕2s，发动后自身也眩晕2s"},
    "jdds": {"cd": 6,
             "talent": "我方全体战士每次击杀，自身受当前攻×10%反冲，之后+3%+等级×0.02%攻与5%防直到战斗结束",
             "desc": "夺取敌方攻最高角色20%攻击力5s"},
    # ===== 法师 =====
    "xdds": {"cd": 7, "dmg": [2.2],
             "talent": "我方全体法师每次技能+1层秀逗: 每层3%+等级×0.03%攻速+3%技能吸血，7s，最多7层",
             "desc": "对1名敌方造成攻击×220%魔法；每2次升级陨石轰炸(1排+攻击×290%+灼烧3s)，自身获得2层/4层秀逗"},
    "sjsn": {"cd": 7, "dmg": [0.8], "dur": [3, 3],
             "talent": "除自身外，友方法师技能冷却-10%，技能吸血+10%",
             "desc": "使1名敌方束缚+缴械+每秒攻击×80%魔法，持续3s（无视40%魔防）"},
    "bmxz": {"cd": 9, "dmg": [2.0],
             "talent": "友方全场法师每次成功施加异常状态，自身技能减少1s冷却并恢复3%最大HP",
             "desc": "随机蓄力1/2/3s→前排/前中排/全场冲击波: 攻击×200%魔法（命中5名-40%）"},
    "srm": {"cd": 5, "dmg": [1.6], "dur": [1],
            "talent": "自身攻击获得10%吸血；每当友方阵亡，提升12%最大HP上限并恢复16%最大HP",
            "desc": "消耗3%最大HP，对1敌造成攻击×160%+当前血量×3%魔法并眩晕1s；每2次发动变2倍/3倍效果"},
    "ynfs": {"cd": 9, "cast": 3.5},
    "syz": {"cd": 9, "dur": [6],
            "talent": "每次攻击治疗我方随机1名友方攻×70%(80%几率最低血单位)；阵亡后全场法师10%减伤+每4s全体治疗(前10s 2倍)",
            "desc": "我方最低血量2名友方: 受到治疗+25%、减伤20%+延迟5s结算，持续6s"},
    "zs": {"cd": 10, "dmg": [1.7],
           "talent": "自身攻击/技能各有35%/75%几率附加目标当前HP×8%的魔法伤害",
           "desc": "全屏攻击×160-180%魔法"},
    "xjl": {"cd": 9,
            "talent": "每秒恢复1%最大HP；我方全场每次技能对敌造成伤害，自身恢复1%最大HP（每2s最多5%）",
            "desc": "链接1名友方8s: +30%技能增强+双方天赋20%效果，自身代替友方承担25%伤害"},
    # ===== 亡灵 =====
    "wqqs": {"cd": 8, "dmg": [1.1], "dur": [5],
             "desc": "随机移动后对1名敌人造成攻击×110%纯粹，并使其受到诅咒5s"},
    "wlgyz": {"cd": 8, "cast": 2, "heal": 1.6, "dur": [5],
              "desc": "施法2s，恢复随机2名友方攻击×160%生命，并诅咒随机1名敌方5s"},
    "kldd": {"cd": 7, "dmg": [1.5, 0.75], "dur": [1.5],
             "desc": "对1敌造成攻击×150%魔法并眩晕1.5s；4s后追加攻击×75%纯粹，自身恢复25%攻击血量"},
    "yammxz": {"cd": 8, "dmg": [1.2], "dur": [4],
               "desc": "与友方换位后，使2名随机敌人沉默4s，并造成攻击×120%纯粹伤害"},
    "dyq": {"cd": 5, "dmg": [1.3], "dur": [4],
            "desc": "对同列竖排全体造成攻击×130%魔法，30%几率诅咒4s（命中3人-30%）"},
    "hyz": {"cd": 13,
            "talent": "每4s或每当我方对敌施加负面状态(每次动作1层)获得1层魂能，最多5层；每层攻+5%防+10%；复活后立即获得5层",
            "desc": "消耗全部魂能，瞬移至1个空位；使随机1名友方驱散全部负面，自身与目标获得护盾(攻击×80%×层数)"},
    "mrsz": {"cd": 14,
             "talent": "攻击异常状态敌人造成伤害+10%，获得20%吸血，复活后效果2倍",
             "desc": "消耗6%最大HP，锁定近10s伤害最高目标: 受疗-75%、每秒13%×攻击纯粹、[沉默]+[破坏]8s（HP<15%不可用）"},
    "swxz": {"cd": 7,
             "talent": "自身每累积造成800伤害，获得3%伤害减免直到战斗结束（最多10层，计算实际伤害）",
             "desc": "吸取1单位10s: 每秒造成自身攻击×6%+目标最大HP×1%魔法，自身获得15%技能吸血。优先前排(70/15/15)"},
    # ===== 龙族 =====
    "hlyl": {"cd": 7, "dmg": [0.35],
             "desc": "对1名敌人造成每秒攻击×35%魔法伤害，持续7s"},
    "bsxl": {"cd": 10, "dmg": [0.6],
             "desc": "随机1排敌人: 降40%攻速+每秒攻击×60%魔法伤害4s；每2次发动，下次降攻速变为[冰冻]"},
    "xyfl": {"cd": 9, "dmg": [2.4],
             "desc": "随机4名敌人受到攻击×240%物理，并随机打乱它们之间的位置"},
    "hbfl": {"cd": 10, "heal": 0.7,
             "desc": "冰封<75%HP龙族4s（免疫物理，被冰封无法行动），每秒提供攻击×70%+最大HP×3%治疗"},
    "bjl": {"cd": 9, "dmg": [2.0, 2.4],
            "desc": "中后排各1名: 第1个200%物伤+30%降攻速4s，第2个240%物伤"},
    "xcl": {"cd": 11, "dmg": [1.7], "dur": [3, 3],
            "desc": "2×2随机格子上的敌人受到攻击×170%魔法，并各有20%沉默/20%缴械3s"},
    "lyz": {"cd": 10,
            "desc": "治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每4次后下次升级，若有阵亡龙族随机复活1只并无敌5s"},
    "dl": {"cd": 11, "dmg": [1.5],
           "talent": "粗暴龙皮: 受到普攻随机发动①攻击者受自身攻击×12%纯粹 ②该次伤害-30%",
           "desc": "敌方全体攻击×150%物理（前排130%/中排100%/后排70%），并降低20%命中率5s"},
    # ===== 圣职者 =====
    "fz": {"cd": 5, "dmg": [0.8],
           "talent": "每次攻击随机2选1: ①伤害降低20%变纯粹 ②对目标叠1层符咒印记(直到自身阵亡或目标移动/阵亡)",
           "desc": "对1名敌人造成攻击×80%魔法伤害，目标每层符咒印记+8%伤害"},
    "qm": {"cd": 8, "dmg": [1.05],
           "talent": "受到异常状态后提升6%攻与20%防，持续12s（最多5层）",
           "desc": "敌方随机2×2范围: 攻击×105%魔法，目标有增益状态→伤害变纯粹"},
    "sq": {"cd": 12, "heal": 1.2,
           "talent": "自身不会陷入[沉默]/[破坏]/[缴械]/[诅咒]状态",
           "desc": "我方2名圣职者恢复攻击×120%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s"},
    "qd": {"cd": 9, "cast": 3,
           "talent": "我方所有角色每次技能后，对敌方随机1名造成攻击×3%纯粹，并治疗我方随机1名攻击×3%",
           "desc": "施法3s后随机祈祷: 大成功(自身无敌+每秒2%最大HP×5s)/成功(自身减伤40%+每秒1%×5s)/一般(自身减伤20%×5s)/失败(自损10%最大HP)"},
    "sqz": {"cd": 5, "dmg": [0.7],
            "desc": "对敌方后排1名造成3次攻击，每次攻击×70%（后排无人→中前排）"},
    "zq": {"cd": 8, "dmg": [1.8],
           "desc": "对敌方随机1排造成攻击×180%魔法伤害，并灼烧4s"},
    "sc": {"cd": 11,
           "talent": "敌方场上每存在1名拥有增益状态的单位，自身获得6%伤害减免",
           "desc": "对最近9s累计伤害最高敌人: 沉默+每秒自身攻击×35%纯粹持续4s；目标有增益则用目标攻击力计算，效果结束后清除其全部增益"},
    "xd": {"cd": 8,
           "talent": "每当友方角色阵亡，给予敌方全体自身攻击×90%纯粹，我方剩余单位恢复最大生命×8%",
           "desc": "使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续5s；自身阵亡后仍可发动，冷却+50%"},
}

# ---------------------------------------------------------------- 引擎层
# (相对 src/ 的文件, 精确原文, 新文, 说明)
ENGINE: list[tuple[str, str, str, str]] = [
    # --- V3.3 授权属性变更（保持 1 级 base 不变，同步 Lv100 值）---
    ("data/characters.ts", "hp: 10850,", "hp: 9365, // v3.3 成长-15%: 950+85×99", "swxz.hp"),
    ("data/characters.ts", "growth: { hp: 100, attack: 7.5, physicalDef: 3, magicalDef: 3.2 },",
     "growth: { hp: 85, attack: 7.5, physicalDef: 3, magicalDef: 3.2 }, // v3.3 100→85", "swxz.growth"),
    ("data/characters.ts", "attack: 1246.4,", "attack: 1147.4, // v3.3 成长 8→7: 454.4+7×99", "xd.attack"),
    ("data/characters.ts", "growth: { hp: 60, attack: 8.0, physicalDef: 1.5, magicalDef: 1.5 },",
     "growth: { hp: 60, attack: 7.0, physicalDef: 1.5, magicalDef: 1.5 }, // v3.3 8.0→7.0", "xd.growth"),
    # --- 兽族 ---
    ("engine/battle.ts", "const roarPct = 0.5 + hlLv * 0.0015;", "const roarPct = 0.3; // v3.3 怒吼 -30%", "hl 怒吼降攻"),
    ("engine/battle.ts", "const roarDur = 6 + hlLv * 0.03;", "const roarDur = 5; // v3.3 前5s -30%，之后 -15% 再8s", "hl 怒吼时长"),
    ("engine/battle.ts", "e._hlRoarExpire = state.time + roarDur;", "e._hlRoarExpire = state.time + roarDur;\n        e._hlRoarStage2 = true; // v3.3 到期后转 -15% 持续8s", "hl 怒吼阶段标记"),
    ("engine/battle.ts", "b.cooldownRemaining = Math.max(0, b.cooldownRemaining * 0.82);", "b.cooldownRemaining = Math.max(0, b.cooldownRemaining * 0.88); // v3.3 独行马 CD-12%", "dxm CD"),
    ("engine/battle.ts", "atkRatio *= 2.1; // v3.1: 2.0→2.1", "atkRatio *= 2.4; // v3.3 潜行 240%", "yl 潜行倍率"),
    ("engine/battle.ts", "const ls = Math.floor(result.finalDamage * 0.5);", "const ls = Math.floor(result.finalDamage * 0.5); // v3.3 潜行吸血 50%", "yl 吸血(注释)"),
    # --- 战士 ---
    ("engine/battle.ts", "unit._kzsAtkMult = 1 + want * 0.04;", "unit._kzsAtkMult = 1 + want * 0.035; // v3.3 3%+Lv×0.05%", "kzs 攻"),
    ("engine/battle.ts", "unit._kzsDr = want * 0.06;", "unit._kzsDr = want * 0.08; // v3.3 每层8%减伤", "kzs 减伤"),
    ("engine/battle.ts", "const dmg = Math.floor(unit.currentAttack * 0.04); // v2.10 文档值: 1.5%+等级×0.02% (Lv100=3.5%)", "const dmg = Math.floor(unit.currentAttack * 0.035); // v3.3 Lv100=3.5%", "crzs 同阵型 DoT"),
    ("engine/battle.ts", "const backfire = Math.floor(result.finalDamage * 0.15);", "const backfire = Math.floor(result.finalDamage * 0.1); // v3.3 自受10%反伤", "crzs 反伤"),
    # --- 亡灵 / 龙族 / 圣职者 ---
    ("engine/SkillRegistry.ts", "topDmg._healReduction = 0.5;", "topDmg._healReduction = 0.75; // v3.3 减疗75%", "mrsz 减疗"),
    ("engine/SkillRegistry.ts", "const dmg = Math.floor(caster.currentAttack * 1.1); // v2.13b 削弱: 135%→110%", "const dmg = Math.floor(caster.currentAttack * 1.2); // v3.3 120%纯粹", "yammxz 倍率"),
    ("engine/SkillRegistry.ts", "const shieldVal = Math.floor(caster.currentAttack * 0.9 * stacks);", "const shieldVal = Math.floor(caster.currentAttack * 0.8 * stacks); // v3.3 80%×层", "hyz 护盾"),
    ("engine/SkillRegistry.ts", "const shieldVal", "const shieldVal", "hyz 护盾锚点占位"),
    ("engine/SkillRegistry.ts", "const perTick = Math.floor(target.currentAttack * 0.12 + target.maxHp * 0.03); // v3.15c: 6%+2%→12%+3%", "const perTick = Math.floor(caster.currentAttack * 0.06 + target.maxHp * 0.01); // v3.3 自身攻6%+目标最大HP1%", "swxz 每跳"),
    ("engine/battle.ts", "const ls = Math.floor(dmg * 0.25);", "const ls = Math.floor(dmg * 0.15); // v3.3 技能吸血15%", "swxz 吸血"),
    ("engine/SkillRegistry.ts", "const stealAtk = Math.floor(target.currentAttack * 0.3); // v2.13c 加强: 25%→30%", "const stealAtk = Math.floor(target.currentAttack * 0.2); // v3.3 夺取20%", "jdds 夺取"),
    ("engine/SkillRegistry.ts", "t._slowPct = 0.2;", "t._slowPct = 0.4; // v3.3 降攻速40%", "bsxl 降攻速"),
    ("engine/SkillRegistry.ts", "const ratio = baseRatio * (1 + stacks * 0.1);", "const ratio = baseRatio * (1 + stacks * 0.08); // v3.3 每层+8%", "fz 印记"),
    ("engine/SkillRegistry.ts", "top.statuses.push({ type: \"sc_judge_dot\" as any, remainingSeconds: 5, stacks: 1, value: Math.floor(atk * 0.3), sourceId: caster.id });", "top.statuses.push({ type: \"sc_judge_dot\" as any, remainingSeconds: 4, stacks: 1, value: Math.floor(atk * 0.35), sourceId: caster.id }); // v3.3 35%×4s", "sc DoT"),
    ("engine/battle.ts", "unit._scDr = buffed * 0.05;", "unit._scDr = buffed * 0.06; // v3.3 每个增益单位+6%", "sc 天赋"),
    ("engine/battle.ts", "const dr = Math.floor(u.currentAttack * 1.5); // v3.9: 180→150%", "const dr = Math.floor(u.currentAttack * 0.9); // v3.3 90%纯粹", "xd 天赋伤害"),
    ("engine/battle.ts", "a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * 0.3));", "a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * 0.08)); // v3.3 恢复8%", "xd 天赋治疗"),
    ("engine/battle.ts", "const reflect = Math.floor(target.currentAttack * 0.1);", "const reflect = Math.floor(target.currentAttack * 0.12); // v3.3 地龙反伤12%", "dl 反伤"),
    ("engine/battle.ts", "result.finalDamage = Math.floor(result.finalDamage * 0.6); // v3.0 ❷减伤40%分支", "result.finalDamage = Math.floor(result.finalDamage * 0.7); // v3.3 ❷该次伤害-30%", "dl 减伤"),
    ("engine/battle.ts", "const absorbed = Math.floor(Math.min(result.finalDamage * 0.6, t.currentAttack * 6));", "const absorbed = Math.floor(Math.min(result.finalDamage * 0.6, t.currentAttack * 6)); // v3.3 护盾 600%攻击", "ldshz 护盾(注释)"),
    ("engine/damage.ts", "effectiveAtk *= 1 + attacker._qmLayers * 0.1;", "effectiveAtk *= 1 + attacker._qmLayers * 0.06; // v3.3 每层+6%攻", "qm 天赋"),
    ("engine/battle.ts", "const hpBonus = Math.floor(srm.maxHp * 0.1);", "const hpBonus = Math.floor(srm.maxHp * 0.12); // v3.3 +12%最大HP", "srm 天赋"),
    ("engine/battle.ts", "const rebound = Math.floor(killer.currentAttack * 0.2); // v3.0: 30→20%", "const rebound = Math.floor(killer.currentAttack * 0.1); // v3.3 反冲10%", "jdds 反冲"),
    ("engine/battle.ts", "const blood = Math.floor(target.currentHp * 0.05); // v2.42: 6→5%", "const blood = Math.floor(target.currentHp * 0.05); // v3.3 当前HP5%纯粹", "kzs 嗜血(注释)"),
]

# ---------------------------------------------------------------- 执行
failures: list[str] = []
changes: list[str] = []


def sub_once(text: str, pattern: str, repl: str, label: str, flags=0) -> str:
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        failures.append(f"[{label}] 锚点未命中或多次命中 (n={n}): {pattern[:70]}")
        return text
    changes.append(label)
    return out


def replace_indexed(text: str, pattern: str, values: list, label: str, flags=0) -> str:
    """按出现顺序替换前 N 个匹配（倒序写入，避免偏移失效）"""
    hits = list(re.finditer(pattern, text, flags))
    if len(hits) < len(values):
        failures.append(f"[{label}] 需要 {len(values)} 个锚点，实际 {len(hits)} 个")
        return text
    for i in range(len(values) - 1, -1, -1):
        mm = hits[i]
        # 只替换匹配末尾的数字，保留 "atkRatio: " / "duration: " 等字段名
        new = re.sub(r"[\d.]+$", str(values[i]), mm.group(0))
        text = text[:mm.start()] + new + text[mm.end():]
        changes.append(f"{label}[{i}]")
    return text


def apply_char_blocks(text: str) -> str:
    starts = list(re.finditer(r"^const (\w+): CharacterDef = \{", text, re.M))
    # 倒序处理：后面的块先改，前面块的绝对偏移保持稳定
    for idx in range(len(starts) - 1, -1, -1):
        m = starts[idx]
        cid = m.group(1)
        if cid not in CHARS:
            continue
        begin = m.start()
        end = starts[idx + 1].start() if idx + 1 < len(starts) else len(text)
        seg, spec = text[begin:end], CHARS[cid]
        if "cd" in spec:
            seg = sub_once(seg, r"cooldown:\s*[\d.]+", f"cooldown: {spec['cd']}", f"{cid}.cd")
        if "cast" in spec:
            seg = sub_once(seg, r"castTime:\s*[\d.]+", f"castTime: {spec['cast']}", f"{cid}.cast")
        if spec.get("dmg"):
            seg = replace_indexed(seg, r"atkRatio:\s*[\d.]+", spec["dmg"], f"{cid}.dmg")
        if "heal" in spec:
            seg = sub_once(seg, r"(heal:\s*\{[^}]*?atkRatio:\s*)[\d.]+",
                           lambda mm: f"{mm.group(1)}{spec['heal']}", f"{cid}.heal", re.S)
        if spec.get("dur"):
            seg = replace_indexed(seg, r"duration:\s*[\d.]+", spec["dur"], f"{cid}.dur")
        for key in ("desc", "talent"):
            if key in spec:
                field = "description" if key == "desc" else "talent"
                seg = sub_once(seg, rf'{field}:\s*\n?\s*"[^"]*"',
                               f'{field}: "{spec[key]}"', f"{cid}.{key}")
        text = text[:begin] + seg + text[end:]
    return text


def main():
    contents: dict[str, str] = {}
    for rel in ["data/characters.ts", "engine/battle.ts", "engine/SkillRegistry.ts", "engine/damage.ts"]:
        contents[rel] = (SRC / rel).read_text(encoding="utf-8")

    contents["data/characters.ts"] = apply_char_blocks(contents["data/characters.ts"])

    for rel, old, new, label in ENGINE:
        if old == new:
            continue
        cur = contents[rel]
        # 幂等：新值已在（上次已应用）则跳过，避免注释型替换重复累积
        if cur.count(new) >= 1:
            changes.append(f"{label} (已应用)")
            continue
        n = cur.count(old)
        if n != 1:
            failures.append(f"[{label}] {rel} 锚点命中 {n} 次: {old[:70]}")
            continue
        contents[rel] = cur.replace(old, new, 1)
        changes.append(label)

    print(f"成功: {len(changes)} 条 | 失败: {len(failures)} 条")
    for f in failures:
        print("  ✗", f)
    if failures:
        print("存在失败锚点 → 未写入任何文件（原子性保护）")
        return 1
    if DRY:
        print("--dry-run: 未写入")
        return 0
    for rel, txt in contents.items():
        (SRC / rel).write_text(txt, encoding="utf-8")
    print("已写入:", ", ".join(contents))
    return 0


if __name__ == "__main__":
    sys.exit(main())
