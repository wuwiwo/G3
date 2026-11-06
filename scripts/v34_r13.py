# -*- coding: utf-8 -*-
"""
v34_r13.py — V3.4 R13~R17（用户直发 5 角色）逐条实装脚本
设计源: docs/V3.4平衡性调整.md 第 9 节（先于本脚本写入）

用法:
  python v34_r13.py --dry-run                 # 只校验全部锚点，不写文件
  python v34_r13.py --step S1                # 只应用 S1（灵弦歌者）
  python v34_r13.py --step ALL               # 依次应用 S1..S5 + DOCS
  python v34_r13.py                          # 同 --step ALL

特性: 幂等（已应用则跳过）、原子（同一步任一锚点失败则整步不写）、逐条可单独 tsc。
"""
import sys
import os

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(BASE, '..', '..')
CHARS = os.path.join(PROJ, 'slg-battle', 'src', 'data', 'characters.ts')
SKILL = os.path.join(PROJ, 'slg-battle', 'src', 'engine', 'SkillRegistry.ts')
BATTLE = os.path.join(PROJ, 'slg-battle', 'src', 'engine', 'battle.ts')
DAMAGE = os.path.join(PROJ, 'slg-battle', 'src', 'engine', 'damage.ts')
V30 = os.path.join(PROJ, 'docs', 'v3.0.md')


def R(old, new, count=1, marker=None):
    # marker: 幂等判定用的唯一标记。跨步骤插入会打断 new 的连续性时用。
    return {'old': old, 'new': new, 'count': count, 'marker': marker}


STEPS = {}

# ==================== S1 灵弦歌者 治愈琴音 ====================
STEPS['S1'] = {
    CHARS: [
        R(
            '''    description:
      "弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20%", // v3.16 用户
''',
            '''    description:
      "弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20%；每次发动后，下次发动每秒治疗+50%、减伤效果+50%", // v3.4 R13 用户直发
''',
        ),
    ],
    BATTLE: [
        R(
            '''          const heal = Math.floor(
            s.value + (unit.currentAttack || unit.def.stats.attack) * 0.1
          );
''',
            '''          const heal = Math.floor(
            (s.value + (unit.currentAttack || unit.def.stats.attack) * 0.1) *
              ((s as any).healMult || 1)
          ); // v3.4 R13: 增强发动每秒治疗 ×1.5
''',
        ),
        R(
            '''  // --- Heal ---
  if (sk.heal) {
    let targets: ArenaUnit[] = [];
''',
            '''  // --- Heal ---
  if (sk.heal) {
    // v3.4 R13 灵弦歌者: 每次发动后，下次发动增强（每秒治疗×1.5 / 减伤效果×1.5）
    let lxgzEnhanced = false;
    let lxgzHealMult = 1;
    let lxgzDrPct = 0.15;
    if (sk.id === "lxgz_heal") {
      lxgzEnhanced = (caster as any)._lxgzEnhanceNext === true;
      (caster as any)._lxgzEnhanceNext = true;
      lxgzHealMult = lxgzEnhanced ? 1.5 : 1;
      lxgzDrPct = lxgzEnhanced ? 0.225 : 0.15;
    }
    let targets: ArenaUnit[] = [];
''',
        ),
        R(
            '''      // v3.14 灵弦歌者: 每秒恢复7s (20%自身攻击+10%目标攻击)
      if (sk.id === "lxgz_heal") {
        t.statuses.push({
          type: "lxgz_heal_dot" as any,
          remainingSeconds: 7,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.2),
          sourceId: caster.id,
        } as any);
        log.push({
          time: state.time,
          text: `🎶 ${caster.def.name} 治愈琴音 ${t.def.name}: 每秒20%+目标攻10%×7s`,
          type: "heal",
        });
        continue;
      }
''',
            '''      // v3.4 R13 灵弦歌者: 每秒恢复7s (20%自身攻击+10%目标攻击) + 15%减伤6s；增强发动治疗×1.5/减伤22.5%
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
''',
        ),
    ],
    DAMAGE: [
        R(
            '''  if (permDR > 0) {
    otherReduction *= 1 - permDR;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
''',
            '''  if (permDR > 0) {
    otherReduction *= 1 - permDR;
  }
  // v3.4 R13 灵弦歌者治愈琴音: 15% 减伤 6s（增强发动 22.5%）
  if (
    (defender as any)._lxgzDrUntil &&
    (defender as any)._lxgzDrUntil > nowOf(extraOpts) &&
    (defender as any)._lxgzDrPct
  ) {
    otherReduction *= 1 - (defender as any)._lxgzDrPct;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
''',
            marker='// v3.4 R13 灵弦歌者治愈琴音: 15% 减伤 6s（增强发动 22.5%）',
        ),
    ],
}

