import { ArenaUnit, DamageType, Race, StatusType } from '../types';

/** def/(def+200), cap 80% at def=800 */
export function calcDefReduction(def: number): number {
  return Math.min(def / (def + 200), 0.8);
}

/** Block chance by race, +10% if in front row */
function getBlockChance(race: Race, isFrontRow: boolean = false): number {
  let chance: number;
  switch (race) {
    case Race.Beast:
    case Race.Warrior: chance = 0.35; break;
    case Race.Hunter:
    case Race.Mage: chance = 0.25; break;
    case Race.Undead:
    case Race.Dragon: chance = 0.15; break;
    default: chance = 0.15;
  }
  if (isFrontRow) chance += 0.1;
  return chance;
}

/** Block value: Beast uses def/5, others def/7 */
function calcBlockValue(def: number, race: Race): number {
  if (race === Race.Beast) return Math.floor(def / 5);
  return Math.floor(def / 7);
}

export interface DamageResult {
  rawDamage: number;
  afterDef: number;
  afterFrontRow: number;
  afterOtherReduction: number;
  blocked: number;
  finalDamage: number;
  isCrit: boolean;
  isBlocked: boolean;
  isDodged: boolean;
  hit: boolean;
}

/** Check if attack hits (hit rate vs evasion) */
export function checkHit(hitRateMod: number, evasion: number): boolean {
  const finalHitRate = Math.min(1, Math.max(0.3, 1 + hitRateMod - evasion));
  return Math.random() < finalHitRate;
}

/** Check crit */
export function checkCrit(critRate: number): boolean {
  return Math.random() < critRate;
}

/**
 * Calculate damage for physical/magical attack
 * Formulas from v1.4:
 *   rawDmg = totalAttack × skillRatio + fixedAdd
 *   defReduction = def/(def+200), max 80%
 *   frontRowReduction = 0.9 if target is in front
 *   otherReduction = (1 - Σ other % reductions)
 *   block: if blockChance procs, blockValue = floor(def/7) or floor(def/5)
 *   finalDmg = max(afterOtherReduction - blockValue, 0)
 *   crit: multiply final damage by 1.35
 */
