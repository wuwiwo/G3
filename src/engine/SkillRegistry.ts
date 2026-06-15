import { ArenaUnit, StatusType, DamageType, Row } from "../types";
import { calcDamage } from "./damage";

export type SkillHandler = (
  caster: ArenaUnit,
  state: any,
  log: any[],
  targets: ArenaUnit[]
) => void;

const registry = new Map<string, SkillHandler>();

export function registerSkillHandler(skillId: string, handler: SkillHandler) {
  registry.set(skillId, handler);
}
export function getSkillHandler(skillId: string): SkillHandler | undefined {
  return registry.get(skillId);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Skill Handler Registrations ----

// 龙吟者 — 特殊治疗+升级机制+临时复活
registerSkillHandler("lyz_heal", (caster, state, log, targets) => {
  if (!caster.def.skill.heal) return;
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  const deadDragons = state.units.filter(
    (u: any) => u.team === caster.team && u.isDead && u.def.race === "dragon"
  );

  // Track cast count
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount >= 4;

  // Target selection: lowest HP dragon(s)
  let targetsList = allies
    .filter((u: any) => u.def.race === "dragon")
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);

  if (targetsList.length === 0) return;

  const selected = upgraded ? targetsList.slice(0, 2) : [targetsList[0]];
  const ratio = upgraded ? 0.7 : 0.4;
  const dr = upgraded ? 0.3 : 0.2;

  for (const t of selected) {
    const healAmt = Math.floor(caster.currentAttack * ratio);
    t.currentHp = Math.min(t.maxHp, t.currentHp + healAmt);
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: +${healAmt}${upgraded ? "(强化)" : ""}`,
      type: "heal",
    });
  }

  // Temporary revive a dead dragon if any ally dragon died this battle
  if (deadDragons.length > 0) {
    const reviveTarget =
      deadDragons[Math.floor(Math.random() * deadDragons.length)];
    reviveTarget.isDead = false;
    reviveTarget.currentHp = Math.floor(reviveTarget.maxHp * 0.5);
    reviveTarget.statuses = [];
    reviveTarget.tempReviveTimer = 5;
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 临时复活 ${reviveTarget.def.name} 5s!`,
      type: "status",
    });
  }
});

