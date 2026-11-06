"use strict";

// src/engine/damage.ts
var battleClock = 0;
function setBattleClock(t) {
  battleClock = t;
}
function nowOf(extraOpts) {
  const explicit =
    extraOpts && typeof extraOpts === "object" && "now" in extraOpts
      ? extraOpts.now
      : void 0;
  return explicit ?? battleClock;
}
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
    case "holy" /* Holy */:
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
  let ignoreExtraDef = extraOpts?.ignoreExtraDef === true;
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
    hit: true,
  };
  const evasion = defender.statuses.some(
    (s) => s.type === "petrify" /* Petrify */
  )
    ? 0
    : (extraOpts?.evasion ?? 0);
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
        (totalDef * totalDef) / extraOpts.defSquaredDiv
      );
    } else if (extraOpts?.selfDefMultiplier) {
      result.rawDamage =
        attacker.currentPhysicalDef * extraOpts.selfDefMultiplier;
    } else if (extraOpts?.targetMaxHpRatio) {
      result.rawDamage = defender.maxHp * extraOpts.targetMaxHpRatio;
    } else {
      result.rawDamage =
        attacker.currentAttack * (skillAtkRatio ?? 1) +
        (extraOpts?.fixedAdd ?? 0);
    }
  } else {
    const atk = attacker.currentAttack;
    let effectiveAtk =
      atk *
      (attacker.statuses.some((s) => s.type === "burn" /* Burn */) ? 0.9 : 1) *
      (attacker.statuses.some((s) => s.type === "curse" /* Curse */) ? 0.9 : 1);
    if (attacker.statuses.some((s) => s.type === "curl")) {
      effectiveAtk *= 0.8;
    }
    if (attacker._ylRoarMult) {
      effectiveAtk *= attacker._ylRoarMult;
    }
    if (attacker._wqqsAtkMult) {
      effectiveAtk *= attacker._wqqsAtkMult;
    }
    if (attacker._hyzStacks) {
      effectiveAtk *= 1 + attacker._hyzStacks * 0.06;
    }
    if (attacker._dragonAtkMult) {
      effectiveAtk *= attacker._dragonAtkMult;
    }
    if (attacker._bmxzAtkBonus) {
      effectiveAtk *= 1 + attacker._bmxzAtkBonus;
    }
    if (attacker.def.id === "fdzs" && defender.row === 0) {
      effectiveAtk *= 1.3;
    }
    if (attacker._hlRageAtkMult) {
      effectiveAtk *= attacker._hlRageAtkMult;
    }
    if (attacker._kzsAtkMult) {
      effectiveAtk *= attacker._kzsAtkMult;
    }
    if (attacker._jddsAtkBonus) {
      effectiveAtk *= 1 + attacker._jddsAtkBonus;
    }
    if (attacker._slzsAtkMult) {
      effectiveAtk *= attacker._slzsAtkMult;
    }
    if (attacker._hlRageAtkMult) {
      effectiveAtk *= attacker._hlRageAtkMult;
    }
    if (
      defender._bslrAtkDown &&
      defender._bslrDebuffUntil &&
      defender._bslrDebuffUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 - defender._bslrAtkDown;
    }
    if (attacker.def.id === "hqs") {
      const rowBonus = defender.row === 2 ? 0.2 : defender.row === 1 ? 0.1 : 0;
      effectiveAtk *= 1 + rowBonus;
      if (nowOf(extraOpts) > 60) effectiveAtk *= 1.5;
    }
    if (attacker._frenzy) {
      effectiveAtk *= attacker._frenzy === 2 ? 2 : 1.5;
    }
    if (attacker._warriorAtkMult) {
      effectiveAtk *= attacker._warriorAtkMult;
    }
    if (attacker._zfyxAtkUntil && attacker._zfyxAtkUntil > nowOf(extraOpts)) {
      effectiveAtk *= 1.15;
    }
    if (
      attacker._zfyxAtkStacks &&
      attacker._zfyxAtkUntil &&
      attacker._zfyxAtkUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._zfyxAtkStacks * 0.1;
    }
    if (
      attacker._xdDmgDownUntil &&
      attacker._xdDmgDownUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 - (attacker._xdDmgDown || 0.2);
    }
    if (attacker.def.id === "mrsz" && defender.statuses.length > 0) {
      effectiveAtk *= attacker.hasRevived ? 1.2 : 1.1;
    }
    if (attacker._cutinDmgRed) {
      effectiveAtk *= attacker._cutinDmgRed;
    }
    if (attacker._xdBlessUntil && attacker._xdBlessUntil > nowOf(extraOpts)) {
      effectiveAtk *= 1.1;
    }
    if (
      attacker.def.id === "qm" &&
      attacker._qmLayers &&
      attacker._qmUntil &&
      attacker._qmUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._qmLayers * 0.06;
    }
    if (
      attacker._hqsStacks &&
      attacker._hqsExpire &&
      attacker._hqsExpire > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._hqsStacks * 0.25;
    }
    if (
      attacker._inspireAtkUntil &&
      attacker._inspireAtkUntil > nowOf(extraOpts) &&
      attacker._inspireAtkMult
    ) {
      effectiveAtk *= attacker._inspireAtkMult;
    }
    if (attacker._hunterBondLayers?.length) {
      const nowH = nowOf(extraOpts);
      let hBonus = 0;
      for (const l of attacker._hunterBondLayers)
        if (l.expire > nowH) hBonus += l.value;
      effectiveAtk *= 1 + hBonus;
    }
    const mageMult = attacker._mageAtkMult || 1;
    result.rawDamage =
      effectiveAtk * skillAtkRatio * mageMult +
      (extraOpts?.fixedAdd ?? 0) +
      (extraOpts?.targetCurrentHpRatio
        ? defender.currentHp * extraOpts.targetCurrentHpRatio
        : 0);
  }
  if (type === "physical" /* Physical */) {
    let def = defender.currentPhysicalDef;
    const baseDef = defender.basePhysicalDef ?? def;
    if (defender.statuses.some((s) => s.type === "curl")) def *= 1.5;
    if (
      defender.statuses.some((s) => s.type === "armorBreak" /* ArmorBreak */)
    ) {
      const abBase = Math.min(baseDef, Math.max(0, def));
      def = Math.max(0, def - abBase) * 0.5;
    }
    if (
      defender._lbmxArmorBreakUntil &&
      defender._lbmxArmorBreakUntil > nowOf(extraOpts)
    ) {
      def *= 1 - (defender._lbmxArmorBreakPct || 0.2);
    }
    if (defender._hyzStacks) def *= 1 + defender._hyzStacks * 0.06;
    if (defender._jddsDefBonus) def *= 1 + defender._jddsDefBonus;
    if (defender._warriorDefMult) def *= defender._warriorDefMult;
    if (
      defender._hqsStacks &&
      defender._hqsExpire &&
      defender._hqsExpire > nowOf(extraOpts)
    ) {
      def *= 1 + defender._hqsStacks * 0.7;
    }
    if (defender.statuses.some((s) => s.type === "curse" /* Curse */))
      def *= 0.9;
    if (
      type === "physical" /* Physical */ &&
      defender.statuses.some((s) => s.type === "freeze" /* Freeze */)
    ) {
      result.rawDamage = 0;
      result.finalDamage = 0;
      return result;
    }
    let ignoreDef = extraOpts?.ignoreDefPct ?? 0;
    const bslrChance = extraOpts?.isSkill === true ? 0.4 : 0.375;
    const bslrActive =
      attacker.def.id === "bslr" &&
      !(
        attacker._bslrBreakUntil && attacker._bslrBreakUntil > nowOf(extraOpts)
      );
    if (attacker.def.id === "bslr" && !bslrActive) {
      ignoreDef = 0;
    } else if (bslrActive && Math.random() < bslrChance) {
      ignoreExtraDef = true;
      defender._antiHealMult = 0.75;
      defender._antiHealUntil = nowOf(extraOpts) + 2;
    }
    if (defender._qdInvulnUntil && defender._qdInvulnUntil > nowOf(extraOpts)) {
      result.finalDamage = 0;
      return result;
    }
    if (
      defender.def.id === "qm" &&
      defender._qmLayers &&
      defender._qmUntil &&
      defender._qmUntil > nowOf(extraOpts)
    ) {
      if (type === "physical" /* Physical */)
        def *= 1 + defender._qmLayers * 0.2;
      else if (type === "magical" /* Magical */)
        def *= 1 + defender._qmLayers * 0.2;
    }
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
    else if (ignoreDef > 0) def = basePart * (1 - ignoreDef) + extraPart;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
    if (defender.physDamageReduction) {
      result.afterDef *= 1 - defender.physDamageReduction;
    }
  } else if (type === "magical" /* Magical */) {
    let def = defender.currentMagicalDef;
    const baseDef = defender.baseMagicalDef ?? def;
    if (defender.statuses.some((s) => s.type === "curl")) def *= 1.5;
    if (
      defender.statuses.some((s) => s.type === "armorBreak" /* ArmorBreak */)
    ) {
      const abBase = Math.min(baseDef, Math.max(0, def));
      def = Math.max(0, def - abBase) * 0.5;
    }
    if (
      defender._lbmxArmorBreakUntil &&
      defender._lbmxArmorBreakUntil > nowOf(extraOpts)
    ) {
      def *= 1 - (defender._lbmxArmorBreakPct || 0.2);
    }
    if (defender._hyzStacks) def *= 1 + defender._hyzStacks * 0.06;
    if (defender._jddsDefBonus) def *= 1 + defender._jddsDefBonus;
    if (defender._warriorDefMult) def *= defender._warriorDefMult;
    if (
      defender._hqsStacks &&
      defender._hqsExpire &&
      defender._hqsExpire > nowOf(extraOpts)
    ) {
      def *= 1 + defender._hqsStacks * 0.7;
    }
    if (defender.statuses.some((s) => s.type === "curse" /* Curse */))
      def *= 0.9;
    if (defender.statuses.some((s) => s.type === "petrify" /* Petrify */))
      def *= 2;
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
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
  let holyDr = 1;
  if (defender._lyzDrUntil && defender._lyzDrUntil > nowOf(extraOpts)) {
    holyDr *= 1 - (defender._lyzDr || 0.2);
  }
  if (
    defender._qdDrUntil &&
    defender._qdDrUntil > nowOf(extraOpts) &&
    defender._qdDrPct
  ) {
    holyDr *= 1 - defender._qdDrPct;
  }
  if (defender._hlRageDrMult) {
    holyDr *= 1 - defender._hlRageDrMult;
  }
  if (defender.def.id === "mds" && extraOpts?.isSkill === true) {
    const now = nowOf(extraOpts);
    defender._mdsHitCount = (defender._mdsHitCount || 0) + 1;
    defender._mdsHitUntil = now;
    const stacks = Math.min(3, defender._mdsHitCount);
    holyDr *= 1 - (stacks >= 3 ? 0.4 : 0.2);
    if (stacks >= 3 && defender._mdsPunished !== now) {
      defender._mdsPunished = now;
      attacker.statuses.push({
        type: "petrify" /* Petrify */,
        remainingSeconds: 2,
        stacks: 1,
      });
    }
  }
  if (
    defender._sqShieldUntil &&
    defender._sqShieldUntil > nowOf(extraOpts) &&
    type === "magical" /* Magical */
  ) {
    holyDr *= 0.7;
  }
  if (defender._xdBlessUntil && defender._xdBlessUntil > nowOf(extraOpts)) {
    holyDr *= 0.9;
  }
  if (defender.def.id === "sc" && defender._scDr) {
    holyDr *= 1 - defender._scDr;
  }
  let otherReduction = 1;
  if (extraOpts?.cdrOverride !== void 0) {
    otherReduction *= extraOpts.cdrOverride;
  }
  const inspire = defender.statuses.find(
    (s) => s.type === "inspire" /* Inspire */
  );
  if (inspire) {
    otherReduction *= inspire.value ?? 0.7;
  }
  if (defender._zzxDrUntil && defender._zzxDrUntil > nowOf(extraOpts)) {
    otherReduction *=
      type === "physical" /* Physical */
        ? 1 - (defender._zzxDrPhys || 0)
        : 1 - (defender._zzxDrMag || 0.25);
  }
  let permDR = defender.damageReduction || 0;
  if (defender._kzsDr) permDR += defender._kzsDr;
  if (defender._slzsDr) permDR += defender._slzsDr;
  if (defender._warriorDr) {
    const wdr = defender._warriorDr;
    const wmag = defender._warriorMagMult;
    if (type === "magical" /* Magical */ && wmag) {
      otherReduction *= 1 - wdr * wmag;
    } else {
      otherReduction *= 1 - wdr;
    }
  }
  if (permDR > 0) {
    otherReduction *= 1 - permDR;
  }
  if (
    defender._lxgzDrUntil &&
    defender._lxgzDrUntil > nowOf(extraOpts) &&
    defender._lxgzDrPct
  ) {
    otherReduction *= 1 - defender._lxgzDrPct;
  }
  if (defender._lyzTalentDrPct) {
    otherReduction *= 1 - defender._lyzTalentDrPct;
  }
  otherReduction *= holyDr;
  result.afterOtherReduction = result.afterFrontRow * otherReduction;
  if (type !== "pure" /* Pure */) {
    const blockChance = getBlockChance(defender.def.race, defender.row === 0);
    if (Math.random() < blockChance) {
      result.isBlocked = true;
      const def =
        type === "physical" /* Physical */
          ? defender.currentPhysicalDef
          : defender.currentMagicalDef;
      result.blocked = calcBlockValue(def, defender.def.race);
    }
  }
  result.finalDamage = Math.max(
    0,
    Math.floor(result.afterOtherReduction - result.blocked)
  );
  let baseCritRate = 0.075;
  if (extraOpts?.critBonus) baseCritRate += extraOpts.critBonus;
  const defenderTenacity = defender.tenacity || 0;
  result.isCrit = checkCrit(baseCritRate, defenderTenacity);
  if (result.isCrit && result.finalDamage > 0) {
    const critDmgMult = 1.35 * (1 - 4e-3 * Math.min(defenderTenacity, 100));
    result.finalDamage = Math.floor(
      result.finalDamage * Math.max(critDmgMult, 1)
    );
  }
  if (
    defender._sqShieldUntil &&
    defender._sqShieldUntil > nowOf(extraOpts) &&
    result.finalDamage > 0 &&
    attacker !== defender &&
    !attacker.isDead
  ) {
    const reflect = Math.max(1, Math.floor(result.rawDamage * 0.1));
    attacker.currentHp -= reflect;
    attacker.lastDamage = {
      value: reflect,
      time: nowOf(extraOpts),
      type: "pure",
    };
  }
  if (defender._guarded) {
    result.hit = false;
    result.finalDamage = 0;
  }
  const nowDebuff = nowOf(extraOpts);
  if (attacker._reviveDebuffUntil && attacker._reviveDebuffUntil > nowDebuff)
    result.finalDamage = Math.floor(result.finalDamage * 0.75);
  if (defender._reviveDebuffUntil && defender._reviveDebuffUntil > nowDebuff)
    result.finalDamage = Math.floor(result.finalDamage * 1.25);
  return result;
}
function applyFatalStrike(attacker, damage, isSkill) {
  if (attacker.def.id !== "dyq" || damage <= 0)
    return { damage, triggered: false };
  const chance = isSkill ? 0.45 : 0.25;
  if (Math.random() < chance) {
    const fatal = Math.floor(damage * 1.5);
    const mult = attacker.hasRevived ? 1.9 : 1.5;
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
  if (target._healReductionUntil && target._healReductionUntil > 0) {
    heal *= 1 - (target._healReduction || 0);
  }
  return Math.floor(Math.max(0, heal));
}

// src/data/races.ts
var BASE_BONDS = {
  // v3.3 平衡性调整（docs/V3.3平衡性调整.md）：羁绊数值以该文档为准
  ["beast" /* Beast */]: {
    2: { attackBonus: 5, defenseBonus: 10, special: "\u97E7\u6027+10%" },
    3: {
      attackBonus: 10,
      defenseBonus: 15,
      special:
        "\u97E7\u6027+20%+\u5BF9<75%HP\u654C\u4EBA\u666E\u653B\u9644\u5E266%\u653B\u51FB\u7EAF\u7CB9\u4F24\u5BB3",
    },
    4: {
      attackBonus: 20,
      defenseBonus: 25,
      special:
        "\u97E7\u6027+35%+\u5BF9<75%HP\u654C\u4EBA\u666E\u653B\u9644\u5E2615%\u653B\u51FB\u7EAF\u7CB9\u4F24\u5BB3",
    },
  },
  ["hunter" /* Hunter */]: {
    // v3.4 R1: 用户裁定「只增加攻击速度，不增加攻击力」
    2: { attackSpeedBonus: 10, hitRateBonus: 10 },
    3: {
      attackSpeedBonus: 15,
      hitRateBonus: 20,
      special:
        "\u53D7\u5230[\u5207\u5165]\u6280\u80FD\u4F24\u5BB3-15%+\u6BCF6\u6B21\u653B\u51FB\u989D\u59161\u76EE\u6807(30%\u4F24\u5BB3)",
      // v3.4 R19: 35→30%
    },
    4: {
      attackSpeedBonus: 30,
      hitRateBonus: 40,
      special:
        "\u53D7\u5230[\u5207\u5165]\u6280\u80FD\u4F24\u5BB3-25%+\u81EA\u8EAB+10%\u653B(\u6700\u591A3\u5C42/20s)+\u6BCF5\u6B21\u653B\u51FB\u989D\u59161\u76EE\u6807(60%\u4F24\u5BB3)",
      // v3.4 R19: 40s→20s / 70→60%
    },
  },
  ["warrior" /* Warrior */]: {
    2: {
      hpBonus: 10,
      special:
        "5%\u51CF\u4F24(\u9B54\u4F241.5\u500D)+\u6BCF13s\u6062\u590D3%\u6700\u5927HP",
    },
    3: {
      hpBonus: 20,
      special:
        "10%\u51CF\u4F24(\u9B54\u4F241.5\u500D)+\u6BCF11s\u6062\u590D4%\u6700\u5927HP+HP<60%\u65F6\u989D\u591610%\u653B",
    },
    4: {
      hpBonus: 35,
      special:
        "15%\u51CF\u4F24(\u9B54\u4F241.5\u500D)+\u6BCF9s\u6062\u590D5%\u6700\u5927HP+HP<80%\u65F6\u989D\u591615%\u653B",
    },
  },
  ["mage" /* Mage */]: {
    2: { special: "-15%\u654C\u65B9\u9B54\u9632" },
    3: {
      special:
        "-20%\u654C\u65B9\u9B54\u9632+\u53CB\u65B9\u6280\u80FD\u51B7\u5374-7%+\u65BD\u6CD530%\u6982\u7387\u5168\u4F53\u6CD5\u5E08+2%\u653B15s(\u6BCF\u5C42\u72EC\u7ACB\u8BA1\u65F6)",
    },
    4: {
      special:
        "-30%\u654C\u65B9\u9B54\u9632+\u53CB\u65B9\u6280\u80FD\u51B7\u5374-9%+\u65BD\u6CD550%\u6982\u7387\u5168\u4F53\u6CD5\u5E08+3%\u653B25s(\u6BCF\u5C42\u72EC\u7ACB\u8BA1\u65F6)",
    },
  },
  ["undead" /* Undead */]: {
    2: { evasionBonus: 5 },
    3: {
      evasionBonus: 10,
      special:
        "\u9996\u6B21\u9635\u4EA110s\u540E\u590D\u6D3B\u81F315%HP\uFF0C2s\u540E\u6BCF\u79D2\u5931\u53BB3%\u6700\u5927HP(\u65E0\u6CD5\u9A71\u6563)+\u590D\u6D3B\u540E15s\u9020\u6210\u4F24\u5BB3-25%/\u53D7\u4F24+25%",
    },
    4: {
      evasionBonus: 20,
      special:
        "\u9996\u6B21\u9635\u4EA15s\u540E\u590D\u6D3B\u81F325%HP\uFF0C3s\u540E\u6BCF\u79D2\u5931\u53BB2%\u6700\u5927HP(\u65E0\u6CD5\u9A71\u6563)+\u590D\u6D3B\u540E15s\u9020\u6210\u4F24\u5BB3-25%/\u53D7\u4F24+25%",
    },
  },
  ["dragon" /* Dragon */]: {
    2: {},
    3: {
      special:
        "\u8D77\u59CB\u51B7\u5374-20%+\u51CF\u4F248%+\u5F00\u5C402\u500D\u51CF\u4F246s",
    },
    // v3.15d: 4→8
    4: {
      special:
        "\u8D77\u59CB\u51B7\u5374-35%+\u51CF\u4F2412%+\u5F00\u5C402.5\u500D\u51CF\u4F2410s",
    },
    // v3.15d: 6→12
  },
  ["holy" /* Holy */]: {
    2: {
      special:
        "\u654C\u65B9#\u589E\u76CA/#\u6CBB\u7597\u6548\u679C-10%\uFF1A\u6211\u65B9\u5168\u4F53\u83B7\u5F9710%\u76F8\u540C\u589E\u76CA(4s)/\u5E73\u5206\u539F\u672C4%\u6CBB\u7597",
    },
    3: {
      special:
        "\u654C\u65B9#\u589E\u76CA/#\u6CBB\u7597/#\u63A7\u5236\u6548\u679C-15%\uFF1A\u6211\u65B915%\u589E\u76CA(5s)/\u5E73\u520610%\u6CBB\u7597/\u63A7\u5236\u53CD\u52365%",
    },
    4: {
      special:
        "\u654C\u65B9#\u589E\u76CA/#\u6CBB\u7597/#\u63A7\u5236\u6548\u679C-20%\uFF1A\u6211\u65B920%\u589E\u76CA(5s)/\u5E73\u520615%\u6CBB\u7597/\u63A7\u5236\u53CD\u523610%",
    },
  },
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
  } catch {}
  const ov = overrides[race] || {};
  return {
    attackBonus: ov.attackBonus ?? tier.attackBonus ?? 0,
    defenseBonus: ov.defenseBonus ?? tier.defenseBonus ?? 0,
    hpBonus: ov.hpBonus ?? tier.hpBonus ?? 0,
    hitRateBonus: ov.hitRateBonus ?? tier.hitRateBonus ?? 0,
    attackSpeedBonus: ov.attackSpeedBonus ?? tier.attackSpeedBonus ?? 0,
    evasionBonus: ov.evasionBonus ?? tier.evasionBonus ?? 0,
    special: ov.special ?? tier.special,
  };
}
var RACE_CONFIG = {
  ["beast" /* Beast */]: {
    label: "\u517D\u65CF",
    color: "#8d6e63",
    short: "\u517D",
  },
  ["hunter" /* Hunter */]: {
    label: "\u730E\u4EBA",
    color: "#4caf50",
    short: "\u730E",
  },
  ["warrior" /* Warrior */]: {
    label: "\u6218\u58EB",
    color: "#f44336",
    short: "\u6218",
  },
  ["mage" /* Mage */]: {
    label: "\u6CD5\u5E08",
    color: "#2196f3",
    short: "\u6CD5",
  },
  ["undead" /* Undead */]: {
    label: "\u4EA1\u7075",
    color: "#9c27b0",
    short: "\u4EA1",
  },
  ["dragon" /* Dragon */]: {
    label: "\u9F99\u65CF",
    color: "#ff9800",
    short: "\u9F99",
  },
  ["holy" /* Holy */]: {
    label: "\u5723\u804C\u8005",
    color: "#ffd54f",
    short: "\u5723",
  },
};
var RACE_BG = {
  ["beast" /* Beast */]: "linear-gradient(135deg,#4e342e,#3e2723)",
  ["hunter" /* Hunter */]: "linear-gradient(135deg,#1b5e20,#2e7d32)",
  ["warrior" /* Warrior */]: "linear-gradient(135deg,#b71c1c,#c62828)",
  ["mage" /* Mage */]: "linear-gradient(135deg,#0d47a1,#1565c0)",
  ["undead" /* Undead */]: "linear-gradient(135deg,#4a148c,#6a1b9a)",
  ["dragon" /* Dragon */]: "linear-gradient(135deg,#e65100,#ef6c00)",
  ["holy" /* Holy */]: "linear-gradient(135deg,#b8932a,#8a6a12)",
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
registerSkillHandler("lyz_heal", (caster, state, log) => {
  const dragons = state.units
    .filter(
      (u) => u.team === caster.team && !u.isDead && u.def.race === "dragon"
    )
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  if (dragons.length === 0) return;
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount % 4 === 0;
  const targets = upgraded ? dragons : [dragons[0]];
  for (const t of targets) {
    t.statuses.push({
      type: "lyz_heal_dot",
      remainingSeconds: 4,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.4),
      sourceId: caster.id,
    });
    t._lyzDrUntil = state.time + 4;
    t._lyzDr = 0.2;
    log.push({
      time: state.time,
      text: `\u{1F3B5} ${caster.def.name} \u6CBB\u7597 ${t.def.name}: \u6BCF\u79D2\u653B\u51FB\xD740% + \u51CF\u4F2420% \xD74s${upgraded ? " [\u5347\u7EA7\xB7\u5168\u4F53\u9F99\u65CF]" : ""}`,
      type: "heal",
    });
  }
  if (upgraded) {
    const dead = state.units.filter(
      (u) =>
        u.team === caster.team &&
        u.isDead &&
        u.def.race === "dragon" &&
        !u.tempReviveTimer
    );
    if (dead.length > 0) {
      const r = dead[Math.floor(Math.random() * dead.length)];
      r.isDead = false;
      r.currentHp = Math.max(1, Math.floor(r.maxHp * 0.5));
      r.statuses = [];
      r.tempReviveTimer = 5;
      r.invincibleTimer = 5;
      log.push({
        time: state.time,
        text: `\u{1F3B5} ${caster.def.name} \u5347\u7EA7\u590D\u6D3B ${r.def.name} \u65E0\u654C5s`,
        type: "status",
      });
    }
  }
});
registerSkillHandler("srm_fire", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const cost = Math.floor(caster.currentHp * 0.05);
  caster.currentHp -= cost;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const result = calcDamage(
    caster,
    target,
    caster.def.skill.damage?.[0]?.atkRatio ?? 1.8,
    "magical" /* Magical */,
    {
      // v3.16: 180%
      isSkill: true,
    }
  );
  target.currentHp -= result.finalDamage;
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "magical"
  );
  target.statuses.push({
    type: "stun" /* Stun */,
    remainingSeconds: 0.5,
    stacks: 1,
  });
  target.lastDamage = {
    value: result.finalDamage,
    time: state.time,
    type: "magical",
  };
  target.lastHitBy = caster.id;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "magicalDamage", result.finalDamage);
  addStat(state, target.id, "totalDamageReceived", result.finalDamage);
  log.push({
    time: state.time,
    text: `\u{1F525} ${caster.def.name} \u706B\u7130\u7206\u8F70 ${target.def.name}: ${result.finalDamage}\u{1F4A5}`,
    type: "damage",
  });
  const roll3 = Math.random();
  const nCasts = roll3 < 0.25 ? 3 : roll3 < 0.7 ? 2 : 1;
  for (let i = 1; i < nCasts; i++) {
    const t2 = enemies.filter((u) => u.id !== target.id);
    if (t2.length === 0) break;
    const extraTarget = t2[Math.floor(Math.random() * t2.length)];
    const r2 = calcDamage(caster, extraTarget, 1.6, "magical" /* Magical */, {
      isSkill: true,
    });
    extraTarget.currentHp -= r2.finalDamage;
    extraTarget.statuses.push({
      type: "stun" /* Stun */,
      remainingSeconds: 0.5,
      stacks: 1,
    });
    addStat(state, caster.id, "totalDamageDealt", r2.finalDamage);
    addStat(state, caster.id, "skillDamage", r2.finalDamage);
    addStat(state, caster.id, "magicalDamage", r2.finalDamage);
    addStat(state, extraTarget.id, "totalDamageReceived", r2.finalDamage);
    log.push({
      time: state.time,
      text: `\u{1F525} ${caster.def.name} \u989D\u5916\u706B\u7130\u7206\u8F70#${i + 1} ${extraTarget.def.name}: ${r2.finalDamage}\u{1F4A5}`,
      type: "damage",
    });
  }
});
registerSkillHandler("xjl_link", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const mages = allies.filter((u) => u.def.race === "mage");
  const target =
    mages[0] || allies.sort((a, b) => b.currentAttack - a.currentAttack)[0];
  if (target) {
    const prevBonus = target._xjlSkillPowerBonus || 0;
    if (prevBonus > 0) {
      target.skillPower = Math.max(1, (target.skillPower || 1) - prevBonus);
    }
    target.skillPower = (target.skillPower || 1) + 0.3;
    target._xjlSkillPowerBonus = 0.3;
    target._xjlTalentShare = 0.3;
    target._linkOwnerId = caster.id;
    target._linkUntil = state.time + 8;
    log.push({
      time: state.time,
      text: `\u{1F517} ${caster.def.name} \u94FE\u63A5 ${target.def.name}: \u6280\u80FD+30% \u5C0F\u7CBE\u7075\u5929\u8D4B30%\u6548\u679C`,
      type: "status",
    });
  }
});
registerSkillHandler("mrsz_doom", (caster, state, log) => {
  if (caster.currentHp / caster.maxHp < 0.2) return;
  const cost = Math.floor(caster.maxHp * 0.06);
  caster.currentHp -= cost;
  const enemies = getAttackableEnemies(state, caster.team);
  const topDmg = enemies.sort(
    (a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0)
  )[0];
  if (topDmg) {
    topDmg._healReduction = 0.75;
    topDmg._healReductionUntil = state.time + 8;
    topDmg.statuses.push({
      type: "doom",
      remainingSeconds: 8,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.13),
      // v2.18: 10%→9%
      sourceId: caster.id,
    });
    topDmg.statuses.push({
      type: "silence" /* Silence */,
      remainingSeconds: 8,
      stacks: 1,
      sourceId: caster.id,
    });
    topDmg.statuses.push({
      type: "ruin" /* Ruin */,
      remainingSeconds: 8,
      stacks: 1,
      sourceId: caster.id,
    });
    state.trackTalent(
      state,
      caster.id,
      "\u672B\u65E5(\u51CF\u759750%+DoT)",
      1,
      "count"
    );
    log.push({
      time: state.time,
      text: `\u{1F480} ${caster.def.name} \u5BF9 ${topDmg.def.name} \u65BD\u52A0\u672B\u65E58s: \u51CF\u759750%+\u6BCF\u79D213%\u7EAF\u4F24`,
      type: "status",
    });
  }
});
registerSkillHandler("swxz_drain", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const roll = Math.random() * 100;
  let pool;
  if (roll < 70) pool = enemies.filter((e) => e.row === 0 /* Front */);
  else if (roll < 85) pool = enemies.filter((e) => e.row === 1 /* Mid */);
  else pool = enemies.filter((e) => e.row === 2 /* Back */);
  if (pool.length === 0) pool = enemies;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const perTick = Math.floor(caster.currentAttack * 0.06 + target.maxHp * 0.01);
  target.statuses.push({
    type: "drain",
    remainingSeconds: 6,
    stacks: 1,
    value: perTick,
    sourceId: caster.id,
  });
  state.trackTalent(
    state,
    caster.id,
    "\u5438\u9B42\u5DEB\u672F(DoT)",
    perTick * 6,
    "damage"
  );
  log.push({
    time: state.time,
    text: `\u{1F480} ${caster.def.name} \u5438\u53D6 ${target.def.name}: \u6BCF\u79D2${perTick}\xD76s+\u5438\u884025%`,
    type: "damage",
  });
});
registerSkillHandler("syz_bless", (caster, state, log) => {
  const allies = state.units
    .filter((u) => u.team === caster.team && !u.isDead)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
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
    t.statuses = t.statuses.filter((s) => !neg.includes(s.type));
    t.statuses.push({
      type: "inspire" /* Inspire */,
      remainingSeconds: 5,
      // 审阅修复: 7→5
      stacks: 1,
      value: 0.8,
    });
    t._syzHealBoostUntil = state.time + 5;
    log.push({
      time: state.time,
      text: `\u{1F6E1} ${caster.def.name} \u5E87\u4F51 ${t.def.name}: \u51CF\u4F2420%+\u9A71\u6563`,
      type: "status",
    });
  }
  caster._syzDeathTrigger = true;
});
registerSkillHandler("ds_bite", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const back = enemies.filter((e) => e.row === 2 /* Back */);
  const mid = enemies.filter((e) => e.row === 1 /* Mid */);
  const target = back[0] || mid[0] || enemies[0];
  target.statuses.push({
    type: "stun" /* Stun */,
    remainingSeconds: 3,
    stacks: 1,
  });
  const perTick = Math.floor(caster.currentAttack * 0.95 + 10);
  target.statuses.push({
    type: "bite",
    remainingSeconds: 3,
    stacks: 1,
    value: perTick,
    sourceId: caster.id,
  });
  log.push({
    time: state.time,
    text: `\u{1F9B7} ${caster.def.name} \u6495\u54AC ${target.def.name}: \u6BCF\u79D2${perTick}\u7EAF\u4F24+\u7729\u66553s`,
    type: "status",
  });
});
registerSkillHandler("yammxz_swap", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const buddy = allies[Math.floor(Math.random() * allies.length)];
  const r0 = caster.row,
    c0 = caster.col;
  caster.row = buddy.row;
  caster.col = buddy.col;
  buddy.row = r0;
  buddy.col = c0;
  caster.evasion = (caster.evasion || 0) + 0.2;
  buddy.evasion = (buddy.evasion || 0) + 0.2;
  caster._swapEvaUntil = state.time + 4;
  buddy._swapEvaUntil = state.time + 4;
  const enemies = getAttackableEnemies(state, caster.team);
  const hit = shuffle(enemies).slice(0, 2);
  for (const t of hit) {
    t.statuses.push({
      type: "silence" /* Silence */,
      remainingSeconds: 4,
      stacks: 1,
    });
    const dmg = Math.floor(caster.currentAttack * 1.2);
    t.currentHp -= dmg;
    addStat(state, t.id, "totalDamageReceived", dmg);
    addStat(state, caster.id, "totalDamageDealt", dmg);
    addStat(state, caster.id, "pureDamage", dmg);
    log.push({
      time: state.time,
      text: `\u{1F311} ${caster.def.name} \u6697\u5F71\u6362\u4F4D: ${t.def.name} \u6C89\u9ED84s+${dmg}\u7EAF\u4F24`,
      type: "damage",
    });
  }
  state.trackTalent(
    state,
    caster.id,
    "\u6697\u5F71\u6362\u4F4D",
    hit.length * 4,
    "control"
  );
});
registerSkillHandler("hyz_shield", (caster, state, log) => {
  const stacks = caster._hyzStacks || 0;
  if (stacks <= 0) return;
  caster._hyzStacks = 0;
  const undeadAllies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.def.race === "undead"
  );
  const lowest =
    undeadAllies.sort(
      (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
    )[0] || caster;
  if (lowest.id !== caster.id) {
    const occupied = new Set(
      state.units
        .filter((u) => u.team === caster.team && !u.isDead)
        .map((u) => `${u.row},${u.col}`)
    );
    const neighbors = [
      { row: lowest.row - 1, col: lowest.col },
      { row: lowest.row + 1, col: lowest.col },
      { row: lowest.row, col: lowest.col - 1 },
      { row: lowest.row, col: lowest.col + 1 },
    ].filter(
      (p) =>
        p.row >= 0 &&
        p.row < 3 &&
        p.col >= 0 &&
        p.col < 3 &&
        !occupied.has(`${p.row},${p.col}`)
    );
    if (neighbors.length > 0) {
      const dest = neighbors[Math.floor(Math.random() * neighbors.length)];
      caster.row = dest.row;
      caster.col = dest.col;
      log.push({
        time: state.time,
        text: `\u{1F47B} ${caster.def.name} \u77AC\u79FB\u81F3 ${lowest.def.name} \u65C1`,
        type: "status",
      });
    }
  }
  const shieldVal = Math.floor(caster.currentAttack * 0.8 * stacks);
  caster._shield = (caster._shield || 0) + shieldVal;
  caster._shieldUntil = state.time + 7;
  lowest._shield = (lowest._shield || 0) + shieldVal;
  lowest._shieldUntil = state.time + 7;
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
    "poison",
    "doom",
  ];
  for (const t of [caster, lowest]) {
    t.statuses = t.statuses.filter((s) => !neg.includes(String(s.type)));
  }
  state.trackTalent(
    state,
    caster.id,
    "\u9B42\u80FD\u62A4\u76FE",
    shieldVal,
    "heal"
  );
  log.push({
    time: state.time,
    text: `\u{1F6E1} ${caster.def.name} \u9B42\u80FD\u62A4\u76FE: ${shieldVal}\xD72\u4EBA 7s (\u6D88\u8017${stacks}\u5C42)`,
    type: "heal",
  });
});
registerSkillHandler("hlyl_fire", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  let pool = enemies.filter((e) => e.row === 0 /* Front */);
  if (pool.length === 0) pool = enemies.filter((e) => e.row === 1 /* Mid */);
  if (pool.length === 0) pool = enemies.filter((e) => e.row === 2 /* Back */);
  pool.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const target = pool[0];
  target.statuses.push({
    type: "hlyl_burn",
    remainingSeconds: 7,
    stacks: 1,
    value: Math.floor(
      caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35)
    ),
    sourceId: caster.id,
  });
  state.trackTalent(
    state,
    caster.id,
    "\u706B\u7130\u55B7\u5410(DoT)",
    Math.floor(
      caster.currentAttack *
        (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35) *
        7
    ),
    "damage"
  );
  log.push({
    time: state.time,
    text: `\u{1F525} ${caster.def.name} \u55B7\u5410 ${target.def.name}: \u6BCF\u79D235%\u9B54\u6CD5\xD77s`,
    type: "status",
  });
});
registerSkillHandler("xyfl_chaos", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const targets = shuffle(enemies).slice(0, 4);
  const hitCount = targets.length;
  for (const t of targets) {
    const ratio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.4;
    const result = calcDamage(caster, t, ratio, "physical" /* Physical */, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `\u{1FA78} ${caster.def.name} \u4E71\u5E8F ${t.def.name}: ${result.finalDamage}`,
      type: "damage",
    });
  }
  const cells = targets.map((t) => ({ row: t.row, col: t.col }));
  const shuffledCells = shuffle(cells);
  targets.forEach((t, i) => {
    t.row = shuffledCells[i].row;
    t.col = shuffledCells[i].col;
  });
  state.trackTalent(
    state,
    caster.id,
    "\u4E71\u5E8F\u6253\u51FB",
    hitCount,
    "count"
  );
  log.push({
    time: state.time,
    text: `\u{1FA78} ${caster.def.name} \u4E71\u5E8F\u6253\u51FB: \u547D\u4E2D${hitCount}\u4EBA`,
    type: "status",
  });
});
registerSkillHandler("sjsn_freeze", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  target.statuses.push({
    type: "bind" /* Bind */,
    remainingSeconds: 3,
    stacks: 1,
  });
  target.statuses.push({
    type: "disarm" /* Disarm */,
    remainingSeconds: 3,
    stacks: 1,
  });
  target.statuses.push({
    type: "sjsn_dot",
    remainingSeconds: 3,
    stacks: 1,
    value: Math.floor(caster.currentAttack * 0.8),
    // v3.16: 80%,
    sourceId: caster.id,
  });
  state.trackTalent(
    state,
    caster.id,
    "\u51B0\u5C01(DoT)",
    Math.floor(caster.currentAttack * 0.9 * 3),
    "damage"
  );
  log.push({
    time: state.time,
    text: `\u{1F9CA} ${caster.def.name} \u51B0\u5C01 ${target.def.name}: \u675F\u7F1A+\u7F34\u68B0+\u6BCF\u79D290%\xD73s`,
    type: "status",
  });
});
registerSkillHandler("mds_skill", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const targets = [];
  for (const r of [0, 1, 2]) {
    const inRow = enemies.filter((e) => e.row === r);
    if (inRow.length > 0)
      targets.push(inRow[Math.floor(Math.random() * inRow.length)]);
  }
  for (const t of targets) {
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 1.35,
      "pure" /* Pure */,
      { isSkill: true }
    );
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastHitBy = caster.id;
    t.statuses.push({
      type: "petrify" /* Petrify */,
      remainingSeconds: 3,
      stacks: 1,
    });
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, caster.id, "magicalDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `\u{1F40D} ${caster.def.name} \u77F3\u5316\u51DD\u89C6 ${t.def.name}: ${result.finalDamage}+\u675F\u7F1A4s`,
      type: "damage",
    });
  }
});
registerSkillHandler("slzs_guard", (caster, state, log) => {
  const cost = Math.floor(caster.currentHp * 0.1);
  caster.currentHp -= cost;
  caster._slzsGuardUntil = state.time + 7;
  caster._slzsAtkMult = 0.7;
  caster._slzsDr = 0.25;
  state.trackTalent(
    state,
    caster.id,
    "\u5B88\u62A4(\u51CF\u4F2425%)",
    7,
    "control"
  );
  log.push({
    time: state.time,
    text: `\u{1F6E1} ${caster.def.name} \u5B88\u62A47s: \u653B-30%+\u51CF\u4F2425%+\u9B54\u4F24\u8F6C\u79FB`,
    type: "status",
  });
});
registerSkillHandler("fdzs_combo", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const t = enemies[Math.floor(Math.random() * enemies.length)];
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 0.65,
      "physical" /* Physical */,
      {
        // v3.4: 读data 65%
        isSkill: true,
        ignoreExtraDef: true,
        // v3.4 R4: 无视额外防御，保留基础防御
      }
    );
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    total += result.finalDamage;
  }
  addStat(state, caster.id, "totalDamageDealt", total);
  addStat(state, caster.id, "skillDamage", total);
  state.trackTalent(
    state,
    caster.id,
    "\u75BE\u98CE\u8FDE\u51FB(5\u8FDE)",
    total,
    "damage"
  );
  log.push({
    time: state.time,
    text: `\u{1F32A} ${caster.def.name} \u75BE\u98CE\u8FDE\u51FB: 5\u6B21\u653B\u51FB \u603B\u4F24${total}`,
    type: "damage",
  });
});
registerSkillHandler("pp_sleep", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (Math.random() < 0.5) {
    caster.statuses.push({
      type: "sleep" /* Sleep */,
      remainingSeconds: 4,
      stacks: 1,
    });
    const back = enemies.filter((e) => e.row === 2 /* Back */);
    const pool = back.length > 0 ? back : enemies;
    if (pool.length > 0) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      target.statuses.push({
        type: "sleep" /* Sleep */,
        remainingSeconds: 4,
        stacks: 1,
      });
      log.push({
        time: state.time,
        text: `\u{1F4A4} ${caster.def.name} \u50AC\u7720\u2460 ${target.def.name}: \u53CC\u65B9\u7761\u77204s`,
        type: "status",
      });
    } else {
      log.push({
        time: state.time,
        text: `\u{1F4A4} ${caster.def.name} \u50AC\u7720\u2460: \u65E0\u654C\u4EBA\uFF0C\u53EA\u7761\u81EA\u5DF14s`,
        type: "status",
      });
    }
  } else {
    caster.statuses.push({
      type: "sleep" /* Sleep */,
      remainingSeconds: 5,
      stacks: 1,
    });
    const picked = shuffle(enemies).slice(0, 2);
    for (const t of picked) {
      t._drowsyUntil = state.time + 6;
      t.hitRateMod = (t.hitRateMod || 0) - 0.75;
      t._drowsyApplied = 0.75;
    }
    log.push({
      time: state.time,
      text: `\u{1F4A4} ${caster.def.name} \u50AC\u7720\u2461 \u81EA\u8EAB\u77615s\uFF0C${picked.length}\u540D\u654C\u4EBA\u56F0\u610F6s(\u547D\u4E2D\u7387-75%)`,
      type: "status",
    });
  }
});
registerSkillHandler("yl_stealth", (caster, state, log) => {
  caster.statuses.push({
    type: "stealth" /* Stealth */,
    remainingSeconds: 8,
    stacks: 1,
  });
  caster._stealthAttack = true;
  if (state.trackTalent)
    state.trackTalent(
      state,
      caster.id,
      "\u6F5C\u884C(\u8FDB\u5165)",
      1,
      "count"
    );
  log.push({
    time: state.time,
    text: `\u{1F319} ${caster.def.name} \u8FDB\u5165\u6F5C\u884C: \u4E0B\u6B21\u653B\u51FB\xD72+\u5438\u884020%`,
    type: "status",
  });
});
registerSkillHandler("xjlr_trap", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  target.statuses.push({
    type: "bind" /* Bind */,
    remainingSeconds: 20,
    stacks: 1,
  });
  target.statuses.push({
    type: "trap_dot",
    remainingSeconds: 20,
    stacks: 1,
    value: Math.floor(target.maxHp * 0.02),
    // 每2s 最大HP×2% (80%攻击在下跳计算)
    sourceId: caster.id,
    casterAtk: caster.currentAttack,
  });
  log.push({
    time: state.time,
    text: `\u{1F573} ${caster.def.name} \u5728 ${target.def.name} \u4F4D\u7F6E\u653E\u7F6E\u8D85\u7EA7\u9677\u9631`,
    type: "status",
  });
});
registerSkillHandler("ldshz_buff", (caster, state, log) => {
  const allies = state.units.filter((u) => u.team === caster.team && !u.isDead);
  for (const a of allies) {
    a.currentPhysicalDef = Math.floor(a.currentPhysicalDef * 1.2);
    a.currentMagicalDef = Math.floor(a.currentMagicalDef * 1.2);
    a._ldshzDefUntil = state.time + 6;
    a._ldshzDefApplied = true;
  }
  const sameRow = allies.filter(
    (a) => a.row === caster.row && a.id !== caster.id
  );
  for (const a of sameRow) {
    a.critRate = (a.critRate || 0) + 0.2;
    a.lifeSteal = (a.lifeSteal || 0) + 0.35;
    a._ldshzBuffUntil = state.time + 6;
  }
  log.push({
    time: state.time,
    text: `\u{1F33F} ${caster.def.name} \u91CA\u653E\u81EA\u7136\u5B88\u62A4: \u5168\u961F+20%\u53CC\u96326s`,
    type: "status",
  });
});
registerSkillHandler("jdds_steal", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
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
    type: "status",
  });
});
registerSkillHandler("aysl_strike", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const back = enemies.filter((e) => e.row === 2 /* Back */);
  const pool = back.length > 0 ? back : enemies;
  pool.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const target = pool[0];
  const result = calcDamage(caster, target, 2.3, "physical" /* Physical */, {
    isSkill: true,
  });
  target.currentHp -= result.finalDamage;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "physicalDamage", result.finalDamage);
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "physical"
  );
  target._markDmg = (target._markDmg || 0) + 0.25;
  target._markExpire = state.time + 4;
  log.push({
    time: state.time,
    text: `\u{1F311} ${caster.def.name} \u7A81\u88AD ${target.def.name}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}+\u6697\u5F71\u6807\u8BB04s`,
    type: "damage",
  });
});
registerSkillHandler("xdds_fire", (caster, state, log, targets) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  caster._meteorCount = (caster._meteorCount || 0) + 1;
  const isMeteor = caster._meteorCount >= 3;
  if (isMeteor) caster._meteorCount = 0;
  if (!isMeteor) {
    const t = pickTarget(enemies, caster.def.skill.priority, false);
    if (!t) return;
    const fzRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.05;
    const result = calcDamage(caster, t, fzRatio, "magical" /* Magical */, {
      // P0修复: 读data(2.05)
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
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
      text: `${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u706B\u7403)`,
      type: "damage",
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  } else {
    const rowPref = [
      { row: 0 /* Front */, chance: 40 },
      { row: 1 /* Mid */, chance: 35 },
      { row: 2 /* Back */, chance: 25 },
    ];
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    let selectedRow = 0; /* Front */
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
      const result = calcDamage(caster, t, 3, "magical" /* Magical */, {
        // v3.16 用户: 陨石300%
        isSkill: true,
      });
      t.currentHp -= result.finalDamage;
      trackSkill(
        state,
        caster.id,
        caster.def.skill.id,
        caster.def.skill.name,
        result.finalDamage,
        "physical"
      );
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
        type: "burn" /* Burn */,
        remainingSeconds: 3,
        stacks: 1,
        value: Math.floor(caster.currentAttack * 0.05),
      });
      log.push({
        time: state.time,
        text: `\u{1F525} ${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u9668\u77F3)`,
        type: "damage",
      });
    }
  }
});
registerSkillHandler("bjl_wing", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  const mid = shuffle(enemies.filter((e) => e.row === 1 /* Mid */));
  const back = shuffle(enemies.filter((e) => e.row === 2 /* Back */));
  const picked = [mid[0], back[0]].filter(Boolean);
  if (picked.length < 2)
    picked.push(
      ...shuffle(enemies.filter((e) => !picked.includes(e))).slice(
        0,
        2 - picked.length
      )
    );
  const targets = picked.slice(0, 2);
  const dmgRatios = [
    caster.def.skill.damage?.[0]?.atkRatio ?? 2,
    caster.def.skill.damage?.[1]?.atkRatio ?? 2.4,
  ];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const result = calcDamage(
      caster,
      t,
      dmgRatios[i],
      "physical" /* Physical */,
      {
        isSkill: true,
      }
    );
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
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
      t._slowUntil = Math.max(t._slowUntil || 0, state.time + 4);
      t._slowPct = 0.3;
    }
    log.push({
      time: state.time,
      text: `${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u7FC5\u51FB#${i + 1})`,
      type: "damage",
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  }
});
registerSkillHandler("dl_stomp", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  const rowMultipliers = { 0: 1.3, 1: 1, 2: 0.7 };
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.5;
  for (const t of enemies) {
    const ratio = baseRatio * (rowMultipliers[t.row] ?? 1);
    const result = calcDamage(caster, t, ratio, "physical" /* Physical */, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    t.hitRateMod = (t.hitRateMod || 0) - 0.2;
    t._hitRedUntil = Math.max(t._hitRedUntil || 0, state.time + 5);
  }
  log.push({
    time: state.time,
    text: `\u{1F30D} ${caster.def.name} \u91CA\u653E\u9F99\u8E0F: \u5168\u5C4F\u7269\u7406\u4F24\u5BB3+\u964D\u547D\u4E2D20%`,
    type: "damage",
  });
});
registerSkillHandler("xblr_shot", (caster, state, log) => {
  const occupied = new Set(
    state.units
      .filter((u) => u.team === caster.team && !u.isDead)
      .map((u) => `${u.row},${u.col}`)
  );
  const empties = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      if (!occupied.has(`${r},${c}`)) empties.push({ row: r, col: c });
    }
  if (empties.length > 0) {
    const dest = empties[Math.floor(Math.random() * empties.length)];
    caster.row = dest.row;
    caster.col = dest.col;
  }
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const nTargets = Math.floor(Math.random() * 3) + 1;
  const targets = shuffle(enemies).slice(0, nTargets);
  const ratios = [0.8, 0.9, 1.2];
  for (const t of targets) {
    for (let i = 0; i < 3; i++) {
      const result = calcDamage(
        caster,
        t,
        ratios[i],
        "physical" /* Physical */,
        {
          isSkill: true,
        }
      );
      let dmg = result.finalDamage;
      if (i === 2) dmg = Math.floor(dmg * 1.35);
      t.currentHp -= dmg;
      trackSkill(
        state,
        caster.id,
        caster.def.skill.id,
        caster.def.skill.name,
        dmg,
        "physical"
      );
      addStat(state, caster.id, "totalDamageDealt", dmg);
      addStat(state, caster.id, "skillDamage", dmg);
      addStat(state, caster.id, "physicalDamage", dmg);
      addStat(state, t.id, "totalDamageReceived", dmg);
    }
  }
  log.push({
    time: state.time,
    text: `\u{1F3F9} ${caster.def.name} \u8DF3\u8DC3\u5C04\u51FB: ${targets.length}\u540D\u654C\u4EBA`,
    type: "damage",
  });
});
registerSkillHandler("bslr_shot", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const row = [0, 1, 2][Math.floor(Math.random() * 3)];
  const targets = enemies.filter((e) => e.row === row);
  if (targets.length === 0) return;
  for (const t of targets) {
    t.statuses.push({
      type: "bslr_dot",
      remainingSeconds: 3,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.9),
      // v3.16f 回滚: 文档90%/s
      sourceId: caster.id,
    });
    t._bslrDebuffUntil = Math.max(t._bslrDebuffUntil || 0, state.time + 4);
    if (Math.random() < 0.5) {
      t._bslrAtkDown = Math.min(0.3, (t._bslrAtkDown || 0) + 0.1);
    } else {
      t._bslrSlowDown = Math.min(0.6, (t._bslrSlowDown || 0) + 0.2);
    }
    log.push({
      time: state.time,
      text: `\u2744\uFE0F ${caster.def.name} \u6301\u7EED\u5C04\u51FB ${t.def.name}: \u6BCF\u79D2120%\xD73s+\u964D\u653B/\u964D\u901F4s`,
      type: "status",
    });
  }
  return;
  for (const t of targets) {
    const result = calcDamage(caster, t, 0.9, "physical" /* Physical */, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
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
    const asStack = t._bslrSlowStack || 0;
    if (asStack < 3) {
      t._bslrSlowStack = asStack + 1;
      t.attackTimer *= 1.06;
    }
    log.push({
      time: state.time,
      text: `\u{1F3F9} ${pfx(caster)} \u2192 ${pfx(t)}: ${result.finalDamage}\u{1F4A5}(\u653B\u901F-6%)`,
      type: "damage",
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
  const atkBuff = Math.floor(target.currentAttack * 0.25);
  target.currentAttack += atkBuff;
  target._atkBuffAmt = (target._atkBuffAmt || 0) + atkBuff;
  target._atkBuffUntil = state.time + 7;
  target._atkBuffPct = 0.25;
  if (state.trackTalent)
    state.trackTalent(
      state,
      caster.id,
      "\u9F13\u821E(+25%\u653B)",
      atkBuff * 7,
      "buff"
    );
  caster._zzxDrPhys = 0.1;
  caster._zzxDrMag = 0.2;
  caster._zzxDrUntil = state.time + 7;
  target._zzxDrPhys = 0.1;
  target._zzxDrMag = 0.2;
  target._zzxDrUntil = state.time + 7;
  log.push({
    time: state.time,
    text: `\u{1F4EF} ${caster.def.name} \u9F13\u821E ${target.def.name}: +25%\u653B+\u7269\u51CF10%\u9B54\u51CF20%\xD77s`,
    type: "status",
  });
});
registerSkillHandler("bsxl_freeze", (caster, state, log) => {
  const aliveEnemies = getAttackableEnemies(state, caster.team);
  const rows = [...new Set(aliveEnemies.map((u) => u.row))];
  if (rows.length === 0) return;
  const row = rows[Math.floor(Math.random() * rows.length)];
  const enemies = aliveEnemies.filter((u) => u.row === row);
  caster._bsxlFreezeCount = (caster._bsxlFreezeCount || 0) + 1;
  const isFreeze = caster._bsxlFreezeCount >= 2;
  if (isFreeze) caster._bsxlFreezeCount = 0;
  for (const t of enemies) {
    let dmgRatio = 0.8;
    let dmgType = "magical"; /* Magical */
    if (isFreeze) {
      dmgRatio = 0.8;
      dmgType = "pure"; /* Pure */
      t.statuses.push({
        type: "freeze" /* Freeze */,
        remainingSeconds: 3,
        stacks: 1,
      });
    } else {
      t.statuses.push({
        type: "bsxl_dot",
        remainingSeconds: 4,
        stacks: 1,
        value: Math.floor(
          caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.6)
        ),
        sourceId: caster.id,
      });
      t._slowUntil = Math.max(t._slowUntil || 0, state.time + 4);
      t._slowPct = 0.4;
      dmgRatio = 0;
    }
    const result = calcDamage(caster, t, dmgRatio, dmgType, { isSkill: true });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
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
    type: "damage",
  });
});
registerSkillHandler("fxz_analyze", (caster, state, log) => {
  const allies = state.units.filter((u) => u.team === caster.team && !u.isDead);
  const shuffled = allies.sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, 3).filter((u) => u.id !== caster.id);
  if (targets.length === 0) return;
  for (const t of targets) {
    if (t.currentPhysicalDef < t.currentMagicalDef) {
      t.currentPhysicalDef = Math.floor(t.currentPhysicalDef * 1.06);
    } else {
      t.currentMagicalDef = Math.floor(t.currentMagicalDef * 1.05);
    }
  }
  log.push({
    time: state.time,
    text: `\u{1F4CA} ${caster.def.name} \u5206\u6790: \u63D0\u5347${targets.length}\u540D\u53CB\u65B9\u9632\u5FA1`,
    type: "status",
  });
});
registerSkillHandler("bmxz_charge", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const chargeTime = caster._chargeTime || 2;
  caster._chargeTime = void 0;
  let targetRows;
  if (chargeTime <= 1) targetRows = [0];
  else if (chargeTime <= 2) targetRows = [0, 1];
  else targetRows = [0, 1, 2];
  const targets = enemies.filter((e) => targetRows.includes(e.row));
  if (targets.length === 0) return;
  const baseDmg = caster.currentAttack * 1.9;
  const dmgPerTarget =
    targets.length >= 5 ? Math.floor(baseDmg * 0.7) : Math.floor(baseDmg);
  for (const t of targets) {
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 2,
      "magical" /* Magical */,
      {
        isSkill: true,
      }
    );
    let finalDmg = result.finalDamage;
    if (targets.length >= 5) finalDmg = Math.floor(finalDmg * 0.7);
    t.currentHp -= finalDmg;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      finalDmg,
      "magical"
    );
    t.lastDamage = { value: finalDmg, time: state.time, type: "magical" };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", finalDmg);
    addStat(state, caster.id, "skillDamage", finalDmg);
    addStat(state, caster.id, "magicalDamage", finalDmg);
    addStat(state, t.id, "totalDamageReceived", finalDmg);
  }
  const label =
    chargeTime <= 1
      ? "\u524D\u6392"
      : chargeTime <= 2
        ? "\u524D\u4E2D\u6392"
        : "\u5168\u573A";
  log.push({
    time: state.time,
    text: `\u26A1 ${caster.def.name} \u84C4\u529B${chargeTime}s \u2192 ${label}: ${Math.floor(baseDmg)}\u9B54\u6CD5\u4F24\u5BB3`,
    type: "damage",
  });
});
registerSkillHandler("fz_curse", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const stacks = target._fzMarks || 0;
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.8;
  const ratio = baseRatio * (1 + stacks * 0.08);
  const result = calcDamage(caster, target, ratio, "magical" /* Magical */, {
    isSkill: true,
  });
  target.currentHp -= result.finalDamage;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "magicalDamage", result.finalDamage);
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "physical"
  );
  target.lastDamage = {
    value: result.finalDamage,
    time: state.time,
    type: "magical",
  };
  target.lastHitBy = caster.id;
  log.push({
    time: state.time,
    text: `\u{1F9FF} ${caster.def.name} \u7B26\u5492 ${pfx(target)}: ${result.finalDamage}${stacks > 0 ? ` (\u5370\u8BB0${stacks}\u5C42)` : ""}`,
    type: "damage",
  });
});
registerSkillHandler("qm_exorcise", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const pick = shuffle(enemies).slice(0, 4);
  let total = 0;
  for (const t of pick) {
    const hasBuff = (t.statuses || []).some(
      (s) =>
        ["atkBuff", "inspire", "_hqsStacks"].includes(s.type) ||
        s.type === "bloodrage" /* Bloodrage */
    );
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2;
    const r = calcDamage(
      caster,
      t,
      baseRatio,
      hasBuff ? "pure" /* Pure */ : "magical" /* Magical */,
      { isSkill: true }
    );
    t.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "pureDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "pure"
    );
    total += r.finalDamage;
  }
  log.push({
    time: state.time,
    text: `\u26E9 ${caster.def.name} \u9A71\u9B54: 2\xD72\u8303\u56F4 ${total}${pick.some((t) => (t.statuses || []).length > 0) ? " (\u542B\u7EAF\u7CB9)" : ""}`,
    type: "damage",
  });
});
registerSkillHandler("sq_heal", (caster, state, log) => {
  const allies = state.units.filter(
    (u) => u.team === caster.team && !u.isDead && u.def.race === "holy"
  );
  const sorted = allies.sort(
    (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
  );
  const targets = sorted.slice(0, 2);
  for (const t of targets) {
    let mult = 1;
    const hasNeg = (t.statuses || []).length > 0;
    if (hasNeg) {
      t.statuses = t.statuses.filter(
        (s) =>
          ![
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
            "poison",
            "slow",
          ].includes(String(s.type).toLowerCase())
      );
      mult = 1.3;
    }
    const heal = Math.floor(
      caster.currentAttack * (caster.def.skill.heal?.atkRatio ?? 2.1) * mult
    );
    caster.lastHealTarget = t.id;
    t.lastHeal = { value: heal, time: state.time };
    addStat(state, caster.id, "totalHealingDone", heal);
    addStat(state, caster.id, "totalHealing", heal);
    addStat(state, t.id, "totalHealingReceived", heal);
    t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
    t._sqShieldUntil = state.time + 7;
    log.push({
      time: state.time,
      text: `\u{1F6E1} ${caster.def.name} \u5723\u5149\u6CBB\u6108 ${pfx(t)}: +${heal}${hasNeg ? " (\u9A71\u6563+30%)" : ""} +\u5723\u4E4B\u62A4\u76FE7s`,
      type: "heal",
    });
  }
});
registerSkillHandler("qd_pray", (caster, state, log) => {
  caster._qdMissStreak = (caster._qdMissStreak || 0) + 1;
  let roll = Math.random();
  let outcome;
  if (caster._qdMissStreak >= 3) {
    outcome = roll < 0.4 ? "\u5927\u6210\u529F" : "\u6210\u529F";
  } else {
    outcome =
      roll < 0.1
        ? "\u5927\u6210\u529F"
        : roll < 0.4
          ? "\u6210\u529F"
          : roll < 0.9
            ? "\u4E00\u822C"
            : "\u5931\u8D25";
  }
  if (outcome === "\u5927\u6210\u529F" || outcome === "\u6210\u529F")
    caster._qdMissStreak = 0;
  const lowest = state.units
    .filter((u) => u.team === caster.team && !u.isDead)
    .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  if (outcome === "\u5927\u6210\u529F") {
    if (lowest) {
      lowest._qdInvulnUntil = state.time + 5;
      lowest._qdRegenUntil = state.time + 5;
      lowest._qdRegenPct = 0.02;
    }
    caster._qdInvulnUntil = state.time + 5;
    caster._qdRegenUntil = state.time + 5;
    caster._qdRegenPct = 0.02;
    log.push({
      time: state.time,
      text: `\u{1F64F} \u7948\u7977\u5927\u6210\u529F: \u65E0\u654C+\u56DE2%/s\xD75s`,
      type: "heal",
    });
  } else if (outcome === "\u6210\u529F") {
    if (lowest) {
      lowest._qdDrUntil = state.time + 5;
      lowest._qdDrPct = 0.4;
      lowest._qdRegenUntil = state.time + 5;
      lowest._qdRegenPct = 0.01;
    }
    log.push({
      time: state.time,
      text: `\u{1F64F} \u7948\u7977\u6210\u529F: \u51CF\u4F2440%+\u56DE1%/s\xD75s`,
      type: "heal",
    });
  } else if (outcome === "\u4E00\u822C") {
    if (lowest) {
      lowest._qdDrUntil = state.time + 5;
      lowest._qdDrPct = 0.2;
    }
    log.push({
      time: state.time,
      text: `\u{1F64F} \u7948\u7977\u4E00\u822C: \u51CF\u4F2420%\xD75s`,
      type: "status",
    });
  } else {
    const dmg = Math.floor(caster.maxHp * 0.1);
    caster.currentHp -= dmg;
    log.push({
      time: state.time,
      text: `\u{1F64F} \u7948\u7977\u5931\u8D25: \u81EA\u635F${dmg}`,
      type: "damage",
    });
  }
});
registerSkillHandler("sqz_combo", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const back = enemies.filter((e) => e.row === 2 /* Back */);
  const pool = back.length > 0 ? back : enemies;
  const target = pool[Math.floor(Math.random() * pool.length)];
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 0.8;
    const r = calcDamage(caster, target, baseRatio, "physical" /* Physical */, {
      isSkill: true,
    });
    target.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "physicalDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "physical"
    );
    total += r.finalDamage;
  }
  target.lastHitBy = caster.id;
  log.push({
    time: state.time,
    text: `\u{1F44A} ${caster.def.name} \u5723\u62F3\u8FDE\u51FB ${pfx(target)}: ${total}`,
    type: "damage",
  });
});
registerSkillHandler("zq_flame", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const row = [0, 1, 2][Math.floor(Math.random() * 3)];
  const targets = enemies.filter((e) => e.row === row);
  let total = 0;
  for (const t of targets) {
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.5;
    const r = calcDamage(caster, t, baseRatio, "magical" /* Magical */, {
      isSkill: true,
    });
    t.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "magicalDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "magical"
    );
    total += r.finalDamage;
    t.statuses.push({
      type: "burn" /* Burn */,
      remainingSeconds: 4,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.05),
    });
  }
  log.push({
    time: state.time,
    text: `\u{1F525} ${caster.def.name} \u6731\u96C0\u711A\u5929 ${targets.length}\u4EBA: ${total}+\u707C\u70E74s`,
    type: "damage",
  });
});
registerSkillHandler("sc_judge", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const top = enemies.sort(
    (a, b) => (b._dmgRecent9s || 0) - (a._dmgRecent9s || 0)
  )[0];
  const NEGATIVE = [
    "stun",
    "sleep",
    "petrify",
    "freeze",
    "bind",
    "burn",
    "curse",
    "poison",
    "doom",
    "ruin",
    "silence",
    "disarm",
    "slow",
    "armorBreak",
    "sc_judge_dot",
  ];
  const hasBuff = (top.statuses || []).some(
    (s) => !NEGATIVE.includes(String(s.type).toLowerCase())
  );
  const atk = hasBuff ? top.currentAttack : caster.currentAttack;
  top.statuses.push({
    type: "silence" /* Silence */,
    remainingSeconds: 5,
    stacks: 1,
  });
  top.statuses.push({
    type: "sc_judge_dot",
    remainingSeconds: 4,
    stacks: 1,
    value: Math.floor(atk * 0.35),
    sourceId: caster.id,
    clearBuffsOnEnd: hasBuff,
  });
  log.push({
    time: state.time,
    text: `\u2696 ${caster.def.name} \u5BA1\u5224\u4E4B\u5149 ${pfx(top)}: \u6C89\u9ED8+35%\u7EAF\u7CB9\xD74s${hasBuff ? " (\u7ED3\u675F\u6E05\u589E\u76CA)" : ""}`,
    type: "control",
  });
});
registerSkillHandler("xd_sacrifice", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const t = enemies[Math.floor(Math.random() * enemies.length)];
  t._xdDmgDownUntil = state.time + 4;
  t._xdDmgDown = 0.2;
  const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
  t.statuses.push({
    type: "xd_dot",
    remainingSeconds: 4,
    stacks: 1,
    value: Math.max(1, Math.floor(defSum * 0.2)),
    sourceId: caster.id,
  });
  log.push({
    time: state.time,
    text: `\u271D ${caster.def.name} \u727A\u7272: ${t.def.name} \u9020\u6210\u4F24\u5BB3-20% + \u6BCF\u79D2${Math.floor(defSum * 0.2)}\u7EAF\u7CB9\xD74s`,
    type: "control",
  });
});
function pickTarget(enemies, rowPref, excludeStealth = true) {
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
      type: "heal",
    });
  }
  if ((caster.lifeSteal ?? 0) > 0) {
    const lsHeal = Math.floor(damage * (caster.lifeSteal ?? 0));
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `\u{1F517} ${pfx(caster)} \u94FE\u63A5\u5438\u8840 +${lsHeal}`,
      type: "heal",
    });
  }
}
function pfx(u) {
  const r = u.def.race;
  const tag =
    {
      beast: "\u517D",
      hunter: "\u730E",
      warrior: "\u6218",
      mage: "\u6CD5",
      undead: "\u4EA1",
      dragon: "\u9F99",
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
    hp: 15460,
    attack: 639,
    physicalDef: 384.8,
    magicalDef: 362,
    attackInterval: 4.2,
  },
  growth: { hp: 140, attack: 6, physicalDef: 3.2, magicalDef: 3 },
  talent:
    "\u7761\u7720\u65F6\u9A71\u6563\u5F02\u5E38+\u6BCF\u79D2\u56DE1%+Lv\xD70.01%HP\uFF08v3.3 \u56DE\u590D\u51CF\u534A\uFF09",
  skill: {
    id: "pp_sleep",
    name: "\u50AC\u7720",
    tags: ["\u63A7\u5236", "\u5207\u5165"],
    // v3.0
    cooldown: 12,
    castTime: 0,
    description:
      "\u50AC\u7720: \u968F\u673A\u53D1\u52A81\u4E2A\u6548\u679C\uFF1A\u2460\u81EA\u8EAB\u4E0E\u968F\u673A1\u540D\u654C\u4EBA(\u4F18\u5148\u540E\u6392)\u540C\u77614s \u2461\u81EA\u8EAB\u77615s+\u968F\u673A2\u540D\u654C\u4EBA\u56F0\u610F6s\u547D\u4E2D\u7387-75%",
    scriptId: "pp_sleep",
  },
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
    attackInterval: 4,
  },
  growth: { hp: 90, attack: 9, physicalDef: 4.8, magicalDef: 2.8 },
  talent:
    "\u5F00\u573A\u6012\u543C: \u654C\u65B9\u5168\u4F53\u653B\u51FB-30%\u6301\u7EED5s\uFF0C\u4E4B\u540E-15%\u6301\u7EED8s",
  skill: {
    id: "hl_rage",
    name: "\u6FC0\u6012",
    tags: ["\u589E\u76CA"],
    cooldown: 999,
    castTime: 0,
    description:
      "\u6FC0\u6012: \u81EA\u8EABHP\u9996\u6B21\u964D\u81F360%\u8FDB\u5165\u6FC0\u6012\uFF0C\u6BCF3s\u5931\u53BB2%\u6700\u5927HP\uFF0C\u83B7\u5F9720%\u51CF\u4F24+30%\u653B+50%\u653B\u901F\uFF0C\u514D\u75AB\u5F02\u5E38\u81F3\u6218\u6597\u7ED3\u675F(\u6BCF\u573A\u4E00\u6B21)",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 72, attack: 8, physicalDef: 3.5, magicalDef: 2.5 },
  talent:
    "\u5F00\u573A\u72FC\u543C: \u5168\u517D\u65CF\u653B+30%(\u6BCF10s\u8870\u51CF20%,\u6700\u4F4E-60%)",
  skill: {
    id: "yl_stealth",
    name: "\u6F5C\u884C",
    tags: ["\u5207\u5165"],
    cooldown: 7,
    castTime: 0,
    description:
      "\u6F5C\u884C: \u65E0\u6CD5\u88AB\u666E\u653B\u9009\u4E2D(\u6280\u80FD\u53EF\u9009)\u3001\u671F\u95F4\u4E0D\u56DE\u8840\uFF1B\u653B\u51FB240%+50%\u5438\u8840\uFF0C\u4F18\u5148\u540E\u6392(\u524D10/\u4E2D40/\u540E50)\uFF0C\u653B\u51FB\u540E\u89E3\u9664",
    // v2.36: 2.1→1.9
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.4 }],
    priority: [
      { row: 2 /* Back */, chance: 50 },
      { row: 1 /* Mid */, chance: 40 },
      { row: 0 /* Front */, chance: 10 },
    ],
    scriptId: "yl_stealth",
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 55, attack: 9.2, physicalDef: 2.8, magicalDef: 1.8 },
  talent:
    "\u517D\u65CF\u9635\u4EA1\u65F6: \u81EA\u8EAB\u653B\u9632\u5404+8%(\u53EF\u53E0\u52A0,\u81F3\u6218\u6597\u7ED3\u675F)",
  skill: {
    id: "hx_cut",
    name: "\u864E\u88AD",
    tags: ["\u5207\u5165"],
    cooldown: 5,
    castTime: 0,
    description:
      "\u5BF9\u968F\u673A2\u540D\u5404\u9020\u6210210-240%\u4F24\u5BB3\uFF0C\u4F18\u5148\u540E\u6392",
    // v3.4 R3 用户直发
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.25 }],
    // R3: 区间中值兜底，handler 覆盖
    aoe: { maxTargets: 2 },
    priority: [
      { row: 2 /* Back */, chance: 60 },
      { row: 1 /* Mid */, chance: 10 },
      { row: 0 /* Front */, chance: 30 },
    ],
  },
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
    attackInterval: 4,
  },
  growth: { hp: 50, attack: 5, physicalDef: 2.5, magicalDef: 4.5 },
  talent:
    "\u6218\u6597\u5F00\u59CB\uFF0C\u4F7F\u654C\u65B9\u540C\u9635\u578B\u4F4D\u7F6E\u6240\u6709\u654C\u4EBA\u524D7s\u5929\u8D4B\u4E0E\u6280\u80FD\u7981\u7528\u5E76\u5931\u6548\uFF08\u4E0D\u89C6\u4E3A\u5F02\u5E38\uFF0C\u65E0\u6CD5\u9A71\u6563\uFF09",
  skill: {
    id: "zzx_buff",
    name: "\u9F13\u821E",
    tags: ["\u589E\u76CA"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u4F7F\u81EA\u8EAB\u4EE5\u59161\u540D\u968F\u673A\u53CB\u65B9(\u4F18\u5148\u517D\u65CF)+25%\u653B7s\uFF1B\u81EA\u8EAB\u4E0E\u76EE\u6807\u83B7\u5F9710%\u7269\u7406\u51CF\u4F24+20%\u9B54\u6CD5\u51CF\u4F247s",
    scriptId: "zzx_buff",
  },
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
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 6, physicalDef: 2.5, magicalDef: 2.4 },
  talent:
    "\u6240\u6709\u53CB\u65B9\u89D2\u8272\u6280\u80FD\u51B7\u5374\u51CF\u5C1112%\uFF08\u542B\u81EA\u8EAB\uFF09",
  skill: {
    id: "dxm_heal",
    name: "\u6CBB\u6108",
    tags: ["\u6CBB\u7597"],
    cooldown: 6,
    castTime: 0,
    description:
      "\u6CBB\u7597\u6211\u65B9\u6700\u4F4E\u8840\u91CF1\u540D(\u4F18\u5148\u517D\u65CF)\uFF1A7\xD7\u7B49\u7EA7+\u653B\u51FB\xD7190%\uFF1B\u6BCF\u53D1\u52A82\u6B21\uFF0C\u4E0B\u6B21\u6CBB\u7597+50%\u5E76\u9A71\u6563",
    heal: { fixedAdd: 600, atkRatio: 2.25 },
  },
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
    attackInterval: 3.3,
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 3.8, magicalDef: 2.2 },
  talent:
    "\u5F00\u573A\u5486\u54EE: \u5632\u8BBD\u654C\u65B9\u968F\u673A3\u540D\u5F3A\u5236\u653B\u51FB\u81EA\u8EAB4s\uFF0C\u671F\u95F4\u654C\u65B9\u65E0\u6CD5\u4F7F\u7528\u6280\u80FD(\u6BCF\u573A\u4E00\u6B21)",
  skill: {
    id: "lbmx_smash",
    name: "\u62CD\u51FB",
    tags: ["\u8303\u56F4"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u62CD\u51FB\u5730\u9762: \u968F\u673A1\u6392\u5168\u4F53\u653B\u51FB\xD7200%\u7269\u7406+\u964D20%\u7269\u96326s\uFF08\u4F18\u5148\u524D\u4E2D\u6392\uFF0C\u540E\u6392-35%\uFF0C\u547D\u4E2D3\u4EBA-35%\uFF09",
    // v3.16f 回滚: 文档220%, // v3.3: 215→225%
    damage: [{ type: "physical" /* Physical */, atkRatio: 2 }],
    aoe: { rows: [0 /* Front */, 1 /* Mid */], maxTargets: 6 },
  },
};
var mmx = {
  id: "mmx",
  name: "\u731B\u72B8\u8C61",
  race: "beast" /* Beast */,
  stats: {
    hp: 11300,
    attack: 753,
    physicalDef: 560.1,
    magicalDef: 406.6,
    attackInterval: 4,
  },
  growth: { hp: 100, attack: 7, physicalDef: 4.9, magicalDef: 3.4 },
  talent:
    "\u6BCF\u95F4\u969412s\u8FDB\u5165\u5377\u66F26s: \u653B-20% \u9632+40%\uFF0C\u989D\u5916\u683C\u6321\u81EA\u8EAB\u9632\u5FA1\u603B\u548C\xD720%\u7684\u6280\u80FD\u4F24\u5BB3",
  skill: {
    id: "mmx_stomp",
    name: "\u8E29\u8E0F",
    tags: ["\u5207\u5165"],
    // v3.0
    cooldown: 10,
    castTime: 1,
    description:
      "\u8E29\u8E0F1\u540D\u654C\u4EBA: 75%\u653B\u51FB\u7269\u7406+\u81EA\u8EAB\u9632\u5FA1\xD72\u7EAF\u7CB9\uFF08\u524D\u6392+25%\uFF0C\u540E\u6392\u7F34\u68B03s\uFF09",
    // v3.2: 110→125%
    damage: [
      { type: "physical" /* Physical */, atkRatio: 0.75 },
      { type: "pure" /* Pure */, selfDefMultiplier: 2.5 },
    ],
  },
};
var sszs = {
  id: "sszs",
  name: "\u68EE\u4E4B\u5C04\u624B",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 7185,
    attack: 738.8,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 223,
    magicalDef: 198.2,
    attackInterval: 3.5,
  },
  growth: { hp: 65, attack: 8.2, physicalDef: 2, magicalDef: 1.8 },
  talent:
    "\u83B7\u5F9730%+\u7B49\u7EA7\xD70.1%\u95EA\u907F(100\u7EA740%)\uFF1B\u6BCF\u7D2F\u8BA1\u53D72\u6B21#\u5207\u5165\u6280\u80FD\uFF0C\u4E0B\u6B21#\u5207\u5165\u6280\u80FD100%\u95EA\u907F",
  // v3.0 重做
  skill: {
    id: "sszs_bind",
    name: "\u675F\u7F1A\u5C04\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 5,
    castTime: 0,
    description:
      "\u5BF91\u540D\u654C\u65B9\u5C04\u51FB: \u653B\u51FB\xD7270%\u7269\u7406+\u675F\u7F1A4s",
    // v3.16 用户: 360→280+束缚4s
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.7 }],
    effects: [{ type: "bind" /* Bind */, duration: 4 }],
  },
};
var bslr = {
  id: "bslr",
  name: "\u51B0\u971C\u730E\u4EBA",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 6640,
    attack: 651,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 218,
    magicalDef: 214,
    attackInterval: 3.2,
  },
  growth: { hp: 60, attack: 9, physicalDef: 2, magicalDef: 2 },
  talent:
    "\u9020\u6210\u4F24\u5BB337.5%\u51E0\u7387\u65E0\u89C6\u989D\u5916\u9632\u5FA1\u5E76\u964D\u4F4E\u76EE\u680725%\u53D7\u75972s\uFF1B\u81EA\u8EAB\u53D7\u653B\u51FB\u65F6\u5929\u8D4B\u6682\u5931\u65481s\uFF08\u6280\u80FD\u89C6\u4E3A\u653B\u51FB\uFF0C\u51E0\u738740%\uFF09",
  // v3.4
  skill: {
    id: "bslr_shot",
    name: "\u6301\u7EED\u5C04\u51FB",
    tags: [],
    cooldown: 7,
    castTime: 0,
    description:
      "\u5BF9\u654C\u65B91\u6392\u6301\u7EED\u5C04\u51FB1.5s\uFF0C\u6BCF0.5\u79D2\u653B\u51FB\xD790%\u7269\u7406\uFF1B\u6BCF\u6B21\u964D10%\u653B\u621620%\u653B\u901F4s(\u6700\u591A3\u5C42)",
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.9 }],
    aoe: { maxTargets: 3 },
    scriptId: "bslr_shot",
  },
};
var hqs = {
  id: "hqs",
  name: "\u706B\u67AA\u624B",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8175,
    attack: 694.2,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 216,
    magicalDef: 213,
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.6, physicalDef: 2, magicalDef: 2 },
  talent:
    "\u81EA\u8EAB\u65E0\u6CD5\u88AB#\u5207\u5165\u6280\u80FD\u9009\u4E3A\u5BF9\u8C61\uFF0C\u53D7\u5230#\u5207\u5165\u6280\u80FD\u4F24\u5BB3\u4E3A0\uFF0C\u81EA\u8EAB\u5BF9\u540E\u6392\u654C\u4EBA\u4F24\u5BB3+10%",
  // v3.0,
  skill: {
    id: "hqs_snipe",
    name: "\u72D9\u51FB",
    tags: [],
    cooldown: 10,
    castTime: 2.5,
    description:
      "\u7269\u9632\u6700\u9AD8\u654C\u4EBA\uFF1A\u7269\u9632\xD74\u7EAF\u7CB9+\u653B\u51FB\xD7300%\u7269\u7406",
    // v3.16 用户: 320→300
    damage: [
      { type: "pure" /* Pure */, defMultiplier: 4 },
      { type: "physical" /* Physical */, atkRatio: 3 },
      // v3.16
    ],
  },
};
var mds = {
  id: "mds",
  name: "\u7F8E\u675C\u838E",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8960,
    attack: 670.5,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 250.7,
    magicalDef: 269.5,
    attackInterval: 2.8,
  },
  growth: { hp: 80, attack: 8, physicalDef: 2.3, magicalDef: 2.5 },
  talent:
    "\u81EA\u8EAB\u653B-12%\uFF0C\u540C\u65F6\u653B\u51FB2\u540D\u654C\u4EBA\uFF1B\u6BCF\u653B\u51FB2\u6B21\uFF0C\u4E0B\u6B2160%\u675F\u7F1A4s / 40%\u77F3\u53162s",
  skill: {
    id: "mds_skill",
    name: "\u77F3\u5316\u51DD\u89C6",
    tags: ["\u63A7\u5236"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u524D\u4E2D\u540E\u6392\u54041\u540D\u654C\u4EBA: \u653B\u51FB\xD7135%\u7EAF\u7CB9+\u77F3\u53163s\uFF0C\u81EA\u8EAB\u6062\u590D30%\u4F24\u5BB3\u8840\u91CF",
    // v3.16 用户: 280魔法+束缚→135纯粹+石化
    damage: [{ type: "pure" /* Pure */, atkRatio: 1.35 }],
    effects: [{ type: "petrify" /* Petrify */, duration: 3 }],
    scriptId: "mds_skill",
  },
};
var zfyx = {
  id: "zfyx",
  name: "\u8FFD\u98CE\u6E38\u4FA0",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8075,
    attack: 697.6,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 269.5,
    magicalDef: 217,
    attackInterval: 2.5,
  },
  growth: { hp: 75, attack: 9.5, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "\u654C\u65B9\u6BCF\u6B21\u53D1\u52A8#\u5207\u5165\u6280\u80FD\uFF0C\u654C\u4EBA\u5148\u53D735%\u4F24\u5BB3\uFF0C\u6211\u65B9\u5168\u4F53+10%\u653B9s(\u6700\u591A4\u5C42)",
  // v3.0 重做,
  skill: {
    id: "zfyx_arrow",
    name: "\u4E09\u8FDE\u5C04",
    tags: ["\u79FB\u52A8"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u53D1\u5C043\u679A\u5F13\u7BAD\uFF0C\u6BCF\u6B21\u653B\u51FB\xD7125%\u968F\u673A\u654C\u4EBA\uFF1B\u6BCF\u6B21\u53D1\u5C04\u540E\u79FB\u52A8\u81F3\u7A7A\u4F4D+\u95EA\u907F40% 5s",
    // v3.16f 回滚: 文档110%
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.25 }],
    aoe: { maxTargets: 3 },
  },
};
var lxgz = {
  id: "lxgz",
  name: "\u7075\u5F26\u6B4C\u8005",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8620,
    attack: 591.7,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 258.6,
    magicalDef: 237.8,
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 8, physicalDef: 2.4, magicalDef: 2.2 },
  talent:
    "\u81EA\u8EAB\u6CBB\u7597\u6216\u653B\u51FB\uFF0C\u4F7F\u6211\u65B9\u968F\u673A1\u540D\u83B7\u5F97[\u6FC0\u6602]: +10%+\u7B49\u7EA7\xD70.1%\u653B\u4E0E15%\u653B\u901F\uFF0C\u6301\u7EED5s",
  skill: {
    id: "lxgz_heal",
    name: "\u6CBB\u6108\u7434\u97F3",
    tags: ["\u6CBB\u7597"],
    cooldown: 8,
    castTime: 2,
    description:
      "\u5F39\u594F2s\u2192\u6700\u4F4E2\u540D\u53CB\u65B9\u6301\u7EED\u6062\u590D+15%\u51CF\u4F246s\uFF0C\u6BCF\u79D2\u81EA\u8EAB\u653B\xD725%+\u76EE\u6807\u653B\xD720%\uFF1B\u6BCF\u6B21\u53D1\u52A8\u540E\uFF0C\u4E0B\u6B21\u53D1\u52A8\u6BCF\u79D2\u6CBB\u7597+50%\u3001\u51CF\u4F24\u6548\u679C+50%",
    // v3.4 R13 用户直发
    heal: { atkRatio: 0.25, targetAtkRatio: 0.2 },
    // v3.4 R19: 补齐描述口径 目标攻×20%
    aoe: { maxTargets: 2 },
  },
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
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "\u6BCF\u79D2\u5931\u53BB1%\u6700\u5927HP\uFF0C\u53D7\u4F24+10%\uFF0C\u53D7\u7597+20%\uFF1B\u5BF9\u654C\u65B9\u540C\u9635\u578B\u5168\u4F53\u6BCF\u79D2\u9020\u6210\u653B\u51FB\xD71.5%+\u7B49\u7EA7\xD70.02%\u7EAF\u7CB9(100\u7EA73.5%)",
  skill: {
    id: "crzs_punch",
    name: "\u707C\u70ED\u62F3\u51FB",
    tags: [],
    cooldown: 4,
    castTime: 0,
    description:
      "\u653B\u51FB\xD7220%\u7269\u7406+\u707C\u70E73s\uFF0C\u81EA\u53D710%\u53CD\u4F24\uFF08\u654C\u65B9\u524D\xB7\u4E2D\u6392\u6709\u89D2\u8272\u65F6\u4E0D\u4F1A\u5BF9\u540E\u6392\u53D1\u52A8\uFF09",
    // v3.16 用户: 200→220
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.2 }],
    effects: [{ type: "burn" /* Burn */, duration: 3, value: 0.05 }],
  },
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
    attackInterval: 2.5,
  },
  growth: { hp: 70, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent:
    "\u653B\u51FB+10%\uFF0C\u9B54\u6CD5\u9632\u5FA1+20%\uFF0C\u547D\u4E2D\u7387-15%\uFF1B\u653B\u51FB\u672A\u547D\u4E2D\u53D7\u523050%\u53CD\u4F24",
  skill: {
    id: "hd_slash",
    name: "\u65A9\u51FB",
    tags: ["\u8303\u56F4"],
    // P2修复
    cooldown: 7,
    castTime: 1.5,
    description:
      "\u968F\u673A1\u6392\u5168\u4F53: \u653B\u51FB\xD7250%\u7269\u7406\uFF08\u547D\u4E2D3\u4EBA-35%\uFF09",
    // v3.16 用户: 270→250+命中惩罚
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.5 }],
    aoe: { maxTargets: 3 },
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 85, attack: 6.5, physicalDef: 2.5, magicalDef: 2.5 },
  talent:
    "\u6807\u8BB0\u654C\u4EBA\u4E0E\u81EA\u8EAB\u5BF9\u79F0\u76841\u540D\u89D2\u8272\uFF0C\u5176\u95EA\u907F/\u989D\u5916\u9632\u5FA1\u5F520\u76F4\u5230\u5206\u6790\u8005\u9635\u4EA1\uFF1B\u4E4B\u540E\u6BCF35s\u53EF\u5206\u6790\u53E6\u4E00\u540D",
  // v3.0,
  skill: {
    id: "fxz_analyze",
    name: "\u5206\u6790",
    tags: ["\u589E\u76CA"],
    cooldown: 6,
    castTime: 0,
    description:
      "\u63D0\u5347\u81EA\u8EAB\u53CA2\u540D\u968F\u673A\u53CB\u65B9\u6700\u4F4E\u4E00\u9879\u9632\u5FA16%\uFF0C\u6301\u7EED30s\uFF0C\u6700\u591A\u53E010\u6B21\u5E76\u91CD\u7F6E\u6301\u7EED\u65F6\u95F4",
    // v3.16 用户: 5→6,
    scriptId: "fxz_analyze",
  },
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
    attackInterval: 2.5,
  },
  growth: { hp: 90, attack: 9, physicalDef: 2.4, magicalDef: 1.8 },
  talent:
    "\u5BF9\u524D\u6392\u9020\u6210\u4F24\u5BB3\u63D0\u534720%+\u7B49\u7EA7\xD70.1%",
  skill: {
    id: "fdzs_combo",
    name: "\u75BE\u98CE\u8FDE\u51FB",
    tags: [],
    cooldown: 6,
    castTime: 1.5,
    description:
      "1.5s\u51855\u6B21\u5FEB\u901F\u653B\u51FB\uFF0C\u6BCF\u6B21\u653B\u51FB\u76EE\u6807\u968F\u673A\uFF0C\u653B\u51FB\xD765%\u4E14\u65E0\u89C6\u989D\u5916\u9632\u5FA1",
    // v3.4 用户直发
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.65 }],
    aoe: { maxTargets: 1 },
    scriptId: "fdzs_combo",
  },
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
    attackInterval: 2,
  },
  growth: { hp: 58, attack: 5.7, physicalDef: 1.6, magicalDef: 1.2 },
  talent:
    "\u6BCF\u635F\u593112%\u6700\u5927HP\uFF0C\u63D0\u53473%+\u7B49\u7EA7\xD70.05%\u653B\u4E0E8%\u51CF\u4F24\uFF0C\u6700\u591A5\u5C42",
  skill: {
    id: "kzs_rage",
    name: "\u8840\u6012",
    tags: ["\u589E\u76CA"],
    cooldown: 10,
    castTime: 0,
    description:
      "\u6D88\u801710%\u5F53\u524DHP\u8FDB\u5165\u55DC\u8840: 7s\u5185\u653B\u901F+80%\uFF0C\u6BCF\u6B21\u653B\u51FB\u9644\u52A0\u76EE\u6807\u5F53\u524DHP\xD75%\u7EAF\u7CB9",
    // v3.16 用户: 40→60, // 审阅修复: 3→5%
    effects: [{ type: "bloodrage" /* Bloodrage */, duration: 7 }],
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7.5, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "\u6BCF\u6B21\u53D7\u9B54\u6CD5\u4F24\u5BB350%\u51E0\u7387\u5BF9\u65BD\u6CD5\u8005\u9020\u6210\u653B\xD760%+\u7B49\u7EA7\xD70.25%\u7EAF\u7CB9\u5E76\u7729\u66552s\uFF1B50%\u4F7F\u8BE5\u6B21\u9B54\u4F24-50%\u5E76\u6CBB\u7597\u968F\u673A1\u540D\u53CB\u65B9",
  skill: {
    id: "slzs_guard",
    name: "\u5B88\u62A4",
    tags: ["\u589E\u76CA"],
    // v3.0
    cooldown: 13,
    castTime: 0,
    description:
      "\u6D88\u80176%\u6700\u5927HP\u8FDB\u5165\u5B88\u62A48s: \u81EA\u8EAB25%\u51CF\u4F24\u3001\u53D7\u7597+30%\uFF0C\u6211\u65B9\u5168\u4F53\u53CB\u65B9\u53D7\u5230\u9B54\u6CD5\u4F24\u5BB375%\u51E0\u7387\u8F6C\u79FB\u81F3\u81EA\u8EAB",
    scriptId: "slzs_guard",
  },
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
    attackInterval: 4.5,
  },
  growth: { hp: 56, attack: 10.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent:
    "\u6BCF\u666E\u901A\u653B\u51FB3\u6B21\uFF0C\u4E0B\u6B21\u653B\u51FB\u9644\u5E2640%\u5438\u8840\u4E0E\u6301\u7EED6s\u7684[\u7834\u7532]",
  skill: {
    id: "zqz_strike",
    name: "\u6BC1\u706D\u6253\u51FB",
    tags: ["\u5207\u5165", "\u63A7\u5236"],
    // v3.0
    cooldown: 10,
    castTime: 1,
    description:
      "\u65BD\u6CD51s\uFF0C\u5BF91\u540D\u654C\u65B9\u9020\u6210\u653B\u51FB\xD7440%\u7269\u7406\u5E76\u7729\u66552s\uFF0C\u53D1\u52A8\u540E\u81EA\u8EAB\u4E5F\u7729\u66552s",
    // v3.16 用户: 340→440
    damage: [{ type: "physical" /* Physical */, atkRatio: 4.4 }],
    effects: [{ type: "stun" /* Stun */, duration: 2 }],
    interruptOnAttack: true,
    priority: [{ row: 1 /* Mid */, chance: 100 }],
  },
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
    attackInterval: 3.2,
  },
  growth: { hp: 80, attack: 8.6, physicalDef: 1.8, magicalDef: 3 },
  talent:
    "\u6211\u65B9\u5168\u4F53\u6CD5\u5E08\u6BCF\u6B21\u6280\u80FD+1\u5C42\u79C0\u9017: \u6BCF\u5C423%+\u7B49\u7EA7\xD70.03%\u653B\u901F+3%\u6280\u80FD\u5438\u8840\uFF0C7s\uFF0C\u6700\u591A7\u5C42",
  skill: {
    id: "xdds_fire",
    name: "\u706B\u7403",
    tags: [],
    cooldown: 7,
    castTime: 1.5,
    description:
      "\u5BF91\u540D\u654C\u65B9\u9020\u6210\u653B\u51FB\xD7220%\u9B54\u6CD5\uFF1B\u6BCF2\u6B21\u5347\u7EA7\u9668\u77F3\u8F70\u70B8(1\u6392+\u653B\u51FB\xD7290%+\u707C\u70E73s)\uFF0C\u81EA\u8EAB\u83B7\u5F972\u5C42/4\u5C42\u79C0\u9017",
    // v3.16 用户: 205/250→230/300, // v3.9: 215→205%
    damage: [{ type: "magical" /* Magical */, atkRatio: 2.2 }],
    priority: [
      { row: 0 /* Front */, chance: 40 },
      { row: 1 /* Mid */, chance: 35 },
      { row: 2 /* Back */, chance: 25 },
    ],
    scriptId: "xdds_fire",
  },
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
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 7, physicalDef: 1.5, magicalDef: 2.4 },
  talent:
    "\u9664\u81EA\u8EAB\u5916\uFF0C\u53CB\u65B9\u6CD5\u5E08\u6280\u80FD\u51B7\u5374-10%\uFF0C\u6280\u80FD\u5438\u8840+10%",
  skill: {
    id: "sjsn_freeze",
    name: "\u51B0\u5C01",
    tags: ["\u63A7\u5236"],
    cooldown: 7,
    castTime: 0,
    description:
      "\u4F7F1\u540D\u654C\u65B9\u675F\u7F1A+\u7F34\u68B0+\u6BCF\u79D2\u653B\u51FB\xD780%\u9B54\u6CD5\uFF0C\u6301\u7EED3s\uFF08\u65E0\u89C640%\u9B54\u9632\uFF09",
    // v3.16 用户: 90→80+无视魔防,
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.8 }],
    effects: [
      { type: "bind" /* Bind */, duration: 3 },
      { type: "disarm" /* Disarm */, duration: 3 },
    ],
    scriptId: "sjsn_freeze",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 80, attack: 8, physicalDef: 1.5, magicalDef: 2.8 },
  talent:
    "\u53CB\u65B9\u5168\u573A\u6CD5\u5E08\u6BCF\u6B21\u6210\u529F\u65BD\u52A0\u5F02\u5E38\u72B6\u6001\uFF0C\u81EA\u8EAB\u6280\u80FD\u51CF\u5C111s\u51B7\u5374\u5E76\u6062\u590D3%\u6700\u5927HP",
  skill: {
    id: "bmxz_charge",
    name: "\u84C4\u529B",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "\u968F\u673A\u84C4\u529B1/2/3s\u2192\u524D\u6392/\u524D\u4E2D\u6392/\u5168\u573A\u51B2\u51FB\u6CE2: \u653B\u51FB\xD7200%\u9B54\u6CD5\uFF08\u547D\u4E2D5\u540D-40%\uFF09",
    // v3.16 用户,
    damage: [{ type: "magical" /* Magical */, atkRatio: 2 }],
    aoe: { maxTargets: 9 },
    scriptId: "bmxz_charge",
  },
};
var srm = {
  id: "srm",
  name: "\u98DF\u4EBA\u9B54\u9B54\u6CD5\u5E08",
  race: "mage" /* Mage */,
  stats: {
    hp: 8500,
    attack: 703.5,
    physicalDef: 348.8,
    magicalDef: 301.2,
    attackInterval: 3.2,
  },
  growth: { hp: 74, attack: 6.5, physicalDef: 3.2, magicalDef: 2.8 },
  talent:
    "\u81EA\u8EAB\u653B\u51FB\u83B7\u5F9710%\u5438\u8840\uFF1B\u6BCF\u5F53\u53CB\u65B9\u9635\u4EA1\uFF0C\u63D0\u534712%\u6700\u5927HP\u4E0A\u9650\u5E76\u6062\u590D16%\u6700\u5927HP",
  skill: {
    id: "srm_fire",
    name: "\u706B\u7130\u7206\u8F70",
    tags: ["\u63A7\u5236"],
    cooldown: 5,
    castTime: 0,
    description:
      "\u6D88\u80173%\u6700\u5927HP\uFF0C\u5BF91\u654C\u9020\u6210\u653B\u51FB\xD7160%+\u5F53\u524D\u8840\u91CF\xD73%\u9B54\u6CD5\u5E76\u7729\u66551s\uFF1B\u6BCF2\u6B21\u53D1\u52A8\u53D82\u500D/3\u500D\u6548\u679C",
    // v3.16 用户: 165→180+几率重做, // v2.36: 160→165%
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.6 }],
    // P1: 按文档
    effects: [{ type: "stun" /* Stun */, duration: 1 }],
    scriptId: "srm_fire",
  },
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
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2, magicalDef: 3 },
  talent:
    "\u6218\u6597\u5F00\u59CB 1 s \u540E,\u4F7F\u4E0E\u81EA\u8EAB\u4EE5\u53CA\u4E0E\u81EA\u8EAB\u5BF9\u79F0\u7684 1 \u540D\u654C\u65B9\u89D2\u8272\u6682\u65F6\u4F20\u9001\u79BB\u5F00\u573A\u5730\u3002\u7ECF\u8FC7 3 s \u540E\u81EA\u8EAB\u4F1A\u8FD4\u56DE\u6218\u6597\u573A\u5730,\u7ECF\u8FC7 4+\u7B49\u7EA7 \xD70.02 s \uFF08100\u7EA7\uFF1A6s\uFF09\u540E\u90A3\u4E2A\u654C\u65B9\u89D2\u8272\u4F1A\u8FD4\u56DE\u6218\u6597\u573A\u5730\u3002\uFF08\u6700\u591A\u89E6\u53D1 1 \u6B21\uFF09",
  // v3.0,
  skill: {
    id: "ynfs_annihilate",
    name: "\u6E6E\u706D",
    tags: ["\u63A7\u5236"],
    cooldown: 9,
    castTime: 3.5,
    description:
      "2\xD72\u683C\u5B50\uFF1A\u76EE\u6807\u603B\u9632\u5FA1\xB2/350\u7EAF\u7CB9+\u675F\u7F1A4s",
    damage: [{ type: "pure" /* Pure */, defSquaredDiv: 350 }],
    aoe: { maxTargets: 4 },
    effects: [{ type: "bind" /* Bind */, duration: 4 }],
  },
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
    attackInterval: 4,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 3 },
  talent:
    "\u6BCF\u6B21\u653B\u51FB\u6CBB\u7597\u6211\u65B9\u968F\u673A1\u540D\u53CB\u65B9\u653B\xD770%(80%\u51E0\u7387\u6700\u4F4E\u8840\u5355\u4F4D)\uFF1B\u9635\u4EA1\u540E\u5168\u573A\u6CD5\u5E0810%\u51CF\u4F24+\u6BCF4s\u5168\u4F53\u6CBB\u7597(\u524D10s 2\u500D)",
  skill: {
    id: "syz_bless",
    name: "\u795E\u4E4B\u5E87\u4F51",
    tags: ["\u589E\u76CA"],
    // v3.0
    cooldown: 9,
    // 审阅修复: 12→10 (文档)
    castTime: 0,
    description:
      "\u6211\u65B9\u6700\u4F4E\u8840\u91CF2\u540D\u53CB\u65B9: \u53D7\u5230\u6CBB\u7597+25%\u3001\u51CF\u4F2420%+\u5EF6\u8FDF5s\u7ED3\u7B97\uFF0C\u6301\u7EED6s",
    effects: [{ type: "inspire" /* Inspire */, duration: 6, value: 0.8 }],
    // 审阅修复: 7→5
    scriptId: "syz_bless",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 65, attack: 7.5, physicalDef: 1.8, magicalDef: 3.5 },
  talent:
    "\u654C\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u540D\u5904\u4E8E[\u8BC5\u5492]\u72B6\u6001\u7684\u654C\u4EBA,\u81EA\u8EAB\u653B\u51FB\u529B+5%\uFF0C\u95EA\u907F\u7387+3%\uFF0C\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u6548\u679C+50%",
  skill: {
    id: "wqqs_move",
    name: "\u4EA1\u9B42\u7A81\u88AD",
    tags: ["\u79FB\u52A8"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u968F\u673A\u79FB\u52A8\u540E\u5BF91\u540D\u654C\u4EBA\u9020\u6210\u653B\u51FB\xD7110%\u7EAF\u7CB9\uFF0C\u5E76\u4F7F\u5176\u53D7\u5230\u8BC5\u54925s",
    damage: [{ type: "pure" /* Pure */, atkRatio: 1.1 }],
    effects: [{ type: "curse" /* Curse */, duration: 5 }],
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 8, physicalDef: 3, magicalDef: 2.5 },
  talent:
    "\u6218\u6597\u5F00\u59CB\u53EC\u5524 3 \u4E2A\u9AB7\u9AC5\u5175\u534F\u52A9\u6218\u6597,\u81EA\u8EAB\u9635\u4EA1\u65F6\u6211\u65B9\u6240\u6709\u9AB7\u9AC5\u5175\u4E00\u540C\u9635\u4EA1\u3002\u9AB7\u9AC5\u5175\u5B58\u5728\u671F\u95F4\uFF0C\u654C\u65B9\u653B\u51FB\xB7\u6280\u80FD\u4F18\u5148\u5BF9\u9AB7\u9AC5\u5175\u53D1\u52A8\u3002\u81EA\u8EAB\u590D\u6D3B\u540E,\u91CD\u65B0\u53EC\u5524 3 \u4E2A\u9AB7\u9AC5\u5175(\u9AB7\u9AC5\u5175\u89C6\u4E3A\u72EC\u7ACB\u5355\u4F4D,\u4E0E\u9AB7\u9AC5\u5927\u5E1D\u5904\u4E8E\u540C\u4E00\u683C,\u8303\u56F4\u4F24\u5BB3\u53EF\u540C\u65F6\u547D\u4E2D\u9AB7\u9AC5\u5927\u5E1D\u53CA\u9AB7\u9AC5\u5175)",
  skill: {
    id: "kldd_hammer",
    name: "\u51A5\u706B\u4E4B\u9524",
    tags: ["\u63A7\u5236"],
    // v3.0
    cooldown: 7,
    castTime: 0,
    description:
      "\u5BF91\u654C\u9020\u6210\u653B\u51FB\xD7150%\u9B54\u6CD5\u5E76\u7729\u66551.5s\uFF1B4s\u540E\u8FFD\u52A0\u653B\u51FB\xD775%\u7EAF\u7CB9\uFF0C\u81EA\u8EAB\u6062\u590D25%\u653B\u51FB\u8840\u91CF",
    // v3.3: 75%纯粹由 battle.ts 的 4s 延迟结算，此处不再重复立即结算
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.5 }],
    effects: [{ type: "stun" /* Stun */, duration: 1.5 }],
  },
};
var klb = {
  id: "klb",
  name: "\u9AB7\u9AC5\u5175",
  race: "undead" /* Undead */,
  stats: {
    hp: 1090,
    attack: 218,
    physicalDef: 119,
    magicalDef: 634,
    // v3.0: 40(+6/级)
    attackInterval: 2,
  },
  growth: { hp: 10, attack: 2, physicalDef: 1, magicalDef: 6 },
  // v3.0: 5→6,
  talent:
    "\u4F18\u5148\u653B\u51FB\u51A5\u706B\u4E4B\u9524\u76EE\u6807\uFF1B\u65E0\u89C640%\u9632\u5FA1\uFF1B20%\u4F24\u5BB3\u6CBB\u7597\u9AB7\u9AC5\u5927\u5E1D",
  // P2: 实际20%,
  skill: {
    id: "klb_attack",
    name: "\u653B\u51FB",
    tags: [],
    cooldown: 2,
    castTime: 0,
    description: "\u666E\u901A\u653B\u51FB",
    damage: [{ type: "physical" /* Physical */, atkRatio: 1 }],
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 65, attack: 7.2, physicalDef: 1.5, magicalDef: 2.4 },
  talent:
    "\u6BCF\u7ECF\u8FC7 8 s \u4F7F\u4E0E\u81EA\u8EAB\u540C\u9635\u578B\u7684\u654C\u65B9\u6240\u6709\u89D2\u8272\u9677\u5165[\u8BC5\u5492]\u72B6\u6001\u6301\u7EED 5 s,\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u5347\u7EA7\u4E3A\uFF1A\u6BCF\u7ECF\u8FC7 8 s\uFF0C\u4E0E\u81EA\u8EAB\u540C\u9635\u578B\u7684\u654C\u65B9\u5355\u4F4D\u9677\u5165[\u8BC5\u5492]\u4E0E[\u7834\u574F]\u72B6\u6001\uFF0C\u6301\u7EED 6 s",
  // v3.0,
  skill: {
    id: "yammxz_swap",
    name: "\u6697\u5F71\u6362\u4F4D",
    tags: ["\u79FB\u52A8"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u4E0E\u53CB\u65B9\u6362\u4F4D\u540E\uFF0C\u4F7F2\u540D\u968F\u673A\u654C\u4EBA\u6C89\u9ED84s\uFF0C\u5E76\u9020\u6210\u653B\u51FB\xD7120%\u7EAF\u7CB9\u4F24\u5BB3",
    damage: [{ type: "pure" /* Pure */, atkRatio: 1.2 }],
    scriptId: "yammxz_swap",
    effects: [{ type: "silence" /* Silence */, duration: 4 }],
  },
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
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 8.5, physicalDef: 2.2, magicalDef: 2.4 },
  talent:
    "\u653B\u51FB\u4E0E\u6280\u80FD\u5206\u522B\u670925%\u51E0\u7387\u4E0E45%\u51E0\u7387\u89E6\u53D1[\u81F4\u547D\u4E00\u51FB],\u9020\u6210150%\u4F24\u5BB3,\u590D\u6D3B\u540E,\u81F4\u547D\u4E00\u51FB\u4F24\u5BB3\u53D8\u4E3A190%\u3002[\u81F4\u547D\u4E00\u51FB]\u4E0E\u66B4\u51FB\u72EC\u7ACB\u5224\u5B9A,\u82E5\u540C\u65F6\u89E6\u53D1\u53D6\u4F24\u5BB3\u8F83\u9AD8\u8005\u3002",
  skill: {
    id: "dyq_dash",
    name: "\u51B2\u523A",
    tags: ["\u79FB\u52A8"],
    cooldown: 5,
    castTime: 0,
    description:
      "\u5BF9\u540C\u5217\u7AD6\u6392\u5168\u4F53\u9020\u6210\u653B\u51FB\xD7130%\u9B54\u6CD5\uFF0C30%\u51E0\u7387\u8BC5\u54924s\uFF08\u547D\u4E2D3\u4EBA-30%\uFF09",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.3 }],
    effects: [
      { type: "burn" /* Burn */, duration: 4, value: 0.05, chance: 0.3 },
    ],
    aoe: { maxTargets: 3 },
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 7.5, physicalDef: 1.4, magicalDef: 3.4 },
  talent:
    "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u653B\u51FB\u529B-5%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u653B\u51FB+5%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\uFF0C\u6211\u65B9\u5176\u4ED6\u9F99\u65CF+3%\u653B\u51FB",
  skill: {
    id: "hlyl_fire",
    name: "\u706B\u7130\u55B7\u5410",
    tags: [],
    cooldown: 7,
    castTime: 1,
    description:
      "\u5BF91\u540D\u654C\u4EBA\u9020\u6210\u6BCF\u79D2\u653B\u51FB\xD735%\u9B54\u6CD5\u4F24\u5BB3\uFF0C\u6301\u7EED7s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.35 }],
    aoe: { maxTargets: 1 },
    scriptId: "hlyl_fire",
  },
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
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 6.5, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u9632\u5FA1-5%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u9632\u5FA1+5%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF+2%\u9632\u5FA1",
  skill: {
    id: "bsxl_freeze",
    name: "\u51B0\u971C\u5410\u606F",
    tags: ["\u63A7\u5236"],
    cooldown: 10,
    castTime: 1,
    description:
      "\u968F\u673A1\u6392\u654C\u4EBA: \u964D40%\u653B\u901F+\u6BCF\u79D2\u653B\u51FB\xD760%\u9B54\u6CD5\u4F24\u5BB34s\uFF1B\u6BCF2\u6B21\u53D1\u52A8\uFF0C\u4E0B\u6B21\u964D\u653B\u901F\u53D8\u4E3A[\u51B0\u51BB]",
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.6 }],
    aoe: { maxTargets: 3 },
    scriptId: "bsxl_freeze",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 3.2 },
  talent:
    "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4+4%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4-4%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u6301\u7EED\u65F6\u95F4-2%",
  skill: {
    id: "xyfl_chaos",
    name: "\u4E71\u5E8F\u6253\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 9,
    castTime: 1,
    description:
      "\u968F\u673A4\u540D\u654C\u4EBA\u53D7\u5230\u653B\u51FB\xD7240%\u7269\u7406\uFF0C\u5E76\u968F\u673A\u6253\u4E71\u5B83\u4EEC\u4E4B\u95F4\u7684\u4F4D\u7F6E",
    // v3.15g: 220→260（对齐 handler）
    damage: [{ type: "physical" /* Physical */, atkRatio: 2.4 }],
    aoe: { maxTargets: 6 },
    scriptId: "xyfl_chaos",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 70, attack: 6, physicalDef: 2.5, magicalDef: 2.2 },
  talent:
    "\u6211\u65B9\u573A\u4E0A\u6BCF\u5B58\u5728 1 \u53EA\u975E\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u6280\u80FD\u51B7\u5374+4%\uFF0C\u6BCF\u5B58\u5728 1 \u53EA\u9F99\u65CF\u89D2\u8272\uFF0C\u81EA\u8EAB\u6280\u80FD\u51B7\u5374-4%\uFF08\u4E0D\u542B\u81EA\u8EAB\uFF09\u5176\u4ED6\u9F99\u65CF\u6280\u80FD\u51B7\u5374-2%",
  skill: {
    id: "hbfl_heal",
    name: "\u51B0\u5C01\u6CBB\u7597",
    tags: ["\u6CBB\u7597"],
    cooldown: 10,
    castTime: 1,
    description:
      "\u51B0\u5C01<75%HP\u9F99\u65CF4s\uFF08\u514D\u75AB\u7269\u7406\uFF0C\u88AB\u51B0\u5C01\u65E0\u6CD5\u884C\u52A8\uFF09\uFF0C\u6BCF\u79D2\u63D0\u4F9B\u653B\u51FB\xD770%+\u6700\u5927HP\xD73%\u6CBB\u7597",
    // P1修复: 按文档60%/6%
    heal: { atkRatio: 0.7, targetMaxHpRatio: 0.06 },
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 9.2, physicalDef: 2, magicalDef: 3.3 },
  talent:
    "\u6218\u6597\u5F00\u59CB\uFF0C\u53D1\u51FA\u543C\u53EB\uFF0C\u4F7F\u5168\u573A\u975E\u9F99\u65CF\u89D2\u8272\u9632\u5FA1\u529B\u964D\u4F4E 30%+\u7B49\u7EA7\xD70.15%\uFF08100\u7EA7\uFF1A-45%\u9632\u5FA1\uFF09\uFF0C\u8FD9\u4E2A\u6548\u679C\u6BCF 5 s \u51CF\u5C11 15%\uFF0C\u6700\u4F4E\u964D\u81F3\u539F\u672C\u7684 25%",
  // v3.0: 6→5s,
  skill: {
    id: "bjl_wing",
    name: "\u7FC5\u51FB",
    tags: ["\u5207\u5165"],
    cooldown: 9,
    castTime: 0,
    description:
      "\u4E2D\u540E\u6392\u54041\u540D: \u7B2C1\u4E2A200%\u7269\u4F24+30%\u964D\u653B\u901F4s\uFF0C\u7B2C2\u4E2A240%\u7269\u4F24",
    // v3.15c: 180/230→210/260
    damage: [
      { type: "physical" /* Physical */, atkRatio: 2 },
      { type: "physical" /* Physical */, atkRatio: 2.4 },
    ],
    aoe: { maxTargets: 2 },
    scriptId: "bjl_wing",
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 80, attack: 8.5, physicalDef: 2, magicalDef: 2.5 },
  talent:
    "\u81EA\u8EAB\u653B\u51FB/\u6280\u80FD\u5404\u670935%/75%\u51E0\u7387\u9644\u52A0\u76EE\u6807\u5F53\u524DHP\xD78%\u7684\u9B54\u6CD5\u4F24\u5BB3",
  skill: {
    id: "zs_storm",
    name: "\u795E\u4E4B\u6012\u96F7",
    tags: [],
    cooldown: 10,
    castTime: 2,
    description: "\u5168\u5C4F\u653B\u51FB\xD7160-180%\u9B54\u6CD5",
    // v2.35 宙斯 1.65→1.7
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.7 }],
    aoe: { maxTargets: 9 },
    interruptOnAttack: true,
  },
};
var xjl = {
  id: "xjl",
  name: "\u5C0F\u7CBE\u7075",
  race: "mage" /* Mage */,
  stats: {
    hp: 8500,
    attack: 748,
    physicalDef: 322,
    magicalDef: 272.5,
    attackInterval: 4.5,
  },
  growth: { hp: 75, attack: 7, physicalDef: 3, magicalDef: 2.5 },
  talent:
    "\u6BCF\u79D2\u6062\u590D1.5%\u6700\u5927HP\uFF1B\u6211\u65B9\u5168\u573A\u6BCF\u6B21\u6280\u80FD\u5BF9\u654C\u9020\u6210\u4F24\u5BB3\uFF0C\u81EA\u8EAB\u6062\u590D2%\u6700\u5927HP\uFF08\u6BCF2s\u6700\u591A4%\uFF09",
  // v3.4 R14
  skill: {
    id: "xjl_link",
    name: "\u94FE\u63A5",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "\u94FE\u63A51\u540D\u53CB\u65B98s: +30%\u6280\u80FD\u589E\u5F3A+\u88AB\u94FE\u63A5\u53CB\u65B9\u5929\u8D4B30%\u6548\u679C\uFF0C\u81EA\u8EAB\u4EE3\u66FF\u88AB\u94FE\u63A5\u7684\u53CB\u65B9\u627F\u62C525%\u4F24\u5BB3",
    // v3.4 R14
    scriptId: "xjl_link",
  },
};
var swxz = {
  id: "swxz",
  name: "\u6B7B\u4EA1\u5148\u77E5",
  race: "undead" /* Undead */,
  stats: {
    hp: 9365,
    // v3.3 成长-15%: 950+85×99
    attack: 797.5,
    physicalDef: 329,
    magicalDef: 358.8,
    attackInterval: 3.6,
  },
  growth: { hp: 85, attack: 7.5, physicalDef: 3, magicalDef: 3.2 },
  // v3.3 100→85
  talent:
    "\u81EA\u8EAB\u6BCF\u7D2F\u79EF\u9020\u6210800\u4F24\u5BB3\uFF0C\u83B7\u5F973%\u4F24\u5BB3\u51CF\u514D\u76F4\u5230\u6218\u6597\u7ED3\u675F\uFF08\u6700\u591A10\u5C42\uFF0C\u8BA1\u7B97\u5B9E\u9645\u4F24\u5BB3\uFF09",
  // v3.0,
  skill: {
    id: "swxz_drain",
    name: "\u5438\u9B42\u5DEB\u672F",
    tags: [],
    cooldown: 7,
    castTime: 0,
    description:
      "\u5438\u53D61\u5355\u4F4D10s: \u6BCF\u79D2\u9020\u6210\u81EA\u8EAB\u653B\u51FB\xD76%+\u76EE\u6807\u6700\u5927HP\xD71%\u9B54\u6CD5\uFF0C\u81EA\u8EAB\u83B7\u5F9715%\u6280\u80FD\u5438\u8840\u3002\u4F18\u5148\u524D\u6392(70/15/15)",
    scriptId: "swxz_drain",
    priority: [
      { row: 0 /* Front */, chance: 70 },
      { row: 1 /* Mid */, chance: 15 },
      { row: 2 /* Back */, chance: 15 },
    ],
  },
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
    attackInterval: 3,
  },
  growth: { hp: 52, attack: 7.8, physicalDef: 2.1, magicalDef: 3 },
  talent:
    "\uFF08\u661F\u8FB0\u9A71\u9010\uFF09\u4F7F\u573A\u4E0A\u7B2C\u4E00\u4E2A\u53D1\u52A8\u6280\u80FD\u7684\u975E\u9F99\u65CF\u89D2\u8272\u6682\u65F6\u79BB\u5F00\u573A\u4E0A3s\uFF0C\u56DE\u5F52\u540E\u90A3\u4E2A\u6280\u80FD\u53D8\u4E3A\u51B7\u5374\u72B6\u6001\u3002\uFF08\u90A3\u6B21\u6280\u80FD\u53D1\u52A8\u65E0\u6548\uFF09",
  skill: {
    id: "xcl_star",
    name: "\u661F\u8FB0\u51B2\u51FB",
    tags: ["\u63A7\u5236"],
    cooldown: 11,
    castTime: 2,
    description:
      "2\xD72\u968F\u673A\u683C\u5B50\u4E0A\u7684\u654C\u4EBA\u53D7\u5230\u653B\u51FB\xD7170%\u9B54\u6CD5\uFF0C\u5E76\u5404\u670920%\u6C89\u9ED8/20%\u7F34\u68B03s",
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.7 }],
    aoe: { maxTargets: 4 },
    effects: [
      { type: "silence" /* Silence */, duration: 3, chance: 0.2 },
      { type: "disarm" /* Disarm */, duration: 3, chance: 0.2 },
    ],
  },
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
    attackInterval: 3.3,
  },
  growth: { hp: 70, attack: 8, physicalDef: 2.5, magicalDef: 2 },
  talent:
    "\u7C97\u66B4\u9F99\u76AE: \u53D7\u5230\u666E\u653B\u968F\u673A\u53D1\u52A8\u2460\u653B\u51FB\u8005\u53D7\u81EA\u8EAB\u653B\u51FB\xD712%\u7EAF\u7CB9 \u2461\u8BE5\u6B21\u4F24\u5BB3-30%",
  // v3.0 重写,
  skill: {
    id: "dl_stomp",
    name: "\u9F99\u8E0F",
    tags: ["\u63A7\u5236"],
    cooldown: 11,
    castTime: 2,
    description:
      "\u654C\u65B9\u5168\u4F53\u653B\u51FB\xD7150%\u7269\u7406\uFF08\u524D\u6392130%/\u4E2D\u6392100%/\u540E\u639270%\uFF09\uFF0C\u5E76\u964D\u4F4E20%\u547D\u4E2D\u73875s",
    // v3.8: 145→150%
    damage: [{ type: "physical" /* Physical */, atkRatio: 1.5 }],
    aoe: { maxTargets: 9 },
    scriptId: "dl_stomp",
  },
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
    attackInterval: 5,
  },
  growth: { hp: 85, attack: 6, physicalDef: 2.6, magicalDef: 3.2 },
  talent:
    "\u81EA\u8EAB\u53EA\u80FD\u653E\u7F6E\u5728\u524D\u6392\uFF0C\u5982\u679C\u56E0\u5176\u4ED6\u6280\u80FD/\u5929\u8D4B\u800C\u79BB\u5F00\u524D\u6392\uFF0C\u6BCF\u79D2\u5931\u53BB3%\u6700\u5927\u751F\u547D\u503C\u3002\u573A\u4E0A\u6BCF\u5B58\u57281\u53EA\u9F99\u65CF\u5355\u4F4D\uFF0C\u81EA\u8EAB\u83B7\u5F975%\u4F24\u5BB3\u964D\u4F4E\uFF1B\u573A\u4E0A\u6BCF\u5F53\u6709\u9F99\u65CF\u5355\u4F4D\u9635\u4EA1\uFF0C\u81EA\u8EAB\u6062\u590D\u9635\u4EA1\u5355\u4F4D\u6700\u5927\u751F\u547D\u503C\xD78%\u8840\u91CF\u3002",
  // v3.4 R16
  skill: {
    id: "lyz_heal",
    name: "\u9F99\u541F\u6CBB\u6108",
    tags: ["\u6CBB\u7597", "\u589E\u76CA"],
    // v3.0
    cooldown: 9,
    castTime: 2,
    description:
      "\u6CBB\u7597\u6700\u4F4EHP\u9F99\u65CF: \u6BCF\u79D2\u653B\u51FB\xD740%+20%\u51CF\u4F244s\uFF1B\u6BCF3\u6B21\u540E\u4E0B\u6B21\u5347\u7EA7\uFF0C\u5347\u7EA7\u90A3\u6B21\u5BF9\u6211\u65B9\u5168\u4F53\u9F99\u65CF\u751F\u6548\uFF0C\u82E5\u6709\u9635\u4EA1\u9F99\u65CF\u968F\u673A\u590D\u6D3B1\u53EA\u5E76\u65E0\u654C5s",
    // v3.4 R16
    heal: { atkRatio: 0.4 },
    scriptId: "lyz_heal",
  },
};
var xblr = {
  id: "xblr",
  name: "\u897F\u90E8\u730E\u4EBA",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 8342,
    attack: 721.4,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 248.7,
    magicalDef: 236.8,
    attackInterval: 2.8,
  },
  growth: { hp: 78, attack: 10, physicalDef: 2.3, magicalDef: 2.2 },
  talent:
    "\u6211\u65B9\u5168\u4F53\u730E\u4EBA\u6BCF\u6B21\u653B\u51FB\uFF0C\u81EA\u8EAB\u989D\u5916\u5BF9\u8BE5\u76EE\u6807\u8FDB\u884C\u4E00\u6B2110%\u4F24\u5BB3\u7684\u653B\u51FB\uFF0C\u8BE5\u653B\u51FB\u66B4\u51FB\u7387+35%",
  // v3.0 重做,
  skill: {
    id: "xblr_shot",
    name: "\u8DF3\u8DC3\u5C04\u51FB",
    tags: ["\u79FB\u52A8"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u8DF3\u81F3\u7A7A\u4F4D\u540E\uFF0C\u5BF92\u540D\u654C\u4EBA\u54043\u53D1\u653B\u51FB\uFF1A90%/100%/120%\uFF0C\u7B2C3\u53D1\u5FC5\u66B4\u51FB",
    // v3.16 用户: 120→110,
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.97 }],
    aoe: { maxTargets: 3 },
    scriptId: "xblr_shot",
  },
};
var ldshz = {
  id: "ldshz",
  name: "\u6797\u5730\u5B88\u62A4\u8005",
  race: "hunter" /* Hunter */,
  stats: {
    hp: 10110,
    attack: 523.4,
    // v3.9 ×0.95 // v3.8 ×0.95 // v3.7 ×0.9 // v3.6: ×0.85
    physicalDef: 361.8,
    magicalDef: 337,
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 7, physicalDef: 3.2, magicalDef: 3 },
  talent:
    "\u81EA\u8EABHP>90%\u65F6\u53D7\u4F24-60%\uFF0CHP>40%\u65F6\u53D7\u4F24-30%",
  skill: {
    id: "ldshz_buff",
    name: "\u81EA\u7136\u5B88\u62A4",
    tags: ["\u589E\u76CA"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u4F7F\u81EA\u8EAB\u53CA\u968F\u673A2\u540D\u53CB\u65B9\u83B7\u5F97\u62A4\u76FE(\u81EA\u8EAB\u653B\xD7600%)6s\uFF1B\u62A4\u76FE\u7834\u788E\u65F6\u6211\u65B9\u5168\u573A\u83B7\u5F9730%\u62A4\u76FE\u503C\u6CBB\u7597",
    // v3.16 用户: 30→35,
    scriptId: "ldshz_buff",
  },
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
    attackInterval: 3,
  },
  growth: { hp: 75, attack: 7.5, physicalDef: 2.5, magicalDef: 1.8 },
  talent:
    "\u6211\u65B9\u5168\u4F53\u6218\u58EB\u6BCF\u6B21\u51FB\u6740\uFF0C\u81EA\u8EAB\u53D7\u5F53\u524D\u653B\xD710%\u53CD\u51B2\uFF0C\u4E4B\u540E+3%+\u7B49\u7EA7\xD70.02%\u653B\u4E0E5%\u9632\u76F4\u5230\u6218\u6597\u7ED3\u675F",
  // v3.0,
  skill: {
    id: "jdds_steal",
    name: "\u6218\u529B\u593A\u820D",
    tags: [],
    cooldown: 6,
    castTime: 0,
    description:
      "\u593A\u53D6\u654C\u65B9\u653B\u6700\u9AD8\u89D2\u827220%\u653B\u51FB\u529B5s",
    // v3.16 用户: 20→30,
    scriptId: "jdds_steal",
  },
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
    attackInterval: 3.6,
  },
  growth: { hp: 75, attack: 6, physicalDef: 2, magicalDef: 3.5 },
  talent:
    "\u654C\u65B9\u573A\u4E0A\u5904\u4E8E[\u8BC5\u5492]\u72B6\u6001\u7684\u654C\u4EBA\u6BCF\u79D2\u53D7\u5230\u76EE\u6807\u81EA\u8EAB\u653B\u51FB\u529B\xD71%+\u81EA\u8EAB\u7B49\u7EA7\xD70.6\u7684\u7EAF\u7CB9\u4F24\u5BB3,\u590D\u6D3B\u540E,\u8BE5\u5929\u8D4B\u6548\u679C+50%",
  skill: {
    id: "wlgyz_heal",
    name: "\u6B7B\u4EA1\u9882\u6B4C",
    tags: ["\u6CBB\u7597", "\u51CF\u76CA"],
    cooldown: 8,
    castTime: 2,
    description:
      "\u65BD\u6CD52s\uFF0C\u4F18\u5148\u6062\u590D\u524D\u63922\u540D\u53CB\u65B9\u653B\u51FB\xD7160%\u751F\u547D\uFF0C\u5E76\u8BC5\u5492\u968F\u673A1\u540D\u654C\u65B95s\uFF1B\u6BCF\u53D1\u52A82\u6B21\u540E\uFF0C\u4E0B\u6B21\u53D1\u52A8\u51B7\u5374-60%",
    // v3.4 R15
    heal: { atkRatio: 1.6 },
    aoe: { maxTargets: 2 },
    effects: [{ type: "curse" /* Curse */, duration: 5 }],
  },
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
    attackInterval: 3.5,
  },
  growth: { hp: 66, attack: 9.9, physicalDef: 1.6, magicalDef: 2.4 },
  talent:
    "\u653B\u51FB\u5F02\u5E38\u72B6\u6001\u654C\u4EBA\u9020\u6210\u4F24\u5BB3+10%\uFF0C\u83B7\u5F9720%\u5438\u8840\uFF0C\u590D\u6D3B\u540E\u6548\u679C2\u500D",
  skill: {
    id: "mrsz_doom",
    name: "\u672B\u65E5",
    tags: ["\u63A7\u5236"],
    cooldown: 14,
    castTime: 0,
    description:
      "\u6D88\u80176%\u6700\u5927HP\uFF0C\u9501\u5B9A\u8FD110s\u4F24\u5BB3\u6700\u9AD8\u76EE\u6807: \u53D7\u7597-75%\u3001\u6BCF\u79D213%\xD7\u653B\u51FB\u7EAF\u7CB9\u3001[\u6C89\u9ED8]+[\u7834\u574F]8s\uFF08HP<15%\u4E0D\u53EF\u7528\uFF09",
    scriptId: "mrsz_doom",
  },
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
    attackInterval: 3.2,
  },
  growth: { hp: 60, attack: 6, physicalDef: 1.8, magicalDef: 3.5 },
  talent:
    "\u6BCF4s\u6216\u6BCF\u5F53\u6211\u65B9\u5BF9\u654C\u65BD\u52A0\u8D1F\u9762\u72B6\u6001(\u6BCF\u6B21\u52A8\u4F5C1\u5C42)\u83B7\u5F971\u5C42\u9B42\u80FD\uFF0C\u6700\u591A5\u5C42\uFF1B\u6BCF\u5C42\u653B+5%\u9632+10%\uFF1B\u590D\u6D3B\u540E\u7ACB\u5373\u83B7\u5F975\u5C42",
  skill: {
    id: "hyz_shield",
    name: "\u9B42\u80FD\u62A4\u76FE",
    tags: ["\u79FB\u52A8", "\u589E\u76CA"],
    // v3.0
    cooldown: 13,
    castTime: 0,
    description:
      "\u6D88\u8017\u5168\u90E8\u9B42\u80FD\uFF0C\u77AC\u79FB\u81F31\u4E2A\u7A7A\u4F4D\uFF1B\u4F7F\u968F\u673A1\u540D\u53CB\u65B9\u9A71\u6563\u5168\u90E8\u8D1F\u9762\uFF0C\u81EA\u8EAB\u4E0E\u76EE\u6807\u83B7\u5F97\u62A4\u76FE(\u653B\u51FB\xD780%\xD7\u5C42\u6570)",
    scriptId: "hyz_shield",
  },
};
var fz = {
  id: "fz",
  name: "\u7B26\u5492\u5927\u5E08",
  race: "holy" /* Holy */,
  stats: {
    hp: 10120,
    // v3.7 ×1.15
    attack: 1029.7,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 222,
    magicalDef: 141.3,
    // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 80, attack: 5.6, physicalDef: 2, magicalDef: 0.8 },
  talent:
    "\u6BCF\u6B21\u653B\u51FB\u968F\u673A2\u90091: \u2460\u4F24\u5BB3\u964D\u4F4E20%\u53D8\u7EAF\u7CB9 \u2461\u5BF9\u76EE\u6807\u53E01\u5C42\u7B26\u5492\u5370\u8BB0(\u76F4\u5230\u81EA\u8EAB\u9635\u4EA1\u6216\u76EE\u6807\u79FB\u52A8/\u9635\u4EA1)",
  skill: {
    id: "fz_curse",
    name: "\u7B26\u5492",
    tags: [],
    cooldown: 5,
    castTime: 1,
    description:
      "\u5BF91\u540D\u654C\u4EBA\u9020\u6210\u653B\u51FB\xD780%\u9B54\u6CD5\u4F24\u5BB3\uFF0C\u76EE\u6807\u6BCF\u5C42\u7B26\u5492\u5370\u8BB0+8%\u4F24\u5BB3",
    // v3.15g: 95→85
    damage: [{ type: "magical" /* Magical */, atkRatio: 0.8 }],
    scriptId: "fz_curse",
  },
};
var qm = {
  id: "qm",
  name: "\u9A71\u9B54\u8005",
  race: "holy" /* Holy */,
  stats: {
    hp: 9458,
    // v3.7 ×1.15
    attack: 1029.7,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 168.5,
    magicalDef: 572.2,
    // v3.7 ×1.5
    attackInterval: 3.5,
  },
  growth: { hp: 75, attack: 6.5, physicalDef: 1.5, magicalDef: 3.5 },
  talent:
    "\u53D7\u5230\u5F02\u5E38\u72B6\u6001\u540E\u63D0\u53476%\u653B\u4E0E20%\u9632\uFF0C\u6301\u7EED12s\uFF08\u6700\u591A5\u5C42\uFF09",
  skill: {
    id: "qm_exorcise",
    name: "\u9A71\u9B54",
    tags: ["\u8303\u56F4"],
    cooldown: 8,
    castTime: 1,
    description:
      "\u654C\u65B9\u968F\u673A2\xD72\u8303\u56F4: \u653B\u51FB\xD7105%\u9B54\u6CD5\uFF0C\u76EE\u6807\u6709\u589E\u76CA\u72B6\u6001\u2192\u4F24\u5BB3\u53D8\u7EAF\u7CB9",
    // v3.15g: 115→105
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.05 }],
    aoe: { maxTargets: 4 },
    scriptId: "qm_exorcise",
  },
};
var sq = {
  id: "sq",
  name: "\u5723\u9A91\u58EB",
  race: "holy" /* Holy */,
  stats: {
    hp: 16675,
    // v3.7 ×1.15 // v3.5: 圣职者加强
    attack: 758.7,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 446,
    magicalDef: 669,
    // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 90, attack: 5, physicalDef: 4, magicalDef: 4 },
  talent:
    "\u81EA\u8EAB\u4E0D\u4F1A\u9677\u5165[\u6C89\u9ED8]/[\u7834\u574F]/[\u7F34\u68B0]/[\u8BC5\u5492]\u72B6\u6001",
  skill: {
    id: "sq_heal",
    name: "\u5723\u5149\u6CBB\u6108",
    tags: ["\u6CBB\u7597"],
    cooldown: 11,
    castTime: 0,
    description:
      "\u6211\u65B92\u540D\u5723\u804C\u8005\u6062\u590D\u653B\u51FB\xD7210%\u751F\u547D\uFF1B\u6709\u8D1F\u9762\u5219\u9A71\u6563\u5E76+30%\u6CBB\u7597\uFF1B\u5723\u4E4B\u62A4\u76FE(\u9B54\u4F24-30%\uFF0C\u53CD\u5F3910%\u539F\u672C\u4F24\u5BB3\u4E3A\u7EAF\u7CB9)7s",
    // v3.4 R17: 冷却12→11 / 治疗120%→210%
    heal: { fixedAdd: 0, atkRatio: 2.1 },
    scriptId: "sq_heal",
  },
};
var qd = {
  id: "qd",
  name: "\u7948\u7977\u8005",
  race: "holy" /* Holy */,
  stats: {
    hp: 8510,
    // v3.7 ×1.15
    attack: 975.5,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5
    physicalDef: 218,
    magicalDef: 172.5,
    // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 60, attack: 7.5, physicalDef: 2, magicalDef: 1 },
  talent:
    "\u6211\u65B9\u6240\u6709\u89D2\u8272\u6BCF\u6B21\u6280\u80FD\u540E\uFF0C\u5BF9\u654C\u65B9\u968F\u673A1\u540D\u9020\u6210\u653B\u51FB\xD73%\u7EAF\u7CB9\uFF0C\u5E76\u6CBB\u7597\u6211\u65B9\u968F\u673A1\u540D\u653B\u51FB\xD73%",
  skill: {
    id: "qd_pray",
    name: "\u7948\u7977",
    tags: ["\u6CBB\u7597", "\u589E\u76CA"],
    // v3.0 用户指定
    cooldown: 9,
    castTime: 3,
    description:
      "\u65BD\u6CD53s\u540E\u968F\u673A\u7948\u7977: \u5927\u6210\u529F(\u81EA\u8EAB\u65E0\u654C+\u6BCF\u79D22%\u6700\u5927HP\xD75s)/\u6210\u529F(\u81EA\u8EAB\u51CF\u4F2440%+\u6BCF\u79D21%\xD75s)/\u4E00\u822C(\u81EA\u8EAB\u51CF\u4F2420%\xD75s)/\u5931\u8D25(\u81EA\u635F10%\u6700\u5927HP)",
    scriptId: "qd_pray",
  },
};
var sqz = {
  id: "sqz",
  name: "\u5723\u62F3\u8005",
  race: "holy" /* Holy */,
  stats: {
    hp: 8774,
    // v3.7 ×1.15
    attack: 975.5,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 265.6,
    magicalDef: 160.6,
    // v3.7 ×1.5
    attackInterval: 2.4,
  },
  growth: { hp: 70, attack: 6, physicalDef: 2.4, magicalDef: 0.9 },
  talent:
    "\u81EA\u8EAB\u6BCF\u6B21\u653B\u51FB\u670940%\u51E0\u7387\u4F7F\u4F24\u5BB3\u964D\u4F4E20%\uFF0C\u90A3\u6B21\u4F24\u5BB3\u7C7B\u578B\u53D8\u4E3A\u7EAF\u7CB9",
  skill: {
    id: "sqz_combo",
    name: "\u5723\u62F3\u8FDE\u51FB",
    tags: ["\u5207\u5165"],
    cooldown: 5,
    castTime: 0,
    description:
      "\u5BF9\u654C\u65B9\u540E\u63921\u540D\u9020\u62103\u6B21\u653B\u51FB\uFF0C\u6BCF\u6B21\u653B\u51FB\xD770%\uFF08\u540E\u6392\u65E0\u4EBA\u2192\u4E2D\u524D\u6392\uFF09",
    // v3.5: 80→95%
    damage: [{ type: "physical" /* Physical */, atkRatio: 0.7 }],
    aoe: { maxTargets: 1 },
    scriptId: "sqz_combo",
  },
};
var zq = {
  id: "zq",
  name: "\u6731\u96C0\u4E4B\u795E",
  race: "holy" /* Holy */,
  stats: {
    hp: 9085,
    // v3.7 ×1.15
    attack: 1083.8,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5
    physicalDef: 117,
    magicalDef: 454.8,
    // v3.7 ×1.5
    attackInterval: 3.6,
  },
  growth: { hp: 66, attack: 8.5, physicalDef: 1, magicalDef: 2.8 },
  talent: "\u81EA\u8EAB\u653B\u51FB\u53D8\u4E3A\u9B54\u6CD5\u4F24\u5BB3",
  skill: {
    id: "zq_flame",
    name: "\u6731\u96C0\u711A\u5929",
    tags: [],
    cooldown: 8,
    castTime: 2,
    description:
      "\u5BF9\u654C\u65B9\u968F\u673A1\u6392\u9020\u6210\u653B\u51FB\xD7180%\u9B54\u6CD5\u4F24\u5BB3\uFF0C\u5E76\u707C\u70E74s",
    // v3.15g: 150→135
    damage: [{ type: "magical" /* Magical */, atkRatio: 1.8 }],
    scriptId: "zq_flame",
  },
};
var sc = {
  id: "sc",
  name: "\u5723\u88C1\u8005",
  race: "holy" /* Holy */,
  stats: {
    hp: 13224,
    // v3.7 ×1.15 // v3.5: 圣职者加强
    attack: 751.7,
    // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15
    physicalDef: 401.4,
    magicalDef: 393.9,
    // v3.7 ×1.5
    attackInterval: 3.5,
  },
  growth: { hp: 90, attack: 6.4, physicalDef: 3.6, magicalDef: 2.4 },
  talent:
    "\u654C\u65B9\u573A\u4E0A\u6BCF\u5B58\u57281\u540D\u62E5\u6709\u589E\u76CA\u72B6\u6001\u7684\u5355\u4F4D\uFF0C\u81EA\u8EAB\u83B7\u5F976%\u4F24\u5BB3\u51CF\u514D",
  skill: {
    id: "sc_judge",
    name: "\u5BA1\u5224\u4E4B\u5149",
    tags: [],
    cooldown: 11,
    castTime: 2,
    description:
      "\u5BF9\u6700\u8FD19s\u7D2F\u8BA1\u4F24\u5BB3\u6700\u9AD8\u654C\u4EBA: \u6C89\u9ED8+\u6BCF\u79D2\u81EA\u8EAB\u653B\u51FB\xD735%\u7EAF\u7CB9\u6301\u7EED4s\uFF1B\u76EE\u6807\u6709\u589E\u76CA\u5219\u7528\u76EE\u6807\u653B\u51FB\u529B\u8BA1\u7B97\uFF0C\u6548\u679C\u7ED3\u675F\u540E\u6E05\u9664\u5176\u5168\u90E8\u589E\u76CA",
    scriptId: "sc_judge",
  },
};
var xd = {
  id: "xd",
  name: "\u6B89\u9053\u8005",
  race: "holy" /* Holy */,
  stats: {
    hp: 7520,
    // v3.7 ×1.15
    attack: 1048.4,
    // v3.4 R5 成长 7→6: 454.4+6×99（1级base不变） // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强
    physicalDef: 168.5,
    magicalDef: 252.8,
    // v3.7 ×1.5
    attackInterval: 3,
  },
  growth: { hp: 60, attack: 6, physicalDef: 1.5, magicalDef: 1.5 },
  // v3.4 R5 7.0→6.0
  talent:
    "\u6BCF\u5F53\u53CB\u65B9\u89D2\u8272\u9635\u4EA1\uFF0C\u7ED9\u4E88\u654C\u65B9\u5168\u4F53\u81EA\u8EAB\u653B\u51FB\xD730%\u7EAF\u7CB9\uFF0C\u6211\u65B9\u5269\u4F59\u5355\u4F4D\u6062\u590D\u6700\u5927\u751F\u547D\xD75%",
  // P2,
  skill: {
    id: "xd_sacrifice",
    name: "\u727A\u7272",
    tags: ["\u5632\u8BBD"],
    cooldown: 8,
    castTime: 0,
    description:
      "\u4F7F\u654C\u65B9\u968F\u673A1\u540D\u9020\u6210\u4F24\u5BB3-20%\uFF0C\u6BCF\u79D2\u53D7\u5230\u76EE\u6807\u81EA\u8EAB\u9632\u5FA1\u603B\u548C\xD720%\u7EAF\u7CB9\uFF0C\u6301\u7EED4s\uFF1B\u81EA\u8EAB\u9635\u4EA1\u540E\u4ECD\u53EF\u53D1\u52A8\uFF0C\u51B7\u5374+100%\u4E14\u65E0\u964D\u4F24\u6548\u679C\uFF0C\u53EA\u9020\u621025%\u4F24\u5BB3",
    scriptId: "xd_sacrifice",
  },
};
var ALL_CHARACTERS = [
  pp,
  hl,
  yl,
  hx,
  zzx,
  dxm,
  lbmx,
  mmx,
  sszs,
  bslr,
  hqs,
  mds,
  zfyx,
  lxgz,
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
  fz,
  qm,
  sq,
  qd,
  sqz,
  zq,
  sc,
  xd,
];
var SUMMON_CHARACTERS = [klb];
var CHARACTER_MAP = buildCharacterMap();
function buildCharacterMap() {
  let overrides = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) overrides = JSON.parse(raw);
  } catch {}
  return new Map(
    [...ALL_CHARACTERS, ...SUMMON_CHARACTERS].map((c) => {
      const ov = overrides[c.id];
      if (!ov) return [c.id, c];
      return [
        c.id,
        {
          ...c,
          stats: { ...c.stats, ...ov.stats },
          growth: { ...c.growth, ...ov.growth },
          talent: ov.talent ?? c.talent,
          skill: ov.skill ? { ...c.skill, ...ov.skill } : c.skill,
        },
      ];
    })
  );
}

