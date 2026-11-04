"use strict";

// src/engine/damage.ts
function calcDefReduction(def) {
  if (def <= 0) return 0;
  if (def <= 500) {
    return 1 - 1 / Math.pow(1 + def / 680, 1.6);
  }
  if (def <= 1500) {
    return Math.min(0.585 + (def - 500) * 215e-6, 0.8);
  }
  return 0.8;
}
function getBlockChance(race, isFrontRow = false) {
  switch (race) {
    case "beast" /* Beast */:
    case "warrior" /* Warrior */:
    case "dragon" /* Dragon */:
      return 0.35;
    case "hunter" /* Hunter */:
    case "mage" /* Mage */:
      return 0.25;
    case "undead" /* Undead */:
      return 0.15;
    default:
      return 0;
  }
}
function calcBlockValue(def, race) {
  if (race === "beast" /* Beast */) return Math.floor(def / 4);
  return Math.floor(def / 6);
}
function checkHit(hitRateMod, evasion) {
  const finalHitRate = Math.min(1, Math.max(0.3, 1 + hitRateMod - evasion));
  return Math.random() < finalHitRate;
}
function checkCrit(critRate, tenacity = 0) {
  const reduction = 1 - 25e-4 * Math.min(tenacity, 100);
  return Math.random() < critRate * reduction;
}
function calcDamage(attacker, defender, skillAtkRatio, type, extraOpts) {
  const result = {
    rawDamage: 0,
    afterDef: 0,
    afterFrontRow: 0,
    afterOtherReduction: 0,
    blocked: 0,
    finalDamage: 0,
    isCrit: false,
    isBlocked: false,
    isDodged: false,
    hit: true
  };
  const evasion = defender.statuses.some(
    (s) => s.type === "petrify" /* Petrify */
  ) ? 0 : extraOpts?.evasion ?? 0;
  if (evasion > 0 || (extraOpts?.hitRateMod ?? 0) !== 0) {
    const hit = checkHit(extraOpts?.hitRateMod ?? 0, evasion);
    result.hit = hit;
    if (!hit) {
      result.finalDamage = 0;
      return result;
    }
  }
  if (type === "pure" /* Pure */) {
    if (extraOpts?.defMultiplier) {
      result.rawDamage = defender.currentPhysicalDef * extraOpts.defMultiplier;
    } else if (extraOpts?.defSquaredDiv) {
      const totalDef = defender.currentPhysicalDef + defender.currentMagicalDef;
      result.rawDamage = Math.floor(
        totalDef * totalDef / extraOpts.defSquaredDiv
      );
    } else if (extraOpts?.selfDefMultiplier) {
      result.rawDamage = attacker.currentPhysicalDef * extraOpts.selfDefMultiplier;
    } else if (extraOpts?.targetMaxHpRatio) {
      result.rawDamage = defender.maxHp * extraOpts.targetMaxHpRatio;
    } else {
      result.rawDamage = attacker.currentAttack * (skillAtkRatio ?? 1) + (extraOpts?.fixedAdd ?? 0);
    }
  } else {
    const atk = attacker.currentAttack;
    const effectiveAtk = atk * (attacker.statuses.some((s) => s.type === "burn" /* Burn */) ? 0.9 : 1) * (attacker.statuses.some((s) => s.type === "curse" /* Curse */) ? 0.9 : 1);
    const mageMult = attacker._mageAtkMult || 1;
    result.rawDamage = effectiveAtk * skillAtkRatio * mageMult + (extraOpts?.fixedAdd ?? 0) + (extraOpts?.targetCurrentHpRatio ? defender.currentHp * extraOpts.targetCurrentHpRatio : 0);
  }
  if (type === "physical" /* Physical */) {
    let def = defender.currentPhysicalDef;
    if (defender.statuses.some((s) => s.type === "curse" /* Curse */))
      def *= 0.9;
    if (defender.statuses.some((s) => s.type === "armorBreak" /* ArmorBreak */))
      def *= 0.5;
    if (extraOpts?.ignoreBaseDef) {
      def = 0;
    }
    if (extraOpts?.ignoreDefPct) {
      def *= 1 - extraOpts.ignoreDefPct;
    }
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
    if (defender.physDamageReduction) {
      result.afterDef *= 1 - defender.physDamageReduction;
    }
  } else if (type === "magical" /* Magical */) {
    let def = defender.currentMagicalDef;
    if (defender.statuses.some((s) => s.type === "curse" /* Curse */))
      def *= 0.9;
    if (defender.statuses.some((s) => s.type === "armorBreak" /* ArmorBreak */))
      def *= 0.5;
    if (defender.statuses.some((s) => s.type === "petrify" /* Petrify */))
      def *= 2;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else {
    result.afterDef = result.rawDamage;
  }
  if (defender.row === 0) {
    result.afterFrontRow = result.afterDef * 0.9;
  } else {
    result.afterFrontRow = result.afterDef;
  }
  let otherReduction = 1;
  if (extraOpts?.cdrOverride !== void 0) {
    otherReduction *= extraOpts.cdrOverride;
  }
  const inspire = defender.statuses.find((s) => s.type === "inspire" /* Inspire */);
  if (inspire) {
    otherReduction *= inspire.value ?? 0.7;
  }
  if (defender.damageReduction) {
    otherReduction *= 1 - defender.damageReduction;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
  if (type !== "pure" /* Pure */) {
    const blockChance = getBlockChance(defender.def.race, defender.row === 0);
    if (Math.random() < blockChance) {
      result.isBlocked = true;
      const def = type === "physical" /* Physical */ ? defender.currentPhysicalDef : defender.currentMagicalDef;
      result.blocked = calcBlockValue(def, defender.def.race);
    }
  }
  result.finalDamage = Math.max(
    0,
    Math.floor(result.afterOtherReduction - result.blocked)
  );
  const baseCritRate = 0.075;
  const defenderTenacity = defender.tenacity || 0;
  result.isCrit = checkCrit(baseCritRate, defenderTenacity);
  if (result.isCrit && result.finalDamage > 0) {
    const critDmgMult = 1.35 * (1 - 4e-3 * Math.min(defenderTenacity, 100));
    result.finalDamage = Math.floor(
      result.finalDamage * Math.max(critDmgMult, 1)
    );
  }
  return result;
}
function applyFatalStrike(attacker, damage, isSkill) {
  if (attacker.def.id !== "dyq" || damage <= 0)
    return { damage, triggered: false };
  const chance = isSkill ? 0.35 : 0.15;
  if (Math.random() < chance) {
    const fatal = Math.floor(damage * 1.4);
    const mult = attacker.hasRevived ? 1.75 : 1.4;
    const fatal2 = Math.floor(damage * mult);
    return { damage: Math.max(damage, fatal2), triggered: fatal2 > damage };
  }
  return { damage, triggered: false };
}
function calcHeal(healer, target, atkRatio, extraOpts) {
  let heal = healer.currentAttack * atkRatio + (extraOpts?.fixedAdd ?? 0);
  if (extraOpts?.targetMaxHpRatio) {
    heal += target.maxHp * extraOpts.targetMaxHpRatio;
  }
  if (extraOpts?.targetLostHpRatio) {
    heal += (target.maxHp - target.currentHp) * extraOpts.targetLostHpRatio;
  }
  if (target.statuses.find((s) => s.type === "curse" /* Curse */)) {
    heal *= 0.75;
  }
  if (target.statuses.find((s) => s.type === "freeze" /* Freeze */)) {
    heal *= 0.5;
  }
  if (target.statuses.find((s) => s.type === "poison" /* Poison */)) {
    heal *= 0.75;
  }
  if (target.statuses.find((s) => s.type === "antiHeal" /* AntiHeal */)) {
    heal = 0;
  }
  return Math.floor(Math.max(0, heal));
}

// src/data/races.ts
var BASE_BONDS = {
  ["beast" /* Beast */]: {
    2: { attackBonus: 10, defenseBonus: 5, special: "\u97E7\u6027+10%" },
    3: {
      attackBonus: 15,
      defenseBonus: 10,
      special: "\u97E7\u6027+15%+\u5BF9<50%HP\u654C\u4EBA4%\u653B\u51FB\u7EAF\u7CB9\u4F24\u5BB3"
    },
    4: {
      attackBonus: 25,
      defenseBonus: 16,
      special: "\u97E7\u6027+22%+\u5BF9<50%HP\u654C\u4EBA5%\u653B\u51FB\u7EAF\u7CB9\u4F24\u5BB3"
    }
  },
  ["hunter" /* Hunter */]: {
    2: { attackBonus: 5, hitRateBonus: 10 },
    3: {
      attackBonus: 10,
      hitRateBonus: 20,
      special: "\u53CD\u51FB40%\u4F24\u5BB3+\u6BCF7\u6B21\u653B\u51FB\u989D\u59161\u76EE\u6807(20%\u4F24\u5BB3)"
    },
    4: {
      attackBonus: 14,
      hitRateBonus: 20,
      special: "\u53CD\u51FB60%\u65E0\u89C6\u9632\u5FA1+\u6BCF4\u6B21\u653B\u51FB\u989D\u59161\u76EE\u6807(45%\u4F24\u5BB3\u65E0\u89C6\u9632\u5FA1)"
    }
  },
  ["warrior" /* Warrior */]: {
    2: { hpBonus: 0, attackBonus: 5 },
    3: { hpBonus: 10, attackBonus: 5, special: "\u6BCF12s\u6062\u590D3%HP" },
    4: {
      hpBonus: 25,
      attackBonus: 14,
      magicalDefBonus: 30,
      special: "\u6BCF12s\u6062\u590D4%HP+5%\u5438\u8840+\u9B54\u6CD5\u9632\u5FA1+30%"
    }
  },
  ["mage" /* Mage */]: {
    2: { special: "-20%\u9B54\u9632" },
    3: { special: "-30%\u9B54\u9632+\u51B7\u5374-12%+\u65BD\u6CD552%\u6982\u7387\u5168\u4F53+6.5%\u653B20s" },
    4: { special: "-40%\u9B54\u9632+\u51B7\u5374-18%+\u65BD\u6CD552%\u6982\u7387\u5168\u4F53+6.5%\u653B20s" }
  },
  ["undead" /* Undead */]: {
    2: { attackBonus: 5, evasionBonus: 5 },
    3: {
      attackBonus: 10,
      evasionBonus: 10,
      special: "\u590D\u6D3B10s+\u6BCF\u79D22%HP/8s+\u65E0\u654C2s"
    },
    4: {
      attackBonus: 15,
      evasionBonus: 21,
      special: "\u7269\u7406\u51CF\u4F2411%+\u590D\u6D3B5s+\u6BCF\u79D22.5%HP/10s+\u65E0\u654C2s"
    }
  },
  ["dragon" /* Dragon */]: {
    2: {},
    3: { special: "CD-20%+\u51CF\u4F243%+\u5F00\u5C402\u500D\u51CF\u4F246s" },
    4: { special: "CD-30%+\u51CF\u4F2410%+\u5F00\u5C402.5\u500D\u51CF\u4F2410s" }
  }
};
function getBondAtTier(race, count) {
  const tiers = BASE_BONDS[race];
  let tier = {};
  for (const t of [2, 3, 4]) {
    if (count >= t && tiers[t]) tier = { ...tier, ...tiers[t] };
  }
  let overrides = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) {
      const store = JSON.parse(raw);
      if (store._bonds) overrides = store._bonds;
    }
  } catch {
  }
  const ov = overrides[race] || {};
  return {
    attackBonus: ov.attackBonus ?? tier.attackBonus ?? 0,
    defenseBonus: ov.defenseBonus ?? tier.defenseBonus ?? 0,
    hpBonus: ov.hpBonus ?? tier.hpBonus ?? 0,
    hitRateBonus: ov.hitRateBonus ?? tier.hitRateBonus ?? 0,
    evasionBonus: ov.evasionBonus ?? tier.evasionBonus ?? 0,
    special: ov.special ?? tier.special
  };
}
var RACE_CONFIG = {
  ["beast" /* Beast */]: { label: "\u517D\u65CF", color: "#8d6e63", short: "\u517D" },
  ["hunter" /* Hunter */]: { label: "\u730E\u4EBA", color: "#4caf50", short: "\u730E" },
  ["warrior" /* Warrior */]: { label: "\u6218\u58EB", color: "#f44336", short: "\u6218" },
  ["mage" /* Mage */]: { label: "\u6CD5\u5E08", color: "#2196f3", short: "\u6CD5" },
  ["undead" /* Undead */]: { label: "\u4EA1\u7075", color: "#9c27b0", short: "\u4EA1" },
  ["dragon" /* Dragon */]: { label: "\u9F99\u65CF", color: "#ff9800", short: "\u9F99" }
};
var RACE_BG = {
  ["beast" /* Beast */]: "linear-gradient(135deg,#4e342e,#3e2723)",
  ["hunter" /* Hunter */]: "linear-gradient(135deg,#1b5e20,#2e7d32)",
  ["warrior" /* Warrior */]: "linear-gradient(135deg,#b71c1c,#c62828)",
  ["mage" /* Mage */]: "linear-gradient(135deg,#0d47a1,#1565c0)",
  ["undead" /* Undead */]: "linear-gradient(135deg,#4a148c,#6a1b9a)",
  ["dragon" /* Dragon */]: "linear-gradient(135deg,#e65100,#ef6c00)"
};
function countRaceOnTeam(units) {
  const counts = /* @__PURE__ */ new Map();
  for (const u of units) {
    counts.set(u.def.race, (counts.get(u.def.race) ?? 0) + 1);
  }
  return counts;
}
function getActiveBonds(units) {
  const counts = countRaceOnTeam(units);
  const active = /* @__PURE__ */ new Map();
  for (const [race, count] of counts) {
    if (count >= 2) {
      active.set(race, { count, effect: getBondAtTier(race, count) });
    }
  }
  return active;
}

