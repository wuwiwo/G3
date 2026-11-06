# -*- coding: utf-8 -*-
"""V3.4 R19: 用户裁定 6 口径 + R18 三项 逐条实装脚本.

用法:
  python v34_r19.py --dry-run                 # 全部步骤 dry-run
  python v34_r19.py --step T1 [--dry-run]    # 单步
  python v34_r19.py --step ALL               # 默认

约定: dry-run / 幂等 marker / 原子回滚 / 跨步 CACHE / CRLF 精确适配.
设计源: docs/V3.4平衡性调整.md 第 10 节（引擎不得先于设计源改动）.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENGINE = os.path.join(ROOT, "slg-battle")
DOCS = os.path.join(ROOT, "docs")

CACHE = {}          # 跨步骤共享，支持依赖前一步产物的锚点
DRY = "--dry-run" in sys.argv
STEP = "ALL"
if "--step" in sys.argv:
    STEP = sys.argv[sys.argv.index("--step") + 1]

ORDER = ["T1", "T2", "T3", "T4", "DOCS"]


def R(old, new, count=1, marker=None):
    return {"old": old, "new": new, "count": count, "marker": marker}


def read_bytes(path):
    with open(path, "rb") as f:
        return f.read().decode("utf-8")


def write_bytes(path, content):
    with open(path, "wb") as f:
        f.write(content.encode("utf-8"))


def adapt(s, content):
    """把补丁里的 \n 换成文件真实换行符."""
    nl = "\r\n" if "\r\n" in content else "\n"
    return s.replace("\n", nl)


STEPS = {}

# ---------------------------------------------------------------- T1: R13 交替链 + 灵弦 DoT 补齐
STEPS["T1"] = {
    os.path.join(ENGINE, "src", "engine", "battle.ts"): [
        R(
            """      lxgzEnhanced = (caster as any)._lxgzEnhanceNext === true;
      (caster as any)._lxgzEnhanceNext = true;
""",
            """      lxgzEnhanced = (caster as any)._lxgzEnhanceNext === true;
      // v3.4 R19: 用户裁定「普通 / 增强交替」——增强那次不再向下传递
      (caster as any)._lxgzEnhanceNext = !lxgzEnhanced;
""",
            marker="// v3.4 R19: 用户裁定「普通 / 增强交替」",
        ),
        R(
            """      // v3.14 灵弦歌者持续治疗: 每秒20%自身攻击+10%目标攻击（每秒结算一次）
      if ((s.type as string) === "lxgz_heal_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const heal = Math.floor(
            (s.value + (unit.currentAttack || unit.def.stats.attack) * 0.1) *
              ((s as any).healMult || 1)
          ); // v3.4 R13: 增强发动每秒治疗 ×1.5
""",
            """      // v3.4 R19 灵弦歌者持续治疗: 每秒自身攻×25%+目标攻×20%（每秒结算一次）
      if ((s.type as string) === "lxgz_heal_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const heal = Math.floor(
            (s.value + (unit.currentAttack || unit.def.stats.attack) * 0.2) *
              ((s as any).healMult || 1)
          ); // v3.4 R13: 增强发动每秒治疗 ×1.5
""",
            marker="// v3.4 R19 灵弦歌者持续治疗: 每秒自身攻×25%+目标攻×20%",
        ),
        R(
            """      // v3.4 R13 灵弦歌者: 每秒恢复7s (20%自身攻击+10%目标攻击) + 15%减伤6s；增强发动治疗×1.5/减伤22.5%
      if (sk.id === "lxgz_heal") {
        t.statuses.push({
          type: "lxgz_heal_dot" as any,
          remainingSeconds: 7,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.2),
          sourceId: caster.id,
          healMult: lxgzHealMult,
        } as any);
        (t as any)._lxgzDrUntil = state.time + 6;
        (t as any)._lxgzDrPct = lxgzDrPct;
        log.push({
          time: state.time,
          text: `🎶 ${caster.def.name} 治愈琴音 ${t.def.name}: 每秒20%+目标攻10%×7s + ${Math.round(lxgzDrPct * 100)}%减伤6s${lxgzEnhanced ? "（增强）" : ""}`,
          type: "heal",
        });
        continue;
      }
