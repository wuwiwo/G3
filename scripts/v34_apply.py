#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""V3.4 小规模平衡 · 逐条补丁（用户直发数值，SKILL 第六节-6）。

用法:
  python scripts/v34_apply.py --step 1 --dry-run   # 只验锚点
  python scripts/v34_apply.py --step 1             # 实装第 1 条
  python scripts/v34_apply.py                     # 依次实装 1~4

每条独立、幂等、原子性：任一步任一锚点命中 != 1 且目标值也不存在时整条不写入。
设计源: ../docs/V3.4平衡性调整.md
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G3 = ROOT.parent
DRY = "--dry-run" in sys.argv
STEP = None
if "--step" in sys.argv:
    STEP = int(sys.argv[sys.argv.index("--step") + 1])

CH = ROOT / "src/data/characters.ts"
RC = ROOT / "src/data/races.ts"
DMG = ROOT / "src/engine/damage.ts"
BT = ROOT / "src/engine/battle.ts"
SR = ROOT / "src/engine/SkillRegistry.ts"
V30 = G3 / "docs/v3.0.md"

STEPS = {
    1: ("冰霜猎人", [
        (CH,
         '  talent: "造成伤害37.5%几率无视基础防御并降低目标50%受疗4s；自身受攻击时天赋暂失效1s（技能视为攻击，几率55%）", // v3.0,',
         '  talent: "造成伤害37.5%几率无视防御并降低目标25%受疗2s；自身受攻击时天赋暂失效1s（技能视为攻击，几率40%）", // v3.4'),
        (DMG,
         """    // v2.9 冰霜猎人天赋: 35%几率无视目标基础防御 (受击失效3s)
    if (attacker.def.id === "bslr" && attacker._bslrBreakUntil && attacker._bslrBreakUntil > nowOf(extraOpts)) {
      ignoreDef = 0;
    } else if (attacker.def.id === "bslr" && Math.random() < 0.35) {
      ignoreDef = 1;
    }
    // v3.0 冰霜猎人: 25%几率使目标受到治疗效果-60% 4s
    if (attacker.def.id === "bslr" && !(attacker._bslrBreakUntil && attacker._bslrBreakUntil > nowOf(extraOpts)) && Math.random() < 0.25) {
      defender._antiHealMult = 0.4;
      defender._antiHealUntil = nowOf(extraOpts) + 4;
    }""",
         """    // v3.4 冰霜猎人天赋: 37.5%几率无视防御 + 目标-25%受疗2s（同一次触发）；受击失效1s
    // 技能视为攻击按 40% 判定；DoT 每跳的受疗判定在 battle.ts 的 bslr_dot 结算处
    const bslrChance = (extraOpts as any)?.isSkill === true ? 0.4 : 0.375;
    const bslrActive = attacker.def.id === "bslr" && !(attacker._bslrBreakUntil && attacker._bslrBreakUntil > nowOf(extraOpts));
    if (attacker.def.id === "bslr" && !bslrActive) {
      ignoreDef = 0;
    } else if (bslrActive && Math.random() < bslrChance) {
      ignoreDef = 1;
      defender._antiHealMult = 0.75;
      defender._antiHealUntil = nowOf(extraOpts) + 2;
    }"""),
        (BT,
         "  // v2.9 冰霜猎人受击: 天赋失效3s\n  if (target.def.id === \"bslr\") {\n    target._bslrBreakUntil = state.time + 2; // v3.0: 3→2s\n  }",
         "  // v3.4 冰霜猎人受击: 天赋失效1s\n  if (target.def.id === \"bslr\") {\n    target._bslrBreakUntil = state.time + 1; // v3.4: 2→1s\n  }"),
        (BT,
         """      // v2.12 冰霜猎人持续射击 DoT: 每秒90%物理
      if ((s.type as string) === "bslr_dot" && s.value) {""",
         """      // v2.12 冰霜猎人持续射击 DoT: 每秒90%物理
      if ((s.type as string) === "bslr_dot" && s.value) {
        // v3.4 技能视为攻击: DoT 每跳按 40% 判定触发天赋的 -25%受疗2s
        const bslrSrc = state.units.find((x: any) => x.id === (s as any).sourceId && !x.isDead);
        if (bslrSrc?.def.id === "bslr" && !(bslrSrc._bslrBreakUntil && bslrSrc._bslrBreakUntil > state.time) && Math.random() < 0.4) {
          unit._antiHealMult = 0.75;
          unit._antiHealUntil = state.time + 2;
        }"""),
        (V30,
         "* 天赋: 造成伤害37.5%几率无视基础防御并降低目标50%受疗4s；自身受攻击时天赋暂失效1s（技能视为攻击，几率55%）",
         "* 天赋: 造成伤害37.5%几率无视防御并降低目标25%受疗2s；自身受攻击时天赋暂失效1s（技能视为攻击，几率40%）"),
    ]),
    2: ("风之斗士", [
        (CH,
         '    castTime: 2,\n    description: "1.8s内5次快速攻击，每次攻击目标随机，攻击×80%且无视基础防御", // v3.16 用户: 90→80, 1.8s\n    damage: [{ type: DamageType.Physical, atkRatio: 0.8 }],',
         '    castTime: 1.5,\n    description: "1.5s内5次快速攻击，每次攻击目标随机，攻击×65%且无视防御", // v3.4 用户直发\n    damage: [{ type: DamageType.Physical, atkRatio: 0.65 }],'),
        (SR,
         "// 风之斗士 — 疾风连击 (v2.12 按文档: 6次×60%无视基础防御, 目标随机)",
         "// 风之斗士 — 疾风连击 (v3.4 用户直发: 5次×65%, 无视防御, 目标随机)"),
        (SR,
         "  for (let i = 0; i < 6; i++) {\n    const t = enemies[Math.floor(Math.random() * enemies.length)];",
         "  for (let i = 0; i < 5; i++) {\n    const t = enemies[Math.floor(Math.random() * enemies.length)];"),
        (SR,
         "caster.def.skill.damage?.[0]?.atkRatio ?? 0.8, DamageType.Physical, { // v3.16: 读data 80%",
         "caster.def.skill.damage?.[0]?.atkRatio ?? 0.65, DamageType.Physical, { // v3.4: 读data 65%"),
        (SR,
         '(state as any).trackTalent(state, caster.id, "疾风连击(6连)", total, "damage");',
         '(state as any).trackTalent(state, caster.id, "疾风连击(5连)", total, "damage");'),
        (SR,
         "log.push({ time: state.time, text: `🌪 ${caster.def.name} 疾风连击: 6次攻击 总伤${total}`, type: \"damage\" });",
         "log.push({ time: state.time, text: `🌪 ${caster.def.name} 疾风连击: 5次攻击 总伤${total}`, type: \"damage\" });"),
        (V30,
         "* 技能: 1.8s内5次快速攻击，每次攻击目标随机，攻击×80%且无视基础防御 施法:2 s (冷却:6 s)",
         "* 技能: 1.5s内5次快速攻击，每次攻击目标随机，攻击×65%且无视防御 施法:1.5 s (冷却:6 s)"),
    ]),
    3: ("殉道者", [
        (CH,
         '    description: "使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续5s；自身阵亡后仍可发动，冷却+50%",',
         '    description: "使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续4s；自身阵亡后仍可发动，冷却+100%且无降伤效果，只造成50%伤害",'),
        (SR,
         "  // v3.3: 使敌方随机 1 名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续5s",
         "  // v3.4: 使敌方随机 1 名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续4s"),
        (SR,
         """  t._xdDmgDownUntil = state.time + 5;
  t._xdDmgDown = 0.2;
  const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
  t.statuses.push({
    type: "xd_dot" as any, remainingSeconds: 5, stacks: 1,""",
         """  t._xdDmgDownUntil = state.time + 4;
  t._xdDmgDown = 0.2;
  const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
  t.statuses.push({
    type: "xd_dot" as any, remainingSeconds: 4, stacks: 1,"""),
        (SR,
         '每秒${Math.floor(defSum * 0.2)}纯粹×5s`, type: "control"',
         '每秒${Math.floor(defSum * 0.2)}纯粹×4s`, type: "control"'),
        (BT,
         "/** v3.3 殉道者: 自身阵亡后该技能依然能继续发动，但冷却时间延长 50% */",
         "/** v3.4 殉道者: 阵亡后仍可发动，冷却+100%，无降伤效果且只造成50%伤害 */"),
        (BT,
         "    xd._xdPostmortemCd = (xd.def.skill.cooldown || 8) * 1.5;",
         "    xd._xdPostmortemCd = (xd.def.skill.cooldown || 8) * 2;"),
        (BT,
         """    t._xdDmgDownUntil = state.time + 5;
    t._xdDmgDown = 0.2;
    const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
    t.statuses.push({
      type: "xd_dot" as any, remainingSeconds: 5, stacks: 1,
      value: Math.max(1, Math.floor(defSum * 0.2)), sourceId: xd.id,""",
         """    // v3.4: 阵亡后版本不施加降伤，DoT 只造成 50% 伤害
    const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
    t.statuses.push({
      type: "xd_dot" as any, remainingSeconds: 4, stacks: 1,
      value: Math.max(1, Math.floor(defSum * 0.2 * 0.5)), sourceId: xd.id,"""),
        (V30,
         "* 技能: #嘲讽 使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续5s；自身阵亡后仍可发动，冷却+50% (冷却:8 s)",
         "* 技能: #嘲讽 使敌方随机1名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续4s；自身阵亡后仍可发动，冷却+100%且无降伤效果，只造成50%伤害 (冷却:8 s)"),
    ]),
    4: ("猎人羁绊（按 V3.3 设计源补正）", [
        (RC,
         """    3: {
      attackBonus: 20,
      hitRateBonus: 15,
      special: "受到[切入]技能伤害-15%+自身+5%攻(最多3层/25s)+每4次攻击额外1目标(40%伤害)",
    },
    4: {
      attackBonus: 30,
      hitRateBonus: 30,
      special: "受到[切入]技能伤害-30%+自身+10%攻(最多3层/40s)+每3次攻击额外1目标(80%伤害)",
    },""",
         """    3: {
      attackBonus: 15,
      hitRateBonus: 20,
      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(35%伤害)",
    },
    4: {
      attackBonus: 30,
      hitRateBonus: 40,
      special: "受到[切入]技能伤害-25%+自身+10%攻(最多3层/40s)+每5次攻击额外1目标(70%伤害)",
    },"""),
        (BT,
         "        const extraEvery = hunterCnt >= 4 ? 3 : 4; // v3.3: 每攻击3/4次，下次攻击额外1目标\n        const extraDmgRatio = hunterCnt >= 4 ? 0.8 : 0.4; // v3.16f 回滚: 文档 80%/40%",
         "        const extraEvery = hunterCnt >= 4 ? 5 : 6; // v3.4: 按 V3.3 设计源 每5/6次\n        const extraDmgRatio = hunterCnt >= 4 ? 0.7 : 0.35; // v3.4: 70%/35%"),
        (BT,
         "      caster._cutinDmgRed = defenderHunterCnt >= 4 ? 0.7 : 0.85;",
         "      caster._cutinDmgRed = defenderHunterCnt >= 4 ? 0.75 : 0.85; // v3.4: -25%/-15%"),
        (BT,
         '${defenderHunterCnt >= 4 ? 30 : 15}%`, type: "status"',
         '${defenderHunterCnt >= 4 ? 25 : 15}%`, type: "status"'),
        (V30,
         "* 3 名:我方全部猎人攻击力+20%，命中率+15%，受到带有[切入]标签的技能伤害-15%，且提升自身5%攻击力（最多叠加3层），持续25s，猎人每攻击 4次，下次攻击额外对1个目标攻击（40%伤害）（每个猎人独立计算次数）",
         "* 3 名:我方全部猎人攻击力+15%，命中率+20%，受到带有[切入]标签的技能伤害-15%，猎人每攻击 6次，下次攻击额外对1个目标攻击（35%伤害）（每个猎人独立计算次数）"),
        (V30,
         "* 4 名:我方全部猎人攻击力+30%,命中率+30%，受到带有[切入]标签的技能伤害-30%，且提升自身10%攻击力（最多叠加3层），持续40s，猎人每攻击 3次，下次攻击额外对1个目标攻击（80%伤害）（每个猎人独立计算次数）",
         "* 4 名:我方全部猎人攻击力+30%,命中率+40%，受到带有[切入]标签的技能伤害-25%，且提升自身10%攻击力（最多叠加3层），持续40s，猎人每攻击 5次，下次攻击额外对1个目标攻击（70%伤害）（每个猎人独立计算次数）"),
    ]),
}


