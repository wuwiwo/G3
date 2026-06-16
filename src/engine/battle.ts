import {
  ArenaUnit,
  BattleState,
  BattleLogEntry,
  Row,
  StatusType,
  DamageType,
  Equipment,
} from "../types";
import { BattleStats } from "../types/stats";
import { calcDamage, calcHeal, applyFatalStrike } from "./damage";
import { getActiveBonds } from "../data/races";
import { getSkillHandler } from "./SkillRegistry";
import { CHARACTER_MAP } from "../data/characters";
import { EQUIPMENT_MAP } from "../data/equipment";

let nextUnitId = 0;
let nextLogId = 0;

function logEntry(
  time: number,
  text: string,
  type: BattleLogEntry["type"],
  extra?: Partial<BattleLogEntry>
): BattleLogEntry {
  return { id: `l${nextLogId++}`, time, text, type, ...extra };
}

function pfx(u: ArenaUnit): string {
  const r = u.def.race;
  const tag =
    {
      beast: "兽",
      hunter: "猎",
      warrior: "战",
      mage: "法",
      undead: "亡",
      dragon: "龙",
    }[r] || r;
  return `${u.team === "ally" ? "🟦" : "🟥"}[${tag}]${u.def.name}`;
}

/** Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check if a unit's talents are suppressed by Ruin */
function isRuined(u: any): boolean {
  return u.statuses?.some((s: any) => s.type === "ruin");
}

function lvScale(base: number, growth: number, level: number) {
  return base + growth * (level - 1);
}

export function createUnit(
  def: any,
  level: number,
  team: "ally" | "enemy",
  row: Row,
  col: number = 0,
  equipmentId?: string
): ArenaUnit {
  // def.stats are already Lv.100 values, use directly
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
    cooldownRemaining: def.skill.cooldown * 0.9,
    castTimer: 0,
    isCasting: false,
    attackTimer: def.stats.attackInterval * (0.5 + Math.random() * 0.5),
    isDead: false,
    statuses: [],
    autoAttackTargetId: undefined,
    evasion: def.id === "sszs" ? 0.25 : 0,
    hitRateMod: def.id === "hd" ? -0.15 : 0,
    tenacity: row === 0 ? 5 : 0, // Front row +5% tenacity (v2.0)
  };
}

function getAlive(state: BattleState, team?: "ally" | "enemy"): ArenaUnit[] {
  return state.units.filter(
    (u) => !u.isDead && (team === undefined || u.team === team)
  );
}

function getEnemies(
  state: BattleState,
  selfTeam: "ally" | "enemy"
): ArenaUnit[] {
  return state.units.filter((u) => u.team !== selfTeam && !u.isDead);
}