// 小精灵 — 链接
registerSkillHandler("xjl_link", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  // Priority: mage > adjacent > highest attack
  const mages = allies.filter((u: any) => u.def.race === "mage");
  const target =
    mages[0] ||
    allies.sort((a: any, b: any) => b.currentAttack - a.currentAttack)[0];
  if (target) {
    target.skillPower = (target.skillPower || 1) + 0.3;
    target.lifeSteal = (target.lifeSteal || 0) + 0.2;
    log.push({
      time: state.time,
      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30%吸血+20%`,
      type: "status",
    });
  }
});

// 末日使者 — 末日
registerSkillHandler("mrsz_doom", (caster, state, log) => {
  if (caster.currentHp / caster.maxHp < 0.2) return;
  const cost = Math.floor(caster.maxHp * 0.2);
  caster.currentHp -= cost;
  // Find target: highest total damage dealt in last ~10s
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const topDmg = enemies.sort(
    (a: any, b: any) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0)
  )[0];
  if (topDmg) {
    topDmg.statuses.push({
      type: StatusType.Silence,
      remainingSeconds: 7,
      stacks: 1,
      sourceId: caster.id,
    });
    topDmg.statuses.push({
      type: StatusType.Ruin,
      remainingSeconds: 7,
      stacks: 1,
      sourceId: caster.id,
    });
    log.push({
      time: state.time,
      text: `💀 ${caster.def.name} 对 ${topDmg.def.name} 施加末日7s!`,
      type: "status",
    });
  }
});

// 死亡先知 — 吸魂巫术
registerSkillHandler("swxz_drain", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  if (!target) return;
  const perTick = Math.floor(target.currentAttack * 0.07 + target.maxHp * 0.02);
  const totalDmg = perTick * 6;
  target.currentHp -= totalDmg;
  // 延迟结算（若目标有神之庇佑）
  const insp2 = target.statuses?.find((s: any) => s.type === "inspire");
  if (insp2) {
    target.currentHp += totalDmg;
    target._delayedDamage = target._delayedDamage || [];
    target._delayedDamage.push({
      amount: totalDmg,
      expireTime: state.time + 5,
    });
  }
  const heal = Math.floor(totalDmg * 0.2);
  caster.currentHp = Math.min(caster.maxHp, caster.currentHp + heal);
  target.statuses.push({
    type: StatusType.Curse,
    remainingSeconds: 4,
    stacks: 1,
  });
  log.push({
    time: state.time,
    text: `💀 ${caster.def.name} 吸取 ${target.def.name}: ${totalDmg}伤害+${heal}治疗`,
    type: "damage",
  });
});

// 神谕者 — 神之庇佑：减伤+延迟结算
registerSkillHandler("syz_bless", (caster, state, log) => {
  const allies = state.units
    .filter((u: any) => u.team === caster.team && !u.isDead)
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const targets = allies.slice(0, 2);
  for (const t of targets) {
    const neg = [
      "stun",
      "sleep",
      "petrify",
      "freeze",
      "bind",
      "burn",
      "armorBreak",
      "disarm",
      "curse",
      "ruin",
      "silence",
    ];
    t.statuses = t.statuses.filter((s: any) => !neg.includes(s.type));
    // Apply Inspire: 20% damage reduction for 7s
    t.statuses.push({
      type: StatusType.Inspire,
      remainingSeconds: 7,
      stacks: 1,
      value: 0.8,
    });
    log.push({
      time: state.time,
      text: `🛡 ${caster.def.name} 庇佑 ${t.def.name}: 减伤50%+驱散`,
      type: "status",
    });
  }
  // Death trigger: heal all mages
  caster._syzDeathTrigger = true;
});

// 陷阱猎人 — 超级陷阱
registerSkillHandler("xjlr_trap", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  target.statuses.push({
    type: StatusType.Bind,
    remainingSeconds: 10,
    stacks: 1,
  });
  // Store trap damage data on the unit
  target._trapDamage = { casterAtk: caster.currentAttack, casterId: caster.id };
  log.push({
    time: state.time,
    text: `🕳 ${caster.def.name} 在 ${target.def.name} 位置放置超级陷阱`,
    type: "status",
  });
});

// 林地守护者 — 自然守护
registerSkillHandler("ldshz_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  for (const a of allies) {
    a.currentPhysicalDef = Math.floor(a.currentPhysicalDef * 1.2);
    a.currentMagicalDef = Math.floor(a.currentMagicalDef * 1.2);
  }
  // Same-row back-row allies get crit + lifesteal
  const sameRow = allies.filter(
    (a: any) => a.row === caster.row && a.id !== caster.id
  );
  for (const a of sameRow) {
    a.critRate = (a.critRate || 0) + 0.2;
    a.lifeSteal = (a.lifeSteal || 0) + 0.3;
  }
  log.push({
    time: state.time,
    text: `🌿 ${caster.def.name} 释放自然守护: 全队+20%双防6s`,
    type: "status",
  });
});

// 决斗大师 — 战力夺舍
registerSkillHandler("jdds_steal", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  enemies.sort((a: any, b: any) => b.currentAttack - a.currentAttack);
  const target = enemies[0];
  const stealAtk = Math.floor(target.currentAttack * 0.2);
  target.currentAttack -= stealAtk;
  caster.currentAttack += stealAtk;
  // Store stolen attack for 5s reversal
  caster._stolenAtk = (caster._stolenAtk || 0) + stealAtk;
  caster._stealExpire = state.time + 5;
  log.push({
    time: state.time,
    text: `⚔ ${caster.def.name} 夺取 ${target.def.name} 攻击力: +${stealAtk}`,
    type: "status",
  });
});

// 暗影噬龙 — 暗影突袭
registerSkillHandler("aysl_strike", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  enemies.sort(
    (a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
  );
  const target = enemies[0];
  const result = calcDamage(caster, target, 2.3, DamageType.Physical, {
    isSkill: true,
  });
  target.currentHp -= result.finalDamage;
  target._markDmg = (target._markDmg || 0) + 0.25; // +25% damage taken
  target._markExpire = state.time + 4;
  log.push({
    time: state.time,
    text: `🌑 ${caster.def.name} 突袭 ${target.def.name}: ${result.finalDamage}${result.isCrit ? "💥" : ""}+暗影标记4s`,
    type: "damage",
  });
});

// 秀逗大师 — 火球/陨石升级
registerSkillHandler("xdds_fire", (caster, state, log, targets) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  caster._meteorCount = (caster._meteorCount || 0) + 1;
  const isMeteor = caster._meteorCount >= 3;
  if (isMeteor) caster._meteorCount = 0;
  if (!isMeteor) {
    // Normal fireball: single target
    const t = pickTarget(enemies, caster.def.skill.priority);
    if (!t) return;
    const result = calcDamage(caster, t, 2.1, DamageType.Magical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "magical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(火球)`,
      type: "damage",
    });
    // Mage bond skill life steal
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  } else {
    // Meteor: 1 random row, 260% magic + burn 3s
    const rowPref = [
      { row: Row.Front, chance: 40 },
      { row: Row.Mid, chance: 35 },
      { row: Row.Back, chance: 25 },
    ];
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    let selectedRow = Row.Front;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        selectedRow = p.row;
        break;
      }
    }
    const targetsInRow = enemies.filter((e: any) => e.row === selectedRow);
    if (targetsInRow.length === 0) return;
    for (const t of targetsInRow) {
      const result = calcDamage(caster, t, 2.6, DamageType.Magical, {
        isSkill: true,
      });
      t.currentHp -= result.finalDamage;
      t.lastDamage = {
        value: result.finalDamage,
        time: state.time,
        type: "magical",
      };
      t.lastHitBy = caster.id;
      addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
      addStat(state, caster.id, "skillDamage", result.finalDamage);
      addStat(state, t.id, "totalDamageReceived", result.finalDamage);
      t.statuses.push({
        type: StatusType.Burn,
        remainingSeconds: 3,
        stacks: 1,
        value: Math.floor(caster.currentAttack * 0.05),
      });
      log.push({
        time: state.time,
        text: `🔥 ${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(陨石)`,
        type: "damage",
      });
    }
  }
});