""",
            """      // v3.4 R19: 补齐描述口径 每秒自身攻×25%+目标攻×20% / 6s + 15%减伤6s；增强发动治疗×1.5/减伤22.5%
      if (sk.id === "lxgz_heal") {
        t.statuses.push({
          type: "lxgz_heal_dot" as any,
          remainingSeconds: 6,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.25),
          sourceId: caster.id,
          healMult: lxgzHealMult,
        } as any);
        (t as any)._lxgzDrUntil = state.time + 6;
        (t as any)._lxgzDrPct = lxgzDrPct;
        log.push({
          time: state.time,
          text: `🎶 ${caster.def.name} 治愈琴音 ${t.def.name}: 每秒25%+目标攻20%×6s + ${Math.round(lxgzDrPct * 100)}%减伤6s${lxgzEnhanced ? "（增强）" : ""}`,
          type: "heal",
        });
        continue;
      }
""",
            marker="// v3.4 R19: 补齐描述口径 每秒自身攻×25%+目标攻×20% / 6s",
        ),
    ],
    os.path.join(ENGINE, "src", "data", "characters.ts"): [
        R(
            "    heal: { atkRatio: 0.25, targetAtkRatio: 0.15 },",
            "    heal: { atkRatio: 0.25, targetAtkRatio: 0.2 }, // v3.4 R19: 补齐描述口径 目标攻×20%",
            marker="// v3.4 R19: 补齐描述口径 目标攻×20%",
        ),
    ],
}

# ---------------------------------------------------------------- T2: R14 链接天赋效果 + 到期回滚
STEPS["T2"] = {
    os.path.join(ENGINE, "src", "engine", "SkillRegistry.ts"): [
        R(
            """    target.skillPower = (target.skillPower || 1) + 0.3;
    target.lifeSteal = (target.lifeSteal || 0) + 0.3; // v3.4 R14: 天赋效果 20%→30%（仅被链接友方）
    // v3.4 R14 链接伤害承担: 目标受伤25%转移给小精灵（deferDamage 实现，40%→25%）
    target._linkOwnerId = caster.id;
    target._linkUntil = state.time + 8;
    log.push({
      time: state.time,
      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30% 天赋效果+30%`,
      type: "status",
    });
""",
            """    target.skillPower = (target.skillPower || 1) + 0.3;
    (target as any)._xjlSkillPowerBonus = 0.3; // v3.4 R19: 记录增量，链接到期精确回滚
    // v3.4 R19: 删除 lifeSteal 近似；被链接友方获得小精灵天赋 30% 效果
    (target as any)._xjlTalentShare = 0.3;
    // v3.4 R14 链接伤害承担: 目标受伤25%转移给小精灵（deferDamage 实现，40%→25%）
    target._linkOwnerId = caster.id;
    target._linkUntil = state.time + 8;
    log.push({
      time: state.time,
      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30% 小精灵天赋30%效果`,
      type: "status",
    });
""",
            marker="// v3.4 R19: 删除 lifeSteal 近似；被链接友方获得小精灵天赋 30% 效果",
        ),
        # R19-5 功能验证暴露：链接未到期时被刷新会再次 += 0.3，到期只回滚一次 →
        # skillPower 累积到 1.6/1.9/2.2/2.5。刷新时先回滚旧增量，保证恒为 +30%。
        R(
            """    target.skillPower = (target.skillPower || 1) + 0.3;
    (target as any)._xjlSkillPowerBonus = 0.3; // v3.4 R19: 记录增量，链接到期精确回滚
""",
            """    // v3.4 R19-5: 链接刷新时先回滚旧增量，避免 skillPower 反复叠加（到期只回滚一次会残留）
    const prevBonus = (target as any)._xjlSkillPowerBonus || 0;
    if (prevBonus > 0) {
      target.skillPower = Math.max(1, (target.skillPower || 1) - prevBonus);
    }
    target.skillPower = (target.skillPower || 1) + 0.3;
    (target as any)._xjlSkillPowerBonus = 0.3; // v3.4 R19: 记录增量，链接到期精确回滚