function pickTarget(
  enemies: ArenaUnit[],
  rowPref?: { row: Row; chance: number }[]
): ArenaUnit | undefined {
  if (enemies.length === 0) return undefined;
  if (rowPref && rowPref.length > 0) {
    // Weighted random by row
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
  // Default: front row weighted (v1.8: 60/25/15)
  const hasFront = enemies.some((e) => e.row === Row.Front);
  const chances = hasFront
    ? [
        { row: Row.Front, c: 60 },
        { row: Row.Mid, c: 25 },
        { row: Row.Back, c: 15 },
      ]
    : [
        { row: Row.Mid, c: 65 },
        { row: Row.Back, c: 35 },
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

export function initBattle(
  allyChars: { charId: string; row: Row; col?: number; equipmentId?: string }[],
  enemyChars: { charId: string; row: Row; col?: number; equipmentId?: string }[]
): BattleState & { stats: BattleStats[] } {
  nextUnitId = 0;
  const makeUnits = (
    chars: { charId: string; row: Row; col?: number; equipmentId?: string }[],
    team: "ally" | "enemy"
  ) =>
    chars
      .map((c) => {
        const def = CHARACTER_MAP.get(c.charId);
        return def
          ? createUnit(def, 100, team, c.row, c.col ?? 0, c.equipmentId)
          : null;
      })
      .filter(Boolean) as ArenaUnit[];

  const allies = makeUnits(allyChars, "ally");
  const enemies = makeUnits(enemyChars, "enemy");
  const units = [...allies, ...enemies];

  // Apply bonds
  const apply = (us: ArenaUnit[]) => {
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
          if (effect.hpBonus) {
            const mult = 1 + effect.hpBonus / 100;
            u.maxHp = Math.floor(u.maxHp * mult);
            u.currentHp = Math.floor(u.currentHp * mult);
          }
          // v2.0: hunter bond hit rate
          if (effect.hitRateBonus) {
            u.hitRateMod = (u.hitRateMod || 0) + effect.hitRateBonus / 100;
          }
          // v2.0: undead bond evasion (replaces defense)
          if (effect.evasionBonus) {
            u.evasion = (u.evasion || 0) + effect.evasionBonus / 100;
          }
        }
      }
      // Dragon v2.0: base 5%/10% DR + opening 3x/4x multiplier
      if (race === "dragon") {
        const cdMult = count >= 4 ? 0.2 : 0.7;
        const baseDr = count >= 4 ? 0.1 : 0.05; // 常驻5%/10%减伤
        const openMult = count >= 4 ? 4 : 3; // 开局倍率
        const openDur = count >= 4 ? 10 : 6;
        const openDr = baseDr * openMult; // 开局期间总减伤
        for (const u of us) {
          if (u.def.race === "dragon") {
            u.cooldownRemaining *= cdMult;
            // Apply opening damage reduction as Inspire (high value for first N seconds)
            u.statuses.push({
              type: StatusType.Inspire,
              remainingSeconds: openDur,
              stacks: 1,
              value: 1 - openDr, // e.g. 0.85 for 15% DR (3x5%)
            });
            // For post-opening: need to keep base Dr after Inspire expires
            // For simplicity, apply base Dr as permanent reduction via damageReduction
            u.damageReduction = (u.damageReduction || 0) + baseDr;
          }
        }
      }
      // Beast bond: tenacity (v2.0)
      if (race === "beast") {
        const tenacityVal = count >= 4 ? 35 : count >= 3 ? 10 : 0;
        if (tenacityVal > 0) {
          for (const u of us) {
            if (u.def.race === "beast") {
              u.tenacity = (u.tenacity || 0) + tenacityVal;
            }
          }
        }
      }
    }
  };
  apply(allies);
  apply(enemies);

  // Apply equipment stat bonuses
  const applyEquip = (us: ArenaUnit[]) => {
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

  // 龙之心脏 effect: reduce starting cooldown by 50%
  for (const u of units) {
    if (u.equipmentId === "dragon_heart") {
      u.cooldownRemaining *= 0.5;
    }
  }

  const stats: BattleStats[] = units.map((u) => ({
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
    survivalTime: 0,
  }));

  const state: any = {
    units,
    time: 0,
    phase: "fighting",
    turnEvents: [],
    battleLog: [{ time: 0, text: "⚔️ 战斗开始！", type: "system" }],
    stats,
    skillStats: {},
    bonds: {
      ally: calcBonds(allies),
      enemy: calcBonds(enemies),
    },
  };
  // Debug: bond activation logs (done after state creation)
  if (state._debug) {
    for (const side of ["ally", "enemy"] as const) {
      const us = side === "ally" ? allies : enemies;
      const label = side === "ally" ? "我方" : "敌方";
      const bonds = getActiveBonds(us);
      for (const [race, { effect }] of bonds) {
        const cnt = us.filter((u: any) => u.def.race === race).length;
        if (race === "warrior") {
          const extra =
            cnt >= 4
              ? "+每5s回8%HP+20%吸血"
              : cnt >= 3
                ? "+每5s回4%HP+10%吸血"
                : "";
          state.battleLog.push({
            time: 0,
            text: `🌟 ${label} 战士×${cnt}羁绊: HP+${effect.hpBonus}%${extra}`,
            type: "system",
          });
        } else if (race === "mage") {
          const mdefStr =
            cnt >= 4 ? "50%" : cnt >= 3 ? "35%" : cnt >= 2 ? "20%" : "0%";
          const lsStr = cnt >= 4 ? "25%" : cnt >= 3 ? "10%" : "";
          state.battleLog.push({
            time: 0,
            text: `🌟 ${label} 法师×${cnt}羁绊: 魔防-${mdefStr}${lsStr ? `+吸血${lsStr}` : ""}`,
            type: "system",
          });
        } else if (race === "dragon")
          state.battleLog.push({
            time: 0,
            text: `🌟 ${label} 龙族×${cnt}羁绊: CD-80%+减伤40%10s`,
            type: "system",
          });
        else {
          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻+${effect.attackBonus}%`,
              type: "system",
            });
          if (effect.defenseBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 防+${effect.defenseBonus}%`,
              type: "system",
            });
        }
      }
    }
  }
  return state;

  function calcBonds(us: ArenaUnit[]): { race: string; count: number }[] {
    const rc: Record<string, number> = {};
    for (const u of us.filter((u) => !u.isDead)) {
      rc[u.def.race] = (rc[u.def.race] || 0) + 1;
    }
    return Object.entries(rc)
      .filter(([_, c]) => c >= 3)
      .map(([r, c]) => ({ race: r, count: c }));
  }
}

const MAX_LOG = 2000;

function deferDamage(target: any, dmg: number, state: any) {
  if (dmg <= 0) return;
  // Sleep: 20% chance to wake on damage
  if (
    target.statuses?.some((s: any) => s.type === StatusType.Sleep) &&
    Math.random() < 0.2
  ) {
    target.statuses = target.statuses.filter(
      (s: any) => s.type !== StatusType.Sleep
    );
    state.battleLog.push({
      time: state.time,
      text: `💤 ${target.def.name} 被惊醒！`,
      type: "status",
    });
  }
  const inspire = target.statuses?.find(
    (s: any) => s.type === StatusType.Inspire
  );
  if (inspire) {
    target._delayedDamage = target._delayedDamage || [];
    target._delayedDamage.push({ amount: dmg, expireTime: state.time + 5 });
  } else {
    target.currentHp -= dmg;
  }
}

function processDelayedDamage(state: any) {
  for (const u of state.units) {
    if (!u._delayedDamage || u._delayedDamage.length === 0) continue;
    const now = state.time;
    const ready = u._delayedDamage.filter((d: any) => d.expireTime <= now);
    u._delayedDamage = u._delayedDamage.filter((d: any) => d.expireTime > now);
    for (const d of ready) {
      u.currentHp -= d.amount;
      if (state._debug) {
        state.battleLog.push({
          time: now,
          text: `⏳ ${u.def.name} 延迟伤害生效: -${d.amount}`,
          type: "damage",
        });
      }
    }
  }
}