// 暴君龙 — 翅击：第1个180%+降攻速，第2个230%
registerSkillHandler("bjl_wing", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const midBack = enemies
    .filter((e: any) => e.row === Row.Mid || e.row === Row.Back)
    .sort((a: any, b: any) => b.row - a.row);
  if (midBack.length === 0) return;
  const targets = midBack.slice(0, 2);
  const dmgRatios = [1.8, 2.3];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const result = calcDamage(caster, t, dmgRatios[i], DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    if (i === 0) {
      // First target: 30% attack speed reduction 4s
      t.statuses = t.statuses.filter((s: any) => s.type !== "burn_slow");
      // Using burn as proxy for slow debuff
    }
    log.push({
      time: state.time,
      text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(翅击#${i + 1})`,
      type: "damage",
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  }
});

// 地龙 — 龙踏：全屏+行系数
registerSkillHandler("dl_stomp", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const rowMultipliers: Record<number, number> = { 0: 1.4, 1: 1.1, 2: 0.8 };
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.5;
  for (const t of enemies) {
    const ratio = baseRatio * (rowMultipliers[t.row] ?? 1.0);
    const result = calcDamage(caster, t, ratio, DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    // Reduce hit rate by 20% for 5s
    t.hitRateMod = (t.hitRateMod || 0) - 0.2;
  }
  log.push({
    time: state.time,
    text: `🌍 ${caster.def.name} 释放龙踏: 全屏物理伤害+降命中20%`,
    type: "damage",
  });
});

// 西部猎人 — 跳跃射击：3发子弹
registerSkillHandler("xblr_shot", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const nTargets = Math.floor(Math.random() * 3) + 1;
  const targets = shuffle(enemies).slice(0, nTargets) as any[];
  const ratios = [0.8, 0.9, 1.2];
  for (const t of targets) {
    for (let i = 0; i < 3; i++) {
      const result = calcDamage(caster, t, ratios[i], DamageType.Physical, {
        isSkill: true,
      });
      let dmg = result.finalDamage;
      if (i === 2) dmg = Math.floor(dmg * 1.35);
      t.currentHp -= dmg;
      addStat(state, caster.id, "totalDamageDealt", dmg);
      addStat(state, caster.id, "skillDamage", dmg);
      addStat(state, caster.id, "physicalDamage", dmg);
      addStat(state, t.id, "totalDamageReceived", dmg);
    }
  }
  log.push({
    time: state.time,
    text: `🏹 ${caster.def.name} 跳跃射击: ${targets.length}名敌人`,
    type: "damage",
  });
});

// 冰霜猎人 — 持续射击+降攻速
registerSkillHandler("bslr_shot", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  const shuffled = shuffle(enemies);
  const targets = shuffle(enemies).slice(0, 3) as any[];
  for (const t of targets) {
    const result = calcDamage(caster, t, 0.9, DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, caster.id, "physicalDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    // Attack speed reduction: 6% per stack, max 3 stacks
    const asStack = t._bslrSlowStack || 0;
    if (asStack < 3) {
      t._bslrSlowStack = asStack + 1;
      t.attackTimer *= 1.06; // 6% slower
    }
    log.push({
      time: state.time,
      text: `🏹 ${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(攻速-6%)`,
      type: "damage",
    });
  }
});

// 智慧猩 — 鼓舞：攻+40%+双抗
registerSkillHandler("zzx_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const beast = allies.filter((u: any) => u.def.race === "beast");
  const target = beast[0] || allies.sort(() => Math.random() - 0.5)[0];
  // Attack buff 5s
  const atkBuff = Math.floor(target.currentAttack * 0.4);
  target.currentAttack += atkBuff;
  // Resistance buff 7s
  caster.statuses.push({
    type: StatusType.Inspire,
    remainingSeconds: 7,
    stacks: 1,
    value: 0.75, // 25% magic reduction
  });
  target.statuses.push({
    type: StatusType.Inspire,
    remainingSeconds: 7,
    stacks: 1,
    value: 0.75,
  });
  log.push({
    time: state.time,
    text: `📯 ${caster.def.name} 鼓舞 ${target.def.name}: +40%攻+双抗7s`,
    type: "status",
  });
});