""",
            marker="// v3.4 R19-5: 链接刷新时先回滚旧增量",
        ),
    ],
    os.path.join(ENGINE, "src", "engine", "battle.ts"): [
        R(
            """    // v2.12 小精灵链接过期
    if (unit._linkUntil && state.time >= unit._linkUntil) {
      unit._linkOwnerId = undefined;
      unit._linkUntil = undefined;
    }
""",
            """    // v2.12 小精灵链接过期（v3.4 R19: 回滚 +30% 技能增强与小精灵天赋效果）
    if (unit._linkUntil && state.time >= unit._linkUntil) {
      unit.skillPower = Math.max(
        1,
        (unit.skillPower || 1) - ((unit as any)._xjlSkillPowerBonus || 0.3)
      );
      (unit as any)._xjlSkillPowerBonus = undefined;
      (unit as any)._xjlTalentShare = undefined;
      unit._linkOwnerId = undefined;
      unit._linkUntil = undefined;
    }
""",
            marker="// v2.12 小精灵链接过期（v3.4 R19: 回滚 +30% 技能增强与小精灵天赋效果）",
        ),
        R(
            """    // v3.4 R14 小精灵天赋: 每秒恢复 1.5% 最大HP（与技能伤害回血窗口独立）
    const xjlRegenCycle = Math.floor(state.time);
    if (
      unit.def.id === "xjl" &&
      !isRuined(unit) &&
      (unit as any)._xjlRegenCycle !== xjlRegenCycle
    ) {
      (unit as any)._xjlRegenCycle = xjlRegenCycle;
      const regen = Math.floor(unit.maxHp * 0.015);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      addStat(state, unit.id, "totalHealingReceived", regen);
    }
""",
            """    // v3.4 R19 小精灵天赋: 每秒恢复 1.5% 最大HP；被链接友方获得 30% 效果（0.45%）
    const xjlRegenCycle = Math.floor(state.time);
    const xjlRegenShare =
      unit.def.id === "xjl" ? 1 : (unit as any)._xjlTalentShare || 0;
    if (
      xjlRegenShare > 0 &&
      !isRuined(unit) &&
      (unit as any)._xjlRegenCycle !== xjlRegenCycle
    ) {
      (unit as any)._xjlRegenCycle = xjlRegenCycle;
      const regen = Math.floor(unit.maxHp * 0.015 * xjlRegenShare);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      addStat(state, unit.id, "totalHealingReceived", regen);
    }