export function calcDamage(
  attacker: ArenaUnit,
  defender: ArenaUnit,
  skillAtkRatio: number,
  type: DamageType,
  extraOpts?: {
    ignoreBaseDef?: boolean;
    fixedAdd?: number;
    defMultiplier?: number;      // for pure dmg: targetDef × X
    selfDefMultiplier?: number;  // for pure dmg: selfDef × X
    targetMaxHpRatio?: number;
    cdrOverride?: number;        // other dmg reduction (e.g. Prophet -30%)
    evasion?: number;             // target evasion rate
    hitRateMod?: number;          // attacker hit rate modifier
    isSkill?: boolean;            // is this a skill (for hell hound)
  },
): DamageResult {
  const result: DamageResult = {
    rawDamage: 0, afterDef: 0, afterFrontRow: 0, afterOtherReduction: 0,
    blocked: 0, finalDamage: 0, isCrit: false, isBlocked: false, isDodged: false, hit: true,
  };

  // --- Hit check ---
  if ((extraOpts?.evasion ?? 0) > 0 || (extraOpts?.hitRateMod ?? 0) !== 0) {
    const hit = checkHit(extraOpts?.hitRateMod ?? 0, extraOpts?.evasion ?? 0);
    result.hit = hit;
    if (!hit) {
      result.finalDamage = 0;
      return result;
    }
  }

  // --- Raw damage ---
  if (type === DamageType.Pure) {
    // Pure damage: no def reduction, no block
    if (extraOpts?.defMultiplier) {
      result.rawDamage = defender.currentPhysicalDef * extraOpts.defMultiplier;
    } else if (extraOpts?.defSquaredDiv) {
      const totalDef = defender.currentPhysicalDef + defender.currentMagicalDef;
      result.rawDamage = Math.floor(totalDef * totalDef / extraOpts.defSquaredDiv);
    } else if (extraOpts?.selfDefMultiplier) {
      // Use attacker's own defense? Or physicalDef as base
      result.rawDamage = attacker.currentPhysicalDef * extraOpts.selfDefMultiplier;
    } else if (extraOpts?.targetMaxHpRatio) {
      result.rawDamage = defender.maxHp * extraOpts.targetMaxHpRatio;
    } else {
      result.rawDamage = attacker.currentAttack * (skillAtkRatio ?? 1) + (extraOpts?.fixedAdd ?? 0);
    }
  } else {
    // Physical/Magical
    const atk = attacker.currentAttack;
    result.rawDamage = atk * skillAtkRatio + (extraOpts?.fixedAdd ?? 0);
  }

  // --- Defense reduction ---
  if (type === DamageType.Physical) {
    let def = defender.currentPhysicalDef;
    if (extraOpts?.ignoreBaseDef) {
      // Only keep "extra" defense. For simplicity, we treat growth def as base
      // In the prototype, all def is base def (no equipment), so ignoreBaseDef makes def=0
      // But bond bonuses are extra defense
      const bondDef = def * 0; // simplified: no bond extra def tracking
      def = def * 0.5; // simplified: keep 50% as "extra"
    }
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else if (type === DamageType.Magical) {
    // Apply mage bond: -60% mdef if 3 mages on attacker's team
    const def = defender.currentMagicalDef;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else {
    // Pure damage: ignore def
    result.afterDef = result.rawDamage;
  }

  // --- Front row reduction ---
  if (defender.row === 0) { // front row (Row.Front = 0)
    result.afterFrontRow = result.afterDef * 0.9;
    // Only apply once
  } else {
    result.afterFrontRow = result.afterDef;
  }

  // --- Other reduction (e.g. Prophet's blessing -30%) ---
  let otherReduction = 1;
  if (extraOpts?.cdrOverride !== undefined) {
    otherReduction *= extraOpts.cdrOverride;
  }
  // Check if defender has Prophet's shield (Inspire status as proxy)
  if (defender.statuses.find(s => s.type === StatusType.Inspire)) {
    otherReduction *= 0.7; // -30%
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;

  // --- Block check (physical/magical only, not pure) ---
  if (type !== DamageType.Pure) {
    const blockChance = getBlockChance(defender.def.race, defender.row === 0);
    if (Math.random() < blockChance) {
      result.isBlocked = true;
      const def = type === DamageType.Physical ? defender.currentPhysicalDef : defender.currentMagicalDef;
      result.blocked = calcBlockValue(def, defender.def.race);
    }
  }

  // --- Final damage ---
  result.finalDamage = Math.max(0, Math.floor(result.afterOtherReduction - result.blocked));

  // --- Crit check ---
  const baseCritRate = 0.05;
  result.isCrit = checkCrit(baseCritRate);
  if (result.isCrit && result.finalDamage > 0) {
    result.finalDamage = Math.floor(result.finalDamage * 1.35);
  }

  // Hell Hound fatal strike: independent from crit, take max
  if (attacker.def.id === 'dyq' && result.finalDamage > 0) {
    const isSkill = extraOpts?.isSkill || false;
    const fatalChance = isSkill ? 0.35 : 0.25;
    if (Math.random() < fatalChance) {
      const fatalDamage = Math.floor(result.finalDamage / (result.isCrit ? 1.35 : 1) * 1.5);
      if (fatalDamage > result.finalDamage) {
        result.finalDamage = fatalDamage;
        result.isCrit = true; // show as crit visually
      }
    }
  }

  return result;
}

/** Apply Hell Hound fatal strike: independent from crit */
export function applyFatalStrike(attacker: any, damage: number, isSkill: boolean): { damage: number; triggered: boolean } {
  if (attacker.def.id !== 'dyq' || damage <= 0) return { damage, triggered: false };
  const chance = isSkill ? 0.35 : 0.25;
  if (Math.random() < chance) {
    const fatal = Math.floor(damage * 1.5);
    return { damage: Math.max(damage, fatal), triggered: fatal > damage };
  }
  return { damage, triggered: false };
}

/** Calculate heal amount */
export function calcHeal(
  healer: ArenaUnit,
  target: ArenaUnit,
  atkRatio: number,
  extraOpts?: {
    fixedAdd?: number;
    targetMaxHpRatio?: number;
    targetLostHpRatio?: number;
  },
): number {
  let heal = healer.currentAttack * atkRatio + (extraOpts?.fixedAdd ?? 0);
  if (extraOpts?.targetMaxHpRatio) {
    heal += target.maxHp * extraOpts.targetMaxHpRatio;
  }
  if (extraOpts?.targetLostHpRatio) {
    heal += (target.maxHp - target.currentHp) * extraOpts.targetLostHpRatio;
  }
  // Check for curse (-25% healing received)
  if (target.statuses.find(s => s.type === StatusType.Curse)) {
    heal *= 0.75;
  }
  // Check for freeze (-50% healing received)
  if (target.statuses.find(s => s.type === StatusType.Freeze)) {
    heal *= 0.5;
  }
  return Math.floor(Math.max(0, heal));
}
