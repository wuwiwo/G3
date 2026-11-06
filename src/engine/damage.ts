/**
 * v3.3: 全局战斗时钟。calcDamage 的调用方从未传 `now`，导致所有
 * "XxxUntil > now" 时间判断退化为 >0（buff 永久生效）。由 processTick 每 tick 同步。
 */
let battleClock = 0;
export function setBattleClock(t: number) {
  battleClock = t;
}
function nowOf(extraOpts?: unknown): number {
  const explicit =
    extraOpts && typeof extraOpts === "object" && "now" in extraOpts
      ? (extraOpts as { now?: number }).now
      : undefined;
  return explicit ?? battleClock;
}

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
    case Race.Holy: // v3.0 圣职者 25%
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
    ignoreBaseDef?: boolean; // v3.4 R4: 只保留额外防御
    ignoreExtraDef?: boolean; // v3.4 R4: 只保留基础防御
    ignoreDefPct?: number; // 无视X%基础防御 (v2.3 猎人4人)
    fixedAdd?: number;
    defMultiplier?: number; // for pure dmg: targetDef × X
    selfDefMultiplier?: number; // for pure dmg: selfDef × X
    targetMaxHpRatio?: number;
    cdrOverride?: number; // other dmg reduction (e.g. Prophet -30%)
    critBonus?: number; // extra crit rate (v2.9 西部猎人)
    evasion?: number; // target evasion rate
    hitRateMod?: number; // attacker hit rate modifier
    isSkill?: boolean; // is this a skill (for hell hound)
    defSquaredDiv?: number; // def^2 / X for湮灭法师
    targetCurrentHpRatio?: number; // Zeus: % of target current HP
  }
): DamageResult {
  // v3.4 R4: 无视额外防御标记（允许冰霜猎人天赋在内部按几率置位）
  let ignoreExtraDef = (extraOpts as any)?.ignoreExtraDef === true;
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
    let effectiveAtk =
      atk *
      (attacker.statuses.some((s: any) => s.type === StatusType.Burn)
        ? 0.9
        : 1) *
      (attacker.statuses.some((s: any) => s.type === StatusType.Curse)
        ? 0.9
        : 1);
    // v2.9 猛犸象卷曲: 攻-20% (P3: 删洞狮残留判断)
    if (attacker.statuses.some((s: any) => (s.type as string) === "curl")) {
      effectiveAtk *= 0.8;
    }
    // v2.9 夜行狼人狼吼: 全兽族攻击倍率 (衰减用倍率方式)
    if (attacker._ylRoarMult) {
      effectiveAtk *= attacker._ylRoarMult;
    }
    // v2.9 亡魂骑士: 诅咒敌人数量攻击倍率
    if (attacker._wqqsAtkMult) {
      effectiveAtk *= attacker._wqqsAtkMult;
    }
    // v2.9 魂之引渡者: 魂能层数攻击加成 (v2.13c: 每层8%→6%)
    if (attacker._hyzStacks) {
      effectiveAtk *= 1 + attacker._hyzStacks * 0.06;
    }
    // v2.9 火焰翼龙: 龙族数量攻击倍率
    if (attacker._dragonAtkMult) {
      effectiveAtk *= attacker._dragonAtkMult;
    }
    // v2.9 白马行者: 异常联动攻击加成 (每层+0.8%基础攻击, 永久)
    if (attacker._bmxzAtkBonus) {
      effectiveAtk *= 1 + attacker._bmxzAtkBonus;
    }
    // v2.10 风之斗士: 对前排伤害+30% (Lv100: 20%+等级×0.1%) 修复: id fdzs + Row.Front=0
    if (attacker.def.id === "fdzs" && defender.row === 0) {
      effectiveAtk *= 1.3;
    }
    // v2.10 嚎叫巨牛激怒: 攻击+35%
    if ((attacker as any)._hlRageAtkMult) {
      effectiveAtk *= (attacker as any)._hlRageAtkMult;
    }
    // v2.9 狂战士: 损失HP攻击层数
    if (attacker._kzsAtkMult) {
      effectiveAtk *= attacker._kzsAtkMult;
    }
    // v2.9 决斗大师: 击杀攻击加成 (每层+7%)
    if (attacker._jddsAtkBonus) {
      effectiveAtk *= 1 + attacker._jddsAtkBonus;
    }
    // v2.12 圣灵守护: 攻击-30%
    if ((attacker as any)._slzsAtkMult) {
      effectiveAtk *= (attacker as any)._slzsAtkMult;
    }
    // v3.16 嚎叫巨牛激怒: 攻击+40%
    if ((attacker as any)._hlRageAtkMult) {
      effectiveAtk *= (attacker as any)._hlRageAtkMult;
    }
    // v3.16c 冰霜猎人: 降攻击10%/层（≤30%）
    if (
      (defender as any)._bslrAtkDown &&
      (defender as any)._bslrDebuffUntil &&
      (defender as any)._bslrDebuffUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 - (defender as any)._bslrAtkDown;
    }
    // v3.16 火枪手天赋: 对后排+20%/中排+10%伤害，60s后全场+50%
    if (attacker.def.id === "hqs") {
      const rowBonus = defender.row === 2 ? 0.2 : defender.row === 1 ? 0.1 : 0;
      effectiveAtk *= 1 + rowBonus;
      if (nowOf(extraOpts) > 60) effectiveAtk *= 1.5;
    }
    // v3.3 战斗狂热: 一阶段伤害+50%，二阶段伤害+100%
    if ((attacker as any)._frenzy) {
      effectiveAtk *= (attacker as any)._frenzy === 2 ? 2 : 1.5;
    }
    // v2.26 战士羁绊: 生命%攻击缩放 (满血攻)
    if ((attacker as any)._warriorAtkMult) {
      effectiveAtk *= (attacker as any)._warriorAtkMult;
    }
    // v2.9 追风游侠: 同排反击后+15%攻10s
    if (attacker._zfyxAtkUntil && attacker._zfyxAtkUntil > nowOf(extraOpts)) {
      effectiveAtk *= 1.15;
    }
    // v3.0 追风游侠: 敌方切入后全队+10%攻×层数 (叠4层)
    if (
      attacker._zfyxAtkStacks &&
      attacker._zfyxAtkUntil &&
      attacker._zfyxAtkUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._zfyxAtkStacks * 0.1;
    }
    // v3.3 殉道者: 目标造成伤害-20% 持续5s
    if (
      (attacker as any)._xdDmgDownUntil &&
      (attacker as any)._xdDmgDownUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 - ((attacker as any)._xdDmgDown || 0.2);
    }
    // v3.3 末日使者: 攻击处于异常状态的敌人造成伤害 +10%
    if (attacker.def.id === "mrsz" && defender.statuses.length > 0) {
      effectiveAtk *= attacker.hasRevived ? 1.2 : 1.1;
    }
    // v3.0 追风游侠: 切入技能伤害-35%
    if (attacker._cutinDmgRed) {
      effectiveAtk *= attacker._cutinDmgRed;
    }
    // v3.0 殉道祝福: 造成伤害+10%
    if (attacker._xdBlessUntil && attacker._xdBlessUntil > nowOf(extraOpts)) {
      effectiveAtk *= 1.1;
    }
    // v3.0 驱魔者: 攻+10%×层
    if (
      attacker.def.id === "qm" &&
      attacker._qmLayers &&
      attacker._qmUntil &&
      attacker._qmUntil > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._qmLayers * 0.06; // v3.3 每层+6%攻
    }
    // v2.9 火枪手: 被切入攻击层数
    if (
      attacker._hqsStacks &&
      attacker._hqsExpire &&
      attacker._hqsExpire > nowOf(extraOpts)
    ) {
      effectiveAtk *= 1 + attacker._hqsStacks * 0.25;
    }
    // v2.9 灵弦歌者激昂: 攻击+20%
    if (
      attacker._inspireAtkUntil &&
      attacker._inspireAtkUntil > nowOf(extraOpts) &&
      attacker._inspireAtkMult
    ) {
      effectiveAtk *= attacker._inspireAtkMult;
    }
    // v3.3 猎人羁绊: 被 #切入 命中后叠层攻击（每层独立计时，最多 3 层）
    if (attacker._hunterBondLayers?.length) {
      const nowH = nowOf(extraOpts);
      let hBonus = 0;
      for (const l of attacker._hunterBondLayers)
        if (l.expire > nowH) hBonus += l.value;
      effectiveAtk *= 1 + hBonus;
    }
    // 法师羁绊攻击倍率 (v3.3: 每层独立计时，由 updateStatuses 重算)
    const mageMult = attacker._mageAtkMult || 1;
    result.rawDamage =
      effectiveAtk * skillAtkRatio * mageMult +
      (extraOpts?.fixedAdd ?? 0) +
      (extraOpts?.targetCurrentHpRatio
        ? defender.currentHp * extraOpts.targetCurrentHpRatio
        : 0);
  }

  // --- Defense reduction ---
  if (type === DamageType.Physical) {
    let def = defender.currentPhysicalDef;
    const baseDef = defender.basePhysicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
    // v3.4 R6: 破甲 = 基础防御失效，额外防御保留 50%（按 R4 分层，不再重复乘算）
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak)) {
      const abBase = Math.min(baseDef, Math.max(0, def));
      def = Math.max(0, def - abBase) * 0.5;
    }
    // v2.12 龙吟者: 每龙+5%防/每非龙-4%防
    if ((defender as any)._lyzDefMult) def *= (defender as any)._lyzDefMult;
    // v3.16 裂地蛮熊拍击: 降20%物防6s
    if (
      (defender as any)._lbmxArmorBreakUntil &&
      (defender as any)._lbmxArmorBreakUntil > nowOf(extraOpts)
    ) {
      def *= 1 - ((defender as any)._lbmxArmorBreakPct || 0.2);
    }
    // v2.9 魂之引渡者: 魂能层数防御加成 (v2.13c: 每层8%→6%)
    if (defender._hyzStacks) def *= 1 + defender._hyzStacks * 0.06;
    // v2.9 决斗大师: 击杀防御加成 (每层+3%)
    if (defender._jddsDefBonus) def *= 1 + defender._jddsDefBonus;
    // v2.26 战士羁绊: 生命%防御缩放 (残血防)
    if ((defender as any)._warriorDefMult)
      def *= (defender as any)._warriorDefMult;
    // v2.9 火枪手: 被切入防御层数
    if (
      defender._hqsStacks &&
      defender._hqsExpire &&
      defender._hqsExpire > nowOf(extraOpts)
    ) {
      def *= 1 + defender._hqsStacks * 0.7; // v3.0: 90→70%
    }
    // Curse: defender defense -10%
    if (defender.statuses.some((s: any) => s.type === StatusType.Curse))
      def *= 0.9;
    // v3.4 R6: 破甲已在分支开头按分层处理，此处不再重复
    // v3.4 R4: 基础/额外防御分层在分支末尾统一处理（旧实现 def=0 已移除）
    // v2.12 冰封: 免疫物理伤害 (寒冰飞龙冰封治疗)
    if (
      type === DamageType.Physical &&
      defender.statuses.some((s: any) => s.type === StatusType.Freeze)
    ) {
      result.rawDamage = 0;
      result.finalDamage = 0;
      return result;
    }
    // 无视部分基础防御 (v2.3: 猎人4人-20%基础防御)
    let ignoreDef = extraOpts?.ignoreDefPct ?? 0;
    // v3.4 R4: 冰霜猎人天赋 37.5%几率无视【额外防御】 + 目标-25%受疗2s（同一次触发）；受击失效1s
    // 技能视为攻击按 40% 判定；DoT 每跳的受疗判定在 battle.ts 的 bslr_dot 结算处
    const bslrChance = (extraOpts as any)?.isSkill === true ? 0.4 : 0.375;
    const bslrActive =
      attacker.def.id === "bslr" &&
      !(
        attacker._bslrBreakUntil && attacker._bslrBreakUntil > nowOf(extraOpts)
      );
    if (attacker.def.id === "bslr" && !bslrActive) {
      ignoreDef = 0;
    } else if (bslrActive && Math.random() < bslrChance) {
      ignoreExtraDef = true; // 无视额外防御，保留基础防御
      defender._antiHealMult = 0.75;
      defender._antiHealUntil = nowOf(extraOpts) + 2;
    }
    // v3.0 祈祷者: 无敌
    if (defender._qdInvulnUntil && defender._qdInvulnUntil > nowOf(extraOpts)) {
      result.finalDamage = 0;
      return result;
    }
    // v3.0 祈祷者: 减伤
    let holyDr = 1;
    // v3.3 龙吟者: 20% 减伤 4s
    if (
      (defender as any)._lyzDrUntil &&
      (defender as any)._lyzDrUntil > nowOf(extraOpts)
    ) {
      holyDr *= 1 - ((defender as any)._lyzDr || 0.2);
    }
    if (
      defender._qdDrUntil &&
      defender._qdDrUntil > nowOf(extraOpts) &&
      defender._qdDrPct
    ) {
      holyDr *= 1 - defender._qdDrPct;
    }
    // v3.16 嚎叫巨牛激怒: 减伤35%
    if ((defender as any)._hlRageDrMult) {
      holyDr *= 1 - (defender as any)._hlRageDrMult;
    }
    // v3.16 美杜莎天赋: 受指向性技能减伤20%，累积3次后40%+石化施法者2s
    if (defender.def.id === "mds" && (extraOpts as any)?.isSkill === true) {
      // v3.16: 指向性技能触发
      const now = nowOf(extraOpts);
      defender._mdsHitCount = (defender._mdsHitCount || 0) + 1;
      defender._mdsHitUntil = now;
      const stacks = Math.min(3, defender._mdsHitCount);
      holyDr *= 1 - (stacks >= 3 ? 0.4 : 0.2);
      if (stacks >= 3 && defender._mdsPunished !== now) {
        defender._mdsPunished = now;
        attacker.statuses.push({
          type: StatusType.Petrify,
          remainingSeconds: 2,
          stacks: 1,
        });
      }
    }
    // v3.0 圣骑士圣之护盾: 魔伤-30% (物理分支不适用, 魔法分支在 calcDamage 外层处理)
    if (
      defender._sqShieldUntil &&
      defender._sqShieldUntil > nowOf(extraOpts) &&
      (type as any) === DamageType.Magical
    ) {
      // v3.3 修死代码
      holyDr *= 0.7;
    }
    // v3.0 驱魔者: 防+20%×层
    if (
      defender.def.id === "qm" &&
      defender._qmLayers &&
      defender._qmUntil &&
      defender._qmUntil > nowOf(extraOpts)
    ) {
      if (type === DamageType.Physical) def *= 1 + defender._qmLayers * 0.2;
      else if (type === DamageType.Magical) def *= 1 + defender._qmLayers * 0.2;
    }
    // v3.0 殉道祝福: 受到伤害-10%
    if (defender._xdBlessUntil && defender._xdBlessUntil > nowOf(extraOpts)) {
      holyDr *= 0.9;
    }
    // P1修复: 圣裁者减伤 (敌方每增益单位5%)
    if (defender.def.id === "sc" && defender._scDr) {
      holyDr *= 1 - defender._scDr;
    }
    result.afterOtherReduction *= holyDr;
    // v3.4 R4: 基础防御 = basePart，额外防御 = extraPart
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
    else if (ignoreDef > 0) def = basePart * (1 - ignoreDef) + extraPart;
    const defRed = calcDefReduction(def);
    result.afterDef = result.rawDamage * (1 - defRed);
    // v2.4: 物理伤害减伤 (亡灵4人 - 克物理流)
    if (defender.physDamageReduction) {
      result.afterDef *= 1 - defender.physDamageReduction;
    }
  } else if (type === DamageType.Magical) {
    let def = defender.currentMagicalDef;
    const baseDef = defender.baseMagicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
    // v3.4 R6: 破甲 = 基础防御失效，额外防御保留 50%（按 R4 分层，不再重复乘算）
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak)) {
      const abBase = Math.min(baseDef, Math.max(0, def));
      def = Math.max(0, def - abBase) * 0.5;
    }
    // v2.12 龙吟者: 每龙+5%防/每非龙-4%防
    if ((defender as any)._lyzDefMult) def *= (defender as any)._lyzDefMult;
    // v3.16 裂地蛮熊拍击: 降20%物防6s
    if (
      (defender as any)._lbmxArmorBreakUntil &&
      (defender as any)._lbmxArmorBreakUntil > nowOf(extraOpts)
    ) {
      def *= 1 - ((defender as any)._lbmxArmorBreakPct || 0.2);
    }
    // v2.9 魂之引渡者: 魂能层数防御加成 (v2.13c: 每层8%→6%)
    if (defender._hyzStacks) def *= 1 + defender._hyzStacks * 0.06;
    // v2.9 决斗大师: 击杀防御加成 (每层+3%)
    if (defender._jddsDefBonus) def *= 1 + defender._jddsDefBonus;
    // v2.26 战士羁绊: 生命%防御缩放 (残血防)
    if ((defender as any)._warriorDefMult)
      def *= (defender as any)._warriorDefMult;
    // v2.9 火枪手: 被切入防御层数
    if (
      defender._hqsStacks &&
      defender._hqsExpire &&
      defender._hqsExpire > nowOf(extraOpts)
    ) {
      def *= 1 + defender._hqsStacks * 0.7; // v3.0: 90→70%
    }
    // Curse: -10% mdef
    if (defender.statuses.some((s: any) => s.type === StatusType.Curse))
      def *= 0.9;
    // v3.4 R6: 破甲已在分支开头按分层处理，此处不再重复
    // Petrify: +100% mdef
    if (defender.statuses.some((s: any) => s.type === StatusType.Petrify))
      def *= 2;
    // v3.4 R4: 魔法分支同样做基础/额外防御分层
    const basePart = Math.min(baseDef, Math.max(0, def));
    const extraPart = Math.max(0, def - basePart);
    if (ignoreExtraDef) def = basePart;
    else if (extraOpts?.ignoreBaseDef) def = extraPart;
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
  // v2.12 智慧猩鼓舞减伤: 物减15% / 魔减25% (按文档区分)
  if (
    (defender as any)._zzxDrUntil &&
    (defender as any)._zzxDrUntil > nowOf(extraOpts)
  ) {
    otherReduction *=
      type === DamageType.Physical
        ? 1 - ((defender as any)._zzxDrPhys || 0)
        : 1 - ((defender as any)._zzxDrMag || 0.25);
  }
  // Apply permanent damage reduction (e.g. Dragon bond base DR)
  let permDR = (defender as any).damageReduction || 0;
  // v2.9 狂战士: 损失HP减伤层数
  if ((defender as any)._kzsDr) permDR += (defender as any)._kzsDr;
  // v2.12 圣灵守护: 减伤25%
  if ((defender as any)._slzsDr) permDR += (defender as any)._slzsDr;
  // v2.27 战士羁绊: 阈值减伤 (魔伤按倍率 1.5x/2x)
  if ((defender as any)._warriorDr) {
    const wdr = (defender as any)._warriorDr;
    const wmag = (defender as any)._warriorMagMult;
    if (type === DamageType.Magical && wmag) {
      otherReduction *= 1 - wdr * wmag;
    } else {
      otherReduction *= 1 - wdr;
    }
  }
  if (permDR > 0) {
    otherReduction *= 1 - permDR;
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
  let baseCritRate = 0.075;
  // v2.9 西部猎人: 反击联动暴击率+30%
  if (extraOpts?.critBonus) baseCritRate += extraOpts.critBonus;
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

  // v3.3 圣之护盾: 反弹 10% 原本伤害（减免前 rawDamage）至发动者，纯粹伤害
  if (
    defender._sqShieldUntil &&
    defender._sqShieldUntil > nowOf(extraOpts) &&
    result.finalDamage > 0 &&
    attacker !== defender &&
    !attacker.isDead
  ) {
    const reflect = Math.max(1, Math.floor(result.rawDamage * 0.1));
    attacker.currentHp -= reflect;
    (attacker as any).lastDamage = {
      value: reflect,
      time: nowOf(extraOpts),
      type: "pure",
    };
  }

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
  const chance = isSkill ? 0.45 : 0.25; // v2.9 按文档 45%/25%
  if (Math.random() < chance) {
    const fatal = Math.floor(damage * 1.5);
    // If revived, fatal damage is 1.9x instead of 1.5x (文档 190%)
    const mult = attacker.hasRevived ? 1.9 : 1.5;
    const fatal2 = Math.floor(damage * mult);
    return { damage: Math.max(damage, fatal2), triggered: fatal2 > damage };
  }
  return { damage, triggered: false };
}

/** v2.12 减疗 (末日): 治疗效果-75% */
function applyHealReduction(
  target: ArenaUnit,
  amount: number,
  extraOpts?: any
): number {
  if (
    (target as any)._healReductionUntil &&
    (target as any)._healReductionUntil > nowOf(extraOpts)
  ) {
    return Math.floor(amount * (1 - ((target as any)._healReduction || 0)));
  }
  return amount;
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
  // Check for poison (-25% healing received)
  if (target.statuses.find((s) => s.type === StatusType.Poison)) {
    heal *= 0.75;
  }
  // Check for anti-heal (no healing at all)
  if (target.statuses.find((s) => s.type === StatusType.AntiHeal)) {
    heal = 0;
  }
  // v2.12 末日减疗: 治疗效果-75%
  if (
    (target as any)._healReductionUntil &&
    (target as any)._healReductionUntil > 0
  ) {
    heal *= 1 - ((target as any)._healReduction || 0);
  }
  return Math.floor(Math.max(0, heal));
}
