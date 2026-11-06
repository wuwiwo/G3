#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""V3.4 修订 R1~R4（用户 2026-11-06 直发）· 逐条补丁。

用法: python scripts/v34_revise.py --step R1 [--dry-run]
设计源: ../docs/V3.4平衡性调整.md 第 6 节
每条独立 / 幂等 / 原子 / 自动适配 CRLF。
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G3 = ROOT.parent
DRY = "--dry-run" in sys.argv
STEP = sys.argv[sys.argv.index("--step") + 1] if "--step" in sys.argv else None

CH = ROOT / "src/data/characters.ts"
RC = ROOT / "src/data/races.ts"
BT = ROOT / "src/engine/battle.ts"
DMG = ROOT / "src/engine/damage.ts"
SR = ROOT / "src/engine/SkillRegistry.ts"
TY = ROOT / "src/types/index.ts"
DE = ROOT / "src/components/DataEditor.tsx"
V30 = G3 / "docs/v3.0.md"

STEPS = {
    "R1": ("猎人羁绊只加攻击速度", [
        (RC, "  evasionBonus: number;\n  magicalDefBonus?: number;",
              "  evasionBonus: number;\n  attackSpeedBonus?: number; // v3.4 R1: 攻击速度加成（与 attackBonus 攻击力区分）\n  magicalDefBonus?: number;"),
        (RC, """  [Race.Hunter]: {
    2: { attackBonus: 10, hitRateBonus: 10 },
    3: {
      attackBonus: 15,
      hitRateBonus: 20,
      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(35%伤害)",
    },
    4: {
      attackBonus: 30,
      hitRateBonus: 40,
      special: "受到[切入]技能伤害-25%+自身+10%攻(最多3层/40s)+每5次攻击额外1目标(70%伤害)",
    },
  },""",
              """  [Race.Hunter]: {
    // v3.4 R1: 用户裁定「只增加攻击速度，不增加攻击力」
    2: { attackSpeedBonus: 10, hitRateBonus: 10 },
    3: {
      attackSpeedBonus: 15,
      hitRateBonus: 20,
      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(35%伤害)",
    },
    4: {
      attackSpeedBonus: 30,
      hitRateBonus: 40,
      special: "受到[切入]技能伤害-25%+自身+10%攻(最多3层/40s)+每5次攻击额外1目标(70%伤害)",
    },
  },"""),
        (RC, "    hitRateBonus: ov.hitRateBonus ?? tier.hitRateBonus ?? 0,\n    evasionBonus:",
              "    hitRateBonus: ov.hitRateBonus ?? tier.hitRateBonus ?? 0,\n    attackSpeedBonus: ov.attackSpeedBonus ?? tier.attackSpeedBonus ?? 0,\n    evasionBonus:"),
        (BT, "          if (effect.attackBonus) u.currentAttack *= bonus;",
              "          if (effect.attackBonus) u.currentAttack *= bonus;\n          // v3.4 R1: 攻速羁绊写入 attackSpeedBonus（现有公式 attackInterval*(1-bonus*0.5)）\n          if (effect.attackSpeedBonus)\n            u.attackSpeedBonus = (u.attackSpeedBonus || 0) + effect.attackSpeedBonus / 100;"),
        (BT, """          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻+${effect.attackBonus}%`,
              type: "system",
            });""",
              """          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻+${effect.attackBonus}%`,
              type: "system",
            });
          if (effect.attackSpeedBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻速+${effect.attackSpeedBonus}%`,
              type: "system",
            });"""),
        (DE, "            const atk = ov.attackBonus ?? eff4.attackBonus ?? 0;",
              "            const atk = ov.attackBonus ?? eff4.attackBonus ?? 0;\n            const spd = ov.attackSpeedBonus ?? eff4.attackSpeedBonus ?? 0;"),
        (DE, """                  2名: 攻+{tiers[2]?.attackBonus ?? 0}% 防+
                  {tiers[2]?.defenseBonus ?? 0}% HP+{tiers[2]?.hpBonus ?? 0}%
                  {" | "}3名: 攻+{tiers[3]?.attackBonus ?? 0}% 防+
                  {tiers[3]?.defenseBonus ?? 0}% HP+{tiers[3]?.hpBonus ?? 0}%
                  {" | "}4名: 攻+{tiers[4]?.attackBonus ?? 0}% 防+
                  {tiers[4]?.defenseBonus ?? 0}% HP+{tiers[4]?.hpBonus ?? 0}%""",
              """                  2名: 攻+{tiers[2]?.attackBonus ?? 0}% 攻速+{tiers[2]?.attackSpeedBonus ?? 0}% 防+
                  {tiers[2]?.defenseBonus ?? 0}% HP+{tiers[2]?.hpBonus ?? 0}%
                  {" | "}3名: 攻+{tiers[3]?.attackBonus ?? 0}% 攻速+{tiers[3]?.attackSpeedBonus ?? 0}% 防+
                  {tiers[3]?.defenseBonus ?? 0}% HP+{tiers[3]?.hpBonus ?? 0}%
                  {" | "}4名: 攻+{tiers[4]?.attackBonus ?? 0}% 攻速+{tiers[4]?.attackSpeedBonus ?? 0}% 防+
                  {tiers[4]?.defenseBonus ?? 0}% HP+{tiers[4]?.hpBonus ?? 0}%"""),
        (DE, """                  <LabeledInput
                    label="攻击+%(覆写)"
                    value={atk}
                    onChange={(v) => updateBond(race, { attackBonus: v })}
                  />""",
              """                  <LabeledInput
                    label="攻击+%(覆写)"
                    value={atk}
                    onChange={(v) => updateBond(race, { attackBonus: v })}
                  />
                  <LabeledInput
                    label="攻速+%(覆写)"
                    value={spd}
                    onChange={(v) => updateBond(race, { attackSpeedBonus: v })}
                  />"""),
        (V30, "* 2 名:我方全部猎人攻击力+10%，命中率+10% ",
              "* 2 名:我方全部猎人攻击速度+10%，命中率+10% "),
        (V30, "* 3 名:我方全部猎人攻击力+15%，命中率+20%",
              "* 3 名:我方全部猎人攻击速度+15%，命中率+20%"),
        (V30, "* 4 名:我方全部猎人攻击力+30%,命中率+40%",
              "* 4 名:我方全部猎人攻击速度+30%,命中率+40%"),
    ]),
    "R2": ("殉道者阵亡后只造成25%伤害", [
        (BT, "Math.max(1, Math.floor(defSum * 0.2 * 0.5)), sourceId: xd.id,",
              "Math.max(1, Math.floor(defSum * 0.2 * 0.25)), sourceId: xd.id, // v3.4 R2: 25%"),
        (CH, "冷却+100%且无降伤效果，只造成50%伤害",
              "冷却+100%且无降伤效果，只造成25%伤害"),
        (V30, "冷却+100%且无降伤效果，只造成50%伤害",
              "冷却+100%且无降伤效果，只造成25%伤害"),
    ]),
    "R3": ("虎啸虎袭 210-240%", [
        (BT, "        if (sk.id === \"hx_cut\") ratio = 2.3 + Math.random() * 0.3; // v3.8: 230-260%",
              "        if (sk.id === \"hx_cut\") ratio = 2.1 + Math.random() * 0.3; // v3.4 R3: 210-240%"),
        (CH, '    description: "对随机2名各造成220-260%伤害，优先后排", // v3.3: 210-240→225-255%\n    damage: [{ type: DamageType.Physical, atkRatio: 2.45 }], // P0: 特判2.3-2.6覆盖',
              '    description: "对随机2名各造成210-240%伤害，优先后排", // v3.4 R3 用户直发\n    damage: [{ type: DamageType.Physical, atkRatio: 2.25 }], // R3: 区间中值兜底，handler 覆盖'),
        (V30, "* 技能: 切入 对随机2名各造成220-260%伤害，优先后排 (冷却:5 s)",
              "* 技能: 切入 对随机2名各造成210-240%伤害，优先后排 (冷却:5 s)"),
    ]),
    "R4": ("基础防御/额外防御分层", [
        (TY, "  currentPhysicalDef: number;\n  currentMagicalDef: number;",
              "  currentPhysicalDef: number;\n  currentMagicalDef: number;\n  // v3.4 R4: 基础防御（角色面板值），额外防御 = current - base\n  basePhysicalDef?: number;\n  baseMagicalDef?: number;"),
        (BT, "    currentPhysicalDef: def.stats.physicalDef,\n    currentMagicalDef: def.stats.magicalDef,",
              "    currentPhysicalDef: def.stats.physicalDef,\n    currentMagicalDef: def.stats.magicalDef,\n    basePhysicalDef: def.stats.physicalDef,\n    baseMagicalDef: def.stats.magicalDef,"),
        (DMG, "    ignoreBaseDef?: boolean;\n    ignoreDefPct?: number; // 无视X%基础防御 (v2.3 猎人4人)",
              "    ignoreBaseDef?: boolean; // v3.4 R4: 只保留额外防御\n    ignoreExtraDef?: boolean; // v3.4 R4: 只保留基础防御\n    ignoreDefPct?: number; // 无视X%基础防御 (v2.3 猎人4人)"),
        (DMG, "  const result: DamageResult = {",
              "  // v3.4 R4: 无视额外防御标记（允许冰霜猎人天赋在内部按几率置位）\n  let ignoreExtraDef = (extraOpts as any)?.ignoreExtraDef === true;\n  const result: DamageResult = {"),
        (DMG, "  if (type === DamageType.Physical) {\n    let def = defender.currentPhysicalDef;",
              "  if (type === DamageType.Physical) {\n    let def = defender.currentPhysicalDef;\n    const baseDef = defender.basePhysicalDef ?? def;"),
        (DMG, """    if (extraOpts?.ignoreBaseDef) {
      def = 0; // Ignore all defense for counter-attack etc.
    }""",
              "    // v3.4 R4: 基础/额外防御分层在分支末尾统一处理（旧实现 def=0 已移除）"),
        (DMG, "    // v3.4 冰霜猎人天赋: 37.5%几率无视防御 + 目标-25%受疗2s（同一次触发）；受击失效1s",
              "    // v3.4 R4: 冰霜猎人天赋 37.5%几率无视【额外防御】 + 目标-25%受疗2s（同一次触发）；受击失效1s"),
        (DMG, "      ignoreDef = 1;\n      defender._antiHealMult = 0.75;",
              "      ignoreExtraDef = true; // 无视额外防御，保留基础防御\n      defender._antiHealMult = 0.75;"),
        (DMG, """    if (ignoreDef > 0) {
      def *= 1 - ignoreDef;
    }
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
    // v2.4: 物理伤害减伤 (亡灵4人 - 克物理流)""",
              """    // v3.4 R4: 基础防御 = basePart，额外防御 = extraPart
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
    else if (ignoreDef > 0) def = basePart * (1 - ignoreDef) + extraPart;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
    // v2.4: 物理伤害减伤 (亡灵4人 - 克物理流)"""),
        (DMG, "  } else if (type === DamageType.Magical) {\n    let def = defender.currentMagicalDef;",
              "  } else if (type === DamageType.Magical) {\n    let def = defender.currentMagicalDef;\n    const baseDef = defender.baseMagicalDef ?? def;"),
        (DMG, """    if (defender.statuses.some((s: any) => s.type === StatusType.Petrify))
      def *= 2;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else {""",
              """    if (defender.statuses.some((s: any) => s.type === StatusType.Petrify))
      def *= 2;
    // v3.4 R4: 魔法分支同样做基础/额外防御分层
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else {"""),
        (SR, "      ignoreBaseDef: true,\n    });", "      ignoreExtraDef: true, // v3.4 R4: 无视额外防御，保留基础防御\n    });"),
        (CH, '造成伤害37.5%几率无视防御并降低目标25%受疗2s',
              '造成伤害37.5%几率无视额外防御并降低目标25%受疗2s'),
        (CH, '攻击×65%且无视防御', '攻击×65%且无视额外防御'),
        (V30, "* 天赋: 造成伤害37.5%几率无视防御并降低目标25%受疗2s",
              "* 天赋: 造成伤害37.5%几率无视额外防御并降低目标25%受疗2s"),
        (V30, "攻击×65%且无视防御 施法:1.5 s", "攻击×65%且无视额外防御 施法:1.5 s"),
    ]),
}