// 分析者 — 提升3名友方最低防御项5%防御力
registerSkillHandler("fxz_analyze", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  const shuffled = allies.sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, 3).filter((u: any) => u.id !== caster.id);
  if (targets.length === 0) return;
  for (const t of targets) {
    if (t.currentPhysicalDef < t.currentMagicalDef) {
      t.currentPhysicalDef = Math.floor(t.currentPhysicalDef * 1.05);
    } else {
      t.currentMagicalDef = Math.floor(t.currentMagicalDef * 1.05);
    }
  }
  log.push({
    time: state.time,
    text: `📊 ${caster.def.name} 分析: 提升${targets.length}名友方防御`,
    type: "status",
  });
});

// 白马行者 — 蓄力：随机1/2/3s，不同蓄力时间对应不同目标排
registerSkillHandler("bmxz_charge", (caster, state, log) => {
  const enemies = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const chargeTime = caster._chargeTime || 2;
  caster._chargeTime = undefined;
  // Determine target rows based on charge time
  let targetRows: number[];
  if (chargeTime <= 1)
    targetRows = [0]; // 前排
  else if (chargeTime <= 2)
    targetRows = [0, 1]; // 前中排
  else targetRows = [0, 1, 2]; // 全场
  const targets = enemies.filter((e: any) => targetRows.includes(e.row));
  if (targets.length === 0) return;
  const baseDmg = caster.currentAttack * 1.9;
  const dmgPerTarget =
    targets.length >= 5 ? Math.floor(baseDmg * 0.7) : Math.floor(baseDmg);
  for (const t of targets) {
    const result = calcDamage(caster, t, 1.9, DamageType.Magical, {
      isSkill: true,
    });
    let finalDmg = result.finalDamage;
    if (targets.length >= 5) finalDmg = Math.floor(finalDmg * 0.7);
    t.currentHp -= finalDmg;
    t.lastDamage = { value: finalDmg, time: state.time, type: "magical" };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", finalDmg);
    addStat(state, caster.id, "skillDamage", finalDmg);
    addStat(state, caster.id, "magicalDamage", finalDmg);
    addStat(state, t.id, "totalDamageReceived", finalDmg);
  }
  const label = chargeTime <= 1 ? "前排" : chargeTime <= 2 ? "前中排" : "全场";
  log.push({
    time: state.time,
    text: `⚡ ${caster.def.name} 蓄力${chargeTime}s → ${label}: ${Math.floor(baseDmg)}魔法伤害`,
    type: "damage",
  });
});

// Initialize all registered handlers
export function initSkillHandlers() {
  // Registrations are done at module load time above
}

function pickTarget(
  enemies: any[],
  rowPref?: { row: number; chance: number }[]
): any | undefined {
  if (enemies.length === 0) return undefined;
  if (rowPref && rowPref.length > 0) {
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        const inRow = enemies.filter((e: any) => e.row === p.row);
        if (inRow.length > 0)
          return inRow[Math.floor(Math.random() * inRow.length)];
        break;
      }
    }
  }
  return enemies[Math.floor(Math.random() * enemies.length)];
}

function applyMageLifeSteal(
  caster: any,
  state: any,
  log: any[],
  damage: number
) {
  if (damage <= 0) return;
  const mageCnt = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.def.race === "mage"
  ).length;
  const lsPct = mageCnt >= 4 ? 0.25 : mageCnt >= 3 ? 0.1 : 0;
  if (lsPct > 0) {
    const lsHeal = Math.floor(damage * lsPct);
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `💉 ${pfx(caster)} 技能吸血 +${lsHeal}`,
      type: "heal",
    });
  }
  if ((caster.lifeSteal ?? 0) > 0) {
    const lsHeal = Math.floor(damage * (caster.lifeSteal ?? 0));
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `🔗 ${pfx(caster)} 链接吸血 +${lsHeal}`,
      type: "heal",
    });
  }
}

function pfx(u: any): string {
  const r: string = u.def.race;
  const tag =
    (
      {
        beast: "兽",
        hunter: "猎",
        warrior: "战",
        mage: "法",
        undead: "亡",
        dragon: "龙",
      } as any
    )[r] || r;
  return `${u.team === "ally" ? "🟦" : "🟥"}[${tag}]${u.def.name}`;
}

function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}