""",
            marker="// v3.4 R19 小精灵天赋: 每秒恢复 1.5% 最大HP；被链接友方获得 30% 效果（0.45%）",
        ),
        R(
            """        // v3.4 R14 小精灵天赋: 我方技能造成伤害 → 回2%HP (每2s最多4%)
        for (const xjl of state.units.filter(
          (u: any) =>
            u.team === caster.team &&
            !u.isDead &&
            u.def.id === "xjl" &&
            !isRuined(u)
        )) {
          // v3.4 R14 按用户直发: 每次技能伤害回2%, 每2s窗口累计上限4%
          if (
            xjl._xjlWindowStart === undefined ||
            state.time - xjl._xjlWindowStart >= 2
          ) {
            xjl._xjlWindowStart = state.time;
            xjl._xjlWindowHeal = 0;
          }
          const cap = Math.floor(xjl.maxHp * 0.04);
          const want = Math.floor(xjl.maxHp * 0.02);
""",
            """        // v3.4 R19 小精灵天赋: 我方技能造成伤害 → 回2%HP (每2s最多4%)；被链接友方获得 30% 效果
        for (const xjl of state.units.filter(
          (u: any) =>
            u.team === caster.team &&
            !u.isDead &&
            (u.def.id === "xjl" || (u as any)._xjlTalentShare) &&
            !isRuined(u)
        )) {
          const xjlShare =
            xjl.def.id === "xjl" ? 1 : (xjl as any)._xjlTalentShare || 0.3;
          // v3.4 R14 按用户直发: 每次技能伤害回2%, 每2s窗口累计上限4%（被链接方按 share 缩放）
          if (
            xjl._xjlWindowStart === undefined ||
            state.time - xjl._xjlWindowStart >= 2
          ) {
            xjl._xjlWindowStart = state.time;
            xjl._xjlWindowHeal = 0;
          }
          const cap = Math.floor(xjl.maxHp * 0.04 * xjlShare);
          const want = Math.floor(xjl.maxHp * 0.02 * xjlShare);
""",
            marker="// v3.4 R19 小精灵天赋: 我方技能造成伤害 → 回2%HP (每2s最多4%)；被链接友方获得 30% 效果",
        ),
    ],
}

# ---------------------------------------------------------------- T3: R18-1 holyDr 减伤实装
STEPS["T3"] = {
    os.path.join(ENGINE, "src", "engine", "damage.ts"): [
        R(
            """    // v3.0 祈祷者: 减伤
    let holyDr = 1;
    // v3.3 龙吟者: 20% 减伤 4s
    if (
      (defender as any)._lyzDrUntil &&
      (defender as any)._lyzDrUntil > nowOf(extraOpts)
    ) {
      holyDr *= 1 - ((defender as any)._lyzDr || 0.2);
    }
    if (
      defender._qdDrUntil &&
      defender._qdDrUntil > nowOf(extraOpts) &&
      defender._qdDrPct
    ) {
      holyDr *= 1 - defender._qdDrPct;
    }
    // v3.16 嚎叫巨牛激怒: 减伤35%
    if ((defender as any)._hlRageDrMult) {
      holyDr *= 1 - (defender as any)._hlRageDrMult;
    }
    // v3.16 美杜莎天赋: 受指向性技能减伤20%，累积3次后40%+石化施法者2s
    if (defender.def.id === "mds" && (extraOpts as any)?.isSkill === true) {
      // v3.16: 指向性技能触发
      const now = nowOf(extraOpts);
      defender._mdsHitCount = (defender._mdsHitCount || 0) + 1;
      defender._mdsHitUntil = now;
      const stacks = Math.min(3, defender._mdsHitCount);
      holyDr *= 1 - (stacks >= 3 ? 0.4 : 0.2);
      if (stacks >= 3 && defender._mdsPunished !== now) {
        defender._mdsPunished = now;
        attacker.statuses.push({
          type: StatusType.Petrify,
          remainingSeconds: 2,
          stacks: 1,
        });
      }
    }
    // v3.0 圣骑士圣之护盾: 魔伤-30% (物理分支不适用, 魔法分支在 calcDamage 外层处理)
    if (
      defender._sqShieldUntil &&
      defender._sqShieldUntil > nowOf(extraOpts) &&
      (type as any) === DamageType.Magical
    ) {
      // v3.3 修死代码
      holyDr *= 0.7;
    }
    // v3.0 驱魔者: 防+20%×层
    if (
      defender.def.id === "qm" &&
      defender._qmLayers &&
      defender._qmUntil &&
      defender._qmUntil > nowOf(extraOpts)
    ) {
      if (type === DamageType.Physical) def *= 1 + defender._qmLayers * 0.2;
      else if (type === DamageType.Magical) def *= 1 + defender._qmLayers * 0.2;
    }
    // v3.0 殉道祝福: 受到伤害-10%
    if (defender._xdBlessUntil && defender._xdBlessUntil > nowOf(extraOpts)) {
      holyDr *= 0.9;
    }
    // P1修复: 圣裁者减伤 (敌方每增益单位5%)
    if (defender.def.id === "sc" && defender._scDr) {
      holyDr *= 1 - defender._scDr;
    }
    result.afterOtherReduction *= holyDr;
""",
            """    // v3.0 驱魔者: 防+20%×层（防御加成，留在物理分支内；不属于减伤）
    if (
      defender.def.id === "qm" &&
      defender._qmLayers &&
      defender._qmUntil &&
      defender._qmUntil > nowOf(extraOpts)
    ) {
      if (type === DamageType.Physical) def *= 1 + defender._qmLayers * 0.2;
      else if (type === DamageType.Magical) def *= 1 + defender._qmLayers * 0.2;
    }
    // v3.4 R19: 原 holyDr 减伤块（死代码）已移到 otherReduction 通用区统一结算
""",
            marker="// v3.4 R19: 原 holyDr 减伤块（死代码）已移到 otherReduction 通用区统一结算",
        ),
        R(
            """  // --- Other reduction (e.g. Prophet's blessing -30%) ---
  let otherReduction = 1;
""",
            """  // --- v3.4 R19: holyDr 减伤链从物理分支死代码提升为通用减伤因子 ---
  let holyDr = 1;
  // v3.3 龙吟者: 20% 减伤 4s
  if (
    (defender as any)._lyzDrUntil &&
    (defender as any)._lyzDrUntil > nowOf(extraOpts)
  ) {
    holyDr *= 1 - ((defender as any)._lyzDr || 0.2);
  }
  // v3.0 祈祷者: 减伤
  if (
    defender._qdDrUntil &&
    defender._qdDrUntil > nowOf(extraOpts) &&
    defender._qdDrPct
  ) {
    holyDr *= 1 - defender._qdDrPct;
  }
  // v3.16 嚎叫巨牛激怒: 减伤35%
  if ((defender as any)._hlRageDrMult) {
    holyDr *= 1 - (defender as any)._hlRageDrMult;
  }
  // v3.16 美杜莎天赋: 受指向性技能减伤20%，累积3次后40%+石化施法者2s
  if (defender.def.id === "mds" && (extraOpts as any)?.isSkill === true) {
    const now = nowOf(extraOpts);
    defender._mdsHitCount = (defender._mdsHitCount || 0) + 1;
    defender._mdsHitUntil = now;
    const stacks = Math.min(3, defender._mdsHitCount);
    holyDr *= 1 - (stacks >= 3 ? 0.4 : 0.2);
    if (stacks >= 3 && defender._mdsPunished !== now) {
      defender._mdsPunished = now;
      attacker.statuses.push({
        type: StatusType.Petrify,
        remainingSeconds: 2,
        stacks: 1,
      });
    }
  }
  // v3.0 圣骑士圣之护盾: 魔伤-30%（v3.4 R19: 移到通用区后按真实伤害类型判断，原先在物理分支内恒不成立）
  if (
    defender._sqShieldUntil &&
    defender._sqShieldUntil > nowOf(extraOpts) &&
    type === DamageType.Magical
  ) {
    holyDr *= 0.7;
  }
  // v3.0 殉道祝福: 受到伤害-10%
  if (defender._xdBlessUntil && defender._xdBlessUntil > nowOf(extraOpts)) {
    holyDr *= 0.9;
  }
  // P1修复: 圣裁者减伤 (敌方每增益单位5%)
  if (defender.def.id === "sc" && defender._scDr) {
    holyDr *= 1 - defender._scDr;
  }

  // --- Other reduction (e.g. Prophet's blessing -30%) ---
  let otherReduction = 1;
""",
            marker="// --- v3.4 R19: holyDr 减伤链从物理分支死代码提升为通用减伤因子 ---",
        ),
        R(
            "  result.afterOtherReduction = result.afterFrontRow * otherReduction;",
            """  otherReduction *= holyDr; // v3.4 R19: 统一结算既有多源减伤
  result.afterOtherReduction = result.afterFrontRow * otherReduction;""",
            marker="otherReduction *= holyDr; // v3.4 R19: 统一结算既有多源减伤",
        ),
    ],
}

# ---------------------------------------------------------------- T4: R18-3 猎人羁绊新值
STEPS["T4"] = {
    os.path.join(ENGINE, "src", "data", "races.ts"): [
        R(
            '      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(35%伤害)",',
            '      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(30%伤害)", // v3.4 R19: 35→30%',
            marker="// v3.4 R19: 35→30%",
        ),
        R(
            """      special:
        "受到[切入]技能伤害-25%+自身+10%攻(最多3层/40s)+每5次攻击额外1目标(70%伤害)",
""",
            """      special:
        "受到[切入]技能伤害-25%+自身+10%攻(最多3层/20s)+每5次攻击额外1目标(60%伤害)", // v3.4 R19: 40s→20s / 70→60%
""",
            marker="// v3.4 R19: 40s→20s / 70→60%",
        ),
    ],
    os.path.join(ENGINE, "src", "engine", "battle.ts"): [
        R(
            "        const extraDmgRatio = hunterCnt >= 4 ? 0.7 : 0.35; // v3.4: 70%/35%",
            "        const extraDmgRatio = hunterCnt >= 4 ? 0.6 : 0.3; // v3.4 R19: 60%/30%",
            marker="// v3.4 R19: 60%/30%",
        ),
        R(
            "        // v3.3 猎人羁绊: 被 #切入 命中后自身 +5%/+10% 攻击（最多 3 层，25s/40s，每层独立计时）",
            "        // v3.4 R19 猎人羁绊: 被 #切入 命中后自身 +5%/+10% 攻击（最多 3 层，25s/20s，每层独立计时）",
            marker="// v3.4 R19 猎人羁绊: 被 #切入 命中后自身 +5%/+10% 攻击（最多 3 层，25s/20s",
        ),
        R(
            "          expire: state.time + (hunterCount2 >= 4 ? 40 : 25),",
            "          expire: state.time + (hunterCount2 >= 4 ? 20 : 25), // v3.4 R19: 4名 40s→20s",
            marker="// v3.4 R19: 4名 40s→20s",
        ),
    ],
}

# ---------------------------------------------------------------- DOCS: v3.0.md 同步
STEPS["DOCS"] = {
    os.path.join(DOCS, "v3.0.md"): [
        R(
            "* 3 名:我方全部猎人攻击速度+15%，命中率+20%，受到带有[切入]标签的技能伤害-15%，猎人每攻击 6次，下次攻击额外对1个目标攻击（35%伤害）（每个猎人独立计算次数）",
            "* 3 名:我方全部猎人攻击速度+15%，命中率+20%，受到带有[切入]标签的技能伤害-15%，猎人每攻击 6次，下次攻击额外对1个目标攻击（30%伤害）（每个猎人独立计算次数）",
            marker="（30%伤害）（每个猎人独立计算次数）",
        ),
        R(
            "* 4 名:我方全部猎人攻击速度+30%,命中率+40%，受到带有[切入]标签的技能伤害-25%，且提升自身10%攻击力（最多叠加3层），持续40s，猎人每攻击 5次，下次攻击额外对1个目标攻击（70%伤害）（每个猎人独立计算次数）",
            "* 4 名:我方全部猎人攻击速度+30%,命中率+40%，受到带有[切入]标签的技能伤害-25%，且提升自身10%攻击力（最多叠加3层），持续20s，猎人每攻击 5次，下次攻击额外对1个目标攻击（60%伤害）（每个猎人独立计算次数）",
            marker="持续20s，猎人每攻击 5次",
        ),
    ],
}


def apply_step(name):
    edits = STEPS[name]
    snapshot = {p: CACHE.get(p, read_bytes(p)) for p in edits}
    failed = []

    for path, rules in edits.items():
        content = CACHE.get(path, read_bytes(path))
        for i, rule in enumerate(rules):
            old = adapt(rule["old"], content)
            new = adapt(rule["new"], content)
            marker = rule["marker"]
            cnt = rule["count"]
            tag = f"{os.path.basename(path)} #{i + 1}"

            if marker and marker in content:
                print(f"  SKIP {tag}  已应用（幂等）")
                continue
            found = content.count(old)
            if found == cnt:
                content = content.replace(old, new, cnt)
                print(f"  OK   {tag}  锚点×{found}")
            elif found == 0 and new in content:
                print(f"  SKIP {tag}  已应用（幂等）")
            else:
                print(f"  FAIL {tag}  锚点×{found}，期望×{cnt}")
                failed.append(tag)

        CACHE[path] = content

    if failed:
        for p, c in snapshot.items():
            CACHE[p] = c
        print(f"  [{name}] 原子回滚：{len(failed)} 处锚点失败")
        return False

    if not DRY:
        for p, c in CACHE.items():
            if p in edits:
                write_bytes(p, c)
    return True


def main():
    targets = ORDER if STEP == "ALL" else [STEP]
    print(f"V3.4 R19 补丁  DRY={DRY}  STEP={STEP}")
    ok = True
    for name in targets:
        if name not in STEPS:
            print(f"未知步骤: {name}")
            return 1
        print(f"[{name}]")
        if not apply_step(name):
            ok = False
            break
    print("全部步骤 DRY-RUN 通过" if (DRY and ok) else ("全部步骤应用完成" if ok else "存在失败步骤"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