def read(p: Path) -> str:
    return p.read_bytes().decode("utf-8")


def apply(name: str) -> bool:
    title, patches = STEPS[name]
    print(f"\n--- {name}: {title} ---")
    cache: dict[Path, str] = {}
    for p, old, new in patches:
        if p not in cache:
            cache[p] = read(p)
        c = cache[p]
        nl = "\r\n" if "\r\n" in c else "\n"
        o = old.replace("\n", nl) if nl != "\n" else old
        nw = new.replace("\n", nl) if nl != "\n" else new
        n = c.count(o)
        if n == 1:
            cache[p] = c.replace(o, nw, 1)
            print(f"  OK   {p.name}: {old[:56].replace(chr(10), ' ')}")
        elif n == 0 and c.count(nw) >= 1:
            print(f"  SKIP {p.name}: 已应用")
        else:
            print(f"  FAIL {p.name}: 命中 {n} 次 :: {old[:80]}")
            return False
    if not DRY:
        for p, s in cache.items():
            p.write_bytes(s.encode("utf-8"))
        print(f"  WROTE {len(cache)} files")
    else:
        print("  [--dry-run] 锚点全部通过，未写入")
    return True


targets = [STEP] if STEP else list(STEPS.keys())
for s in targets:
    if not apply(s):
        print(f"\n中止于 {s}（原子性，后续未执行）")
        sys.exit(1)
sys.exit(0)