export function processTick(state: any): any {
  if (state.phase !== "fighting") return state;
  state.time += 0.1;
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

function updateStatuses(state: any) {
  for (const unit of getAlive(state)) {
    for (const s of unit.statuses) {
      s.remainingSeconds -= 0.1;
      if (s.type === StatusType.Burn && s.value) {
        const dmg = s.value; // value already stores per-tick damage (casterAttack × ratio)
        // Use deferred damage for Inspire
        deferDamage(unit, dmg, state);
        addStat(state, unit.id, "totalDamageReceived", dmg);
        state.battleLog.push({
          time: state.time,
          text: `🔥 ${unit.def.name} 灼烧 ${dmg}`,
          type: "damage",
        });
      }
    }
    // 亡灵歌咏者天赋：诅咒DoT
    if (unit.statuses.some((s) => s.type === StatusType.Curse)) {
      const dmg = Math.floor(unit.currentAttack * 0.01 + 20);
      unit.currentHp -= dmg;
      addStat(state, unit.id, "totalDamageReceived", dmg);
    }
    // 中毒DoT: 每秒攻击×3%纯粹 + 治疗-25% (在calcHeal处理) + 生命回复-50% (暂未实现)
    const poison = unit.statuses.find((s) => s.type === StatusType.Poison);
    if (poison && poison.value) {
      const dmg = poison.value;
      unit.currentHp -= dmg;
      addStat(state, unit.id, "totalDamageReceived", dmg);
    }
    // 炽热战士天赋：每秒对同排敌方造成纯粹伤害
    if (unit.def.id === "crzs" && !isRuined(unit)) {
      const sameRowEnemies = getEnemies(state, unit.team).filter(
        (e: any) => e.row === unit.row
      );
      for (const e of sameRowEnemies) {
        const dmg = Math.floor(unit.currentAttack * 0.015 + 2);
        e.currentHp -= dmg;
        addStat(state, unit.id, "totalDamageDealt", dmg);
      }
    }
    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);
  }
  // 神谕者阵亡触发
  const syzT = state._syzDeathTime;
  if (syzT !== undefined) {
    const el = state.time - syzT;
    if (el >= 0 && el < 6) {
      const baseAtk = state._syzDeathAttack || 0;
      const atk60 = baseAtk > 0 ? Math.floor(baseAtk * 0.6) : 361;
      const heal = Math.floor(atk60 * (1 + el * 0.1));
      for (const u of state.units) {
        if (u.team === "ally" && !u.isDead && u.def.race === "mage")
          u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      }
    }
  }
}