# ==================== S2 小精灵 ====================
STEPS['S2'] = {
    CHARS: [
        R(
            '''  talent:
    "每秒恢复1%最大HP；我方全场每次技能对敌造成伤害，自身恢复1%最大HP（每2s最多5%）",
''',
            '''  talent:
    "每秒恢复1.5%最大HP；我方全场每次技能对敌造成伤害，自身恢复2%最大HP（每2s最多4%）", // v3.4 R14
''',
        ),
        R(
            '''    description:
      "链接1名友方8s: +30%技能增强+双方天赋20%效果，自身代替友方承担25%伤害",
''',
            '''    description:
      "链接1名友方8s: +30%技能增强+被链接友方天赋30%效果，自身代替被链接的友方承担25%伤害", // v3.4 R14
''',
        ),
    ],
    SKILL: [
        R(
            '''    // v2.12 链接伤害承担: 目标受伤25%转移给小精灵 (描述值)
''',
            '''    // v3.4 R14 链接伤害承担: 目标受伤25%转移给小精灵（deferDamage 实现，40%→25%）
''',
        ),
        R(
            '''    target.lifeSteal = (target.lifeSteal || 0) + 0.2;
''',
            '''    target.lifeSteal = (target.lifeSteal || 0) + 0.3; // v3.4 R14: 天赋效果 20%→30%（仅被链接友方）
''',
        ),
        R(
            '''      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30%吸血+20%`,
''',
            '''      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30% 天赋效果+30%`,
''',
        ),
    ],
    BATTLE: [
        R(
            '''  // v2.12 小精灵链接: 目标受伤25%转移给小精灵承担
''',
            '''  // v3.4 R14 小精灵链接: 目标受伤25%转移给小精灵承担（用户直发值，覆盖 v3.16 的 40%）
''',
        ),
        R(
            '''      const share = Math.floor(dmg * 0.4); // v3.16: 25→40%
''',
            '''      const share = Math.floor(dmg * 0.25); // v3.4 R14: 40→25%
''',
        ),
        R(
            '''    // v2.12 龙吟者天赋: 离开前排每秒-3%最大生命
''',
            '''    // v3.4 R14 小精灵天赋: 每秒恢复 1.5% 最大HP（与技能伤害回血窗口独立）
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
    // v2.12 龙吟者天赋: 离开前排每秒-3%最大生命
''',
            marker='// v3.4 R14 小精灵天赋: 每秒恢复 1.5% 最大HP（与技能伤害回血窗口独立）',
        ),
        R(
            '''        // v2.9 小精灵天赋: 我方技能造成伤害 → 回1.5%HP (每3s最多6%)
''',
            '''        // v3.4 R14 小精灵天赋: 我方技能造成伤害 → 回2%HP (每2s最多4%)
''',
        ),
        R(
            '''          // v2.9 按文档: 每次技能伤害回1.5%, 每3s窗口累计上限6%
''',
            '''          // v3.4 R14 按用户直发: 每次技能伤害回2%, 每2s窗口累计上限4%
''',
        ),
        R(
            '''            state.time - xjl._xjlWindowStart >= 3
''',
            '''            state.time - xjl._xjlWindowStart >= 2
''',
        ),
        R(
            '''          const cap = Math.floor(xjl.maxHp * 0.06);
          const want = Math.floor(xjl.maxHp * 0.015);
''',
            '''          const cap = Math.floor(xjl.maxHp * 0.04);
          const want = Math.floor(xjl.maxHp * 0.02);
''',
        ),
    ],
}