// src/data/equipment.ts
var ALL_EQUIPMENT = [
  {
    id: "daedalus",
    name: "\u4EE3\u8FBE\u7F57\u65AF\u4E4B\u6B87",
    description:
      "\u653B\u51FB\u529B+25%\u3002\u653B\u51FB26%\u81F4\u547D\u4E00\u51FB\xD7175%\uFF08\u72EC\u7ACB\u4E8E\u66B4\u51FB\u53D6\u9AD8\uFF09",
    stats: { attackPercent: 25 },
    tags: ["fatal_strike"],
  },
  {
    id: "arcane_shield",
    name: "\u5965\u6CD5\u62A4\u76FE",
    description:
      "HP+10% \u7269\u9632+10% \u9B54\u9632+15%\u3002\u5F00\u5C40\u653B\u51FB\xD7300%\u62A4\u76FE\u3002\u6BCF300\u9B54\u4F24\u5145\u80FD1%\uFF0C\u81F4\u547D\u65F6\u51CF\u514D\u7B49\u989D\u4F24\u5BB3\u540E\u7834\u574F",
    stats: { hpPercent: 10, physicalDefPercent: 10, magicalDefPercent: 15 },
    tags: ["shield", "charge"],
  },
  {
    id: "heart",
    name: "\u6050\u9CCC\u4E4B\u5FC3",
    description:
      "\u6700\u5927HP+30%\u3002\u6BCF\u79D2\u56DE\u590D\u6700\u5927HP\xD70.6%\u3002\u5F02\u5E38\u72B6\u6001\u65F6\u56DE\u590D+50%",
    stats: { hpPercent: 30 },
    tags: ["regen"],
  },
  {
    id: "divine_rapier",
    name: "\u5723\u5251",
    description:
      "\u653B\u51FB\u529B+44%\u3002\u9635\u4EA1\u65F6\u8F6C\u79FB\u7ED9\u51FB\u6740\u8005",
    stats: { attackPercent: 44 },
    tags: ["transfer_on_kill"],
  },
  {
    id: "desolator",
    name: "\u7834\u8D25\u5927\u5251",
    description:
      "\u653B\u51FB\u529B+20%\uFF0C\u653B\u51FB\u5438\u884025%\u3002\u653B\u51FB30%\u4F7F\u76EE\u6807\u7834\u75325s",
    stats: { attackPercent: 20, lifeSteal: 25 },
    tags: ["armor_break"],
  },
  {
    id: "holy_locket",
    name: "\u5723\u7075\u62A4\u7B26",
    description:
      "HP+15% \u653B\u51FB+5% \u7269\u9632+8% \u9B54\u9632+12%\u3002\u6CBB\u7597\u6548\u679C+25%",
    stats: {
      hpPercent: 15,
      attackPercent: 5,
      physicalDefPercent: 8,
      magicalDefPercent: 12,
    },
    tags: ["heal_boost"],
  },
  {
    id: "poison_blade",
    name: "\u6DEC\u6BD2\u4E4B\u5203",
    description:
      "\u653B\u51FB\u901F\u5EA6+25%\u3002\u9020\u6210\u4F24\u5BB340%\u4E2D\u6BD25s\u3002\u653B\u51FB\u4E2D\u6BD2\u654C\u4EBA\u4F24\u5BB3+20%",
    stats: { attackSpeedPercent: 25 },
    tags: ["poison", "bonus_vs_poison"],
  },
  {
    id: "turban",
    name: "\u4E0D\u5C48\u5934\u5DFE",
    description:
      "\u6700\u5927HP+15%\u3002\u6BCF\u6B21\u5931\u53BB\u751F\u547D\u503C\u63D0\u53474%\u653B\u51FB\u4E0E6%\u9632\u5FA15s(\u53E05\u5C42)\u3002\u53CD\u51B2\u4F24\u5BB3-50%",
    stats: { hpPercent: 15 },
    tags: ["rage"],
  },
  {
    id: "black_turban",
    name: "\u9ED1\u8272\u5934\u5DFE",
    description:
      "\u653B+12% \u66B4\u51FB+15% \u547D\u4E2D+25% \u6700\u5927HP-10%\u3002\u6BCF150HP\u21921\u653B\u51FB+0.7\u9632\u5FA1",
    stats: { attackPercent: 12, critRate: 15, hitRate: 25, hpPercent: -10 },
    tags: ["hp_convert"],
  },
  {
    id: "magic_adapter",
    name: "\u9B54\u6CD5\u8C03\u8BD5\u5668",
    description:
      "\u653B\u51FB\u8F6C\u9B54\u6CD5\u4F24\u5BB3\u3002\u7269\u7406\u4F24\u5BB3-45%\uFF0C\u9B54\u6CD5\u4F24\u5BB3+16%",
    stats: {},
    tags: ["convert_magic"],
  },
  {
    id: "wave_suppressor",
    name: "\u6CE2\u52A8\u6291\u5236\u5668",
    description:
      "\u5168\u573A\u6CBB\u7597-40%\u3002\u5168\u573A\u8303\u56F4\u6280\u80FD\u4F24\u5BB3-20%",
    stats: {},
    tags: ["global_heal_reduce", "global_aoe_reduce"],
  },
  {
    id: "formation_breaker",
    name: "\u9635\u578B\u7834\u574F\u5668",
    description:
      "\u6BCF13s\uFF0C\u53CC\u65B9\u54044\u540D\u89D2\u8272\u968F\u673A\u6253\u4E71\u4F4D\u7F6E",
    stats: {},
    tags: ["shuffle"],
  },
  {
    id: "dragon_heart",
    name: "\u9F99\u4E4B\u5FC3\u810F",
    description:
      "\u6280\u80FD\u8D77\u59CB\u51B7\u5374-50%\u3002\u9996\u4E2A\u6280\u80FD\u4F24\u5BB3+50%\uFF0C\u4E4B\u540E\u7834\u574F",
    stats: {},
    tags: ["cd_reduce", "first_skill_boost"],
  },
  {
    id: "bone_gnaw",
    name: "\u788E\u9AA8\u5F29",
    description:
      "\u653B\u51FB\u529B+20%\u3002\u653B\u51FB\u65E0\u89C635%\u57FA\u7840\u9632\u5FA1",
    stats: { attackPercent: 20 },
    tags: ["ignore_def"],
  },
  {
    id: "battle_aid",
    name: "\u6218\u6597\u4E92\u52A9\u5668",
    description:
      "\u76F8\u90BB\u53CB\u65B9+10%\u653B\u51FB+15%\u9632\u5FA1\u3002\u81EA\u8EABHP<50%\u65F6\u7834\u574F",
    stats: {},
    tags: ["adjacent_buff"],
  },
  {
    id: "victory_horn",
    name: "\u80DC\u5229\u53F7\u89D2",
    description:
      "\u6211\u65B9\u5B58\u6D3B>\u654C\u65B9\u65F6\uFF1A\u5168\u961F+10%\u653B\u51FB+15%\u653B\u901F",
    stats: {},
    tags: ["advantage_buff"],
  },
  {
    id: "cursed_tome",
    name: "\u8BC5\u5492\u4E4B\u4E66",
    description:
      "\u4F24\u5BB3-10% \u6CBB\u7597-25%\u3002\u8BC5\u5492\u65F6\u6BCF\u79D2-2%HP\u3002\u88AB\u51FB\u6740\u540E\u8F6C\u79FB\u7ED9\u51FB\u6740\u8005",
    stats: {},
    tags: ["curse_transfer"],
  },
  {
    id: "demon_slayer",
    name: "\u65A9\u9B54\u5251",
    description:
      "\u9B54\u6CD5\u4F24\u5BB3-50%\u3002\u53D7\u9B54\u6CD5\u4F24\u5BB3\u2192+3%\u653B\u51FB+3%\u9B54\u96327s\u3002\u653B\u51FB40%\u964D\u654C\u6280\u80FD\u4F24\u5BB3-40%4s",
    stats: {},
    tags: ["anti_mage"],
  },
  {
    id: "hard_helm",
    name: "\u575A\u786C\u5934\u76D4",
    description:
      "HP+15% \u7269\u9632+45%\u3002\u53D7\u7269\u7406\u4F24\u5BB3\u53CD\u5F3920%\u539F\u59CB\u4F24\u5BB3",
    stats: { hpPercent: 15, physicalDefPercent: 45 },
    tags: ["thorns"],
  },
  {
    id: "attention_hat",
    name: "\u77A9\u76EE\u5934\u9970",
    description:
      "\u53D7\u5230\u653B\u51FB\u51E0\u7387+50%\u3002HP<60%\u65F6\u89E6\u53D1\uFF1A\u5176\u4ED6\u53CB\u65B9\u6062\u590D\u81EA\u8EAB\u5931\u53BBHP\xD710%\u3002\u4E4B\u540E\u7834\u574F",
    stats: {},
    tags: ["taunt", "sacrifice"],
  },
  {
    id: "dwarf_goggles",
    name: "\u7F29\u5C0F\u62A4\u955C",
    description:
      "\u95EA\u907F\u7387+15%\u3002\u53D7\u5230\u653B\u51FB\u51E0\u7387-35%\u3002\u6218\u6597\u5F00\u59CB15s\u540E\u7834\u574F",
    stats: { evasionPercent: 15 },
    tags: ["evasion", "expire"],
  },
  {
    id: "golden_staff",
    name: "\u91D1\u7B8D\u68D2",
    description:
      "\u653B\u51FB\u901F\u5EA6+20% \u547D\u4E2D\u7387+50%\u3002\u653B\u51FB40%\u9644\u52A0\u81EA\u8EAB\u653B\u51FB\xD720%\u9B54\u6CD5\u4F24\u5BB3",
    stats: { attackSpeedPercent: 20, hitRate: 50 },
    tags: ["bonus_magic_dmg"],
  },
];
var EQUIPMENT_MAP = new Map(ALL_EQUIPMENT.map((e) => [e.id, e]));