function updateCasting(state: any) {
  for (const unit of getAlive(state)) {
    if (!unit.isCasting) continue;
    unit.castTimer -= 0.1;
    // Check interrupt conditions
    const sk = unit.def.skill;
    let interrupted = false;
    let reason = "";
    // 1. CC interrupt
    const cc = unit.statuses.find((s: any) =>
      ["stun", "sleep", "petrify", "freeze", "silence"].includes(s.type)
    );
    if (cc) {
      interrupted = true;
      reason = cc.type;
    }
    // 2. Attack interrupt
    if (!interrupted && sk.interruptOnAttack && unit._wasHitDuringCast) {
      interrupted = true;
      reason = "受击";
    }
    // 3. Damage interrupt
    if (!interrupted && sk.interruptOnDamage && unit._wasDamagedDuringCast) {
      interrupted = true;
      reason = "受伤";
    }
    if (interrupted) {
      unit.isCasting = false;
      unit.cooldownRemaining = unit.def.skill.cooldown;
      unit._wasHitDuringCast = false;
      unit._wasDamagedDuringCast = false;
      state.battleLog.push({
        time: state.time,
        text: `⛔ ${unit.def.name} 施法被打断(${reason})！`,
        type: "status",
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

function updateCooldowns(state: any) {
  for (const unit of getAlive(state)) {
    if (unit.cooldownRemaining > 0) unit.cooldownRemaining -= 0.1;
  }
}

function updateSkills(state: any) {
  for (const unit of getAlive(state)) {
    if (unit.isCasting) continue;
    if (unit.cooldownRemaining > 0) continue;
    const cannotCast = [
      StatusType.Stun,
      StatusType.Sleep,
      StatusType.Petrify,
      StatusType.Freeze,
      StatusType.Silence,
    ].some((t) => unit.statuses.some((s: any) => s.type === t));
    const isBound = unit.statuses.some((s: any) => s.type === StatusType.Bind);
    if (cannotCast) continue;
    if (
      isBound &&
      unit.def.skill.tags?.some((t: string) => t === "切入" || t === "移动")
    )
      continue;
    const sk = unit.def.skill;
    if (sk.scriptId === "bmxz_charge") {
      // Variable charge time: 1/2/3s random
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

function updateAutoAttacks(state: any) {
  for (const unit of getAlive(state)) {
    const cannotAttack = [
      StatusType.Stun,
      StatusType.Sleep,
      StatusType.Petrify,
      StatusType.Freeze,
      StatusType.Disarm,
    ].some((t) => unit.statuses.some((s: any) => s.type === t));
    if (cannotAttack) continue;
    unit.attackTimer -= 0.1;
    if (unit.attackTimer <= 0) {
      const enemies = getEnemies(state, unit.team);
      const nTargets = unit.def.id === "mds" && !isRuined(unit) ? 2 : 1;
      const targets =
        nTargets === 1
          ? [pickTarget(enemies)].filter(Boolean)
          : shuffle(enemies).slice(0, nTargets);
      for (const target of targets) {
        if (!target || target.isDead) continue;
        let atkRatio = 1;
        if (unit.def.id === "mds") atkRatio = 0.85; // -15% attack per target
        const result = calcDamage(unit, target, atkRatio, DamageType.Physical, {
          evasion: target.evasion,
          hitRateMod: unit.hitRateMod,
        });
        const fs = applyFatalStrike(unit, result.finalDamage, false);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        deferDamage(target, result.finalDamage, state);
        trackSkill(
          state,
          unit.id,
          "aa",
          "平砍",
          result.finalDamage,
          "physical"
        );
        // 金箍棒: 攻击40%附加自身攻击×20%魔法伤害
        if (
          unit.equipmentId === "golden_staff" &&
          result.finalDamage > 0 &&
          Math.random() < 0.4
        ) {
          const bonusDmg = Math.floor(unit.currentAttack * 0.2);
          target.currentHp -= bonusDmg;
          addStat(state, unit.id, "totalDamageDealt", bonusDmg);
          addStat(state, unit.id, "magicalDamage", bonusDmg);
          addStat(state, target.id, "totalDamageReceived", bonusDmg);
          addStat(state, target.id, "magicalDamageReceived", bonusDmg);
        }
        // Set interrupt flags on target
        target._wasHitDuringCast = true;
        target._wasDamagedDuringCast = true;
        // Track crit/block stats
        if (result.isCrit) {
          addStat(state, unit.id, "critCount", 1);
          addStat(state, unit.id, "critDamage", result.finalDamage);
        }
        if (result.isBlocked) {
          addStat(state, target.id, "blockCount", 1);
          addStat(state, target.id, "blockReduced", result.blocked);
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
        addStat(state, unit.id, "totalDamageDealt", result.finalDamage);
        addStat(state, unit.id, "autoAttackDamage", result.finalDamage);
        addStat(state, unit.id, "physicalDamage", result.finalDamage);
        addStat(state, target.id, "totalDamageReceived", result.finalDamage);
        addStat(state, target.id, "physicalDamageReceived", result.finalDamage);
        if (result.finalDamage > 0) {
          unit.lastHitTarget = target.id;
          target.lastHitBy = unit.id;
          state.battleLog.push({
            time: state.time,
            text: `${pfx(unit)} ⚔️ ${pfx(target)}: ${result.finalDamage}${result.isCrit ? "💥" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} def=${Math.floor(target.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / 1.35).toFixed(0) : ""}` : ""}`,
            type: "damage",
          });
          // Beast bond v2.0: pure damage on <50%HP targets (no lifesteal)
          if (unit.def.race === "beast") {
            const beastCnt = state.units.filter(
              (u: any) =>
                u.team === unit.team && !u.isDead && u.def.race === "beast"
            ).length;
            if (beastCnt >= 3 && target.currentHp / target.maxHp < 0.5) {
              const purePct = beastCnt >= 4 ? 0.1 : 0.05;
              const pureDmg = Math.floor(unit.currentAttack * purePct);
              target.currentHp -= pureDmg;
              addStat(state, unit.id, "totalDamageDealt", pureDmg);
              addStat(state, unit.id, "pureDamage", pureDmg);
            }
          }
          // 神谕者天赋：攻击治疗
          if (
            unit.def.id === "syz" &&
            result.finalDamage > 0 &&
            !isRuined(unit)
          ) {
            const allies = state.units
              .filter((u: any) => u.team === unit.team && !u.isDead)
              .sort(
                (a: any, b: any) =>
                  a.currentHp / a.maxHp - b.currentHp / b.maxHp
              );
            if (allies.length > 0 && Math.random() < 0.8) {
              const t = allies[0];
              const heal = Math.floor(unit.currentAttack * 0.4);
              t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
              addStat(state, unit.id, "totalHealingDone", heal);
              addStat(state, unit.id, "skillHealing", heal);
            }
          }
        }
      }
      // v2.0: attack speed formula - actual = base * (1 - bonus% * 0.5), cap at 100% bonus
      const asBonus = Math.min(unit.attackSpeedBonus || 0, 1);
      unit.attackTimer = unit.def.stats.attackInterval * (1 - asBonus * 0.5);
      // Reset attack counter and check hunter extra target
      unit._attackCount = (unit._attackCount || 0) + 1;
      const hunterCnt = state.units.filter(
        (u: any) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
      ).length;
      if (hunterCnt >= 3 && unit.def.race === "hunter") {
        const extraEvery = hunterCnt >= 4 ? 3 : 5;
        if (unit._attackCount % extraEvery === 0) {
          const extraEnemies = getEnemies(state, unit.team).filter(
            (e: any) => !targets.some((t: any) => t?.id === e.id)
          );
          if (extraEnemies.length > 0) {
            const extraTarget =
              extraEnemies[Math.floor(Math.random() * extraEnemies.length)];
            if (extraTarget) {
              const eresult = calcDamage(
                unit,
                extraTarget,
                1,
                DamageType.Physical,
                {
                  evasion: extraTarget.evasion,
                  hitRateMod: unit.hitRateMod,
                }
              );
              deferDamage(extraTarget, eresult.finalDamage, state);
              extraTarget.currentHp -= eresult.finalDamage;
              addStat(state, unit.id, "totalDamageDealt", eresult.finalDamage);
              addStat(state, unit.id, "autoAttackDamage", eresult.finalDamage);
              addStat(state, unit.id, "physicalDamage", eresult.finalDamage);
              addStat(
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

function updateDeaths(state: any) {
  for (const u of state.units) {
    if (u.currentHp > 0 || u.isDead) continue;
    u.isDead = true;
    addStat(state, u.id, "deaths", 1);
    addStat(state, u.id, "survivalTime", state.time);
    // 神谕者阵亡触发：治疗全场法师5s
    if (u.def.id === "syz" && !isRuined(u)) {
      state._syzDeathTime = state.time;
      state._syzDeathAttack = u.currentAttack;
      state.battleLog.push({
        time: state.time,
        text: `🛡 ${u.def.name} 阵亡触发：全法师治疗5s`,
        type: "status",
      });
    }
    // 食人魔魔法师天赋：友方阵亡→+8%最大HP上限+回10%HP
    for (const srm of state.units.filter(
      (x: any) =>
        x.def.id === "srm" && x.team === u.team && !x.isDead && !isRuined(x)
    )) {
      const hpBonus = Math.floor(srm.maxHp * 0.08);
      srm.maxHp += hpBonus;
      srm.currentHp = Math.min(
        srm.maxHp,
        srm.currentHp + Math.floor(srm.maxHp * 0.1)
      );
      state.battleLog.push({
        time: state.time,
        text: `🔥 ${srm.def.name} 天赋触发: 最大HP+${hpBonus}+恢复10%HP`,
        type: "status",
      });
    }
    // Credit kill to last attacker
    if (u.lastHitBy) addStat(state, u.lastHitBy, "kills", 1);
    state.battleLog.push({
      time: state.time,
      text: `💀 ${pfx(u)} 阵亡！`,
      type: "death",
    });
    // 暗影噬龙击杀奖励：如果目标有暗影标记，回血20%+全龙CD-20%
    if (u._markExpire && u._markExpire > state.time - 5) {
      const aysl = state.units.find(
        (x: any) => x.def.id === "aysl" && x.team !== u.team && !x.isDead
      );
      if (aysl) {
        const heal = Math.floor(aysl.maxHp * 0.2);
        aysl.currentHp = Math.min(aysl.maxHp, aysl.currentHp + heal);
        // Reduce all dragon CDs on aysl's team by 20%
        for (const d of state.units.filter(
          (x: any) =>
            x.def.race === "dragon" && x.team === aysl.team && !x.isDead
        )) {
          d.cooldownRemaining = Math.max(0, d.cooldownRemaining * 0.8);
        }
        state.battleLog.push({
          time: state.time,
          text: `🌑 暗影噬龙 击杀奖励: 回20%HP+全龙CD-20%`,
          type: "status",
        });
      }
    }
    if (u.def.race === "undead" && !u.hasRevived) {
      // Check if revive already used for this team
      const key = `undeadRevive_${u.team}`;
      if (state[key]) return;
      const alive = state.units.filter(
        (x: any) => x.team === u.team && !x.isDead
      );
      const totalU = state.units.filter(
        (x: any) => x.team === u.team && x.def.race === "undead"
      ).length;
      if (totalU >= 3) {
        state[key] = true;
        const is4 = totalU >= 4;
        const deductPct = is4 ? 0.9 : 0.75; // 扣除10%或25%
        const reviveTime = is4 ? 7 : 13;
        const reviveHp = is4 ? 0.35 : 0.15; // 35%/15% HP on revival
        const invTimer = is4 ? 3 : 1; // 无敌3s (4人) / 1s (3人)
        for (const m of alive) {
          if (m.def.race === "undead")
            m.currentHp = Math.max(1, Math.floor(m.currentHp * deductPct));
        }
        u.reviving = { timer: reviveTime, hpPct: reviveHp, invTimer };
        state.battleLog.push({
          time: state.time,
          text: `💀 ${u.def.name} ${totalU}羁绊激活，${reviveTime}s后复活(扣除${is4 ? 10 : 25}%HP)！`,
          type: "status",
        });
      }
    }
  }
}

function updateRevivals(state: any) {
  for (const u of state.units) {
    // Undead bond revival
    if (u.reviving && u.isDead) {
      u.reviving.timer -= 0.1;
      if (u.reviving.timer <= 0) {
        u.isDead = false;
        u.currentHp = Math.floor(u.maxHp * u.reviving.hpPct);
        u.cooldownRemaining = 0;
        u.attackTimer = 0;
        u.statuses = [];
        const pct = u.reviving.hpPct;
        const invTmr = u.reviving.invTimer ?? 1;
        u.reviving = undefined;
        u.invincibleTimer = invTmr;
        u.hasRevived = true;
        state.battleLog.push({
          time: state.time,
          text: `🔄 ${u.def.name} 复活！恢复${Math.floor(pct * 100)}%HP`,
          type: "status",
        });
      }
    }
    // Temporary revival countdown (龙吟者)
    if (u.tempReviveTimer && u.tempReviveTimer > 0) {
      u.tempReviveTimer -= 0.1;
      if (u.tempReviveTimer <= 0 && !u.isDead) {
        u.isDead = true;
        u.tempReviveTimer = undefined;
        state.battleLog.push({
          time: state.time,
          text: `⏳ ${u.def.name} 临时复活结束`,
          type: "status",
        });
      }
    }
    if (u.invincibleTimer && u.invincibleTimer > 0) {
      u.invincibleTimer -= 0.1;
      if (u.invincibleTimer <= 0) u.invincibleTimer = undefined;
    }
  }
}

function updateWarriorBonds(state: any) {
  state._warriorTimer = (state._warriorTimer || 0) + 0.1;
  // Apply lifesteal to warriors based on bond tier
  for (const u of getAlive(state)) {
    if (u.def.race !== "warrior") continue;
    const wCnt = state.units.filter(
      (x: any) => x.team === u.team && !x.isDead && x.def.race === "warrior"
    ).length;
    if (wCnt >= 4) {
      u.lifeSteal = Math.max(u.lifeSteal || 0, 0.25);
    } else if (wCnt >= 3) {
      u.lifeSteal = Math.max(u.lifeSteal || 0, 0.15);
    }
  }
  // Every 12s: heal warriors by % of max HP (v2.0: 12s)
  if (state._warriorTimer >= 12) {
    state._warriorTimer = 0;
    for (const u of getAlive(state)) {
      if (u.def.race !== "warrior") continue;
      const wCnt = state.units.filter(
        (x: any) => x.team === u.team && !x.isDead && x.def.race === "warrior"
      ).length;
      if (wCnt >= 3) {
        const pct = wCnt >= 4 ? 0.08 : 0.04;
        const heal = Math.floor(u.maxHp * pct);
        u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
        addStat(state, u.id, "totalHealingDone", heal);
        addStat(state, u.id, "skillHealing", heal);
      }
    }
  }
}

function updateEquipment(state: any) {
  // 缩小护镜: 15s后破坏
  if (state.time >= 15) {
    for (const u of state.units) {
      if (u.equipmentId === "dwarf_goggles" && !u.isDead) {
        u.equipmentId = undefined;
        u.evasion = Math.max(0, (u.evasion || 0) - 0.15);
      }
    }
  }
  // 瞩目头饰: HP<60%时触发+破坏
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
        (x: any) => x.team === u.team && x.id !== u.id && !x.isDead
      )) {
        const heal = Math.floor(lostHp * 0.1);
        ally.currentHp = Math.min(ally.maxHp, ally.currentHp + heal);
      }
      u.equipmentId = undefined;
      state.battleLog.push({
        time: state.time,
        text: `🎯 ${u.def.name} 瞩目头饰触发: 友方恢复${Math.floor(lostHp * 0.1)}HP`,
        type: "system",
      });
    }
  }
}

function updateVictory(state: any) {
  const a = getAlive(state).filter((u: any) => u.team === "ally");
  const e = getAlive(state).filter((u: any) => u.team === "enemy");
  if (a.length === 0 || e.length === 0) {
    state.phase = "finished";
    state.winner = a.length > 0 ? "ally" : "enemy";
    // Record survival time for all alive units
    for (const u of state.units) {
      if (!u.isDead) addStat(state, u.id, "survivalTime", state.time);
    }
    state.battleLog.push({
      time: state.time,
      text: `🏁 ${state.winner === "ally" ? "我方" : "敌方"}胜利！`,
      type: "system",
    });
    // 终局统计
    state.battleLog.push({
      time: state.time,
      text: `── 终局统计 ──`,
      type: "system",
    });
    for (const s of state.stats || []) {
      const u = state.units.find((x: any) => x.id === s.unitId);
      if (!u) continue;
      const side = u.team === "ally" ? "🟦" : "🟥";
      state.battleLog.push({
        time: state.time,
        text: `${side} ${u.def.name}: 伤害${s.totalDamageDealt || 0} 治疗${s.totalHealingDone || 0} 击杀${s.kills || 0} 暴击${s.critCount || 0} 格挡${s.blockCount || 0}`,
        type: "system",
      });
    }
  }
}

function updateBonds(state: any) {
  const calc = (team: string) => {
    const rc: Record<string, number> = {};
    for (const u of state.units.filter(
      (x: any) => x.team === team && !x.isDead
    ))
      rc[u.def.race] = (rc[u.def.race] || 0) + 1;
    return Object.entries(rc)
      .filter(([_, c]) => c >= 3)
      .map(([r, c]) => ({ race: r, count: c }));
  };
  state.bonds = { ally: calc("ally"), enemy: calc("enemy") };
  // 森之射手：同排猎人+25%闪避
  for (const u of getAlive(state)) {
    if (u.def.id !== "sszs") continue;
    for (const h of state.units.filter(
      (x: any) =>
        x.team === u.team &&
        !x.isDead &&
        x.def.race === "hunter" &&
        x.row === u.row
    )) {
      if (h.id !== "sszs") h.evasion = Math.max(h.evasion || 0, 0.25);
    }
  }
  // 分析者天赋：标记对称敌人→闪避/额外防御=0
  for (const fxz of state.units.filter(
    (u: any) =>
      u.team === "ally" && !u.isDead && u.def.id === "fxz" && !isRuined(u)
  )) {
    // Find symmetric enemy: same col, mirrored row
    const symEnemy = state.units.find(
      (u: any) =>
        u.team === "enemy" &&
        !u.isDead &&
        u.col === fxz.col &&
        u.row === fxz.row
    );
    if (symEnemy) {
      symEnemy.evasion = 0;
      symEnemy._markedByAnalyzer = true;
    }
  }
  // Reset evasion for unmarked units (森之射手 still handles its own)
  for (const u of state.units.filter(
    (x: any) => x.team === "enemy" && !x._markedByAnalyzer
  )) {
    // Don't reset - evasion handled per-character
  }
}

function trimLog(state: any) {
  if (state.battleLog.length > MAX_LOG) {
    state.battleLog = state.battleLog.slice(-MAX_LOG);
  }
}

// Assign IDs to any log entries that don't have them
function ensureLogIds(state: any) {
  for (const entry of state.battleLog) {
    if (!entry.id) entry.id = `l${nextLogId++}`;
  }
}

function executeSkill(caster: ArenaUnit, state: any, log: any[]) {
  addStat(state, caster.id, "skillCasts", 1);
  const sk = caster.def.skill;
  const enemies = getEnemies(state, caster.team);
  const allies = getAlive(state, caster.team);

  log.push({
    time: state.time,
    text: `${caster.def.name} 释放【${sk.name}】`,
    type: "skill",
  });
  caster.lastSkillCast = { name: sk.name, time: state.time };

  // 秀逗大师天赋：同排友方每次技能提升自身6%攻速，5层上限
  for (const xdds of state.units.filter(
    (u: any) =>
      !u.isDead &&
      u.team === caster.team &&
      u.def.id === "xdds" &&
      u.row === caster.row &&
      !isRuined(u)
  )) {
    if (xdds.id === caster.id) continue;
    const stacks = Math.min((xdds._asStack || 0) + 1, 5);
    xdds._asStack = stacks;
    // Each stack = 6% attack speed boost = 3% attack interval reduction
    const atkIntMult = 1 - stacks * 0.03;
    const baseInt = xdds.def.stats.attackInterval;
    xdds.attackTimer = Math.min(xdds.attackTimer, baseInt * atkIntMult);
  }

  // Script-driven skill: delegate to SkillRegistry
  const handler = getSkillHandler(sk.scriptId || "");
  if (handler) {
    const scriptTargets = sk.aoe
      ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : ([pickTarget(enemies, sk.priority)].filter(Boolean) as ArenaUnit[]);
    handler(caster, state, log, scriptTargets);
    return;
  }

  let actionTargets: string[] = [];

  // --- Hunter counter-attack (if skill has #切入 tag) ---
  const isCutIn = sk.tags?.includes("切入");
  if (isCutIn && enemies.length > 0) {
    // Determine initial targets
    let cutTargets: ArenaUnit[] = [];
    if (sk.aoe) {
      cutTargets = shuffle(enemies).slice(
        0,
        sk.aoe.maxTargets || enemies.length
      );
    } else {
      const t = pickTarget(enemies, sk.priority);
      if (t) cutTargets = [t];
    }
    // Check each target's team for hunter bond
    for (const t of cutTargets) {
      if (t.isDead) continue;
      const targetTeam = state.units.filter(
        (u: any) => u.team === t.team && !u.isDead
      );
      const hunterCount = targetTeam.filter(
        (u: any) => u.def.race === "hunter"
      ).length;
      if (hunterCount >= 3) {
        const is4Tier = hunterCount >= 4;
        // Counter-attack: 3人 75% damage (def applied), 4人 100% ignore defense
        const counterResult = calcDamage(
          t,
          caster,
          is4Tier ? 1 : 0.75,
          DamageType.Physical,
          {
            isSkill: true,
            ignoreBaseDef: is4Tier,
          }
        );
        const counterDmg = counterResult.finalDamage;
        deferDamage(caster, counterDmg, state);
        caster.lastDamage = {
          value: counterDmg,
          time: state.time,
          type: "physical",
        };
        caster.lastAction = { time: state.time, isTarget: true };
        log.push({
          time: state.time,
          text: `🔄 ${t.def.name} 反击 ${pfx(caster)}: ${counterDmg}${counterResult.isCrit ? "💥" : ""}`,
          type: "damage",
        });
        addStat(state, t.id, "totalDamageDealt", counterDmg);
      }
    }
  }

  // --- Damage ---
  if (sk.damage && enemies.length > 0) {
    let targets: ArenaUnit[] = [];
    if (sk.aoe) {
      const shuffled = shuffle(enemies);
      targets = shuffled.slice(0, sk.aoe.maxTargets || enemies.length);
    } else {
      const t = pickTarget(enemies, sk.priority);
      if (t) targets = [t];
    }

    for (const dmgFormula of sk.damage) {
      for (const t of targets) {
        if (t.isDead) continue;
        actionTargets.push(t.def.name);
        // Mage bond: tiered magic defense reduction
        const mageCnt = state.units.filter(
          (u: any) =>
            u.team === caster.team && !u.isDead && u.def.race === "mage"
        ).length;
        const mageMdefMult =
          mageCnt >= 4 ? 0.5 : mageCnt >= 3 ? 0.65 : mageCnt >= 2 ? 0.8 : 1;
        const mageLsPct = mageCnt >= 4 ? 0.3 : mageCnt >= 3 ? 0.15 : 0;
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
            hitRateMod: caster.hitRateMod,
          }
        );
        const fs = applyFatalStrike(caster, result.finalDamage, true);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        // 地狱之犬命中3人伤害-30%
        if (
          caster.def.id === "dyq" &&
          sk.aoe &&
          targets.filter((x: any) => !x.isDead).length >= 3
        ) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7);
        }
        deferDamage(t, result.finalDamage, state);
        t._wasHitDuringCast = true;
        t._wasDamagedDuringCast = true;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = origMdef;
        t.lastDamage = {
          value: result.finalDamage,
          time: state.time,
          type: dmgFormula.type,
        };
        t.lastAction = { time: state.time, isTarget: true };
        addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
        addStat(state, caster.id, "skillDamage", result.finalDamage);
        addStat(
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
          dmgFormula.type
        );
        addStat(state, t.id, "totalDamageReceived", result.finalDamage);
        addStat(
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
          addStat(state, caster.id, "critCount", 1);
          addStat(state, caster.id, "critDamage", result.finalDamage);
        }
        if (result.isBlocked) {
          addStat(state, t.id, "blockCount", 1);
          addStat(state, t.id, "blockReduced", result.blocked);
        }
        t.lastHitBy = caster.id;
        if (result.finalDamage > 0) {
          log.push({
            time: state.time,
            text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}${result.isCrit ? "💥" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} type=${dmgFormula.type} def=${dmgFormula.type === "magical" ? Math.floor(t.currentMagicalDef) : Math.floor(t.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / (result.isCrit ? 1.35 : 1)).toFixed(0) : ""}` : ""}`,
            type: "damage",
          });
          // Mage bond: 30% skill life steal (v1.7)
          if (mageLsPct > 0 && result.finalDamage > 0) {
            const lsHeal = Math.floor(result.finalDamage * mageLsPct);
            caster.currentHp = Math.min(
              caster.maxHp,
              caster.currentHp + lsHeal
            );
            addStat(state, caster.id, "lifeStealHealing", lsHeal);
            log.push({
              time: state.time,
              text: `💉 ${pfx(caster)} 技能吸血 +${lsHeal}`,
              type: "heal",
            });
          }
          // 小精灵链接 lifeSteal
          if ((caster.lifeSteal ?? 0) > 0 && result.finalDamage > 0) {
            const lsHeal = Math.floor(
              result.finalDamage * (caster.lifeSteal ?? 0)
            );
            caster.currentHp = Math.min(
              caster.maxHp,
              caster.currentHp + lsHeal
            );
            addStat(state, caster.id, "lifeStealHealing", lsHeal);
            log.push({
              time: state.time,
              text: `🔗 ${pfx(caster)} 链接吸血 +${lsHeal}`,
              type: "heal",
            });
          }
        }
      }
    }
  }

  // --- Heal ---
  if (sk.heal) {
    let targets: ArenaUnit[] = [];
    if (sk.id === "dxm_heal") {
      // Prefer beast, then lowest HP
      const beast = allies
        .filter((a) => a.def.race === "beast")
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      const all = allies.sort(
        (a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
      );
      targets = [beast[0] || all[0]];
      // Every 4th cast: +50% healing + cleanse
      caster._dxmCastCount = (caster._dxmCastCount || 0) + 1;
      const upgraded = caster._dxmCastCount % 4 === 0;
    } else if (sk.id === "lxgz_heal") {
      targets = allies
        .sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)
        .slice(0, 2);
    } else if (sk.id === "wlgyz_heal") {
      targets = shuffle(allies).slice(0, 2);
    } else if (sk.id === "hbfl_heal") {
      const candidates = allies.filter(
        (a) => a.def.race === "dragon" && a.currentHp / a.maxHp < 0.3
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
      const amount = calcHeal(caster, t, sk.heal.atkRatio ?? 1, {
        fixedAdd: sk.heal.fixedAdd,
        targetMaxHpRatio: sk.heal.targetMaxHpRatio,
        targetLostHpRatio: sk.heal.targetLostHpRatio,
      });
      // 独行马第4次升级: +50%治疗+驱散
      let finalAmount = amount;
      if (
        sk.id === "dxm_heal" &&
        caster._dxmCastCount &&
        caster._dxmCastCount % 4 === 0
      ) {
        finalAmount = Math.floor(amount * 1.5);
        // Cleanse negative statuses
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
        t.statuses = t.statuses.filter((s: any) => !neg.includes(s.type));
      }
      t.currentHp = Math.min(t.maxHp, t.currentHp + finalAmount);
      t.lastHeal = { value: amount, time: state.time };
      t.lastAction = { time: state.time, isTarget: true };
      addStat(state, caster.id, "totalHealingDone", amount);
      addStat(state, caster.id, "skillHealing", amount);
      addStat(state, t.id, "totalHealingReceived", amount);
      log.push({
        time: state.time,
        text: `${pfx(caster)} 💚 ${pfx(t)}: +${amount}${state._debug ? ` (atk=${Math.floor(caster.currentAttack)} × ${sk.heal.atkRatio ?? 1})` : ""}`,
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

  // --- Status effects ---
  if (sk.effects) {
    const targets = sk.aoe
      ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : [pickTarget(enemies, sk.priority)].filter(Boolean);
    for (const t of targets) {
      if (!t || t.isDead) continue;
      for (const eff of sk.effects) {
        // Respect chance if specified
        if (eff.chance !== undefined && Math.random() > eff.chance) continue;
        // Warrior immunity: skip negative statuses
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
        // For burn, calculate per-tick damage immediately using caster's attack
        const val =
          eff.type === "burn"
            ? Math.floor(caster.currentAttack * (eff.value || 0.05))
            : eff.value;
        t.statuses.push({
          type: eff.type,
          remainingSeconds: eff.duration,
          stacks: 1,
          value: val,
        });
        // 水晶室女天赋：友方法师施加异常→自身技能冷却-1.5s
        if (caster.def.race === "mage" && !isRuined(caster)) {
          for (const u of state.units.filter(
            (x: any) =>
              x.team === caster.team && !x.isDead && x.def.id === "sjsn"
          )) {
            u.cooldownRemaining = Math.max(0, u.cooldownRemaining - 1.5);
          }
        }
        // 白马行者天赋：友方全场法师施加异常→自身技能冷却-1s
        for (const u of state.units.filter(
          (x: any) => x.team === caster.team && !x.isDead && x.def.id === "bmxz"
        )) {
          u.cooldownRemaining = Math.max(0, u.cooldownRemaining - 1);
        }
      }
    }
  }
}

function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}

function trackSkill(
  state: any,
  unitId: string,
  skillId: string,
  skillName: string,
  damage: number,
  dmgType: string
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
    };
  }
  const s = state.skillStats[key];
  s.casts += 1;
  s.totalDamage += damage;
  if (dmgType === "physical") s.physDmg += damage;
  else if (dmgType === "magical") s.magDmg += damage;
  else s.pureDmg += damage;
}

export function generateEnemyTeam(): { charId: string; row: Row }[] {
  const pool = [...CHARACTER_MAP.values()];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 6); // 6-8 units
  return selected.map((c) => ({
    charId: c.id,
    row: Math.floor(Math.random() * 3) as Row,
  }));
}