// src/engine/SkillRegistry.ts
var registry = /* @__PURE__ */ new Map();
function registerSkillHandler(skillId, handler) {
  registry.set(skillId, handler);
}
function getSkillHandler(skillId) {
  return registry.get(skillId);
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
registerSkillHandler("lyz_heal", (caster, state, log, targets) => {
  if (!caster.def.skill.heal) return;
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead
  );
  const deadDragons = state.units.filter(
    (u) => u.team === caster.team && u.isDead && u.def.race === "dragon"
  );
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount >= 4;
  let targetsList = allies.filter((u) => u.def.race === "dragon").sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  if (targetsList.length === 0) return;
  const selected = upgraded ? targetsList.slice(0, 2) : [targetsList[0]];
  const ratio = upgraded ? 0.7 : 0.4;
  const dr = upgraded ? 0.3 : 0.2;
  for (const t of selected) {
    const healAmt = Math.floor(caster.currentAttack * ratio);
    t.currentHp = Math.min(t.maxHp, t.currentHp + healAmt);
    log.push({
      time: state.time,
      text: `\u{1F3B5} ${caster.def.name} \u6CBB\u7597 ${t.def.name}: +${healAmt}${upgraded ? "(\u5F3A\u5316)" : ""}`,
      type: "heal"
    });
  }
  if (deadDragons.length > 0) {
    const reviveTarget = deadDragons[Math.floor(Math.random() * deadDragons.length)];
    reviveTarget.isDead = false;
    reviveTarget.currentHp = Math.floor(reviveTarget.maxHp * 0.5);
    reviveTarget.statuses = [];
    reviveTarget.tempReviveTimer = 5;
    log.push({
      time: state.time,
      text: `\u{1F3B5} ${caster.def.name} \u4E34\u65F6\u590D\u6D3B ${reviveTarget.def.name} 5s!`,
      type: "status"
    });
  }
});
registerSkillHandler("srm_fire", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const cost = Math.floor(caster.currentHp * 0.05);
  caster.currentHp -= cost;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const result = calcDamage(caster, target, 1.6, "magical" /* Magical */, {
    isSkill: true
  });
  target.currentHp -= result.finalDamage;
  target.statuses.push({
    type: "stun" /* Stun */,
    remainingSeconds: 0.5,
    stacks: 1
  });
  target.lastDamage = {
    value: result.finalDamage,
    time: state.time,
    type: "magical"
  };
  target.lastHitBy = caster.id;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "magicalDamage", result.finalDamage);
  addStat(state, target.id, "totalDamageReceived", result.finalDamage);
  log.push({
    time: state.time,
    text: `\u{1F525} ${caster.def.name} \u706B\u7130\u7206\u8F70 ${target.def.name}: ${result.finalDamage}\u{1F4A5}`,
    type: "damage"
  });
  const nCasts = Math.random() < 0.4 ? 2 : Math.random() < 0.2 ? 3 : 1;
  for (let i = 1; i < nCasts; i++) {
    const t2 = enemies.filter((u) => u.id !== target.id);
    if (t2.length === 0) break;
    const extraTarget = t2[Math.floor(Math.random() * t2.length)];
    const r2 = calcDamage(caster, extraTarget, 1.6, "magical" /* Magical */, {
      isSkill: true
    });
    extraTarget.currentHp -= r2.finalDamage;
    extraTarget.statuses.push({
      type: "stun" /* Stun */,
      remainingSeconds: 0.5,
      stacks: 1
    });
    addStat(state, caster.id, "totalDamageDealt", r2.finalDamage);
    addStat(state, caster.id, "skillDamage", r2.finalDamage);
    addStat(state, caster.id, "magicalDamage", r2.finalDamage);
    addStat(state, extraTarget.id, "totalDamageReceived", r2.finalDamage);
    log.push({
      time: state.time,
      text: `\u{1F525} ${caster.def.name} \u989D\u5916\u706B\u7130\u7206\u8F70#${i + 1} ${extraTarget.def.name}: ${r2.finalDamage}\u{1F4A5}`,
      type: "damage"
    });
  }
});
registerSkillHandler("xjl_link", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const mages = allies.filter((u) => u.def.race === "mage");
  const target = mages[0] || allies.sort((a, b) => b.currentAttack - a.currentAttack)[0];
  if (target) {
    target.skillPower = (target.skillPower || 1) + 0.3;
    target.lifeSteal = (target.lifeSteal || 0) + 0.2;
    log.push({
      time: state.time,
      text: `\u{1F517} ${caster.def.name} \u94FE\u63A5 ${target.def.name}: \u6280\u80FD+30%\u5438\u8840+20%`,
      type: "status"
    });
  }
});
registerSkillHandler("mrsz_doom", (caster, state, log) => {
  if (caster.currentHp / caster.maxHp < 0.2) return;
  const cost = Math.floor(caster.maxHp * 0.2);
  caster.currentHp -= cost;
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  const topDmg = enemies.sort(
    (a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0)
  )[0];
  if (topDmg) {
    topDmg.statuses.push({
      type: "silence" /* Silence */,
      remainingSeconds: 7,
      stacks: 1,
      sourceId: caster.id
    });
    topDmg.statuses.push({
      type: "ruin" /* Ruin */,
      remainingSeconds: 7,
      stacks: 1,
      sourceId: caster.id
    });
    log.push({
      time: state.time,
      text: `\u{1F480} ${caster.def.name} \u5BF9 ${topDmg.def.name} \u65BD\u52A0\u672B\u65E57s!`,
      type: "status"
    });
  }
});
registerSkillHandler("swxz_drain", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  if (!target) return;
  const perTick = Math.floor(target.currentAttack * 0.07 + target.maxHp * 0.02);
  const totalDmg = perTick * 6;
  target.currentHp -= totalDmg;
  const insp2 = target.statuses?.find((s) => s.type === "inspire");
  if (insp2) {
    target.currentHp += totalDmg;
    target._delayedDamage = target._delayedDamage || [];
    target._delayedDamage.push({
      amount: totalDmg,
      expireTime: state.time + 5
    });
  }
  const heal = Math.floor(totalDmg * 0.2);
  caster.currentHp = Math.min(caster.maxHp, caster.currentHp + heal);
  target.statuses.push({
    type: "curse" /* Curse */,
    remainingSeconds: 4,
    stacks: 1
  });
  log.push({
    time: state.time,
    text: `\u{1F480} ${caster.def.name} \u5438\u53D6 ${target.def.name}: ${totalDmg}\u4F24\u5BB3+${heal}\u6CBB\u7597`,
    type: "damage"
  });
});
registerSkillHandler("syz_bless", (caster, state, log) => {
  const allies = state.units.filter((u) => u.team === caster.team && !u.isDead).sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
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
      "silence"
    ];
    t.statuses = t.statuses.filter((s) => !neg.includes(s.type));
    t.statuses.push({
      type: "inspire" /* Inspire */,
      remainingSeconds: 7,
      stacks: 1,
      value: 0.8
    });
    log.push({
      time: state.time,
      text: `\u{1F6E1} ${caster.def.name} \u5E87\u4F51 ${t.def.name}: \u51CF\u4F2450%+\u9A71\u6563`,
      type: "status"
    });
  }
  caster._syzDeathTrigger = true;
});
registerSkillHandler("xjlr_trap", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  target.statuses.push({
    type: "bind" /* Bind */,
    remainingSeconds: 10,
    stacks: 1
  });
  target._trapDamage = { casterAtk: caster.currentAttack, casterId: caster.id };
  log.push({
    time: state.time,
    text: `\u{1F573} ${caster.def.name} \u5728 ${target.def.name} \u4F4D\u7F6E\u653E\u7F6E\u8D85\u7EA7\u9677\u9631`,
    type: "status"
  });
});
registerSkillHandler("ldshz_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead
  );
  for (const a of allies) {
    a.currentPhysicalDef = Math.floor(a.currentPhysicalDef * 1.2);
    a.currentMagicalDef = Math.floor(a.currentMagicalDef * 1.2);
  }
  const sameRow = allies.filter(
    (a) => a.row === caster.row && a.id !== caster.id
  );
  for (const a of sameRow) {
    a.critRate = (a.critRate || 0) + 0.2;
    a.lifeSteal = (a.lifeSteal || 0) + 0.3;
  }
  log.push({
    time: state.time,
    text: `\u{1F33F} ${caster.def.name} \u91CA\u653E\u81EA\u7136\u5B88\u62A4: \u5168\u961F+20%\u53CC\u96326s`,
    type: "status"
  });
});
registerSkillHandler("jdds_steal", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  enemies.sort((a, b) => b.currentAttack - a.currentAttack);
  const target = enemies[0];
  const stealAtk = Math.floor(target.currentAttack * 0.2);
  target.currentAttack -= stealAtk;
  caster.currentAttack += stealAtk;
  caster._stolenAtk = (caster._stolenAtk || 0) + stealAtk;
  caster._stealExpire = state.time + 5;
  log.push({
    time: state.time,
    text: `\u2694 ${caster.def.name} \u593A\u53D6 ${target.def.name} \u653B\u51FB\u529B: +${stealAtk}`,
    type: "status"
  });
});
registerSkillHandler("aysl_strike", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  enemies.sort(
    (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
  );
  const target = enemies[0];
  const result = calcDamage(caster, target, 2.3, "physical" /* Physical */, {
    isSkill: true
  });
  target.currentHp -= result.finalDamage;
  target._markDmg = (target._markDmg || 0) + 0.25;
  target._markExpire = state.time + 4;
  log.push({
    time: state.time,
    text: `\u{1F311} ${caster.def.name} \u7A81\u88AD ${target.def.name}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}+\u6697\u5F71\u6807\u8BB04s`,
    type: "damage"
  });
});
registerSkillHandler("xdds_fire", (caster, state, log, targets) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  caster._meteorCount = (caster._meteorCount || 0) + 1;
  const isMeteor = caster._meteorCount >= 3;
  if (isMeteor) caster._meteorCount = 0;
  if (!isMeteor) {
    const t = pickTarget(enemies, caster.def.skill.priority);
    if (!t) return;
    const result = calcDamage(caster, t, 2.1, "magical" /* Magical */, {
      isSkill: true
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "magical"
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u706B\u7403)`,
      type: "damage"
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  } else {
    const rowPref = [
      { row: 0 /* Front */, chance: 40 },
      { row: 1 /* Mid */, chance: 35 },
      { row: 2 /* Back */, chance: 25 }
    ];
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    let selectedRow = 0 /* Front */;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        selectedRow = p.row;
        break;
      }
    }
    const targetsInRow = enemies.filter((e) => e.row === selectedRow);
    if (targetsInRow.length === 0) return;
    for (const t of targetsInRow) {
      const result = calcDamage(caster, t, 2.6, "magical" /* Magical */, {
        isSkill: true
      });
      t.currentHp -= result.finalDamage;
      t.lastDamage = {
        value: result.finalDamage,
        time: state.time,
        type: "magical"
      };
      t.lastHitBy = caster.id;
      addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
      addStat(state, caster.id, "skillDamage", result.finalDamage);
      addStat(state, t.id, "totalDamageReceived", result.finalDamage);
      t.statuses.push({
        type: "burn" /* Burn */,
        remainingSeconds: 3,
        stacks: 1,
        value: Math.floor(caster.currentAttack * 0.05)
      });
      log.push({
        time: state.time,
        text: `\u{1F525} ${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u9668\u77F3)`,
        type: "damage"
      });
    }
  }
});
registerSkillHandler("bjl_wing", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  const midBack = enemies.filter((e) => e.row === 1 /* Mid */ || e.row === 2 /* Back */).sort((a, b) => b.row - a.row);
  if (midBack.length === 0) return;
  const targets = midBack.slice(0, 2);
  const dmgRatios = [1.8, 2.3];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const result = calcDamage(caster, t, dmgRatios[i], "physical" /* Physical */, {
      isSkill: true
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical"
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    if (i === 0) {
      t.statuses = t.statuses.filter((s) => s.type !== "burn_slow");
    }
    log.push({
      time: state.time,
      text: `${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u7FC5\u51FB#${i + 1})`,
      type: "damage"
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  }
});
registerSkillHandler("dl_stomp", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  const rowMultipliers = { 0: 1.4, 1: 1.1, 2: 0.8 };
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.5;
  for (const t of enemies) {
    const ratio = baseRatio * (rowMultipliers[t.row] ?? 1);
    const result = calcDamage(caster, t, ratio, "physical" /* Physical */, {
      isSkill: true
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical"
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    t.hitRateMod = (t.hitRateMod || 0) - 0.2;
  }
  log.push({
    time: state.time,
    text: `\u{1F30D} ${caster.def.name} \u91CA\u653E\u9F99\u8E0F: \u5168\u5C4F\u7269\u7406\u4F24\u5BB3+\u964D\u547D\u4E2D20%`,
    type: "damage"
  });
});
registerSkillHandler("xblr_shot", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const nTargets = Math.floor(Math.random() * 3) + 1;
  const targets = shuffle(enemies).slice(0, nTargets);
  const ratios = [0.8, 0.9, 1.2];
  for (const t of targets) {
    for (let i = 0; i < 3; i++) {
      const result = calcDamage(caster, t, ratios[i], "physical" /* Physical */, {
        isSkill: true
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
    text: `\u{1F3F9} ${caster.def.name} \u8DF3\u8DC3\u5C04\u51FB: ${targets.length}\u540D\u654C\u4EBA`,
    type: "damage"
  });
});
registerSkillHandler("bslr_shot", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  const shuffled = shuffle(enemies);
  const targets = shuffle(enemies).slice(0, 3);
  for (const t of targets) {
    const result = calcDamage(caster, t, 0.9, "physical" /* Physical */, {
      isSkill: true
    });
    t.currentHp -= result.finalDamage;
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical"
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, caster.id, "physicalDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    const asStack = t._bslrSlowStack || 0;
    if (asStack < 3) {
      t._bslrSlowStack = asStack + 1;
      t.attackTimer *= 1.06;
    }
    log.push({
      time: state.time,
      text: `\u{1F3F9} ${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u653B\u901F-6%)`,
      type: "damage"
    });
  }
});
registerSkillHandler("zzx_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const beast = allies.filter((u) => u.def.race === "beast");
  const target = beast[0] || allies.sort(() => Math.random() - 0.5)[0];
  const atkBuff = Math.floor(target.currentAttack * 0.4);
  target.currentAttack += atkBuff;
  caster.statuses.push({
    type: "inspire" /* Inspire */,
    remainingSeconds: 7,
    stacks: 1,
    value: 0.75
    // 25% magic reduction
  });
  target.statuses.push({
    type: "inspire" /* Inspire */,
    remainingSeconds: 7,
    stacks: 1,
    value: 0.75
  });
  log.push({
    time: state.time,
    text: `\u{1F4EF} ${caster.def.name} \u9F13\u821E ${target.def.name}: +40%\u653B+\u53CC\u62977s`,
    type: "status"
  });
});
registerSkillHandler("bsxl_freeze", (caster, state, log) => {
  const enemies = state.units.filter((u) => u.team !== caster.team && !u.isDead).filter((u) => u.row === 2);
  if (enemies.length === 0) return;
  caster._bsxlFreezeCount = (caster._bsxlFreezeCount || 0) + 1;
  const isFreeze = caster._bsxlFreezeCount >= 3;
  if (isFreeze) caster._bsxlFreezeCount = 0;
  for (const t of enemies) {
    let dmgRatio = 0.8;
    let dmgType = "magical" /* Magical */;
    if (isFreeze) {
      dmgRatio = 0.8;
      dmgType = "pure" /* Pure */;
      t.statuses.push({
        type: "freeze" /* Freeze */,
        remainingSeconds: 3,
        stacks: 1
      });
    }
    const result = calcDamage(caster, t, dmgRatio, dmgType, { isSkill: true });
    t.currentHp -= result.finalDamage;
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(
      state,
      caster.id,
      dmgType === "magical" ? "magicalDamage" : "pureDamage",
      result.finalDamage
    );
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
  }
  log.push({
    time: state.time,
    text: `\u2744\uFE0F ${caster.def.name} ${isFreeze ? "\u51B0\u51BB\u5410\u606F(\u7EAF\u7CB9)" : "\u51B0\u971C\u5410\u606F"}`,
    type: "damage"
  });
});
registerSkillHandler("fxz_analyze", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead
  );
  const shuffled = allies.sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, 3).filter((u) => u.id !== caster.id);
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
    text: `\u{1F4CA} ${caster.def.name} \u5206\u6790: \u63D0\u5347${targets.length}\u540D\u53CB\u65B9\u9632\u5FA1`,
    type: "status"
  });
});
registerSkillHandler("bmxz_charge", (caster, state, log) => {
  const enemies = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead
  );
  if (enemies.length === 0) return;
  const chargeTime = caster._chargeTime || 2;
  caster._chargeTime = void 0;
  let targetRows;
  if (chargeTime <= 1)
    targetRows = [0];
  else if (chargeTime <= 2)
    targetRows = [0, 1];
  else targetRows = [0, 1, 2];
  const targets = enemies.filter((e) => targetRows.includes(e.row));
  if (targets.length === 0) return;
  const baseDmg = caster.currentAttack * 1.9;
  const dmgPerTarget = targets.length >= 5 ? Math.floor(baseDmg * 0.7) : Math.floor(baseDmg);
  for (const t of targets) {
    const result = calcDamage(caster, t, 1.9, "magical" /* Magical */, {
      isSkill: true
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
  const label = chargeTime <= 1 ? "\u524D\u6392" : chargeTime <= 2 ? "\u524D\u4E2D\u6392" : "\u5168\u573A";
  log.push({
    time: state.time,
    text: `\u26A1 ${caster.def.name} \u84C4\u529B${chargeTime}s \u2192 ${label}: ${Math.floor(baseDmg)}\u9B54\u6CD5\u4F24\u5BB3`,
    type: "damage"
  });
});
function pickTarget(enemies, rowPref) {
  if (enemies.length === 0) return void 0;
  if (rowPref && rowPref.length > 0) {
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        const inRow = enemies.filter((e) => e.row === p.row);
        if (inRow.length > 0)
          return inRow[Math.floor(Math.random() * inRow.length)];
        break;
      }
    }
  }
  return enemies[Math.floor(Math.random() * enemies.length)];
}
function applyMageLifeSteal(caster, state, log, damage) {
  if (damage <= 0) return;
  const mageCnt = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.def.race === "mage"
  ).length;
  const lsPct = mageCnt >= 4 ? 0.3 : mageCnt >= 3 ? 0.15 : 0;
  if (lsPct > 0) {
    const lsHeal = Math.floor(damage * lsPct);
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `\u{1F489} ${pfx(caster)} \u6280\u80FD\u5438\u8840 +${lsHeal}`,
      type: "heal"
    });
  }
  if ((caster.lifeSteal ?? 0) > 0) {
    const lsHeal = Math.floor(damage * (caster.lifeSteal ?? 0));
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `\u{1F517} ${pfx(caster)} \u94FE\u63A5\u5438\u8840 +${lsHeal}`,
      type: "heal"
    });
  }
}
function pfx(u) {
  const r = u.def.race;
  const tag = {
    beast: "\u517D",
    hunter: "\u730E",
    warrior: "\u6218",
    mage: "\u6CD5",
    undead: "\u4EA1",
    dragon: "\u9F99"
  }[r] || r;
  return `${u.team === "ally" ? "\u{1F7E6}" : "\u{1F7E5}"}[${tag}]${u.def.name}`;
}
function addStat(state, unitId, field, value) {
  const s = state.stats?.find((st) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}

// src/data/characters.ts
var pp = {
  id: "pp",
  name: "\u5F6D\u5F6D\u732A",
  race: "beast" /* Beast */,
  stats: {
    hp: 13280,
    attack: 639,
    physicalDef: 384.8,
    magicalDef: 362,
    attackInterval: 4.2
  },
  growth: { hp: 120, attack: 6, physicalDef: 3.2, magicalDef: 3 },
  talent: "\u7761\u7720\u65F6\u9A71\u6563\u5F02\u5E38+\u6BCF\u79D2\u56DE2%+Lv\xD70.02%HP",
  skill: {
    id: "pp_sleep",
    name: "\u50AC\u7720",
    tags: ["\u63A7\u5236"],
    cooldown: 11,
    castTime: 0,
    description: "\u4EE4\u81EA\u8EAB\u4E0E\u654C\u4EBA\u540E\u6392\u968F\u673A\u4E00\u540D\u540C\u65F6\u8FDB\u5165\u7761\u77203s(\u540E\u6392\u65E0\u4EBA\u53EA\u5BF9\u81EA\u5DF1)",
    effects: [{ type: "sleep" /* Sleep */, duration: 3, chance: 0.5 }]
  }
};
var hl = {
  id: "hl",
  name: "\u568E\u53EB\u5DE8\u725B",
  race: "beast" /* Beast */,
  stats: {
    hp: 9924,
    attack: 946,
    physicalDef: 547.2,
    magicalDef: 341.2,
    attackInterval: 4
  },
  growth: { hp: 90, attack: 9, physicalDef: 4.8, magicalDef: 2.8 },
  talent: "\u6218\u6597\u5F00\u59CB\u53D1\u51FA\u6012\u543C\u5A01\u5413\u654C\u4EBA,\u4F7F\u654C\u4EBA\u5168\u90E8\u89D2\u8272\u653B\u51FB\u529B\u964D\u4F4E 15%+\u7B49\u7EA7\xD70.15%\uFF08100\u7EA7\u65F6\u5019\u964D\u4F4E 25%\uFF09,\u6301\u7EED 5+\u7B49\u7EA7\xD70.03 s\uFF08100\u7EA7\uFF1A8s\uFF09",
  skill: {
    id: "hl_rage",
    name: "\u6FC0\u6012",
    tags: ["\u589E\u76CA"],
    cooldown: 999,
    castTime: 0,
    description: "\u9996\u6B21HP<25%\u65F6\uFF0C\u63D0\u534735%\u653B\u51FB+20%\u653B\u901F\uFF0C\u514D\u75AB\u5F02\u5E38\u81F3\u6218\u6597\u7ED3\u675F"
  }
};
var yl = {
  id: "yl",
  name: "\u591C\u884C\u72FC\u4EBA",
  race: "beast" /* Beast */,
  stats: {
    hp: 8103,
    attack: 837,
    physicalDef: 390.5,
    magicalDef: 287.5,
    attackInterval: 3
  },
  growth: { hp: 72, attack: 8, physicalDef: 3.5, magicalDef: 2.5 },
  talent: "\u6218\u6597\u5F00\u59CB,\u53D1\u51FA\u72FC\u543C,\u4F7F\u6211\u65B9\u5168\u573A\u517D\u65CF\u63D0\u5347 20%+\u7B49\u7EA7\xD70.1%\u7684\u653B\u51FB\u529B,\u6301\u7EED\u81F3\u6218\u6597\u7ED3\u675F\u3002\u4F46\u8FD9\u4E2A\u6548\u679C\u6BCF\u7ECF\u8FC7 10 s \u540E\u51CF\u5C11 20%,\u6700\u591A\u964D\u4F4E 60%\uFF08100\u7EA7\uFF1A+30%\u653B\u51FB\uFF09",
  skill: {
    id: "yl_stealth",
    name: "\u6F5C\u884C",
    tags: ["\u5207\u5165"],
    cooldown: 8,
    castTime: 0,
    description: "\u6F5C\u884C(\u4E0D\u53EF\u9009\u4E2D)\uFF0C\u6BCF\u79D2\u56DE1%HP\uFF0C\u4E0B\u6B21\u653B\u51FB2.1\u500D\uFF0C\u4F18\u5148\u540E\u6392",
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.1 }],
    priority: [
      { row: 2 /* Back */, chance: 50 },
      { row: 1 /* Mid */, chance: 40 },
      { row: 0 /* Front */, chance: 10 }
    ]
  }
};
var hx = {
  id: "hx",
  name: "\u864E\u5578",
  race: "beast" /* Beast */,
  stats: {
    hp: 6495,
    attack: 965.8,
    physicalDef: 315.2,
    magicalDef: 210.2,
    attackInterval: 3.5
  },
  growth: { hp: 55, attack: 9.2, physicalDef: 2.8, magicalDef: 1.8 },
  talent: "\u6211\u65B9\u573A\u4E0A\u6BCF\u6B21\u517D\u65CF\u89D2\u8272\u9635\u4EA1,\u81EA\u8EAB\u63D0\u5347 6%+\u7B49\u7EA7\xD70.02%\u7684\u653B\u51FB\u4E0E 3%+\u7B49\u7EA7\xD70.05%\u7684\u9632\u5FA1\u529B,\u76F4\u5230\u6218\u6597\u7ED3\u675F\u3002\uFF08100\u7EA7\uFF1A8%\u653B\u51FB\u4E0E8%\u9632\u5FA1\u529B/\u4E2A\uFF09",
  skill: {
    id: "hx_cut",
    name: "\u864E\u88AD",
    tags: ["\u5207\u5165"],
    cooldown: 5,
    castTime: 0,
    description: "\u5BF9\u968F\u673A2\u540D\u5404\u9020\u6210200-240%\u4F24\u5BB3\uFF0C\u4F18\u5148\u540E\u6392",
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.2 }],
    aoe: { maxTargets: 2 },
    priority: [
      { row: 2 /* Back */, chance: 60 },
      { row: 1 /* Mid */, chance: 10 },
      { row: 0 /* Front */, chance: 30 }
    ]
  }
};
var zzx = {
  id: "zzx",
  name: "\u667A\u6167\u7329",
  race: "beast" /* Beast */,
  stats: {
    hp: 5846,
    attack: 535,
    physicalDef: 297.5,
    magicalDef: 520.5,
    attackInterval: 4
  },
  growth: { hp: 50, attack: 5, physicalDef: 2.5, magicalDef: 4.5 },
  talent: "\u6218\u6597\u5F00\u59CB,\u6839\u636E\u81EA\u8EAB\u6240\u5728\u9635\u578B\u4F4D\u7F6E,\u4F7F\u654C\u65B9\u5BF9\u5E94\u9635\u578B\u4F4D\u7F6E\u7684\u6240\u6709\u654C\u4EBA,\u6218\u6597\u5F00\u59CB\u540E\u7684\u524D 4+\u7B49\u7EA7\xD70.04 s \u7684\u5929\u8D4B\u4E0E\u6280\u80FD\u7981\u7528\u5E76\u5931\u6548\u3002",
  skill: {
    id: "zzx_buff",
    name: "\u9F13\u821E",
    tags: ["\u589E\u76CA"],
    cooldown: 9,
    castTime: 0,
    description: "\u4F7F\u4E00\u540D\u53CB\u65B9\uFF08\u4F18\u5148\u517D\u65CF\uFF09\u63D0\u534740%\u653B\u51FB\u529B5s+\u81EA\u8EAB\u4E0E\u76EE\u6807\u53CC\u62977s",
    scriptId: "zzx_buff"
  }
};
var dxm = {
  id: "dxm",
  name: "\u72EC\u884C\u9A6C",
  race: "beast" /* Beast */,
  stats: {
    hp: 8820,
    attack: 644,
    physicalDef: 305.5,
    magicalDef: 293.6,
    attackInterval: 3.6
  },
  growth: { hp: 80, attack: 6, physicalDef: 2.5, magicalDef: 2.4 },
  talent: "\u4E0E\u81EA\u8EAB\u540C\u9635\u578B\uFF08\u5373\u540C\u4E00\u6392\uFF0C\u524D/\u4E2D/\u540E\u6392\u53D6\u51B3\u4E8E\u81EA\u8EAB\u4F4D\u7F6E\uFF09\u7684\u6240\u6709\u53CB\u65B9\u89D2\u8272\u6280\u80FD\u51B7\u5374\u51CF\u5C11 10%+\u7B49\u7EA7\xD70.08%\uFF08\u5305\u542B\u81EA\u8EAB\uFF09\uFF08100\u7EA7\uFF1A-18%\u6280\u80FD\u51B7\u5374\uFF09",
  skill: {
    id: "dxm_heal",
    name: "\u6CBB\u6108",
    tags: ["\u6CBB\u7597"],
    cooldown: 7,
    castTime: 0,
    description: "\u6CBB\u7597\u6700\u4F4E\u8840\u91CF\u53CB\u65B9\uFF08\u4F18\u5148\u517D\u65CF\uFF09\uFF1A5\xD7\u7B49\u7EA7+\u653B\u51FB\xD7170%",
    heal: { fixedAdd: 600, atkRatio: 1.7 }
  }
};
var lbmx = {
  id: "lbmx",
  name: "\u88C2\u5730\u86EE\u718A",
  race: "beast" /* Beast */,
  stats: {
    hp: 8960,
    attack: 784.5,
    physicalDef: 450.2,
    magicalDef: 274.8,
    attackInterval: 3.3
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 3.8, magicalDef: 2.2 },
  talent: "\u5F00\u573A\u5486\u54EE,\u5632\u8BBD\u654C\u65B9\u524D\u6392\u6240\u6709\u89D2\u8272\u5F3A\u5236\u653B\u51FB\u81EA\u8EAB 2+\u7B49\u7EA7\xD70.03 s,\u8BE5\u671F\u95F4\u654C\u65B9\u65E0\u6CD5\u4F7F\u7528\u6280\u80FD(\u6BCF\u573A\u4EC5\u4E00\u6B21)\uFF08100\u7EA7\uFF1A5s\uFF09",
  skill: {
    id: "lbmx_smash",
    name: "\u62CD\u51FB",
    tags: ["\u8303\u56F4"],
    cooldown: 8,
    castTime: 0,
    description: "\u524D\u4E2D\u6392\u5168\u4F53\u653B\u51FB\xD7190%\u7269\u7406+\u964D20%\u653B\u901F5s\uFF08\u540E\u6392-40%\u4F24\u5BB3\uFF09",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.9 }],
    aoe: { rows: [0 /* Front */, 1 /* Mid */], maxTargets: 6 }
  }
};
var ds = {
  id: "ds",
  name: "\u6D1E\u72EE",
  race: "beast" /* Beast */,
  stats: {
    hp: 7780,
    attack: 806.5,
    physicalDef: 300.2,
    magicalDef: 287.4,
    attackInterval: 3.5
  },
  growth: { hp: 70, attack: 7.5, physicalDef: 2.8, magicalDef: 2.6 },
  talent: "\u81EA\u8EAB\u4E0D\u4F1A\u88AB\u5176\u4ED6\u5929\u8D4B\xB7\u6548\u679C\u800C\u964D\u4F4E\u653B\u51FB\xB7\u9632\u5FA1",
  skill: {
    id: "ds_bite",
    name: "\u6495\u54AC",
    tags: ["\u5207\u5165", "\u63A7\u5236", "\u5438\u8840"],
    cooldown: 9,
    castTime: 0,
    description: "\u6495\u54AC1\u540D\u654C\u4EBA\uFF0C\u6BCF\u79D2\u653B\u51FB\xD765%+10\u7EAF\u7CB9\u4F24\u5BB3+\u65E0\u6CD5\u884C\u52A8\uFF0C\u81EA\u8EAB\u6062\u590D20%",
    damage: [{ type: "pure" /* Pure */, atkRatio: 0.65, fixedAdd: 10 }],
    priority: [
      { row: 2 /* Back */, chance: 50 },
      { row: 1 /* Mid */, chance: 30 },
      { row: 0 /* Front */, chance: 20 }
    ]
  }
};
var mmx = {
  id: "mmx",
  name: "\u731B\u72B8\u8C61",
  race: "beast" /* Beast */,
  stats: {
    hp: 11250,
    attack: 753,
    physicalDef: 490.8,
    magicalDef: 386.8,
    attackInterval: 4
  },
  growth: { hp: 100, attack: 7, physicalDef: 4.2, magicalDef: 3.2 },
  talent: "\u6BCF\u95F4\u9694 7 s \u8FDB\u5165\u5377\u66F2\u72B6\u6001,\u671F\u95F4\u653B\u51FB\u529B\u964D\u4F4E 25%,\u9632\u5FA1\u529B\u63D0\u534720%+\u7B49\u7EA7\xD70.3%\uFF08100\u7EA7\uFF1A+50%\u9632\u5FA1\uFF09",
  skill: {
    id: "mmx_stomp",
    name: "\u8E29\u8E0F",
    tags: [],
    cooldown: 9,
    castTime: 1,
    description: "110%\u653B\u51FB\u7269\u7406+\u81EA\u8EAB\u9632\u5FA1\xD72\u7EAF\u7CB9\uFF08\u524D\u6392+20%\uFF09",
    damage: [
      { type: "physical" /* Physical */, atkRatio: 1.1 },
      { type: "pure" /* Pure */, selfDefMultiplier: 2 }
    ]
  }
};
var sszs = {
  id: "sszs",
  name: "\u68EE\u4E4B\u5C04\u624B",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 7185,
    attack: 1070,
    physicalDef: 223,
    magicalDef: 198.2,
    attackInterval: 3.5
  },
  growth: { hp: 65, attack: 10, physicalDef: 2, magicalDef: 1.8 },
  talent: "\u83B7\u5F97 20%+\u7B49\u7EA7\xD70.05%\u7684\u95EA\u907F\u6548\u679C\uFF08100\u7EA7\uFF1A25%\uFF09,\u5982\u679C\u540C\u9635\u578B\u8FD8\u6709\u5176\u4ED6\u53CB\u65B9\u730E\u4EBA\u89D2\u8272,\u95EA\u907F\u6548\u679C\u53D8\u4E3A 30%+\u7B49\u7EA7\xD70.1%\uFF08100\u7EA7\uFF1A40%\uFF09",
  skill: {
    id: "sszs_bind",
    name: "\u675F\u7F1A\u5C04\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 6,
    castTime: 0,
    description: "\u653B\u51FB\xD7210%\u7269\u7406+\u675F\u7F1A2s",
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.1 }],
    effects: [{ type: "bind" /* Bind */, duration: 2 }]
  }
};
var bslr = {
  id: "bslr",
  name: "\u51B0\u971C\u730E\u4EBA",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 6640,
    attack: 943,
    physicalDef: 218,
    magicalDef: 214,
    attackInterval: 3.2
  },
  growth: { hp: 60, attack: 9, physicalDef: 2, magicalDef: 2 },
  talent: "\u81EA\u8EAB\u9020\u6210\u4F24\u5BB3\u6709 35%\u51E0\u7387\u65E0\u89C6\u76EE\u6807\u7684\u57FA\u7840\u9632\u5FA1,\u5982\u679C\u81EA\u8EAB\u53D7\u5230\u653B\u51FB\u8FD9\u4E2A\u6548\u679C\u4F1A\u6682\u65F6\u5931\u6548 3 s",
  skill: {
    id: "bslr_shot",
    name: "\u6301\u7EED\u5C04\u51FB",
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "\u5BF91\u6392\u654C\u4EBA\u6301\u7EED\u5C04\u51FB3s\uFF0C\u6BCF\u79D2\u653B\u51FB\xD790%\uFF0C\u6BCF\u6B21\u964D6%\u653B\u901F\uFF08\u53E03\u5C42\uFF09",
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.9 }],
    aoe: { maxTargets: 3 },
    scriptId: "bslr_shot"
  }
};
var hqs = {
  id: "hqs",
  name: "\u706B\u67AA\u624B",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8175,
    attack: 1005.5,
    physicalDef: 216,
    magicalDef: 213,
    attackInterval: 3
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2, magicalDef: 2 },
  talent: "\u81EA\u8EAB\u88AB #\u5207\u5165 \u6280\u80FD\u9009\u4E2D\u4E3A\u76EE\u6807\u65F6\u63D0\u5347\u81EA\u8EAB 50%+\u7B49\u7EA7\xD70.4%\u7684\u9632\u5FA1\u529B\u4E0E 25%+\u7B49\u7EA7\xD70.1%\u7684\u653B\u51FB\u529B,\u6301\u7EED 5 s(\u53EF\u53E0\u52A0)",
  skill: {
    id: "hqs_snipe",
    name: "\u72D9\u51FB",
    tags: [],
    cooldown: 10,
    castTime: 2.5,
    description: "\u7269\u9632\u6700\u9AD8\u654C\u4EBA\uFF1A\u7269\u9632\xD74\u7EAF\u7CB9+\u653B\u51FB\xD7170%\u7269\u7406",
    damage: [
      { type: "pure" /* Pure */, defMultiplier: 4 },
      { type: "physical" /* Physical */, atkRatio: 1.7 }
    ]
  }
};
var mds = {
  id: "mds",
  name: "\u7F8E\u675C\u838E",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8960,
    attack: 971,
    physicalDef: 250.7,
    magicalDef: 269.5,
    attackInterval: 2.8
  },
  growth: { hp: 80, attack: 9, physicalDef: 2.3, magicalDef: 2.5 },
  talent: "\u81EA\u8EAB\u653B\u51FB\u529B-10%,\u4F1A\u540C\u65F6\u5BF9 2 \u540D\u654C\u4EBA\u53D1\u52A8\u653B\u51FB,\u81EA\u8EAB\u5BF9\u5904\u4E8E[\u675F\u7F1A]\u72B6\u6001\u7684\u654C\u4EBA\u653B\u51FB\u6709 35%+\u7B49\u7EA7\xD70.1%\u51E0\u7387\u4F7F\u5176[\u77F3\u5316]2 s",
  skill: {
    id: "mds_skill",
    name: "\u77F3\u5316\u51DD\u89C6",
    tags: ["\u63A7\u5236"],
    cooldown: 8,
    castTime: 0,
    description: "\u524D\u4E2D\u540E\u54041\u540D\u654C\u4EBA\uFF1A\u653B\u51FB\xD7140%\u9B54\u6CD5+\u675F\u7F1A4s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.4 }],
    effects: [{ type: "bind" /* Bind */, duration: 4 }]
  }
};
var zfyx = {
  id: "zfyx",
  name: "\u8FFD\u98CE\u6E38\u4FA0",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8075,
    attack: 1010.5,
    physicalDef: 269.5,
    magicalDef: 217,
    attackInterval: 2.5
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2.5, magicalDef: 2 },
  talent: "\u4E0E\u8BE5\u89D2\u8272\u540C\u9635\u578B\u4F4D\u7F6E\u7684\u6240\u6709\u654C\u65B9\u89D2\u8272\u6BCF\u6B21\u53D1\u52A8\u5E26\u6709 #\u5207\u5165 \u6807\u7B7E\u7684\u6280\u80FD\u4F1A\u5BF9\u5176\u9020\u6210 80% \u4F24\u5BB3\u7684\u653B\u51FB,\u5E76\u4F7F\u6211\u65B9\u540C\u9635\u578B\u6240\u6709\u89D2\u8272\u63D0\u5347 15% \u653B\u51FB\u529B\u6301\u7EED 10 s\uFF08\u4E0D\u53E0\u52A0\uFF09",
  skill: {
    id: "zfyx_arrow",
    name: "\u4E09\u8FDE\u5C04",
    tags: ["\u79FB\u52A8"],
    cooldown: 8,
    castTime: 0,
    description: "\u53D1\u5C043\u679A\u5F13\u7BAD\uFF0C\u6BCF\u6B21\u653B\u51FB\xD7110%\u968F\u673A\u654C\u4EBA\uFF0C\u53D1\u5C04\u540E\u968F\u673A\u79FB\u52A8\u81F3\u7A7A\u4F4D",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.1 }],
    aoe: { maxTargets: 3 }
  }
};
var lxgz = {
  id: "lxgz",
  name: "\u7075\u5F26\u6B4C\u8005",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8620,
    attack: 857,
    physicalDef: 258.6,
    magicalDef: 237.8,
    attackInterval: 3.6
  },
  growth: { hp: 80, attack: 8, physicalDef: 2.4, magicalDef: 2.2 },
  talent: "\u81EA\u8EAB\u53D1\u52A8\u6CBB\u7597\u6280\u80FD\u65F6,\u4F1A\u4F7F\u53D7\u6CBB\u7597\u7684\u76EE\u6807\u83B7\u5F97 [\u6FC0\u6602] \u6548\u679C:\u63D0\u5347 10%+\u7B49\u7EA7\xD70.1%\u7684\u653B\u51FB\u529B\u4E0E 15% \u653B\u51FB\u901F\u5EA6,\u6301\u7EED 5 \u79D2\u3002\uFF08100\u7EA7\uFF1A20%\u653B\u51FB\u63D0\u5347\uFF09",
  skill: {
    id: "lxgz_heal",
    name: "\u6CBB\u6108\u7434\u97F3",
    tags: ["\u6CBB\u7597"],
    cooldown: 11,
    castTime: 2,
    description: "\u5F39\u594F2s\u2192\u6700\u4F4E2\u540D\u53CB\u65B9\u6301\u7EED\u6062\u590D5s\uFF0C\u6BCF\u79D2\u653B\u51FB\xD725%+\u5DF2\u635F\u751F\u547D\xD78%",
    heal: { atkRatio: 0.25, targetLostHpRatio: 0.08 },
    aoe: { maxTargets: 2 }
  }
};
var crzs = {
  id: "crzs",
  name: "\u70BD\u70ED\u6218\u58EB",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 8225,
    attack: 896.5,
    physicalDef: 287.5,
    magicalDef: 232,
    attackInterval: 3
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.5, magicalDef: 2 },
  talent: "\u81EA\u8EAB\u6BCF\u79D2\u5931\u53BB\u6700\u5927\u751F\u547D\u503C\xD71%\u7684\u8840\u91CF,\u53D7\u5230\u4F24\u5BB3+10%\uFF0C\u5BF9\u654C\u65B9\u540C\u9635\u578B\u7684\u6240\u6709\u654C\u65B9\u89D2\u8272\u9020\u6210\u6BCF\u79D2\u81EA\u8EAB\u653B\u51FB\u529B\xD71.5%+\u7B49\u7EA7\xD70.02%\u7684\u7EAF\u7CB9\u4F24\u5BB3\uFF08100\u7EA7\uFF1A\u653B\u51FB\u529B\xD73.5%\uFF09",
  skill: {
    id: "crzs_punch",
    name: "\u707C\u70ED\u62F3\u51FB",
    tags: [],
    cooldown: 4,
    castTime: 0,
    description: "\u653B\u51FB\xD7180%\u7269\u7406+\u707C\u70E73s\uFF0C\u81EA\u53D720%\u53CD\u4F24",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.8 }],
    effects: [{ type: "burn" /* Burn */, duration: 3, value: 0.05 }]
  }
};
var hd = {
  id: "hd",
  name: "\u8F89\u5200",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 7680,
    attack: 956,
    physicalDef: 271.6,
    magicalDef: 210.2,
    attackInterval: 2.5
  },
  growth: { hp: 70, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent: "\u81EA\u8EAB\u653B\u51FB\u529B+15%,\u547D\u4E2D\u7387-15%,\u81EA\u8EAB\u653B\u51FB\u5982\u679C\u6CA1\u6709\u547D\u4E2D,\u4F1A\u53D7\u5230 50%\u7684\u53CD\u4F24",
  skill: {
    id: "hd_slash",
    name: "\u65A9\u51FB",
    tags: [],
    cooldown: 8,
    castTime: 1.5,
    description: "\u968F\u673A1\u6392\u5168\u4F53\uFF1A\u653B\u51FB\xD7200%\u7269\u7406",
    damage: [{ type: "physical" /* Physical */, atkRatio: 2 }],
    aoe: { maxTargets: 3 }
  }
};
var fxz = {
  id: "fxz",
  name: "\u5206\u6790\u8005",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 9215,
    attack: 693.5,
    physicalDef: 297.5,
    magicalDef: 297.5,
    attackInterval: 3.5
  },
  growth: { hp: 85, attack: 6.5, physicalDef: 2.5, magicalDef: 2.5 },
  talent: "\u6218\u6597\u5F00\u59CB\u6807\u8BB0\u654C\u4EBA\u4E0E\u81EA\u8EAB\u5BF9\u79F0\u7684\u4E00\u540D\u89D2\u8272,\u88AB\u6807\u8BB0\u7684\u89D2\u8272\u95EA\u907F\xB7\u989D\u5916\u9632\u5FA1\u53D8\u4E3A0\uFF0C\u76F4\u5230\u5206\u6790\u8005\u9635\u4EA1\u3002",
  skill: {
    id: "fxz_analyze",
    name: "\u5206\u6790",
    tags: ["\u589E\u76CA"],
    cooldown: 6,
    castTime: 0,
    description: "\u63D0\u53473\u540D\u53CB\u65B9\u6700\u4F4E\u9632\u5FA1\u98795%\u9632\u5FA1\u529B\uFF0C\u53EF\u53E010\u6B21",
    scriptId: "fxz_analyze"
  }
};
var fdzs = {
  id: "fdzs",
  name: "\u98CE\u4E4B\u6597\u58EB",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 9660,
    attack: 951,
    physicalDef: 270.6,
    magicalDef: 207.2,
    attackInterval: 2.5
  },
  growth: { hp: 90, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent: "\u5BF9\u524D\u6392\u9020\u6210\u4F24\u5BB3\u63D0\u534720%+\u7B49\u7EA7\xD70.1%",
  skill: {
    id: "fdzs_combo",
    name: "\u75BE\u98CE\u8FDE\u51FB",
    tags: [],
    cooldown: 8,
    castTime: 2,
    description: "2s\u51856\u6B21\u5FEB\u901F\u653B\u51FB\uFF0C\u6BCF\u6B21\u653B\u51FB\xD760%\u4E14\u65E0\u89C6\u57FA\u7840\u9632\u5FA1",
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.6 }],
    aoe: { maxTargets: 1 }
  }
};
var kzs = {
  id: "kzs",
  name: "\u72C2\u6218\u58EB",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 6222,
    attack: 621.3,
    physicalDef: 184.4,
    magicalDef: 140.8,
    attackInterval: 2
  },
  growth: { hp: 58, attack: 5.7, physicalDef: 1.6, magicalDef: 1.2 },
  talent: "\u81EA\u8EAB\u6BCF\u635F\u5931 12% \u6700\u5927\u751F\u547D\u503C,\u63D0\u5347 4%+\u7B49\u7EA7\xD70.08% \u7684\u653B\u51FB\u529B,\u4E0E6%\u4F24\u5BB3\u51CF\u514D,\u6700\u591A\u53E0\u52A0 5 \u5C42(\u5373\u635F\u5931 60% \u751F\u547D\u65F6\u8FBE\u5230\u6700\u5927)\u3002",
  skill: {
    id: "kzs_rage",
    name: "\u8840\u6012",
    tags: ["\u589E\u76CA"],
    cooldown: 11,
    castTime: 0,
    description: "\u6D88\u801710%\u5F53\u524DHP\u21926s\u5185\u653B\u901F+40%\uFF0C\u6BCF\u6B21\u653B\u51FB\u9644\u52A0\u76EE\u6807\u5F53\u524DHP\xD73%\u7EAF\u7CB9",
    effects: [{ type: "bloodrage" /* Bloodrage */, duration: 6 }]
  }
};
var slzs = {
  id: "slzs",
  name: "\u5723\u7075\u6218\u58EB",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 9710,
    attack: 802.5,
    physicalDef: 228,
    magicalDef: 391.5,
    attackInterval: 3.5
  },
  growth: { hp: 90, attack: 7.5, physicalDef: 2, magicalDef: 3.5 },
  talent: "\u6BCF\u6B21\u53D7\u5230\u9B54\u6CD5\u4F24\u5BB3\u670950%\u51E0\u7387\u5BF9\u65BD\u6CD5\u8005\u9020\u6210\u81EA\u8EAB\u653B\u51FB\u529B\xD760%+\u7B49\u7EA7\xD70.25%\u7684\u7EAF\u7CB9\u4F24\u5BB3,\u5E76\u4F7F\u5176[\u7729\u6655]1 s\uFF08100\u7EA7\uFF1A\u653B\u51FB\u529B\xD785%\uFF09\uFF1B\u670950%\u4F7F\u90A3\u6B21\u9B54\u6CD5\u4F24\u5BB3-50%\uFF0C\u5E76\u6062\u590D\u81EA\u8EAB\u5468\u56F4\u968F\u673A1\u540D\u53CB\u65B9\u89D2\u8272\u5269\u4F5950%\u4F24\u5BB3\u7684\u751F\u547D\u503C\u3002",
  skill: {
    id: "slzs_guard",
    name: "\u5B88\u62A4",
    tags: [],
    cooldown: 14,
    castTime: 0,
    description: "\u6D88\u801710%HP\u2192\u5B88\u62A47s\uFF1A\u653B-30%\u3001\u51CF\u4F24+25%\u3001\u540C\u6392\u53CB\u65B9\u9B54\u4F24\u8F6C\u79FB\u81EA\u8EAB"
  }
};
var zqz = {
  id: "zqz",
  name: "\u91CD\u62F3\u8005",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 6244,
    attack: 1139.5,
    physicalDef: 278.5,
    magicalDef: 208.2,
    attackInterval: 4.5
  },
  growth: { hp: 56, attack: 10.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent: "\u81EA\u8EAB\u6BCF\u666E\u901A\u653B\u51FB 4 \u6B21,\u4E0B\u6B21\u653B\u51FB\u9644\u5E26 50%\u5438\u8840\u4E0E\u6301\u7EED 6 s \u7684[\u7834\u7532]\u6548\u679C",
  skill: {
    id: "zqz_strike",
    name: "\u6BC1\u706D\u6253\u51FB",
    tags: ["\u5207\u5165"],
    cooldown: 10,
    castTime: 1,
    description: "\u653B\u51FB\xD7290%\u7269\u7406+\u81EA\u66552s+\u76EE\u6807\u66552s",
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.9 }],
    effects: [{ type: "stun" /* Stun */, duration: 2 }],
    interruptOnAttack: true,
    priority: [{ row: 1 /* Mid */, chance: 100 }]
  }
};
var xdds = {
  id: "xdds",
  name: "\u79C0\u9017\u5927\u5E08",
  race: "mage" /* Mage */,
  stats: {
    hp: 8670,
    attack: 916.4,
    physicalDef: 193.2,
    magicalDef: 325,
    attackInterval: 3.2
  },
  growth: { hp: 80, attack: 8.6, physicalDef: 1.8, magicalDef: 3 },
  talent: "\u81EA\u8EAB\u540C\u6392\u7684\u6240\u6709\u53CB\u65B9\u89D2\u8272\u6BCF\u6B21\u53D1\u52A8\u6280\u80FD\u63D0\u5347\u81EA\u8EAB 5%+\u7B49\u7EA7\xD70.03%\u7684\u653B\u51FB\u901F\u5EA6\u4E0E4%\u6280\u80FD\u5438\u8840,\u6301\u7EED 5 s(\u6700\u5927\u53E0\u52A0 5 \u5C42)\uFF08100\u7EA7\uFF1A+8%\u653B\u51FB\u901F\u5EA6\uFF0C4%\u6280\u80FD\u5438\u8840/\u5C42\uFF0C\u6EE1\u5C42\uFF1A+40%\u653B\u51FB\u901F\u5EA6\uFF0C20%\u6280\u80FD\u5438\u8840\uFF09",
  skill: {
    id: "xdds_fire",
    name: "\u706B\u7403",
    tags: [],
    cooldown: 7,
    castTime: 1.5,
    description: "\u653B\u51FB\xD7210%\u9B54\u6CD5\uFF0C\u6BCF3\u6B21\u5347\u7EA7\u9668\u77F3(1\u6392+\u653B\u51FB\xD7260%+\u707C\u70E73s)",
    damage: [{ type: "magical" /* Magical */, atkRatio: 2.1 }],
    priority: [
      { row: 0 /* Front */, chance: 40 },
      { row: 1 /* Mid */, chance: 35 },
      { row: 2 /* Back */, chance: 25 }
    ],
    scriptId: "xdds_fire"
  }
};
var sjsn = {
  id: "sjsn",
  name: "\u6C34\u6676\u5BA4\u5973",
  race: "mage" /* Mage */,
  stats: {
    hp: 7630,
    attack: 768,
    physicalDef: 166.5,
    magicalDef: 262.6,
    attackInterval: 4
  },
  growth: { hp: 70, attack: 7, physicalDef: 1.5, magicalDef: 2.4 },
  talent: "\u4E0E\u81EA\u8EAB\u524D\xB7\u540E\xB7\u5DE6\xB7\u53F3\u5404 1 \u683C\u7684\u53CB\u65B9\u6CD5\u5E08\u89D2\u8272\u6280\u80FD\u51B7\u5374\u51CF\u5C11 15%+\u7B49\u7EA7\xD70.05%(\u5BF9\u81EA\u8EAB\u65E0\u6548)",
  skill: {
    id: "sjsn_freeze",
    name: "\u51B0\u5C01",
    tags: ["\u63A7\u5236"],
    cooldown: 8,
    castTime: 0,
    description: "1\u540D\u654C\u65B9\u675F\u7F1A+\u7F34\u68B0+\u6BCF\u79D2\u653B\u51FB\xD790%\u9B54\u6CD5\uFF0C\u6301\u7EED3s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.9 }],
    effects: [
      { type: "bind" /* Bind */, duration: 3 },
      { type: "disarm" /* Disarm */, duration: 3 }
    ]
  }
};
var bmxz = {
  id: "bmxz",
  name: "\u767D\u9A6C\u884C\u8005",
  race: "mage" /* Mage */,
  stats: {
    hp: 8770,
    attack: 862,
    physicalDef: 163.5,
    magicalDef: 307.2,
    attackInterval: 3
  },
  growth: { hp: 80, attack: 8, physicalDef: 1.5, magicalDef: 2.8 },
  talent: "\u53CB\u65B9\u5168\u573A\u6CD5\u5E08\u6BCF\u6B21\u5BF9\u654C\u65B9\u65BD\u52A0\u5F02\u5E38\u72B6\u6001,\u4F1A\u4F7F\u81EA\u8EAB\u6280\u80FD\u51CF\u5C11 1 s \u51B7\u5374\u65F6\u95F4\uFF0C\u5E76\u63D0\u5347\u57FA\u7840\u653B\u51FB\u529B\u76840.8%\u7684\u653B\u51FB\u529B\uFF0C\u76F4\u5230\u6218\u6597\u7ED3\u675F\u3002",
  skill: {
    id: "bmxz_charge",
    name: "\u84C4\u529B",
    tags: [],
    cooldown: 10,
    castTime: 0,
    description: "\u968F\u673A\u84C4\u529B1/2/3s\u2192\u524D\u6392/\u524D\u4E2D\u6392/\u5168\u573A\uFF1A\u653B\u51FB\xD7190%\u9B54\u6CD5(\u547D\u4E2D5\u540D-30%)",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.9 }],
    aoe: { maxTargets: 9 },
    scriptId: "bmxz_charge"
  }
};
var srm = {
  id: "srm",
  name: "\u98DF\u4EBA\u9B54\u9B54\u6CD5\u5E08",
  race: "mage" /* Mage */,
  stats: {
    hp: 11545,
    attack: 703.5,
    physicalDef: 348.8,
    magicalDef: 301.2,
    attackInterval: 3.2
  },
  growth: { hp: 105, attack: 6.5, physicalDef: 3.2, magicalDef: 2.8 },
  talent: "\u53CB\u65B9\u9635\u4EA1\u2192\u63D0\u53478%\u6700\u5927HP\u4E0A\u9650+\u6062\u590D10%\u6700\u5927HP",
  skill: {
    id: "srm_fire",
    name: "\u706B\u7130\u7206\u8F70",
    tags: ["\u63A7\u5236"],
    cooldown: 5,
    castTime: 0,
    description: "\u6D88\u80175%HP\u2192\u653B\u51FB\xD7160%\u9B54\u6CD5+\u7729\u66550.5s(40%2\u6B21/20%3\u6B21)",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.6 }],
    effects: [{ type: "stun" /* Stun */, duration: 0.5 }],
    scriptId: "srm_fire"
  }
};
var ynfs = {
  id: "ynfs",
  name: "\u6E6E\u706D\u6CD5\u5E08",
  race: "mage" /* Mage */,
  stats: {
    hp: 7630,
    attack: 852,
    physicalDef: 216,
    magicalDef: 321,
    attackInterval: 4
  },
  growth: { hp: 70, attack: 8, physicalDef: 2, magicalDef: 3 },
  talent: "\u6218\u6597\u5F00\u59CB 1 s \u540E,\u4F7F\u4E0E\u81EA\u8EAB\u4EE5\u53CA\u4E0E\u81EA\u8EAB\u5BF9\u79F0\u7684 1 \u540D\u654C\u65B9\u89D2\u8272\u6682\u65F6\u4F20\u9001\u79BB\u5F00\u573A\u5730\u3002\u7ECF\u8FC7 3 s \u540E\u81EA\u8EAB\u4F1A\u8FD4\u56DE\u6218\u6597\u573A\u5730,\u7ECF\u8FC7 4+\u7B49\u7EA7 \xD70.02 s \uFF08100\u7EA7\uFF1A6s\uFF09\u540E\u90A3\u4E2A\u654C\u65B9\u89D2\u8272\u4F1A\u8FD4\u56DE\u6218\u6597\u573A\u5730\u3002",
  skill: {
    id: "ynfs_annihilate",
    name: "\u6E6E\u706D",
    tags: ["\u63A7\u5236"],
    cooldown: 10,
    castTime: 2,
    description: "2\xD72\u683C\u5B50\uFF1A\u76EE\u6807\u603B\u9632\u5FA1\xB2/350\u7EAF\u7CB9+\u675F\u7F1A4s",
    damage: [{ type: "pure" /* Pure */, defSquaredDiv: 350 }],
    effects: [{ type: "bind" /* Bind */, duration: 4 }]
  }
};
var syz = {
  id: "syz",
  name: "\u795E\u8C15\u8005",
  race: "mage" /* Mage */,
  stats: {
    hp: 7730,
    attack: 857,
    physicalDef: 267.5,
    magicalDef: 327,
    attackInterval: 4
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 3 },
  talent: "\u81EA\u8EAB\u6BCF\u6B21\u653B\u51FB\u5BF9\u6211\u65B9\u968F\u673A 1 \u540D\u53CB\u65B9\u89D2\u8272\u63D0\u4F9B\u653B\u51FB\u529B\xD750%\u7684\u6CBB\u7597\u6548\u679C\uFF0880%\u51E0\u7387\u5BF9\u6211\u65B9\u6700\u4F4E\u8840\u91CF\u5355\u4F4D\u53D1\u52A8\uFF09\u81EA\u8EAB\u9635\u4EA1\u65F6\uFF0C\u4E3A\u6211\u65B9\u5168\u573A\u6CD5\u5E08\u89D2\u8272\u63D0\u4F9B\u6BCF\u79D2\u653B\u51FB\u529B\xD770%\u7684\u6CBB\u7597\u4E0E15%\u4F24\u5BB3\u51CF\u514D\uFF0C\u6301\u7EED6s\uFF08\u6BCF\u79D2\u540E\u6CBB\u7597\u6548\u679C\u3001\u4F24\u5BB3\u51CF\u514D+10%\uFF09",
  skill: {
    id: "syz_bless",
    name: "\u795E\u4E4B\u5E87\u4F51",
    tags: [],
    cooldown: 12,
    castTime: 0,
    description: "2\u540D\u6700\u4F4E\u8840\u91CF\u53CB\u65B9\uFF1A\u51CF\u4F2420%+\u5EF6\u8FDF5s\u7ED3\u7B97+\u9A71\u6563\uFF0C\u6301\u7EED7s",
    effects: [{ type: "inspire" /* Inspire */, duration: 7, value: 0.8 }],
    scriptId: "syz_bless"
  }
};
var wqqs = {
  id: "wqqs",
  name: "\u4EA1\u9B42\u9A91\u58EB",
  race: "undead" /* Undead */,
  stats: {
    hp: 7135,
    attack: 812.5,
    physicalDef: 203.2,
    magicalDef: 376.5,
    attackInterval: 3
  },
  growth: { hp: 65, attack: 7.5, physicalDef: 1.8, magicalDef: 3.5 },
  talent: "\u654C\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u540D\u5904\u4E8E[\u8BC5\u5492]\u72B6\u6001\u7684\u654C\u4EBA,\u81EA\u8EAB\u653B\u51FB\u529B+5%\uFF0C\u95EA\u907F\u7387+3%\uFF0C\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u6548\u679C+50%",
  skill: {
    id: "wqqs_move",
    name: "\u4EA1\u9B42\u7A81\u88AD",
    tags: ["\u79FB\u52A8"],
    cooldown: 7,
    castTime: 0,
    description: "\u968F\u673A\u79FB\u52A8\u2192\u5BF91\u540D\u654C\u4EBA\u9020\u6210\u653B\u51FB\xD7100%\u7EAF\u7CB9+\u5468\u56F4\u683C\u5B50\u8BC5\u54923s",
    damage: [{ type: "pure" /* Pure */, atkRatio: 1 }],
    effects: [{ type: "curse" /* Curse */, duration: 3 }]
  }
};
var kldd = {
  id: "kldd",
  name: "\u9AB7\u9AC5\u5927\u5E1D",
  race: "undead" /* Undead */,
  stats: {
    hp: 9810,
    attack: 852,
    physicalDef: 332,
    magicalDef: 275.5,
    attackInterval: 3.5
  },
  growth: { hp: 90, attack: 8, physicalDef: 3, magicalDef: 2.5 },
  talent: "\u6218\u6597\u5F00\u59CB\u53EC\u5524 3 \u4E2A\u9AB7\u9AC5\u5175\u534F\u52A9\u6218\u6597,\u81EA\u8EAB\u9635\u4EA1\u65F6\u6211\u65B9\u6240\u6709\u9AB7\u9AC5\u5175\u4E00\u540C\u9635\u4EA1\u3002\u9AB7\u9AC5\u5175\u5B58\u5728\u671F\u95F4\uFF0C\u654C\u65B9\u653B\u51FB\xB7\u6280\u80FD\u4F18\u5148\u5BF9\u9AB7\u9AC5\u5175\u53D1\u52A8\u3002\u81EA\u8EAB\u590D\u6D3B\u540E,\u91CD\u65B0\u53EC\u5524 3 \u4E2A\u9AB7\u9AC5\u5175(\u9AB7\u9AC5\u5175\u89C6\u4E3A\u72EC\u7ACB\u5355\u4F4D,\u4E0E\u9AB7\u9AC5\u5927\u5E1D\u5904\u4E8E\u540C\u4E00\u683C,\u8303\u56F4\u4F24\u5BB3\u53EF\u540C\u65F6\u547D\u4E2D\u9AB7\u9AC5\u5927\u5E1D\u53CA\u9AB7\u9AC5\u5175)",
  skill: {
    id: "kldd_hammer",
    name: "\u51A5\u706B\u4E4B\u9524",
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "\u653B\u51FB\xD7170%\u9B54\u6CD5+\u7729\u66551s\uFF1B3s\u540E\u8FFD\u52A080%\u7EAF\u7CB9",
    damage: [
      { type: "magical" /* Magical */, atkRatio: 1.7 },
      { type: "pure" /* Pure */, atkRatio: 0.8 }
    ],
    effects: [{ type: "stun" /* Stun */, duration: 1 }]
  }
};
var klb = {
  id: "klb",
  name: "\u9AB7\u9AC5\u5175",
  race: "undead" /* Undead */,
  stats: {
    hp: 1090,
    attack: 218,
    physicalDef: 119,
    magicalDef: 530,
    attackInterval: 2
  },
  growth: { hp: 10, attack: 2, physicalDef: 1, magicalDef: 5 },
  talent: "\u4F18\u5148\u653B\u51FB\u51A5\u706B\u4E4B\u9524\u76EE\u6807\uFF1B\u65E0\u89C640%\u9632\u5FA1\uFF1B30%\u4F24\u5BB3\u6CBB\u7597\u9AB7\u9AC5\u5927\u5E1D",
  skill: {
    id: "klb_attack",
    name: "\u653B\u51FB",
    tags: [],
    cooldown: 2,
    castTime: 0,
    description: "\u666E\u901A\u653B\u51FB",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1 }]
  }
};
var yammxz = {
  id: "yammxz",
  name: "\u5E7D\u6697\u5BC6\u884C\u8005",
  race: "undead" /* Undead */,
  stats: {
    hp: 7035,
    attack: 772.8,
    physicalDef: 168.5,
    magicalDef: 262.6,
    attackInterval: 3.5
  },
  growth: { hp: 65, attack: 7.2, physicalDef: 1.5, magicalDef: 2.4 },
  talent: "\u6BCF\u7ECF\u8FC7 8 s \u4F7F\u4E0E\u81EA\u8EAB\u540C\u9635\u578B\u7684\u654C\u65B9\u6240\u6709\u89D2\u8272\u9677\u5165[\u8BC5\u5492]\u72B6\u6001\u6301\u7EED 5 s,\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u5347\u7EA7\u4E3A\uFF1A\u4E0E\u81EA\u8EAB\u540C\u9635\u578B\u7684\u654C\u65B9\u5355\u4F4D\u9677\u5165[\u8BC5\u5492]\u4E0E[\u7834\u574F]\u72B6\u6001",
  skill: {
    id: "yammxz_swap",
    name: "\u6697\u5F71\u6362\u4F4D",
    tags: ["\u79FB\u52A8"],
    cooldown: 7,
    castTime: 0,
    description: "\u4E0E\u53CB\u65B9\u6362\u4F4D\u2192\u5BF9\u79F02\u540D\u654C\u4EBA\u6C89\u9ED84s+\u653B\u51FB\xD790%\u7EAF\u7CB9",
    damage: [{ type: "pure" /* Pure */, atkRatio: 0.9 }],
    effects: [{ type: "silence" /* Silence */, duration: 4 }]
  }
};
var dyq = {
  id: "dyq",
  name: "\u5730\u72F1\u4E4B\u72AC",
  race: "undead" /* Undead */,
  stats: {
    hp: 8125,
    attack: 916.5,
    physicalDef: 235.8,
    magicalDef: 257.6,
    attackInterval: 3
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.2, magicalDef: 2.4 },
  talent: "\u653B\u51FB\u4E0E\u6280\u80FD\u5206\u522B\u670925%\u51E0\u7387\u4E0E45%\u51E0\u7387\u89E6\u53D1[\u81F4\u547D\u4E00\u51FB],\u9020\u6210140%\u4F24\u5BB3,\u590D\u6D3B\u540E,\u81F4\u547D\u4E00\u51FB\u4F24\u5BB3\u53D8\u4E3A180%\u3002[\u81F4\u547D\u4E00\u51FB]\u4E0E\u66B4\u51FB\u72EC\u7ACB\u5224\u5B9A,\u82E5\u540C\u65F6\u89E6\u53D1\u53D6\u4F24\u5BB3\u8F83\u9AD8\u8005\u3002",
  skill: {
    id: "dyq_dash",
    name: "\u51B2\u523A",
    tags: ["\u79FB\u52A8"],
    cooldown: 7,
    castTime: 0,
    description: "\u7AD6\u6392\u5168\u4F53\u653B\u51FB\xD7170%\u9B54\u6CD5+30%\u707C\u70E74s\uFF08\u547D\u4E2D3\u4EBA-30%\uFF09",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.7 }],
    effects: [{ type: "burn" /* Burn */, duration: 4, value: 0.05, chance: 0.3 }],
    aoe: { maxTargets: 3 }
  }
};
var hlyl = {
  id: "hlyl",
  name: "\u706B\u7130\u7FFC\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 8720,
    attack: 802.5,
    physicalDef: 162.6,
    magicalDef: 374.6,
    attackInterval: 3.5
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 1.4, magicalDef: 3.4 },
  talent: "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u653B\u51FB\u529B-5%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u653B\u51FB+5%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\uFF0C\u6211\u65B9\u5176\u4ED6\u9F99\u65CF+3%\u653B\u51FB",
  skill: {
    id: "hlyl_fire",
    name: "\u706B\u7130\u55B7\u5410",
    tags: [],
    cooldown: 8,
    castTime: 1,
    description: "\u524D\u6392\u6700\u4F4E\u8840\uFF1A\u6BCF\u79D2\u653B\u51FB\xD750%\u9B54\u6CD5\uFF0C\u6301\u7EED6s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.5 }],
    aoe: { maxTargets: 1 }
  }
};
var bsxl = {
  id: "bsxl",
  name: "\u51B0\u971C\u90AA\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 8700,
    attack: 693.5,
    physicalDef: 223,
    magicalDef: 379.5,
    attackInterval: 3.6
  },
  growth: { hp: 80, attack: 6.5, physicalDef: 2, magicalDef: 3.5 },
  talent: "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u9632\u5FA1-5%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u9632\u5FA1+5%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF+2%\u9632\u5FA1",
  skill: {
    id: "bsxl_freeze",
    name: "\u51B0\u971C\u5410\u606F",
    tags: ["\u63A7\u5236"],
    cooldown: 10,
    castTime: 1,
    description: "\u540E\u6392\u5168\u90E8\uFF1A\u964D20%\u653B\u901F+\u6BCF\u79D2\u653B\u51FB\xD780%\u9B54\u6CD53s\uFF1B\u6BCF3\u6B21\u2192\u51B0\u51BB",
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.8 }],
    aoe: { maxTargets: 3 },
    scriptId: "bsxl_freeze"
  }
};
var xyfl = {
  id: "xyfl",
  name: "\u8840\u7FFC\u98DE\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 8920,
    attack: 916.5,
    physicalDef: 220,
    magicalDef: 346.8,
    attackInterval: 3
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 3.2 },
  talent: "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4+4%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4-4%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4-2%",
  skill: {
    id: "xyfl_chaos",
    name: "\u4E71\u5E8F\u6253\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 9,
    castTime: 1,
    description: "\u968F\u673A2\u6392\u5168\u4F53\uFF1A\u653B\u51FB\xD7190%\u7269\u7406+60%\u6253\u4E71\u4F4D\u7F6E",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.9 }],
    aoe: { maxTargets: 6 }
  }
};
var hbfl = {
  id: "hbfl",
  name: "\u5BD2\u51B0\u98DE\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 7680,
    attack: 646,
    physicalDef: 275.5,
    magicalDef: 243.8,
    attackInterval: 3
  },
  growth: { hp: 70, attack: 6, physicalDef: 2.5, magicalDef: 2.2 },
  talent: "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u6280\u80FD\u51B7\u5374+4%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u6280\u80FD\u51B7\u5374-4%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF\u6280\u80FD\u51B7\u5374-2%",
  skill: {
    id: "hbfl_heal",
    name: "\u51B0\u5C01\u6CBB\u7597",
    tags: ["\u6CBB\u7597"],
    cooldown: 12,
    castTime: 1,
    description: "\u51B0\u5C01<50%HP\u9F99\u65CF4s\uFF08\u514D\u75AB\u7269\u7406\uFF09\uFF0C\u6BCF\u79D2\u653B\u51FB\xD750%+\u6700\u5927HP\xD74%",
    heal: { atkRatio: 0.5, targetMaxHpRatio: 0.04 }
  }
};
var bjl = {
  id: "bjl",
  name: "\u66B4\u541B\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 8850,
    attack: 975.8,
    physicalDef: 221,
    magicalDef: 353.7,
    attackInterval: 3.5
  },
  growth: { hp: 80, attack: 9.2, physicalDef: 2, magicalDef: 3.3 },
  talent: "\u6218\u6597\u5F00\u59CB\uFF0C\u53D1\u51FA\u543C\u53EB\uFF0C\u4F7F\u5168\u573A\u975E\u9F99\u65CF\u89D2\u8272\u9632\u5FA1\u529B\u964D\u4F4E 30%+\u7B49\u7EA7\xD70.2%\uFF08100\u7EA7\uFF1A-50%\u9632\u5FA1\uFF09\uFF0C\u8FD9\u4E2A\u6548\u679C\u6BCF 6 s \u51CF\u5C11 15%\uFF0C\u6700\u4F4E\u964D\u81F3\u539F\u672C\u7684 25%",
  skill: {
    id: "bjl_wing",
    name: "\u7FC5\u51FB",
    tags: ["\u5207\u5165"],
    cooldown: 9,
    castTime: 0,
    description: "\u4E2D\u540E\u6392\u54041\u540D\uFF1A\u7B2C1\u4E2A180%\u7269\u4F24+30%\u964D\u653B\u901F4s\uFF0C\u7B2C2\u4E2A230%\u7269\u4F24",
    damage: [
      { type: "physical" /* Physical */, atkRatio: 1.8 },
      { type: "physical" /* Physical */, atkRatio: 2.3 }
    ],
    aoe: { maxTargets: 2 },
    scriptId: "bjl_wing"
  }
};
var zs = {
  id: "zs",
  name: "\u5B99\u65AF",
  race: "mage" /* Mage */,
  stats: {
    hp: 8820,
    attack: 931.5,
    physicalDef: 218,
    magicalDef: 281.5,
    attackInterval: 3.5
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 2.5 },
  talent: "\u81EA\u8EAB\u653B\u51FB\xB7\u6280\u80FD\u5404\u670935%/50%\u51E0\u7387\u9644\u52A0\u76EE\u6807\u5F53\u524D\u751F\u547D\u503C\xD78%\u7684\u9B54\u6CD5\u4F24\u5BB3",
  skill: {
    id: "zs_storm",
    name: "\u795E\u4E4B\u6012\u96F7",
    tags: [],
    cooldown: 11,
    castTime: 2,
    description: "\u5168\u5C4F\u653B\u51FB\xD7150-180%\u9B54\u6CD5",
    damage: [
      { type: "magical" /* Magical */, atkRatio: 1.65, targetCurrentHpRatio: 0.08 }
    ],
    aoe: { maxTargets: 9 },
    interruptOnAttack: true
  }
};
var xjl = {
  id: "xjl",
  name: "\u5C0F\u7CBE\u7075",
  race: "mage" /* Mage */,
  stats: {
    hp: 11990,
    attack: 748,
    physicalDef: 322,
    magicalDef: 272.5,
    attackInterval: 4.5
  },
  growth: { hp: 110, attack: 7, physicalDef: 3, magicalDef: 2.5 },
  talent: "\u6211\u65B9\u5168\u573A\u5355\u4F4D\u6BCF\u6B21\u53D1\u52A8\u6280\u80FD\u5BF9\u654C\u65B9\u9020\u6210\u4F24\u5BB3\uFF0C\u81EA\u8EAB\u6062\u590D\u6700\u5927\u751F\u547D\u503C\xD71%\u7684\u8840\u91CF\uFF08\u6BCF2s\u6700\u591A\u901A\u8FC7\u8BE5\u5929\u8D4B\u6062\u590D\u6700\u5927\u751F\u547D\u503C\xD76%\u7684\u8840\u91CF\uFF09",
  skill: {
    id: "xjl_link",
    name: "\u94FE\u63A5",
    tags: [],
    cooldown: 11,
    castTime: 0,
    description: "\u94FE\u63A51\u540D\u53CB\u65B98s\uFF1A+30%\u6280\u80FD\u589E\u5F3A+20%\u6280\u80FD\u5438\u8840\uFF0C\u81EA\u8EAB\u627F\u62C525%\u4F24\u5BB3",
    scriptId: "xjl_link"
  }
};
var swxz = {
  id: "swxz",
  name: "\u6B7B\u4EA1\u5148\u77E5",
  race: "undead" /* Undead */,
  stats: {
    hp: 10850,
    attack: 797.5,
    physicalDef: 329,
    magicalDef: 358.8,
    attackInterval: 3.6
  },
  growth: { hp: 100, attack: 7.5, physicalDef: 3, magicalDef: 3.2 },
  talent: "\u81EA\u8EAB\u5BF9\u5904\u4E8E[\u8BC5\u5492]\u72B6\u6001\u654C\u4EBA\u6BCF\u7D2F\u79EF\u9020\u6210700\u4F24\u5BB3\uFF0C\u83B7\u5F973%\u4F24\u5BB3\u51CF\u514D\u76F4\u5230\u6218\u6597\u7ED3\u675F\uFF08\u6700\u5927\u53E0\u52A010\u5C42\uFF09 \uFF08\u8BA1\u7B97\u5B9E\u9645\u9020\u6210\u7684\u4F24\u5BB3\uFF09",
  skill: {
    id: "swxz_drain",
    name: "\u5438\u9B42\u5DEB\u672F",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description: "\u5438\u53D6\u968F\u673A\u5355\u4F4D5s\uFF1A\u6BCF\u79D2\u653B\u51FB\xD710%+\u6700\u5927HP\xD73%\u9B54\u6CD5\uFF0C\u81EA\u8EAB\u5438\u884020%\u3002\u4F18\u5148\u524D\u6392\u3002\u88AB\u76EE\u6807\u653B\u51FB\u4E2D\u65AD\u3002\u7ED3\u675F\u540E\u8BC5\u54924s",
    scriptId: "swxz_drain",
    priority: [
      { row: 0 /* Front */, chance: 70 },
      { row: 1 /* Mid */, chance: 15 },
      { row: 2 /* Back */, chance: 15 }
    ]
  }
};
var xcl = {
  id: "xcl",
  name: "\u661F\u8FB0\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 5948,
    attack: 832.2,
    physicalDef: 228.9,
    magicalDef: 322,
    attackInterval: 3
  },
  growth: { hp: 52, attack: 7.8, physicalDef: 2.1, magicalDef: 3 },
  talent: "\uFF08\u661F\u8FB0\u9A71\u9010\uFF09\u4F7F\u573A\u4E0A\u7B2C\u4E00\u4E2A\u53D1\u52A8\u6280\u80FD\u7684\u975E\u9F99\u65CF\u89D2\u8272\u6682\u65F6\u79BB\u5F00\u573A\u4E0A3s\uFF0C\u56DE\u5F52\u540E\u90A3\u4E2A\u6280\u80FD\u53D8\u4E3A\u51B7\u5374\u72B6\u6001\u3002\uFF08\u90A3\u6B21\u6280\u80FD\u53D1\u52A8\u65E0\u6548\uFF09",
  skill: {
    id: "xcl_star",
    name: "\u661F\u8FB0\u51B2\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 10,
    castTime: 2,
    description: "2\xD72\u968F\u673A\u683C\u5B50\uFF1A\u653B\u51FB\xD7180%\u9B54\u6CD5+20%\u6C89\u9ED8/20%\u7F34\u68B03s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.8 }],
    aoe: { maxTargets: 4 },
    effects: [
      { type: "silence" /* Silence */, duration: 3 },
      { type: "disarm" /* Disarm */, duration: 3 }
    ]
  }
};
var dl = {
  id: "dl",
  name: "\u5730\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 7730,
    attack: 862,
    physicalDef: 274.5,
    magicalDef: 223,
    attackInterval: 3.3
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 2 },
  talent: "\uFF08\u7C97\u66B4\u9F99\u76AE\uFF09\u666E\u901A\u653B\u51FB\u81EA\u8EAB\u7684\u654C\u65B9\u670950%\u51E0\u7387\u4F1A\u53D7\u5230\u81EA\u8EAB\u653B\u51FB\xD710%\u7684\u7EAF\u7CB9\u4F24\u5BB3\uFF0C\u670950%\u4F7F\u90A3\u6B21\u4F24\u5BB3-40%",
  skill: {
    id: "dl_stomp",
    name: "\u9F99\u8E0F",
    tags: ["\u63A7\u5236"],
    cooldown: 10,
    castTime: 2,
    description: "\u5168\u5C4F\u653B\u51FB\xD7150%\u7269\u7406\uFF08\u524D\u6392140%/\u4E2D\u6392110%/\u540E\u639280%\uFF09+\u964D\u547D\u4E2D20%5s",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.5 }],
    aoe: { maxTargets: 9 },
    scriptId: "dl_stomp"
  }
};
var lyz = {
  id: "lyz",
  name: "\u9F99\u541F\u8005",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 9465,
    attack: 644,
    physicalDef: 287.4,
    magicalDef: 350.8,
    attackInterval: 5
  },
  growth: { hp: 85, attack: 6, physicalDef: 2.6, magicalDef: 3.2 },
  talent: "\u81EA\u8EAB\u53EA\u80FD\u653E\u7F6E\u5728\u524D\u6392\uFF0C\u5982\u679C\u56E0\u5176\u4ED6\u6280\u80FD/\u5929\u8D4B\u800C\u79BB\u5F00\u524D\u6392\uFF0C\u6BCF\u79D2\u5931\u53BB3%\u6700\u5927\u751F\u547D\u503C\u3002\u573A\u4E0A\u6BCF\u5B58\u57281\u53EA\u9F99\u65CF\u89D2\u8272\u63D0\u5347\u81EA\u8EAB5%\u9632\u5FA1\u529B\uFF0C\u6BCF\u5B58\u57281\u53EA\u975E\u9F99\u65CF\u89D2\u8272\u964D\u4F4E\u81EA\u8EAB4%\u9632\u5FA1\u529B\uFF08\u6570\u53CC\u65B9\u573A\u4E0A\u89D2\u8272\uFF0C\u5305\u542B\u81EA\u8EAB\uFF09\u3002",
  skill: {
    id: "lyz_heal",
    name: "\u9F99\u541F\u6CBB\u6108",
    tags: ["\u6CBB\u7597"],
    cooldown: 11,
    castTime: 2,
    description: "\u6700\u4F4EHP\u9F99\u65CF\uFF1A\u6BCF\u79D2\u653B\u51FB\xD740%+20%\u51CF\u4F244s\uFF1B4\u6B21\u540E\u5347\u7EA7\u53CC\u76EE\u680770%+30%\u51CF\u4F24\uFF1B\u9F99\u65CF\u9635\u4EA1\u65F6\u968F\u673A\u590D\u6D3B1\u53EA5s",
    heal: { atkRatio: 0.4 },
    scriptId: "lyz_heal"
  }
};
var xjlr = {
  id: "xjlr",
  name: "\u9677\u9631\u730E\u4EBA",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8225,
    attack: 966,
    physicalDef: 237.8,
    magicalDef: 196.2,
    attackInterval: 3.5
  },
  growth: { hp: 75, attack: 9, physicalDef: 2.2, magicalDef: 1.8 },
  talent: "\u6218\u6597\u5F00\u59CB\uFF0C\u5728\u654C\u65B9\u573A\u5730\u968F\u673A2\u4E2A\u683C\u5B50\u653E\u7F6E[\u9677\u9631]\uFF0C\u5904\u4E8E\u9677\u9631\u683C\u5B50\u4E0A\u7684\u654C\u65B9\u5355\u4F4D\u65E0\u6CD5\u4F7F\u7528 #\u79FB\u52A8 / #\u5207\u5165 \u6807\u7B7E\u7684\u6280\u80FD\uFF0C\u540C\u65F6\u6BCF3s\u5931\u53BB\u6700\u5927\u751F\u547D\u503C\xD75%\u7684\u8840\u91CF\u3002\u81EA\u8EAB\u9635\u4EA1\u65F6\uFF0C\u654C\u65B9\u573A\u4E0A\u5168\u90E8\u9677\u9631\u6E05\u7A7A\u3002",
  skill: {
    id: "xjlr_trap",
    name: "\u8D85\u7EA7\u9677\u9631",
    tags: ["\u63A7\u5236"],
    cooldown: 8,
    castTime: 0,
    description: "\u653E1\u4E2A\u8D85\u7EA7\u9677\u9631\uFF1A\u65E0\u6CD5\u79FB\u52A8/\u5207\u5165\uFF0C\u6BCF2s\u653B\u51FB\xD780%+\u6700\u5927HP\xD72%\u7EAF\u7CB9\uFF0C\u6301\u7EED20s",
    scriptId: "xjlr_trap"
  }
};
var xblr = {
  id: "xblr",
  name: "\u897F\u90E8\u730E\u4EBA",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8342,
    attack: 1045,
    physicalDef: 248.7,
    magicalDef: 236.8,
    attackInterval: 2.8
  },
  growth: { hp: 78, attack: 10, physicalDef: 2.3, magicalDef: 2.2 },
  talent: "\u6BCF\u5F53\u6211\u65B9\u573A\u4E0A\u5176\u4ED6\u730E\u4EBA\u89D2\u8272\u53D1\u52A8\u7F81\u7ECA\u6548\u679C\u7684[\u53CD\u51FB]\u65F6\uFF0C\u81EA\u8EAB\u4E5F\u4F1A\u5BF9\u654C\u65B9\u968F\u673A1\u4E2A\u76EE\u6807\u53D1\u8D771\u6B21\u653B\u51FB\uFF0C\u8FD9\u6B21\u653B\u51FB\u66B4\u51FB\u7387+40%",
  skill: {
    id: "xblr_shot",
    name: "\u8DF3\u8DC3\u5C04\u51FB",
    tags: ["\u79FB\u52A8"],
    cooldown: 10,
    castTime: 0,
    description: "\u8DF3\u81F3\u7A7A\u4F4D\u21921-3\u540D\u654C\u4EBA\u54043\u53D1\uFF1A80%/90%/120%+\u7B2C3\u53D1\u5FC5\u66B4\u51FB",
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.97 }],
    aoe: { maxTargets: 3 },
    scriptId: "xblr_shot"
  }
};
var ldshz = {
  id: "ldshz",
  name: "\u6797\u5730\u5B88\u62A4\u8005",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 10110,
    attack: 758,
    physicalDef: 361.8,
    magicalDef: 337,
    attackInterval: 3.5
  },
  growth: { hp: 90, attack: 7, physicalDef: 3.2, magicalDef: 3 },
  talent: "\uFF08\u81EA\u7136\u62A4\u76FE\uFF09\u81EA\u8EAB\u53D7\u5230\u6280\u80FD\u4F24\u5BB3\u65F6\uFF0C\u6709 40%+\u7B49\u7EA7\xD70.1% \u51E0\u7387\u83B7\u5F97\u4E00\u4E2A\u62A4\u76FE\uFF0C\u62A4\u76FE\u503C\u4E3A\u81EA\u8EAB\u653B\u51FB\u529B\xD7600%\uFF0C\u6301\u7EED 4 \u79D2\uFF08\u51B7\u5374 5 \u79D2\uFF09\u3002\u62A4\u76FE\u7834\u788E\u65F6\uFF0C\u4F7F\u6211\u65B9\u573A\u4E0A\u6240\u6709\u5E73\u5206\u62A4\u76FE\u503C\u7684\u6062\u590D\u6548\u679C\u3002",
  skill: {
    id: "ldshz_buff",
    name: "\u81EA\u7136\u5B88\u62A4",
    tags: ["\u589E\u76CA"],
    cooldown: 12,
    castTime: 0,
    description: "\u5168\u961F+20%\u53CC\u9632+\u540C\u6392\u540E\u6392\u53CB\u65B9+20%\u66B4\u51FB+30%\u5438\u88406s",
    scriptId: "ldshz_buff"
  }
};
var jdds = {
  id: "jdds",
  name: "\u51B3\u6597\u5927\u5E08",
  race: "warrior" /* Warrior */,
  stats: {
    hp: 8225,
    attack: 812.5,
    physicalDef: 279.5,
    magicalDef: 208.2,
    attackInterval: 3
  },
  growth: { hp: 75, attack: 7.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent: "\u81EA\u8EAB\u6BCF\u6B21\u51FB\u6740\u654C\u65B9\u5355\u4F4D\u53D7\u5230\u81EA\u8EAB\u5F53\u524D\u653B\u51FB\xD730%\u7684\u53CD\u51B2\u4F24\u5BB3\uFF0C\u90A3\u4E4B\u540E\u63D0\u53475%+\u7B49\u7EA7\xD70.02%\u653B\u51FB\u529B\uFF08100\u7EA7\uFF1A+7%\u653B\u51FB\u529B\uFF09\u4E0E3%\u9632\u5FA1\u529B\uFF0C\u76F4\u5230\u6218\u6597\u7ED3\u675F\u3002",
  skill: {
    id: "jdds_steal",
    name: "\u6218\u529B\u593A\u820D",
    tags: [],
    cooldown: 6,
    castTime: 0,
    description: "\u593A\u53D6\u654C\u65B9\u653B\u6700\u9AD8\u89D2\u827220%\u653B\u51FB\u529B5s",
    scriptId: "jdds_steal"
  }
};
var wlgyz = {
  id: "wlgyz",
  name: "\u4EA1\u7075\u6B4C\u548F\u8005",
  race: "undead" /* Undead */,
  stats: {
    hp: 8225,
    attack: 644,
    physicalDef: 220,
    magicalDef: 391.5,
    attackInterval: 3.6
  },
  growth: { hp: 75, attack: 6, physicalDef: 2, magicalDef: 3.5 },
  talent: "\u654C\u65B9\u573A\u4E0A\u5904\u4E8E[\u8BC5\u5492]\u72B6\u6001\u7684\u654C\u4EBA\u6BCF\u79D2\u53D7\u5230\u76EE\u6807\u81EA\u8EAB\u653B\u51FB\u529B\xD71%+\u81EA\u8EAB\u7B49\u7EA7\xD70.6\u7684\u7EAF\u7CB9\u4F24\u5BB3,\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u6548\u679C+50%",
  skill: {
    id: "wlgyz_heal",
    name: "\u6B7B\u4EA1\u9882\u6B4C",
    tags: ["\u6CBB\u7597", "\u51CF\u76CA"],
    cooldown: 11,
    castTime: 2,
    description: "\u6062\u590D\u968F\u673A2\u540D\u53CB\u65B9\u653B\u51FB\xD7190%\u751F\u547D+\u8BC5\u5492\u968F\u673A1\u540D\u654C\u65B93s",
    heal: { atkRatio: 2 },
    aoe: { maxTargets: 2 },
    effects: [{ type: "curse" /* Curse */, duration: 3 }]
  }
};
var mrsz = {
  id: "mrsz",
  name: "\u672B\u65E5\u4F7F\u8005",
  race: "undead" /* Undead */,
  stats: {
    hp: 7394,
    attack: 1046.1,
    physicalDef: 178.4,
    magicalDef: 263.6,
    attackInterval: 3.5
  },
  growth: { hp: 66, attack: 9.9, physicalDef: 1.6, magicalDef: 2.4 },
  talent: "\u653B\u51FB\u5904\u4E8E\u5F02\u5E38\u72B6\u6001\u7684\u654C\u4EBA\u83B7\u5F9715%\u5438\u8840\u6548\u679C\uFF0C\u590D\u6D3B\u540E\u8BE5\u5929\u8D4B+100%",
  skill: {
    id: "mrsz_doom",
    name: "\u672B\u65E5",
    tags: ["\u63A7\u5236"],
    cooldown: 13,
    castTime: 0,
    description: "\u6D88\u801720%HP\u2192\u9501\u5B9A\u8FD110s\u4F24\u5BB3\u6700\u9AD8\u76EE\u6807\uFF1A\u51CF\u759750%+\u6BCF\u79D213%atk\u7EAF\u7CB9+\u6C89\u9ED8+\u7834\u574F\uFF0C7s\uFF08HP<20%\u4E0D\u53EF\u7528\uFF09",
    scriptId: "mrsz_doom"
  }
};
var hyz = {
  id: "hyz",
  name: "\u9B42\u4E4B\u5F15\u6E21\u8005",
  race: "undead" /* Undead */,
  stats: {
    hp: 6640,
    attack: 644,
    physicalDef: 194.2,
    magicalDef: 369.5,
    attackInterval: 3.2
  },
  growth: { hp: 60, attack: 6, physicalDef: 1.8, magicalDef: 3.5 },
  talent: "\u6BCF\u7ECF\u8FC7 4 s \u6216\u8005\u6BCF\u5F53\u6211\u65B9\u89D2\u8272\u5BF9\u654C\u65B9\u65BD\u52A0\u8D1F\u9762\u72B6\u6001(\u6BCF\u6B21\u65BD\u52A0\u52A8\u4F5C\u4EC5\u589E\u52A0 1 \u5C42,\u65E0\u8BBA\u76EE\u6807\u6570\u91CF),\u81EA\u8EAB\u90FD\u4F1A\u83B7\u5F97 1 \u5C42 [\u9B42\u80FD] \u5C42\u6570,\u6700\u591A\u53E0\u52A0 5 \u5C42\u3002\u6BCF\u5C42 [\u9B42\u80FD] \u4F7F\u81EA\u8EAB\u653B\u51FB\u529B\xB7\u9632\u5FA1\u529B\u63D0\u5347 8%\uFF1B\u590D\u6D3B\u540E,\u7ACB\u5373\u83B7\u5F97 5 \u5C42 [\u9B42\u80FD]\u3002",
  skill: {
    id: "hyz_shield",
    name: "\u9B42\u80FD\u62A4\u76FE",
    tags: ["\u79FB\u52A8"],
    cooldown: 12,
    castTime: 0,
    description: "\u6D88\u8017\u5168\u90E8\u9B42\u80FD\u2192\u77AC\u79FB\u6700\u4F4EHP\u4EA1\u7075\u65C1+\u62A4\u76FE(\u653B\u51FB\xD780%\xD7\u5C42\u6570)+\u9A71\u6563\u5468\u56F41\u683C",
    effects: [{ type: "shield" /* Shield */, duration: 7 }]
  }
};
var aysl = {
  id: "aysl",
  name: "\u6697\u5F71\u566C\u9F99",
  race: "dragon" /* Dragon */,
  stats: {
    hp: 8125,
    attack: 852,
    physicalDef: 197.2,
    magicalDef: 282.4,
    attackInterval: 3.5
  },
  growth: { hp: 75, attack: 8, physicalDef: 1.8, magicalDef: 2.6 },
  talent: "\u81EA\u8EAB\u5BF9\u751F\u547D\u503C\u4F4E\u4E8E 60% \u7684\u654C\u4EBA\u9020\u6210\u4F24\u5BB3\u65F6\uFF0C\u989D\u5916\u9644\u52A0\u76EE\u6807\u5DF2\u635F\u5931\u751F\u547D\u503C \xD7 5% \u7684\u7EAF\u7CB9\u4F24\u5BB3\uFF08\u6700\u591A\u4E0D\u8D85\u8FC7\u81EA\u8EAB\u653B\u51FB\u529B \xD7 60%\uFF09\u5E76\u4F7F\u5176[\u7981\u7597]4s",
  skill: {
    id: "aysl_strike",
    name: "\u6697\u5F71\u7A81\u88AD",
    tags: ["\u5207\u5165"],
    cooldown: 10,
    castTime: 2,
    description: "\u84C4\u529B2s\u2192\u77AC\u79FB\u540E\u6392\u6700\u4F4E\u8840\u76EE\u6807\uFF1A\u653B\u51FB\xD7230%\u7269\u7406+\u6697\u5F71\u6807\u8BB0(\u53D7\u4F24\u5BB3+25%)4s\uFF1B\u6807\u8BB0\u76EE\u6807\u6B7B\u4EA1\u2192\u81EA\u56DE20%HP+\u5168\u9F99-20%CD",
    scriptId: "aysl_strike"
  }
};
var ALL_CHARACTERS = [
  pp,
  hl,
  yl,
  hx,
  zzx,
  dxm,
  lbmx,
  ds,
  mmx,
  sszs,
  bslr,
  hqs,
  mds,
  zfyx,
  lxgz,
  xjlr,
  xblr,
  ldshz,
  crzs,
  hd,
  fxz,
  fdzs,
  kzs,
  slzs,
  zqz,
  jdds,
  xdds,
  sjsn,
  bmxz,
  srm,
  ynfs,
  syz,
  zs,
  xjl,
  wqqs,
  wlgyz,
  kldd,
  yammxz,
  dyq,
  hyz,
  mrsz,
  swxz,
  hlyl,
  bsxl,
  xyfl,
  hbfl,
  bjl,
  lyz,
  xcl,
  dl,
  aysl
];
var CHARACTER_MAP = buildCharacterMap();
function buildCharacterMap() {
  let overrides = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) overrides = JSON.parse(raw);
  } catch {
  }
  return new Map(
    ALL_CHARACTERS.map((c) => {
      const ov = overrides[c.id];
      if (!ov) return [c.id, c];
      return [
        c.id,
        {
          ...c,
          stats: { ...c.stats, ...ov.stats },
          growth: { ...c.growth, ...ov.growth },
          talent: ov.talent ?? c.talent,
          skill: ov.skill ? { ...c.skill, ...ov.skill } : c.skill
        }
      ];
    })
  );
}