// src/data/lines.ts
var ALL_LINES = {
  pp: {
    attack: ["\u62F1\u4F60\u4E00\u4E0B\u{1F43D}"],
    skill: ["\u5F00\u59CB\u5348\u7761\u{1F4A4}"],
    talent: ["\u7761\u5F97\u771F\u9999"],
    death: ["\u628A\u6211\u6253\u5012\u4E86\u2026\u{1F4A4}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u6B8B\u2026\u{1F494}"],
  },
  hl: {
    attack: ["\u9876\uFF01"],
    skill: ["\u4F60\u6210\u529F\u6FC0\u6012\u6211\u4E86\uFF01\u{1F4A2}"],
    talent: ["\u90FD\u7ED9\u4FFA\u95ED\u5634\uFF01\u{1F4E2}"],
    death: ["\u6211\u4E0D\u670D\u2026"],
    allyDeath: ["\u4E89\u738B\u4F4D\u8F93\u4E86\u2026"],
  },
  yl: {
    attack: ["\u722A\u51FB\uFF01"],
    skill: [
      "\u6708\u5149\u4E0B\uFF0C\u65E0\u4EBA\u80FD\u89C1\u6211\u{1F319}",
      "\u55F7\u545C\uFF5E\u5F97\u624B\u4E86\uFF01",
    ],
    death: ["\u6708\u5149\u7167\u4E0D\u5230\u6211\u4E86\u2026\u{1F319}"],
    allyDeath: ["\u72FC\u7FA4\u5185\u6597\u2026"],
  },
  hx: {
    attack: ["\u62CD\uFF01"],
    skill: [
      "\u864E\u5578\u9707\u5C71\u6797\uFF01\u{1F405}",
      "\u4E0B\u4E00\u4E2A\uFF01",
    ],
    talent: [
      "\u5144\u5F1F\u7684\u8840\uFF0C\u6211\u6765\u8BA8\u56DE\uFF01\u{1F621}",
    ],
    death: ["\u864E\u843D\u5E73\u9633\u2026\u{1F63F}"],
    allyDeath: ["\u5144\u5F1F\u2026\u4F60\u2026"],
  },
  zzx: {
    attack: ["\u6572\u4F60\u8111\u888B\u{1F34C}"],
    skill: ["\u6211\u6765\u6307\u70B9\u4F60\uFF01"],
    talent: ["\u90FD\u7ED9\u6211\u5B89\u9759\uFF01\u{1F9E0}"],
    death: ["\u667A\u529B\u4E5F\u6551\u4E0D\u4E86\u6211\u2026\u{1F9E0}"],
    allyDeath: ["\u7329\u7329\u76F8\u60DC\u2026\u{1F34C}"],
  },
  dxm: {
    attack: ["\u8E39\uFF01"],
    skill: [
      "\u522B\u6015\uFF0C\u6709\u6211\u5728\uFF01\u{1F48A}",
      "\u52A0\u5F3A\u7597\u6548\uFF01\u6CBB\u7597\u91CF+[\u6570\u503C]\u2728",
    ],
    death: ["\u9A6C\u5931\u524D\u8E44\u2026\u{1F40E}"],
    allyDeath: ["\u8349\u539F\u4E0D\u518D\u2026"],
  },
  lbmx: {
    attack: ["\u718A\u638C\uFF01"],
    skill: ["\u5927\u5730\u98A4\u6296\u5427\uFF01"],
    talent: ["\u90FD\u671D\u6211\u6765\uFF01\u{1F43B}"],
    death: ["\u5927\u5730\u4E5F\u62A4\u4E0D\u4E86\u6211\u2026\u{1F43B}"],
    allyDeath: ["\u718A\u738B\u4E4B\u4E89\u2026"],
  },
  ds: {
    attack: ["\u54AC\uFF01"],
    skill: [
      "\u54AC\u4F4F\u5C31\u4E0D\u653E\uFF01\u{1F981}",
      "\u8840\u7684\u5473\u9053\uFF0C\u6062\u590D[\u6570\u503C]\uFF0C\u4E5F\u662F\u8865\u836F\u3002",
    ],
    death: ["\u88AB\u56F4\u730E\u4E86\u2026\u{1F981}"],
    allyDeath: ["\u72EE\u738B\u9668\u843D\u2026"],
  },
  mmx: {
    attack: ["\u8E29\uFF01"],
    skill: ["\u78BE\u788E\u4E00\u5207\uFF01"],
    talent: ["\u5377\u8D77\u6765\uFF0C\u66F4\u786C\uFF01\u{1F418}"],
    death: ["\u8F70\u7136\u5012\u4E0B\u2026\u{1F30D}"],
    allyDeath: ["\u5DE8\u8C61\u5012\u5730\u2026\u{1F30D}"],
  },
  sszs: {
    attack: ["\u5C04\u4E2D\uFF01"],
    skill: [
      "\u522B\u60F3\u8DD1\uFF01\u{1F3F9}",
      "\u6B63\u4E2D\u9776\u5FC3\uFF01",
    ],
    death: ["\u5F13\u65AD\u4E86\u2026\u{1F3F9}"],
    allyDeath: ["\u540C\u95E8\u5BF9\u51B3\u2026"],
  },
  bslr: {
    attack: ["\u51B0\u7BAD\uFF01"],
    skill: ["\u51B0\u51BB\u4E09\u5C3A\uFF01\u2744\uFE0F"],
    talent: [
      "\u65E0\u89C6\u9632\u5FA1\uFF0C\u7834\u7532\uFF01\u2744\uFE0F",
      "\u88AB\u653B\u51FB\u2026\u5929\u8D4B\u5931\u6548\u4E86\u2026",
    ],
    death: ["\u51B0\u971C\u6D88\u878D\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u7BAD\u5BF9\u51B3\u2026"],
  },
  hqs: {
    attack: ["\u88C5\u5F39\uFF0C\u7830\uFF01"],
    skill: [
      "\u770B\u597D\u4E86\uFF0C\u4E00\u67AA\u6BD9\u547D\u{1F52B}",
      "\u7830\uFF01\u62DC\u62DC\uFF5E",
    ],
    talent: [
      "\u88AB\u76EF\u4E0A\u4E86\uFF0C\u9632\u5FA1\u62C9\u6EE1\uFF01\u{1F6E1}\uFE0F",
    ],
    death: ["\u67AA\u54D1\u706B\u4E86\u2026\u{1F52B}"],
    allyDeath: ["\u4F60\u67AA\u6CD5\u66F4\u597D\u2026"],
  },
  mds: {
    attack: ["\u86C7\u53D1\u653B\u51FB\u{1F40D}"],
    skill: ["\u51DD\u89C6\u6211\u2026\u2026\u{1F441}\uFE0F"],
    talent: ["\u53D8\u6210\u77F3\u5934\u5427\uFF01"],
    death: ["\u77F3\u5316\u4E86\u81EA\u5DF1\u2026\u{1FAA8}"],
    allyDeath: ["\u53CD\u5C04\u4E4B\u955C\uFF1F"],
  },
  zfyx: {
    attack: ["\u55D6\uFF5E"],
    skill: ["\u98CE\u4F1A\u6307\u5F15\u6211\u{1F4A8}"],
    talent: ["\u6562\u5207\u5165\uFF1F\u53CD\u51FB\uFF01\u{1F4A8}"],
    death: ["\u98CE\u505C\u4E86\u2026\u{1F4A8}"],
    allyDeath: ["\u98CE\u4E4B\u5BF9\u51B3\u2026"],
  },
  lxgz: {
    attack: ["\u62E8\u5F26\uFF01"],
    skill: ["\u6CBB\u6108\u7684\u65CB\u5F8B\u{1F3B6}"],
    talent: ["\u6253\u8D77\u7CBE\u795E\u6765\uFF01"],
    death: ["\u7434\u5F26\u65AD\u4E86\u2026\u{1F3BB}"],
    allyDeath: ["\u5F26\u6740\u672F\uFF1F"],
  },
  xjlr: {
    attack: ["\u6492\u9489\u5B50\uFF01"],
    skill: ["\u731C\u731C\u54EA\u91CC\u4F1A\u70B8\u{1F4A3}"],
    talent: ["\u554A\u54C8\uFF0C\u4E2D\u8BA1\u4E86\uFF01"],
    death: ["\u81EA\u9677\u9677\u9631\u2026\u{1F4A3}"],
    allyDeath: ["\u53CD\u9677\u9631\u2026"],
  },
  xblr: {
    attack: ["\u5DE6\u8F6E\u901F\u5C04\uFF01"],
    skill: [
      "\u897F\u90E8\u5FEB\u67AA\u624B\u6765\u54AF\u{1F920}",
      "\u8FD9\u624D\u662F\u771F\u6B63\u7684\u725B\u4ED4\uFF01",
    ],
    death: ["\u897F\u90E8\u9EC4\u660F\u2026\u{1F920}"],
    allyDeath: ["\u62D4\u67AA\u6162\u4E86\u2026"],
  },
  ldshz: {
    attack: ["\u85E4\u8513\u97AD\uFF01"],
    skill: [
      "\u68EE\u6797\u4E4B\u529B\uFF0C\u52A0\u62A4\uFF01",
      "\u81EA\u7136\u4E4B\u529B\u52A0\u62A4\u4E8E\u4F60\uFF01\u{1F33F}",
    ],
    talent: ["\u81EA\u7136\u62A4\u4F51\u7740\u6211\u{1F33F}"],
    death: ["\u68EE\u6797\u71C3\u5C3D\u4E86\u2026\u{1F33F}"],
    allyDeath: ["\u81EA\u7136\u4E4B\u529B\u4E0D\u591F\u2026"],
  },
  crzs: {
    attack: ["\u70BD\u70ED\u4E4B\u62F3\uFF01"],
    skill: ["\u5C1D\u5C1D\u70C8\u7130\u62F3\uFF01"],
    talent: ["\u70E7\u5427\uFF0C\u90FD\u70E7\u8D77\u6765\u{1F525}"],
    death: ["\u71C3\u5C3D\u4E86\u2026\u{1F525}"],
    allyDeath: ["\u70ED\u8840\u5BF9\u62FC\u2026"],
  },
  hd: {
    attack: ["\u65A9\uFF01"],
    skill: ["\u4E00\u5200\u4E24\u65AD\uFF01\u2694\uFE0F"],
    talent: ["\u89C1\u9B3C\uFF0C\u6253\u504F\u4E86\u2026"],
    death: ["\u5200\u65AD\u4E86\u2026\u2694\uFE0F"],
    allyDeath: ["\u5200\u5149\u5251\u5F71\u2026"],
  },
  fxz: {
    attack: ["\u6570\u636E\u6253\u51FB\u{1F4CA}"],
    skill: ["\u8FD9\u624D\u662F\u5B8C\u7F8E\u7684\u9635\u578B\u3002"],
    talent: ["\u8BA9\u6211\u770B\u770B\u4F60\u7684\u5F31\u70B9\u{1F50D}"],
    death: ["\u8BA1\u7B97\u7ED3\u679C\u62A5\u9519\u2026\u{1F4CA}"],
    allyDeath: ["\u66B4\u529B\u7834\u89E3\u2026"],
  },
  fdzs: {
    attack: ["\u98CE\u62F3\uFF01"],
    skill: [
      "\u75BE\u98CE\u9AA4\u96E8\uFF01\u{1F32A}\uFE0F",
      "\u547C\uFF0C\u6D3B\u52A8\u5F00\u4E86\u3002",
    ],
    talent: ["\u524D\u6392\u52A0\u6210\uFF0C\u7834\u9632\uFF01\u{1F4A8}"],
    death: ["\u98CE\u505C\u4E86\u2026\u{1F32A}\uFE0F"],
    allyDeath: ["\u62F3\u5BF9\u62F3\u5012\u4E0B\u2026"],
  },
  kzs: {
    attack: ["\u72C2\u4E71\u6325\u51FB\uFF01"],
    skill: ["\u8840\u6012\uFF01\u65E0\u4EBA\u80FD\u6321\uFF01\u{1F624}"],
    talent: ["\u8D8A\u75DB\uFF0C\u8D8A\u5F3A\uFF01\u5F53\u524D[x\u5C42]"],
    death: ["\u72C2\u6012\u5E73\u606F\u2026\u{1F624}"],
    allyDeath: ["\u66F4\u75AF\u7684\u4EBA\u2026"],
  },
  slzs: {
    attack: ["\u5723\u5149\u9524\uFF01"],
    skill: ["\u5723\u5149\u62A4\u4F53\uFF01\u{1F6E1}\uFE0F"],
    talent: ["\u9B54\u6CD5\u53CD\u566C\uFF01"],
    death: ["\u5723\u5149\u6D88\u901D\u2026\u{1F6E1}\uFE0F"],
    allyDeath: ["\u5723\u529B\u8017\u5C3D\u2026"],
  },
  zqz: {
    attack: ["\u76F4\u62F3\u653B\u51FB\uFF01"],
    skill: ["\u5403\u6211\u4E00\u8BB0\u91CD\u62F3\uFF01\u{1F44A}"],
    talent: [
      "\u7834\u7532\u4E00\u51FB\uFF01\u84C4\u6EE1\u529B\u4E86\uFF01\u{1F44A}",
    ],
    death: [
      "\u62F3\u5934\u4E5F\u6253\u4E0D\u5012\u6240\u6709\u4EBA\u2026\u{1F44A}",
    ],
    allyDeath: ["\u94C1\u62F3\u5BF9\u51B3\u2026"],
  },
  jdds: {
    attack: ["\u51B3\u6597\u523A\uFF01"],
    skill: ["\u4F60\u7684\u529B\u91CF\u5F52\u6211\u4E86\uFF01\u{1F4AA}"],
    talent: ["\u8FD9\u70B9\u4EE3\u4EF7\u7B97\u4EC0\u4E48\u3002"],
    death: ["\u88AB\u5077\u88AD\u51FB\u8D25\u4E86\u2026"],
    allyDeath: ["\u51B3\u6597\u843D\u8D25\u2026"],
  },
  xdds: {
    attack: ["\u9B54\u6CD5\u98DE\u5F39\uFF01"],
    skill: [
      "\u706B\u7403\u6765\u55BD\uFF01\u{1F525}",
      "\u9668\u77F3\u5929\u964D\uFF01",
    ],
    death: ["\u706B\u7403\u7184\u706D\u4E86\u2026\u{1F525}"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u566C\u2026"],
  },
  sjsn: {
    attack: ["\u51B0\u9525\uFF01"],
    skill: ["\u51BB\u7ED3\u5427\uFF01\u2744\uFE0F"],
    death: ["\u51B0\u6676\u788E\u88C2\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u706B\u76F8\u514B\u2026"],
  },
  bmxz: {
    attack: ["\u9A6C\u8E44\u8E0F\uFF01"],
    skill: [
      "\u84C4\u529B\u4E2D\u2026\u2026\u26A1",
      "\u767D\u9A6C\u5954\u817E\uFF01\u5168\u573A\u8E0F\u5E73\uFF01\u26A1",
    ],
    talent: ["\u51CF\u51B7\u5374\uFF01\u7EE7\u7EED\u65BD\u6CD5\uFF01\u26A1"],
    death: ["\u767D\u9A6C\u5931\u8E44\u2026\u{1F434}"],
    allyDeath: ["\u7A7A\u95F4\u6298\u53E0\u2026"],
  },
  srm: {
    attack: ["\u68CD\u68D2\u6572\uFF01"],
    skill: [
      "\u70B8\u88C2\u5427\uFF01\u{1F4A5}",
      "\u518D\u6765\u4E00\u6B21\uFF01\u518D\u6765\uFF01",
      "\u518D\u6765\u4E24\u6B21\uFF01\u518D\u6765\uFF01\u518D\u6765\uFF01",
    ],
    death: ["\u8FD9\u6B21\u6CA1\u70B8\u5230\u4EBA\u2026\u{1F4A5}"],
    allyDeath: ["\u6CD5\u672F\u5BF9\u8F70\u5931\u8D25\u2026"],
  },
  ynfs: {
    attack: ["\u865A\u65E0\u4E4B\u89E6\u{1F47B}"],
    skill: ["\u5F52\u4E8E\u865A\u65E0\uFF01"],
    talent: ["\u4F60\u5148\u79BB\u5F00\u4E00\u4F1A\u513F\u{1F6AA}"],
    death: ["\u5F52\u4E8E\u865A\u65E0\u2026\u{1F47B}"],
    allyDeath: ["\u6E6E\u706D\u5BF9\u6E6E\u706D\u2026"],
  },
  syz: {
    attack: ["\u5723\u5149\u5F39\uFF01"],
    skill: ["\u795E\u8BF4\uFF0C\u4F60\u6682\u65F6\u4E0D\u4F1A\u6B7B\u3002"],
    talent: ["\u613F\u795E\u4FDD\u4F51\u4F60\u2728"],
    death: ["\u795E\u8C15\u5931\u6548\u4E86\u2026\u2728"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u5236\u2026"],
  },
  zs: {
    attack: ["\u95EA\u7535\u94FE\uFF01"],
    skill: [
      "\u96F7\u9706\u4E07\u94A7\uFF01\u26A1",
      "\u53EF\u6076\uFF0C\u88AB\u5E72\u6270\u4E86\u3002",
    ],
    death: ["\u96F7\u9706\u7184\u706D\u4E86\u2026\u26A1"],
    allyDeath: ["\u95EA\u7535\u53CD\u566C\u2026"],
  },
  xjl: {
    attack: ["\u5149\u7403\uFF01"],
    skill: [
      "\u6211\u4EEC\u8FDE\u5728\u4E00\u8D77\u5566\uFF01\u{1F517}",
      "\u6211\u6765\u625B\uFF01",
    ],
    death: ["\u5149\u8292\u6D88\u6563\u4E86\u2026\u2728"],
    allyDeath: ["\u9B54\u6CD5\u53CD\u566C\u2026"],
  },
  wqqs: {
    attack: ["\u5E7D\u7075\u523A\uFF01"],
    skill: ["\u53D7\u8BC5\u5492\u5427\uFF01"],
    death: ["\u9B42\u98DE\u9B44\u6563\u2026\u{1F47B}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u98DF\u2026"],
    talent: ["\u865A\u5F71\u95EA\u8FC7\u2026\u{1F47B}"],
  },
  wlgyz: {
    attack: ["\u97F3\u6CE2\u51B2\u51FB\u{1F3A4}"],
    skill: [
      "\u4EA1\u8005\u4E4B\u6B4C\u{1F4DC}",
      "\u554A\u554A\uFF0C\u522B\u6253\u6270\u6211\u5531\u6B4C\uFF01",
    ],
    death: ["\u6B4C\u58F0\u505C\u4E86\u2026\u{1F3B5}"],
    allyDeath: ["\u4EA1\u7075\u5B89\u9B42\u66F2\u2026"],
    talent: ["\u4EA1\u7075\u4E4B\u821E\u2026\u{1F3B5}"],
  },
  kldd: {
    attack: ["\u9AA8\u5203\u65A9\uFF01"],
    skill: ["\u51A5\u706B\u711A\u8EAB\uFF01"],
    talent: [
      "\u8D77\u6765\u5427\uFF0C\u6211\u7684\u4EC6\u4ECE\uFF01\u{1F480}",
      "\u9AA8\u5934\u4E00\u6B6A\u2026\u{1F9B4}",
    ],
    death: ["\u9AA8\u5934\u6563\u67B6\u4E86\u2026\u{1F9B4}"],
    allyDeath: ["\u9AB7\u9AC5\u738B\u4E89\u9738\u2026"],
  },
  klb: {
    attack: ["\u5494\u5494\u5494\u2026\u2026"],
    death: ["\u788E\u4E86\u2026\u{1F480}"],
    allyDeath: ["\u540C\u7C7B\u76F8\u6B8B\u2026"],
  },
  yammxz: {
    attack: ["\u6697\u5F71\u5203\uFF01"],
    skill: ["\u6697\u5F71\u6362\u4F4D\uFF01"],
    death: ["\u6697\u5F71\u6D88\u6563\u4E86\u2026\u{1F311}"],
    allyDeath: ["\u6697\u5F71\u541E\u566C\u2026"],
    talent: ["\u6697\u5F71\u95EA\u907F\u2026\u{1F311}"],
  },
  dyq: {
    attack: ["\u6495\u54AC\uFF01"],
    skill: ["\u8FFD\u730E\u5F00\u59CB\uFF01\u{1F415}\u200D\u{1F9BA}"],
    talent: [
      "\u81F4\u547D\u4E00\u51FB\uFF01\u{1F415}",
      "\u6076\u72AC\u95EA\u8EAB\u2026\u{1F415}",
    ],
    death: ["\u730E\u72AC\u7EC8\u88AB\u730E\u2026\u{1F415}"],
    allyDeath: ["\u51A5\u72AC\u76F8\u98DF\u2026"],
  },
  hyz: {
    attack: ["\u7075\u9B42\u51B2\u51FB\uFF01"],
    skill: [
      "\u91CA\u653E[x]\u5C42\u9B42\u80FD\uFF0C\u7075\u9B42\u62A4\u76FE\u542F\u52A8\uFF01",
    ],
    talent: [
      "\u7075\u9B42\u5728\u4F4E\u8BED\u2026\u2026",
      "\u7075\u9B42\u6F02\u79FB\u2026\u{1F47B}",
    ],
    death: ["\u7075\u9B42\u5F15\u6E21\u5931\u8D25\u2026\u{1F47B}"],
    allyDeath: ["\u5F15\u6E21\u8005\u53CD\u88AB\u5F15\u6E21\u2026\u{1F47B}"],
  },
  mrsz: {
    attack: ["\u672B\u65E5\u65A9\uFF01"],
    skill: [
      "\u4F60\u7684\u672B\u65E5\u5230\u4E86\uFF01\u2620\uFE0F",
      "\u8FD8\u4E0D\u5230\u65F6\u5019\u2026\u2026",
    ],
    death: ["\u672B\u65E5\u5230\u4E86\u2026\u2620\uFE0F"],
    allyDeath: ["\u672B\u65E5\u964D\u4E34\u81EA\u8EAB\u2026"],
    talent: ["\u672B\u65E5\u56DE\u907F\u2026\u2620\uFE0F"],
  },
  swxz: {
    attack: ["\u7075\u9B42\u97AD\u7B1E\uFF01"],
    skill: [
      "\u7075\u9B42\uFF0C\u7ED9\u6211\uFF01\u{1F56F}\uFE0F",
      "\u4F60\u4F1A\u540E\u6094\u7684\u3002",
    ],
    death: [
      "\u9884\u8A00\u5230\u4E86\uFF0C\u6CA1\u8EB2\u8FC7\u2026\u{1F56F}\uFE0F",
    ],
    allyDeath: ["\u6B7B\u4EA1\u5148\u77E5\u4EA6\u6B7B\u2026"],
    talent: ["\u65E9\u6709\u9884\u77E5\u2026\u{1F56F}\uFE0F"],
  },
  hlyl: {
    attack: ["\u706B\u7403\u5410\u606F\uFF01"],
    skill: [
      "\u70E7\u5C3D\u4E00\u5207\uFF01\u{1F409}\u{1F525}",
      "\u8FD9\u706B\u4E0D\u4F1A\u706D\u3002",
    ],
    death: ["\u9F99\u606F\u7184\u706D\u4E86\u2026\u{1F409}"],
    allyDeath: ["\u9F99\u65CF\u5185\u6218\u2026\u{1F409}"],
  },
  bsxl: {
    attack: ["\u51B0\u971C\u722A\uFF01"],
    skill: [
      "\u5BD2\u6C14\u903C\u4EBA\u2744\uFE0F",
      "\u51BB\u6210\u51B0\u5757\uFF01",
    ],
    death: ["\u51B0\u971C\u878D\u5316\u2026\u2744\uFE0F"],
    allyDeath: ["\u51B0\u706B\u5BF9\u51B3\u2026"],
  },
  xyfl: {
    attack: ["\u8840\u7FFC\u6247\uFF01"],
    skill: ["\u6DF7\u4E71\u5427\uFF01\u{1F300}"],
    death: ["\u8840\u7FFC\u5782\u843D\u2026\u{1FA78}"],
    allyDeath: ["\u9F99\u7FFC\u5BF9\u51B3\u2026"],
  },
  hbfl: {
    attack: ["\u5BD2\u6C14\u5410\u606F\uFF01"],
    skill: ["\u51B0\u5C01\u4E2D\u75CA\u6108\u{1F9CA}"],
    death: ["\u51B0\u5C01\u88AB\u7834\u2026\u{1F9CA}"],
    allyDeath: ["\u51B0\u9F99\u76F8\u4E89\u2026"],
  },
  bjl: {
    attack: ["\u9F99\u5A01\u91CD\u51FB\uFF01"],
    skill: ["\u6495\u88C2\uFF01"],
    talent: ["\u4F60\u4EEC\u592A\u5F31\u4E86\uFF01\u{1F451}"],
    death: ["\u66B4\u541B\u9668\u843D\u2026\u{1F451}"],
    allyDeath: ["\u7BE1\u4F4D\u8005\u2026"],
  },
  xcl: {
    attack: ["\u661F\u5C18\u5C04\u51FB\uFF01"],
    skill: ["\u7FA4\u661F\u5760\u843D\uFF01"],
    talent: ["\u6EDA\u51FA\u6211\u7684\u6218\u573A\uFF01\u2B50"],
    death: ["\u661F\u8FB0\u5760\u843D\u2026\u2B50"],
    allyDeath: ["\u9F99\u661F\u76F8\u649E\u2026"],
  },
  lyz: {
    attack: ["\u9F99\u541F\u6CE2\uFF01"],
    skill: [
      "\u9F99\u4E4B\u541F\u5531\u{1F3B5}",
      "\u518D\u6218\u7247\u523B\uFF01",
    ],
    death: ["\u9F99\u541F\u6C89\u5BC2\u4E86\u2026\u{1F3B5}"],
    allyDeath: ["\u9F99\u65CF\u9AD8\u6B4C\u2026"],
  },
  dl: {
    attack: ["\u9F99\u5C3E\u626B\uFF01"],
    skill: ["\u5927\u5730\u5D29\u88C2\uFF01\u{1F30D}"],
    talent: ["\u9F99\u76AE\u53CD\u4F24\uFF01\u{1F6E1}\uFE0F"],
    death: ["\u5730\u9F99\u5165\u571F\u2026\u{1F30D}"],
    allyDeath: ["\u5730\u9F99\u4E89\u9738\u2026"],
  },
  aysl: {
    attack: ["\u6697\u5F71\u722A\uFF01"],
    skill: ["\u6697\u5F71\u7A81\u88AD\u{1F5E1}\uFE0F"],
    talent: ["\u4F60\u7684\u6CBB\u7597\uFF0C\u65E0\u6548\u4E86\u3002"],
    death: ["\u6697\u5F71\u88AB\u5149\u7167\u4EAE\u2026\u{1F311}"],
    allyDeath: ["\u6697\u5F71\u5BF9\u51B3\u2026"],
  },
};

// src/engine/battle.ts
var nextUnitId = 0;
var nextLogId = 0;
function pfx2(u) {
  const r = u.def.race;
  const tag =
    {
      beast: "\u517D",
      hunter: "\u730E",
      warrior: "\u6218",
      mage: "\u6CD5",
      undead: "\u4EA1",
      dragon: "\u9F99",
      holy: "\u5723",
    }[r] || r;
  const label = u.summonIndex ? `${u.def.name}#${u.summonIndex}` : u.def.name;
  return `${u.team === "ally" ? "\u{1F7E6}" : "\u{1F7E5}"}[${tag}]${label}`;
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
    line = line
      .replace("[\u89D2\u8272\u540D]", targetName)
      .replace("[\u76EE\u6807]", targetName);
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
    basePhysicalDef: def.stats.physicalDef,
    baseMagicalDef: def.stats.magicalDef,
    cooldownRemaining: def.skill.cooldown * 0.9 * (0.85 + Math.random() * 0.3),
    // 起始冷却±15%随机，避免镜像先手固定
    castTimer: 0,
    isCasting: false,
    attackTimer: def.stats.attackInterval * (0.5 + Math.random() * 0.5),
    isDead: false,
    statuses: [],
    autoAttackTargetId: void 0,
    evasion: def.id === "sszs" ? 0.4 : 0,
    // v3.0: 25→40%
    hitRateMod: def.id === "hd" ? -0.15 : 0,
    tenacity: row === 0 ? 5 : 0,
    // Front row +5% tenacity (v2.0)
  };
}
function getAlive(state, team) {
  return state.units.filter(
    (u) => !u.isDead && (team === void 0 || u.team === team)
  );
}
function moveToRandomEmpty(unit, state) {
  const teamUnits = state.units.filter(
    (u) => u.team === unit.team && !u.isDead
  );
  const occupied = new Set(teamUnits.map((u) => `${u.row},${u.col}`));
  const empty = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (!occupied.has(`${r},${c}`)) empty.push({ row: r, col: c });
    }
  }
  if (empty.length > 0) {
    const dest = empty[Math.floor(Math.random() * empty.length)];
    unit.row = dest.row;
    unit.col = dest.col;
    return true;
  }
  return false;
}
function getAttackableEnemies(state, selfTeam) {
  return state.units.filter((u) => {
    if (u.team === selfTeam || u.isDead) return false;
    if (u.def.id !== "kldd") return true;
    return !state.units.some(
      (x) =>
        x.team === u.team && x.isSummon && x.summonerId === u.id && !x.isDead
    );
  });
}
function getEnemies(state, selfTeam) {
  return getAttackableEnemies(state, selfTeam);
}
function pick2x2(enemies) {
  const r = Math.random() < 0.5 ? 0 : 1;
  const c = Math.random() < 0.5 ? 0 : 1;
  return enemies.filter(
    (e) => e.row >= r && e.row <= r + 1 && e.col >= c && e.col <= c + 1
  );
}
function pickTarget2(enemies, rowPref, excludeStealth = true) {
  if (excludeStealth) {
    enemies = enemies.filter(
      (e) => !e.statuses?.some((s) => s.type === "stealth" /* Stealth */)
    );
  }
  enemies = enemies.filter((e) => !e._ymfsLeft);
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
  const chances = hasFront
    ? [
        { row: 0 /* Front */, c: 60 },
        { row: 1 /* Mid */, c: 25 },
        { row: 2 /* Back */, c: 15 },
      ]
    : [
        { row: 1 /* Mid */, c: 65 },
        { row: 2 /* Back */, c: 35 },
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
  const makeUnits = (chars, team) =>
    chars
      .map((c) => {
        const def = CHARACTER_MAP.get(c.charId);
        return def
          ? createUnit(def, 100, team, c.row, c.col ?? 0, c.equipmentId)
          : null;
      })
      .filter(Boolean);
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
          if (effect.attackSpeedBonus)
            u.attackSpeedBonus =
              (u.attackSpeedBonus || 0) + effect.attackSpeedBonus / 100;
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
        const baseDr = count >= 4 ? 0.12 : 0.08;
        const openMult = count >= 4 ? 2 : 2;
        const openDur = count >= 4 ? 10 : 6;
        const openDr = baseDr * openMult;
        for (const u of us) {
          if (u.def.race === "dragon") {
            u.cooldownRemaining *= cdMult;
            u.statuses.push({
              type: "inspire" /* Inspire */,
              remainingSeconds: openDur,
              stacks: 1,
              value: 1 - openDr,
              // e.g. 0.85 for 15% DR (3x5%)
            });
            u.damageReduction = (u.damageReduction || 0) + baseDr;
          }
        }
      }
      if (race === "beast") {
        const tenacityVal = count >= 4 ? 35 : count >= 3 ? 20 : 10;
        if (tenacityVal > 0) {
          for (const u of us) {
            if (u.def.race === "beast") {
              u.tenacity = (u.tenacity || 0) + tenacityVal;
            }
          }
        }
      }
      if (race === "mage") {
        const cdReduce = count >= 4 ? 0.09 : count >= 3 ? 0.07 : 0;
        if (cdReduce > 0) {
          for (const u of us) {
            if (u.def.race === "mage") {
              u.cooldownRemaining = Math.max(
                0,
                u.cooldownRemaining * (1 - cdReduce)
              );
            }
          }
        }
      }
    }
  };
  apply(allies);
  apply(enemies);
  const applyBeastTalents = (us) => {
    const team = us[0]?.team;
    const opp = team === "ally" ? "enemy" : "ally";
    const oppUnits = state.units.filter((x) => x.team === opp);
    const hl2 = us.find((u) => u.def.id === "hl" && !isRuined(u));
    if (hl2) {
      let totalRed = 0;
      const hlLv = hl2.level || 100;
      const roarPct = 0.3;
      const roarDur = 5;
      for (const e of oppUnits) {
        const redAtk = Math.floor(e.currentAttack * roarPct);
        e.currentAttack -= redAtk;
        e._hlRoarAtk = (e._hlRoarAtk || 0) + roarPct;
        e._hlRoarExpire = state.time + roarDur;
        e._hlRoarStage2 = true;
        totalRed += redAtk;
      }
      trackTalent(
        state,
        hl2.id,
        "\u6012\u543C(\u964D\u653B30%\xD75s\u219215%\xD78s)",
        totalRed * 13,
        "buff"
      );
      state.battleLog.push({
        time: 0,
        text: `\u{1F4E2} ${hl2.def.name} \u6012\u543C: \u654C\u65B9\u5168\u4F53\u653B\u51FB-30%\xD75s\uFF0C\u4E4B\u540E-15%\xD78s`,
        type: "status",
      });
    }
    const yl2 = us.find((u) => u.def.id === "yl" && !isRuined(u));
    if (yl2) {
      for (const b of us.filter((u) => u.def.race === "beast")) {
        b._ylRoarMult = (b._ylRoarMult || 1) * 1.3;
      }
      const ylUnit = us.find((u) => u.def.id === "yl" && !isRuined(u));
      if (ylUnit) {
        const totalBonus = us
          .filter((u) => u.def.race === "beast")
          .reduce((s, b) => s + Math.floor(b.currentAttack * 0.3 * 4), 0);
        trackTalent(
          state,
          ylUnit.id,
          "\u72FC\u543C(\u5F00\u573A+30%\u653B)",
          totalBonus,
          "buff"
        );
      }
      state.battleLog.push({
        time: 0,
        text: `\u{1F43A} ${yl2.def.name} \u72FC\u543C: \u5168\u517D\u65CF\u653B\u51FB+30%`,
        type: "status",
      });
    }
    const zzx2 = us.find((u) => u.def.id === "zzx" && !isRuined(u));
    if (zzx2) {
      let blocked = 0;
      for (const e of oppUnits) {
        if (e.row === zzx2.row) {
          e.statuses.push({
            type: "ruin" /* Ruin */,
            remainingSeconds: 8,
            stacks: 1,
          });
          e.statuses.push({
            type: "silence" /* Silence */,
            remainingSeconds: 8,
            stacks: 1,
          });
          blocked++;
        }
      }
      trackTalent(state, zzx2.id, "\u5C01\u9501(8s)", blocked * 8, "control");
      state.battleLog.push({
        time: 0,
        text: `\u{1F9E0} ${zzx2.def.name} \u5C01\u9501: \u654C\u65B9\u540C\u9635\u578B\u6280\u80FD\u7981\u75288s`,
        type: "status",
      });
    }
    const dxm2 = us.find((u) => u.def.id === "dxm" && !isRuined(u));
    if (dxm2) {
      const benefited = us.filter(
        (u) => u.def.race === "beast" && u.row === dxm2.row
      );
      for (const b of benefited) {
        b.cooldownRemaining = Math.max(0, b.cooldownRemaining * 0.88);
      }
      trackTalent(
        state,
        dxm2.id,
        "\u540C\u6392CD-18%",
        benefited.length,
        "count"
      );
      state.battleLog.push({
        time: 0,
        text: `\u{1F434} ${dxm2.def.name} \u540C\u6392\u517D\u65CF\u6280\u80FDCD-18%`,
        type: "status",
      });
    }
    const lbmx2 = us.find((u) => u.def.id === "lbmx" && !isRuined(u));
    if (lbmx2) {
      const front = oppUnits.filter((e) => e.row === 0 && !e.isDead);
      for (const e of front) {
        e._tauntTarget = lbmx2.id;
        e._tauntExpire = state.time + 5;
        e.statuses.push({
          type: "silence" /* Silence */,
          remainingSeconds: 5,
          stacks: 1,
        });
      }
      trackTalent(
        state,
        lbmx2.id,
        "\u5486\u54EE\u5632\u8BBD(5s)",
        front.length * 5,
        "control"
      );
      state.battleLog.push({
        time: 0,
        text: `\u{1F43B} ${lbmx2.def.name} \u5486\u54EE: \u5632\u8BBD\u654C\u65B9\u524D\u63925s`,
        type: "status",
      });
    }
  };
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
        u.attackSpeedBonus =
          (u.attackSpeedBonus || 0) + s.attackSpeedPercent / 100;
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
    talentDamage: 0,
    talentHealing: 0,
    buffValue: 0,
    controlSeconds: 0,
    skillInterrupts: 0,
    hitsTaken: 0,
    critsTaken: 0,
    survivalTime: 0,
  }));
  const state = {
    trackTalent,
    // v2.10 天赋埋点 (供 SkillRegistry handler 使用)
    units,
    time: 0,
    phase: "fighting",
    turnEvents: [],
    battleLog: [
      {
        time: 0,
        text: "\u2694\uFE0F \u6218\u6597\u5F00\u59CB\uFF01",
        type: "system",
      },
    ],
    stats,
    skillStats: {},
    bonds: {
      ally: calcBonds(allies),
      enemy: calcBonds(enemies),
    },
  };
  applyBeastTalents(allies);
  applyBeastTalents(enemies);
  const applyHuiDao = (us) => {
    for (const hd2 of us.filter((u) => u.def.id === "hd" && !isRuined(u))) {
      hd2.currentAttack = Math.floor(hd2.currentAttack * 1.15);
      hd2._hdHitChance = 0.85;
      state.battleLog.push({
        time: 0,
        text: `\u{1F5E1} ${hd2.def.name} \u5929\u8D4B: \u653B\u51FB+15% \u547D\u4E2D-15%`,
        type: "status",
      });
    }
  };
  applyHuiDao(allies);
  applyHuiDao(enemies);
  const summonSkeletons = (us) => {
    const kldd2 = us.find((u) => u.def.id === "kldd" && !isRuined(u));
    if (!kldd2) return;
    const skelDef = CHARACTER_MAP.get("klb");
    if (!skelDef) return;
    for (let i = 0; i < 3; i++) {
      const sk = createUnit(skelDef, 100, kldd2.team, kldd2.row, kldd2.col);
      sk.isSummon = true;
      sk.summonerId = kldd2.id;
      sk.summonIndex = i + 1;
      state.units.push(sk);
    }
    trackTalent(
      state,
      kldd2.id,
      "\u53EC\u5524\u9AB7\u9AC5\u5175\xD73",
      3,
      "count"
    );
    state.battleLog.push({
      time: 0,
      text: `\u{1F480} ${kldd2.def.name} \u53EC\u55243\u4E2A\u9AB7\u9AC5\u5175`,
      type: "status",
    });
  };
  summonSkeletons(allies);
  summonSkeletons(enemies);
  const applyDragonTalents = (us) => {
    const dragons = us.filter((u) => u.def.race === "dragon" && !isRuined(u));
    const nonDragons = us.filter((u) => u.def.race !== "dragon");
    const allDragonCount = us.filter((u) => u.def.race === "dragon").length;
    const allNonDragonCount = us.filter((u) => u.def.race !== "dragon").length;
    for (const d of dragons) {
      if (d.def.id === "xyfl") {
        const xyflMult =
          1 - (allDragonCount - 1) * 0.04 + allNonDragonCount * 0.04;
        d._xyflMult = Math.max(0.4, xyflMult);
        for (const od of dragons) {
          if (od.id !== d.id)
            od._xyflMult = Math.max(0.4, (od._xyflMult || 1) * 0.98);
        }
      }
      if (d.def.id === "hlyl") {
        const atkMult =
          1 + (allDragonCount - 1) * 0.025 - allNonDragonCount * 0.04;
        d._dragonAtkMult = Math.max(0.5, atkMult);
        for (const od of dragons) {
          if (od.id !== d.id)
            od._dragonAtkMult = (od._dragonAtkMult || 1) * 1.03;
        }
      }
      if (d.def.id === "bsxl") {
        const defMult = Math.max(
          0.5,
          1 + (allDragonCount - 1) * 0.03 - allNonDragonCount * 0.04
        );
        d.currentPhysicalDef = Math.floor(d.currentPhysicalDef * defMult);
        d.currentMagicalDef = Math.floor(d.currentMagicalDef * defMult);
        for (const od of dragons) {
          if (od.id !== d.id) {
            od.currentPhysicalDef = Math.floor(od.currentPhysicalDef * 1.02);
            od.currentMagicalDef = Math.floor(od.currentMagicalDef * 1.02);
          }
        }
      }
      if (d.def.id === "hbfl") {
        const cdMult = Math.max(
          0.5,
          1 - (allDragonCount - 1) * 0.04 + allNonDragonCount * 0.04
        );
        d.cooldownRemaining = Math.max(0, d.cooldownRemaining * cdMult);
        for (const od of dragons) {
          if (od.id !== d.id)
            od.cooldownRemaining = Math.max(0, od.cooldownRemaining * 0.98);
        }
      }
    }
    const bjl2 = us.find((u) => u.def.id === "bjl" && !isRuined(u));
    if (bjl2) {
      const oppUnits = state.units.filter((x) => x.team !== bjl2.team);
      for (const e of oppUnits) {
        if (e.def.race === "dragon") continue;
        e._bjlDefRed = (e._bjlDefRed || 0) + 0.45;
        e.currentPhysicalDef = Math.floor(e.currentPhysicalDef * 0.75);
        e.currentMagicalDef = Math.floor(e.currentMagicalDef * 0.75);
        e._bjlDefExpire = state.time + 999;
      }
      trackTalent(
        state,
        bjl2.id,
        "\u543C\u53EB\u964D\u9632(-45%)",
        oppUnits.filter((e) => e.def.race !== "dragon").length,
        "count"
      );
      state.battleLog.push({
        time: 0,
        text: `\u{1F451} ${bjl2.def.name} \u543C\u53EB: \u5168\u573A\u975E\u9F99\u9632\u5FA1-50%`,
        type: "status",
      });
    }
  };
  applyDragonTalents(allies);
  applyDragonTalents(enemies);
  const applyVoidTalents = (us) => {
    for (const ymfs of us.filter((u) => u.def.id === "ymfs" && !isRuined(u))) {
      ymfs._ymfsLeaveAt = 1;
      ymfs._ymfsReturnAt = 4;
      ymfs._ymfsTargetLeaveAt = 2;
      ymfs._ymfsTargetReturnAt = 7;
      state.battleLog.push({
        time: 0,
        text: `\u{1F300} ${ymfs.def.name} \u51C6\u5907\u4F20\u9001\u6E6E\u706D`,
        type: "status",
      });
    }
  };
  applyVoidTalents(allies);
  applyVoidTalents(enemies);
  const applyTraps = (us) => {
    for (const xjlr of us.filter((u) => u.def.id === "xjlr" && !isRuined(u))) {
      const oppUnits = getAttackableEnemies(state, xjlr.team);
      const targets = shuffle2(oppUnits).slice(0, 2);
      for (const tr of targets) {
        tr._trapped = true;
        tr._trappedBy = xjlr.id;
      }
      state.battleLog.push({
        time: 0,
        text: `\u{1FAA4} ${xjlr.def.name} \u653E\u7F6E\u9677\u9631: ${targets.map((t) => t.def.name).join(",")}`,
        type: "status",
      });
    }
  };
  applyTraps(allies);
  applyTraps(enemies);
  if (state._debug) {
    for (const side of ["ally", "enemy"]) {
      const us = side === "ally" ? allies : enemies;
      const label = side === "ally" ? "\u6211\u65B9" : "\u654C\u65B9";
      const bonds = getActiveBonds(us);
      for (const [race, { effect }] of bonds) {
        const cnt = us.filter((u) => u.def.race === race).length;
        if (race === "warrior") {
          const extra =
            cnt >= 4
              ? "+\u6BCF5s\u56DE8%HP+20%\u5438\u8840"
              : cnt >= 3
                ? "+\u6BCF5s\u56DE4%HP+10%\u5438\u8840"
                : "";
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u6218\u58EB\xD7${cnt}\u7F81\u7ECA: HP+${effect.hpBonus}%${extra}`,
            type: "system",
          });
        } else if (race === "mage") {
          const mdefStr =
            cnt >= 4 ? "50%" : cnt >= 3 ? "35%" : cnt >= 2 ? "20%" : "0%";
          const lsStr = cnt >= 4 ? "25%" : cnt >= 3 ? "10%" : "";
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u6CD5\u5E08\xD7${cnt}\u7F81\u7ECA: \u9B54\u9632-${mdefStr}${lsStr ? `+\u5438\u8840${lsStr}` : ""}`,
            type: "system",
          });
        } else if (race === "dragon")
          state.battleLog.push({
            time: 0,
            text: `\u{1F31F} ${label} \u9F99\u65CF\xD7${cnt}\u7F81\u7ECA: \u8D77\u59CB\u51B7\u5374-${cnt >= 4 ? 35 : 20}%+\u51CF\u4F24${cnt >= 4 ? 8 : 3}%\u5F00\u5C40${cnt >= 4 ? 2.5 : 2}\u500D${cnt >= 4 ? 10 : 6}s`,
            type: "system",
          });
        else {
          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `\u{1F31F} ${label} ${race}\xD7${cnt}\u7F81\u7ECA: \u653B+${effect.attackBonus}%`,
              type: "system",
            });
          if (effect.attackSpeedBonus)
            state.battleLog.push({
              time: 0,
              text: `\u{1F31F} ${label} ${race}\xD7${cnt}\u7F81\u7ECA: \u653B\u901F+${effect.attackSpeedBonus}%`,
              type: "system",
            });
          if (effect.defenseBonus)
            state.battleLog.push({
              time: 0,
              text: `\u{1F31F} ${label} ${race}\xD7${cnt}\u7F81\u7ECA: \u9632+${effect.defenseBonus}%`,
              type: "system",
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
    return Object.entries(rc)
      .filter(([_, c]) => c >= 3)
      .map(([r, c]) => ({ race: r, count: c }));
  }
}
var MAX_LOG = 2e3;
function deferDamage(target, dmg, state) {
  if (target.isDead || dmg <= 0) return;
  if (target._reviveDebuffUntil && target._reviveDebuffUntil > state.time)
    dmg = Math.floor(dmg * 1.25);
  addStat2(state, target.id, "hitsTaken", 1);
  if (target._shield > 0) {
    const absorbed = Math.min(target._shield, dmg);
    target._shield -= absorbed;
    dmg -= absorbed;
    addStat2(state, target.id, "shieldAbsorbed", absorbed);
  }
  if (dmg <= 0) return;
  if (
    target._linkOwnerId &&
    target._linkUntil &&
    state.time < target._linkUntil
  ) {
    const owner = state.units.find(
      (x) => x.id === target._linkOwnerId && !x.isDead
    );
    if (owner) {
      const share = Math.floor(dmg * 0.25);
      owner.currentHp -= share;
      addStat2(state, owner.id, "totalDamageReceived", share);
      dmg -= share;
      if (dmg <= 0) return;
    }
  }
  if (target.def.id === "bslr") {
    target._bslrBreakUntil = state.time + 1;
  }
  if (
    target.statuses?.some((s) => s.type === "sleep" /* Sleep */) &&
    Math.random() < 0.2
  ) {
    target.statuses = target.statuses.filter(
      (s) => s.type !== "sleep" /* Sleep */
    );
    state.battleLog.push({
      time: state.time,
      text: `\u{1F4A4} ${target.def.name} \u88AB\u60CA\u9192\uFF01`,
      type: "status",
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
    if (u.isDead) continue;
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
          type: "damage",
        });
      }
    }
  }
}
function processTick(state) {
  if (state.phase !== "fighting") return state;
  state.time += 0.1;
  setBattleClock(state.time);
  for (const u of getAlive(state)) addStat2(state, u.id, "survivalTime", 0.1);
  for (const u of state.units) {
    if (u.def.id === "kldd")
      u._guarded = state.units.some(
        (x) =>
          x.team === u.team && x.isSummon && x.summonerId === u.id && !x.isDead
      );
  }
  for (const u of state.units) {
    u._statusSnapshot = u.statuses.slice();
    u._hitSnapshot = !!u._wasHitDuringCast;
    u._dmgSnapshot = !!u._wasDamagedDuringCast;
    u._wasHitDuringCast = false;
    u._wasDamagedDuringCast = false;
  }
  const frenzyStage = state.time >= 119.95 ? 2 : state.time >= 89.95 ? 1 : 0;
  if (frenzyStage > 0) {
    for (const u of state.units) {
      if (!u.isDead) u._frenzy = frenzyStage;
    }
    if (frenzyStage === 1 && !state._frenzyLogged) {
      state._frenzyLogged = true;
      state.battleLog.push({
        time: 90,
        text: `\u{1F525} \u6218\u6597\u72C2\u70ED(\u4E00\u9636\u6BB5): \u5168\u4F53\u4F24\u5BB3+50% \u653B\u901F+30% \u51B7\u5374-30%`,
        type: "system",
      });
    }
    if (frenzyStage === 2 && !state._frenzy2Logged) {
      state._frenzy2Logged = true;
      state.battleLog.push({
        time: 120,
        text: `\u{1F525} \u6218\u6597\u72C2\u70ED(\u4E8C\u9636\u6BB5): \u5168\u4F53\u4F24\u5BB3+100% \u653B\u901F+50% \u51B7\u5374-40%`,
        type: "system",
      });
    }
  }
  updateStatuses(state);
  processDelayedDamage(state);
  updateCasting(state);
  updateCooldowns(state);
  updateSkills(state);
  updateAutoAttacks(state);
  updateDeaths(state);
  updateMartyrPostmortem(state);
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
          type: "damage",
        });
      }
      if (s.type === "bite" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "pure"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            const ls = Math.floor(dmg * 0.15);
            src.currentHp = Math.min(src.maxHp, src.currentHp + ls);
            addStat2(state, src.id, "lifeStealHealing", ls);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F9B7} ${unit.def.name} \u6495\u54ACDoT ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "sc_judge_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "pure"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
        }
      }
      const qdCycle = Math.floor(state.time);
      if (
        unit._qdRegenUntil &&
        state.time < unit._qdRegenUntil &&
        unit._qdRegenPct &&
        unit._qdRegenCycle !== qdCycle
      ) {
        unit._qdRegenCycle = qdCycle;
        const regen = Math.floor(unit.maxHp * unit._qdRegenPct);
        addStat2(state, unit.id, "totalHealingReceived", regen);
        addStat2(state, unit.id, "totalHealing", regen);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      }
      if (unit._qdInvulnUntil && state.time >= unit._qdInvulnUntil)
        unit._qdInvulnUntil = void 0;
      if (unit._qdDrUntil && state.time >= unit._qdDrUntil) {
        unit._qdDrUntil = void 0;
        unit._qdDrPct = void 0;
      }
      if (unit._qdRegenUntil && state.time >= unit._qdRegenUntil) {
        unit._qdRegenUntil = void 0;
        unit._qdRegenPct = void 0;
      }
      if (unit.def.id === "sc" && !isRuined(unit)) {
        const buffed = getEnemies(state, unit.team).filter(
          (e) => !e.isDead && e.statuses && e.statuses.length > 0
        ).length;
        unit._scDr = buffed * 0.06;
      }
      if (unit.def.id === "qm" && !isRuined(unit) && unit.statuses.length > 0) {
        const negTypes = [
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
          "poison",
          "slow",
        ];
        const hasNeg = unit.statuses.some((s2) =>
          negTypes.includes(String(s2.type).toLowerCase())
        );
        if (hasNeg) {
          unit.statuses = unit.statuses.filter(
            (s2) => !negTypes.includes(String(s2.type).toLowerCase())
          );
          unit._qmLayers = Math.min(4, (unit._qmLayers || 0) + 1);
          unit._qmUntil = state.time + 9;
          state.battleLog.push({
            time: state.time,
            text: `\u26E9 ${unit.def.name} \u9A71\u9B54: \u89E3\u9664\u5F02\u5E38 \u653B\u9632+${unit._qmLayers}\u5C42`,
            type: "status",
          });
        }
      }
      if (unit._qmUntil && state.time >= unit._qmUntil) {
        unit._qmLayers = void 0;
        unit._qmUntil = void 0;
      }
      if (s.type === "drain" && s.value) {
        if (s.remainingSeconds <= 0.11 && !s._curseApplied) {
          s._curseApplied = true;
          unit.statuses.push({
            type: "curse" /* Curse */,
            remainingSeconds: 4,
            stacks: 1,
          });
          state.battleLog.push({
            time: state.time,
            text: `\u2620 ${unit.def.name} \u5438\u9B42\u7ED3\u675F: \u8BC5\u54924s`,
            type: "status",
          });
        }
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "magical"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (!src) {
            s.remainingSeconds = 0;
          } else {
            const ls = Math.floor(dmg * 0.15);
            src.currentHp = Math.min(src.maxHp, src.currentHp + ls);
            addStat2(state, src.id, "lifeStealHealing", ls);
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "skillDamage", dmg);
            addStat2(state, src.id, "magicalDamage", dmg);
          }
          if (s.remainingSeconds > 0) {
            state.battleLog.push({
              time: state.time,
              text: `\u{1F480} ${unit.def.name} \u5438\u9B42 ${dmg}`,
              type: "damage",
            });
            if (s.remainingSeconds <= 0.11 && !s._curseApplied) {
              s._curseApplied = true;
              unit.statuses.push({
                type: "curse" /* Curse */,
                remainingSeconds: 4,
                stacks: 1,
              });
              state.battleLog.push({
                time: state.time,
                text: `\u2620 ${unit.def.name} \u5438\u9B42\u7ED3\u675F: \u8BC5\u54924s`,
                type: "status",
              });
            }
          }
        }
      }
      if (s.type === "doom" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "pure"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "pureDamage", dmg);
            trackTalent(state, src.id, "\u672B\u65E5(DoT)", dmg, "damage");
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F480} ${unit.def.name} \u672B\u65E5 ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "bsxl_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "magical"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "skillDamage", dmg);
            addStat2(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u2744\uFE0F ${unit.def.name} \u51B0\u971CDoT ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "hlyl_burn" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "magical"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "skillDamage", dmg);
            addStat2(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F525} ${unit.def.name} \u71C3\u70E7 ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "sjsn_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "magical"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "skillDamage", dmg);
            addStat2(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F9CA} ${unit.def.name} \u51B0\u5C01DoT ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "trap_dot" && s.value) {
        const cycle = Math.floor(state.time / 2);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const casterAtk = s.casterAtk || 0;
          const dmg = Math.floor(casterAtk * 0.95 + s.value);
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "pure"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "pureDamage", dmg);
            trackTalent(
              state,
              src.id,
              "\u8D85\u7EA7\u9677\u9631(DoT)",
              dmg,
              "damage"
            );
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F573} ${unit.def.name} \u9677\u9631\u4F24\u5BB3 ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "lxgz_heal_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const heal = Math.floor(
            (s.value + (unit.currentAttack || unit.def.stats.attack) * 0.2) *
              (s.healMult || 1)
          );
          let antiHealMult =
            unit._antiHealMult &&
            unit._antiHealUntil &&
            unit._antiHealUntil > state.time
              ? unit._antiHealMult
              : 1;
          const appliedHeal = Math.floor(heal * antiHealMult);
          unit.lastHeal = { value: appliedHeal, time: state.time };
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + appliedHeal);
          addStat2(state, unit.id, "totalHealingReceived", heal);
          const src = state.units.find((x) => x.id === s.sourceId);
          if (src) {
            addStat2(state, src.id, "totalHealingDone", appliedHeal);
            addStat2(state, src.id, "totalHealing", appliedHeal);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F3B6} ${unit.def.name} \u7434\u97F3\u56DE\u590D ${heal}`,
            type: "heal",
          });
        }
      }
      if (
        (s.type === "lyz_heal_dot" || s.type === "hbfl_heal_dot") &&
        s.value
      ) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const heal = s.value;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
          addStat2(state, unit.id, "totalHealingReceived", heal);
          const src = state.units.find((x) => x.id === s.sourceId);
          if (src) {
            addStat2(state, src.id, "totalHealingDone", heal);
            addStat2(state, src.id, "totalHealing", heal);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u{1F49A} ${unit.def.name} \u6BCF\u79D2\u6CBB\u7597 +${heal}`,
            type: "heal",
          });
        }
      }
      if (s.type === "xd_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "pureDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u271D ${unit.def.name} \u6B89\u9053\u7EAF\u7CB9 ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "bslr_dot" && s.value) {
        const bslrSrc = state.units.find(
          (x) => x.id === s.sourceId && !x.isDead
        );
        if (
          bslrSrc?.def.id === "bslr" &&
          !(bslrSrc._bslrBreakUntil && bslrSrc._bslrBreakUntil > state.time) &&
          Math.random() < 0.4
        ) {
          unit._antiHealMult = 0.75;
          unit._antiHealUntil = state.time + 2;
        }
        const cycle = Math.floor(state.time);
        if (s.lastCycle !== cycle) {
          s.lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x) => x.id === s.sourceId && !x.isDead
          );
          if (srcT)
            trackSkill(
              state,
              srcT.id,
              srcT.def.skill.id,
              srcT.def.skill.name,
              dmg,
              "physical"
            );
          addStat2(state, unit.id, "totalDamageReceived", dmg);
          addStat2(state, unit.id, "physicalDamageReceived", dmg);
          const src = state.units.find((x) => x.id === s.sourceId && !x.isDead);
          if (src) {
            addStat2(state, src.id, "totalDamageDealt", dmg);
            addStat2(state, src.id, "skillDamage", dmg);
            addStat2(state, src.id, "physicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `\u2744\uFE0F ${unit.def.name} \u6301\u7EED\u5C04\u51FB ${dmg}`,
            type: "damage",
          });
        }
      }
      if (s.type === "regen" /* Regen */ && s.value) {
        const heal = Math.floor(unit.maxHp * s.value);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
        addStat2(state, unit.id, "totalHealingReceived", heal);
        state.battleLog.push({
          time: state.time,
          text: `\u{1F49A} ${unit.def.name} \u56DE\u590D ${heal}`,
          type: "heal",
        });
      }
    }
    if (unit.statuses.some((s) => s.type === "curse" /* Curse */)) {
      const dmg = Math.floor(unit.currentAttack * 0.01 + 22);
      unit.currentHp -= dmg;
      addStat2(state, unit.id, "totalDamageReceived", dmg);
    }
    if (
      unit._ymfsLeaveAt &&
      state.time >= unit._ymfsLeaveAt &&
      !unit._ymfsLeft
    ) {
      unit._ymfsLeft = true;
      if (!unit._ymfsTargetId) {
        const sym =
          getEnemies(state, unit.team).find(
            (e) => e.row === unit.row && e.col === unit.col
          ) || getEnemies(state, unit.team)[0];
        if (sym) {
          unit._ymfsTargetId = sym.id;
          sym._ymfsLeft = true;
          sym._ymfsReturnAt = unit._ymfsTargetReturnAt;
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `\u{1F300} ${unit.def.name} \u4F20\u9001\u79BB\u573A`,
        type: "status",
      });
    }
    if (
      unit._ymfsLeft &&
      unit._ymfsReturnAt &&
      state.time >= unit._ymfsReturnAt
    ) {
      unit._ymfsLeft = false;
      unit._ymfsLeaveAt = void 0;
      unit._ymfsReturnAt = void 0;
      state.battleLog.push({
        time: state.time,
        text: `\u{1F300} ${unit.def.name} \u8FD4\u56DE\u6218\u573A`,
        type: "status",
      });
    }
    if (unit._xyflMult && unit._xyflMult !== 1) {
      const extra = 0.1 * (1 - unit._xyflMult);
      for (const st of unit.statuses) {
        if (
          st.remainingSeconds > 0.5 &&
          [
            "stun",
            "sleep",
            "burn",
            "curse",
            "poison",
            "doom",
            "bind",
            "petrify",
            "freeze",
            "silence",
            "disarm",
            "ruin",
          ].includes(st.type)
        ) {
          st.remainingSeconds = Math.max(0.5, st.remainingSeconds - extra);
        }
      }
    }
    if (unit._trapped) {
      const trapCycle = Math.floor(state.time / 3);
      if (trapCycle > 0 && unit._trapCycle !== trapCycle) {
        unit._trapCycle = trapCycle;
        const dmg = Math.floor(unit.maxHp * 0.05);
        unit.currentHp -= dmg;
        addStat2(state, unit.id, "totalDamageReceived", dmg);
        const trapper = state.units.find(
          (x) => x.id === unit._trappedBy && !x.isDead
        );
        if (trapper) {
          trackTalent(
            state,
            trapper.id,
            "\u9677\u9631(5%HP/3s)",
            dmg,
            "damage"
          );
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1FAA4} ${unit.def.name} \u89E6\u53D1\u9677\u9631: -${dmg}`,
          type: "damage",
        });
      }
    }
    if (unit._bjlDefRed) {
      const cycle = Math.floor(state.time / 6);
      if (cycle > 0 && unit._bjlCycle !== cycle) {
        unit._bjlCycle = cycle;
        const current = unit._bjlDefRed;
        const next = Math.max(0.125, current - 0.15);
        const restoreRatio = (1 - next) / (1 - current);
        unit.currentPhysicalDef = Math.floor(
          unit.currentPhysicalDef * restoreRatio
        );
        unit.currentMagicalDef = Math.floor(
          unit.currentMagicalDef * restoreRatio
        );
        unit._bjlDefRed = next;
      }
    }
    if (
      unit.def.id === "hl" &&
      !unit._hlRageTriggered &&
      unit.currentHp / unit.maxHp < 0.6
    ) {
      unit._hlRageTriggered = true;
      unit._hlRageAtkMult = 1.3;
      unit._hlRageSpeedMult = 1.5;
      unit._hlRageDrMult = 0.2;
      unit._immuneAbnormal = true;
      unit._hlRageCycle = Math.floor(state.time / 3);
      state.battleLog.push({
        time: state.time,
        text: `\u{1F621} ${unit.def.name} \u6FC0\u6012: \u6BCF3s\u59312%HP\uFF0C\u51CF\u4F2420% \u653B+30% \u653B\u901F+50% \u514D\u75AB\u5F02\u5E38`,
        type: "status",
      });
    }
    if (unit.def.id === "hl" && unit._hlRageTriggered) {
      const rageCycle = Math.floor(state.time / 3);
      if (unit._hlRageCycle !== rageCycle) {
        unit._hlRageCycle = rageCycle;
        const selfDmg = Math.max(1, Math.floor(unit.maxHp * 0.02));
        unit.currentHp = Math.max(1, unit.currentHp - selfDmg);
        addStat2(state, unit.id, "pureDamageTaken", selfDmg);
      }
    }
    if (
      unit._ldshzDefUntil &&
      state.time >= unit._ldshzDefUntil &&
      unit._ldshzDefApplied
    ) {
      unit.currentPhysicalDef = Math.floor(unit.currentPhysicalDef / 1.2);
      unit.currentMagicalDef = Math.floor(unit.currentMagicalDef / 1.2);
      unit._ldshzDefUntil = void 0;
      unit._ldshzDefApplied = void 0;
      if (unit._ldshzBuffUntil && state.time >= unit._ldshzBuffUntil) {
        unit.critRate = Math.max(0, (unit.critRate || 0) - 0.2);
        unit.lifeSteal = Math.max(0, (unit.lifeSteal || 0) - 0.3);
        unit._ldshzBuffUntil = void 0;
      }
    }
    if (
      unit._atkBuffUntil &&
      state.time >= unit._atkBuffUntil &&
      unit._atkBuffAmt
    ) {
      unit.currentAttack = Math.max(1, unit.currentAttack - unit._atkBuffAmt);
      unit._atkBuffAmt = void 0;
      unit._atkBuffUntil = void 0;
    }
    if (unit._slzsGuardUntil && state.time >= unit._slzsGuardUntil) {
      unit._slzsAtkMult = void 0;
      unit._slzsDr = void 0;
      unit._slzsGuardUntil = void 0;
    }
    if (unit._bslrDebuffUntil && state.time >= unit._bslrDebuffUntil) {
      unit._bslrAtkDown = void 0;
      unit._bslrSlowDown = void 0;
      unit._bslrDebuffUntil = void 0;
    }
    if (unit._linkUntil && state.time >= unit._linkUntil) {
      unit.skillPower = Math.max(
        1,
        (unit.skillPower || 1) - (unit._xjlSkillPowerBonus || 0.3)
      );
      unit._xjlSkillPowerBonus = void 0;
      unit._xjlTalentShare = void 0;
      unit._linkOwnerId = void 0;
      unit._linkUntil = void 0;
    }
    if (unit._hitRedUntil && state.time >= unit._hitRedUntil) {
      unit.hitRateMod = (unit.hitRateMod || 0) + 0.2;
      unit._hitRedUntil = void 0;
    }
    if (unit._shieldUntil && state.time >= unit._shieldUntil) {
      unit._shield = void 0;
      unit._shieldUntil = void 0;
    }
    if (unit._hammerDueAt && state.time >= unit._hammerDueAt) {
      const hd2 = unit._hammerDelayedDmg || 0;
      unit.currentHp -= hd2;
      addStat2(state, unit.id, "totalDamageReceived", hd2);
      addStat2(state, unit.id, "pureDamageReceived", hd2);
      state.battleLog.push({
        time: state.time,
        text: `\u{1F528} ${unit.def.name} \u51A5\u706B\u5EF6\u8FDF\u4F24\u5BB3(75%\u7EAF\u7CB9): ${hd2}`,
        type: "damage",
      });
      unit._hammerDueAt = void 0;
      unit._hammerDelayedDmg = void 0;
    }
    const xjlRegenCycle = Math.floor(state.time);
    const xjlRegenShare = unit.def.id === "xjl" ? 1 : unit._xjlTalentShare || 0;
    if (
      xjlRegenShare > 0 &&
      !isRuined(unit) &&
      unit._xjlRegenCycle !== xjlRegenCycle
    ) {
      unit._xjlRegenCycle = xjlRegenCycle;
      const regen = Math.floor(unit.maxHp * 0.015 * xjlRegenShare);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      addStat2(state, unit.id, "totalHealingReceived", regen);
    }
    if (unit.def.id === "lyz") {
      const dragonCnt = state.units.filter(
        (x) => !x.isDead && x.def.race === "dragon"
      ).length;
      unit._lyzTalentDrPct = isRuined(unit)
        ? void 0
        : Math.min(0.8, dragonCnt * 0.05);
    }
    const lyzCycle = Math.floor(state.time);
    if (
      unit.def.id === "lyz" &&
      unit.row !== 0 /* Front */ &&
      !isRuined(unit) &&
      unit._lyzCycle !== lyzCycle
    ) {
      unit._lyzCycle = lyzCycle;
      const awayDmg = Math.floor(unit.maxHp * 0.03);
      unit.currentHp -= awayDmg;
      addStat2(state, unit.id, "totalDamageReceived", awayDmg);
    }
    if (unit.def.id === "yammxz" && !isRuined(unit)) {
      const ycycle = Math.floor(state.time / 8);
      if (ycycle > 0 && unit._yammxzCycle !== ycycle) {
        unit._yammxzCycle = ycycle;
        const sameRowEnemies = getEnemies(state, unit.team).filter(
          (e) => e.row === unit.row
        );
        for (const e of sameRowEnemies) {
          e.statuses.push({
            type: "curse" /* Curse */,
            remainingSeconds: 3,
            stacks: 1,
          });
          if (unit.hasRevived)
            e.statuses.push({
              type: "ruin" /* Ruin */,
              remainingSeconds: 3,
              stacks: 1,
            });
        }
        trackTalent(
          state,
          unit.id,
          "\u6697\u5F71\u8BC5\u5492(8s\u5468\u671F)",
          sameRowEnemies.length * 3,
          "control"
        );
        state.battleLog.push({
          time: state.time,
          text: `\u{1F311} ${unit.def.name} \u6697\u5F71\u8BC5\u5492: \u540C\u6392\u654C\u65B9${sameRowEnemies.length}\u4EBA\xD75s`,
          type: "status",
        });
      }
    }
    if (unit._zfyxAtkUntil && state.time >= unit._zfyxAtkUntil) {
      unit._zfyxAtkStacks = void 0;
      unit._zfyxAtkUntil = void 0;
    }
    if (unit._zfyxEvaUntil && state.time >= unit._zfyxEvaUntil) {
      unit.evasion = Math.max(0, (unit.evasion || 0) - 0.4);
      unit._zfyxEvaUntil = void 0;
    }
    if (
      unit._swapEvaUntil &&
      state.time >= unit._swapEvaUntil &&
      unit._swapEvaApplied
    ) {
      unit.evasion = Math.max(0, (unit.evasion || 0) - 0.2);
      unit._swapEvaUntil = void 0;
      unit._swapEvaApplied = void 0;
    }
    if (unit._zzxDrUntil && state.time >= unit._zzxDrUntil) {
      unit._zzxDrPhys = void 0;
      unit._zzxDrMag = void 0;
      unit._zzxDrUntil = void 0;
    }
    if (unit.def.id === "kzs" && !isRuined(unit)) {
      const lostPct = 1 - unit.currentHp / unit.maxHp;
      const want = Math.min(5, Math.floor(lostPct / 0.12));
      if (want !== (unit._kzsLayers || 0)) {
        unit._kzsLayers = want;
        unit._kzsAtkMult = 1 + want * 0.035;
        unit._kzsDr = want * 0.08;
      }
    }
    if (unit.def.id === "hyz" && !isRuined(unit)) {
      const cycle = Math.floor(state.time / 4);
      if (cycle > 0 && unit._hyzCycle !== cycle) {
        unit._hyzCycle = cycle;
        unit._hyzStacks = Math.min(5, (unit._hyzStacks || 0) + 1);
        trackTalent(state, unit.id, "\u9B42\u80FD\u5C42\u6570", 1, "count");
        state.battleLog.push({
          time: state.time,
          text: `\u{1F47B} ${unit.def.name} \u83B7\u5F97\u9B42\u80FD: ${unit._hyzStacks}\u5C42 (\u653B\u9632+${unit._hyzStacks * 6}%)`,
          type: "status",
        });
      }
    }
    if (unit.def.id === "wqqs" && !isRuined(unit)) {
      const curseCount = getEnemies(state, unit.team).filter((e) =>
        e.statuses.some((s) => s.type === "curse" /* Curse */)
      ).length;
      const reviveMult = unit.hasRevived ? 1.5 : 1;
      unit._wqqsAtkMult = 1 + curseCount * 0.05 * reviveMult;
      unit._wqqsEvaMult = curseCount * 0.03 * reviveMult;
      if (curseCount > 0) {
        unit.evasion = Math.max(unit.evasion || 0, unit._wqqsEvaMult);
      }
    }
    const poison = unit.statuses.find((s) => s.type === "poison" /* Poison */);
    if (poison && poison.value) {
      const dmg = poison.value;
      unit.currentHp -= dmg;
      addStat2(state, unit.id, "totalDamageReceived", dmg);
    }
    const crzsCycle = Math.floor(state.time);
    if (
      unit.def.id === "crzs" &&
      !isRuined(unit) &&
      unit._crzsCycle !== crzsCycle
    ) {
      unit._crzsCycle = crzsCycle;
      const sameRowEnemies = getEnemies(state, unit.team).filter(
        (e) => e.row === unit.row
      );
      for (const e of sameRowEnemies) {
        const dmg = Math.floor(unit.currentAttack * 0.035);
        e.currentHp -= dmg;
        addStat2(state, unit.id, "totalDamageDealt", dmg);
      }
    }
    const ppCycle = Math.floor(state.time);
    if (
      unit.def.id === "pp" &&
      !isRuined(unit) &&
      unit.statuses.some((s) => s.type === "sleep" /* Sleep */) &&
      unit._ppRegenCycle !== ppCycle
    ) {
      unit._ppRegenCycle = ppCycle;
      const neg = [
        "stun",
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
      const before = unit.statuses.length;
      unit.statuses = unit.statuses.filter((s) => !neg.includes(s.type));
      if (unit.statuses.length < before) {
        state.battleLog.push({
          time: state.time,
          text: `\u{1F4A4} ${unit.def.name} \u7761\u7720\u9A71\u6563\u4E86\u5F02\u5E38\u72B6\u6001`,
          type: "status",
        });
      }
      const regen = Math.floor(unit.maxHp * 0.04);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      addStat2(state, unit.id, "totalHealingReceived", regen);
      trackTalent(
        state,
        unit.id,
        "\u7761\u7720\u56DE\u8840(4%/s)",
        regen,
        "heal"
      );
      state.battleLog.push({
        time: state.time,
        text: `\u{1F4A4} ${unit.def.name} \u7761\u7720\u56DE\u590D ${regen}`,
        type: "heal",
      });
    }
    if (unit.def.id === "mmx" && !isRuined(unit)) {
      const cycle = Math.floor(state.time / 7);
      const inCurl = unit.statuses.some((s) => s.type === "curl");
      if (!inCurl && cycle > 0 && Math.abs(state.time - cycle * 7) < 0.15) {
        unit.statuses.push({
          type: "curl",
          remainingSeconds: 4,
          stacks: 1,
          value: 1,
        });
        trackTalent(
          state,
          unit.id,
          "\u5377\u66F2(\u653B-20%\u9632+50%)",
          1,
          "count"
        );
        state.battleLog.push({
          time: state.time,
          text: `\u{1F6E1} ${unit.def.name} \u8FDB\u5165\u5377\u66F2\u72B6\u6001: \u653B-20%\u9632+50%`,
          type: "status",
        });
      }
      if (inCurl) {
        const curlS = unit.statuses.find((s) => s.type === "curl");
        if (curlS && curlS.remainingSeconds <= 0.15) {
          state.battleLog.push({
            time: state.time,
            text: `\u{1F6E1} ${unit.def.name} \u5377\u66F2\u7ED3\u675F`,
            type: "status",
          });
        }
      }
    }
    const shouldClearBuffs = unit.statuses.some(
      (s) => s.remainingSeconds <= 0 && s.clearBuffsOnEnd
    );
    if (shouldClearBuffs) {
      const NEG = [
        "stun",
        "sleep",
        "petrify",
        "freeze",
        "bind",
        "burn",
        "curse",
        "poison",
        "doom",
        "ruin",
        "silence",
        "disarm",
        "slow",
        "armorBreak",
        "sc_judge_dot",
      ];
      unit.statuses = unit.statuses.filter((x) =>
        NEG.includes(String(x.type).toLowerCase())
      );
    }
    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);
    if (unit._mageAtkLayers?.length) {
      unit._mageAtkLayers = unit._mageAtkLayers.filter(
        (l) => l.expire > state.time
      );
      const sum = unit._mageAtkLayers.reduce((s, l) => s + l.value, 0);
      unit._mageAtkMult = sum > 0 ? 1 + sum : void 0;
    }
    if (unit._hunterBondLayers?.length) {
      unit._hunterBondLayers = unit._hunterBondLayers.filter(
        (l) => l.expire > state.time
      );
    }
    const decay = unit._undeadDecay;
    if (decay && !unit.isDead && state.time >= decay.startAt) {
      decay.acc += 0.1;
      if (decay.acc >= 1 - 1e-6) {
        decay.acc -= 1;
        const loss = Math.max(1, Math.floor(unit.maxHp * decay.pct));
        unit.currentHp -= loss;
        addStat2(state, unit.id, "pureDamageTaken", loss);
      }
    }
    if (unit._drowsyUntil && state.time >= unit._drowsyUntil) {
      unit.hitRateMod = (unit.hitRateMod || 0) + (unit._drowsyApplied || 0.75);
      unit._drowsyUntil = void 0;
      unit._drowsyApplied = void 0;
    }
    const NEG_STATUS = [
      "stun",
      "sleep",
      "petrify",
      "freeze",
      "bind",
      "burn",
      "curse",
      "poison",
      "doom",
      "ruin",
      "silence",
      "disarm",
      "slow",
      "armorBreak",
    ];
    const negNow = unit.statuses.filter((s) =>
      NEG_STATUS.includes(String(s.type).toLowerCase())
    ).length;
    if (negNow > (unit._negCountPrev || 0)) {
      for (const hyz2 of state.units.filter(
        (x) =>
          x.team === unit.team &&
          !x.isDead &&
          x.def.id === "hyz" &&
          !isRuined(x)
      )) {
        hyz2._hyzStacks = Math.min(5, (hyz2._hyzStacks || 0) + 1);
      }
    }
    unit._negCountPrev = negNow;
    if (unit._mageAtkExpire && state.time >= unit._mageAtkExpire) {
      unit._mageAtkExpire = void 0;
      if (!unit._mageAtkLayers?.length) unit._mageAtkMult = void 0;
    }
    if (unit._hlRoarExpire && state.time >= unit._hlRoarExpire) {
      if (unit._hlRoarStage2) {
        unit.currentAttack = Math.floor(
          (unit.currentAttack / (1 - (unit._hlRoarAtk ?? 0.3))) * 0.85
        );
        unit._hlRoarAtk = 0.15;
        unit._hlRoarExpire = state.time + 8;
        unit._hlRoarStage2 = false;
      } else {
        unit.currentAttack = Math.floor(
          unit.currentAttack / (1 - (unit._hlRoarAtk ?? 0.15))
        );
        unit._hlRoarAtk = void 0;
        unit._hlRoarExpire = void 0;
        unit._hlRoarStage2 = void 0;
      }
    }
    if (unit._tauntExpire && state.time >= unit._tauntExpire) {
      unit._tauntTarget = void 0;
      unit._tauntExpire = void 0;
    }
    if (unit._ylRoarMult) {
      const cycle = Math.floor(state.time / 10);
      if (cycle > 0 && unit._ylRoarCycle !== cycle) {
        unit._ylRoarCycle = cycle;
        const lost = Math.min(0.2, unit._ylRoarMult - 1);
        unit._ylRoarMult = Math.max(1, unit._ylRoarMult - 0.2);
        const decayKey = `_ylRoarDecayCycle_${unit.team}`;
        if (state[decayKey] !== cycle) {
          state[decayKey] = cycle;
          const ylOwner = state.units.find(
            (x) => x.team === unit.team && x.def.id === "yl" && !x.isDead
          );
          if (ylOwner) {
            const teamBeasts = state.units.filter(
              (x) => x.team === unit.team && x.def.race === "beast" && !x.isDead
            );
            const totalLoss = teamBeasts.reduce(
              (s, b) => s + Math.floor(b.currentAttack * lost * 10),
              0
            );
            trackTalent(
              state,
              ylOwner.id,
              "\u72FC\u543C(\u8870\u51CF\u635F\u5931)",
              totalLoss,
              "buff"
            );
          }
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1F43A} \u72FC\u543C\u8870\u51CF: \u517D\u65CF\u653B\u51FB\u52A0\u6210\u964D\u81F3+${Math.round((unit._ylRoarMult - 1) * 100)}%`,
          type: "status",
        });
      }
    }
  }
  for (const team of ["ally", "enemy"]) {
    const syzT = state[`_syzDeathTime_${team}`];
    if (syzT === void 0) continue;
    const el = state.time - syzT;
    if (el >= 0 && el < 6) {
      const baseAtk = state[`_syzDeathAttack_${team}`] || 0;
      const atk60 = baseAtk > 0 ? Math.floor(baseAtk * 0.8) : 361;
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
    const cc = (unit._statusSnapshot || unit.statuses).find((s) =>
      ["stun", "sleep", "petrify", "freeze", "silence"].includes(s.type)
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
      addStat2(state, unit.id, "skillInterrupts", 1);
      if (state.skillStats) {
        const ikey = `${unit.id}_${unit.def.skill.id}`;
        if (state.skillStats[ikey]) state.skillStats[ikey].interrupts += 1;
      }
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
        type: "status",
      });
      continue;
    }
    if (unit.castTimer <= 0) {
      unit._wasHitDuringCast = false;
      unit._wasDamagedDuringCast = false;
      executeSkill(unit, state, state.battleLog);
      unit.isCasting = false;
      unit.cooldownRemaining =
        unit.def.skill.cooldown * (unit._nextCdMult ?? 1);
      unit._nextCdMult = void 0;
    }
  }
}
function updateCooldowns(state) {
  for (const unit of getAlive(state)) {
    if (unit._ymfsLeft) continue;
    if (unit.cooldownRemaining > 0) {
      unit.cooldownRemaining -=
        unit._frenzy === 2 ? 0.14 : unit._frenzy ? 0.13 : 0.1;
    }
  }
}
function updateSkills(state) {
  const castOrder = shuffle2(getAlive(state));
  for (const unit of castOrder) {
    if (unit._ymfsLeft) continue;
    if (unit.isCasting) continue;
    if (unit.cooldownRemaining > 0) continue;
    const cannotCast = [
      "stun" /* Stun */,
      "sleep" /* Sleep */,
      "petrify" /* Petrify */,
      "freeze" /* Freeze */,
      "silence" /* Silence */,
    ].some((t) => unit.statuses.some((s) => s.type === t));
    const isBound = unit.statuses.some((s) => s.type === "bind" /* Bind */);
    if (cannotCast) continue;
    if (
      isBound &&
      unit.def.skill.tags?.some(
        (t) => t === "\u5207\u5165" || t === "\u79FB\u52A8"
      )
    )
      continue;
    if (
      unit._trapped &&
      unit.def.skill.tags?.some(
        (t) => t === "\u5207\u5165" || t === "\u79FB\u52A8"
      )
    )
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
      unit.cooldownRemaining = sk.cooldown * (unit._nextCdMult ?? 1);
      unit._nextCdMult = void 0;
    }
  }
}
function updateAutoAttacks(state) {
  const atkOrder = shuffle2(getAlive(state));
  for (const unit of atkOrder) {
    if (unit._ymfsLeft) continue;
    const cannotAttack = [
      "stun" /* Stun */,
      "sleep" /* Sleep */,
      "petrify" /* Petrify */,
      "freeze" /* Freeze */,
      "disarm" /* Disarm */,
    ].some((t) => unit.statuses.some((s) => s.type === t));
    if (cannotAttack) continue;
    const baseInt = unit.def.stats.attackInterval;
    let atkInterval = baseInt;
    if (unit._xldsStacks && unit._xldsExpire && state.time < unit._xldsExpire) {
      atkInterval *= 1 - unit._xldsStacks * 0.1;
    }
    if (unit._inspireAtkUntil && state.time < unit._inspireAtkUntil) {
      atkInterval *= 0.75;
    }
    if (unit.statuses.some((s) => s.type === "bloodrage" /* Bloodrage */)) {
      atkInterval *= 0.6;
    }
    if (unit._hlRageSpeedMult) {
      atkInterval *= 1 / unit._hlRageSpeedMult;
    }
    if (unit._frenzy) {
      atkInterval *= unit._frenzy === 2 ? 0.5 : 0.7;
    }
    if (unit._slowUntil && state.time < unit._slowUntil) {
      atkInterval *= 1.25;
    }
    if (
      unit._bslrSlowDown &&
      unit._bslrDebuffUntil &&
      state.time < unit._bslrDebuffUntil
    ) {
      atkInterval *= 1 + unit._bslrSlowDown;
    }
    unit.attackTimer -= 0.1 * (baseInt / atkInterval);
    if (unit.attackTimer <= 0) {
      let enemies = getEnemies(state, unit.team);
      const taunted = unit._tauntTarget
        ? enemies.find((e) => e.id === unit._tauntTarget && !e.isDead)
        : void 0;
      const nTargets = unit.def.id === "mds" && !isRuined(unit) ? 2 : 1;
      const tauntTarget = enemies.find(
        (e) => e._xdTauntUntil && e._xdTauntUntil > state.time && !e.isDead
      );
      if (tauntTarget) enemies = [tauntTarget];
      const stealthTarget = unit._stealthAttack
        ? [
            pickTarget2(enemies, [
              { row: 2 /* Back */, chance: 50 },
              { row: 1 /* Mid */, chance: 40 },
              { row: 0 /* Front */, chance: 10 },
            ]),
          ].filter(Boolean)
        : void 0;
      let targets = taunted
        ? [taunted]
        : stealthTarget && stealthTarget.length > 0
          ? stealthTarget
          : nTargets === 1
            ? [pickTarget2(enemies)].filter(Boolean)
            : shuffle2(enemies).slice(0, nTargets);
      for (const target of targets) {
        if (!target || target.isDead) continue;
        let atkRatio = 1;
        if (unit.def.id === "mds") atkRatio = 0.85;
        let stealthBonus = false;
        if (unit.def.id === "yl" && unit._stealthAttack) {
          atkRatio *= 2.4;
          stealthBonus = true;
        }
        const hunterCntP1 = state.units.filter(
          (u) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
        ).length;
        const dragonCntP1 = state.units.filter(
          (u) => u.team === unit.team && !u.isDead && u.def.race === "dragon"
        ).length;
        if (unit.def.id === "klb" && targets.length > 0) {
          const hammered = enemies.find(
            (e) => e._hammerTarget === unit.summonerId && !e.isDead
          );
          if (hammered) targets = [hammered];
        }
        const autoType =
          unit.def.id === "zq"
            ? "magical" /* Magical */
            : "physical"; /* Physical */
        unit._cutinDmgRed = void 0;
        const result = calcDamage(unit, target, atkRatio, autoType, {
          evasion: target.evasion,
          hitRateMod: (unit.hitRateMod || 0) - (unit._hdHitChance ? 0.15 : 0),
          // v2.12 骷髅兵无视40%防御
          ignoreDefPct:
            unit.def.id === "klb"
              ? 0.4
              : dragonCntP1 >= 4 && unit.def.race === "dragon"
                ? 0.15
                : void 0,
        });
        if (unit._hdHitChance && result.hit === false) {
          const rebound = Math.floor(unit.currentAttack * 0.5);
          unit.currentHp -= rebound;
          addStat2(state, unit.id, "totalDamageReceived", rebound);
          trackTalent(
            state,
            unit.id,
            "\u672A\u547D\u4E2D\u53CD\u4F24",
            rebound,
            "damage"
          );
          state.battleLog.push({
            time: state.time,
            text: `\u{1F5E1} ${unit.def.name} \u672A\u547D\u4E2D, \u53CD\u4F24${rebound}`,
            type: "damage",
          });
        }
        const fs = applyFatalStrike(unit, result.finalDamage, false);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        if (
          target.def.id === "dl" &&
          !isRuined(target) &&
          result.finalDamage > 0 &&
          Math.random() < 0.5
        ) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7);
          target._dlReduced = true;
        }
        deferDamage(target, result.finalDamage, state);
        if (
          target.def.id === "dl" &&
          !isRuined(target) &&
          result.finalDamage > 0 &&
          !target._dlReduced
        ) {
          const reflect = Math.floor(target.currentAttack * 0.12);
          unit.currentHp -= reflect;
          addStat2(state, target.id, "totalDamageDealt", reflect);
          addStat2(state, unit.id, "totalDamageReceived", reflect);
          trackTalent(
            state,
            target.id,
            "\u9F99\u76AE\u53CD\u4F24",
            reflect,
            "damage"
          );
          state.battleLog.push({
            time: state.time,
            text: `\u{1FAA8} ${target.def.name} \u53CD\u4F24 ${unit.def.name}: ${reflect}`,
            type: "damage",
          });
        }
        target._dlReduced = false;
        if (result.finalDamage > 0) {
          const inBuff =
            (unit._atkBuffUntil && state.time < unit._atkBuffUntil) ||
            (unit._ylRoarMult && unit._ylRoarMult > 1.001) ||
            (unit._inspireAtkUntil && state.time < unit._inspireAtkUntil);
          if (inBuff) {
            unit._buffWinPhys = (unit._buffWinPhys || 0) + result.finalDamage;
          }
        }
        if (unit.def.id === "zqz" && !isRuined(unit)) {
          unit._zqzHits = (unit._zqzHits || 0) + 1;
          if (unit._zqzPower) {
            const ls = Math.floor(result.finalDamage * 0.5);
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
            addStat2(state, unit.id, "lifeStealHealing", ls);
            target.statuses.push({
              type: "armorBreak" /* ArmorBreak */,
              remainingSeconds: 7,
              stacks: 1,
            });
            trackTalent(
              state,
              unit.id,
              "\u91CD\u62F3(\u5438\u8840+\u7834\u7532)",
              ls,
              "heal"
            );
            unit._zqzPower = false;
          }
          if ((unit._zqzHits || 0) % 3 === 0) unit._zqzPower = true;
        }
        if (unit.def.id === "klb" && result.finalDamage > 0) {
          const kldd2 = state.units.find(
            (x) => x.id === unit.summonerId && !x.isDead
          );
          if (kldd2) {
            const skHeal = Math.floor(result.finalDamage * 0.2);
            kldd2.currentHp = Math.min(kldd2.maxHp, kldd2.currentHp + skHeal);
            addStat2(state, kldd2.id, "totalHealingReceived", skHeal);
          }
        }
        if (
          unit.statuses.some((s) => s.type === "bloodrage" /* Bloodrage */) &&
          result.finalDamage > 0
        ) {
          const blood = Math.floor(target.currentHp * 0.05);
          if (blood > 0) {
            target.currentHp -= blood;
            addStat2(state, unit.id, "totalDamageDealt", blood);
            addStat2(state, unit.id, "pureDamage", blood);
            addStat2(state, target.id, "totalDamageReceived", blood);
            trackTalent(
              state,
              unit.id,
              "\u8840\u6012(3%HP\u7EAF\u4F24)",
              blood,
              "damage"
            );
          }
        }
        if (
          unit.def.id === "mrsz" &&
          !isRuined(unit) &&
          result.finalDamage > 0 &&
          target.statuses.some((s) =>
            [
              "stun",
              "sleep",
              "burn",
              "curse",
              "poison",
              "doom",
              "bind",
            ].includes(s.type)
          )
        ) {
          const lsMult = unit.hasRevived ? 0.3 : 0.15;
          const ls = Math.floor(result.finalDamage * lsMult);
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
          addStat2(state, unit.id, "lifeStealHealing", ls);
        }
        if (
          unit.def.id === "aysl" &&
          !isRuined(unit) &&
          result.finalDamage > 0 &&
          target.currentHp / target.maxHp < 0.6
        ) {
          const lostHp = target.maxHp - target.currentHp;
          const bonus = Math.min(
            Math.floor(lostHp * 0.05),
            Math.floor(unit.currentAttack * 0.6)
          );
          if (bonus > 0) {
            target.currentHp -= bonus;
            addStat2(state, unit.id, "totalDamageDealt", bonus);
            addStat2(state, unit.id, "pureDamage", bonus);
            addStat2(state, target.id, "totalDamageReceived", bonus);
            trackTalent(
              state,
              unit.id,
              "\u566C\u9F99\u4F4E\u8840\u9644\u52A0",
              bonus,
              "damage"
            );
          }
          target.statuses.push({
            type: "antiHeal" /* AntiHeal */,
            remainingSeconds: 4,
            stacks: 1,
          });
        }
        if (
          unit.def.id === "zs" &&
          !isRuined(unit) &&
          result.finalDamage > 0 &&
          Math.random() < 0.35
        ) {
          const bonus = Math.floor(target.currentHp * 0.08);
          if (bonus > 0) {
            target.currentHp -= bonus;
            addStat2(state, unit.id, "totalDamageDealt", bonus);
            addStat2(state, target.id, "totalDamageReceived", bonus);
            addStat2(state, unit.id, "magicalDamageDealt", bonus);
            trackTalent(
              state,
              unit.id,
              "\u7535\u6D41\u9644\u52A0(8%HP)",
              bonus,
              "damage"
            );
            state.battleLog.push({
              time: state.time,
              text: `\u26A1 ${unit.def.name} \u7535\u6D41\u9644\u52A0: ${bonus}`,
              type: "damage",
            });
          }
        }
        if (stealthBonus) {
          const ls = Math.floor(result.finalDamage * 0.4);
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
          addStat2(state, unit.id, "lifeStealHealing", ls);
          unit.statuses = unit.statuses.filter(
            (s) => s.type !== "stealth" /* Stealth */
          );
          unit._stealthAttack = void 0;
          trackTalent(
            state,
            unit.id,
            "\u6F5C\u884C(\u5F3A\u5316\u7A81\u88AD)",
            Math.floor(result.finalDamage * 0.5),
            "damage"
          );
          trackTalent(state, unit.id, "\u6F5C\u884C(\u5438\u8840)", ls, "heal");
          state.battleLog.push({
            time: state.time,
            text: `\u{1F319} ${unit.def.name} \u6F5C\u884C\u7A81\u88AD: ${result.finalDamage}\u4F24\u5BB3+\u5438\u8840${ls}`,
            type: "damage",
          });
        }
        trackSkill(
          state,
          unit.id,
          "aa",
          "\u5E73\u780D",
          result.finalDamage,
          "physical"
        );
        if (
          unit.equipmentId === "golden_staff" &&
          result.finalDamage > 0 &&
          Math.random() < 0.4
        ) {
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
          type: "physical",
        };
        target.lastAction = { time: state.time, isTarget: true };
        unit.lastAction = {
          time: state.time,
          targetName: target.def.name,
          isTarget: false,
        };
        target.lastHitBy = unit.id;
        if (unit.def.id === "fz" && !isRuined(unit) && result.finalDamage > 0) {
          const roll = Math.random();
          if (roll < 0.33) {
            const pr = calcDamage(
              unit,
              target,
              atkRatio,
              "pure" /* Pure */,
              {}
            );
            target.currentHp += result.finalDamage;
            target.currentHp -= pr.finalDamage;
            result.finalDamage = pr.finalDamage;
            state.battleLog.push({
              time: state.time,
              text: `\u{1F9FF} \u7B26\u5492(\u7EAF\u7CB9): ${pr.finalDamage}`,
              type: "damage",
            });
          } else if (roll < 0.66) {
            const nearby = getEnemies(state, unit.team).filter(
              (e) =>
                e.id !== target.id &&
                !e.isDead &&
                Math.max(
                  Math.abs(e.row - target.row),
                  Math.abs(e.col - target.col)
                ) <= 1
            );
            if (nearby.length > 0) {
              const n = nearby[Math.floor(Math.random() * nearby.length)];
              const sr = calcDamage(unit, n, 0.3, "physical" /* Physical */, {
                ignoreDefPct: 0.7,
              });
              n.currentHp -= sr.finalDamage;
              addStat2(state, unit.id, "totalDamageDealt", sr.finalDamage);
              state.battleLog.push({
                time: state.time,
                text: `\u{1F9FF} \u7B26\u5492(\u6B21\u7EA7): ${pfx2(n)} ${sr.finalDamage}`,
                type: "damage",
              });
            }
          } else {
            target._fzMarks = (target._fzMarks || 0) + 1;
            state.battleLog.push({
              time: state.time,
              text: `\u{1F9FF} \u7B26\u5492\u5370\u8BB0: ${pfx2(target)} +1\u5C42(${target._fzMarks})`,
              type: "status",
            });
          }
        }
        if (
          unit.def.id === "sqz" &&
          !isRuined(unit) &&
          Math.random() < 0.4 &&
          result.finalDamage > 0
        ) {
          const pr = calcDamage(
            unit,
            target,
            atkRatio * 0.8,
            "pure" /* Pure */,
            {}
          );
          target.currentHp += result.finalDamage;
          target.currentHp -= pr.finalDamage;
          result.finalDamage = pr.finalDamage;
        }
        if (unit.def.race === "hunter" && result.finalDamage > 0) {
          const xblr2 = state.units.find(
            (x) =>
              x.team === unit.team &&
              !x.isDead &&
              x.def.id === "xblr" &&
              x.id !== unit.id &&
              !isRuined(x) &&
              (!x._xblrAtkCdUntil || x._xblrAtkCdUntil <= state.time)
          );
          if (xblr2 && Math.random() < 0.4) {
            const xblrEnemies = getEnemies(state, xblr2.team).filter(
              (e) =>
                !e.statuses?.some((s) => s.type === "stealth" /* Stealth */)
            );
            if (xblrEnemies.length > 0) {
              const xt =
                xblrEnemies[Math.floor(Math.random() * xblrEnemies.length)];
              const xr = calcDamage(xblr2, xt, 1, "physical" /* Physical */, {
                isSkill: true,
                critBonus: 0.3,
                evasion: xt.evasion,
                hitRateMod: xblr2.hitRateMod || 0,
              });
              deferDamage(xt, xr.finalDamage, state);
              xt.currentHp -= xr.finalDamage;
              xblr2._xblrAtkCdUntil = state.time + 8;
              addStat2(state, xblr2.id, "totalDamageDealt", xr.finalDamage);
              addStat2(state, xblr2.id, "autoAttackDamage", xr.finalDamage);
              state.battleLog.push({
                time: state.time,
                text: `\u{1F52B} ${xblr2.def.name} \u8054\u52A8\u653B\u51FB ${pfx2(xt)}: ${xr.finalDamage}${xr.isCrit ? "\u{1F4A5}" : ""}`,
                type: "damage",
              });
            }
          }
        }
        addStat2(state, unit.id, "totalDamageDealt", result.finalDamage);
        addStat2(state, unit.id, "autoAttackDamage", result.finalDamage);
        addStat2(state, unit.id, "physicalDamage", result.finalDamage);
        addStat2(state, target.id, "totalDamageReceived", result.finalDamage);
        addStat2(
          state,
          target.id,
          "physicalDamageReceived",
          result.finalDamage
        );
        if (result.finalDamage > 0) {
          unit.lastHitTarget = target.id;
          target.lastHitBy = unit.id;
          state.battleLog.push({
            time: state.time,
            text: `${pfx2(unit)} \u2694\uFE0F ${pfx2(target)}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} def=${Math.floor(target.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / 1.35).toFixed(0) : ""}` : ""}`,
            type: "damage",
          });
          if (Math.random() < 0.5) triggerLine(unit, "attack", target.def.name);
          if (unit.def.race === "beast") {
            const beastCnt = state.units.filter(
              (u) => u.team === unit.team && !u.isDead && u.def.race === "beast"
            ).length;
            if (beastCnt >= 3 && target.currentHp / target.maxHp < 0.75) {
              const purePct = beastCnt >= 4 ? 0.15 : 0.06;
              const pureDmg = Math.floor(unit.currentAttack * purePct);
              target.currentHp -= pureDmg;
              addStat2(state, unit.id, "totalDamageDealt", pureDmg);
              addStat2(state, unit.id, "pureDamage", pureDmg);
            }
          }
          if (
            unit.def.id === "syz" &&
            result.finalDamage > 0 &&
            !isRuined(unit)
          ) {
            const allies = state.units
              .filter((u) => u.team === unit.team && !u.isDead)
              .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
            if (allies.length > 0 && Math.random() < 0.8) {
              const t = allies[0];
              const heal = Math.floor(unit.currentAttack * 0.6);
              t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
              addStat2(state, unit.id, "totalHealingDone", heal);
              addStat2(state, unit.id, "skillHealing", heal);
            }
          }
        }
      }
      const asBonus = Math.min(unit.attackSpeedBonus || 0, 1.5);
      let spdMult = 1;
      if (
        unit._xldsStacks &&
        unit._xldsExpire &&
        state.time < unit._xldsExpire
      ) {
        spdMult = 1 - unit._xldsStacks * 0.08;
      }
      unit.attackTimer =
        unit.def.stats.attackInterval * (1 - asBonus * 0.5) * spdMult;
      unit._attackCount = (unit._attackCount || 0) + 1;
      const hunterCnt = state.units.filter(
        (u) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
      ).length;
      if (hunterCnt >= 3 && unit.def.race === "hunter") {
        const extraEvery = hunterCnt >= 4 ? 5 : 6;
        const extraDmgRatio = hunterCnt >= 4 ? 0.6 : 0.3;
        if (unit._attackCount % extraEvery === 0) {
          const extraEnemies = getEnemies(state, unit.team).filter(
            (e) => !targets.some((t) => t?.id === e.id)
          );
          if (extraEnemies.length > 0) {
            const extraTarget =
              extraEnemies[Math.floor(Math.random() * extraEnemies.length)];
            if (extraTarget) {
              const eresult = calcDamage(
                unit,
                extraTarget,
                extraDmgRatio,
                "physical" /* Physical */,
                {
                  evasion: extraTarget.evasion,
                  hitRateMod: unit.hitRateMod,
                  ignoreBaseDef: hunterCnt >= 4,
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
    if (u.def.race === "dragon") {
      const lyzHeal = Math.floor(u.maxHp * 0.08);
      for (const lyz2 of state.units.filter(
        (x) => x.def.id === "lyz" && !x.isDead && !isRuined(x)
      )) {
        lyz2.currentHp = Math.min(lyz2.maxHp, lyz2.currentHp + lyzHeal);
        addStat2(state, lyz2.id, "totalHealingReceived", lyzHeal);
        state.battleLog.push({
          time: state.time,
          text: `\u{1F409} ${u.def.name} \u9635\u4EA1: ${lyz2.def.name} \u9F99\u541F\u6062\u590D ${lyzHeal}`,
          type: "heal",
        });
      }
    }
    const martyr = state.units.find(
      (x) => x.team === u.team && x.def.id === "xd" && !x.isDead
    );
    if (martyr) {
      for (const e of state.units.filter(
        (x) => x.team !== u.team && !x.isDead
      )) {
        const dr = Math.floor(martyr.currentAttack * 0.3);
        e.currentHp -= dr;
        addStat2(state, martyr.id, "totalDamageDealt", dr);
        addStat2(state, martyr.id, "pureDamage", dr);
      }
      for (const a of state.units.filter(
        (x) => x.team === u.team && !x.isDead
      )) {
        a.currentHp = Math.min(
          a.maxHp,
          a.currentHp + Math.floor(a.maxHp * 0.05)
        );
        addStat2(
          state,
          martyr.id,
          "totalHealingDone",
          Math.floor(a.maxHp * 0.05)
        );
      }
      state.battleLog.push({
        time: state.time,
        text: `\u271D ${u.def.name} \u9635\u4EA1\u89E6\u53D1\u6B89\u9053: \u654C\u65B9\u5168\u4F53\u653B\u51FB\xD730%\u7EAF\u7CB9, \u6211\u65B9\u5269\u4F59\u56DE5%\u6700\u5927HP`,
        type: "heal",
      });
    }
    addStat2(state, u.id, "deaths", 1);
    if (u.def.id === "fxz") {
      for (const x of state.units) {
        if (x._markedByAnalyzer && x.team !== u.team) {
          x.evasion = x._analyzerOrigEva ?? 0;
          x._markedByAnalyzer = void 0;
          x._analyzerOrigEva = void 0;
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `\u{1F50D} ${u.def.name} \u9635\u4EA1: \u5206\u6790\u6807\u8BB0\u5931\u6548`,
        type: "status",
      });
    }
    if (u.def.id === "xjlr") {
      for (const x of state.units) {
        if (x._trappedBy === u.id) {
          x._trapped = false;
          x._trappedBy = void 0;
          x.statuses = x.statuses.filter((s) => s.type !== "trap_dot");
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `\u{1FAA4} ${u.def.name} \u9635\u4EA1: \u5168\u90E8\u9677\u9631\u6E05\u7A7A`,
        type: "status",
      });
    }
    if (u.def.id === "kldd") {
      for (const sk of state.units.filter(
        (x) => x.isSummon && x.summonerId === u.id && !x.isDead
      )) {
        sk.currentHp = 0;
        sk.isDead = true;
      }
    }
    if (u.def.race === "beast" && !u.isSummon) {
      for (const hx2 of state.units.filter(
        (x) =>
          x.team === u.team && !x.isDead && x.def.id === "hx" && !isRuined(x)
      )) {
        hx2.currentAttack = Math.floor(hx2.currentAttack * 1.08);
        hx2.currentPhysicalDef = Math.floor(hx2.currentPhysicalDef * 1.08);
        hx2.currentMagicalDef = Math.floor(hx2.currentMagicalDef * 1.08);
        trackTalent(
          state,
          hx2.id,
          "\u517D\u65CF\u9635\u4EA1\u589E\u653B\u9632",
          Math.floor(hx2.currentAttack * 0.08),
          "buff"
        );
        state.battleLog.push({
          time: state.time,
          text: `\u{1F621} ${hx2.def.name} \u56E0${u.def.name}\u9635\u4EA1: \u653B\u9632+8%`,
          type: "status",
        });
      }
    }
    if (u.def.id === "syz" && !isRuined(u)) {
      state[`_syzDeathTime_${u.team}`] = state.time;
      state[`_syzDeathAttack_${u.team}`] = u.currentAttack;
      state.battleLog.push({
        time: state.time,
        text: `\u{1F6E1} ${u.def.name} \u9635\u4EA1\u89E6\u53D1\uFF1A\u5168\u6CD5\u5E08\u6CBB\u75975s`,
        type: "status",
      });
    }
    for (const srm2 of state.units.filter(
      (x) =>
        x.def.id === "srm" && x.team === u.team && !x.isDead && !isRuined(x)
    )) {
      const hpBonus = Math.floor(srm2.maxHp * 0.12);
      srm2.maxHp += hpBonus;
      srm2.currentHp = Math.min(
        srm2.maxHp,
        srm2.currentHp + Math.floor(srm2.maxHp * 0.15)
      );
      state.battleLog.push({
        time: state.time,
        text: `\u{1F525} ${srm2.def.name} \u5929\u8D4B\u89E6\u53D1: \u6700\u5927HP+${hpBonus}+\u6062\u590D15%HP`,
        type: "status",
      });
    }
    if (u.lastHitBy) addStat2(state, u.lastHitBy, "kills", 1);
    state.battleLog.push({
      time: state.time,
      text: `\u{1F480} ${pfx2(u)} \u9635\u4EA1\uFF01`,
      type: "death",
    });
    const killer = u.lastHitBy
      ? state.units.find((x) => x.id === u.lastHitBy)
      : null;
    triggerLine(
      u,
      killer && killer.def.race === u.def.race ? "allyDeath" : "death",
      killer?.def.name
    );
    if (killer && killer.def.id === "jdds" && !isRuined(killer)) {
      const rebound = Math.floor(killer.currentAttack * 0.1);
      killer.currentHp -= rebound;
      addStat2(state, killer.id, "totalDamageReceived", rebound);
      killer._jddsAtkBonus = (killer._jddsAtkBonus || 0) + 0.08;
      killer._jddsDefBonus = (killer._jddsDefBonus || 0) + 0.03;
      trackTalent(state, killer.id, "\u51FB\u6740\u6210\u957F", 1, "count");
      state.battleLog.push({
        time: state.time,
        text: `\u2694 ${killer.def.name} \u51FB\u6740\u5956\u52B1: \u653B+7%\u9632+3% (\u53CD\u51B2${rebound})`,
        type: "status",
      });
    }
    if (u._markExpire && u._markExpire > state.time - 5) {
      const aysl = state.units.find(
        (x) => x.def.id === "aysl" && x.team !== u.team && !x.isDead
      );
      if (aysl) {
        const heal = Math.floor(aysl.maxHp * 0.2);
        aysl.currentHp = Math.min(aysl.maxHp, aysl.currentHp + heal);
        for (const d of state.units.filter(
          (x) => x.def.race === "dragon" && x.team === aysl.team && !x.isDead
        )) {
          d.cooldownRemaining = Math.max(0, d.cooldownRemaining * 0.8);
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1F311} \u6697\u5F71\u566C\u9F99 \u51FB\u6740\u5956\u52B1: \u56DE20%HP+\u5168\u9F99CD-20%`,
          type: "status",
        });
      }
    }
    if (u.def.race === "undead" && !u.hasRevived && !u.isSummon) {
      if (u._undeadReviveUsed) continue;
      u._undeadReviveUsed = true;
      const alive = state.units.filter((x) => x.team === u.team && !x.isDead);
      const totalU = state.units.filter(
        (x) => x.team === u.team && x.def.race === "undead" && !x.isSummon
      ).length;
      if (totalU >= 3) {
        const is4 = totalU >= 4;
        const reviveTime = is4 ? 5 : 10;
        const hpPct = is4 ? 0.25 : 0.15;
        const decayDelay = is4 ? 3 : 2;
        const decayPct = is4 ? 0.02 : 0.03;
        u.reviving = { timer: reviveTime, hpPct, decayDelay, decayPct };
        state.battleLog.push({
          time: state.time,
          text: `\u{1F480} ${u.def.name} ${totalU}\u7F81\u7ECA\u6FC0\u6D3B\uFF0C${reviveTime}s\u540E\u590D\u6D3B\u81F3${Math.round(hpPct * 100)}%HP(${decayDelay}s\u540E\u6BCF\u79D2\u5931\u53BB${Math.round(decayPct * 100)}%\u6700\u5927HP)`,
          type: "status",
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
        const reviveHpPct = u.reviving.hpPct ?? 0.15;
        const revDecayDelay = u.reviving.decayDelay ?? 2;
        const revDecayPct = u.reviving.decayPct ?? 0.03;
        u.currentHp = Math.max(1, Math.floor(u.maxHp * reviveHpPct));
        u.cooldownRemaining = u.def.skill.cooldown;
        u.attackTimer = 0;
        u.statuses = [];
        u.reviving = void 0;
        u.invincibleTimer = 0;
        u.hasRevived = true;
        u._reviveDebuffUntil = state.time + 15;
        if (u.def.id === "hyz") u._hyzStacks = 5;
        u._undeadDecay = {
          startAt: state.time + revDecayDelay,
          pct: revDecayPct,
          acc: 0,
        };
        state.battleLog.push({
          time: state.time,
          text: `\u{1F504} ${u.def.name} \u590D\u6D3B\u81F3${Math.round(reviveHpPct * 100)}%HP\uFF0C\u6280\u80FD\u8FDB\u5165\u51B7\u5374\uFF1B${revDecayDelay}s\u540E\u6BCF\u79D2\u5931\u53BB${Math.round(revDecayPct * 100)}%\u6700\u5927HP\uFF1B\u590D\u6D3B\u540E15s\u5185\u9020\u6210\u4F24\u5BB3-25%/\u53D7\u5230\u4F24\u5BB3+25%`,
          type: "status",
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
          type: "status",
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
  for (const u of getAlive(state)) {
    if (u.def.race !== "warrior") continue;
    const wCnt = state.units.filter(
      (x) => x.team === u.team && !x.isDead && x.def.race === "warrior"
    ).length;
    u._warriorDr = void 0;
    u._warriorMagMult = void 0;
    u._warriorAtkMult = void 0;
    if (wCnt < 2) continue;
    const hpPct = Math.max(0, u.currentHp / u.maxHp);
    if (wCnt >= 4) {
      u._warriorDr = 0.15;
      u._warriorMagMult = 1.5;
      if (hpPct < 0.8) {
        u._warriorAtkMult = 1.15;
      }
    } else if (wCnt >= 3) {
      u._warriorDr = 0.1;
      u._warriorMagMult = 1.5;
      if (hpPct < 0.6) {
        u._warriorAtkMult = 1.1;
      }
    } else {
      u._warriorDr = 0.05;
      u._warriorMagMult = 1.5;
    }
  }
  if (!state._warriorTimerByTeam)
    state._warriorTimerByTeam = { ally: 0, enemy: 0 };
  for (const team of ["ally", "enemy"]) {
    const teamWarriors = getAlive(state).filter(
      (u) => u.team === team && u.def.race === "warrior"
    );
    const wCnt = teamWarriors.length;
    if (wCnt < 2) continue;
    state._warriorTimerByTeam[team] += 0.1;
    const period = wCnt >= 4 ? 9 : wCnt >= 3 ? 11 : 13;
    if (state._warriorTimerByTeam[team] < period) continue;
    state._warriorTimerByTeam[team] = 0;
    const pct = wCnt >= 4 ? 0.05 : wCnt >= 3 ? 0.04 : 0.03;
    for (const u of teamWarriors) {
      const heal = Math.floor(u.maxHp * pct);
      u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      addStat2(state, u.id, "totalHealingDone", heal);
      addStat2(state, u.id, "skillHealing", heal);
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
    if (
      u.equipmentId === "attention_hat" &&
      !u.isDead &&
      !u._attentionTriggered &&
      u.currentHp / u.maxHp < 0.6
    ) {
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
        type: "system",
      });
    }
  }
}
function updateMartyrPostmortem(state) {
  for (const xd2 of state.units.filter((u) => u.def.id === "xd" && u.isDead)) {
    if (xd2._xdPostmortemCd === void 0) xd2._xdPostmortemCd = 0;
    xd2._xdPostmortemCd -= 0.1;
    if (xd2._xdPostmortemCd > 0) continue;
    xd2._xdPostmortemCd = (xd2.def.skill.cooldown || 8) * 2;
    const enemies = getAttackableEnemies(state, xd2.team);
    if (enemies.length === 0) continue;
    const t = enemies[Math.floor(Math.random() * enemies.length)];
    const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
    t.statuses.push({
      type: "xd_dot",
      remainingSeconds: 4,
      stacks: 1,
      value: Math.max(1, Math.floor(defSum * 0.2 * 0.25)),
      sourceId: xd2.id,
      // v3.4 R2: 25%
    });
    state.battleLog.push({
      time: state.time,
      text: `\u271D ${xd2.def.name} \u9635\u4EA1\u540E\u7EE7\u7EED\u53D1\u52A8\u3010\u727A\u7272\u3011\u2192 ${t.def.name}`,
      type: "control",
    });
  }
}
function updateVictory(state) {
  if (state.time >= 180 && state.phase === "fighting") {
    state.phase = "finished";
    state.winner = "draw";
    state.battleLog.push({
      time: state.time,
      text: `\u23F0 \u6218\u6597\u8D85\u65F6(180s): \u5E73\u5C40\uFF01`,
      type: "system",
    });
    return;
  }
  const a = getAlive(state).filter((u) => u.team === "ally");
  const e = getAlive(state).filter((u) => u.team === "enemy");
  if (a.length === 0 || e.length === 0) {
    state.phase = "finished";
    state.winner = a.length > 0 ? "ally" : "enemy";
    state.battleLog.push({
      time: state.time,
      text: `\u{1F3C1} ${state.winner === "ally" ? "\u6211\u65B9" : "\u654C\u65B9"}\u80DC\u5229\uFF01`,
      type: "system",
    });
    state.battleLog.push({
      time: state.time,
      text: `\u2500\u2500 \u7EC8\u5C40\u7EDF\u8BA1 \u2500\u2500`,
      type: "system",
    });
    for (const s of state.stats || []) {
      const u = state.units.find((x) => x.id === s.unitId);
      if (!u) continue;
      const side = u.team === "ally" ? "\u{1F7E6}" : "\u{1F7E5}";
      state.battleLog.push({
        time: state.time,
        text: `${side} ${u.def.name}: \u4F24\u5BB3${s.totalDamageDealt || 0} \u6CBB\u7597${s.totalHealingDone || 0} \u51FB\u6740${s.kills || 0} \u66B4\u51FB${s.critCount || 0} \u683C\u6321${s.blockCount || 0}`,
        type: "system",
      });
    }
  }
}
function updateBonds(state) {
  const calc = (team) => {
    const rc = {};
    for (const u of state.units.filter((x) => x.team === team && !x.isDead))
      rc[u.def.race] = (rc[u.def.race] || 0) + 1;
    return Object.entries(rc)
      .filter(([_, c]) => c >= 3)
      .map(([r, c]) => ({ race: r, count: c }));
  };
  state.bonds = { ally: calc("ally"), enemy: calc("enemy") };
  for (const fxz2 of state.units.filter(
    (u) => !u.isDead && u.def.id === "fxz" && !isRuined(u)
  )) {
    const opp = fxz2.team === "ally" ? "enemy" : "ally";
    const symEnemy = state.units.find(
      (u) =>
        u.team === opp && !u.isDead && u.col === fxz2.col && u.row === fxz2.row
    );
    if (symEnemy) {
      symEnemy._analyzerOrigEva = symEnemy.evasion;
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
  if (sk.id === "wlgyz_heal") {
    caster._wlgyzCastCount = (caster._wlgyzCastCount || 0) + 1;
    if (caster._wlgyzCastCount % 3 === 0) caster._nextCdMult = 0.4;
  }
  if (!state.skillStats) state.skillStats = {};
  const skey = `${caster.id}_${sk.id}`;
  if (!state.skillStats[skey]) {
    state.skillStats[skey] = {
      skillName: sk.name,
      ownerId: caster.id,
      casts: 0,
      totalDamage: 0,
      physDmg: 0,
      magDmg: 0,
      pureDmg: 0,
      hits: 0,
      expectedHits: 0,
      interrupts: 0,
    };
  }
  state.skillStats[skey].casts += 1;
  state.skillStats[skey].expectedHits += sk.aoe?.maxTargets || 1;
  let enemies = getEnemies(state, caster.team);
  const holyCnt = state.units.filter(
    (u) => u.team !== caster.team && !u.isDead && u.def.race === "holy"
  ).length;
  caster._holySuppress = void 0;
  caster._holyMirror = void 0;
  if (holyCnt >= 2) {
    const isTag = (t) => sk.tags?.includes(t);
    if (
      isTag("\u589E\u76CA") ||
      isTag("\u6CBB\u7597") ||
      (isTag("\u63A7\u5236") && holyCnt >= 3)
    ) {
      caster._holySuppress = holyCnt >= 4 ? 0.2 : holyCnt >= 3 ? 0.15 : 0.1;
      caster._holyMirror = holyCnt >= 4 ? 3 : holyCnt >= 3 ? 2 : 1;
    }
  }
  const allies = getAlive(state, caster.team);
  let mageBondRolled = false;
  for (const fs of state.units.filter(
    (u) =>
      u.team === caster.team && !u.isDead && u.def.id === "xlds" && !isRuined(u)
  )) {
    if (fs.id === caster.id) continue;
    if (fs.row === caster.row) {
      fs._xldsStacks = Math.min(5, (fs._xldsStacks || 0) + 1);
      fs._xldsExpire = state.time + 5;
      state.battleLog.push({
        time: state.time,
        text: `\u{1F525} ${fs.def.name} \u540C\u6392\u6280\u80FD: \u653B\u901F+${fs._xldsStacks * 8}% (\u5171${fs._xldsStacks}\u5C42)`,
        type: "status",
      });
    }
  }
  for (const mage of state.units.filter(
    (u) =>
      u.team === caster.team && !u.isDead && u.def.id === "sjny" && !isRuined(u)
  )) {
    if (mage.id === caster.id) continue;
    const sameRow =
      mage.row === caster.row && Math.abs(mage.col - caster.col) <= 1;
    const sameCol =
      mage.col === caster.col && Math.abs(mage.row - caster.row) <= 1;
    if (sameRow || sameCol) {
      caster.cooldownRemaining = Math.max(
        0,
        caster.cooldownRemaining - 0.2 * caster.def.skill.cooldown
      );
    }
  }
  triggerLine(caster, "skill");
  for (const xdds2 of state.units.filter(
    (u) =>
      !u.isDead &&
      u.team === caster.team &&
      u.def.id === "xdds" &&
      u.row === caster.row &&
      !isRuined(u)
  )) {
    if (xdds2.id === caster.id) continue;
    const stacks = Math.min((xdds2._asStack || 0) + 1, 5);
    xdds2._asStack = stacks;
    const atkIntMult = 1 - stacks * 0.03;
    const baseInt = xdds2.def.stats.attackInterval;
    xdds2.attackTimer = Math.min(xdds2.attackTimer, baseInt * atkIntMult);
  }
  const xdTaunt = enemies.find(
    (e) => e._xdTauntUntil && e._xdTauntUntil > state.time && !e.isDead
  );
  if (xdTaunt) enemies = [xdTaunt];
  log.push({
    time: state.time,
    text: `${caster.def.name} \u91CA\u653E\u3010${sk.name}\u3011`,
    type: "skill",
    sourceId: caster.id,
  });
  caster.lastSkillCast = { name: sk.name, time: state.time };
  {
    const qd2 = state.units.find(
      (u) =>
        u.team === caster.team && !u.isDead && u.def.id === "qd" && !isRuined(u)
    );
    if (qd2) {
      const qEnemies = getEnemies(state, qd2.team).filter((e) => !e.isDead);
      const mates = state.units.filter((u) => u.team === qd2.team && !u.isDead);
      if (qEnemies.length > 0 && mates.length > 0) {
        const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
        const qr = calcDamage(qd2, qt, 0.03, "pure" /* Pure */, {
          isSkill: true,
        });
        qt.currentHp -= qr.finalDamage;
        addStat2(state, qd2.id, "totalDamageDealt", qr.finalDamage);
        const ht = mates[Math.floor(Math.random() * mates.length)];
        const h = Math.floor(qd2.currentAttack * 0.03);
        ht.currentHp = Math.min(ht.maxHp, ht.currentHp + h);
        addStat2(state, qd2.id, "totalHealingDone", h);
      }
    }
  }
  const handler = getSkillHandler(sk.scriptId || "");
  if (handler) {
    const scriptTargets = sk.aoe
      ? sk.id === "xcl_star"
        ? pick2x2(enemies)
        : shuffle2(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : [pickTarget2(enemies, sk.priority, false)].filter(Boolean);
    handler(caster, state, log, scriptTargets);
    {
      const qd2 = state.units.find(
        (u) =>
          u.team === caster.team &&
          !u.isDead &&
          u.def.id === "qd" &&
          !isRuined(u)
      );
      if (qd2 && sk.castTime > 0) {
        const qEnemies = getEnemies(state, qd2.team).filter((e) => !e.isDead);
        if (qEnemies.length > 0) {
          const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
          const qr = calcDamage(qd2, qt, 0.08, "pure" /* Pure */, {
            isSkill: true,
          });
          qt.currentHp -= qr.finalDamage;
          addStat2(state, qd2.id, "totalDamageDealt", qr.finalDamage);
        }
      }
    }
    return;
  }
  let actionTargets = [];
  const isCutIn = sk.tags?.includes("\u5207\u5165");
  caster._cutinDmgRed = void 0;
  if (isCutIn && enemies.length > 0) {
    const defenderHunterCnt = enemies.filter(
      (u) => !u.isDead && u.def.race === "hunter"
    ).length;
    if (defenderHunterCnt >= 3) {
      caster._cutinDmgRed = defenderHunterCnt >= 4 ? 0.75 : 0.85;
      log.push({
        time: state.time,
        text: `\u{1F3F9} \u730E\u4EBA\u7F81\u7ECA: \u53D7\u5230[\u5207\u5165]\u6280\u80FD\u4F24\u5BB3-${defenderHunterCnt >= 4 ? 25 : 15}%`,
        type: "status",
      });
    }
    const enemyZfyx = getEnemies(state, caster.team).find(
      (u) => u.def.id === "zfyx" && !u.isDead && !isRuined(u)
    );
    if (enemyZfyx) {
      caster._cutinDmgRed = (caster._cutinDmgRed ?? 1) * 0.65;
      for (const a of state.units.filter(
        (x) => x.team === enemyZfyx.team && !x.isDead
      )) {
        a._zfyxAtkStacks = Math.min(4, (a._zfyxAtkStacks || 0) + 1);
        a._zfyxAtkUntil = state.time + 6;
      }
      log.push({
        time: state.time,
        text: `\u{1F4A8} \u8FFD\u98CE\u6E38\u4FA0: \u5207\u5165\u4F24\u5BB3-35%\uFF0C\u5168\u961F+10%\u653B\xD7${enemyZfyx._zfyxAtkStacks}\u5C42`,
        type: "status",
      });
    }
    let cutTargets = [];
    if (sk.aoe) {
      cutTargets = shuffle2(enemies).slice(
        0,
        sk.aoe.maxTargets || enemies.length
      );
    } else {
      const t = pickTarget2(enemies, sk.priority, false);
      if (t) cutTargets = [t];
    }
    cutTargets = cutTargets.filter(
      (t) => !(t.def.id === "sszs" && !isRuined(t) && Math.random() < 0.3)
    );
    for (const t of cutTargets) {
      if (t.isDead) continue;
      const targetTeam2 = state.units.filter(
        (u) => u.team === t.team && !u.isDead
      );
      const hunterCount2 = targetTeam2.filter(
        (u) => u.def.race === "hunter"
      ).length;
      if (hunterCount2 >= 3 && t.def.race === "hunter") {
        if (!t._hunterBondLayers) t._hunterBondLayers = [];
        t._hunterBondLayers.push({
          value: hunterCount2 >= 4 ? 0.1 : 0.05,
          expire: state.time + (hunterCount2 >= 4 ? 20 : 25),
          // v3.4 R19: 4名 40s→20s
        });
        if (t._hunterBondLayers.length > 3) t._hunterBondLayers.shift();
        log.push({
          time: state.time,
          text: `\u{1F3F9} ${t.def.name} \u730E\u4EBA\u7F81\u7ECA\u53E0\u5C42: +${hunterCount2 >= 4 ? 10 : 5}%\u653B (${t._hunterBondLayers.length}/3)`,
          type: "status",
        });
      }
    }
  }
  if (sk.damage && enemies.length > 0) {
    let targets = [];
    if (sk.id === "hqs_snipe") {
      const maxDef = enemies.reduce(
        (m, e) => (!m || e.currentPhysicalDef > m.currentPhysicalDef ? e : m),
        void 0
      );
      if (maxDef) targets = [maxDef];
    } else if (sk.id === "hd_slash") {
      const row = [0, 1, 2][Math.floor(Math.random() * 3)];
      targets = enemies.filter((e) => e.row === row);
    } else if (sk.aoe) {
      if (sk.id === "dyq_dash") {
        targets = enemies.filter((e) => e.col === caster.col);
        if (targets.length === 0) targets = shuffle2(enemies).slice(0, 3);
      } else {
        const shuffled = shuffle2(enemies);
        targets = shuffled.slice(0, sk.aoe.maxTargets || enemies.length);
      }
    } else {
      const t = pickTarget2(enemies, sk.priority, false);
      if (t) targets = [t];
    }
    if (
      ["crzs_punch", "wqqs_move", "kldd_hammer"].includes(sk.id) &&
      targets.length > 0
    ) {
      const frontMid = enemies.filter((e) => e.row !== 2 /* Back */);
      if (
        frontMid.length > 0 &&
        targets.some((t) => t && t.row === 2 /* Back */)
      ) {
        targets = targets
          .map((t) =>
            t && t.row === 2 /* Back */
              ? pickTarget2(frontMid, void 0, false)
              : t
          )
          .filter(Boolean);
      }
    }
    for (const dmgFormula of sk.damage) {
      let hdHitCount = 0;
      for (const t of targets) {
        if (t.isDead) continue;
        actionTargets.push(t.def.name);
        const mageCnt = state.units.filter(
          (u) => u.team === caster.team && !u.isDead && u.def.race === "mage"
        ).length;
        const mageMdefMult =
          mageCnt >= 4 ? 0.7 : mageCnt >= 3 ? 0.8 : mageCnt >= 2 ? 0.85 : 1;
        const origMdef = t.currentMagicalDef;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = Math.floor(t.currentMagicalDef * mageMdefMult);
        let ratio = dmgFormula.atkRatio ?? 1;
        if (sk.id === "hx_cut") ratio = 2.1 + Math.random() * 0.3;
        if (sk.id === "mmx_stomp" && t.row === 0 /* Front */) ratio *= 1.2;
        if (sk.id === "mmx_stomp" && t.row === 2 /* Back */) {
          t.statuses.push({
            type: "disarm" /* Disarm */,
            remainingSeconds: 3,
            stacks: 1,
          });
        }
        const result = calcDamage(
          caster,
          t,
          ratio * (caster.skillPower || 1),
          dmgFormula.type,
          {
            fixedAdd: dmgFormula.fixedAdd,
            defMultiplier: dmgFormula.defMultiplier,
            defSquaredDiv: dmgFormula.defSquaredDiv,
            selfDefMultiplier: dmgFormula.selfDefMultiplier,
            targetMaxHpRatio: dmgFormula.targetMaxHpRatio,
            isSkill: true,
            evasion: t.evasion,
            hitRateMod: caster.hitRateMod,
          }
        );
        const fs = applyFatalStrike(caster, result.finalDamage, true);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        if (
          caster.def.id === "dyq" &&
          sk.aoe &&
          targets.filter((x) => !x.isDead).length >= 3
        ) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7);
        }
        if (sk.aoe && t.aoeDamageReduction) {
          result.finalDamage = Math.floor(
            result.finalDamage * (1 - t.aoeDamageReduction)
          );
        }
        deferDamage(t, result.finalDamage, state);
        const ldshzLv = t.level || 100;
        if (
          t.def.id === "ldshz" &&
          !isRuined(t) &&
          result.finalDamage > 0 &&
          (!t._ldshzShieldCd || state.time >= t._ldshzShieldCd) &&
          Math.random() < 0.4 + ldshzLv * 2e-3
        ) {
          t._ldshzShieldCd = state.time + 5;
          const absorbed = Math.floor(
            Math.min(result.finalDamage * 0.6, t.currentAttack * 6)
          );
          if (absorbed > 0) {
            result.finalDamage -= absorbed;
            addStat2(state, t.id, "shieldAbsorbed", absorbed);
            const allies2 = getAlive(state, t.team);
            const share = Math.floor(absorbed / Math.max(1, allies2.length));
            for (const a2 of allies2) {
              a2.currentHp = Math.min(a2.maxHp, a2.currentHp + share);
              addStat2(state, a2.id, "totalHealingReceived", share);
            }
            trackTalent(
              state,
              t.id,
              "\u81EA\u7136\u62A4\u76FE",
              absorbed,
              "heal"
            );
            state.battleLog.push({
              time: state.time,
              text: `\u{1F333} ${t.def.name} \u81EA\u7136\u62A4\u76FE: \u5438\u6536${absorbed} + \u5168\u961F\u6062\u590D${share}`,
              type: "heal",
            });
          }
        }
        if (
          dmgFormula.type === "magical" /* Magical */ &&
          result.finalDamage > 0
        ) {
          const guard = state.units.find(
            (x) =>
              x.team === t.team &&
              !x.isDead &&
              x.def.id === "slzs" &&
              x._slzsGuardUntil &&
              x._slzsGuardUntil > state.time &&
              x.row === t.row &&
              x.id !== t.id
          );
          if (guard) {
            guard.currentHp -= result.finalDamage;
            addStat2(
              state,
              guard.id,
              "totalDamageReceived",
              result.finalDamage
            );
            result.finalDamage = 0;
          }
        }
        if (sk.id === "hd_slash") {
          hdHitCount++;
          if (hdHitCount === 3 && result.finalDamage > 0) {
            result.finalDamage = Math.floor(result.finalDamage * 0.65);
          }
        }
        if (sk.id === "lbmx_smash" && result.finalDamage > 0) {
          t._lbmxArmorBreakUntil = Math.max(
            t._lbmxArmorBreakUntil || 0,
            state.time + 6
          );
          t._lbmxArmorBreakPct = 0.2;
        }
        if (
          caster._xldsStacks &&
          caster._xldsExpire &&
          state.time < caster._xldsExpire &&
          result.finalDamage > 0
        ) {
          const ls = Math.floor(result.finalDamage * caster._xldsStacks * 0.04);
          caster.currentHp = Math.min(caster.maxHp, caster.currentHp + ls);
          addStat2(state, caster.id, "lifeStealHealing", ls);
        }
        for (const xjl2 of state.units.filter(
          (u) =>
            u.team === caster.team &&
            !u.isDead &&
            (u.def.id === "xjl" || u._xjlTalentShare) &&
            !isRuined(u)
        )) {
          const xjlShare =
            xjl2.def.id === "xjl" ? 1 : xjl2._xjlTalentShare || 0.3;
          if (
            xjl2._xjlWindowStart === void 0 ||
            state.time - xjl2._xjlWindowStart >= 2
          ) {
            xjl2._xjlWindowStart = state.time;
            xjl2._xjlWindowHeal = 0;
          }
          const cap = Math.floor(xjl2.maxHp * 0.04 * xjlShare);
          const want = Math.floor(xjl2.maxHp * 0.02 * xjlShare);
          const heal = Math.max(
            0,
            Math.min(want, cap - (xjl2._xjlWindowHeal || 0))
          );
          if (heal > 0) {
            xjl2.currentHp = Math.min(xjl2.maxHp, xjl2.currentHp + heal);
            xjl2._xjlWindowHeal = (xjl2._xjlWindowHeal || 0) + heal;
            addStat2(state, xjl2.id, "totalHealingReceived", heal);
          }
        }
        const skStatus = sk.status || sk.statuses;
        const appliesDebuff = Array.isArray(skStatus)
          ? skStatus.length > 0
          : !!skStatus;
        if (appliesDebuff && !isRuined(caster)) {
          for (const bmxz2 of state.units.filter(
            (u) =>
              u.team === caster.team &&
              !u.isDead &&
              u.def.id === "bmxz" &&
              !isRuined(u)
          )) {
            bmxz2.cooldownRemaining = Math.max(0, bmxz2.cooldownRemaining - 1);
            bmxz2._bmxzAtkBonus = (bmxz2._bmxzAtkBonus || 0) + 8e-3;
          }
        }
        if (
          t.def.id === "slzs" &&
          !isRuined(t) &&
          result.finalDamage > 0 &&
          sk.damage?.[0]?.type === "magical" /* Magical */
        ) {
          if (Math.random() < 0.5) {
            const reflect = Math.floor(t.currentAttack * 1);
            caster.currentHp -= reflect;
            addStat2(state, t.id, "totalDamageDealt", reflect);
            addStat2(state, caster.id, "totalDamageReceived", reflect);
            caster.statuses.push({
              type: "stun" /* Stun */,
              remainingSeconds: 1,
              stacks: 1,
            });
            trackTalent(
              state,
              t.id,
              "\u9B54\u6CD5\u53CD\u5F39",
              reflect,
              "damage"
            );
            state.battleLog.push({
              time: state.time,
              text: `\u{1F6E1} ${t.def.name} \u9B54\u6CD5\u53CD\u5F39: ${reflect}\u7EAF\u4F24+\u7729\u6655`,
              type: "damage",
            });
          }
        }
        if (
          caster.def.id === "zs" &&
          !isRuined(caster) &&
          result.finalDamage > 0 &&
          Math.random() < 0.5
        ) {
          const bonus = Math.floor(t.currentHp * 0.08);
          if (bonus > 0) {
            t.currentHp -= bonus;
            addStat2(state, caster.id, "totalDamageDealt", bonus);
            addStat2(state, t.id, "totalDamageReceived", bonus);
            addStat2(state, caster.id, "magicalDamageDealt", bonus);
          }
        }
        if (
          caster.def.id === "swxz" &&
          !isRuined(caster) &&
          result.finalDamage > 0
        ) {
          caster._swxzAccum = (caster._swxzAccum || 0) + result.finalDamage;
          while (
            (caster._swxzAccum || 0) >= 700 &&
            (caster._swxzDrLayers || 0) < 10
          ) {
            caster._swxzAccum = (caster._swxzAccum || 0) - 700;
            caster._swxzDrLayers = (caster._swxzDrLayers || 0) + 1;
            caster.damageReduction = (caster.damageReduction || 0) + 0.035;
            trackTalent(
              state,
              caster.id,
              "\u8BC5\u5492\u7D2F\u79EF\u51CF\u4F24",
              1,
              "count"
            );
            state.battleLog.push({
              time: state.time,
              text: `\u2620 ${caster.def.name} \u8BC5\u5492\u7D2F\u79EF: \u51CF\u4F24+3.5% (\u5171${(caster._swxzDrLayers * 3.5).toFixed(1)}%)`,
              type: "status",
            });
          }
        }
        t._wasDamagedDuringCast = true;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = origMdef;
        t.lastDamage = {
          value: result.finalDamage,
          time: state.time,
          type: dmgFormula.type,
        };
        t.lastAction = { time: state.time, isTarget: true };
        addStat2(state, caster.id, "totalDamageDealt", result.finalDamage);
        addStat2(state, caster.id, "skillDamage", result.finalDamage);
        addStat2(
          state,
          caster.id,
          dmgFormula.type === "physical"
            ? "physicalDamage"
            : dmgFormula.type === "magical"
              ? "magicalDamage"
              : "pureDamage",
          result.finalDamage
        );
        trackSkill(
          state,
          caster.id,
          sk.id,
          sk.name,
          result.finalDamage,
          dmgFormula.type,
          { hitCount: 1 }
        );
        addStat2(state, t.id, "totalDamageReceived", result.finalDamage);
        addStat2(
          state,
          t.id,
          dmgFormula.type === "physical"
            ? "physicalDamageReceived"
            : dmgFormula.type === "magical"
              ? "magicalDamageReceived"
              : "pureDamageReceived",
          result.finalDamage
        );
        if (result.isCrit) {
          addStat2(state, caster.id, "critCount", 1);
          addStat2(state, caster.id, "critDamage", result.finalDamage);
          addStat2(state, t.id, "critsTaken", 1);
        }
        if (result.isBlocked) {
          addStat2(state, t.id, "blockCount", 1);
          addStat2(state, t.id, "blockReduced", result.blocked);
        }
        t.lastHitBy = caster.id;
        if (sk.id === "crzs_punch" && result.finalDamage > 0) {
          const backfire = Math.floor(result.finalDamage * 0.1);
          caster.currentHp -= backfire;
          addStat2(state, caster.id, "totalDamageReceived", backfire);
        }
        if (sk.id === "kldd_hammer") {
          t._hammerTarget = caster.id;
          t._hammerDueAt = state.time + 4;
          t._hammerDelayedDmg = Math.floor(caster.currentAttack * 0.75);
          const selfHeal = Math.floor(caster.currentAttack * 0.25);
          caster.currentHp = Math.min(
            caster.maxHp,
            caster.currentHp + selfHeal
          );
          addStat2(state, caster.id, "totalHealingDone", selfHeal);
        }
        if (result.finalDamage > 0) {
          const inBuff =
            (caster._atkBuffUntil && state.time < caster._atkBuffUntil) ||
            (caster._ylRoarMult && caster._ylRoarMult > 1.001) ||
            (caster._inspireAtkUntil && state.time < caster._inspireAtkUntil);
          if (inBuff) {
            caster._buffWinSkill =
              (caster._buffWinSkill || 0) + result.finalDamage;
          }
        }
        if (result.finalDamage > 0) {
          log.push({
            time: state.time,
            text: `${pfx2(caster)} \u2192 ${pfx2(t)}: ${result.finalDamage}${result.isCrit ? "\u{1F4A5}" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} type=${dmgFormula.type} def=${dmgFormula.type === "magical" ? Math.floor(t.currentMagicalDef) : Math.floor(t.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / (result.isCrit ? 1.35 : 1)).toFixed(0) : ""}` : ""}`,
            type: "damage",
          });
          if (mageCnt >= 3 && !mageBondRolled) {
            mageBondRolled = true;
            const chance = mageCnt >= 4 ? 0.5 : 0.3;
            const gain = mageCnt >= 4 ? 0.03 : 0.02;
            const dur = mageCnt >= 4 ? 25 : 15;
            if (Math.random() < chance) {
              for (const m of state.units.filter(
                (x) =>
                  x.team === caster.team && !x.isDead && x.def.race === "mage"
              )) {
                const layers = m._mageAtkLayers || (m._mageAtkLayers = []);
                layers.push({ value: gain, expire: state.time + dur });
                m._mageAtkMult =
                  1 + layers.reduce((sum, l) => sum + l.value, 0);
              }
              log.push({
                time: state.time,
                text: `\u2728 \u6CD5\u5E08\u7F81\u7ECA: \u5168\u4F53\u6CD5\u5E08\u653B\u51FB+${Math.round(gain * 100)}%\xD7${dur}s(\u72EC\u7ACB\u8BA1\u65F6)`,
                type: "status",
              });
            }
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
              type: "heal",
            });
          }
        }
      }
    }
  }
  if (sk.heal) {
    let lxgzEnhanced = false;
    let lxgzHealMult = 1;
    let lxgzDrPct = 0.15;
    if (sk.id === "lxgz_heal") {
      lxgzEnhanced = caster._lxgzEnhanceNext === true;
      caster._lxgzEnhanceNext = !lxgzEnhanced;
      lxgzHealMult = lxgzEnhanced ? 1.5 : 1;
      lxgzDrPct = lxgzEnhanced ? 0.225 : 0.15;
    }
    let targets = [];
    if (sk.id === "dxm_heal") {
      const beast = allies
        .filter((a) => a.def.race === "beast")
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      const all = allies.sort(
        (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
      );
      targets = [beast[0] || all[0]];
      caster._dxmCastCount = (caster._dxmCastCount || 0) + 1;
      const upgraded = caster._dxmCastCount % 4 === 0;
    } else if (sk.id === "lxgz_heal") {
      targets = allies
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)
        .slice(0, 2);
    } else if (sk.id === "wlgyz_heal") {
      const byHp = (arr) =>
        arr
          .slice()
          .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      targets = [
        ...byHp(allies.filter((a) => a.row === 0 /* Front */)),
        ...byHp(allies.filter((a) => a.row !== 0 /* Front */)),
      ].slice(0, 2);
    } else if (sk.id === "hbfl_heal") {
      const candidates = allies.filter(
        (a) => a.def.race === "dragon" && a.currentHp / a.maxHp < 0.75
      );
      targets = candidates.length > 0 ? [candidates[0]] : [];
    } else {
      targets = allies
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)
        .slice(0, 1);
    }
    for (const t of targets) {
      if (t.isDead) continue;
      actionTargets.push(t.def.name);
      if (sk.id === "hbfl_heal") {
        t.statuses.push({
          type: "freeze" /* Freeze */,
          remainingSeconds: 4,
          stacks: 1,
        });
        t.statuses.push({
          type: "hbfl_heal_dot",
          remainingSeconds: 4,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.7 + t.maxHp * 0.03),
          sourceId: caster.id,
        });
        state.battleLog.push({
          time: state.time,
          text: `\u{1F9CA} ${t.def.name} \u51B0\u5C014s\uFF0C\u6BCF\u79D2\u6CBB\u7597\xD74s`,
          type: "status",
        });
        continue;
      }
      if (sk.id === "lxgz_heal") {
        t.statuses.push({
          type: "lxgz_heal_dot",
          remainingSeconds: 6,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.25),
          sourceId: caster.id,
          healMult: lxgzHealMult,
        });
        t._lxgzDrUntil = state.time + 6;
        t._lxgzDrPct = lxgzDrPct;
        log.push({
          time: state.time,
          text: `\u{1F3B6} ${caster.def.name} \u6CBB\u6108\u7434\u97F3 ${t.def.name}: \u6BCF\u79D225%+\u76EE\u6807\u653B20%\xD76s + ${Math.round(lxgzDrPct * 100)}%\u51CF\u4F246s${lxgzEnhanced ? "\uFF08\u589E\u5F3A\uFF09" : ""}`,
          type: "heal",
        });
        continue;
      }
      const amount = calcHeal(caster, t, sk.heal.atkRatio ?? 1, {
        fixedAdd: sk.heal.fixedAdd,
        targetMaxHpRatio: sk.heal.targetMaxHpRatio,
        targetLostHpRatio: sk.heal.targetLostHpRatio,
      });
      let finalAmount = amount;
      if (
        sk.id === "dxm_heal" &&
        caster._dxmCastCount &&
        caster._dxmCastCount % 4 === 0
      ) {
        finalAmount = Math.floor(amount * 1.9);
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
          "poison",
        ];
        t.statuses = t.statuses.filter((s) => !neg.includes(s.type));
      }
      if (caster._holySuppress && sk.tags?.includes("\u6CBB\u7597")) {
        const sp = caster._holySuppress;
        const lv = caster._holyMirror;
        const mirrorPct = lv === 3 ? 0.15 : lv === 2 ? 0.1 : 0.04;
        const rawHeal = finalAmount;
        finalAmount = Math.floor(finalAmount * (1 - sp));
        const recipients = getAttackableEnemies(state, caster.team);
        const share = Math.floor(
          (rawHeal * mirrorPct) / Math.max(1, recipients.length)
        );
        for (const h of recipients) {
          h.currentHp = Math.min(h.maxHp, h.currentHp + share);
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1F54A} \u5723\u804C\u8005\u7F81\u7ECA: \u654C\u65B9\u6CBB\u7597-${Math.round(sp * 100)}% + \u6211\u65B9\u5168\u4F53\u5E73\u5206\u539F\u672C${Math.round(mirrorPct * 100)}%\u6CBB\u7597`,
          type: "heal",
        });
      }
      if (t._syzHealBoostUntil && t._syzHealBoostUntil > state.time) {
        finalAmount = Math.floor(finalAmount * 1.3);
      }
      caster.lastHealTarget = t.id;
      t.lastHeal = { value: finalAmount, time: state.time };
      t.currentHp = Math.min(t.maxHp, t.currentHp + finalAmount);
      if (caster.def.id === "lxgz" && !isRuined(caster)) {
        t._inspireAtkUntil = state.time + 6;
        t._inspireAtkMult = 1.2;
        trackTalent(
          state,
          caster.id,
          "\u6FC0\u6602(+20%\u653B)",
          Math.floor(t.currentAttack * 0.2 * 5),
          "buff"
        );
        log.push({
          time: state.time,
          text: `\u{1F3B6} ${t.def.name} \u6FC0\u6602: \u653B\u51FB+20%\u653B\u901F+12% (5s)`,
          type: "status",
        });
      }
      t.lastHeal = { value: amount, time: state.time };
      t.lastAction = { time: state.time, isTarget: true };
      addStat2(state, caster.id, "totalHealingDone", amount);
      addStat2(state, caster.id, "skillHealing", amount);
      addStat2(state, t.id, "totalHealingReceived", amount);
      log.push({
        time: state.time,
        text: `${pfx2(caster)} \u{1F49A} ${pfx2(t)}: +${amount}${state._debug ? ` (atk=${Math.floor(caster.currentAttack)} \xD7 ${sk.heal.atkRatio ?? 1})` : ""}`,
        type: "heal",
      });
    }
  }
  if (actionTargets.length > 0) {
    caster.lastAction = {
      time: state.time,
      targetName: [...new Set(actionTargets)].join(","),
    };
  }
  if (sk.tags?.includes("\u79FB\u52A8") && !isRuined(caster) && !sk.scriptId) {
    moveToRandomEmpty(caster, state);
    if (caster.def.id === "zfyx") {
      caster.evasion = (caster.evasion || 0) + 0.4;
      caster._zfyxEvaUntil = state.time + 4;
    }
    log.push({
      time: state.time,
      text: `\u{1F3C3} ${caster.def.name} \u79FB\u52A8\u81F3 (${caster.row},${caster.col})`,
      type: "status",
    });
  }
  if (sk.effects) {
    const effSuppress =
      caster._holySuppress &&
      (sk.tags?.includes("\u589E\u76CA") || sk.tags?.includes("\u63A7\u5236"))
        ? caster._holySuppress
        : 0;
    if (effSuppress > 0) {
      const sp = effSuppress;
      if (
        sk.tags?.includes("\u589E\u76CA") &&
        sk.effects.some((e) => String(e.type).toLowerCase().includes("atk"))
      ) {
        const mirrorPct =
          caster._holyMirror === 3
            ? 0.2
            : caster._holyMirror === 2
              ? 0.15
              : 0.1;
        for (const h of state.units.filter(
          (x) => x.team !== caster.team && !x.isDead && x.def.race === "holy"
        )) {
          h._holyAtkMirrorUntil =
            state.time + (caster._holyMirror === 3 ? 5 : 4);
          h._holyAtkMirrorPct = mirrorPct;
        }
        state.battleLog.push({
          time: state.time,
          text: `\u{1F54A} \u5723\u804C\u8005\u7F81\u7ECA: \u654C\u65B9\u589E\u76CA-${Math.round(sp * 100)}% + \u5723\u804C\u8005\u653B+${Math.round(mirrorPct * 100)}%`,
          type: "status",
        });
      }
    }
    if (caster._holySuppress && sk.tags?.includes("\u63A7\u5236")) {
      const lv = caster._holyMirror;
      const pct = lv === 3 ? 0.1 : lv === 2 ? 0.05 : 0;
      if (pct > 0) {
        const pool = state.units.filter(
          (x) => x.team === caster.team && !x.isDead
        );
        const victim =
          pool.length > 0
            ? pool[Math.floor(Math.random() * pool.length)]
            : void 0;
        if (victim) {
          const ratio = (sk.damage?.[0]?.atkRatio ?? 1) * pct;
          const r = calcDamage(caster, victim, ratio, "pure" /* Pure */, {
            isSkill: true,
          });
          victim.currentHp -= r.finalDamage;
          for (const eff of sk.effects ?? []) {
            victim.statuses.push({
              type: eff.type,
              remainingSeconds: Math.max(0.5, (eff.duration ?? 1) * pct),
              stacks: 1,
              value: eff.value,
            });
          }
          log.push({
            time: state.time,
            text: `\u{1F54A} \u5723\u804C\u8005\u7F81\u7ECA(\u63A7\u5236\u53CD\u5236): ${victim.def.name} \u53D7\u5230 ${Math.round(pct * 100)}% \u540C\u6280\u80FD`,
            type: "status",
          });
        }
      }
    }
    const selfBuffTypes = ["bloodrage", "inspire", "atkup", "defup"];
    const isSelfBuff = sk.effects.some((e) =>
      selfBuffTypes.includes(String(e.type).toLowerCase())
    );
    const targets = isSelfBuff
      ? [caster]
      : sk.aoe
        ? sk.id === "xcl_star"
          ? pick2x2(enemies)
          : sk.id === "wlgyz_heal"
            ? shuffle2(enemies).slice(0, 1)
            : shuffle2(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
        : [pickTarget2(enemies, sk.priority, false)].filter(Boolean);
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
          "poison",
        ];
        if (negative.includes(eff.type) && t._immuneAbnormal) continue;
        if (
          [
            "silence" /* Silence */,
            "ruin" /* Ruin */,
            "disarm" /* Disarm */,
            "curse" /* Curse */,
          ].includes(eff.type) &&
          t.def.id === "sq"
        )
          continue;
        const val =
          eff.type === "burn"
            ? Math.floor(caster.currentAttack * (eff.value || 0.05))
            : eff.value;
        let effType = eff.type;
        if (
          sk.id === "ynfs_annihilate" &&
          eff.type === "bind" /* Bind */ &&
          Math.random() < 0.5
        ) {
          effType = "armorBreak"; /* ArmorBreak */
        }
        t.statuses.push({
          type: effType,
          remainingSeconds:
            eff.duration !== void 0
              ? Math.max(0.5, eff.duration * (1 - effSuppress))
              : eff.duration,
          stacks: 1,
          value: val !== void 0 ? Math.floor(val * (1 - effSuppress)) : val,
        });
        if (sk.id === "wqqs_move" && eff.type === "curse" /* Curse */) {
          const nearby = enemies.filter(
            (e) =>
              e.id !== t.id &&
              Math.max(Math.abs(e.row - t.row), Math.abs(e.col - t.col)) <= 1 &&
              !e.isDead
          );
          const spread = shuffle2(nearby).slice(0, 3);
          for (const sp of spread) {
            sp.statuses.push({
              type: "curse" /* Curse */,
              remainingSeconds: eff.duration,
              stacks: 1,
            });
          }
        }
        if (
          eff.type === "bloodrage" /* Bloodrage */ &&
          caster.def.id === "kzs"
        ) {
          const cost = Math.floor(caster.currentHp * 0.1);
          caster.currentHp -= cost;
          addStat2(state, caster.id, "totalDamageReceived", cost);
          trackTalent(
            state,
            caster.id,
            "\u8840\u6012(\u6D88\u801710%HP)",
            cost,
            "count"
          );
        }
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
  if (field === "totalDamageDealt" && value > 0) {
    const u = state.units?.find((x) => x.id === unitId);
    if (u) {
      if (!u._dmgWindow) u._dmgWindow = [];
      u._dmgWindow.push({ t: state.time, v: value });
      const cutoff = state.time - 9;
      u._dmgWindow = u._dmgWindow.filter((e) => e.t >= cutoff);
      u._dmgRecent9s = u._dmgWindow.reduce((sum, e) => sum + e.v, 0);
    }
  }
}
function trackSkill(
  state,
  unitId,
  skillId,
  skillName,
  damage,
  dmgType,
  options
) {
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
      pureDmg: 0,
      hits: 0,
      expectedHits: 0,
      interrupts: 0,
    };
  }
  const s = state.skillStats[key];
  s.totalDamage += damage;
  s.hits = (s.hits || 0) + (options?.hitCount ?? 1);
  if (options?.expectedHits)
    s.expectedHits = (s.expectedHits || 0) + options.expectedHits;
  if (options?.interrupted) s.interrupts = (s.interrupts || 0) + 1;
  if (dmgType === "physical") s.physDmg += damage;
  else if (dmgType === "magical") s.magDmg += damage;
  else s.pureDmg += damage;
}
function trackTalent(state, unitId, talentName, value, valueType = "count") {
  if (!state.talentStats) state.talentStats = {};
  const key = `${unitId}_${talentName}`;
  const existing = state.talentStats[key];
  if (!existing) {
    state.talentStats[key] = {
      talentName,
      ownerId: unitId,
      triggers: 0,
      value: 0,
      valueType,
    };
  }
  const t = state.talentStats[key];
  t.triggers += 1;
  t.value += value;
  if (valueType === "damage") addStat2(state, unitId, "talentDamage", value);
  else if (valueType === "heal")
    addStat2(state, unitId, "talentHealing", value);
  else if (valueType === "buff") addStat2(state, unitId, "buffValue", value);
  else if (valueType === "control")
    addStat2(state, unitId, "controlSeconds", value);
}

// scripts/v33_mirror.ts
var ROSTER = {
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"],
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"],
};
var CN = {
  beast: "\u517D\u65CF",
  hunter: "\u730E\u4EBA",
  warrior: "\u6218\u58EB",
  mage: "\u6CD5\u5E08",
  undead: "\u4EA1\u7075",
  dragon: "\u9F99\u65CF",
  holy: "\u5723\u804C\u8005",
};
var positions = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
];
var makeTeam = (ids) =>
  ids.slice(0, 8).map((charId, i) => ({
    charId,
    row: positions[i][0],
    col: positions[i][1],
  }));
var runs = parseInt(process.argv[2] || "300", 10) || 300;
console.log(
  `=== \u955C\u50CF\u5BF9\u79F0\u6027\u4E13\u9879\uFF1A\u6BCF\u65CF ${runs} \u5C40 ===`
);
var z = 1.96;
for (const [race, ids] of Object.entries(ROSTER)) {
  let first = 0;
  for (let k = 0; k < runs; k++) {
    const s = initBattle(makeTeam(ids), makeTeam(ids));
    let guard = 0;
    while (s.phase === "fighting" && guard < 3e3) {
      processTick(s);
      guard++;
    }
    if (s.winner === "ally") first += 1;
    else if (s.winner === "draw") first += 0.5;
  }
  const p = first / runs;
  const denom = 1 + (z * z) / runs;
  const center = (p + (z * z) / (2 * runs)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / runs + (z * z) / (4 * runs * runs))) / denom;
  const lo = ((center - half) * 100).toFixed(1);
  const hi = ((center + half) * 100).toFixed(1);
  const pct = (p * 100).toFixed(1);
  const flag =
    Math.abs(p - 0.5) > 0.05 ? "  \u26A0 \u8D85\u51FA 45-55%" : "  \u2705";
  console.log(
    `${CN[race].padEnd(4)} \u5148\u624B ${pct}%  Wilson95% [${lo}%, ${hi}%]${flag}`
  );
}
