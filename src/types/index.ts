// === 核心类型定义 ===

export enum Race {
  Beast = "beast",
  Hunter = "hunter",
  Warrior = "warrior",
  Mage = "mage",
  Undead = "undead",
  Dragon = "dragon",
}
export const RACE_NAMES: Record<Race, string> = {
  [Race.Beast]: "兽族",
  [Race.Hunter]: "猎人",
  [Race.Warrior]: "战士",
  [Race.Mage]: "法师",
  [Race.Undead]: "亡灵",
  [Race.Dragon]: "龙族",
};
export enum Row {
  Front = 0,
  Mid = 1,
  Back = 2,
}
export const ROW_NAMES: Record<Row, string> = {
  [Row.Front]: "前排",
  [Row.Mid]: "中排",
  [Row.Back]: "后排",
};
export enum DamageType {
  Physical = "physical",
  Magical = "magical",
  Pure = "pure",
}

export enum StatusType {
  Stun = "stun",
  Sleep = "sleep",
  Petrify = "petrify",
  Freeze = "freeze",
  Bind = "bind",
  Burn = "burn",
  ArmorBreak = "armorBreak",
  Disarm = "disarm",
  Curse = "curse",
  Ruin = "ruin",
  Silence = "silence",
  Inspire = "inspire",
  Bloodrage = "bloodrage",
  Stealth = "stealth",
  Shield = "shield",
  Poison = "poison",
  AntiHeal = "antiHeal",
}
export interface StatusEffect {
  type: StatusType;
  duration: number;
  value?: number;
  chance?: number;
  stackable?: boolean;
  maxStacks?: number;
}
export interface ActiveStatus {
  type: StatusType;
  remainingSeconds: number;
  stacks: number;
  value?: number;
  sourceId?: string;
  sourceAttack?: number;
}

export interface Skill {
  id: string;
  name: string;
  tags: string[];
  cooldown: number;
  castTime: number;
  description: string;
  damage?: {
    type: DamageType;
    atkRatio?: number;
    fixedAdd?: number;
    defMultiplier?: number;
    defSquaredDiv?: number;
    selfDefMultiplier?: number;
    targetMaxHpRatio?: number;
    targetLostHpRatio?: number;
    targetCurrentHpRatio?: number;
  }[];
  heal?: {
    atkRatio?: number;
    levelMultiplier?: number;
    fixedAdd?: number;
    targetMaxHpRatio?: number;
    targetLostHpRatio?: number;
  };
  effects?: StatusEffect[];
  interruptOnAttack?: boolean;
  interruptOnDamage?: boolean;
  aoe?: { rows?: Row[]; maxTargets?: number };
  priority?: { row: Row; chance: number }[];
  scriptId?: string;
}

export interface CharacterStats {
  hp: number;
  attack: number;
  physicalDef: number;
  magicalDef: number;
  attackInterval: number;
}
export interface CharacterDef {
  id: string;
  name: string;
  race: Race;
  stats: CharacterStats;
  growth: {
    hp: number;
    attack: number;
    physicalDef: number;
    magicalDef: number;
  };
  talent: string;
  skill: Skill;
  canBeCutIn?: boolean;
}

export interface ArenaUnit {
  id: string;
  def: CharacterDef;
  level: number;
  team: "ally" | "enemy";
  row: Row;
  col: number;
  // Combat stats
  currentHp: number;
  maxHp: number;
  currentAttack: number;
  currentPhysicalDef: number;
  currentMagicalDef: number;
  cooldownRemaining: number;
  castTimer: number;
  isCasting: boolean;
  attackTimer: number;
  isDead: boolean;
  statuses: ActiveStatus[];
  evasion: number;
  hitRateMod: number;
  autoAttackTargetId?: string;
  lastHitTarget?: string;
  lastHitBy?: string;
  hasRevived?: boolean;
  reviving?: { timer: number; hpPct: number; invTimer?: number };
  invincibleTimer?: number;
  // Summon system
  summonerId?: string;
  isSummon?: boolean;
  // Personal stats (optional, default 0)
  lifeSteal?: number;
  critRate?: number;
  critDamage?: number;
  blockRate?: number;
  tenacity?: number;
  damageReduction?: number;
  skillPower?: number;
  reflectDamage?: number;
  castCount?: number;
  tempReviveTimer?: number;
  // Runtime engine flags
  _wasHitDuringCast?: boolean;
  _wasDamagedDuringCast?: boolean;
  _immuneAbnormal?: boolean;
  _immuneTimer?: number;
  _syzDeathTrigger?: boolean;
  _stolenAtk?: number;
  _stealExpire?: number;
  _markDmg?: number;
  _markExpire?: number;
  _meteorCount?: number;
  _asStack?: number;
  _chargeTime?: number;
  _markedByAnalyzer?: boolean;
  _bslrSlowStack?: number;
  _dxmCastCount?: number;
  _bsxlFreezeCount?: number;
  _trapDamage?: { casterAtk: number; casterId: string };
  _delayedDamage?: { amount: number; expireTime: number }[];
  // Equipment (v1.8)
  equipmentId?: string;
  // Visual feedback
  lastDamage?: { value: number; time: number; type?: string };
  lastHeal?: { value: number; time: number };
  lastSkillName?: string;
  lastSkillCast?: { name: string; time: number };
  lastAction?: { time: number; targetName?: string; isTarget?: boolean };
}

export interface BattleState {
  units: ArenaUnit[];
  time: number;
  phase: "setup" | "fighting" | "finished";
  winner?: "ally" | "enemy";
  turnEvents: BattleEvent[];
  battleLog: BattleLogEntry[];
  stats?: any[];
  bonds?: {
    ally: { race: string; count: number }[];
    enemy: { race: string; count: number }[];
  };
  skillStats?: Record<
    string,
    {
      skillName: string;
      ownerId: string;
      casts: number;
      totalDamage: number;
      physDmg: number;
      magDmg: number;
      pureDmg: number;
    }
  >;
}
export interface BattleLogEntry {
  id: string;
  time: number;
  type: "damage" | "heal" | "status" | "skill" | "death" | "system";
  text: string;
  sourceId?: string;
  targetId?: string;
  value?: number;
}
export interface BattleEvent {
  type: "attack" | "skill" | "damage" | "heal" | "status" | "death" | "tick";
  sourceId?: string;
  targetIds?: string[];
  value?: number;
  description: string;
}
export interface GridCell {
  row: Row;
  col: number;
  trap?: { type: string; value: number; duration: number };
}

export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const MAX_UNITS = 8;
export const ROW_TARGET_CHANCE: Record<Row, Record<Row, number>> = {
  [Row.Front]: { [Row.Front]: 50, [Row.Mid]: 30, [Row.Back]: 20 },
  [Row.Mid]: { [Row.Front]: 50, [Row.Mid]: 30, [Row.Back]: 20 },
  [Row.Back]: { [Row.Front]: 50, [Row.Mid]: 30, [Row.Back]: 20 },
};
export const ROW_TARGET_NO_FRONT: Record<Row, number> = {
  [Row.Front]: 0,
  [Row.Mid]: 60,
  [Row.Back]: 40,
};

// ===== Equipment System (v1.8) =====
export interface Equipment {
  id: string;
  name: string;
  description: string;
  icon?: string;
  stats?: {
    attackPercent?: number;
    physicalDefPercent?: number;
    magicalDefPercent?: number;
    hpPercent?: number;
    critRate?: number;
    critDamage?: number;
    hitRate?: number;
    lifeSteal?: number;
  };
  tags?: string[];
}