// src/data/equipment.ts
var ALL_EQUIPMENT = [
  {
    id: "daedalus",
    name: "\u4EE3\u8FBE\u7F57\u65AF\u4E4B\u6B87",
    description: "\u653B\u51FB\u529B+25%\u3002\u653B\u51FB26%\u81F4\u547D\u4E00\u51FB\xD7175%\uFF08\u72EC\u7ACB\u4E8E\u66B4\u51FB\u53D6\u9AD8\uFF09",
    stats: { attackPercent: 25 },
    tags: ["fatal_strike"]
  },
  {
    id: "arcane_shield",
    name: "\u5965\u6CD5\u62A4\u76FE",
    description: "HP+10% \u7269\u9632+10% \u9B54\u9632+15%\u3002\u5F00\u5C40\u653B\u51FB\xD7300%\u62A4\u76FE\u3002\u6BCF300\u9B54\u4F24\u5145\u80FD1%\uFF0C\u81F4\u547D\u65F6\u51CF\u514D\u7B49\u989D\u4F24\u5BB3\u540E\u7834\u574F",
    stats: { hpPercent: 10, physicalDefPercent: 10, magicalDefPercent: 15 },
    tags: ["shield", "charge"]
  },
  {
    id: "heart",
    name: "\u6050\u9CCC\u4E4B\u5FC3",
    description: "\u6700\u5927HP+30%\u3002\u6BCF\u79D2\u56DE\u590D\u6700\u5927HP\xD70.6%\u3002\u5F02\u5E38\u72B6\u6001\u65F6\u56DE\u590D+50%",
    stats: { hpPercent: 30 },
    tags: ["regen"]
  },
  {
    id: "divine_rapier",
    name: "\u5723\u5251",
    description: "\u653B\u51FB\u529B+44%\u3002\u9635\u4EA1\u65F6\u8F6C\u79FB\u7ED9\u51FB\u6740\u8005",
    stats: { attackPercent: 44 },
    tags: ["transfer_on_kill"]
  },
  {
    id: "desolator",
    name: "\u7834\u8D25\u5927\u5251",
    description: "\u653B\u51FB\u529B+20%\uFF0C\u653B\u51FB\u5438\u884025%\u3002\u653B\u51FB30%\u4F7F\u76EE\u6807\u7834\u75325s",
    stats: { attackPercent: 20, lifeSteal: 25 },
    tags: ["armor_break"]
  },
  {
    id: "holy_locket",
    name: "\u5723\u7075\u62A4\u7B26",
    description: "HP+15% \u653B\u51FB+5% \u7269\u9632+8% \u9B54\u9632+12%\u3002\u6CBB\u7597\u6548\u679C+25%",
    stats: {
      hpPercent: 15,
      attackPercent: 5,
      physicalDefPercent: 8,
      magicalDefPercent: 12
    },
    tags: ["heal_boost"]
  },
  {
    id: "poison_blade",
    name: "\u6DEC\u6BD2\u4E4B\u5203",
    description: "\u653B\u51FB\u901F\u5EA6+25%\u3002\u9020\u6210\u4F24\u5BB340%\u4E2D\u6BD25s\u3002\u653B\u51FB\u4E2D\u6BD2\u654C\u4EBA\u4F24\u5BB3+20%",
    stats: { attackSpeedPercent: 25 },
    tags: ["poison", "bonus_vs_poison"]
  },
  {
    id: "turban",
    name: "\u4E0D\u5C48\u5934\u5DFE",
    description: "\u6700\u5927HP+15%\u3002\u6BCF\u6B21\u5931\u53BB\u751F\u547D\u503C\u63D0\u53474%\u653B\u51FB\u4E0E6%\u9632\u5FA15s(\u53E05\u5C42)\u3002\u53CD\u51B2\u4F24\u5BB3-50%",
    stats: { hpPercent: 15 },
    tags: ["rage"]
  },
  {
    id: "black_turban",
    name: "\u9ED1\u8272\u5934\u5DFE",
    description: "\u653B+12% \u66B4\u51FB+15% \u547D\u4E2D+25% \u6700\u5927HP-10%\u3002\u6BCF150HP\u21921\u653B\u51FB+0.7\u9632\u5FA1",
    stats: { attackPercent: 12, critRate: 15, hitRate: 25, hpPercent: -10 },
    tags: ["hp_convert"]
  },
  {
    id: "magic_adapter",
    name: "\u9B54\u6CD5\u8C03\u8BD5\u5668",
    description: "\u653B\u51FB\u8F6C\u9B54\u6CD5\u4F24\u5BB3\u3002\u7269\u7406\u4F24\u5BB3-45%\uFF0C\u9B54\u6CD5\u4F24\u5BB3+16%",
    stats: {},
    tags: ["convert_magic"]
  },
  {
    id: "wave_suppressor",
    name: "\u6CE2\u52A8\u6291\u5236\u5668",
    description: "\u5168\u573A\u6CBB\u7597-40%\u3002\u5168\u573A\u8303\u56F4\u6280\u80FD\u4F24\u5BB3-20%",
    stats: {},
    tags: ["global_heal_reduce", "global_aoe_reduce"]
  },
  {
    id: "formation_breaker",
    name: "\u9635\u578B\u7834\u574F\u5668",
    description: "\u6BCF13s\uFF0C\u53CC\u65B9\u54044\u540D\u89D2\u8272\u968F\u673A\u6253\u4E71\u4F4D\u7F6E",
    stats: {},
    tags: ["shuffle"]
  },
  {
    id: "dragon_heart",
    name: "\u9F99\u4E4B\u5FC3\u810F",
    description: "\u6280\u80FD\u8D77\u59CB\u51B7\u5374-50%\u3002\u9996\u4E2A\u6280\u80FD\u4F24\u5BB3+50%\uFF0C\u4E4B\u540E\u7834\u574F",
    stats: {},
    tags: ["cd_reduce", "first_skill_boost"]
  },
  {
    id: "bone_gnaw",
    name: "\u788E\u9AA8\u5F29",
    description: "\u653B\u51FB\u529B+20%\u3002\u653B\u51FB\u65E0\u89C635%\u57FA\u7840\u9632\u5FA1",
    stats: { attackPercent: 20 },
    tags: ["ignore_def"]
  },
  {
    id: "battle_aid",
    name: "\u6218\u6597\u4E92\u52A9\u5668",
    description: "\u76F8\u90BB\u53CB\u65B9+10%\u653B\u51FB+15%\u9632\u5FA1\u3002\u81EA\u8EABHP<50%\u65F6\u7834\u574F",
    stats: {},
    tags: ["adjacent_buff"]
  },
  {
    id: "victory_horn",
    name: "\u80DC\u5229\u53F7\u89D2",
    description: "\u6211\u65B9\u5B58\u6D3B>\u654C\u65B9\u65F6\uFF1A\u5168\u961F+10%\u653B\u51FB+15%\u653B\u901F",
    stats: {},
    tags: ["advantage_buff"]
  },
  {
    id: "cursed_tome",
    name: "\u8BC5\u5492\u4E4B\u4E66",
    description: "\u4F24\u5BB3-10% \u6CBB\u7597-25%\u3002\u8BC5\u5492\u65F6\u6BCF\u79D2-2%HP\u3002\u88AB\u51FB\u6740\u540E\u8F6C\u79FB\u7ED9\u51FB\u6740\u8005",
    stats: {},
    tags: ["curse_transfer"]
  },
  {
    id: "demon_slayer",
    name: "\u65A9\u9B54\u5251",
    description: "\u9B54\u6CD5\u4F24\u5BB3-50%\u3002\u53D7\u9B54\u6CD5\u4F24\u5BB3\u2192+3%\u653B\u51FB+3%\u9B54\u96327s\u3002\u653B\u51FB40%\u964D\u654C\u6280\u80FD\u4F24\u5BB3-40%4s",
    stats: {},
    tags: ["anti_mage"]
  },
  {
    id: "hard_helm",
    name: "\u575A\u786C\u5934\u76D4",
    description: "HP+15% \u7269\u9632+45%\u3002\u53D7\u7269\u7406\u4F24\u5BB3\u53CD\u5F3920%\u539F\u59CB\u4F24\u5BB3",
    stats: { hpPercent: 15, physicalDefPercent: 45 },
    tags: ["thorns"]
  },
  {
    id: "attention_hat",
    name: "\u77A9\u76EE\u5934\u9970",
    description: "\u53D7\u5230\u653B\u51FB\u51E0\u7387+50%\u3002HP<60%\u65F6\u89E6\u53D1\uFF1A\u5176\u4ED6\u53CB\u65B9\u6062\u590D\u81EA\u8EAB\u5931\u53BBHP\xD710%\u3002\u4E4B\u540E\u7834\u574F",
    stats: {},
    tags: ["taunt", "sacrifice"]
  },
  {
    id: "dwarf_goggles",
    name: "\u7F29\u5C0F\u62A4\u955C",
    description: "\u95EA\u907F\u7387+15%\u3002\u53D7\u5230\u653B\u51FB\u51E0\u7387-35%\u3002\u6218\u6597\u5F00\u59CB15s\u540E\u7834\u574F",
    stats: { evasionPercent: 15 },
    tags: ["evasion", "expire"]
  },
  {
    id: "golden_staff",
    name: "\u91D1\u7B8D\u68D2",
    description: "\u653B\u51FB\u901F\u5EA6+20% \u547D\u4E2D\u7387+50%\u3002\u653B\u51FB40%\u9644\u52A0\u81EA\u8EAB\u653B\u51FB\xD720%\u9B54\u6CD5\u4F24\u5BB3",
    stats: { attackSpeedPercent: 20, hitRate: 50 },
    tags: ["bonus_magic_dmg"]
  }
];
var EQUIPMENT_MAP = new Map(ALL_EQUIPMENT.map((e) => [e.id, e]));