def read(p: Path) -> str:
    return p.read_bytes().decode("utf-8")


def apply(step: int) -> bool:
    name, patches = STEPS[step]
    print(f"\n--- Step {step}: {name} ---")
    cache: dict[Path, str] = {}
    for p, old, new in patches:
        if p not in cache:
            cache[p] = read(p)
        c = cache[p]
        # 本机文件可能是 CRLF；多行锚点需按文件实际换行转换，且不改变文件换行风格
        nl = "\r\n" if "\r\n" in c else "\n"
        o = old.replace("\n", nl) if nl != "\n" else old
        nw = new.replace("\n", nl) if nl != "\n" else new
        n = c.count(o)
        if n == 1:
            cache[p] = c.replace(o, nw, 1)
            print(f"  OK   {p.name}: {old[:52].replace(chr(10), ' ')}")
        elif n == 0 and c.count(nw) >= 1:
            print(f"  SKIP {p.name}: 已应用")
        else:
            print(f"  FAIL {p.name}: 锚点命中 {n} 次 :: {old[:70]}")
            return False
    if not DRY:
        for p, s in cache.items():
            p.write_bytes(s.encode("utf-8"))
        print(f"  WROTE {len(cache)} files")
    else:
        print("  [--dry-run] 锚点全部通过，未写入")
    return True


targets = [STEP] if STEP else list(STEPS.keys())
ok = True
for s in targets:
    if not apply(s):
        ok = False
        if not STEP:
            print(f"\n中止于 Step {s}，后续步骤未执行（原子性）。")
            break
sys.exit(0 if ok else 1)