# ==================== S3 亡灵歌咏者 ====================
STEPS['S3'] = {
    CHARS: [
        R(
            '''    description: "施法2s，恢复随机2名友方攻击×160%生命，并诅咒随机1名敌方5s",
''',
            '''    description:
      "施法2s，优先恢复前排2名友方攻击×160%生命，并诅咒随机1名敌方5s；每发动2次后，下次发动冷却-60%", // v3.4 R15
''',
        ),
    ],
    BATTLE: [
        R(
            '''    } else if (sk.id === "wlgyz_heal") {
      targets = shuffle(allies).slice(0, 2);
''',
            '''    } else if (sk.id === "wlgyz_heal") {
      // v3.4 R15: 优先前排（按 HP% 升序），不足 2 名再按 HP% 补其它排
      const byHp = (arr: ArenaUnit[]) =>
        arr.slice().sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      targets = [
        ...byHp(allies.filter((a) => a.row === Row.Front)),
        ...byHp(allies.filter((a) => a.row !== Row.Front)),
      ].slice(0, 2);
''',
        ),
        R(
            '''function executeSkill(caster: ArenaUnit, state: any, log: any[]) {
  addStat(state, caster.id, "skillCasts", 1);
  const sk = caster.def.skill;
''',
            '''function executeSkill(caster: ArenaUnit, state: any, log: any[]) {
  addStat(state, caster.id, "skillCasts", 1);
  const sk = caster.def.skill;
  // v3.4 R15 亡灵歌咏者: 每累计发动 2 次后，下次发动冷却 -60%（3 次一循环）
  if (sk.id === "wlgyz_heal") {
    (caster as any)._wlgyzCastCount = ((caster as any)._wlgyzCastCount || 0) + 1;
    if ((caster as any)._wlgyzCastCount % 3 === 0)
      (caster as any)._nextCdMult = 0.4;
  }
''',
            marker='// v3.4 R15 亡灵歌咏者: 每累计发动 2 次后，下次发动冷却 -60%（3 次一循环）',
        ),
        R(
            '''      executeSkill(unit, state, state.battleLog);
      unit.isCasting = false;
      unit.cooldownRemaining = unit.def.skill.cooldown;
''',
            '''      executeSkill(unit, state, state.battleLog);
      unit.isCasting = false;
      // v3.4 R15: 亡灵歌咏者「下次发动 CD-60%」等一次性冷却倍率
      unit.cooldownRemaining =
        unit.def.skill.cooldown * ((unit as any)._nextCdMult ?? 1);
      (unit as any)._nextCdMult = undefined;
''',
        ),
        R(
            '''      executeSkill(unit, state, state.battleLog);
      unit.cooldownRemaining = sk.cooldown;
''',
            '''      executeSkill(unit, state, state.battleLog);
      // v3.4 R15: 一次性冷却倍率
      unit.cooldownRemaining = sk.cooldown * ((unit as any)._nextCdMult ?? 1);
      (unit as any)._nextCdMult = undefined;
''',
        ),
    ],
}

