import { Race } from "../types";

export interface BondEffect {
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  hitRateBonus: number;
  evasionBonus: number;
  magicalDefBonus?: number;
  special?: string;
}

interface TierData {
  2: Partial<BondEffect>;
  3: Partial<BondEffect>;
  4: Partial<BondEffect>;
}

const BASE_BONDS: Record<Race, TierData> = {
  [Race.Beast]: {
    2: { attackBonus: 5, defenseBonus: 10, special: "韧性+10%" }, // v2.22 用户设计: 攻5防10
    3: {
      attackBonus: 10,
      defenseBonus: 15, // v3.15b: 20→15
      special: "韧性+18%+对<50%HP敌人6%攻击纯粹伤害",
    },
    4: {
      attackBonus: 20,
      defenseBonus: 25, // v3.16d 评审护栏: 32→25（羁绊防单项≤30%）
      special: "韧性+35%+对<75%HP敌人25%攻击纯粹伤害", // v3.16d: 35→25（≤30%护栏）
    },
  },
  [Race.Hunter]: {
    2: { attackBonus: 10, hitRateBonus: 10 }, // v3.16b 评审回滚
    3: {
      attackBonus: 20,
      hitRateBonus: 15,
      special: "反击40%伤害+12%吸血+每6次攻击额外1目标(40%伤害)", // v3.16f 回滚: 文档值
    },
    4: {
      attackBonus: 30,
      hitRateBonus: 30,
      special: "反击75%伤害+20%吸血+每5次攻击额外1目标(80%伤害)", // v3.16f 回滚: 文档值
    },
  },
  [Race.Warrior]: {
    // v2.29 用户微调: 恢复周期13/11/9s + 4名狂暴阈值80%
    2: { hpBonus: 12, special: "每13s恢复3%HP+HP>50%时10%减伤(魔伤1.5倍)" },
    3: {
      hpBonus: 20, // v3.15: 25→20
      special: "每11s恢复5%HP+HP>40%时12%减伤(魔伤1.5倍)+HP<60%时额外10%攻",
    },
    4: {
      hpBonus: 35, // v3.15: 50→35
      special: "每9s恢复6%HP+HP>30%时15%减伤(魔伤2倍)+HP<80%时额外15%攻", // v3.15: 8%→6/20%→15/20→15
    },
  },
  [Race.Mage]: {
    2: { special: "-15%魔防" },
    3: { special: "-20%魔防+冷却-7%+施法30%概率全体+3%攻20s" }, // v3.15c
    4: { special: "-22%魔防+冷却-9%+施法30%概率全体+3%攻20s" }, // v3.15h: -25/-10→-22/-9
  },
  [Race.Undead]: {
    2: { attackBonus: 5, evasionBonus: 5 },
    3: {
      attackBonus: 10,
      evasionBonus: 10,
      special: "复活10s+每秒2%HP/8s+无敌2s",
    },
    4: {
      attackBonus: 12, // v2.16 削弱: 15→12
      evasionBonus: 15, // v2.13b 削弱: 21→15
      special: "物理减伤9%+复活5s+每秒2.5%HP/10s+无敌2s", // v2.16: 减伤11%→9%
    },
  },
  [Race.Dragon]: {
    2: {},
  
    3: { special: "起始冷却-20%+减伤8%+开局2倍减伤6s" }, // v3.15d: 4→8
    4: { special: "起始冷却-35%+减伤12%+开局2.5倍减伤10s" }, // v3.15d: 6→12
  },
  [Race.Holy]: {
    2: { special: "敌方#增益/#治疗效果-10%：我方全体获得2%相同增益/平分3%治疗效果" }, // v3.15h
    3: { special: "敌方#增益/#治疗/#控制效果-8%：我方4%增益/平分5%治疗/控制反制5%" },
    4: { special: "敌方#增益/#治疗/#控制效果-12%：我方6%增益/平分8%治疗/控制反制8%" },
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
