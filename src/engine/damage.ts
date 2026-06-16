import { ArenaUnit, DamageType, Race, StatusType } from "../types";

/**
 * Defense reduction formula v5.2 (segmented):
 *   def 0-500:   1 - 1/(1 + def/680)^1.6
 *   def 500-1500: 0.585 + (def-500) * 0.000215
 *   def >1500:   0.80 (cap)
 */
export function calcDefReduction(def: number): number {
  if (def <= 0) return 0;
  if (def <= 500) {
    return 1 - 1 / Math.pow(1 + def / 680, 1.6);
  }
  if (def <= 1500) {
    return Math.min(0.585 + (def - 500) * 0.000215, 0.8);
  }
  return 0.8;
}

/** Block chance by race, +10% if in front row */
function getBlockChance(race: Race, isFrontRow: boolean = false): number {
  switch (race) {
    case Race.Beast:
    case Race.Warrior:
    case Race.Dragon:
      return 0.35;
    case Race.Hunter:
    case Race.Mage:
      return 0.25;
    case Race.Undead:
      return 0.15;
    default:
      return 0;
  }
}

/** Block value (v2.0): Beast def/4, others def/6 */
function calcBlockValue(def: number, race: Race): number {
  if (race === Race.Beast) return Math.floor(def / 4);
  return Math.floor(def / 6);
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

/** Check crit, considering tenacity */
export function checkCrit(critRate: number, tenacity: number = 0): boolean {
  // v2.0: base crit rate 7.5%
  // Tenacity reduces: actualRate = critRate * (1 - 0.0025 * tenacity)
  const reduction = 1 - 0.0025 * Math.min(tenacity, 100);
  return Math.random() < critRate * reduction;
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
    defMultiplier?: number; // for pure dmg: targetDef × X
    selfDefMultiplier?: number; // for pure dmg: selfDef × X
    targetMaxHpRatio?: number;
    cdrOverride?: number; // other dmg reduction (e.g. Prophet -30%)
    evasion?: number; // target evasion rate
    hitRateMod?: number; // attacker hit rate modifier
    isSkill?: boolean; // is this a skill (for hell hound)
    defSquaredDiv?: number; // def^2 / X for湮灭法师
    targetCurrentHpRatio?: number; // Zeus: % of target current HP
  }
): DamageResult {
  const result: DamageResult = {
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

  // --- Hit check ---
  const evasion = defender.statuses.some(
    (s: any) => s.type === StatusType.Petrify
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

  // --- Raw damage ---
  if (type === DamageType.Pure) {
    // Pure damage: no def reduction, no block
    if (extraOpts?.defMultiplier) {
      result.rawDamage = defender.currentPhysicalDef * extraOpts.defMultiplier;
    } else if (extraOpts?.defSquaredDiv) {
      const totalDef = defender.currentPhysicalDef + defender.currentMagicalDef;
      result.rawDamage = Math.floor(
        (totalDef * totalDef) / extraOpts.defSquaredDiv
      );
    } else if (extraOpts?.selfDefMultiplier) {
      // Use attacker's own defense? Or physicalDef as base
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
    // Physical/Magical
    const atk = attacker.currentAttack;
    // Status debuffs
    const effectiveAtk =
      atk *
      (attacker.statuses.some((s: any) => s.type === StatusType.Burn)
        ? 0.9
        : 1) *
      (attacker.statuses.some((s: any) => s.type === StatusType.Curse)
        ? 0.9
        : 1);
    result.rawDamage =
      effectiveAtk * skillAtkRatio +
      (extraOpts?.fixedAdd ?? 0) +
      (extraOpts?.targetCurrentHpRatio
        ? defender.currentHp * extraOpts.targetCurrentHpRatio
        : 0);
  }

  // --- Defense reduction ---
  if (type === DamageType.Physical) {
    let def = defender.currentPhysicalDef;
    // Curse: defender defense -10%
    if (defender.statuses.some((s: any) => s.type === StatusType.Curse))
      def *= 0.9;
    // ArmorBreak: base defense失效, extra defense 50% (total = current * 0.5)
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak))
      def *= 0.5;
    if (extraOpts?.ignoreBaseDef) {
      def = 0; // Ignore all defense for counter-attack etc.
    }
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else if (type === DamageType.Magical) {
    let def = defender.currentMagicalDef;
    // Curse: -10% mdef
    if (defender.statuses.some((s: any) => s.type === StatusType.Curse))
      def *= 0.9;
    // ArmorBreak: also applies to magical defense (both def types)
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak))
      def *= 0.5;
    // Petrify: +100% mdef
    if (defender.statuses.some((s: any) => s.type === StatusType.Petrify))
      def *= 2;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
  } else {
    // Pure damage: ignore def
    result.afterDef = result.rawDamage;
  }

  // --- Front row reduction ---
  if (defender.row === 0) {
    // front row (Row.Front = 0)
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
  // Check if defender has Inspire — use status value as multiplier (e.g. 0.55 = -45%)
  const inspire = defender.statuses.find((s) => s.type === StatusType.Inspire);
  if (inspire) {
    otherReduction *= inspire.value ?? 0.7;
  }
  result.afterOtherReduction = result.afterFrontRow * otherReduction;

  // --- Block check (physical/magical only, not pure) ---
  if (type !== DamageType.Pure) {
    const blockChance = getBlockChance(defender.def.race, defender.row === 0);
    if (Math.random() < blockChance) {
      result.isBlocked = true;
      const def =
        type === DamageType.Physical
          ? defender.currentPhysicalDef
          : defender.currentMagicalDef;
      result.blocked = calcBlockValue(def, defender.def.race);
    }
  }

  // --- Final damage ---
  result.finalDamage = Math.max(
    0,
    Math.floor(result.afterOtherReduction - result.blocked)
  );

  // --- Crit check (v2.0: base 7.5%, tenacity reduces) ---
  const baseCritRate = 0.075;
  // Get tenacity from defender (front row +5%, bond bonuses)
  const defenderTenacity = (defender as any).tenacity || 0;
  result.isCrit = checkCrit(baseCritRate, defenderTenacity);
  if (result.isCrit && result.finalDamage > 0) {
    // Tenacity also reduces crit damage: dmg * 1.35 * (1 - 0.004 * tenacity)
    const critDmgMult = 1.35 * (1 - 0.004 * Math.min(defenderTenacity, 100));
    result.finalDamage = Math.floor(
      result.finalDamage * Math.max(critDmgMult, 1)
    );
  }

  // Fatal strike handled externally by applyFatalStrike()

  return result;
}

/** Apply Hell Hound fatal strike: independent from crit */
export function applyFatalStrike(
  attacker: any,
  damage: number,
  isSkill: boolean
): { damage: number; triggered: boolean } {
  if (attacker.def.id !== "dyq" || damage <= 0)
    return { damage, triggered: false };
  const chance = isSkill ? 0.35 : 0.15;
  if (Math.random() < chance) {
    const fatal = Math.floor(damage * 1.4);
    // If revived, fatal damage is 1.75x instead of 1.40x
    const mult = attacker.hasRevived ? 1.75 : 1.4;
    const fatal2 = Math.floor(damage * mult);
    return { damage: Math.max(damage, fatal2), triggered: fatal2 > damage };
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
  }
): number {
  let heal = healer.currentAttack * atkRatio + (extraOpts?.fixedAdd ?? 0);
  if (extraOpts?.targetMaxHpRatio) {
    heal += target.maxHp * extraOpts.targetMaxHpRatio;
  }
  if (extraOpts?.targetLostHpRatio) {
    heal += (target.maxHp - target.currentHp) * extraOpts.targetLostHpRatio;
  }
  // Check for curse (-25% healing received)
  if (target.statuses.find((s) => s.type === StatusType.Curse)) {
    heal *= 0.75;
  }
  // Check for freeze (-50% healing received)
  if (target.statuses.find((s) => s.type === StatusType.Freeze)) {
    heal *= 0.5;
  }
  // Check for anti-heal (no healing at all)
  if (target.statuses.find((s) => s.type === StatusType.AntiHeal)) {
    heal = 0;
  }
  return Math.floor(Math.max(0, heal));
}
