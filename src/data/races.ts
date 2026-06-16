import { Race } from "../types";

export interface BondEffect {
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  hitRateBonus: number;
  evasionBonus: number;
  special?: string;
}

interface TierData {
  2: Partial<BondEffect>;
  3: Partial<BondEffect>;
  4: Partial<BondEffect>;
}

const BASE_BONDS: Record<Race, TierData> = {
  [Race.Beast]: {
    2: { attackBonus: 10, defenseBonus: 5 },
    3: {
      attackBonus: 15,
      defenseBonus: 10,
      special: "韧性+10%+对<50%HP敌人5%攻击纯粹伤害",
    },
    4: {
      attackBonus: 25,
      defenseBonus: 20,
      special: "韧性+35%+对<50%HP敌人10%攻击纯粹伤害",
    },
  },
  [Race.Hunter]: {
    2: { attackBonus: 5, hitRateBonus: 10 },
    3: {
      attackBonus: 10,
      hitRateBonus: 20,
      special: "反击75%伤害+每5次攻击额外1目标",
    },
    4: {
      attackBonus: 20,
      hitRateBonus: 40,
      special: "反击100%无视防御+每3次攻击额外1目标",
    },
  },
  [Race.Warrior]: {
    2: { hpBonus: 15 },
    3: { hpBonus: 25, special: "每12s恢复4%HP+15%吸血" },
    4: { hpBonus: 40, special: "每12s恢复8%HP+25%吸血" },
  },
  [Race.Mage]: {
    2: { special: "-20%魔防" },
    3: { special: "-35%魔防+15%技能吸血" },
    4: { special: "-50%魔防+30%技能吸血" },
  },
  [Race.Undead]: {
    2: { attackBonus: 5, evasionBonus: 5 },
    3: {
      attackBonus: 10,
      evasionBonus: 15,
      special: "复活13s+每秒6%HP/8s+无敌1s",
    },
    4: {
      attackBonus: 20,
      evasionBonus: 30,
      special: "复活7s+每秒7%HP/10s+无敌3s",
    },
  },
  [Race.Dragon]: {
    2: {},
    3: { special: "CD-30%+减伤5%+开局3倍减伤6s" },
    4: { special: "CD-80%+减伤10%+开局4倍减伤10s" },
  },
};

/** Get bond effect at a specific member count, rolling up to the highest tier if count exceeds */
export function getBondAtTier(race: Race, count: number): BondEffect {
  const tiers = BASE_BONDS[race];
  // Find the highest applicable tier
  let tier: Partial<BondEffect> = {};
  for (const t of [2, 3, 4] as const) {
    if (count >= t && tiers[t]) tier = { ...tier, ...tiers[t] };
  }
  // Apply custom overrides
  let overrides: Record<string, Partial<BondEffect>> = {};
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
    evasionBonus: ov.evasionBonus ?? tier.evasionBonus ?? 0,
    special: ov.special ?? tier.special,
  };
}

/** Re-export for DataEditor */
export function getBaseBondTiers(): Record<Race, TierData> {
  return BASE_BONDS;
}

/** Centralized race display config */
export const RACE_CONFIG: Record<
  string,
  { label: string; color: string; short: string }
> = {
  [Race.Beast]: { label: "兽族", color: "#8d6e63", short: "兽" },
  [Race.Hunter]: { label: "猎人", color: "#4caf50", short: "猎" },
  [Race.Warrior]: { label: "战士", color: "#f44336", short: "战" },
  [Race.Mage]: { label: "法师", color: "#2196f3", short: "法" },
  [Race.Undead]: { label: "亡灵", color: "#9c27b0", short: "亡" },
  [Race.Dragon]: { label: "龙族", color: "#ff9800", short: "龙" },
};

export const RACE_BG: Record<string, string> = {
  [Race.Beast]: "linear-gradient(135deg,#4e342e,#3e2723)",
  [Race.Hunter]: "linear-gradient(135deg,#1b5e20,#2e7d32)",
  [Race.Warrior]: "linear-gradient(135deg,#b71c1c,#c62828)",
  [Race.Mage]: "linear-gradient(135deg,#0d47a1,#1565c0)",
  [Race.Undead]: "linear-gradient(135deg,#4a148c,#6a1b9a)",
  [Race.Dragon]: "linear-gradient(135deg,#e65100,#ef6c00)",
};

export function countRaceOnTeam(
  units: { def: { race: Race } }[]
): Map<Race, number> {
  const counts = new Map<Race, number>();
  for (const u of units) {
    counts.set(u.def.race, (counts.get(u.def.race) ?? 0) + 1);
  }
  return counts;
}

export function getActiveBonds(
  units: { def: { race: Race } }[]
): Map<Race, { count: number; effect: BondEffect }> {
  const counts = countRaceOnTeam(units);
  const active = new Map<Race, { count: number; effect: BondEffect }>();
  for (const [race, count] of counts) {
    if (count >= 2) {
      active.set(race, { count, effect: getBondAtTier(race, count) });
    }
  }
  return active;
}
