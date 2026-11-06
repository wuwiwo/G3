import { Race } from "../types";

export interface BondEffect {
  attackBonus: number;
  defenseBonus: number;
  hpBonus: number;
  hitRateBonus: number;
  evasionBonus: number;
  attackSpeedBonus?: number; // v3.4 R1: 攻击速度加成（与 attackBonus 攻击力区分）
  magicalDefBonus?: number;
  special?: string;
}

interface TierData {
  2: Partial<BondEffect>;
  3: Partial<BondEffect>;
  4: Partial<BondEffect>;
}

const BASE_BONDS: Record<Race, TierData> = {
  // v3.3 平衡性调整（docs/V3.3平衡性调整.md）：羁绊数值以该文档为准
  [Race.Beast]: {
    2: { attackBonus: 5, defenseBonus: 10, special: "韧性+10%" },
    3: {
      attackBonus: 10,
      defenseBonus: 15,
      special: "韧性+20%+对<75%HP敌人普攻附带6%攻击纯粹伤害",
    },
    4: {
      attackBonus: 20,
      defenseBonus: 25,
      special: "韧性+35%+对<75%HP敌人普攻附带15%攻击纯粹伤害",
    },
  },
  [Race.Hunter]: {
    // v3.4 R1: 用户裁定「只增加攻击速度，不增加攻击力」
    2: { attackSpeedBonus: 10, hitRateBonus: 10 },
    3: {
      attackSpeedBonus: 15,
      hitRateBonus: 20,
      special: "受到[切入]技能伤害-15%+每6次攻击额外1目标(30%伤害)", // v3.4 R19: 35→30%
    },
    4: {
      attackSpeedBonus: 30,
      hitRateBonus: 40,
      special:
        "受到[切入]技能伤害-25%+自身+10%攻(最多3层/20s)+每5次攻击额外1目标(60%伤害)", // v3.4 R19: 40s→20s / 70→60%
    },
  },
  [Race.Warrior]: {
    2: { hpBonus: 10, special: "5%减伤(魔伤1.5倍)+每13s恢复3%最大HP" },
    3: {
      hpBonus: 20,
      special: "10%减伤(魔伤1.5倍)+每11s恢复4%最大HP+HP<60%时额外10%攻",
    },
    4: {
      hpBonus: 35,
      special: "15%减伤(魔伤1.5倍)+每9s恢复5%最大HP+HP<80%时额外15%攻",
    },
  },
  [Race.Mage]: {
    2: { special: "-15%敌方魔防" },
    3: {
      special:
        "-20%敌方魔防+友方技能冷却-7%+施法30%概率全体法师+2%攻15s(每层独立计时)",
    },
    4: {
      special:
        "-30%敌方魔防+友方技能冷却-9%+施法50%概率全体法师+3%攻25s(每层独立计时)",
    },
  },
  [Race.Undead]: {
    2: { evasionBonus: 5 },
    3: {
      evasionBonus: 10,
      special:
        "首次阵亡10s后复活至15%HP，2s后每秒失去3%最大HP(无法驱散)+复活后15s造成伤害-25%/受伤+25%",
    },
    4: {
      evasionBonus: 20,
      special:
        "首次阵亡5s后复活至25%HP，3s后每秒失去2%最大HP(无法驱散)+复活后15s造成伤害-25%/受伤+25%",
    },
  },
  [Race.Dragon]: {
    2: {},

    3: { special: "起始冷却-20%+减伤8%+开局2倍减伤6s" }, // v3.15d: 4→8
    4: { special: "起始冷却-35%+减伤12%+开局2.5倍减伤10s" }, // v3.15d: 6→12
  },
  [Race.Holy]: {
    2: {
      special:
        "敌方#增益/#治疗效果-10%：我方全体获得10%相同增益(4s)/平分原本4%治疗",
    },
    3: {
      special:
        "敌方#增益/#治疗/#控制效果-15%：我方15%增益(5s)/平分10%治疗/控制反制5%",
    },
    4: {
      special:
        "敌方#增益/#治疗/#控制效果-20%：我方20%增益(5s)/平分15%治疗/控制反制10%",
    },
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
    attackSpeedBonus: ov.attackSpeedBonus ?? tier.attackSpeedBonus ?? 0,
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
  [Race.Holy]: { label: "圣职者", color: "#ffd54f", short: "圣" },
};

export const RACE_BG: Record<string, string> = {
  [Race.Beast]: "linear-gradient(135deg,#4e342e,#3e2723)",
  [Race.Hunter]: "linear-gradient(135deg,#1b5e20,#2e7d32)",
  [Race.Warrior]: "linear-gradient(135deg,#b71c1c,#c62828)",
  [Race.Mage]: "linear-gradient(135deg,#0d47a1,#1565c0)",
  [Race.Undead]: "linear-gradient(135deg,#4a148c,#6a1b9a)",
  [Race.Dragon]: "linear-gradient(135deg,#e65100,#ef6c00)",
  [Race.Holy]: "linear-gradient(135deg,#b8932a,#8a6a12)",
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