# ==================== S4 龙吟者 ====================
STEPS['S4'] = {
    CHARS: [
        R(
            '''  talent:
    "自身只能放置在前排，如果因其他技能/天赋而离开前排，每秒失去3%最大生命值。场上每存在1只龙族角色提升自身5%防御力，每存在1只非龙族角色降低自身4%防御力（数双方场上角色，包含自身）。",
''',
            '''  talent:
    "自身只能放置在前排，如果因其他技能/天赋而离开前排，每秒失去3%最大生命值。场上每存在1只龙族单位，自身获得5%伤害降低；场上每当有龙族单位阵亡，自身恢复阵亡单位最大生命值×8%血量。", // v3.4 R16
''',
        ),
        R(
            '''    cooldown: 10,
    castTime: 2,
    description:
      "治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每4次后下次升级，若有阵亡龙族随机复活1只并无敌5s",
''',
            '''    cooldown: 9,
    castTime: 2,
    description:
      "治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每3次后下次升级，升级那次对我方全体龙族生效，若有阵亡龙族随机复活1只并无敌5s", // v3.4 R16
''',
        ),
    ],
    SKILL: [
        R(
            '''// 龙吟者 — 特殊治疗+升级机制+临时复活
registerSkillHandler("lyz_heal", (caster, state, log) => {
  // v3.3: 治疗最低 HP 的 1 名龙族，每秒攻击×40% 并 20%减伤 4s
''',
            '''// 龙吟者 — 特殊治疗+升级机制+临时复活
registerSkillHandler("lyz_heal", (caster, state, log) => {
  // v3.4 R16: 普通发动治疗最低 HP 的 1 名龙族；升级那次对我方全体龙族生效
''',
        ),
        R(
            '''  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount % 5 === 0; // v3.3 每 4 次后，下次发动升级
  const t = dragons[0];
  t.statuses.push({
    type: "lyz_heal_dot" as any,
    remainingSeconds: 4,
    stacks: 1,
    value: Math.floor(caster.currentAttack * 0.4),
    sourceId: caster.id,
  } as any);
  t._lyzDrUntil = state.time + 4;
  t._lyzDr = 0.2;
  log.push({
    time: state.time,
    text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: 每秒攻击×40% + 减伤20% ×4s`,
    type: "heal",
  });
''',
            '''  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount % 4 === 0; // v3.4 R16: 升级所需次数 4→3
  // v3.4 R16: 升级那次技能变为我方全体存活龙族生效
  const targets = upgraded ? dragons : [dragons[0]];
  for (const t of targets) {
    t.statuses.push({
      type: "lyz_heal_dot" as any,
      remainingSeconds: 4,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.4),
      sourceId: caster.id,
    } as any);
    t._lyzDrUntil = state.time + 4;
    t._lyzDr = 0.2;
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: 每秒攻击×40% + 减伤20% ×4s${upgraded ? " [升级·全体龙族]" : ""}`,
      type: "heal",
    });
  }
''',
        ),
    ],
    BATTLE: [
        R(
            '''    // v2.12 龙吟者: 每龙+5%防/每非龙-4%防 (数双方全场, 含自身)
    const lyzUnit = us.find((u: any) => u.def.id === "lyz" && !isRuined(u));
    if (lyzUnit) {
      const allUnits = state.units.filter((x: any) => !x.isDead);
      const dragonCnt = allUnits.filter(
        (x: any) => x.def.race === "dragon"
      ).length;
      const nonDragonCnt = allUnits.length - dragonCnt;
      lyzUnit._lyzDefMult = Math.max(
        0.3,
        1 + dragonCnt * 0.05 - nonDragonCnt * 0.04
      );
    }
''',
            '''    // v3.4 R16: 龙吟者「每龙+5%防御力 / 每非龙-4%防御力」已删除，
    // 改为「每龙+5%伤害降低」，在 updateStatuses 每 tick 按场上存活龙族数动态重算
''',
        ),
        R(
            '''    // v2.12 龙吟者天赋: 离开前排每秒-3%最大生命
    const lyzCycle = Math.floor(state.time);
''',
            '''    // v3.4 R16 龙吟者天赋: 场上每存在 1 只龙族单位 → 自身 +5% 伤害降低（每 tick 动态重算）
    if (unit.def.id === "lyz") {
      const dragonCnt = state.units.filter(
        (x: any) => !x.isDead && x.def.race === "dragon"
      ).length;
      (unit as any)._lyzTalentDrPct = isRuined(unit)
        ? undefined
        : Math.min(0.8, dragonCnt * 0.05); // 0.8 仅作数值安全上限，防 otherReduction 为负
    }
    // v2.12 龙吟者天赋: 离开前排每秒-3%最大生命
    const lyzCycle = Math.floor(state.time);
''',
            marker='// v3.4 R16 龙吟者天赋: 场上每存在 1 只龙族单位 → 自身 +5% 伤害降低（每 tick 动态重算）',
        ),
        R(
            '''    u.isDead = true;
    // v3.3 殉道者: 每当友方角色阵亡（不再只在自身阵亡时）
''',
            '''    u.isDead = true;
    // v3.4 R16 龙吟者天赋: 场上每当有龙族单位阵亡，场上所有存活龙吟者恢复阵亡单位最大HP×8%
    if (u.def.race === "dragon") {
      const lyzHeal = Math.floor(u.maxHp * 0.08);
      for (const lyz of state.units.filter(
        (x: any) => x.def.id === "lyz" && !x.isDead && !isRuined(x)
      )) {
        lyz.currentHp = Math.min(lyz.maxHp, lyz.currentHp + lyzHeal);
        addStat(state, lyz.id, "totalHealingReceived", lyzHeal);
        state.battleLog.push({
          time: state.time,
          text: `🐉 ${u.def.name} 阵亡: ${lyz.def.name} 龙吟恢复 ${lyzHeal}`,
          type: "heal",
        });
      }
    }
    // v3.3 殉道者: 每当友方角色阵亡（不再只在自身阵亡时）
''',
        ),
    ],
    DAMAGE: [
        R(
            '''    // v2.12 龙吟者: 每龙+5%防/每非龙-4%防
    if ((defender as any)._lyzDefMult) def *= (defender as any)._lyzDefMult;
''',
            '''    // v3.4 R16: 龙吟者「每龙+5%防御力」已改为「每龙+5%伤害降低」，在 otherReduction 链结算
''',
            2,
        ),
        R(
            '''  // v3.4 R13 灵弦歌者治愈琴音: 15% 减伤 6s（增强发动 22.5%）
  if (
    (defender as any)._lxgzDrUntil &&
    (defender as any)._lxgzDrUntil > nowOf(extraOpts) &&
    (defender as any)._lxgzDrPct
  ) {
    otherReduction *= 1 - (defender as any)._lxgzDrPct;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
''',
            '''  // v3.4 R13 灵弦歌者治愈琴音: 15% 减伤 6s（增强发动 22.5%）
  if (
    (defender as any)._lxgzDrUntil &&
    (defender as any)._lxgzDrUntil > nowOf(extraOpts) &&
    (defender as any)._lxgzDrPct
  ) {
    otherReduction *= 1 - (defender as any)._lxgzDrPct;
  }
  // v3.4 R16 龙吟者天赋: 场上每存在 1 只龙族单位，自身 5% 伤害降低（加法叠层）
  if ((defender as any)._lyzTalentDrPct) {
    otherReduction *= 1 - (defender as any)._lyzTalentDrPct;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
''',
        ),
    ],
}