// src/data/lines.ts
var ALL_LINES = {
  pp: {
    attack: ["\u62F1\u4F60\u4E00\u4E0B\u{1F43D}"],
    skill: ["\u5F00\u59CB\u5348\u7761\u{1F4A4}"],
    talent: ["\u7761\u5F97\u771F\u9999"],
    death: ["\u628A\u6211\u6253\u5012\u4E86\u2026\u{1F4A4}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u6B8B\u2026\u{1F494}"]
  },
  hl: {
    attack: ["\u9876\uFF01"],
    skill: ["\u4F60\u6210\u529F\u6FC0\u6012\u6211\u4E86\uFF01\u{1F4A2}"],
    talent: ["\u90FD\u7ED9\u4FFA\u95ED\u5634\uFF01\u{1F4E2}"],
    death: ["\u6211\u4E0D\u670D\u2026"],
    allyDeath: ["\u4E89\u738B\u4F4D\u8F93\u4E86\u2026"]
  },
  yl: {
    attack: ["\u722A\u51FB\uFF01"],
    skill: ["\u6708\u5149\u4E0B\uFF0C\u65E0\u4EBA\u80FD\u89C1\u6211\u{1F319}", "\u55F7\u545C\uFF5E\u5F97\u624B\u4E86\uFF01"],
    death: ["\u6708\u5149\u7167\u4E0D\u5230\u6211\u4E86\u2026\u{1F319}"],
    allyDeath: ["\u72FC\u7FA4\u5185\u6597\u2026"]
  },
  hx: {
    attack: ["\u62CD\uFF01"],
    skill: ["\u864E\u5578\u9707\u5C71\u6797\uFF01\u{1F405}", "\u4E0B\u4E00\u4E2A\uFF01"],
    talent: ["\u5144\u5F1F\u7684\u8840\uFF0C\u6211\u6765\u8BA8\u56DE\uFF01\u{1F621}"],
    death: ["\u864E\u843D\u5E73\u9633\u2026\u{1F63F}"],
    allyDeath: ["\u5144\u5F1F\u2026\u4F60\u2026"]
  },
  zzx: {
    attack: ["\u6572\u4F60\u8111\u888B\u{1F34C}"],
    skill: ["\u6211\u6765\u6307\u70B9\u4F60\uFF01"],
    talent: ["\u90FD\u7ED9\u6211\u5B89\u9759\uFF01\u{1F9E0}"],
    death: ["\u667A\u529B\u4E5F\u6551\u4E0D\u4E86\u6211\u2026\u{1F9E0}"],
    allyDeath: ["\u7329\u7329\u76F8\u60DC\u2026\u{1F34C}"]
  },
  dxm: {
    attack: ["\u8E39\uFF01"],
    skill: ["\u522B\u6015\uFF0C\u6709\u6211\u5728\uFF01\u{1F48A}", "\u52A0\u5F3A\u7597\u6548\uFF01\u6CBB\u7597\u91CF+[\u6570\u503C]\u2728"],
    death: ["\u9A6C\u5931\u524D\u8E44\u2026\u{1F40E}"],
    allyDeath: ["\u8349\u539F\u4E0D\u518D\u2026"]
  },
  lbmx: {
    attack: ["\u718A\u638C\uFF01"],
    skill: ["\u5927\u5730\u98A4\u6296\u5427\uFF01"],
    talent: ["\u90FD\u671D\u6211\u6765\uFF01\u{1F43B}"],
    death: ["\u5927\u5730\u4E5F\u62A4\u4E0D\u4E86\u6211\u2026\u{1F43B}"],
    allyDeath: ["\u718A\u738B\u4E4B\u4E89\u2026"]
  },
  ds: {
    attack: ["\u54AC\uFF01"],
    skill: ["\u54AC\u4F4F\u5C31\u4E0D\u653E\uFF01\u{1F981}", "\u8840\u7684\u5473\u9053\uFF0C\u6062\u590D[\u6570\u503C]\uFF0C\u4E5F\u662F\u8865\u836F\u3002"],
    death: ["\u88AB\u56F4\u730E\u4E86\u2026\u{1F981}"],
    allyDeath: ["\u72EE\u738B\u9668\u843D\u2026"]
  },
  mmx: {
    attack: ["\u8E29\uFF01"],
    skill: ["\u78BE\u788E\u4E00\u5207\uFF01"],
    talent: ["\u5377\u8D77\u6765\uFF0C\u66F4\u786C\uFF01\u{1F418}"],
    death: ["\u8F70\u7136\u5012\u4E0B\u2026\u{1F30D}"],
    allyDeath: ["\u5DE8\u8C61\u5012\u5730\u2026\u{1F30D}"]
  },
  sszs: {
    attack: ["\u5C04\u4E2D\uFF01"],
    skill: ["\u522B\u60F3\u8DD1\uFF01\u{1F3F9}", "\u6B63\u4E2D\u9776\u5FC3\uFF01"],
    death: ["\u5F13\u65AD\u4E86\u2026\u{1F3F9}"],
    allyDeath: ["\u540C\u95E8\u5BF9\u51B3\u2026"]
  },
  bslr: {
    attack: ["\u51B0\u7BAD\uFF01"],
    skill: ["\u51B0\u51BB\u4E09\u5C3A\uFF01\u2744\uFE0F"],
    talent: ["\u65E0\u89C6\u9632\u5FA1\uFF0C\u7834\u7532\uFF01\u2744\uFE0F", "\u88AB\u653B\u51FB\u2026\u5929\u8D4B\u5931\u6548\u4E86\u2026"],
    death: ["\u51B0\u971C\u6D88\u878D\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u7BAD\u5BF9\u51B3\u2026"]
  },
  hqs: {
    attack: ["\u88C5\u5F39\uFF0C\u7830\uFF01"],
    skill: ["\u770B\u597D\u4E86\uFF0C\u4E00\u67AA\u6BD9\u547D\u{1F52B}", "\u7830\uFF01\u62DC\u62DC\uFF5E"],
    talent: ["\u88AB\u76EF\u4E0A\u4E86\uFF0C\u9632\u5FA1\u62C9\u6EE1\uFF01\u{1F6E1}\uFE0F"],
    death: ["\u67AA\u54D1\u706B\u4E86\u2026\u{1F52B}"],
    allyDeath: ["\u4F60\u67AA\u6CD5\u66F4\u597D\u2026"]
  },
  mds: {
    attack: ["\u86C7\u53D1\u653B\u51FB\u{1F40D}"],
    skill: ["\u51DD\u89C6\u6211\u2026\u2026\u{1F441}\uFE0F"],
    talent: ["\u53D8\u6210\u77F3\u5934\u5427\uFF01"],
    death: ["\u77F3\u5316\u4E86\u81EA\u5DF1\u2026\u{1FAA8}"],
    allyDeath: ["\u53CD\u5C04\u4E4B\u955C\uFF1F"]
  },
  zfyx: {
    attack: ["\u55D6\uFF5E"],
    skill: ["\u98CE\u4F1A\u6307\u5F15\u6211\u{1F4A8}"],
    talent: ["\u6562\u5207\u5165\uFF1F\u53CD\u51FB\uFF01\u{1F4A8}"],
    death: ["\u98CE\u505C\u4E86\u2026\u{1F4A8}"],
    allyDeath: ["\u98CE\u4E4B\u5BF9\u51B3\u2026"]
  },
  lxgz: {
    attack: ["\u62E8\u5F26\uFF01"],
    skill: ["\u6CBB\u6108\u7684\u65CB\u5F8B\u{1F3B6}"],
    talent: ["\u6253\u8D77\u7CBE\u795E\u6765\uFF01"],
    death: ["\u7434\u5F26\u65AD\u4E86\u2026\u{1F3BB}"],
    allyDeath: ["\u5F26\u6740\u672F\uFF1F"]
  },
  xjlr: {
    attack: ["\u6492\u9489\u5B50\uFF01"],
    skill: ["\u731C\u731C\u54EA\u91CC\u4F1A\u70B8\u{1F4A3}"],
    talent: ["\u554A\u54C8\uFF0C\u4E2D\u8BA1\u4E86\uFF01"],
    death: ["\u81EA\u9677\u9677\u9631\u2026\u{1F4A3}"],
    allyDeath: ["\u53CD\u9677\u9631\u2026"]
  },
  xblr: {
    attack: ["\u5DE6\u8F6E\u901F\u5C04\uFF01"],
    skill: ["\u897F\u90E8\u5FEB\u67AA\u624B\u6765\u54AF\u{1F920}", "\u8FD9\u624D\u662F\u771F\u6B63\u7684\u725B\u4ED4\uFF01"],
    death: ["\u897F\u90E8\u9EC4\u660F\u2026\u{1F920}"],
    allyDeath: ["\u62D4\u67AA\u6162\u4E86\u2026"]
  },
  ldshz: {
    attack: ["\u85E4\u8513\u97AD\uFF01"],
    skill: ["\u68EE\u6797\u4E4B\u529B\uFF0C\u52A0\u62A4\uFF01", "\u81EA\u7136\u4E4B\u529B\u52A0\u62A4\u4E8E\u4F60\uFF01\u{1F33F}"],
    talent: ["\u81EA\u7136\u62A4\u4F51\u7740\u6211\u{1F33F}"],
    death: ["\u68EE\u6797\u71C3\u5C3D\u4E86\u2026\u{1F33F}"],
    allyDeath: ["\u81EA\u7136\u4E4B\u529B\u4E0D\u591F\u2026"]
  },
  crzs: {
    attack: ["\u70BD\u70ED\u4E4B\u62F3\uFF01"],
    skill: ["\u5C1D\u5C1D\u70C8\u7130\u62F3\uFF01"],
    talent: ["\u70E7\u5427\uFF0C\u90FD\u70E7\u8D77\u6765\u{1F525}"],
    death: ["\u71C3\u5C3D\u4E86\u2026\u{1F525}"],
    allyDeath: ["\u70ED\u8840\u5BF9\u62FC\u2026"]
  },
  hd: {
    attack: ["\u65A9\uFF01"],
    skill: ["\u4E00\u5200\u4E24\u65AD\uFF01\u2694\uFE0F"],
    talent: ["\u89C1\u9B3C\uFF0C\u6253\u504F\u4E86\u2026"],
    death: ["\u5200\u65AD\u4E86\u2026\u2694\uFE0F"],
    allyDeath: ["\u5200\u5149\u5251\u5F71\u2026"]
  },
  fxz: {
    attack: ["\u6570\u636E\u6253\u51FB\u{1F4CA}"],
    skill: ["\u8FD9\u624D\u662F\u5B8C\u7F8E\u7684\u9635\u578B\u3002"],
    talent: ["\u8BA9\u6211\u770B\u770B\u4F60\u7684\u5F31\u70B9\u{1F50D}"],
    death: ["\u8BA1\u7B97\u7ED3\u679C\u62A5\u9519\u2026\u{1F4CA}"],
    allyDeath: ["\u66B4\u529B\u7834\u89E3\u2026"]
  },
  fdzs: {
    attack: ["\u98CE\u62F3\uFF01"],
    skill: ["\u75BE\u98CE\u9AA4\u96E8\uFF01\u{1F32A}\uFE0F", "\u547C\uFF0C\u6D3B\u52A8\u5F00\u4E86\u3002"],
    talent: ["\u524D\u6392\u52A0\u6210\uFF0C\u7834\u9632\uFF01\u{1F4A8}"],
    death: ["\u98CE\u505C\u4E86\u2026\u{1F32A}\uFE0F"],
    allyDeath: ["\u62F3\u5BF9\u62F3\u5012\u4E0B\u2026"]
  },
  kzs: {
    attack: ["\u72C2\u4E71\u6325\u51FB\uFF01"],
    skill: ["\u8840\u6012\uFF01\u65E0\u4EBA\u80FD\u6321\uFF01\u{1F624}"],
    talent: ["\u8D8A\u75DB\uFF0C\u8D8A\u5F3A\uFF01\u5F53\u524D[x\u5C42]"],
    death: ["\u72C2\u6012\u5E73\u606F\u2026\u{1F624}"],
    allyDeath: ["\u66F4\u75AF\u7684\u4EBA\u2026"]
  },
  slzs: {
    attack: ["\u5723\u5149\u9524\uFF01"],
    skill: ["\u5723\u5149\u62A4\u4F53\uFF01\u{1F6E1}\uFE0F"],
    talent: ["\u9B54\u6CD5\u53CD\u566C\uFF01"],
    death: ["\u5723\u5149\u6D88\u901D\u2026\u{1F6E1}\uFE0F"],
    allyDeath: ["\u5723\u529B\u8017\u5C3D\u2026"]
  },
  zqz: {
    attack: ["\u76F4\u62F3\u653B\u51FB\uFF01"],
    skill: ["\u5403\u6211\u4E00\u8BB0\u91CD\u62F3\uFF01\u{1F44A}"],
    talent: ["\u7834\u7532\u4E00\u51FB\uFF01\u84C4\u6EE1\u529B\u4E86\uFF01\u{1F44A}"],
    death: ["\u62F3\u5934\u4E5F\u6253\u4E0D\u5012\u6240\u6709\u4EBA\u2026\u{1F44A}"],
    allyDeath: ["\u94C1\u62F3\u5BF9\u51B3\u2026"]
  },
  jdds: {
    attack: ["\u51B3\u6597\u523A\uFF01"],
    skill: ["\u4F60\u7684\u529B\u91CF\u5F52\u6211\u4E86\uFF01\u{1F4AA}"],
    talent: ["\u8FD9\u70B9\u4EE3\u4EF7\u7B97\u4EC0\u4E48\u3002"],
    death: ["\u88AB\u5077\u88AD\u51FB\u8D25\u4E86\u2026"],
    allyDeath: ["\u51B3\u6597\u843D\u8D25\u2026"]
  },
  xdds: {
    attack: ["\u9B54\u6CD5\u98DE\u5F39\uFF01"],
    skill: ["\u706B\u7403\u6765\u55BD\uFF01\u{1F525}", "\u9668\u77F3\u5929\u964D\uFF01"],
    death: ["\u706B\u7403\u7184\u706D\u4E86\u2026\u{1F525}"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u566C\u2026"]
  },
  sjsn: {
    attack: ["\u51B0\u9525\uFF01"],
    skill: ["\u51BB\u7ED3\u5427\uFF01\u2744\uFE0F"],
    death: ["\u51B0\u6676\u788E\u88C2\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u706B\u76F8\u514B\u2026"]
  },
  bmxz: {
    attack: ["\u9A6C\u8E44\u8E0F\uFF01"],
    skill: ["\u84C4\u529B\u4E2D\u2026\u2026\u26A1", "\u767D\u9A6C\u5954\u817E\uFF01\u5168\u573A\u8E0F\u5E73\uFF01\u26A1"],
    talent: ["\u51CF\u51B7\u5374\uFF01\u7EE7\u7EED\u65BD\u6CD5\uFF01\u26A1"],
    death: ["\u767D\u9A6C\u5931\u8E44\u2026\u{1F434}"],
    allyDeath: ["\u7A7A\u95F4\u6298\u53E0\u2026"]
  },
  srm: {
    attack: ["\u68CD\u68D2\u6572\uFF01"],
    skill: ["\u70B8\u88C2\u5427\uFF01\u{1F4A5}", "\u518D\u6765\u4E00\u6B21\uFF01\u518D\u6765\uFF01", "\u518D\u6765\u4E24\u6B21\uFF01\u518D\u6765\uFF01\u518D\u6765\uFF01"],
    death: ["\u8FD9\u6B21\u6CA1\u70B8\u5230\u4EBA\u2026\u{1F4A5}"],
    allyDeath: ["\u6CD5\u672F\u5BF9\u8F70\u5931\u8D25\u2026"]
  },
  ynfs: {
    attack: ["\u865A\u65E0\u4E4B\u89E6\u{1F47B}"],
    skill: ["\u5F52\u4E8E\u865A\u65E0\uFF01"],
    talent: ["\u4F60\u5148\u79BB\u5F00\u4E00\u4F1A\u513F\u{1F6AA}"],
    death: ["\u5F52\u4E8E\u865A\u65E0\u2026\u{1F47B}"],
    allyDeath: ["\u6E6E\u706D\u5BF9\u6E6E\u706D\u2026"]
  },
  syz: {
    attack: ["\u5723\u5149\u5F39\uFF01"],
    skill: ["\u795E\u8BF4\uFF0C\u4F60\u6682\u65F6\u4E0D\u4F1A\u6B7B\u3002"],
    talent: ["\u613F\u795E\u4FDD\u4F51\u4F60\u2728"],
    death: ["\u795E\u8C15\u5931\u6548\u4E86\u2026\u2728"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u5236\u2026"]
  },
  zs: {
    attack: ["\u95EA\u7535\u94FE\uFF01"],
    skill: ["\u96F7\u9706\u4E07\u94A7\uFF01\u26A1", "\u53EF\u6076\uFF0C\u88AB\u5E72\u6270\u4E86\u3002"],
    death: ["\u96F7\u9706\u7184\u706D\u4E86\u2026\u26A1"],
    allyDeath: ["\u95EA\u7535\u53CD\u566C\u2026"]
  },
  xjl: {
    attack: ["\u5149\u7403\uFF01"],
    skill: ["\u6211\u4EEC\u8FDE\u5728\u4E00\u8D77\u5566\uFF01\u{1F517}", "\u6211\u6765\u625B\uFF01"],
    death: ["\u5149\u8292\u6D88\u6563\u4E86\u2026\u2728"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u566C\u2026"]
  },
  wqqs: {
    attack: ["\u5E7D\u7075\u523A\uFF01"],
    skill: ["\u53D7\u8BC5\u5492\u5427\uFF01"],
    death: ["\u9B42\u98DE\u9B44\u6563\u2026\u{1F47B}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u98DF\u2026"],
    talent: ["\u865A\u5F71\u95EA\u8FC7\u2026\u{1F47B}"]
  },
  wlgyz: {
    attack: ["\u97F3\u6CE2\u51B2\u51FB\u{1F3A4}"],
    skill: ["\u4EA1\u8005\u4E4B\u6B4C\u{1F4DC}", "\u554A\u554A\uFF0C\u522B\u6253\u6270\u6211\u5531\u6B4C\uFF01"],
    death: ["\u6B4C\u58F0\u505C\u4E86\u2026\u{1F3B5}"],
    allyDeath: ["\u4EA1\u7075\u5B89\u9B42\u66F2\u2026"],
    talent: ["\u4EA1\u7075\u4E4B\u821E\u2026\u{1F3B5}"]
  },
  kldd: {
    attack: ["\u9AA8\u5203\u65A9\uFF01"],
    skill: ["\u51A5\u706B\u711A\u8EAB\uFF01"],
    talent: ["\u8D77\u6765\u5427\uFF0C\u6211\u7684\u4EC6\u4ECE\uFF01\u{1F480}", "\u9AA8\u5934\u4E00\u6B6A\u2026\u{1F9B4}"],
    death: ["\u9AA8\u5934\u6563\u67B6\u4E86\u2026\u{1F9B4}"],
    allyDeath: ["\u9AB7\u9AC5\u738B\u4E89\u9738\u2026"]
  },
  klb: {
    attack: ["\u5494\u5494\u5494\u2026\u2026"],
    death: ["\u788E\u4E86\u2026\u{1F480}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u6B8B\u2026"]
  },
  yammxz: {
    attack: ["\u6697\u5F71\u5203\uFF01"],
    skill: ["\u6697\u5F71\u6362\u4F4D\uFF01"],
    death: ["\u6697\u5F71\u6D88\u6563\u4E86\u2026\u{1F311}"],
    allyDeath: ["\u6697\u5F71\u541E\u566C\u2026"],
    talent: ["\u6697\u5F71\u95EA\u907F\u2026\u{1F311}"]
  },
  dyq: {
    attack: ["\u6495\u54AC\uFF01"],
    skill: ["\u8FFD\u730E\u5F00\u59CB\uFF01\u{1F415}\u200D\u{1F9BA}"],
    talent: ["\u81F4\u547D\u4E00\u51FB\uFF01\u{1F415}", "\u6076\u72AC\u95EA\u8EAB\u2026\u{1F415}"],
    death: ["\u730E\u72AC\u7EC8\u88AB\u730E\u2026\u{1F415}"],
    allyDeath: ["\u51A5\u72AC\u76F8\u98DF\u2026"]
  },
  hyz: {
    attack: ["\u7075\u9B42\u51B2\u51FB\uFF01"],
    skill: ["\u91CA\u653E[x]\u5C42\u9B42\u80FD\uFF0C\u7075\u9B42\u62A4\u76FE\u542F\u52A8\uFF01"],
    talent: ["\u7075\u9B42\u5728\u4F4E\u8BED\u2026\u2026", "\u7075\u9B42\u6F02\u79FB\u2026\u{1F47B}"],
    death: ["\u7075\u9B42\u5F15\u6E21\u5931\u8D25\u2026\u{1F47B}"],
    allyDeath: ["\u5F15\u6E21\u8005\u53CD\u88AB\u5F15\u6E21\u2026\u{1F47B}"]
  },
  mrsz: {
    attack: ["\u672B\u65E5\u65A9\uFF01"],
    skill: ["\u4F60\u7684\u672B\u65E5\u5230\u4E86\uFF01\u2620\uFE0F", "\u8FD8\u4E0D\u5230\u65F6\u5019\u2026\u2026"],
    death: ["\u672B\u65E5\u5230\u4E86\u2026\u2620\uFE0F"],
    allyDeath: ["\u672B\u65E5\u964D\u4E34\u81EA\u8EAB\u2026"],
    talent: ["\u672B\u65E5\u56DE\u907F\u2026\u2620\uFE0F"]
  },
  swxz: {
    attack: ["\u7075\u9B42\u97AD\u7B1E\uFF01"],
    skill: ["\u7075\u9B42\uFF0C\u7ED9\u6211\uFF01\u{1F56F}\uFE0F", "\u4F60\u4F1A\u540E\u6094\u7684\u3002"],
    death: ["\u9884\u8A00\u5230\u4E86\uFF0C\u6CA1\u8EB2\u8FC7\u2026\u{1F56F}\uFE0F"],
    allyDeath: ["\u6B7B\u4EA1\u5148\u77E5\u4EA6\u6B7B\u2026"],
    talent: ["\u65E9\u6709\u9884\u77E5\u2026\u{1F56F}\uFE0F"]
  },
  hlyl: {
    attack: ["\u706B\u7403\u5410\u606F\uFF01"],
    skill: ["\u70E7\u5C3D\u4E00\u5207\uFF01\u{1F409}\u{1F525}", "\u8FD9\u706B\u4E0D\u4F1A\u706D\u3002"],
    death: ["\u9F99\u606F\u7184\u706D\u4E86\u2026\u{1F409}"],
    allyDeath: ["\u9F99\u65CF\u5185\u6218\u2026\u{1F409}"]
  },
  bsxl: {
    attack: ["\u51B0\u971C\u722A\uFF01"],
    skill: ["\u5BD2\u6C14\u903C\u4EBA\u2744\uFE0F", "\u51BB\u6210\u51B0\u5757\uFF01"],
    death: ["\u51B0\u971C\u878D\u5316\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u706B\u5BF9\u51B3\u2026"]
  },
  xyfl: {
    attack: ["\u8840\u7FFC\u6247\uFF01"],
    skill: ["\u6DF7\u4E71\u5427\uFF01\u{1F300}"],
    death: ["\u8840\u7FFC\u5782\u843D\u2026\u{1FA78}"],
    allyDeath: ["\u9F99\u7FFC\u5BF9\u51B3\u2026"]
  },
  hbfl: {
    attack: ["\u5BD2\u6C14\u5410\u606F\uFF01"],
    skill: ["\u51B0\u5C01\u4E2D\u75CA\u6108\u{1F9CA}"],
    death: ["\u51B0\u5C01\u88AB\u7834\u2026\u{1F9CA}"],
    allyDeath: ["\u51B0\u9F99\u76F8\u4E89\u2026"]
  },
  bjl: {
    attack: ["\u9F99\u5A01\u91CD\u51FB\uFF01"],
    skill: ["\u6495\u88C2\uFF01"],
    talent: ["\u4F60\u4EEC\u592A\u5F31\u4E86\uFF01\u{1F451}"],
    death: ["\u66B4\u541B\u9668\u843D\u2026\u{1F451}"],
    allyDeath: ["\u7BE1\u4F4D\u8005\u2026"]
  },
  xcl: {
    attack: ["\u661F\u5C18\u5C04\u51FB\uFF01"],
    skill: ["\u7FA4\u661F\u5760\u843D\uFF01"],
    talent: ["\u6EDA\u51FA\u6211\u7684\u6218\u573A\uFF01\u2B50"],
    death: ["\u661F\u8FB0\u5760\u843D\u2026\u2B50"],
    allyDeath: ["\u9F99\u661F\u76F8\u649E\u2026"]
  },
  lyz: {
    attack: ["\u9F99\u541F\u6CE2\uFF01"],
    skill: ["\u9F99\u4E4B\u541F\u5531\u{1F3B5}", "\u518D\u6218\u7247\u523B\uFF01"],
    death: ["\u9F99\u541F\u6C89\u5BC2\u4E86\u2026\u{1F3B5}"],
    allyDeath: ["\u9F99\u65CF\u9AD8\u6B4C\u2026"]
  },
  dl: {
    attack: ["\u9F99\u5C3E\u626B\uFF01"],
    skill: ["\u5927\u5730\u5D29\u88C2\uFF01\u{1F30D}"],
    talent: ["\u9F99\u76AE\u53CD\u4F24\uFF01\u{1F6E1}\uFE0F"],
    death: ["\u5730\u9F99\u5165\u571F\u2026\u{1F30D}"],
    allyDeath: ["\u5730\u9F99\u4E89\u9738\u2026"]
  },
  aysl: {
    attack: ["\u6697\u5F71\u722A\uFF01"],
    skill: ["\u6697\u5F71\u7A81\u88AD\u{1F5E1}\uFE0F"],
    talent: ["\u4F60\u7684\u6CBB\u7597\uFF0C\u65E0\u6548\u4E86\u3002"],
    death: ["\u6697\u5F71\u88AB\u5149\u7167\u4EAE\u2026\u{1F311}"],
    allyDeath: ["\u6697\u5F71\u5BF9\u51B3\u2026"]
  }
};

// src/engine/battle.ts
var nextUnitId = 0;
var nextLogId = 0;
function pfx2(u) {
  const r = u.def.race;
  const tag = {
    beast: "\u517D",
    hunter: "\u730E",
    warrior: "\u6218",
    mage: "\u6CD5",
    undead: "\u4EA1",
    dragon: "\u9F99"
  }[r] || r;
  return `${u.team === "ally" ? "\u{1F7E6}" : "\u{1F7E5}"}[${tag}]${u.def.name}`;
}
function shuffle2(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function isRuined(u) {
  return u.statuses?.some((s) => s.type === "ruin");
}
function triggerLine(u, category, targetName) {
  const lines = u.def?.id ? ALL_LINES[u.def.id]?.[category] : null;
  if (!lines || lines.length === 0) return;
  let line = lines[Math.floor(Math.random() * lines.length)];
  if (targetName)
    line = line.replace("[\u89D2\u8272\u540D]", targetName).replace("[\u76EE\u6807]", targetName);
  u.lastLine = line;
}
function createUnit(def, level, team, row, col = 0, equipmentId) {
  return {
    id: `u_${nextUnitId++}`,
    def,
    level,
    team,
    row,
    col,
    equipmentId,
    currentHp: def.stats.hp,
    maxHp: def.stats.hp,
    currentAttack: def.stats.attack,
    currentPhysicalDef: def.stats.physicalDef,
    currentMagicalDef: def.stats.magicalDef,
    cooldownRemaining: def.skill.cooldown * 0.9 * (0.85 + Math.random() * 0.3),
    // 起始冷却±15%随机，避免镜像先手固定
    castTimer: 0,
    isCasting: false,
    attackTimer: def.stats.attackInterval * (0.5 + Math.random() * 0.5),
    isDead: false,
    statuses: [],
    autoAttackTargetId: void 0,
    evasion: def.id === "sszs" ? 0.25 : 0,
    hitRateMod: def.id === "hd" ? -0.15 : 0,
    tenacity: row === 0 ? 5 : 0
    // Front row +5% tenacity (v2.0)
  };
}
function getAlive(state, team) {
  return state.units.filter(
    (u) => !u.isDead && (team === void 0 || u.team === team)
  );
}
function getEnemies(state, selfTeam) {
  return state.units.filter((u) => u.team !== selfTeam && !u.isDead);
}
function pickTarget2(enemies, rowPref) {
  if (enemies.length === 0) return void 0;
  if (rowPref && rowPref.length > 0) {
    const total2 = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll2 = Math.random() * total2;
    for (const p of rowPref) {
      roll2 -= p.chance;
      if (roll2 <= 0) {
        const inRow = enemies.filter((e) => e.row === p.row);
        if (inRow.length > 0)
          return inRow[Math.floor(Math.random() * inRow.length)];
        break;
      }
    }
  }
  const hasFront = enemies.some((e) => e.row === 0 /* Front */);
  const chances = hasFront ? [
    { row: 0 /* Front */, c: 60 },
    { row: 1 /* Mid */, c: 25 },
    { row: 2 /* Back */, c: 15 }
  ] : [
    { row: 1 /* Mid */, c: 65 },
    { row: 2 /* Back */, c: 35 }
  ];
  const total = chances.reduce((s, r) => s + r.c, 0);
  let roll = Math.random() * total;
  for (const p of chances) {
    roll -= p.c;
    if (roll <= 0) {
      const inRow = enemies.filter((e) => e.row === p.row);
      if (inRow.length > 0)
        return inRow[Math.floor(Math.random() * inRow.length)];
      break;
    }
  }
  return enemies[Math.floor(Math.random() * enemies.length)];
}
function initBattle(allyChars, enemyChars) {
  nextUnitId = 0;
  const makeUnits = (chars, team) => chars.map((c) => {
    const def = CHARACTER_MAP.get(c.charId);
    return def ? createUnit(def, 100, team, c.row, c.col ?? 0, c.equipmentId) : null;
  }).filter(Boolean);
  const allies = makeUnits(allyChars, "ally");
  const enemies = makeUnits(enemyChars, "enemy");
  const units = [...allies, ...enemies];
  const apply = (us) => {
    for (const [race, { count, effect }] of getActiveBonds(us)) {
      const bonus = 1 + effect.attackBonus / 100;
      const defBonus = 1 + effect.defenseBonus / 100;
      for (const u of us) {
        if (u.def.race === race) {
          if (effect.attackBonus) u.currentAttack *= bonus;
          if (effect.defenseBonus) {
            u.currentPhysicalDef *= defBonus;
            u.currentMagicalDef *= defBonus;
          }
          if (effect.magicalDefBonus) {
            u.currentMagicalDef *= 1 + effect.magicalDefBonus / 100;
          }
          if (effect.hpBonus) {
            const mult = 1 + effect.hpBonus / 100;
            u.maxHp = Math.floor(u.maxHp * mult);
            u.currentHp = Math.floor(u.currentHp * mult);
          }
          if (effect.hitRateBonus) {
            u.hitRateMod = (u.hitRateMod || 0) + effect.hitRateBonus / 100;
          }
          if (effect.evasionBonus) {
            u.evasion = (u.evasion || 0) + effect.evasionBonus / 100;
          }
        }
      }
      if (race === "dragon") {
        const cdMult = count >= 4 ? 0.7 : 0.8;
        const baseDr = count >= 4 ? 0.1 : 0.03;
        const openMult = count >= 4 ? 2.5 : 2;
        const openDur = count >= 4 ? 10 : 6;
        const openDr = baseDr * openMult;
        for (const u of us) {
          if (u.def.race === "dragon") {
            u.cooldownRemaining *= cdMult;
            u.statuses.push({
              type: "inspire" /* Inspire */,
              remainingSeconds: openDur,
              stacks: 1,
              value: 1 - openDr
              // e.g. 0.85 for 15% DR (3x5%)
            });
            u.damageReduction = (u.damageReduction || 0) + baseDr;
          }
        }
      }
      if (race === "beast") {
        const tenacityVal = count >= 4 ? 22 : count >= 3 ? 15 : 10;
        if (tenacityVal > 0) {
          for (const u of us) {
            if (u.def.race === "beast") {
              u.tenacity = (u.tenacity || 0) + tenacityVal;
            }
          }
        }
      }
      if (race === "undead" && count >= 4) {
        for (const u of us) {
          if (u.def.race === "undead") {
            u.physDamageReduction = (u.physDamageReduction || 0) + 0.11;
          }
        }
      }
      if (race === "mage") {
        const cdReduce = count >= 4 ? 0.18 : count >= 3 ? 0.12 : 0;
        if (cdReduce > 0) {
          for (const u of us) {
            if (u.def.race === "mage") {
              u.cooldownRemaining = Math.max(0, u.cooldownRemaining * (1 - cdReduce));
            }
          }
        }
      }
    }
  };
  apply(allies);
  apply(enemies);
  const applyEquip = (us) => {
    for (const u of us) {
      if (!u.equipmentId) continue;
      const eq = EQUIPMENT_MAP.get(u.equipmentId);
      if (!eq || !eq.stats) continue;
      const s = eq.stats;
      if (s.attackPercent)
        u.currentAttack = Math.floor(
          u.currentAttack * (1 + s.attackPercent / 100)
        );
      if (s.physicalDefPercent)
        u.currentPhysicalDef = Math.floor(
          u.currentPhysicalDef * (1 + s.physicalDefPercent / 100)
        );
      if (s.magicalDefPercent)
        u.currentMagicalDef = Math.floor(
          u.currentMagicalDef * (1 + s.magicalDefPercent / 100)
        );
      if (s.hpPercent) {
        const mult = 1 + s.hpPercent / 100;
        u.maxHp = Math.floor(u.maxHp * mult);
        u.currentHp = Math.floor(u.currentHp * mult);
      }
      if (s.critRate) u.critRate = (u.critRate || 0) + s.critRate / 100;
      if (s.critDamage) u.critDamage = (u.critDamage || 0) + s.critDamage / 100;
      if (s.hitRate) u.hitRateMod = (u.hitRateMod || 0) + s.hitRate / 100;
      if (s.lifeSteal) u.lifeSteal = (u.lifeSteal || 0) + s.lifeSteal / 100;
      if (s.attackSpeedPercent)
        u.attackSpeedBonus = (u.attackSpeedBonus || 0) + s.attackSpeedPercent / 100;
      if (s.evasionPercent)
        u.evasion = (u.evasion || 0) + s.evasionPercent / 100;
    }
  };
  applyEquip(allies);
  applyEquip(enemies);
  for (const u of units) {
    if (u.equipmentId === "dragon_heart") {
      u.cooldownRemaining *= 0.5;
    }
  }
  const stats = units.map((u) => ({
    unitId: u.id,
    name: u.def.name,
    race: u.def.race,
    team: u.team,
    totalDamageDealt: 0,
    totalDamageReceived: 0,
    physicalDamageReceived: 0,
    magicalDamageReceived: 0,
    pureDamageReceived: 0,
    totalHealingDone: 0,
    totalHealingReceived: 0,
    kills: 0,
    deaths: 0,
    skillCasts: 0,
    autoAttackDamage: 0,
    skillDamage: 0,
    physicalDamage: 0,
    magicalDamage: 0,
    pureDamage: 0,
    critCount: 0,
    critDamage: 0,
    blockCount: 0,
    blockReduced: 0,
    lifeStealHealing: 0,
    skillHealing: 0,
    shieldAbsorbed: 0,
    survivalTime: 0
  }));
  const state = {
    units,
    time: 0,
    phase: "fighting",
    turnEvents: [],
    battleLog: [{ time: 0, text: "\u2694\uFE0F \u6218\u6597\u5F00\u59CB\uFF01", type: "system" }],
    stats,
    skillStats: {},
    bonds: {
      ally: calcBonds(allies),
      enemy: calcBonds(enemies)
    }
  };
  if (state._debug) {
    for (const side of ["ally", "enemy"]) {
      const us = side === "ally" ? allies : enemies;
      const label = side === "ally" ? "\u6211\u65B9" : "\u654C\u65B9";
      const bonds = getActiveBonds(us);
      for (const [race, { effect }] of bonds) {
        const cnt = us.filter((u) => u.def.race === race).length;
        if (race === "warrior") {
          const extra = cnt >= 4 ? "+\u6BCF5s\u56DE8%HP+20%\u5438\u8840" : cnt >= 3 ? "+\u6BCF5s\u56DE4%HP+10%\u5438\u8840" : "";
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u6218\u58EB\xD7${cnt}\u7F81\u7ECA: HP+${effect.hpBonus}%${extra}`,
            type: "system"
          });
        } else if (race === "mage") {
          const mdefStr = cnt >= 4 ? "50%" : cnt >= 3 ? "35%" : cnt >= 2 ? "20%" : "0%";
          const lsStr = cnt >= 4 ? "25%" : cnt >= 3 ? "10%" : "";
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u6CD5\u5E08\xD7${cnt}\u7F81\u7ECA: \u9B54\u9632-${mdefStr}${lsStr ? `+\u5438\u8840${lsStr}` : ""}`,
            type: "system"
          });
        } else if (race === "dragon")
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u9F99\u65CF\xD7${cnt}\u7F81\u7ECA: CD-80%+\u51CF\u4F2440%10s`,
            type: "system"
          });
        else {
          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `\u{1F31F} ${label} ${race}\xD7${cnt}\u7F81\u7ECA: \u653B+${effect.attackBonus}%`,
              type: "system"
            });
          if (effect.defenseBonus)
            state.battleLog.push({
              time: 0,
              text: `\u{1F31F} ${label} ${race}\xD7${cnt}\u7F81\u7ECA: \u9632+${effect.defenseBonus}%`,
              type: "system"
            });
        }
      }
    }
  }
  return state;
  function calcBonds(us) {
    const rc = {};
    for (const u of us.filter((u2) => !u2.isDead)) {
      rc[u.def.race] = (rc[u.def.race] || 0) + 1;
    }
    return Object.entries(rc).filter(([_, c]) => c >= 3).map(([r, c]) => ({ race: r, count: c }));
  }
}
var MAX_LOG = 2e3;
function deferDamage(target, dmg, state) {
  if (dmg <= 0) return;
  if (target.statuses?.some((s) => s.type === "sleep" /* Sleep */) && Math.random() < 0.2) {
    target.statuses = target.statuses.filter(
      (s) => s.type !== "sleep" /* Sleep */
    );
    state.battleLog.push({
      time: state.time,
      text: `\u{1F4A4} ${target.def.name} \u88AB\u60CA\u9192\uFF01`,
      type: "status"
    });
  }
  const inspire = target.statuses?.find(
    (s) => s.type === "inspire" /* Inspire */
  );
  if (inspire) {
    target._delayedDamage = target._delayedDamage || [];
    target._delayedDamage.push({ amount: dmg, expireTime: state.time + 5 });
  } else {
    target.currentHp -= dmg;
  }
}
function processDelayedDamage(state) {
  for (const u of state.units) {
    if (!u._delayedDamage || u._delayedDamage.length === 0) continue;
    const now = state.time;
    const ready = u._delayedDamage.filter((d) => d.expireTime <= now);
    u._delayedDamage = u._delayedDamage.filter((d) => d.expireTime > now);
    for (const d of ready) {
      u.currentHp -= d.amount;
      if (state._debug) {
        state.battleLog.push({
          time: now,
          text: `\u23F3 ${u.def.name} \u5EF6\u8FDF\u4F24\u5BB3\u751F\u6548: -${d.amount}`,
          type: "damage"
        });
      }
    }
  }
}
function processTick(state) {
  if (state.phase !== "fighting") return state;
  state.time += 0.1;
  for (const u of state.units) {
    u._statusSnapshot = u.statuses.slice();
    u._hitSnapshot = !!u._wasHitDuringCast;
    u._dmgSnapshot = !!u._wasDamagedDuringCast;
    u._wasHitDuringCast = false;
    u._wasDamagedDuringCast = false;
  }
  updateStatuses(state);
  processDelayedDamage(state);
  updateCasting(state);
  updateCooldowns(state);
  updateSkills(state);
  updateAutoAttacks(state);
  updateDeaths(state);
  updateRevivals(state);
  updateWarriorBonds(state);
  updateEquipment(state);
  updateVictory(state);
  updateBonds(state);
  trimLog(state);
  ensureLogIds(state);
  return state;
}
function updateStatuses(state) {
  for (const unit of getAlive(state)) {
    for (const s of unit.statuses) {
      s.remainingSeconds -= 0.1;
      if (s.type === "burn" /* Burn */ && s.value) {
        const dmg = s.value;
        deferDamage(unit, dmg, state);
        addStat2(state, unit.id, "totalDamageReceived", dmg);
        state.battleLog.push({
          time: state.time,
          text: `\u{1F525} ${unit.def.name} \u707C\u70E7 ${dmg}`,
          type: "damage"
        });
      }
      if (s.type === "regen" /* Regen */ && s.value) {
        const heal = Math.floor(unit.maxHp * s.value);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
        addStat2(state, unit.id, "totalHealingReceived", heal);
        state.battleLog.push({
          time: state.time,
          text: `\u{1F49A} ${unit.def.name} \u56DE\u590D ${heal}`,
          type: "heal"
        });
      }
    }
    if (unit.statuses.some((s) => s.type === "curse" /* Curse */)) {
      const dmg = Math.floor(unit.currentAttack * 0.01 + 20);
      unit.currentHp -= dmg;
      addStat2(state, unit.id, "totalDamageReceived", dmg);
    }
    const poison = unit.statuses.find((s) => s.type === "poison" /* Poison */);
    if (poison && poison.value) {
      const dmg = poison.value;
      unit.currentHp -= dmg;
      addStat2(state, unit.id, "totalDamageReceived", dmg);
    }
    if (unit.def.id === "crzs" && !isRuined(unit)) {
      const sameRowEnemies = getEnemies(state, unit.team).filter(
        (e) => e.row === unit.row
      );
      for (const e of sameRowEnemies) {
        const dmg = Math.floor(unit.currentAttack * 0.015 + 2);
        e.currentHp -= dmg;
        addStat2(state, unit.id, "totalDamageDealt", dmg);
      }
    }
    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);
    if (unit._mageAtkExpire && state.time >= unit._mageAtkExpire) {
      unit._mageAtkMult = void 0;
      unit._mageAtkExpire = void 0;
    }
  }
  for (const team of ["ally", "enemy"]) {
    const syzT = state[`_syzDeathTime_${team}`];
    if (syzT === void 0) continue;
    const el = state.time - syzT;
    if (el >= 0 && el < 6) {
      const baseAtk = state[`_syzDeathAttack_${team}`] || 0;
      const atk60 = baseAtk > 0 ? Math.floor(baseAtk * 0.6) : 361;
      const heal = Math.floor(atk60 * (1 + el * 0.1));
      for (const u of state.units) {
        if (u.team === team && !u.isDead && u.def.race === "mage")
          u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      }
    }
  }
}
function updateCasting(state) {
  const castFinishOrder = shuffle2(getAlive(state));
  for (const unit of castFinishOrder) {
    if (!unit.isCasting) continue;
    unit.castTimer -= 0.1;
    const sk = unit.def.skill;
    let interrupted = false;
    let reason = "";
    const cc = (unit._statusSnapshot || unit.statuses).find(
      (s) => ["stun", "sleep", "petrify", "freeze", "silence"].includes(s.type)
    );
    if (cc) {
      interrupted = true;
      reason = cc.type;
    }
    if (!interrupted && sk.interruptOnAttack && unit._hitSnapshot) {
      interrupted = true;
      reason = "\u53D7\u51FB";
    }
    if (!interrupted && sk.interruptOnDamage && unit._dmgSnapshot) {
      interrupted = true;
      reason = "\u53D7\u4F24";
    }
    if (interrupted) {
      unit.isCasting = false;
      if (unit.def.skill.id === "zqz_strike") {
        unit.cooldownRemaining = unit.def.skill.cooldown;
      } else {
        unit.cooldownRemaining = Math.max(unit.def.skill.castTime, 0.5);
      }
      unit._wasHitDuringCast = false;
      unit._wasDamagedDuringCast = false;
      state.battleLog.push({
        time: state.time,
        text: `\u26D4 ${unit.def.name} \u65BD\u6CD5\u88AB\u6253\u65AD(${reason})\uFF01`,
        type: "status"
      });
      continue;
    }
    if (unit.castTimer <= 0) {
      unit._wasHitDuringCast = false;
      unit._wasDamagedDuringCast = false;
      executeSkill(unit, state, state.battleLog);
      unit.isCasting = false;
      unit.cooldownRemaining = unit.def.skill.cooldown;
    }
  }
}
function updateCooldowns(state) {
  for (const unit of getAlive(state)) {
    if (unit.cooldownRemaining > 0) unit.cooldownRemaining -= 0.1;
  }
}
function updateSkills(state) {
  const castOrder = shuffle2(getAlive(state));
  for (const unit of castOrder) {
    if (unit.isCasting) continue;
    if (unit.cooldownRemaining > 0) continue;
    const cannotCast = [
      "stun" /* Stun */,
      "sleep" /* Sleep */,
      "petrify" /* Petrify */,
      "freeze" /* Freeze */,
      "silence" /* Silence */
    ].some((t) => unit.statuses.some((s) => s.type === t));
    const isBound = unit.statuses.some((s) => s.type === "bind" /* Bind */);
    if (cannotCast) continue;
    if (isBound && unit.def.skill.tags?.some((t) => t === "\u5207\u5165" || t === "\u79FB\u52A8"))
      continue;
    const sk = unit.def.skill;
    if (sk.scriptId === "bmxz_charge") {
      const ct = [1, 2, 3][Math.floor(Math.random() * 3)];
      unit._chargeTime = ct;
      unit.isCasting = true;
      unit.castTimer = ct;
    } else if (sk.castTime > 0) {
      unit.isCasting = true;
      unit.castTimer = sk.castTime;
    } else {
      executeSkill(unit, state, state.battleLog);
      unit.cooldownRemaining = sk.cooldown;
    }
  }
}
function updateAutoAttacks(state) {
  const atkOrder = shuffle2(getAlive(state));
  for (const unit of atkOrder) {
    const cannotAttack = [
      "stun" /* Stun */,
      "sleep" /* Sleep */,
      "petrify" /* Petrify */,
      "freeze" /* Freeze */,
      "disarm" /* Disarm */
    ].some((t) => unit.statuses.some((s) => s.type === t));
    if (cannotAttack) continue;
    unit.attackTimer -= 0.1;
    if (unit.attackTimer <= 0) {
      const enemies = getEnemies(state, unit.team);
      const nTargets = unit.def.id === "mds" && !isRuined(unit) ? 2 : 1;
      const targets = nTargets === 1 ? [pickTarget2(enemies)].filter(Boolean) : shuffle2(enemies).slice(0, nTargets);
      for (const target of targets) {
        if (!target || target.isDead) continue;
        let atkRatio = 1;
        if (unit.def.id === "mds") atkRatio = 0.9;
        const hunterCntP1 = state.units.filter(
          (u) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
        ).length;
        const result = calcDamage(unit, target, atkRatio, "physical" /* Physical */, {
          evasion: target.evasion,
          hitRateMod: unit.hitRateMod
        });
        const fs = applyFatalStrike(unit, result.finalDamage, false);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        deferDamage(target, result.finalDamage, state);
        trackSkill(
          state,
          unit.id,
          "aa",
          "\u5E73\u780D",
          result.finalDamage,
          "physical"
        );
        if (unit.equipmentId === "golden_staff" && result.finalDamage > 0 && Math.random() < 0.4) {
          const bonusDmg = Math.floor(unit.currentAttack * 0.2);
          target.currentHp -= bonusDmg;
          addStat2(state, unit.id, "totalDamageDealt", bonusDmg);
          addStat2(state, unit.id, "magicalDamage", bonusDmg);
          addStat2(state, target.id, "totalDamageReceived", bonusDmg);
          addStat2(state, target.id, "magicalDamageReceived", bonusDmg);
        }
        target._wasHitDuringCast = true;
        target._wasDamagedDuringCast = true;
        if (result.isCrit) {
          addStat2(state, unit.id, "critCount", 1);
          addStat2(state, unit.id, "critDamage", result.finalDamage);
        }
        if (result.isBlocked) {
          addStat2(state, target.id, "blockCount", 1);
          addStat2(state, target.id, "blockReduced", result.blocked);
        }
        target.lastDamage = {
          value: result.finalDamage,
          time: state.time,
          type: "physical"
        };
        target.lastAction = { time: state.time, isTarget: true };
        unit.lastAction = {
          time: state.time,
          targetName: target.def.name,
          isTarget: false
        };
        target.lastHitBy = unit.id;
        addStat2(state, unit.id, "totalDamageDealt", result.finalDamage);
        addStat2(state, unit.id, "autoAttackDamage", result.finalDamage);
        addStat2(state, unit.id, "physicalDamage", result.finalDamage);
        addStat2(state, target.id, "totalDamageReceived", result.finalDamage);
        addStat2(state, target.id, "physicalDamageReceived", result.finalDamage);
        if (result.finalDamage > 0) {
          unit.lastHitTarget = target.id;
          target.lastHitBy = unit.id;
          state.battleLog.push({
            time: state.time,
            text: `${pfx2(unit)} \u2694\uFE0F ${pfx2(target)}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} def=${Math.floor(target.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / 1.35).toFixed(0) : ""}` : ""}`,
            type: "damage"
          });
          if (Math.random() < 0.5) triggerLine(unit, "attack", target.def.name);
          if (unit.def.race === "beast") {
            const beastCnt = state.units.filter(
              (u) => u.team === unit.team && !u.isDead && u.def.race === "beast"
            ).length;
            if (beastCnt >= 3 && target.currentHp / target.maxHp < 0.5) {
              const purePct = beastCnt >= 4 ? 0.05 : 0.04;
              const pureDmg = Math.floor(unit.currentAttack * purePct);
              target.currentHp -= pureDmg;
              addStat2(state, unit.id, "totalDamageDealt", pureDmg);
              addStat2(state, unit.id, "pureDamage", pureDmg);
            }
          }
          if (unit.def.id === "syz" && result.finalDamage > 0 && !isRuined(unit)) {
            const allies = state.units.filter((u) => u.team === unit.team && !u.isDead).sort(
              (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
            );
            if (allies.length > 0 && Math.random() < 0.8) {
              const t = allies[0];
              const heal = Math.floor(unit.currentAttack * 0.4);
              t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
              addStat2(state, unit.id, "totalHealingDone", heal);
              addStat2(state, unit.id, "skillHealing", heal);
            }
          }
        }
      }
      const asBonus = Math.min(unit.attackSpeedBonus || 0, 1);
      unit.attackTimer = unit.def.stats.attackInterval * (1 - asBonus * 0.5);
      unit._attackCount = (unit._attackCount || 0) + 1;
      const hunterCnt = state.units.filter(
        (u) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
      ).length;
      if (hunterCnt >= 3 && unit.def.race === "hunter") {
        const extraEvery = hunterCnt >= 4 ? 4 : 7;
        const extraDmgRatio = hunterCnt >= 4 ? 0.45 : 0.2;
        if (unit._attackCount % extraEvery === 0) {
          const extraEnemies = getEnemies(state, unit.team).filter(
            (e) => !targets.some((t) => t?.id === e.id)
          );
          if (extraEnemies.length > 0) {
            const extraTarget = extraEnemies[Math.floor(Math.random() * extraEnemies.length)];
            if (extraTarget) {
              const eresult = calcDamage(
                unit,
                extraTarget,
                extraDmgRatio,
                "physical" /* Physical */,
                {
                  evasion: extraTarget.evasion,
                  hitRateMod: unit.hitRateMod,
                  ignoreBaseDef: hunterCnt >= 4
                  // v2.4: 4人分叉无视防御
                }
              );
              deferDamage(extraTarget, eresult.finalDamage, state);
              extraTarget.currentHp -= eresult.finalDamage;
              addStat2(state, unit.id, "totalDamageDealt", eresult.finalDamage);
              addStat2(state, unit.id, "autoAttackDamage", eresult.finalDamage);
              addStat2(state, unit.id, "physicalDamage", eresult.finalDamage);
              addStat2(
                state,
                extraTarget.id,
                "totalDamageReceived",
                eresult.finalDamage
              );
            }
          }
        }
      }
    }
  }
}
function updateDeaths(state) {
  for (const u of state.units) {
    if (u.currentHp > 0 || u.isDead) continue;
    u.isDead = true;
    addStat2(state, u.id, "deaths", 1);
    addStat2(state, u.id, "survivalTime", state.time);
    if (u.def.id === "syz" && !isRuined(u)) {
      state[`_syzDeathTime_${u.team}`] = state.time;
      state[`_syzDeathAttack_${u.team}`] = u.currentAttack;
      state.battleLog.push({
        time: state.time,
        text: `\u{1F6E1} ${u.def.name} \u9635\u4EA1\u89E6\u53D1\uFF1A\u5168\u6CD5\u5E08\u6CBB\u75975s`,
        type: "status"
      });
    }
    for (const srm2 of state.units.filter(
      (x) => x.def.id === "srm" && x.team === u.team && !x.isDead && !isRuined(x)
    )) {
      const hpBonus = Math.floor(srm2.maxHp * 0.08);
      srm2.maxHp += hpBonus;
      srm2.currentHp = Math.min(
        srm2.maxHp,
        srm2.currentHp + Math.floor(srm2.maxHp * 0.1)
      );
      state.battleLog.push({
        time: state.time,
        text: `\u{1F525} ${srm2.def.name} \u5929\u8D4B\u89E6\u53D1: \u6700\u5927HP+${hpBonus}+\u6062\u590D10%HP`,
        type: "status"
      });
    }
    if (u.lastHitBy) addStat2(state, u.lastHitBy, "kills", 1);
    state.battleLog.push({
      time: state.time,
      text: `\u{1F480} ${pfx2(u)} \u9635\u4EA1\uFF01`,
      type: "death"
    });
    const killer = u.lastHitBy ? state.units.find((x) => x.id === u.lastHitBy) : null;
    triggerLine(
      u,
      killer && killer.def.race === u.def.race ? "allyDeath" : "death",
      killer?.def.name
    );
    if (u._markExpire && u._markExpire > state.time - 5) {
      const aysl2 = state.units.find(
        (x) => x.def.id === "aysl" && x.team !== u.team && !x.isDead
      );
      if (aysl2) {
        const heal = Math.floor(aysl2.maxHp * 0.2);
        aysl2.currentHp = Math.min(aysl2.maxHp, aysl2.currentHp + heal);
        for (const d of state.units.filter(
          (x) => x.def.race === "dragon" && x.team === aysl2.team && !x.isDead
        )) {
          d.cooldownRemaining = Math.max(0, d.cooldownRemaining * 0.8);
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1F311} \u6697\u5F71\u566C\u9F99 \u51FB\u6740\u5956\u52B1: \u56DE20%HP+\u5168\u9F99CD-20%`,
          type: "status"
        });
      }
    }
    if (u.def.race === "undead" && !u.hasRevived) {
      const key = `undeadRevive_${u.team}`;
      if (state[key]) continue;
      const alive = state.units.filter(
        (x) => x.team === u.team && !x.isDead
      );
      const totalU = state.units.filter(
        (x) => x.team === u.team && x.def.race === "undead"
      ).length;
      if (totalU >= 3) {
        state[key] = true;
        const is4 = totalU >= 4;
        const reviveTime = is4 ? 5 : 10;
        const regenPct = is4 ? 0.025 : 0.02;
        const regenDur = is4 ? 10 : 8;
        const invTimer = is4 ? 2 : 2;
        u.reviving = { timer: reviveTime, hpPct: 0.01, regenPct, regenDur, invTimer };
        state.battleLog.push({
          time: state.time,
          text: `\u{1F480} ${u.def.name} ${totalU}\u7F81\u7ECA\u6FC0\u6D3B\uFF0C${reviveTime}s\u540E\u590D\u6D3B(\u6BCF\u79D2\u56DE${Math.floor(regenPct * 100)}%HP\xD7${regenDur}s)\uFF01`,
          type: "status"
        });
      }
    }
  }
}
function updateRevivals(state) {
  for (const u of state.units) {
    if (u.reviving && u.isDead) {
      u.reviving.timer -= 0.1;
      if (u.reviving.timer <= 0) {
        u.isDead = false;
        u.currentHp = Math.max(1, Math.floor(u.maxHp * 0.05));
        u.cooldownRemaining = 0;
        u.attackTimer = 0;
        u.statuses = [];
        const invTmr = u.reviving.invTimer ?? 2;
        const regenPct = u.reviving.regenPct ?? 0.06;
        const regenDur = u.reviving.regenDur ?? 8;
        u.reviving = void 0;
        u.invincibleTimer = invTmr;
        u.hasRevived = true;
        u.statuses.push({
          type: "regen" /* Regen */,
          remainingSeconds: regenDur,
          stacks: 1,
          value: regenPct
        });
        state.battleLog.push({
          time: state.time,
          text: `\u{1F504} ${u.def.name} \u590D\u6D3B\uFF01\u6BCF\u79D2\u56DE${Math.floor(regenPct * 100)}%HP\xD7${regenDur}s+\u65E0\u654C${invTmr}s`,
          type: "status"
        });
      }
    }
    if (u.tempReviveTimer && u.tempReviveTimer > 0) {
      u.tempReviveTimer -= 0.1;
      if (u.tempReviveTimer <= 0 && !u.isDead) {
        u.isDead = true;
        u.tempReviveTimer = void 0;
        state.battleLog.push({
          time: state.time,
          text: `\u23F3 ${u.def.name} \u4E34\u65F6\u590D\u6D3B\u7ED3\u675F`,
          type: "status"
        });
      }
    }
    if (u.invincibleTimer && u.invincibleTimer > 0) {
      u.invincibleTimer -= 0.1;
      if (u.invincibleTimer <= 0) u.invincibleTimer = void 0;
    }
  }
}
function updateWarriorBonds(state) {
  state._warriorTimer = (state._warriorTimer || 0) + 0.1;
  for (const u of getAlive(state)) {
    if (u.def.race !== "warrior") continue;
    const wCnt = state.units.filter(
      (x) => x.team === u.team && !x.isDead && x.def.race === "warrior"
    ).length;
    if (wCnt >= 4) {
    } else if (wCnt >= 3) {
    }
  }
  if (state._warriorTimer >= 12) {
    state._warriorTimer = 0;
    for (const u of getAlive(state)) {
      if (u.def.race !== "warrior") continue;
      const wCnt = state.units.filter(
        (x) => x.team === u.team && !x.isDead && x.def.race === "warrior"
      ).length;
      if (wCnt >= 3) {
        const pct = wCnt >= 4 ? 0.03 : 0.03;
        const heal = Math.floor(u.maxHp * pct);
        u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
        addStat2(state, u.id, "totalHealingDone", heal);
        addStat2(state, u.id, "skillHealing", heal);
      }
    }
  }
}
function updateEquipment(state) {
  if (state.time >= 15) {
    for (const u of state.units) {
      if (u.equipmentId === "dwarf_goggles" && !u.isDead) {
        u.equipmentId = void 0;
        u.evasion = Math.max(0, (u.evasion || 0) - 0.15);
      }
    }
  }
  for (const u of state.units) {
    if (u.equipmentId === "attention_hat" && !u.isDead && !u._attentionTriggered && u.currentHp / u.maxHp < 0.6) {
      u._attentionTriggered = true;
      const lostHp = u.maxHp - u.currentHp;
      for (const ally of state.units.filter(
        (x) => x.team === u.team && x.id !== u.id && !x.isDead
      )) {
        const heal = Math.floor(lostHp * 0.1);
        ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
      }
      u.equipmentId = void 0;
      state.battleLog.push({
        time: state.time,
        text: `\u{1F3AF} ${u.def.name} \u77A9\u76EE\u5934\u9970\u89E6\u53D1: \u53CB\u65B9\u6062\u590D${Math.floor(lostHp * 0.1)}HP`,
        type: "system"
      });
    }
  }
}
function updateVictory(state) {
  const a = getAlive(state).filter((u) => u.team === "ally");
  const e = getAlive(state).filter((u) => u.team === "enemy");
  if (a.length === 0 || e.length === 0) {
    state.phase = "finished";
    state.winner = a.length > 0 ? "ally" : "enemy";
    for (const u of state.units) {
      if (!u.isDead) addStat2(state, u.id, "survivalTime", state.time);
    }
    state.battleLog.push({
      time: state.time,
      text: `\u{1F3C1} ${state.winner === "ally" ? "\u6211\u65B9" : "\u654C\u65B9"}\u80DC\u5229\uFF01`,
      type: "system"
    });
    state.battleLog.push({
      time: state.time,
      text: `\u2500\u2500 \u7EC8\u5C40\u7EDF\u8BA1 \u2500\u2500`,
      type: "system"
    });
    for (const s of state.stats || []) {
      const u = state.units.find((x) => x.id === s.unitId);
      if (!u) continue;
      const side = u.team === "ally" ? "\u{1F7E6}" : "\u{1F7E5}";
      state.battleLog.push({
        time: state.time,
        text: `${side} ${u.def.name}: \u4F24\u5BB3${s.totalDamageDealt || 0} \u6CBB\u7597${s.totalHealingDone || 0} \u51FB\u6740${s.kills || 0} \u66B4\u51FB${s.critCount || 0} \u683C\u6321${s.blockCount || 0}`,
        type: "system"
      });
    }
  }
}
function updateBonds(state) {
  const calc = (team) => {
    const rc = {};
    for (const u of state.units.filter(
      (x) => x.team === team && !x.isDead
    ))
      rc[u.def.race] = (rc[u.def.race] || 0) + 1;
    return Object.entries(rc).filter(([_, c]) => c >= 3).map(([r, c]) => ({ race: r, count: c }));
  };
  state.bonds = { ally: calc("ally"), enemy: calc("enemy") };
  for (const u of getAlive(state)) {
    if (u.def.id !== "sszs") continue;
    for (const h of state.units.filter(
      (x) => x.team === u.team && !x.isDead && x.def.race === "hunter" && x.row === u.row
    )) {
      if (h.id !== "sszs") h.evasion = Math.max(h.evasion || 0, 0.25);
    }
  }
  for (const fxz2 of state.units.filter(
    (u) => !u.isDead && u.def.id === "fxz" && !isRuined(u)
  )) {
    const opp = fxz2.team === "ally" ? "enemy" : "ally";
    const symEnemy = state.units.find(
      (u) => u.team === opp && !u.isDead && u.col === fxz2.col && u.row === fxz2.row
    );
    if (symEnemy) {
      symEnemy.evasion = 0;
      symEnemy._markedByAnalyzer = true;
    }
  }
  for (const u of state.units.filter(
    (x) => x.team === "enemy" && !x._markedByAnalyzer
  )) {
  }
}
function trimLog(state) {
  if (state.battleLog.length > MAX_LOG) {
    state.battleLog = state.battleLog.slice(-MAX_LOG);
  }
}
function ensureLogIds(state) {
  for (const entry of state.battleLog) {
    if (!entry.id) entry.id = `l${nextLogId++}`;
  }
}
function executeSkill(caster, state, log) {
  addStat2(state, caster.id, "skillCasts", 1);
  const sk = caster.def.skill;
  const enemies = getEnemies(state, caster.team);
  const allies = getAlive(state, caster.team);
  log.push({
    time: state.time,
    text: `${caster.def.name} \u91CA\u653E\u3010${sk.name}\u3011`,
    type: "skill"
  });
  caster.lastSkillCast = { name: sk.name, time: state.time };
  triggerLine(caster, "skill");
  for (const xdds2 of state.units.filter(
    (u) => !u.isDead && u.team === caster.team && u.def.id === "xdds" && u.row === caster.row && !isRuined(u)
  )) {
    if (xdds2.id === caster.id) continue;
    const stacks = Math.min((xdds2._asStack || 0) + 1, 5);
    xdds2._asStack = stacks;
    const atkIntMult = 1 - stacks * 0.03;
    const baseInt = xdds2.def.stats.attackInterval;
    xdds2.attackTimer = Math.min(xdds2.attackTimer, baseInt * atkIntMult);
  }
  const handler = getSkillHandler(sk.scriptId || "");
  if (handler) {
    const scriptTargets = sk.aoe ? shuffle2(enemies).slice(0, sk.aoe.maxTargets || enemies.length) : [pickTarget2(enemies, sk.priority)].filter(Boolean);
    handler(caster, state, log, scriptTargets);
    return;
  }
  let actionTargets = [];
  const isCutIn = sk.tags?.includes("\u5207\u5165");
  if (isCutIn && enemies.length > 0) {
    let cutTargets = [];
    if (sk.aoe) {
      cutTargets = shuffle2(enemies).slice(
        0,
        sk.aoe.maxTargets || enemies.length
      );
    } else {
      const t = pickTarget2(enemies, sk.priority);
      if (t) cutTargets = [t];
    }
    for (const t of cutTargets) {
      if (t.isDead) continue;
      const targetTeam = state.units.filter(
        (u) => u.team === t.team && !u.isDead
      );
      const hunterCount = targetTeam.filter(
        (u) => u.def.race === "hunter"
      ).length;
      if (hunterCount >= 3) {
        const is4Tier = hunterCount >= 4;
        const counterResult = calcDamage(
          t,
          caster,
          is4Tier ? 0.6 : 0.4,
          "physical" /* Physical */,
          {
            isSkill: true,
            ignoreBaseDef: is4Tier
          }
        );
        const counterDmg = counterResult.finalDamage;
        deferDamage(caster, counterDmg, state);
        caster.lastDamage = {
          value: counterDmg,
          time: state.time,
          type: "physical"
        };
        caster.lastAction = { time: state.time, isTarget: true };
        log.push({
          time: state.time,
          text: `\u{1F504} ${t.def.name} \u53CD\u51FB ${pfx2(caster)}: ${counterDmg}${counterResult.isCrit ? "\u{1F4A5}" : ""}`,
          type: "damage"
        });
        addStat2(state, t.id, "totalDamageDealt", counterDmg);
      }
    }
  }
  if (sk.damage && enemies.length > 0) {
    let targets = [];
    if (sk.aoe) {
      const shuffled = shuffle2(enemies);
      targets = shuffled.slice(0, sk.aoe.maxTargets || enemies.length);
    } else {
      const t = pickTarget2(enemies, sk.priority);
      if (t) targets = [t];
    }
    for (const dmgFormula of sk.damage) {
      for (const t of targets) {
        if (t.isDead) continue;
        actionTargets.push(t.def.name);
        const mageCnt = state.units.filter(
          (u) => u.team === caster.team && !u.isDead && u.def.race === "mage"
        ).length;
        const mageMdefMult = mageCnt >= 4 ? 0.6 : mageCnt >= 3 ? 0.7 : mageCnt >= 2 ? 0.8 : 1;
        const origMdef = t.currentMagicalDef;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = Math.floor(t.currentMagicalDef * mageMdefMult);
        const result = calcDamage(
          caster,
          t,
          (dmgFormula.atkRatio ?? 1) * (caster.skillPower || 1),
          dmgFormula.type,
          {
            fixedAdd: dmgFormula.fixedAdd,
            defMultiplier: dmgFormula.defMultiplier,
            defSquaredDiv: dmgFormula.defSquaredDiv,
            selfDefMultiplier: dmgFormula.selfDefMultiplier,
            targetMaxHpRatio: dmgFormula.targetMaxHpRatio,
            isSkill: true,
            evasion: t.evasion,
            hitRateMod: caster.hitRateMod
          }
        );
        const fs = applyFatalStrike(caster, result.finalDamage, true);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        if (caster.def.id === "dyq" && sk.aoe && targets.filter((x) => !x.isDead).length >= 3) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7);
        }
        deferDamage(t, result.finalDamage, state);
        t._wasDamagedDuringCast = true;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = origMdef;
        t.lastDamage = {
          value: result.finalDamage,
          time: state.time,
          type: dmgFormula.type
        };
        t.lastAction = { time: state.time, isTarget: true };
        addStat2(state, caster.id, "totalDamageDealt", result.finalDamage);
        addStat2(state, caster.id, "skillDamage", result.finalDamage);
        addStat2(
          state,
          caster.id,
          dmgFormula.type === "physical" ? "physicalDamage" : dmgFormula.type === "magical" ? "magicalDamage" : "pureDamage",
          result.finalDamage
        );
        trackSkill(
          state,
          caster.id,
          sk.id,
          sk.name,
          result.finalDamage,
          dmgFormula.type
        );
        addStat2(state, t.id, "totalDamageReceived", result.finalDamage);
        addStat2(
          state,
          t.id,
          dmgFormula.type === "physical" ? "physicalDamageReceived" : dmgFormula.type === "magical" ? "magicalDamageReceived" : "pureDamageReceived",
          result.finalDamage
        );
        if (result.isCrit) {
          addStat2(state, caster.id, "critCount", 1);
          addStat2(state, caster.id, "critDamage", result.finalDamage);
        }
        if (result.isBlocked) {
          addStat2(state, t.id, "blockCount", 1);
          addStat2(state, t.id, "blockReduced", result.blocked);
        }
        t.lastHitBy = caster.id;
        if (result.finalDamage > 0) {
          log.push({
            time: state.time,
            text: `${pfx2(caster)} \u2192 ${pfx2(t)}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} type=${dmgFormula.type} def=${dmgFormula.type === "magical" ? Math.floor(t.currentMagicalDef) : Math.floor(t.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / (result.isCrit ? 1.35 : 1)).toFixed(0) : ""}` : ""}`,
            type: "damage"
          });
          if (mageCnt >= 3 && Math.random() < 0.52) {
            for (const m of state.units.filter(
              (x) => x.team === caster.team && !x.isDead && x.def.race === "mage"
            )) {
              m._mageAtkMult = (m._mageAtkMult || 1) * 1.065;
              m._mageAtkExpire = state.time + 20;
            }
            log.push({
              time: state.time,
              text: `\u2728 \u6CD5\u5E08\u7F81\u7ECA: \u5168\u4F53\u6CD5\u5E08\u653B\u51FB+6%\xD720s`,
              type: "status"
            });
          }
          if ((caster.lifeSteal ?? 0) > 0 && result.finalDamage > 0) {
            const lsHeal = Math.floor(
              result.finalDamage * (caster.lifeSteal ?? 0)
            );
            caster.currentHp = Math.min(
              caster.maxHp,
              caster.currentHp + lsHeal
            );
            addStat2(state, caster.id, "lifeStealHealing", lsHeal);
            log.push({
              time: state.time,
              text: `\u{1F517} ${pfx2(caster)} \u94FE\u63A5\u5438\u8840 +${lsHeal}`,
              type: "heal"
            });
          }
        }
      }
    }
  }
  if (sk.heal) {
    let targets = [];
    if (sk.id === "dxm_heal") {
      const beast = allies.filter((a) => a.def.race === "beast").sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      const all = allies.sort(
        (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
      );
      targets = [beast[0] || all[0]];
      caster._dxmCastCount = (caster._dxmCastCount || 0) + 1;
      const upgraded = caster._dxmCastCount % 4 === 0;
    } else if (sk.id === "lxgz_heal") {
      targets = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp).slice(0, 2);
    } else if (sk.id === "wlgyz_heal") {
      targets = shuffle2(allies).slice(0, 2);
    } else if (sk.id === "hbfl_heal") {
      const candidates = allies.filter(
        (a) => a.def.race === "dragon" && a.currentHp / a.maxHp < 0.75
      );
      targets = candidates.length > 0 ? [candidates[0]] : [];
    } else {
      targets = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp).slice(0, 1);
    }
    for (const t of targets) {
      if (t.isDead) continue;
      actionTargets.push(t.def.name);
      const amount = calcHeal(caster, t, sk.heal.atkRatio ?? 1, {
        fixedAdd: sk.heal.fixedAdd,
        targetMaxHpRatio: sk.heal.targetMaxHpRatio,
        targetLostHpRatio: sk.heal.targetLostHpRatio
      });
      let finalAmount = amount;
      if (sk.id === "dxm_heal" && caster._dxmCastCount && caster._dxmCastCount % 4 === 0) {
        finalAmount = Math.floor(amount * 1.5);
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
          "poison"
        ];
        t.statuses = t.statuses.filter((s) => !neg.includes(s.type));
      }
      t.currentHp = Math.min(t.maxHp, t.currentHp + finalAmount);
      t.lastHeal = { value: amount, time: state.time };
      t.lastAction = { time: state.time, isTarget: true };
      addStat2(state, caster.id, "totalHealingDone", amount);
      addStat2(state, caster.id, "skillHealing", amount);
      addStat2(state, t.id, "totalHealingReceived", amount);
      log.push({
        time: state.time,
        text: `${pfx2(caster)} \u{1F49A} ${pfx2(t)}: +${amount}${state._debug ? ` (atk=${Math.floor(caster.currentAttack)} \xD7 ${sk.heal.atkRatio ?? 1})` : ""}`,
        type: "heal"
      });
    }
  }
  if (actionTargets.length > 0) {
    caster.lastAction = {
      time: state.time,
      targetName: [...new Set(actionTargets)].join(",")
    };
  }
  if (sk.effects) {
    const targets = sk.aoe ? shuffle2(enemies).slice(0, sk.aoe.maxTargets || enemies.length) : [pickTarget2(enemies, sk.priority)].filter(Boolean);
    for (const t of targets) {
      if (!t || t.isDead) continue;
      for (const eff of sk.effects) {
        if (eff.chance !== void 0 && Math.random() > eff.chance) continue;
        const negative = [
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
          "doom",
          "poison"
        ];
        if (negative.includes(eff.type) && t._immuneAbnormal) continue;
        const val = eff.type === "burn" ? Math.floor(caster.currentAttack * (eff.value || 0.05)) : eff.value;
        t.statuses.push({
          type: eff.type,
          remainingSeconds: eff.duration,
          stacks: 1,
          value: val
        });
        if (caster.def.race === "mage" && !isRuined(caster)) {
          for (const u of state.units.filter(
            (x) => x.team === caster.team && !x.isDead && x.def.id === "sjsn"
          )) {
            u.cooldownRemaining = Math.max(0, u.cooldownRemaining - 1.5);
          }
        }
        for (const u of state.units.filter(
          (x) => x.team === caster.team && !x.isDead && x.def.id === "bmxz"
        )) {
          u.cooldownRemaining = Math.max(0, u.cooldownRemaining - 1);
        }
      }
    }
  }
}
function addStat2(state, unitId, field, value) {
  const s = state.stats?.find((st) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}
function trackSkill(state, unitId, skillId, skillName, damage, dmgType) {
  if (!state.skillStats) state.skillStats = {};
  const key = `${unitId}_${skillId}`;
  const existing = state.skillStats[key];
  if (!existing) {
    state.skillStats[key] = {
      skillName,
      ownerId: unitId,
      casts: 0,
      totalDamage: 0,
      physDmg: 0,
      magDmg: 0,
      pureDmg: 0
    };
  }
  const s = state.skillStats[key];
  s.casts += 1;
  s.totalDamage += damage;
  if (dmgType === "physical") s.physDmg += damage;
  else if (dmgType === "magical") s.magDmg += damage;
  else s.pureDmg += damage;
}

// scripts/symmetryTest.ts
var ROSTER = {
  beast: ["pp", "hl", "yl", "hx", "zzx", "dxm", "lbmx", "ds"],
  hunter: ["sszs", "bslr", "hqs", "mds", "zfyx", "lxgz", "xjlr", "xblr"],
  warrior: ["crzs", "hd", "fxz", "fdzs", "kzs", "slzs", "zqz", "jdds"],
  mage: ["xdds", "sjsn", "bmxz", "srm", "ynfs", "syz", "zs", "xjl"],
  undead: ["wqqs", "kldd", "yammxz", "dyq", "swxz", "wlgyz", "mrsz", "hyz"],
  dragon: ["hlyl", "bsxl", "xyfl", "hbfl", "bjl", "xcl", "dl", "lyz"]
};
var RACE_CN = {
  beast: "\u517D\u65CF",
  hunter: "\u730E\u4EBA",
  warrior: "\u6218\u58EB",
  mage: "\u6CD5\u5E08",
  undead: "\u4EA1\u7075",
  dragon: "\u9F99\u65CF"
};
var RACES = ["beast", "undead", "dragon", "mage", "hunter", "warrior"];
function makeTeam(ids) {
  const positions = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1]];
  return ids.slice(0, 8).map((cid, i) => ({ charId: cid, row: positions[i][0], col: positions[i][1] }));
}
function runOne(ally, enemy) {
  const state = initBattle(makeTeam(ally), makeTeam(enemy));
  let safety = 0;
  while (state.phase === "fighting" && safety < 5e3) {
    processTick(state);
    safety++;
  }
  return state.winner || "enemy";
}
async function main() {
  const RUNS = 150;
  console.log(`\u9635\u8425\u5BF9\u79F0\u6027\u9A8C\u8BC1 (\u6BCF\u65B9\u5411 ${RUNS} \u5C40)`);
  console.log("=".repeat(72));
  console.log("\u5BF9\u5C40            A\u89C6\u89D2  B\u89C6\u89D2  \u4E92\u8865\u548C  \u5224\u5B9A");
  console.log("-".repeat(72));
  let totalDev = 0, worst = 0;
  const pairs = [];
  for (let i = 0; i < RACES.length; i++)
    for (let j = i + 1; j < RACES.length; j++) pairs.push([RACES[i], RACES[j]]);
  for (const [a, b] of pairs) {
    let aWins = 0;
    for (let k = 0; k < RUNS; k++) if (runOne(ROSTER[a], ROSTER[b]) === "ally") aWins++;
    const pctAB = aWins / RUNS * 100;
    let bWins = 0;
    for (let k = 0; k < RUNS; k++) if (runOne(ROSTER[b], ROSTER[a]) === "ally") bWins++;
    const pctBA = bWins / RUNS * 100;
    const sum = pctAB + pctBA;
    const dev = Math.abs(sum - 100);
    totalDev += dev;
    worst = Math.max(worst, dev);
    const verdict = dev > 10 ? "\u{1F534} \u4E0D\u5BF9\u79F0!" : dev > 5 ? "\u{1F7E1} \u504F\u5DEE" : "\u2705 \u5BF9\u79F0";
    console.log(
      `${RACE_CN[a].padEnd(4)} vs ${RACE_CN[b].padEnd(4)}: ${pctAB.toFixed(1).padStart(6)}%  ${pctBA.toFixed(1).padStart(6)}%  ${sum.toFixed(1).padStart(6)}%  ${verdict}`
    );
  }
  console.log("-".repeat(72));
  console.log(`\u5E73\u5747\u504F\u5DEE: ${(totalDev / pairs.length).toFixed(2)}pp | \u6700\u5927\u504F\u5DEE: ${worst.toFixed(1)}pp`);
  console.log(`
\u5224\u5B9A\u6807\u51C6: \u4E92\u8865\u548C\u2248100% = \u5F15\u64CE\u5BF9\u79F0 (\u65E0ally/enemy\u504F\u7F6E)`);
  console.log(`\u504F\u5DEE>10pp \u8BF4\u660E\u5B58\u5728\u9635\u8425\u4E0D\u5BF9\u79F0 (\u7C7B\u4F3C\u4E4B\u524D\u7684\u795E\u8C15\u8005bug)`);
}
main();
