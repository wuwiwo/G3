// === 核心类型定义 ===

export enum Race {
  Beast = "beast",
  Hunter = "hunter",
  Warrior = "warrior",
  Mage = "mage",
  Undead = "undead",
  Dragon = "dragon",
  Holy = "holy",
}
export const RACE_NAMES: Record<Race, string> = {
  [Race.Beast]: "兽族",
  [Race.Hunter]: "猎人",
  [Race.Warrior]: "战士",
  [Race.Mage]: "法师",
  [Race.Undead]: "亡灵",
  [Race.Dragon]: "龙族",
  holy: "圣",
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
  Regen = "regen",
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
    targetAtkRatio?: number;
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
  lines?: Record<string, string[]>;
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
  // v3.4 R4: 基础防御（角色面板值），额外防御 = current - base
  basePhysicalDef?: number;
  baseMagicalDef?: number;
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
  reviving?: {
    timer: number;
    hpPct: number;
    invTimer?: number;
    regenPct?: number;
    regenDur?: number;
    decayDelay?: number;
    decayPct?: number;
  };
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
  attackSpeedBonus?: number;
  damageReduction?: number;
  skillPower?: number;
  reflectDamage?: number;
  castCount?: number;
  tempReviveTimer?: number;
  // Runtime engine flags
  _wasHitDuringCast?: boolean;
  _wasDamagedDuringCast?: boolean;
  _statusSnapshot?: {
    type: string;
    remainingSeconds: number;
    stacks: number;
    value?: number;
  }[];
  _hitSnapshot?: boolean;
  _dmgSnapshot?: boolean;
  _mageAtkMult?: number;
  _mageAtkExpire?: number;
  /** v3.3 法师羁绊每层独立计时: [{每层攻击加成, 到期时间}] */
  _mageAtkLayers?: { value: number; expire: number }[];
  /** v3.3 猎人羁绊被切入后叠层，最多 3 层，每层独立计时 */
  _hunterBondLayers?: { value: number; expire: number }[];
  /** v3.3 亡灵复活后延迟持续失血 */
  _undeadDecay?: { startAt: number; pct: number; acc: number };
  physDamageReduction?: number;
  aoeDamageReduction?: number;
  _hlRoarAtk?: number;
  _hlRoarExpire?: number;
  _ylRoar?: number;
  _ylRoarMult?: number;
  _ylRoarAtkBonus?: number;
  _ylRoarCycle?: number;
  _tauntTarget?: string;
  _tauntExpire?: number;
  _stealthAttack?: boolean;
  _wqqsAtkMult?: number;
  _wqqsEvaMult?: number;
  _swxzAccum?: number;
  _swxzDrLayers?: number;
  _hyzCycle?: number;
  _ppRegenCycle?: number;
  _qdRegenCycle?: number;
  _lyzCycle?: number;
  _crzsCycle?: number;
  _hyzStacks?: number;
  _dragonAtkMult?: number;
  _bjlDefRed?: number;
  _bjlCycle?: number;
  _bjlDefExpire?: number;
  _xldsStacks?: number;
  _xldsExpire?: number;
  _xjlLastTick?: number;
  _xjlWindowStart?: number;
  _xjlWindowHeal?: number;
  _bmxzAtkBonus?: number;
  _ymfsLeft?: boolean;
  _ymfsLeaveAt?: number;
  _ymfsReturnAt?: number;
  _ymfsTargetId?: string;
  _ymfsTargetReturnAt?: number;
  _ymfsTargetLeaveAt?: number;
  _hdHitChance?: number;
  _kzsLayers?: number;
  _kzsAtkMult?: number;
  _kzsDr?: number;
  _jddsAtkBonus?: number;
  _jddsDefBonus?: number;
  _hqsStacks?: number;
  _hqsExpire?: number;
  _zfyxAtkUntil?: number;
  _bslrBreakUntil?: number;
  _trapped?: boolean;
  _trapCycle?: number;
  _inspireAtkUntil?: number;
  _inspireAtkMult?: number;
  _xyflMult?: number;
  _ldshzShieldCd?: number;
  _hlRageTriggered?: boolean;
  _hlRageAtkMult?: number;
  _hlRageSpeedMult?: number;
  _hlRageDrMult?: number;
  _hlRageCycle?: number;
  _lbmxArmorBreakUntil?: number;
  _lbmxArmorBreakPct?: number;
  _mdsHitCount?: number;
  _mdsHitUntil?: number;
  _mdsPunished?: number;
  _bslrAtkDown?: number;
  _bslrSlowDown?: number;
  _bslrDebuffUntil?: number;
  _atkBuffUntil?: number; // v2.11 攻击增益窗口结束 (鼓舞)
  _atkBuffPct?: number;
  _zzxDrPhys?: number;
  _zzxDrMag?: number;
  _zzxDrUntil?: number;
  _slowUntil?: number;
  _slowPct?: number;
  _shield?: number;
  _shieldUntil?: number;
  _healReduction?: number;
  _healReductionUntil?: number;
  _hammerTarget?: string;
  _hitRedUntil?: number;
  _lyzDefMult?: number;
  _lyzAwayFromFront?: number;
  _linkOwnerId?: string;
  _linkUntil?: number;
  _atkBuffAmt?: number;
  _trappedBy?: string;
  _analyzerOrigEva?: number;
  _ldshzDefUntil?: number;
  _ldshzDefApplied?: number;
  _ldshzBuffUntil?: number;
  _slzsGuardUntil?: number;
  _slzsAtkMult?: number;
  _slzsDr?: number;
  _zqzHits?: number;
  _zqzPower?: boolean;
  _hammerDueAt?: number;
  _hammerDelayedDmg?: number;
  _yammxzCycle?: number;
  _swapEvaUntil?: number;
  _zfyxEvaUntil?: number;
  _warriorAtkMult?: number;
  _warriorDefMult?: number;
  _warriorMagMult?: number;
  _frenzy?: number; // v3.3: 0/未触发, 1=90s 一阶段, 2=120s 二阶段
  _zfyxAtkStacks?: number;
  _cutinDmgRed?: number;
  _antiHealMult?: number;
  _antiHealUntil?: number;
  _fzMarks?: number;
  _sqShieldUntil?: number;
  _qdMissStreak?: number;
  _qdInvulnUntil?: number;
  _qdRegenUntil?: number;
  _qdRegenPct?: number;
  _qdDrUntil?: number;
  _qdDrPct?: number;
  _xdTauntUntil?: number;
  _xdTauntId?: string;
  _dmgRecent9s?: number;
  lastHealTarget?: string;
  _qmLayers?: number;
  _qmUntil?: number;
  _xdBlessUntil?: number;
  _xdBlessDmg?: number;
  _xdBlessDr?: number;
  _holySuppress?: number;
  _holyMirror?: number;
  _holyAtkMirrorUntil?: number;
  _holyAtkMirrorPct?: number;
  _scDr?: number;
  _syzHealBoostUntil?: number;
  _warriorDr?: number;
  _swapEvaApplied?: boolean; // v2.11 攻击增益倍率 (鼓舞 0.35)
  _buffWinPhys?: number; // v2.11 增益窗口内普攻伤害累计
  _buffWinSkill?: number; // v2.11 增益窗口内技能伤害累计
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
  _attackCount?: number;
  _attentionTriggered?: boolean;
  _trapDamage?: { casterAtk: number; casterId: string };
  _delayedDamage?: { amount: number; expireTime: number }[];
  // Equipment (v1.8)
  equipmentId?: string;
  // Visual feedback
  lastDamage?: { value: number; time: number; type?: string };
  lastHeal?: { value: number; time: number };
  lastSkillName?: string;
  lastSkillCast?: { name: string; time: number };
  lastLine?: string;
  lastAction?: { time: number; targetName?: string; isTarget?: boolean };
}

export interface BattleState {
  units: ArenaUnit[];
  time: number;
  phase: "setup" | "fighting" | "finished";
  winner?: "ally" | "enemy" | "draw"; // v3.3: 180s 超时判平局而不是失败
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
    attackSpeedPercent?: number;
    evasionPercent?: number;
  };
  tags?: string[];
}