# ==================== S5 圣骑士 ====================
STEPS['S5'] = {
    CHARS: [
        R(
            '''    cooldown: 12,
    castTime: 0,
    description:
      "我方2名圣职者恢复攻击×120%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s", // v3.15g: 125→115 // v3.5: 200→240%
    heal: { fixedAdd: 0, atkRatio: 1.2 },
''',
            '''    cooldown: 11,
    castTime: 0,
    description:
      "我方2名圣职者恢复攻击×210%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s", // v3.4 R17: 冷却12→11 / 治疗120%→210%
    heal: { fixedAdd: 0, atkRatio: 2.1 },
''',
        ),
    ],
    SKILL: [
        R(
            '''// 圣骑士 — 治疗2圣职者200% + 驱散+30% + 圣之护盾
''',
            '''// 圣骑士 — 治疗2圣职者210% + 驱散+30% + 圣之护盾（v3.4 R17）
''',
        ),
        R(
            '''      caster.currentAttack * (caster.def.skill.heal?.atkRatio ?? 2.0) * mult
''',
            '''      caster.currentAttack * (caster.def.skill.heal?.atkRatio ?? 2.1) * mult
''',
        ),
    ],
}

# ==================== DOCS docs/v3.0.md 五个角色章节 ====================
STEPS['DOCS'] = {
    V30: [
        R(
            '''* 技能: #治疗 弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20% 施法:2 s (冷却:8 s)
''',
            '''* 技能: #治疗 弹奏2s→最低2名友方持续恢复+15%减伤6s，每秒自身攻×25%+目标攻×20%；每次发动后，下次发动每秒治疗+50%、减伤效果+50% 施法:2 s (冷却:8 s)
''',
        ),
        R(
            '''* 天赋: 每秒恢复1%最大HP；我方全场每次技能对敌造成伤害，自身恢复1%最大HP（每2s最多5%）
''',
            '''* 天赋: 每秒恢复1.5%最大HP；我方全场每次技能对敌造成伤害，自身恢复2%最大HP（每2s最多4%）
''',
        ),
        R(
            '''* 技能: 链接1名友方8s: +30%技能增强+双方天赋20%效果，自身代替友方承担25%伤害 (冷却:9 s)
''',
            '''* 技能: 链接1名友方8s: +30%技能增强+被链接友方天赋30%效果，自身代替被链接的友方承担25%伤害 (冷却:9 s)
''',
        ),
        R(
            '''* 技能: #治疗 #减益 施法2s，恢复随机2名友方攻击×160%生命，并诅咒随机1名敌方5s 施法:2 s (冷却:8 s)
''',
            '''* 技能: #治疗 #减益 施法2s，优先恢复前排2名友方攻击×160%生命，并诅咒随机1名敌方5s；每发动2次后，下次发动冷却-60% 施法:2 s (冷却:8 s)
''',
        ),
        R(
            '''* 天赋:自身只能放置在前排，如果因其他技能/天赋而离开前排，每秒失去3%最大生命值。场上每存在1只龙族角色提升自身5%防御力，每存在1只非龙族角色降低自身4%防御力（数双方场上角色，包含自身）。
''',
            '''* 天赋:自身只能放置在前排，如果因其他技能/天赋而离开前排，每秒失去3%最大生命值。场上每存在1只龙族单位，自身获得5%伤害降低；场上每当有龙族单位阵亡，自身恢复阵亡单位最大生命值×8%血量。
''',
        ),
        R(
            '''* 技能: #治疗 #增益 治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每4次后下次升级，若有阵亡龙族随机复活1只并无敌5s 施法:2 s (冷却:10 s)
''',
            '''* 技能: #治疗 #增益 治疗最低HP龙族: 每秒攻击×40%+20%减伤4s；每3次后下次升级，升级那次对我方全体龙族生效，若有阵亡龙族随机复活1只并无敌5s 施法:2 s (冷却:9 s)
''',
        ),
        R(
            '''* 技能: #治疗 我方2名圣职者恢复攻击×120%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s (冷却:12 s)
''',
            '''* 技能: #治疗 我方2名圣职者恢复攻击×210%生命；有负面则驱散并+30%治疗；圣之护盾(魔伤-30%，反弹10%原本伤害为纯粹)7s (冷却:11 s)
''',
        ),
    ],
}

ORDER = ['S1', 'S2', 'S3', 'S4', 'S5', 'DOCS']
CACHE = {}  # 跨步骤共享，支持 S4 依赖 S1 产物的锚点


def apply_step(name, dry_run):
    global CACHE
    edits = STEPS[name]
    print('=' * 70)
    print(f'STEP {name}  ({"DRY-RUN" if dry_run else "APPLY"})')
    print('=' * 70)
    for path in edits:
        if path not in CACHE:
            with open(path, encoding='utf-8', newline='') as f:
                CACHE[path] = f.read()
    snapshot = {p: CACHE[p] for p in edits}

    ok = True
    for path, reps in edits.items():
        content = CACHE[path]
        for i, rep in enumerate(reps):
            old, new, cnt = rep['old'], rep['new'], rep['count']
            marker = rep.get('marker')
            found = content.count(old)
            if marker and marker in content:
                # 前插/后插式补丁：标记已存在即视为已应用，避免重复插入
                print(f'  SKIP {os.path.basename(path)} #{i + 1}  已应用（幂等）')
            elif found == cnt:
                content = content.replace(old, new, cnt)
                print(f'  OK   {os.path.basename(path)} #{i + 1}  锚点×{found}')
            elif found == 0 and new in content:
                print(f'  SKIP {os.path.basename(path)} #{i + 1}  已应用（幂等）')
            else:
                print(f'  FAIL {os.path.basename(path)} #{i + 1}  期望{cnt}处，实际{found}处')
                print('       OLD >>>')
                print('       ' + old[:400].replace('\n', '\n       '))
                ok = False
        CACHE[path] = content

    if not ok:
        CACHE.update(snapshot)  # 原子：整步回滚
        print(f'  !! STEP {name} 锚点校验失败，整步不写入')
        return False
    if dry_run:
        print(f'  -> DRY-RUN: STEP {name} 全部锚点通过，未写入')
        return True

    for path in edits:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(CACHE[path])
    print(f'  -> STEP {name} 已写入 {len(edits)} 个文件')
    return True


def main():
    args = sys.argv[1:]
    dry = '--dry-run' in args
    step = None
    if '--step' in args:
        idx = args.index('--step')
        if idx + 1 < len(args):
            step = args[idx + 1]
    if step is None or step == 'ALL':
        steps = ORDER
    else:
        if step not in STEPS:
            print(f'未知 step: {step}；可选 {ORDER} / ALL')
            return 1
        steps = [step]

    for s in steps:
        if not apply_step(s, dry):
            return 1
    print()
    print('=' * 70)
    print('全部步骤完成' if not dry else '全部步骤 DRY-RUN 通过')
    print('=' * 70)
    return 0


if __name__ == '__main__':
    sys.exit(main())
