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
import {
  calcDamage,
  calcHeal,
  applyFatalStrike,
  setBattleClock,
} from "./damage";
import { getActiveBonds } from "../data/races";
import { getSkillHandler } from "./SkillRegistry";
import { CHARACTER_MAP, SUMMON_CHARACTERS } from "../data/characters";
import { EQUIPMENT_MAP } from "../data/equipment";
import { ALL_LINES } from "../data/lines";

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
      holy: "圣",
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

/** Pick a random dialogue line for a unit */
function triggerLine(u: any, category: string, targetName?: string) {
  const lines = u.def?.id ? (ALL_LINES as any)[u.def.id]?.[category] : null;
  if (!lines || lines.length === 0) return;
  let line = lines[Math.floor(Math.random() * lines.length)];
  if (targetName)
    line = line.replace("[角色名]", targetName).replace("[目标]", targetName);
  u.lastLine = line;
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
    basePhysicalDef: def.stats.physicalDef,
    baseMagicalDef: def.stats.magicalDef,
    cooldownRemaining: def.skill.cooldown * 0.9 * (0.85 + Math.random() * 0.3), // 起始冷却±15%随机，避免镜像先手固定
    castTimer: 0,
    isCasting: false,
    attackTimer: def.stats.attackInterval * (0.5 + Math.random() * 0.5),
    isDead: false,
    statuses: [],
    autoAttackTargetId: undefined,
    evasion: def.id === "sszs" ? 0.4 : 0, // v3.0: 25→40%
    hitRateMod: def.id === "hd" ? -0.15 : 0,
    tenacity: row === 0 ? 5 : 0, // Front row +5% tenacity (v2.0)
  };
}

function getAlive(state: BattleState, team?: "ally" | "enemy"): ArenaUnit[] {
  return state.units.filter(
    (u) => !u.isDead && (team === undefined || u.team === team)
  );
}

// v2.12 通用移动: #移动 技能施放后移动到随机空位
function moveToRandomEmpty(unit: any, state: any) {
  const teamUnits = state.units.filter(
    (u: any) => u.team === unit.team && !u.isDead
  );
  const occupied = new Set(teamUnits.map((u: any) => `${u.row},${u.col}`));
  const empty: { row: number; col: number }[] = [];
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

function getEnemies(
  state: BattleState,
  selfTeam: "ally" | "enemy"
): ArenaUnit[] {
  return state.units.filter((u) => u.team !== selfTeam && !u.isDead);
}

/** v3.3 星辰龙: 随机 2×2 格子上的敌人 */
function pick2x2(enemies: any[]): any[] {
  const r = Math.random() < 0.5 ? 0 : 1;
  const c = Math.random() < 0.5 ? 0 : 1;
  return enemies.filter(
    (e: any) => e.row >= r && e.row <= r + 1 && e.col >= c && e.col <= c + 1
  );
}

function pickTarget(
  enemies: ArenaUnit[],
  rowPref?: { row: Row; chance: number }[],
  excludeStealth = true
): ArenaUnit | undefined {
  // v2.44 潜行仅免疫普攻 (技能传 false 可选中)
  if (excludeStealth) {
    enemies = enemies.filter(
      (e: any) => !e.statuses?.some((s: any) => s.type === StatusType.Stealth)
    );
  }
  // v2.9 湮灭法师传送离场单位不可被选中
  enemies = enemies.filter((e: any) => !e._ymfsLeft);
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
          // v3.4 R1: 攻速羁绊写入 attackSpeedBonus（现有公式 attackInterval*(1-bonus*0.5)）
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
      // Dragon v2.11: 文档值 - 起始冷却-20%/35% + 常驻减伤3%/8% + 开局2倍/2.5倍
      if (race === "dragon") {
        const cdMult = count >= 4 ? 0.7 : 0.8; // v2.33: 起始冷却 -30%/-20%
        const baseDr = count >= 4 ? 0.12 : 0.08; // v3.15d: 减伤 12%/8%（对齐 races.ts）
        const openMult = count >= 4 ? 2 : 2; // v2.15 削弱: 开局倍率 2.5x→2x
        const openDur = count >= 4 ? 10 : 6;
        const openDr = baseDr * openMult; // 开局期间总减伤 20%/6%
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
      // v3.3 Beast bond tenacity: 2人10% / 3人20% / 4人35%
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
      // v3.3: 亡灵羁绊不再提供物理减伤/攻击加成，仅闪避(races.ts) + 复活
      // v3.3 Mage bond: 友方技能冷却 3人-7% / 4人-9%
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

  // ===== v2.9 兽族开场天赋 =====
  const applyBeastTalents = (us: ArenaUnit[]) => {
    const team = us[0]?.team;
    const opp = team === "ally" ? "enemy" : "ally";
    const oppUnits = state.units.filter((x: any) => x.team === opp);
    // 嚎叫巨牛: 敌方全体攻击-25%持续8s
    const hl = us.find((u: any) => u.def.id === "hl" && !isRuined(u));
    if (hl) {
      let totalRed = 0;
      // v3.16 怒吼: 降攻 50%+0.15%/Lv（100级80%）持续 6+0.03s/Lv（100级9s）
      const hlLv = (hl as any).level || 100;
      const roarPct = 0.3; // v3.3 怒吼 -30%
      const roarDur = 5; // v3.3 前5s -30%，之后 -15% 再8s
      for (const e of oppUnits) {
        const redAtk = Math.floor(e.currentAttack * roarPct);
        e.currentAttack -= redAtk;
        e._hlRoarAtk = (e._hlRoarAtk || 0) + roarPct;
        e._hlRoarExpire = state.time + roarDur;
        e._hlRoarStage2 = true; // v3.3 到期后转 -15% 持续8s
        totalRed += redAtk;
      }
      trackTalent(
        state,
        hl.id,
        "怒吼(降攻30%×5s→15%×8s)",
        totalRed * 13,
        "buff"
      );
      state.battleLog.push({
        time: 0,
        text: `📢 ${hl.def.name} 怒吼: 敌方全体攻击-30%×5s，之后-15%×8s`,
        type: "status",
      });
    }
    // 夜行狼人: 全兽族攻击+30% (每10s衰减20%)
    const yl = us.find((u: any) => u.def.id === "yl" && !isRuined(u));
    if (yl) {
      for (const b of us.filter((u: any) => u.def.race === "beast")) {
        b._ylRoarMult = (b._ylRoarMult || 1) * 1.3; // 攻击倍率, 不直接改currentAttack
      }
      const ylUnit = us.find((u: any) => u.def.id === "yl" && !isRuined(u));
      if (ylUnit) {
        // v2.11 等效值: Δ攻击×持续时间 (30%档10s + 10%档10s → 系数4.0), 单位: 攻击·秒
        const totalBonus = us
          .filter((u: any) => u.def.race === "beast")
          .reduce(
            (s, b: any) => s + Math.floor(b.currentAttack * 0.3 * 4.0),
            0
          );
        trackTalent(state, ylUnit.id, "狼吼(开场+30%攻)", totalBonus, "buff");
      }
      state.battleLog.push({
        time: 0,
        text: `🐺 ${yl.def.name} 狼吼: 全兽族攻击+30%`,
        type: "status",
      });
    }
    // 智慧猩: 封锁敌方同阵型天赋与技能8s
    const zzx = us.find((u: any) => u.def.id === "zzx" && !isRuined(u));
    if (zzx) {
      let blocked = 0;
      for (const e of oppUnits) {
        if (e.row === zzx.row) {
          e.statuses.push({
            type: StatusType.Ruin,
            remainingSeconds: 8,
            stacks: 1,
          });
          e.statuses.push({
            type: StatusType.Silence,
            remainingSeconds: 8,
            stacks: 1,
          });
          blocked++;
        }
      }
      trackTalent(state, zzx.id, "封锁(8s)", blocked * 8, "control");
      state.battleLog.push({
        time: 0,
        text: `🧠 ${zzx.def.name} 封锁: 敌方同阵型技能禁用8s`,
        type: "status",
      });
    }
    // 独行马: 同阵型友方技能CD-18%
    const dxm = us.find((u: any) => u.def.id === "dxm" && !isRuined(u));
    if (dxm) {
      const benefited = us.filter(
        (u: any) => u.def.race === "beast" && u.row === dxm.row
      );
      for (const b of benefited) {
        b.cooldownRemaining = Math.max(0, b.cooldownRemaining * 0.88); // v3.3 独行马 CD-12%
      }
      trackTalent(state, dxm.id, "同排CD-18%", benefited.length, "count");
      state.battleLog.push({
        time: 0,
        text: `🐴 ${dxm.def.name} 同排兽族技能CD-18%`,
        type: "status",
      });
    }
    // 裂地蛮熊: 嘲讽敌方前排5s (强制攻击自身+禁技能)
    const lbmx = us.find((u: any) => u.def.id === "lbmx" && !isRuined(u));
    if (lbmx) {
      const front = oppUnits.filter((e: any) => e.row === 0 && !e.isDead);
      for (const e of front) {
        e._tauntTarget = lbmx.id;
        e._tauntExpire = state.time + 5;
        e.statuses.push({
          type: StatusType.Silence,
          remainingSeconds: 5,
          stacks: 1,
        });
      }
      trackTalent(state, lbmx.id, "咆哮嘲讽(5s)", front.length * 5, "control");
      state.battleLog.push({
        time: 0,
        text: `🐻 ${lbmx.def.name} 咆哮: 嘲讽敌方前排5s`,
        type: "status",
      });
    }
  };
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
    talentDamage: 0,
    talentHealing: 0,
    buffValue: 0,
    controlSeconds: 0,
    skillInterrupts: 0,
    hitsTaken: 0,
    critsTaken: 0,
    survivalTime: 0,
  }));

  const state: any = {
    trackTalent, // v2.10 天赋埋点 (供 SkillRegistry handler 使用)
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
  applyBeastTalents(allies);
  applyBeastTalents(enemies);

  // v2.9 辉刀天赋: 攻+15% 命-15%
  const applyHuiDao = (us: ArenaUnit[]) => {
    for (const hd of us.filter((u: any) => u.def.id === "hd" && !isRuined(u))) {
      hd.currentAttack = Math.floor(hd.currentAttack * 1.15);
      hd._hdHitChance = 0.85;
      state.battleLog.push({
        time: 0,
        text: `🗡 ${hd.def.name} 天赋: 攻击+15% 命中-15%`,
        type: "status",
      });
    }
  };
  applyHuiDao(allies);
  applyHuiDao(enemies);

  // v2.9 骷髅大帝天赋: 开场召唤3个骷髅兵
  const summonSkeletons = (us: ArenaUnit[]) => {
    const kldd = us.find((u: any) => u.def.id === "kldd" && !isRuined(u));
    if (!kldd) return;
    const skelDef = CHARACTER_MAP.get("klb");
    if (!skelDef) return;
    for (let i = 0; i < 3; i++) {
      // P1修复: 按文档3个
      const sk = createUnit(skelDef, 100, kldd.team, kldd.row, kldd.col);
      sk.isSummon = true;
      sk.summonerId = kldd.id;
      state.units.push(sk);
    }
    trackTalent(state, kldd.id, "召唤骷髅兵×3", 3, "count");
    state.battleLog.push({
      time: 0,
      text: `💀 ${kldd.def.name} 召唤3个骷髅兵`,
      type: "status",
    });
  };
  summonSkeletons(allies);
  summonSkeletons(enemies);

  // v2.9 龙族数量加成天赋: 火翼/冰邪/血翼/寒冰 按场上龙族数量调整
  const applyDragonTalents = (us: ArenaUnit[]) => {
    const dragons = us.filter(
      (u: any) => u.def.race === "dragon" && !isRuined(u)
    );
    const nonDragons = us.filter((u: any) => u.def.race !== "dragon");
    const allDragonCount = us.filter(
      (u: any) => u.def.race === "dragon"
    ).length;
    const allNonDragonCount = us.filter(
      (u: any) => u.def.race !== "dragon"
    ).length;
    for (const d of dragons) {
      // 血翼飞龙: 异常时间倍率 (每龙-4%不含自身, 每非龙+4%; 其他龙-2%)
      if (d.def.id === "xyfl") {
        const xyflMult =
          1 - (allDragonCount - 1) * 0.04 + allNonDragonCount * 0.04;
        d._xyflMult = Math.max(0.4, xyflMult);
        for (const od of dragons) {
          if (od.id !== d.id)
            od._xyflMult = Math.max(0.4, (od._xyflMult || 1) * 0.98);
        }
      }
      // 火焰翼龙: 每龙+5%攻(不含自身), 每非龙-5%攻
      if (d.def.id === "hlyl") {
        const atkMult =
          1 + (allDragonCount - 1) * 0.025 - allNonDragonCount * 0.04; // v2.38: 3→2.5%
        d._dragonAtkMult = Math.max(0.5, atkMult);
        // 其他龙+3%攻
        for (const od of dragons) {
          if (od.id !== d.id)
            od._dragonAtkMult = (od._dragonAtkMult || 1) * 1.03;
        }
      }
      // 冰霜邪龙: 每龙+5%防, 每非龙-5%防
      if (d.def.id === "bsxl") {
        const defMult = Math.max(
          0.5,
          1 + (allDragonCount - 1) * 0.03 - allNonDragonCount * 0.04
        ); // v2.33: 4→3%
        d.currentPhysicalDef = Math.floor(d.currentPhysicalDef * defMult);
        d.currentMagicalDef = Math.floor(d.currentMagicalDef * defMult);
        for (const od of dragons) {
          if (od.id !== d.id) {
            od.currentPhysicalDef = Math.floor(od.currentPhysicalDef * 1.02);
            od.currentMagicalDef = Math.floor(od.currentMagicalDef * 1.02);
          }
        }
      }
      // 寒冰飞龙: 每龙CD-4%, 每非龙+4%
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
    // v2.12 龙吟者: 每龙+5%防/每非龙-4%防 (数双方全场, 含自身)
    const lyzUnit = us.find((u: any) => u.def.id === "lyz" && !isRuined(u));
    if (lyzUnit) {
      const allUnits = state.units.filter((x: any) => !x.isDead);
      const dragonCnt = allUnits.filter(
        (x: any) => x.def.race === "dragon"
      ).length;
      const nonDragonCnt = allUnits.length - dragonCnt;
      lyzUnit._lyzDefMult = Math.max(
        0.3,
        1 + dragonCnt * 0.05 - nonDragonCnt * 0.04
      );
    }
    // v2.32c 暴君龙: 全场非龙防御-40% (45→40)
    const bjl = us.find((u: any) => u.def.id === "bjl" && !isRuined(u));
    if (bjl) {
      const oppUnits = state.units.filter((x: any) => x.team !== bjl.team);
      for (const e of oppUnits) {
        if (e.def.race === "dragon") continue;
        e._bjlDefRed = (e._bjlDefRed || 0) + 0.45; // P0修复: 按文档 Lv.100 -45%
        e.currentPhysicalDef = Math.floor(e.currentPhysicalDef * 0.75);
        e.currentMagicalDef = Math.floor(e.currentMagicalDef * 0.75);
        e._bjlDefExpire = state.time + 999;
      }
      trackTalent(
        state,
        bjl.id,
        "吼叫降防(-45%)",
        oppUnits.filter((e: any) => e.def.race !== "dragon").length,
        "count"
      );
      state.battleLog.push({
        time: 0,
        text: `👑 ${bjl.def.name} 吼叫: 全场非龙防御-50%`,
        type: "status",
      });
    }
  };
  applyDragonTalents(allies);
  applyDragonTalents(enemies);

  // v2.9 湮灭法师天赋: 开场1s后自身与对称敌人传送离场
  const applyVoidTalents = (us: ArenaUnit[]) => {
    for (const ymfs of us.filter(
      (u: any) => u.def.id === "ymfs" && !isRuined(u)
    )) {
      ymfs._ymfsLeaveAt = 1.0;
      ymfs._ymfsReturnAt = 4.0; // 3s后返回
      ymfs._ymfsTargetLeaveAt = 2.0; // 目标1s后离场(简化: 同批)
      ymfs._ymfsTargetReturnAt = 7.0; // 100级: 6s后返回
      state.battleLog.push({
        time: 0,
        text: `🌀 ${ymfs.def.name} 准备传送湮灭`,
        type: "status",
      });
    }
  };
  applyVoidTalents(allies);
  applyVoidTalents(enemies);

  // v2.9 陷阱猎人天赋: 开场在敌方随机2格放置陷阱
  const applyTraps = (us: ArenaUnit[]) => {
    for (const xjlr of us.filter(
      (u: any) => u.def.id === "xjlr" && !isRuined(u)
    )) {
      const oppUnits = state.units.filter(
        (x: any) => x.team !== xjlr.team && !x.isDead
      );
      const targets = shuffle(oppUnits).slice(0, 2);
      for (const tr of targets as ArenaUnit[]) {
        tr._trapped = true;
        tr._trappedBy = xjlr.id; // v2.17 记录施法者
      }
      state.battleLog.push({
        time: 0,
        text: `🪤 ${xjlr.def.name} 放置陷阱: ${targets.map((t: any) => t.def.name).join(",")}`,
        type: "status",
      });
    }
  };
  applyTraps(allies);
  applyTraps(enemies);

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
            text: `🌟 ${label} 龙族×${cnt}羁绊: 起始冷却-${cnt >= 4 ? 35 : 20}%+减伤${cnt >= 4 ? 8 : 3}%开局${cnt >= 4 ? 2.5 : 2}倍${cnt >= 4 ? 10 : 6}s`,
            type: "system",
          });
        else {
          if (effect.attackBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻+${effect.attackBonus}%`,
              type: "system",
            });
          if (effect.attackSpeedBonus)
            state.battleLog.push({
              time: 0,
              text: `🌟 ${label} ${race}×${cnt}羁绊: 攻速+${effect.attackSpeedBonus}%`,
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
  addStat(state, target.id, "hitsTaken", 1); // v2.13 Step3 被攻击次数
  // v2.12 护盾吸收 (魂之引渡者)
  if (target._shield > 0) {
    const absorbed = Math.min(target._shield, dmg);
    target._shield -= absorbed;
    dmg -= absorbed;
    addStat(state, target.id, "shieldAbsorbed", absorbed);
  }
  if (dmg <= 0) return;
  // v2.12 小精灵链接: 目标受伤25%转移给小精灵承担
  if (
    target._linkOwnerId &&
    target._linkUntil &&
    state.time < target._linkUntil
  ) {
    const owner = state.units.find(
      (x: any) => x.id === target._linkOwnerId && !x.isDead
    );
    if (owner) {
      const share = Math.floor(dmg * 0.4); // v3.16: 25→40%
      owner.currentHp -= share;
      addStat(state, owner.id, "totalDamageReceived", share);
      dmg -= share;
      if (dmg <= 0) return;
    }
  }
  // v3.4 冰霜猎人受击: 天赋失效1s
  if (target.def.id === "bslr") {
    target._bslrBreakUntil = state.time + 1; // v3.4: 2→1s
  }
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
  setBattleClock(state.time);
  // 同时结算：tick 开头快照各单位状态/受击标记，本 tick 内新施加的控制/伤害不打断同 tick 施法
  for (const u of state.units) {
    u._statusSnapshot = u.statuses.slice();
    u._hitSnapshot = !!u._wasHitDuringCast;
    u._dmgSnapshot = !!u._wasDamagedDuringCast;
    // 清零标记，本 tick 内新产生的受击/受伤在下一 tick 才生效
    u._wasHitDuringCast = false;
    u._wasDamagedDuringCast = false;
  }
  // v3.3 战斗狂热两阶段: 90s 一阶段(伤害+50%/攻速+30%/CD-30%)，120s 二阶段(伤害+100%/攻速+50%/CD-40%)
  const frenzyStage = state.time >= 119.95 ? 2 : state.time >= 89.95 ? 1 : 0;
  if (frenzyStage > 0) {
    for (const u of state.units) {
      if (!u.isDead) u._frenzy = frenzyStage;
    }
    if (frenzyStage === 1 && !state._frenzyLogged) {
      state._frenzyLogged = true;
      state.battleLog.push({
        time: 90,
        text: `🔥 战斗狂热(一阶段): 全体伤害+50% 攻速+30% 冷却-30%`,
        type: "system",
      });
    }
    if (frenzyStage === 2 && !state._frenzy2Logged) {
      state._frenzy2Logged = true;
      state.battleLog.push({
        time: 120,
        text: `🔥 战斗狂热(二阶段): 全体伤害+100% 攻速+50% 冷却-40%`,
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
  updateMartyrPostmortem(state); // v3.3 殉道者阵亡后继续施法
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
      // v2.12 洞狮撕咬 DoT: 每秒纯伤 + 施法者吸血20%
      if ((s.type as string) === "bite" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            const ls = Math.floor(dmg * 0.15); // v2.13b 削弱: 吸血20%→15%
            src.currentHp = Math.min(src.maxHp, src.currentHp + ls);
            addStat(state, src.id, "lifeStealHealing", ls);
          }
          state.battleLog.push({
            time: state.time,
            text: `🦷 ${unit.def.name} 撕咬DoT ${dmg}`,
            type: "damage",
          });
        }
      }
      // v3.0 圣裁者审判 DoT
      if ((s.type as string) === "sc_judge_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
        }
      }
      // v3.0 祈祷者: 每秒回血
      const qdCycle = Math.floor(state.time);
      if (
        unit._qdRegenUntil &&
        state.time < unit._qdRegenUntil &&
        unit._qdRegenPct &&
        unit._qdRegenCycle !== qdCycle
      ) {
        unit._qdRegenCycle = qdCycle;
        const regen = Math.floor(unit.maxHp * unit._qdRegenPct);
        addStat(state, unit.id, "totalHealingReceived", regen); // v3.15 统计
        addStat(state, unit.id, "totalHealing", regen);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      }
      // v3.0 祈祷者无敌/减伤过期
      if (unit._qdInvulnUntil && state.time >= unit._qdInvulnUntil)
        unit._qdInvulnUntil = undefined;
      if (unit._qdDrUntil && state.time >= unit._qdDrUntil) {
        unit._qdDrUntil = undefined;
        unit._qdDrPct = undefined;
      }
      if (unit._qdRegenUntil && state.time >= unit._qdRegenUntil) {
        unit._qdRegenUntil = undefined;
        unit._qdRegenPct = undefined;
      }
      // P1修复: 圣裁者减伤 (敌方每增益单位+5%)
      if (unit.def.id === "sc" && !isRuined(unit)) {
        const buffed = getEnemies(state, unit.team).filter(
          (e: any) => !e.isDead && e.statuses && e.statuses.length > 0
        ).length;
        unit._scDr = buffed * 0.06; // v3.3 每个增益单位+6%
      }
      // v3.0 驱魔者: 受异常立即解除 + 10%攻+20%防 9s 叠4层
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
        const hasNeg = unit.statuses.some((s: any) =>
          negTypes.includes(String(s.type).toLowerCase())
        );
        if (hasNeg) {
          unit.statuses = unit.statuses.filter(
            (s: any) => !negTypes.includes(String(s.type).toLowerCase())
          );
          unit._qmLayers = Math.min(4, (unit._qmLayers || 0) + 1);
          unit._qmUntil = state.time + 9;
          state.battleLog.push({
            time: state.time,
            text: `⛩ ${unit.def.name} 驱魔: 解除异常 攻防+${unit._qmLayers}层`,
            type: "status",
          });
        }
      }
      if (unit._qmUntil && state.time >= unit._qmUntil) {
        unit._qmLayers = undefined;
        unit._qmUntil = undefined;
      }
      // v2.12 死亡先知吸魂 DoT: 每秒魔法 + 施法者吸血25%
      if ((s.type as string) === "drain" && s.value) {
        // v3.16g: 吸魂结束后诅咒4s（lastCycle 检查外——状态即将结束时挂载）
        if ((s as any).remainingSeconds <= 0.11 && !(s as any)._curseApplied) {
          (s as any)._curseApplied = true;
          unit.statuses.push({
            type: StatusType.Curse,
            remainingSeconds: 4,
            stacks: 1,
          });
          state.battleLog.push({
            time: state.time,
            text: `☠ ${unit.def.name} 吸魂结束: 诅咒4s`,
            type: "status",
          });
        }
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (!src) {
            // v2.17 方案C: 引导类 - 施法者死亡则吸魂中断
            s.remainingSeconds = 0;
          } else {
            const ls = Math.floor(dmg * 0.15); // v3.3 技能吸血15%
            src.currentHp = Math.min(src.maxHp, src.currentHp + ls);
            addStat(state, src.id, "lifeStealHealing", ls);
            addStat(state, src.id, "totalDamageDealt", dmg); // v3.15: 补归属
            addStat(state, src.id, "skillDamage", dmg);
            addStat(state, src.id, "magicalDamage", dmg);
          }
          if (s.remainingSeconds > 0) {
            state.battleLog.push({
              time: state.time,
              text: `💀 ${unit.def.name} 吸魂 ${dmg}`,
              type: "damage",
            });
            // v3.16g: 吸魂结束后诅咒4s（延迟到最后一跳）
            if (
              (s as any).remainingSeconds <= 0.11 &&
              !(s as any)._curseApplied
            ) {
              (s as any)._curseApplied = true;
              unit.statuses.push({
                type: StatusType.Curse,
                remainingSeconds: 4,
                stacks: 1,
              });
              state.battleLog.push({
                time: state.time,
                text: `☠ ${unit.def.name} 吸魂结束: 诅咒4s`,
                type: "status",
              });
            }
          }
        }
      }
      // v2.12 末日 DoT: 每秒13%攻击纯粹
      if ((s.type as string) === "doom" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "pureDamage", dmg);
            trackTalent(state, src.id, "末日(DoT)", dmg, "damage");
          }
          state.battleLog.push({
            time: state.time,
            text: `💀 ${unit.def.name} 末日 ${dmg}`,
            type: "damage",
          });
        }
      }
      // v2.12 冰霜吐息 DoT: 每秒80%魔法
      if ((s.type as string) === "bsxl_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "skillDamage", dmg);
            addStat(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `❄️ ${unit.def.name} 冰霜DoT ${dmg}`,
            type: "damage",
          });
        }
      }
      // v2.12 火焰喷吐 DoT: 每秒50%魔法
      if ((s.type as string) === "hlyl_burn" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "skillDamage", dmg);
            addStat(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `🔥 ${unit.def.name} 燃烧 ${dmg}`,
            type: "damage",
          });
        }
      }
      // v2.12 水晶室女冰封 DoT: 每秒90%魔法
      if ((s.type as string) === "sjsn_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "magicalDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "skillDamage", dmg);
            addStat(state, src.id, "magicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `🧊 ${unit.def.name} 冰封DoT ${dmg}`,
            type: "damage",
          });
        }
      }
      // v2.12 超级陷阱 DoT: 每2s 攻击×80%+最大HP×2% 纯粹
      if ((s.type as string) === "trap_dot" && s.value) {
        const cycle = Math.floor(state.time / 2);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const casterAtk = (s as any).casterAtk || 0;
          const dmg = Math.floor(casterAtk * 0.95 + s.value); // v2.31: 85→95%
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "pureDamage", dmg);
            trackTalent(state, src.id, "超级陷阱(DoT)", dmg, "damage");
          }
          state.battleLog.push({
            time: state.time,
            text: `🕳 ${unit.def.name} 陷阱伤害 ${dmg}`,
            type: "damage",
          });
        }
      }
      // v3.14 灵弦歌者持续治疗: 每秒20%自身攻击+10%目标攻击（每秒结算一次）
      if ((s.type as string) === "lxgz_heal_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const heal = Math.floor(
            s.value + (unit.currentAttack || unit.def.stats.attack) * 0.1
          );
          // v3.0 冰霜猎人减疗: 目标受到治疗效果-60%
          let antiHealMult =
            unit._antiHealMult &&
            unit._antiHealUntil &&
            unit._antiHealUntil > state.time
              ? unit._antiHealMult
              : 1;
          const appliedHeal = Math.floor(heal * antiHealMult);
          unit.lastHeal = { value: appliedHeal, time: state.time }; // v3: DoT 治疗量记录
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + appliedHeal);
          addStat(state, unit.id, "totalHealingReceived", heal);
          // v3.14: 治疗输出计入施法者（统计表显示）
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId
          );
          if (src) {
            addStat(state, src.id, "totalHealingDone", appliedHeal);
            addStat(state, src.id, "totalHealing", appliedHeal);
          }
          state.battleLog.push({
            time: state.time,
            text: `🎶 ${unit.def.name} 琴音回复 ${heal}`,
            type: "heal",
          });
        }
      }
      // v3.3 龙吟者 / 寒冰飞龙: 每秒治疗 DoT
      if (
        ((s.type as string) === "lyz_heal_dot" ||
          (s.type as string) === "hbfl_heal_dot") &&
        s.value
      ) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const heal = s.value;
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
          addStat(state, unit.id, "totalHealingReceived", heal);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId
          );
          if (src) {
            addStat(state, src.id, "totalHealingDone", heal);
            addStat(state, src.id, "totalHealing", heal);
          }
          state.battleLog.push({
            time: state.time,
            text: `💚 ${unit.def.name} 每秒治疗 +${heal}`,
            type: "heal",
          });
        }
      }
      // v3.3 殉道者: 每秒目标自身防御总和×20% 纯粹
      if ((s.type as string) === "xd_dot" && s.value) {
        const cycle = Math.floor(state.time);
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;
          const dmg = s.value;
          deferDamage(unit, dmg, state);
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "pureDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "pureDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `✝ ${unit.def.name} 殉道纯粹 ${dmg}`,
            type: "damage",
          });
        }
      }
      // v2.12 冰霜猎人持续射击 DoT: 每秒90%物理
      if ((s.type as string) === "bslr_dot" && s.value) {
        // v3.4 技能视为攻击: DoT 每跳按 40% 判定触发天赋的 -25%受疗2s
        const bslrSrc = state.units.find(
          (x: any) => x.id === (s as any).sourceId && !x.isDead
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
        if ((s as any).lastCycle !== cycle) {
          (s as any).lastCycle = cycle;

          const dmg = s.value;
          deferDamage(unit, dmg, state);
          const srcT = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
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
          addStat(state, unit.id, "totalDamageReceived", dmg);
          addStat(state, unit.id, "physicalDamageReceived", dmg);
          const src = state.units.find(
            (x: any) => x.id === (s as any).sourceId && !x.isDead
          );
          if (src) {
            addStat(state, src.id, "totalDamageDealt", dmg);
            addStat(state, src.id, "skillDamage", dmg);
            addStat(state, src.id, "physicalDamage", dmg);
          }
          state.battleLog.push({
            time: state.time,
            text: `❄️ ${unit.def.name} 持续射击 ${dmg}`,
            type: "damage",
          });
        }
      }
      // 回血 (亡灵复活后每秒恢复)
      if (s.type === StatusType.Regen && s.value) {
        const heal = Math.floor(unit.maxHp * s.value);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + heal);
        addStat(state, unit.id, "totalHealingReceived", heal);
        state.battleLog.push({
          time: state.time,
          text: `💚 ${unit.def.name} 回复 ${heal}`,
          type: "heal",
        });
      }
    }
    // 亡灵歌咏者天赋：诅咒DoT (文档: 目标攻击×1% + 等级×0.6, Lv100=60)
    if (unit.statuses.some((s) => s.type === StatusType.Curse)) {
      const dmg = Math.floor(unit.currentAttack * 0.01 + 22); // v2.39: 20→22
      unit.currentHp -= dmg;
      addStat(state, unit.id, "totalDamageReceived", dmg);
    }
    // v2.9 湮灭法师传送: 按时间点离场/返回
    if (
      unit._ymfsLeaveAt &&
      state.time >= unit._ymfsLeaveAt &&
      !unit._ymfsLeft
    ) {
      unit._ymfsLeft = true;
      // 找到对称敌人
      if (!unit._ymfsTargetId) {
        const sym =
          getEnemies(state, unit.team).find(
            (e: any) => e.row === unit.row && e.col === unit.col
          ) || getEnemies(state, unit.team)[0];
        if (sym) {
          unit._ymfsTargetId = sym.id;
          sym._ymfsLeft = true;
          sym._ymfsReturnAt = unit._ymfsTargetReturnAt;
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `🌀 ${unit.def.name} 传送离场`,
        type: "status",
      });
    }
    if (
      unit._ymfsLeft &&
      unit._ymfsReturnAt &&
      state.time >= unit._ymfsReturnAt
    ) {
      unit._ymfsLeft = false;
      unit._ymfsLeaveAt = undefined;
      unit._ymfsReturnAt = undefined;
      state.battleLog.push({
        time: state.time,
        text: `🌀 ${unit.def.name} 返回战场`,
        type: "status",
      });
    }
    // v2.9 血翼飞龙天赋: 异常状态持续时间调整 (每龙-4% 每非龙+4%) 等效: 每tick额外减 0.1×(1-mult)
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
    // v2.9 陷阱: 每3s失去5%最大生命
    if (unit._trapped) {
      const trapCycle = Math.floor(state.time / 3);
      if (trapCycle > 0 && unit._trapCycle !== trapCycle) {
        unit._trapCycle = trapCycle;
        const dmg = Math.floor(unit.maxHp * 0.05);
        unit.currentHp -= dmg;
        addStat(state, unit.id, "totalDamageReceived", dmg);
        const trapper = state.units.find(
          (x: any) => x.id === unit._trappedBy && !x.isDead
        ); // v2.32 聚合归属陷阱猎人
        if (trapper) {
          trackTalent(state, trapper.id, "陷阱(5%HP/3s)", dmg, "damage");
        }
        state.battleLog.push({
          time: state.time,
          text: `🪤 ${unit.def.name} 触发陷阱: -${dmg}`,
          type: "damage",
        });
      }
    }
    // v2.9 暴君龙降防衰减: 每6s恢复15%, 最低保留25%
    if (unit._bjlDefRed) {
      const cycle = Math.floor(state.time / 6);
      if (cycle > 0 && unit._bjlCycle !== cycle) {
        unit._bjlCycle = cycle;
        // 当前降防值: 0.5 → 0.35 → 0.2 → 0.125(最低25%保留)
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
    // v3.3 嚎叫巨牛激怒: 首次HP<60% → 每3s失去2%最大HP，20%减伤+30%攻+50%攻速，免疫异常至战斗结束
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
        text: `😡 ${unit.def.name} 激怒: 每3s失2%HP，减伤20% 攻+30% 攻速+50% 免疫异常`,
        type: "status",
      });
    }
    // v3.3 激怒持续期间每 3s 自损 2% 最大生命（旧实现只在触发当帧扣一次）
    if (unit.def.id === "hl" && unit._hlRageTriggered) {
      const rageCycle = Math.floor(state.time / 3);
      if (unit._hlRageCycle !== rageCycle) {
        unit._hlRageCycle = rageCycle;
        const selfDmg = Math.max(1, Math.floor(unit.maxHp * 0.02));
        unit.currentHp = Math.max(1, unit.currentHp - selfDmg);
        addStat(state, unit.id, "pureDamageTaken", selfDmg);
      }
    }
    // v2.12 自然守护过期: 双防恢复 (暴击/吸血由字段标记)
    if (
      unit._ldshzDefUntil &&
      state.time >= unit._ldshzDefUntil &&
      unit._ldshzDefApplied
    ) {
      unit.currentPhysicalDef = Math.floor(unit.currentPhysicalDef / 1.2);
      unit.currentMagicalDef = Math.floor(unit.currentMagicalDef / 1.2);
      unit._ldshzDefUntil = undefined;
      unit._ldshzDefApplied = undefined;
      if (unit._ldshzBuffUntil && state.time >= unit._ldshzBuffUntil) {
        unit.critRate = Math.max(0, (unit.critRate || 0) - 0.2);
        unit.lifeSteal = Math.max(0, (unit.lifeSteal || 0) - 0.3);
        unit._ldshzBuffUntil = undefined;
      }
    }
    // v2.17 鼓舞攻击加成到期恢复 (5s)
    if (
      unit._atkBuffUntil &&
      state.time >= unit._atkBuffUntil &&
      unit._atkBuffAmt
    ) {
      unit.currentAttack = Math.max(1, unit.currentAttack - unit._atkBuffAmt);
      unit._atkBuffAmt = undefined;
      unit._atkBuffUntil = undefined;
    }
    // v2.12 圣灵守护过期
    if (unit._slzsGuardUntil && state.time >= unit._slzsGuardUntil) {
      unit._slzsAtkMult = undefined;
      unit._slzsDr = undefined;
      unit._slzsGuardUntil = undefined;
    }
    // v3.16c 冰霜双降过期
    if (unit._bslrDebuffUntil && state.time >= unit._bslrDebuffUntil) {
      unit._bslrAtkDown = undefined;
      unit._bslrSlowDown = undefined;
      unit._bslrDebuffUntil = undefined;
    }
    // v2.12 小精灵链接过期
    if (unit._linkUntil && state.time >= unit._linkUntil) {
      unit._linkOwnerId = undefined;
      unit._linkUntil = undefined;
    }
    // v2.12 龙踏降命中过期恢复
    if (unit._hitRedUntil && state.time >= unit._hitRedUntil) {
      unit.hitRateMod = (unit.hitRateMod || 0) + 0.2;
      unit._hitRedUntil = undefined;
    }
    // v2.12 护盾过期
    if (unit._shieldUntil && state.time >= unit._shieldUntil) {
      unit._shield = undefined;
      unit._shieldUntil = undefined;
    }
    // v2.12 骷髅大帝冥火延迟伤害 (4s后100%纯粹)
    if (unit._hammerDueAt && state.time >= unit._hammerDueAt) {
      const hd = unit._hammerDelayedDmg || 0;
      unit.currentHp -= hd;
      addStat(state, unit.id, "totalDamageReceived", hd);
      addStat(state, unit.id, "pureDamageReceived", hd);
      state.battleLog.push({
        time: state.time,
        text: `🔨 ${unit.def.name} 冥火延迟伤害(75%纯粹): ${hd}`,
        type: "damage",
      });
      unit._hammerDueAt = undefined;
      unit._hammerDelayedDmg = undefined;
    }
    // v2.12 龙吟者天赋: 离开前排每秒-3%最大生命
    const lyzCycle = Math.floor(state.time);
    if (
      unit.def.id === "lyz" &&
      unit.row !== Row.Front &&
      !isRuined(unit) &&
      unit._lyzCycle !== lyzCycle
    ) {
      unit._lyzCycle = lyzCycle;
      const awayDmg = Math.floor(unit.maxHp * 0.03);
      unit.currentHp -= awayDmg;
      addStat(state, unit.id, "totalDamageReceived", awayDmg);
    }
    // v2.12 幽暗密行者天赋: 每8s同排敌方诅咒5s (复活后+破坏)
    if (unit.def.id === "yammxz" && !isRuined(unit)) {
      const ycycle = Math.floor(state.time / 8);
      if (ycycle > 0 && unit._yammxzCycle !== ycycle) {
        unit._yammxzCycle = ycycle;
        const sameRowEnemies = getEnemies(state, unit.team).filter(
          (e: any) => e.row === unit.row
        );
        for (const e of sameRowEnemies) {
          e.statuses.push({
            type: StatusType.Curse,
            remainingSeconds: 3,
            stacks: 1,
          }); // v2.18: 4→3s
          if (unit.hasRevived)
            e.statuses.push({
              type: StatusType.Ruin,
              remainingSeconds: 3,
              stacks: 1,
            });
        }
        trackTalent(
          state,
          unit.id,
          "暗影诅咒(8s周期)",
          sameRowEnemies.length * 3,
          "control"
        );
        state.battleLog.push({
          time: state.time,
          text: `🌑 ${unit.def.name} 暗影诅咒: 同排敌方${sameRowEnemies.length}人×5s`,
          type: "status",
        });
      }
    }
    // v3.0 追风攻buff过期
    if (unit._zfyxAtkUntil && state.time >= unit._zfyxAtkUntil) {
      unit._zfyxAtkStacks = undefined;
      unit._zfyxAtkUntil = undefined;
    }
    // v2.21 追风游侠闪避过期
    if (unit._zfyxEvaUntil && state.time >= unit._zfyxEvaUntil) {
      unit.evasion = Math.max(0, (unit.evasion || 0) - 0.4);
      unit._zfyxEvaUntil = undefined;
    }
    // v2.12 暗影换位闪避过期
    if (
      unit._swapEvaUntil &&
      state.time >= unit._swapEvaUntil &&
      unit._swapEvaApplied
    ) {
      unit.evasion = Math.max(0, (unit.evasion || 0) - 0.2);
      unit._swapEvaUntil = undefined;
      unit._swapEvaApplied = undefined;
    }
    // v2.12 智慧猩鼓舞减伤过期 (物减15%+魔减25%×7s)
    if (unit._zzxDrUntil && state.time >= unit._zzxDrUntil) {
      unit._zzxDrPhys = undefined;
      unit._zzxDrMag = undefined;
      unit._zzxDrUntil = undefined;
    }
    // v2.9 狂战士天赋: 每损失12%HP → 攻+4% + 减伤6% (最多5层)
    if (unit.def.id === "kzs" && !isRuined(unit)) {
      const lostPct = 1 - unit.currentHp / unit.maxHp;
      const want = Math.min(5, Math.floor(lostPct / 0.12));
      if (want !== (unit._kzsLayers || 0)) {
        unit._kzsLayers = want;
        unit._kzsAtkMult = 1 + want * 0.035; // v3.3 3%+Lv×0.05%
        unit._kzsDr = want * 0.08; // v3.3 每层8%减伤
      }
    }
    // v2.9 魂之引渡者天赋: 每4s获得1层魂能(最多5层), 每层攻防+8%
    if (unit.def.id === "hyz" && !isRuined(unit)) {
      const cycle = Math.floor(state.time / 4);
      if (cycle > 0 && unit._hyzCycle !== cycle) {
        unit._hyzCycle = cycle;
        unit._hyzStacks = Math.min(5, (unit._hyzStacks || 0) + 1);
        trackTalent(state, unit.id, "魂能层数", 1, "count");
        state.battleLog.push({
          time: state.time,
          text: `👻 ${unit.def.name} 获得魂能: ${unit._hyzStacks}层 (攻防+${unit._hyzStacks * 6}%)`,
          type: "status",
        }); // v2.13c: 8%→6%
      }
    }
    // v2.9 亡魂骑士天赋: 每1个诅咒敌人 +5%攻 +3%闪避 (用倍率字段, 每tick刷新)
    if (unit.def.id === "wqqs" && !isRuined(unit)) {
      const curseCount = getEnemies(state, unit.team).filter((e: any) =>
        e.statuses.some((s: any) => s.type === StatusType.Curse)
      ).length;
      const reviveMult = unit.hasRevived ? 1.5 : 1; // 复活后+50%
      unit._wqqsAtkMult = 1 + curseCount * 0.05 * reviveMult;
      unit._wqqsEvaMult = curseCount * 0.03 * reviveMult;
      if (curseCount > 0) {
        unit.evasion = Math.max(unit.evasion || 0, unit._wqqsEvaMult);
      }
    }
    // 中毒DoT: 每秒攻击×3%纯粹 + 治疗-25% (在calcHeal处理) + 生命回复-50% (暂未实现)
    const poison = unit.statuses.find((s) => s.type === StatusType.Poison);
    if (poison && poison.value) {
      const dmg = poison.value;
      unit.currentHp -= dmg;
      addStat(state, unit.id, "totalDamageReceived", dmg);
    }
    //     // v2.44 潜行不再每秒回血 (用户设计)
    // 炽热战士天赋：每秒对同排敌方造成纯粹伤害
    const crzsCycle = Math.floor(state.time);
    if (
      unit.def.id === "crzs" &&
      !isRuined(unit) &&
      unit._crzsCycle !== crzsCycle
    ) {
      unit._crzsCycle = crzsCycle;
      const sameRowEnemies = getEnemies(state, unit.team).filter(
        (e: any) => e.row === unit.row
      );
      for (const e of sameRowEnemies) {
        const dmg = Math.floor(unit.currentAttack * 0.035); // v3.3 Lv100=3.5%
        e.currentHp -= dmg;
        addStat(state, unit.id, "totalDamageDealt", dmg);
      }
    }
    // v2.9 彭彭猪天赋: 睡眠时驱散异常 + 每秒回4%HP
    const ppCycle = Math.floor(state.time);
    if (
      unit.def.id === "pp" &&
      !isRuined(unit) &&
      unit.statuses.some((s: any) => s.type === StatusType.Sleep) &&
      unit._ppRegenCycle !== ppCycle
    ) {
      unit._ppRegenCycle = ppCycle;
      // 驱散除睡眠外的负面状态
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
      unit.statuses = unit.statuses.filter((s: any) => !neg.includes(s.type));
      if (unit.statuses.length < before) {
        state.battleLog.push({
          time: state.time,
          text: `💤 ${unit.def.name} 睡眠驱散了异常状态`,
          type: "status",
        });
      }
      // 回血 4%/s
      const regen = Math.floor(unit.maxHp * 0.04);
      unit.currentHp = Math.min(unit.maxHp, unit.currentHp + regen);
      addStat(state, unit.id, "totalHealingReceived", regen);
      trackTalent(state, unit.id, "睡眠回血(4%/s)", regen, "heal");
      state.battleLog.push({
        time: state.time,
        text: `💤 ${unit.def.name} 睡眠回复 ${regen}`,
        type: "heal",
      });
    }
    // v2.9 猛犸象天赋: 每7s卷曲状态 (攻-25%防+50%)
    if (unit.def.id === "mmx" && !isRuined(unit)) {
      const cycle = Math.floor(state.time / 7);
      const inCurl = unit.statuses.some((s: any) => s.type === "curl");
      if (!inCurl && cycle > 0 && Math.abs(state.time - cycle * 7) < 0.15) {
        unit.statuses.push({
          type: "curl" as any,
          remainingSeconds: 4,
          stacks: 1,
          value: 1,
        }); // v2.48: 持续4s
        trackTalent(state, unit.id, "卷曲(攻-20%防+50%)", 1, "count");
        state.battleLog.push({
          time: state.time,
          text: `🛡 ${unit.def.name} 进入卷曲状态: 攻-20%防+50%`,
          type: "status",
        });
      }
      if (inCurl) {
        const curlS = unit.statuses.find((s: any) => s.type === "curl");
        if (curlS && curlS.remainingSeconds <= 0.15) {
          state.battleLog.push({
            time: state.time,
            text: `🛡 ${unit.def.name} 卷曲结束`,
            type: "status",
          });
        }
      }
    }
    // v3.3 圣裁者: DoT 结束时才清除目标全部增益（先判定再一次性 filter，
    // 避免在 for...of 遍历中重赋值 unit.statuses）
    const shouldClearBuffs = unit.statuses.some(
      (s: any) => s.remainingSeconds <= 0 && s.clearBuffsOnEnd
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
      unit.statuses = unit.statuses.filter((x: any) =>
        NEG.includes(String(x.type).toLowerCase())
      );
    }
    unit.statuses = unit.statuses.filter((s) => s.remainingSeconds > 0);
    // v3.3 法师羁绊: 每层独立计时，过期即移除并重算攻击加成
    if (unit._mageAtkLayers?.length) {
      unit._mageAtkLayers = unit._mageAtkLayers.filter(
        (l) => l.expire > state.time
      );
      const sum = unit._mageAtkLayers.reduce((s, l) => s + l.value, 0);
      unit._mageAtkMult = sum > 0 ? 1 + sum : undefined;
    }
    // v3.3 猎人羁绊: 叠层独立计时
    if (unit._hunterBondLayers?.length) {
      unit._hunterBondLayers = unit._hunterBondLayers.filter(
        (l) => l.expire > state.time
      );
    }
    // v3.3 亡灵复活后延迟持续失血（以字段实现，不可驱散）
    const decay = (unit as any)._undeadDecay;
    if (decay && !unit.isDead && state.time >= decay.startAt) {
      decay.acc += 0.1;
      if (decay.acc >= 1 - 1e-6) {
        decay.acc -= 1;
        const loss = Math.max(1, Math.floor(unit.maxHp * decay.pct));
        unit.currentHp -= loss;
        addStat(state, unit.id, "pureDamageTaken", loss);
      }
    }
    // v3.3 彭彭猪「困意」到期恢复命中率
    if (
      (unit as any)._drowsyUntil &&
      state.time >= (unit as any)._drowsyUntil
    ) {
      unit.hitRateMod =
        (unit.hitRateMod || 0) + ((unit as any)._drowsyApplied || 0.75);
      (unit as any)._drowsyUntil = undefined;
      (unit as any)._drowsyApplied = undefined;
    }
    // v3.3 魂之引渡者: 每当我方对敌施加负面状态（每次施加动作仅 +1 层）
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
    const negNow = unit.statuses.filter((s: any) =>
      NEG_STATUS.includes(String(s.type).toLowerCase())
    ).length;
    if (negNow > ((unit as any)._negCountPrev || 0)) {
      for (const hyz of state.units.filter(
        (x: any) =>
          x.team === unit.team &&
          !x.isDead &&
          x.def.id === "hyz" &&
          !isRuined(x)
      )) {
        (hyz as any)._hyzStacks = Math.min(
          5,
          ((hyz as any)._hyzStacks || 0) + 1
        );
      }
    }
    (unit as any)._negCountPrev = negNow;
    // 兼容旧字段（若历史存档仍带 _mageAtkExpire）
    if (unit._mageAtkExpire && state.time >= unit._mageAtkExpire) {
      unit._mageAtkExpire = undefined;
      if (!unit._mageAtkLayers?.length) unit._mageAtkMult = undefined;
    }
    // v3.3 嚎叫巨牛怒吼两阶段: -30%×5s → -15%×8s → 恢复
    if (unit._hlRoarExpire && state.time >= unit._hlRoarExpire) {
      if ((unit as any)._hlRoarStage2) {
        unit.currentAttack = Math.floor(
          (unit.currentAttack / (1 - (unit._hlRoarAtk ?? 0.3))) * 0.85
        );
        unit._hlRoarAtk = 0.15;
        unit._hlRoarExpire = state.time + 8;
        (unit as any)._hlRoarStage2 = false;
      } else {
        unit.currentAttack = Math.floor(
          unit.currentAttack / (1 - (unit._hlRoarAtk ?? 0.15))
        );
        unit._hlRoarAtk = undefined;
        unit._hlRoarExpire = undefined;
        (unit as any)._hlRoarStage2 = undefined;
      }
    }
    // v2.9 嘲讽过期清除
    if (unit._tauntExpire && state.time >= unit._tauntExpire) {
      unit._tauntTarget = undefined;
      unit._tauntExpire = undefined;
    }
    // v2.9 夜行狼人狼吼衰减: 每10s -20%, 最多-60% (倍率方式, 不破坏currentAttack)
    if (unit._ylRoarMult) {
      const cycle = Math.floor(state.time / 10);
      if (cycle > 0 && unit._ylRoarCycle !== cycle) {
        unit._ylRoarCycle = cycle;
        const lost = Math.min(0.2, unit._ylRoarMult - 1);
        unit._ylRoarMult = Math.max(1.0, unit._ylRoarMult - 0.2);
        // v2.11 衰减损失归因到夜行狼人 + 等效值口径: 损失点数 × 10s (该档位剩余时长)
        // v3.3 P0: 按队伍分桶，避免敌我共用同一个埋点去重计时器
        const decayKey = `_ylRoarDecayCycle_${unit.team}`;
        if ((state as any)[decayKey] !== cycle) {
          (state as any)[decayKey] = cycle;
          const ylOwner = state.units.find(
            (x: any) => x.team === unit.team && x.def.id === "yl" && !x.isDead
          );
          if (ylOwner) {
            const teamBeasts = state.units.filter(
              (x: any) =>
                x.team === unit.team && x.def.race === "beast" && !x.isDead
            );
            const totalLoss = teamBeasts.reduce(
              (s: number, b: any) =>
                s + Math.floor(b.currentAttack * lost * 10),
              0
            );
            trackTalent(state, ylOwner.id, "狼吼(衰减损失)", totalLoss, "buff");
          }
        }
        state.battleLog.push({
          time: state.time,
          text: `🐺 狼吼衰减: 兽族攻击加成降至+${Math.round((unit._ylRoarMult - 1) * 100)}%`,
          type: "status",
        });
      }
    }
  }
  // 神谕者阵亡触发 (v2.5: 按team分桶, 双方神谕者独立结算不互相覆盖)
  for (const team of ["ally", "enemy"] as const) {
    const syzT = state[`_syzDeathTime_${team}`];
    if (syzT === undefined) continue;
    const el = state.time - syzT;
    if (el >= 0 && el < 6) {
      const baseAtk = state[`_syzDeathAttack_${team}`] || 0;
      const atk60 = baseAtk > 0 ? Math.floor(baseAtk * 0.8) : 361; // v2.9 按文档 80%
      const heal = Math.floor(atk60 * (1 + el * 0.1));
      for (const u of state.units) {
        if (u.team === team && !u.isDead && u.def.race === "mage")
          u.currentHp = Math.min(u.maxHp, u.currentHp + heal);
      }
    }
  }
}

function updateCasting(state: any) {
  // 随机化施法完成结算顺序：消除镜像对局 ally 永远先结算的偏置
  const castFinishOrder = shuffle(getAlive(state));
  for (const unit of castFinishOrder) {
    if (!unit.isCasting) continue;
    unit.castTimer -= 0.1;
    // Check interrupt conditions
    const sk = unit.def.skill;
    let interrupted = false;
    let reason = "";
    // 1. CC interrupt (用tick开始时的状态快照，同tick新控制不打断同tick施法)
    const cc = (unit._statusSnapshot || unit.statuses).find((s: any) =>
      ["stun", "sleep", "petrify", "freeze", "silence"].includes(s.type)
    );
    if (cc) {
      interrupted = true;
      reason = cc.type;
    }
    // 2. Attack interrupt (用上一tick的受击标记)
    if (!interrupted && sk.interruptOnAttack && unit._hitSnapshot) {
      interrupted = true;
      reason = "受击";
    }
    // 3. Damage interrupt (用上一tick的受伤标记)
    if (!interrupted && sk.interruptOnDamage && unit._dmgSnapshot) {
      interrupted = true;
      reason = "受伤";
    }
    if (interrupted) {
      addStat(state, unit.id, "skillInterrupts", 1); // v2.13 Step2 打断埋点
      if (state.skillStats) {
        const ikey = `${unit.id}_${unit.def.skill.id}`;
        if (state.skillStats[ikey]) state.skillStats[ikey].interrupts += 1;
      }
      unit.isCasting = false;
      // 打断后CD处理（v2.3按文档）：
      // - 重拳者(毁灭打击): 打断进入完整冷却（文档明确标注）
      // - 其他角色: 不进入冷却，按施法时间重新读条（文档仅宙斯/重拳者标注CD规则，其余无标注）
      if (unit.def.skill.id === "zqz_strike") {
        unit.cooldownRemaining = unit.def.skill.cooldown;
      } else {
        // 重新读条所需时间（施法时间），避免无限打断也避免损失整个CD
        unit.cooldownRemaining = Math.max(unit.def.skill.castTime, 0.5);
      }
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
    if ((unit as any)._ymfsLeft) continue; // 离场不转CD
    if (unit.cooldownRemaining > 0) {
      // v3.3 狂热: 一阶段 CD-30% (0.13/tick)，二阶段 CD-40% (0.14/tick)
      unit.cooldownRemaining -=
        (unit as any)._frenzy === 2 ? 0.14 : (unit as any)._frenzy ? 0.13 : 0.1;
    }
  }
}

function updateSkills(state: any) {
  // 随机化施法顺序：避免镜像对局中 ally 永远先手（同tick技能同时好时）
  const castOrder = shuffle(getAlive(state));
  for (const unit of castOrder) {
    if ((unit as any)._ymfsLeft) continue; // 离场不可施法
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
    // v2.9 陷阱: 无法使用移动/切入技能
    if (
      (unit as any)._trapped &&
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
  // 随机化普攻结算顺序：消除镜像对局 ally 永远先打的偏置
  const atkOrder = shuffle(getAlive(state));
  for (const unit of atkOrder) {
    // v2.9 湮灭法师传送离场: 不可行动
    if ((unit as any)._ymfsLeft) continue;
    const cannotAttack = [
      StatusType.Stun,
      StatusType.Sleep,
      StatusType.Petrify,
      StatusType.Freeze,
      StatusType.Disarm,
    ].some((t) => unit.statuses.some((s: any) => s.type === t));
    if (cannotAttack) continue;
    // v2.9 秀逗大师攻速: 同排技能层数 ×8%攻速
    const baseInt = unit.def.stats.attackInterval;
    let atkInterval = baseInt;
    if (unit._xldsStacks && unit._xldsExpire && state.time < unit._xldsExpire) {
      atkInterval *= 1 - unit._xldsStacks * 0.1; // v3.16: 每层10%满层50%
    }
    // v3.16 灵弦歌者激昂: 攻速+25%
    if (unit._inspireAtkUntil && state.time < unit._inspireAtkUntil) {
      atkInterval *= 0.75;
    }
    // v2.10 狂战士血怒: 攻速+40%
    if (unit.statuses.some((s: any) => s.type === StatusType.Bloodrage)) {
      atkInterval *= 0.6;
    }
    // v3.16 嚎叫巨牛激怒: 攻速+30%
    if ((unit as any)._hlRageSpeedMult) {
      atkInterval *= 1 / (unit as any)._hlRageSpeedMult;
    }
    // v3.3 战斗狂热: 一阶段攻速+30%(间隔×0.7)，二阶段攻速+50%(间隔×0.5)
    if ((unit as any)._frenzy) {
      atkInterval *= (unit as any)._frenzy === 2 ? 0.5 : 0.7;
    }
    // v2.12 拍击降攻速20%: 间隔×1.25
    if ((unit as any)._slowUntil && state.time < (unit as any)._slowUntil) {
      atkInterval *= 1.25;
    }
    // v3.16c 冰霜猎人: 降攻速（20%/层×3层=60%）
    if (
      (unit as any)._bslrSlowDown &&
      (unit as any)._bslrDebuffUntil &&
      state.time < (unit as any)._bslrDebuffUntil
    ) {
      atkInterval *= 1 + (unit as any)._bslrSlowDown;
    }
    unit.attackTimer -= 0.1 * (baseInt / atkInterval);
    if (unit.attackTimer <= 0) {
      let enemies = getEnemies(state, unit.team);
      // v2.9 嘲讽: 被嘲讽者强制攻击嘲讽者
      const taunted = unit._tauntTarget
        ? enemies.find((e: any) => e.id === unit._tauntTarget && !e.isDead)
        : undefined;
      const nTargets = unit.def.id === "mds" && !isRuined(unit) ? 2 : 1;
      // v3.0 殉道者嘲讽: 目标强制
      const tauntTarget = enemies.find(
        (e: any) => e._xdTauntUntil && e._xdTauntUntil > state.time && !e.isDead
      );
      if (tauntTarget) enemies = [tauntTarget];
      // v2.10 潜行状态: 优先后排 (前10/中40/后50)
      const stealthTarget = unit._stealthAttack
        ? [
            pickTarget(enemies, [
              { row: Row.Back, chance: 50 },
              { row: Row.Mid, chance: 40 },
              { row: Row.Front, chance: 10 },
            ]),
          ].filter(Boolean)
        : undefined;
      let targets: (ArenaUnit | undefined)[] = taunted
        ? [taunted]
        : stealthTarget && stealthTarget.length > 0
          ? stealthTarget
          : nTargets === 1
            ? [pickTarget(enemies)].filter(Boolean)
            : shuffle(enemies).slice(0, nTargets);
      for (const target of targets) {
        if (!target || target.isDead) continue;
        let atkRatio = 1;
        if (unit.def.id === "mds") atkRatio = 0.85; // -15% attack per target (v2.9 按文档)
        // v2.35 夜行狼人潜行: 2.1→2.0 (兽族小削)
        let stealthBonus = false;
        if (unit.def.id === "yl" && unit._stealthAttack) {
          atkRatio *= 2.4; // v3.3 潜行 240%
          stealthBonus = true;
        }
        // v2.5: 猎人4人羁绊 - 破甲判定需要知道猎人数量
        const hunterCntP1 = state.units.filter(
          (u: any) =>
            u.team === unit.team && !u.isDead && u.def.race === "hunter"
        ).length;
        // v2.6: 龙族4人羁绊 - 攻击无视15%基础防御
        const dragonCntP1 = state.units.filter(
          (u: any) =>
            u.team === unit.team && !u.isDead && u.def.race === "dragon"
        ).length;
        // v2.12 骷髅兵: 优先攻击冥火之锤标记目标 (替换 targets)
        if (unit.def.id === "klb" && targets.length > 0) {
          const hammered = enemies.find(
            (e: any) =>
              (e as any)._hammerTarget === unit.summonerId && !e.isDead
          );
          if (hammered) targets = [hammered];
        }
        // v3.0 朱雀之神: 攻击变为魔法伤害
        const autoType =
          unit.def.id === "zq" ? DamageType.Magical : DamageType.Physical;
        // v3.3: 切入减伤只作用于 #切入 技能，不能残留到普攻
        unit._cutinDmgRed = undefined;
        const result = calcDamage(unit, target, atkRatio, autoType, {
          evasion: target.evasion,
          hitRateMod: (unit.hitRateMod || 0) - (unit._hdHitChance ? 0.15 : 0),
          // v2.12 骷髅兵无视40%防御
          ignoreDefPct:
            unit.def.id === "klb"
              ? 0.4
              : dragonCntP1 >= 4 && unit.def.race === "dragon"
                ? 0.15
                : undefined,
        });
        // v2.9 辉刀天赋: 未命中受50%反伤
        if (unit._hdHitChance && result.hit === false) {
          const rebound = Math.floor(unit.currentAttack * 0.5);
          unit.currentHp -= rebound;
          addStat(state, unit.id, "totalDamageReceived", rebound);
          trackTalent(state, unit.id, "未命中反伤", rebound, "damage");
          state.battleLog.push({
            time: state.time,
            text: `🗡 ${unit.def.name} 未命中, 反伤${rebound}`,
            type: "damage",
          });
        }
        const fs = applyFatalStrike(unit, result.finalDamage, false);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        // v2.12 地龙粗暴龙皮: 50%减伤分支 (defer前)
        if (
          target.def.id === "dl" &&
          !isRuined(target) &&
          result.finalDamage > 0 &&
          Math.random() < 0.5
        ) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7); // v3.3 ❷该次伤害-30%
          (target as any)._dlReduced = true;
        }
        deferDamage(target, result.finalDamage, state);
        // v2.12 地龙粗暴龙皮: 反伤分支 (defer后, 减伤分支不触发)
        if (
          target.def.id === "dl" &&
          !isRuined(target) &&
          result.finalDamage > 0 &&
          !(target as any)._dlReduced
        ) {
          const reflect = Math.floor(target.currentAttack * 0.12); // v3.3 地龙反伤12%
          unit.currentHp -= reflect;
          addStat(state, target.id, "totalDamageDealt", reflect);
          addStat(state, unit.id, "totalDamageReceived", reflect);
          trackTalent(state, target.id, "龙皮反伤", reflect, "damage");
          state.battleLog.push({
            time: state.time,
            text: `🪨 ${target.def.name} 反伤 ${unit.def.name}: ${reflect}`,
            type: "damage",
          });
        }
        (target as any)._dlReduced = false;
        // v2.11 增益窗口统计: 鼓舞/狼吼/激昂 窗口内普攻伤害
        if (result.finalDamage > 0) {
          const inBuff =
            (unit._atkBuffUntil && state.time < unit._atkBuffUntil) ||
            (unit._ylRoarMult && unit._ylRoarMult > 1.001) ||
            (unit._inspireAtkUntil && state.time < unit._inspireAtkUntil);
          if (inBuff) {
            unit._buffWinPhys = (unit._buffWinPhys || 0) + result.finalDamage;
          }
        }
        // v2.12 重拳者天赋: 每4次普攻, 下次攻击吸血50%+破甲6s
        if (unit.def.id === "zqz" && !isRuined(unit)) {
          unit._zqzHits = (unit._zqzHits || 0) + 1;
          if (unit._zqzPower) {
            const ls = Math.floor(result.finalDamage * 0.5); // v3.3 潜行吸血 50%
            unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
            addStat(state, unit.id, "lifeStealHealing", ls);
            target.statuses.push({
              type: StatusType.ArmorBreak,
              remainingSeconds: 7,
              stacks: 1,
            }); // v3.16: 6→7s
            trackTalent(state, unit.id, "重拳(吸血+破甲)", ls, "heal");
            unit._zqzPower = false;
          }
          if ((unit._zqzHits || 0) % 3 === 0) unit._zqzPower = true; // v3.16: 4次→3次
        }
        // v2.12 骷髅兵: 30%伤害治疗骷髅大帝
        if (unit.def.id === "klb" && result.finalDamage > 0) {
          const kldd = state.units.find(
            (x: any) => x.id === unit.summonerId && !x.isDead
          );
          if (kldd) {
            const skHeal = Math.floor(result.finalDamage * 0.2); // v2.13d 削弱: 30%→20%
            kldd.currentHp = Math.min(kldd.maxHp, kldd.currentHp + skHeal);
            addStat(state, kldd.id, "totalHealingReceived", skHeal);
          }
        }
        // v2.10 狂战士血怒: 每击附加目标当前HP×3%纯粹伤害
        if (
          unit.statuses.some((s: any) => s.type === StatusType.Bloodrage) &&
          result.finalDamage > 0
        ) {
          const blood = Math.floor(target.currentHp * 0.05); // v3.3 当前HP5%纯粹
          if (blood > 0) {
            target.currentHp -= blood;
            addStat(state, unit.id, "totalDamageDealt", blood);
            addStat(state, unit.id, "pureDamage", blood);
            addStat(state, target.id, "totalDamageReceived", blood);
            trackTalent(state, unit.id, "血怒(3%HP纯伤)", blood, "damage");
          }
        }
        // v2.9 末日使者天赋: 攻击异常敌人 15%吸血 (复活后30%)
        if (
          unit.def.id === "mrsz" &&
          !isRuined(unit) &&
          result.finalDamage > 0 &&
          target.statuses.some((s: any) =>
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
          addStat(state, unit.id, "lifeStealHealing", ls);
        }
        // v2.12 暗影噬龙天赋: 对<60%HP敌人附加损失5%纯伤(上限攻×60%)+禁疗4s
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
            addStat(state, unit.id, "totalDamageDealt", bonus);
            addStat(state, unit.id, "pureDamage", bonus);
            addStat(state, target.id, "totalDamageReceived", bonus);
            trackTalent(state, unit.id, "噬龙低血附加", bonus, "damage");
          }
          target.statuses.push({
            type: StatusType.AntiHeal,
            remainingSeconds: 4,
            stacks: 1,
          });
        }
        // v2.9 宙斯天赋: 攻击35%几率附加目标当前生命8%魔法伤害
        if (
          unit.def.id === "zs" &&
          !isRuined(unit) &&
          result.finalDamage > 0 &&
          Math.random() < 0.35
        ) {
          const bonus = Math.floor(target.currentHp * 0.08);
          if (bonus > 0) {
            target.currentHp -= bonus;
            addStat(state, unit.id, "totalDamageDealt", bonus);
            addStat(state, target.id, "totalDamageReceived", bonus);
            addStat(state, unit.id, "magicalDamageDealt", bonus);
            trackTalent(state, unit.id, "电流附加(8%HP)", bonus, "damage");
            state.battleLog.push({
              time: state.time,
              text: `⚡ ${unit.def.name} 电流附加: ${bonus}`,
              type: "damage",
            });
          }
        }
        // v2.9 潜行攻击结算: 20%吸血 + 解除潜行
        if (stealthBonus) {
          const ls = Math.floor(result.finalDamage * 0.4); // v2.48: 15→40%
          unit.currentHp = Math.min(unit.maxHp, unit.currentHp + ls);
          addStat(state, unit.id, "lifeStealHealing", ls);
          unit.statuses = unit.statuses.filter(
            (s: any) => s.type !== StatusType.Stealth
          );
          unit._stealthAttack = undefined;
          trackTalent(
            state,
            unit.id,
            "潜行(强化突袭)",
            Math.floor(result.finalDamage * 0.5),
            "damage"
          );
          trackTalent(state, unit.id, "潜行(吸血)", ls, "heal");
          state.battleLog.push({
            time: state.time,
            text: `🌙 ${unit.def.name} 潜行突袭: ${result.finalDamage}伤害+吸血${ls}`,
            type: "damage",
          });
        }
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
        // v3.0 圣职者普攻天赋:
        // 符咒大师: 3选1 (纯粹化/次级30%无视70%防/印记+1)
        if (unit.def.id === "fz" && !isRuined(unit) && result.finalDamage > 0) {
          const roll = Math.random();
          if (roll < 0.33) {
            // ❶ 伤害变纯粹 (重算)
            const pr = calcDamage(unit, target, atkRatio, DamageType.Pure, {});
            target.currentHp += result.finalDamage; // 撤销物理伤害
            target.currentHp -= pr.finalDamage;
            result.finalDamage = pr.finalDamage;
            state.battleLog.push({
              time: state.time,
              text: `🧿 符咒(纯粹): ${pr.finalDamage}`,
              type: "damage",
            });
          } else if (roll < 0.66) {
            // ❷ 次级伤害: 目标周围随机1名 30% 无视70%防御
            const nearby = getEnemies(state, unit.team).filter(
              (e: any) =>
                e.id !== target.id &&
                !e.isDead &&
                Math.max(
                  Math.abs(e.row - target.row),
                  Math.abs(e.col - target.col)
                ) <= 1
            );
            if (nearby.length > 0) {
              const n = nearby[Math.floor(Math.random() * nearby.length)];
              const sr = calcDamage(unit, n, 0.3, DamageType.Physical, {
                ignoreDefPct: 0.7,
              });
              n.currentHp -= sr.finalDamage;
              addStat(state, unit.id, "totalDamageDealt", sr.finalDamage);
              state.battleLog.push({
                time: state.time,
                text: `🧿 符咒(次级): ${pfx(n)} ${sr.finalDamage}`,
                type: "damage",
              });
            }
          } else {
            // ❸ 印记+1
            target._fzMarks = (target._fzMarks || 0) + 1;
            state.battleLog.push({
              time: state.time,
              text: `🧿 符咒印记: ${pfx(target)} +1层(${target._fzMarks})`,
              type: "status",
            });
          }
        }
        // 圣拳者: 40%几率伤害-20%变纯粹
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
            DamageType.Pure,
            {}
          );
          target.currentHp += result.finalDamage;
          target.currentHp -= pr.finalDamage;
          result.finalDamage = pr.finalDamage;
        }
        // v3.0 西部猎人天赋: 其他猎人普攻时 20%几率自身额外攻击+暴击30% (冷却3s)
        if (unit.def.race === "hunter" && result.finalDamage > 0) {
          const xblr = state.units.find(
            (x: any) =>
              x.team === unit.team &&
              !x.isDead &&
              x.def.id === "xblr" &&
              x.id !== unit.id &&
              !isRuined(x) &&
              (!x._xblrAtkCdUntil || x._xblrAtkCdUntil <= state.time)
          );
          if (xblr && Math.random() < 0.4) {
            // v3.16: 10→40%.6: 15→10%
            const xblrEnemies = getEnemies(state, xblr.team).filter(
              (e: any) =>
                !e.statuses?.some((s: any) => s.type === StatusType.Stealth)
            );
            if (xblrEnemies.length > 0) {
              const xt =
                xblrEnemies[Math.floor(Math.random() * xblrEnemies.length)];
              const xr = calcDamage(xblr, xt, 1.0, DamageType.Physical, {
                isSkill: true,
                critBonus: 0.3,
                evasion: xt.evasion,
                hitRateMod: xblr.hitRateMod || 0,
              });
              deferDamage(xt, xr.finalDamage, state);
              xt.currentHp -= xr.finalDamage;
              xblr._xblrAtkCdUntil = state.time + 8; // v3.16: CD 3→8s
              addStat(state, xblr.id, "totalDamageDealt", xr.finalDamage);
              addStat(state, xblr.id, "autoAttackDamage", xr.finalDamage);
              state.battleLog.push({
                time: state.time,
                text: `🔫 ${xblr.def.name} 联动攻击 ${pfx(xt)}: ${xr.finalDamage}${xr.isCrit ? "💥" : ""}`,
                type: "damage",
              });
            }
          }
        }
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
          // Dialogue: 普攻
          if (Math.random() < 0.5) triggerLine(unit, "attack", target.def.name);
          // v3.3 Beast bond: 3/4人时对 <75%HP 敌人普攻附带 6%/15% 攻击的纯粹伤害（仅普攻触发）
          if (unit.def.race === "beast") {
            const beastCnt = state.units.filter(
              (u: any) =>
                u.team === unit.team && !u.isDead && u.def.race === "beast"
            ).length;
            if (beastCnt >= 3 && target.currentHp / target.maxHp < 0.75) {
              const purePct = beastCnt >= 4 ? 0.15 : 0.06;
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
              const heal = Math.floor(unit.currentAttack * 0.6); // v2.9 按文档 60%
              t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
              addStat(state, unit.id, "totalHealingDone", heal);
              addStat(state, unit.id, "skillHealing", heal);
            }
          }
        }
      }
      // v3.3: attack speed formula - actual = base * (1 - bonus% * 0.5), cap 150% (减少75%间隔)
      const asBonus = Math.min(unit.attackSpeedBonus || 0, 1.5);
      // v2.9 秀逗大师攻速层数
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
      // Reset attack counter and check hunter extra target
      unit._attackCount = (unit._attackCount || 0) + 1;
      const hunterCnt = state.units.filter(
        (u: any) => u.team === unit.team && !u.isDead && u.def.race === "hunter"
      ).length;
      if (hunterCnt >= 3 && unit.def.race === "hunter") {
        const extraEvery = hunterCnt >= 4 ? 5 : 6; // v3.4: 按 V3.3 设计源 每5/6次
        const extraDmgRatio = hunterCnt >= 4 ? 0.7 : 0.35; // v3.4: 70%/35%
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
                extraDmgRatio,
                DamageType.Physical,
                {
                  evasion: extraTarget.evasion,
                  hitRateMod: unit.hitRateMod,
                  ignoreBaseDef: hunterCnt >= 4, // v2.4: 4人分叉无视防御
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
    // v3.3 殉道者: 每当友方角色阵亡（不再只在自身阵亡时）
    const martyr = state.units.find(
      (x: any) => x.team === u.team && x.def.id === "xd"
    );
    if (martyr) {
      for (const e of state.units.filter(
        (x: any) => x.team !== u.team && !x.isDead
      )) {
        const dr = Math.floor(martyr.currentAttack * 0.3); // v3.3 文档 30%纯粹
        e.currentHp -= dr;
        addStat(state, martyr.id, "totalDamageDealt", dr);
        addStat(state, martyr.id, "pureDamage", dr);
      }
      for (const a of state.units.filter(
        (x: any) => x.team === u.team && !x.isDead
      )) {
        a.currentHp = Math.min(
          a.maxHp,
          a.currentHp + Math.floor(a.maxHp * 0.05)
        );
        addStat(
          state,
          martyr.id,
          "totalHealingDone",
          Math.floor(a.maxHp * 0.05)
        );
      }
      state.battleLog.push({
        time: state.time,
        text: `✝ ${u.def.name} 阵亡触发殉道: 敌方全体攻击×30%纯粹, 我方剩余回5%最大HP`,
        type: "heal",
      });
    }
    addStat(state, u.id, "deaths", 1);
    addStat(state, u.id, "survivalTime", state.time);
    // v2.17 分析者阵亡: 标记失效, 恢复闪避 (方案C 标记类)
    if (u.def.id === "fxz") {
      for (const x of state.units) {
        if (x._markedByAnalyzer && x.team !== u.team) {
          x.evasion = x._analyzerOrigEva ?? 0;
          x._markedByAnalyzer = undefined;
          x._analyzerOrigEva = undefined;
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `🔍 ${u.def.name} 阵亡: 分析标记失效`,
        type: "status",
      });
    }
    // v2.17 陷阱猎人阵亡: 敌方场上全部陷阱清空 (方案C 标记类)
    if (u.def.id === "xjlr") {
      for (const x of state.units) {
        if (x._trappedBy === u.id) {
          x._trapped = false;
          x._trappedBy = undefined;
          x.statuses = x.statuses.filter(
            (s: any) => (s.type as string) !== "trap_dot"
          );
        }
      }
      state.battleLog.push({
        time: state.time,
        text: `🪤 ${u.def.name} 阵亡: 全部陷阱清空`,
        type: "status",
      });
    }
    // v2.9 骷髅大帝阵亡: 骷髅兵一同阵亡
    if (u.def.id === "kldd") {
      for (const sk of state.units.filter(
        (x: any) => x.isSummon && x.summonerId === u.id && !x.isDead
      )) {
        sk.currentHp = 0;
        sk.isDead = true;
      }
    }
    // v2.9 虎啸天赋: 我方兽族阵亡时 +8%攻防
    if (u.def.race === "beast" && !u.isSummon) {
      for (const hx of state.units.filter(
        (x: any) =>
          x.team === u.team && !x.isDead && x.def.id === "hx" && !isRuined(x)
      )) {
        hx.currentAttack = Math.floor(hx.currentAttack * 1.08);
        hx.currentPhysicalDef = Math.floor(hx.currentPhysicalDef * 1.08);
        hx.currentMagicalDef = Math.floor(hx.currentMagicalDef * 1.08);
        trackTalent(
          state,
          hx.id,
          "兽族阵亡增攻防",
          Math.floor(hx.currentAttack * 0.08),
          "buff"
        );
        state.battleLog.push({
          time: state.time,
          text: `😡 ${hx.def.name} 因${u.def.name}阵亡: 攻防+8%`,
          type: "status",
        });
      }
    }
    // 神谕者阵亡触发：治疗所属队伍全场法师 (v2.5: 按team分桶, 修复镜像覆盖bug)
    if (u.def.id === "syz" && !isRuined(u)) {
      state[`_syzDeathTime_${u.team}`] = state.time;
      state[`_syzDeathAttack_${u.team}`] = u.currentAttack;
      state.battleLog.push({
        time: state.time,
        text: `🛡 ${u.def.name} 阵亡触发：全法师治疗5s`,
        type: "status",
      });
    }
    // 食人魔魔法师天赋：友方阵亡→+10%最大HP上限+回15%HP (v2.9 按文档)
    for (const srm of state.units.filter(
      (x: any) =>
        x.def.id === "srm" && x.team === u.team && !x.isDead && !isRuined(x)
    )) {
      const hpBonus = Math.floor(srm.maxHp * 0.12); // v3.3 +12%最大HP
      srm.maxHp += hpBonus;
      srm.currentHp = Math.min(
        srm.maxHp,
        srm.currentHp + Math.floor(srm.maxHp * 0.15)
      );
      state.battleLog.push({
        time: state.time,
        text: `🔥 ${srm.def.name} 天赋触发: 最大HP+${hpBonus}+恢复15%HP`,
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
    // Dialogue: 阵亡
    const killer = u.lastHitBy
      ? state.units.find((x: any) => x.id === u.lastHitBy)
      : null;
    triggerLine(
      u,
      killer && killer.def.race === u.def.race ? "allyDeath" : "death",
      killer?.def.name
    );
    // v2.9 决斗大师天赋: 击杀 → 反冲30%攻 + 攻+7%防+3%永久
    if (killer && killer.def.id === "jdds" && !isRuined(killer)) {
      const rebound = Math.floor(killer.currentAttack * 0.1); // v3.3 反冲10%
      killer.currentHp -= rebound;
      addStat(state, killer.id, "totalDamageReceived", rebound);
      killer._jddsAtkBonus = (killer._jddsAtkBonus || 0) + 0.08; // v3.16: 100级10%
      killer._jddsDefBonus = (killer._jddsDefBonus || 0) + 0.03;
      trackTalent(state, killer.id, "击杀成长", 1, "count");
      state.battleLog.push({
        time: state.time,
        text: `⚔ ${killer.def.name} 击杀奖励: 攻+7%防+3% (反冲${rebound})`,
        type: "status",
      });
    }
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
    // v3.3: 召唤物（骷髅兵）不享受羁绊复活，也不计入羁绊人数
    if (u.def.race === "undead" && !u.hasRevived && !u.isSummon) {
      // v3.3: 每个亡灵首次阵亡各可复活一次（旧实现每队仅一次）
      if ((u as any)._undeadReviveUsed) continue;
      (u as any)._undeadReviveUsed = true;
      const alive = state.units.filter(
        (x: any) => x.team === u.team && !x.isDead
      );
      const totalU = state.units.filter(
        (x: any) => x.team === u.team && x.def.race === "undead" && !x.isSummon
      ).length;
      if (totalU >= 3) {
        // v3.3: 3人 10s后复活至15%HP，2s后每秒-3%最大HP；4人 5s/25%HP，3s后每秒-2%
        const is4 = totalU >= 4;
        const reviveTime = is4 ? 5 : 10;
        const hpPct = is4 ? 0.25 : 0.15;
        const decayDelay = is4 ? 3 : 2;
        const decayPct = is4 ? 0.02 : 0.03;
        u.reviving = { timer: reviveTime, hpPct, decayDelay, decayPct };
        state.battleLog.push({
          time: state.time,
          text: `💀 ${u.def.name} ${totalU}羁绊激活，${reviveTime}s后复活至${Math.round(hpPct * 100)}%HP(${decayDelay}s后每秒失去${Math.round(decayPct * 100)}%最大HP)`,
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
        const reviveHpPct = u.reviving.hpPct ?? 0.15;
        const revDecayDelay = u.reviving.decayDelay ?? 2;
        const revDecayPct = u.reviving.decayPct ?? 0.03;
        u.currentHp = Math.max(1, Math.floor(u.maxHp * reviveHpPct)); // v3.3 复活至15%/25%HP
        u.cooldownRemaining = u.def.skill.cooldown; // v3.3 复活后技能进入冷却
        u.attackTimer = 0;
        u.statuses = [];
        u.reviving = undefined;
        u.invincibleTimer = 0; // v3.3 文档未给无敌，移除旧无敌
        u.hasRevived = true;
        // v3.3 魂之引渡者: 复活后立即获得 5 层魂能
        if (u.def.id === "hyz") (u as any)._hyzStacks = 5;
        // v3.3: 延迟后每秒失去最大HP×X%（字段实现，无法驱散）
        (u as any)._undeadDecay = {
          startAt: state.time + revDecayDelay,
          pct: revDecayPct,
          acc: 0,
        };
        state.battleLog.push({
          time: state.time,
          text: `🔄 ${u.def.name} 复活至${Math.round(reviveHpPct * 100)}%HP，技能进入冷却；${revDecayDelay}s后每秒失去${Math.round(revDecayPct * 100)}%最大HP`,
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
  // v2.28 减伤常驻化 + 低血狂暴: 阈值式刷新
  for (const u of getAlive(state)) {
    if (u.def.race !== "warrior") continue;
    const wCnt = state.units.filter(
      (x: any) => x.team === u.team && !x.isDead && x.def.race === "warrior"
    ).length;
    u._warriorDr = undefined;
    u._warriorMagMult = undefined;
    u._warriorAtkMult = undefined;
    if (wCnt < 2) continue;
    const hpPct = Math.max(0, u.currentHp / u.maxHp);
    // v3.3: 减伤常驻 5%/10%/15%（魔法伤害 1.5 倍），低血攻 +10%/+15%
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
  // v3.3 P0 修复: 按队伍分别计时（旧实现是 state 级单值且在循环内清零，
  // 敌我共享且只有第一个战士能恢复，造成镜像先手偏置）
  if (!state._warriorTimerByTeam)
    state._warriorTimerByTeam = { ally: 0, enemy: 0 };
  for (const team of ["ally", "enemy"] as const) {
    const teamWarriors = getAlive(state).filter(
      (u: any) => u.team === team && u.def.race === "warrior"
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
      addStat(state, u.id, "totalHealingDone", heal);
      addStat(state, u.id, "skillHealing", heal);
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

/** v3.4 R2: 阵亡后仍可发动，冷却+100%，无降伤效果且只造成25%伤害 */
function updateMartyrPostmortem(state: any) {
  for (const xd of state.units.filter(
    (u: any) => u.def.id === "xd" && u.isDead
  )) {
    if (xd._xdPostmortemCd === undefined) xd._xdPostmortemCd = 0;
    xd._xdPostmortemCd -= 0.1;
    if (xd._xdPostmortemCd > 0) continue;
    xd._xdPostmortemCd = (xd.def.skill.cooldown || 8) * 2;
    const enemies = state.units.filter(
      (u: any) => u.team !== xd.team && !u.isDead
    );
    if (enemies.length === 0) continue;
    const t = enemies[Math.floor(Math.random() * enemies.length)];
    // v3.4: 阵亡后版本不施加降伤，DoT 只造成 50% 伤害
    const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
    t.statuses.push({
      type: "xd_dot" as any,
      remainingSeconds: 4,
      stacks: 1,
      value: Math.max(1, Math.floor(defSum * 0.2 * 0.25)),
      sourceId: xd.id, // v3.4 R2: 25%
    } as any);
    state.battleLog.push({
      time: state.time,
      text: `✝ ${xd.def.name} 阵亡后继续发动【牺牲】→ ${t.def.name}`,
      type: "control",
    });
  }
}

function updateVictory(state: any) {
  // v3.3 180s 最大战斗时间: 时间到判平局而不是失败 (防彭彭猪互打等无限战斗)
  if (state.time >= 180 && state.phase === "fighting") {
    state.phase = "finished";
    state.winner = "draw";
    for (const u of state.units) {
      if (!u.isDead) addStat(state, u.id, "survivalTime", state.time);
    }
    state.battleLog.push({
      time: state.time,
      text: `⏰ 战斗超时(180s): 平局！`,
      type: "system",
    });
    return;
  }
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
  // 分析者天赋：标记对称敌人→闪避/额外防御=0 (v2.5 修复: 按施法者team动态判断, enemy分析者也生效)
  for (const fxz of state.units.filter(
    (u: any) => !u.isDead && u.def.id === "fxz" && !isRuined(u)
  )) {
    const opp = fxz.team === "ally" ? "enemy" : "ally";
    // Find symmetric enemy: same col, mirrored row
    const symEnemy = state.units.find(
      (u: any) =>
        u.team === opp && !u.isDead && u.col === fxz.col && u.row === fxz.row
    );
    if (symEnemy) {
      symEnemy._analyzerOrigEva = symEnemy.evasion; // v2.17 记录原闪避
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
  // v2.13 Step2: 施放次数 (casts=施放, hits=命中)
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
  state.skillStats[skey].expectedHits += sk.aoe?.maxTargets || 1; // v3.15: 施放时一次（原来每目标重复加）
  let enemies = getEnemies(state, caster.team);
  // v3.0 圣职者羁绊: 反制 #增益/#治疗/#控制 (敌方施放时削弱+镜像)
  const holyCnt = state.units.filter(
    (u: any) => u.team !== caster.team && !u.isDead && u.def.race === "holy"
  ).length;
  caster._holySuppress = undefined;
  caster._holyMirror = undefined;
  if (holyCnt >= 2) {
    const isTag = (t: string) => sk.tags?.includes(t);
    if (isTag("增益") || isTag("治疗") || (isTag("控制") && holyCnt >= 3)) {
      // v3.3: 效果削弱 2人-10% / 3人-15% / 4人-20%
      caster._holySuppress = holyCnt >= 4 ? 0.2 : holyCnt >= 3 ? 0.15 : 0.1;
      caster._holyMirror = holyCnt >= 4 ? 3 : holyCnt >= 3 ? 2 : 1;
    }
  }
  const allies = getAlive(state, caster.team);
  // v3.3: 法师羁绊每次施法只结算一次（旧实现放在 AOE 目标循环内会被重复触发）
  let mageBondRolled = false;

  // v2.9 秀逗大师天赋: 同排友方技能 → 自身攻速+8%/层+技能吸血4%/层 (5层, 持续5s)
  for (const fs of state.units.filter(
    (u: any) =>
      u.team === caster.team && !u.isDead && u.def.id === "xlds" && !isRuined(u)
  )) {
    if (fs.id === caster.id) continue;
    if (fs.row === caster.row) {
      fs._xldsStacks = Math.min(5, (fs._xldsStacks || 0) + 1);
      fs._xldsExpire = state.time + 5;
      state.battleLog.push({
        time: state.time,
        text: `🔥 ${fs.def.name} 同排技能: 攻速+${fs._xldsStacks * 8}% (共${fs._xldsStacks}层)`,
        type: "status",
      });
    }
  }
  // v2.9 水晶室女天赋: 相邻(前/后/左/右)友方法师技能CD-20%
  for (const mage of state.units.filter(
    (u: any) =>
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

  // Dialogue: 技能
  triggerLine(caster, "skill");

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

  // v3.0 殉道者嘲讽: 技能目标强制
  const xdTaunt = enemies.find(
    (e: any) => e._xdTauntUntil && e._xdTauntUntil > state.time && !e.isDead
  );
  if (xdTaunt) enemies = [xdTaunt];
  // v3修复: 释放日志提前（script 技能也会记录——否则暂停检测收不到）
  log.push({
    time: state.time,
    text: `${caster.def.name} 释放【${sk.name}】`,
    type: "skill",
    sourceId: caster.id,
  });
  caster.lastSkillCast = { name: sk.name, time: state.time };
  // v3.3 祈祷者天赋: 我方所有角色每次技能后（不限施法/标签），3%纯粹 + 3%治疗
  {
    const qd = state.units.find(
      (u: any) =>
        u.team === caster.team && !u.isDead && u.def.id === "qd" && !isRuined(u)
    );
    if (qd) {
      const qEnemies = getEnemies(state, qd.team).filter((e: any) => !e.isDead);
      const mates = state.units.filter(
        (u: any) => u.team === qd.team && !u.isDead
      );
      if (qEnemies.length > 0 && mates.length > 0) {
        const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
        const qr = calcDamage(qd, qt, 0.03, DamageType.Pure, { isSkill: true });
        qt.currentHp -= qr.finalDamage;
        addStat(state, qd.id, "totalDamageDealt", qr.finalDamage);
        const ht = mates[Math.floor(Math.random() * mates.length)];
        const h = Math.floor(qd.currentAttack * 0.03);
        ht.currentHp = Math.min(ht.maxHp, ht.currentHp + h);
        addStat(state, qd.id, "totalHealingDone", h);
      }
    }
  }
  // Script-driven skill: delegate to SkillRegistry
  const handler = getSkillHandler(sk.scriptId || "");
  if (handler) {
    const scriptTargets = sk.aoe
      ? sk.id === "xcl_star"
        ? pick2x2(enemies)
        : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : ([pickTarget(enemies, sk.priority, false)].filter(
          Boolean
        ) as ArenaUnit[]);
    handler(caster, state, log, scriptTargets);
    // v3.0 祈祷者天赋: 我方施法成功 → 敌方随机1名 8%纯粹
    {
      const qd = state.units.find(
        (u: any) =>
          u.team === caster.team &&
          !u.isDead &&
          u.def.id === "qd" &&
          !isRuined(u)
      );
      if (qd && sk.castTime > 0) {
        const qEnemies = getEnemies(state, qd.team).filter(
          (e: any) => !e.isDead
        );
        if (qEnemies.length > 0) {
          const qt = qEnemies[Math.floor(Math.random() * qEnemies.length)];
          const qr = calcDamage(qd, qt, 0.08, DamageType.Pure, {
            isSkill: true,
          });
          qt.currentHp -= qr.finalDamage;
          addStat(state, qd.id, "totalDamageDealt", qr.finalDamage);
        }
      }
    }
    return;
  }

  let actionTargets: string[] = [];

  // --- v3.3 猎人羁绊: #切入 技能伤害 -15%/-30%（替换旧反击/吸血）---
  const isCutIn = sk.tags?.includes("切入");
  caster._cutinDmgRed = undefined; // 每次施法重置，避免上次切入减伤永久残留
  if (isCutIn && enemies.length > 0) {
    const defenderHunterCnt = enemies.filter(
      (u: any) => !u.isDead && u.def.race === "hunter"
    ).length;
    if (defenderHunterCnt >= 3) {
      caster._cutinDmgRed = defenderHunterCnt >= 4 ? 0.75 : 0.85; // v3.4: -25%/-15%
      log.push({
        time: state.time,
        text: `🏹 猎人羁绊: 受到[切入]技能伤害-${defenderHunterCnt >= 4 ? 25 : 15}%`,
        type: "status",
      });
    }
    // v3.0 追风游侠天赋: 敌方切入伤害-35% + 全队+10%攻6s叠4层
    const enemyZfyx = getEnemies(state, caster.team).find(
      (u: any) => u.def.id === "zfyx" && !u.isDead && !isRuined(u)
    );
    if (enemyZfyx) {
      caster._cutinDmgRed = (caster._cutinDmgRed ?? 1) * 0.65;
      for (const a of state.units.filter(
        (x: any) => x.team === enemyZfyx.team && !x.isDead
      )) {
        a._zfyxAtkStacks = Math.min(4, (a._zfyxAtkStacks || 0) + 1);
        a._zfyxAtkUntil = state.time + 6;
      }
      log.push({
        time: state.time,
        text: `💨 追风游侠: 切入伤害-35%，全队+10%攻×${enemyZfyx._zfyxAtkStacks}层`,
        type: "status",
      });
    }
    // Determine initial targets
    let cutTargets: ArenaUnit[] = [];
    if (sk.aoe) {
      cutTargets = shuffle(enemies).slice(
        0,
        sk.aoe.maxTargets || enemies.length
      );
    } else {
      const t = pickTarget(enemies, sk.priority, false);
      if (t) cutTargets = [t];
    }
    // v3.0 森之射手: 被切入技能选中时 10%几率闪避
    cutTargets = cutTargets.filter(
      (t: any) => !(t.def.id === "sszs" && !isRuined(t) && Math.random() < 0.3)
    );
    // Check each target's team for hunter bond
    for (const t of cutTargets) {
      if (t.isDead) continue;
      // v3.0 追风/西部天赋重做: 切入减伤+全队攻buff 在 executeSkill; 西部普攻联动在 updateAutoAttacks
      const targetTeam2 = state.units.filter(
        (u: any) => u.team === t.team && !u.isDead
      );
      const hunterCount2 = targetTeam2.filter(
        (u: any) => u.def.race === "hunter"
      ).length;
      if (hunterCount2 >= 3 && t.def.race === "hunter") {
        // v3.3 猎人羁绊: 被 #切入 命中后自身 +5%/+10% 攻击（最多 3 层，25s/40s，每层独立计时）
        if (!t._hunterBondLayers) t._hunterBondLayers = [];
        t._hunterBondLayers.push({
          value: hunterCount2 >= 4 ? 0.1 : 0.05,
          expire: state.time + (hunterCount2 >= 4 ? 40 : 25),
        });
        if (t._hunterBondLayers.length > 3) t._hunterBondLayers.shift();
        log.push({
          time: state.time,
          text: `🏹 ${t.def.name} 猎人羁绊叠层: +${hunterCount2 >= 4 ? 10 : 5}%攻 (${t._hunterBondLayers.length}/3)`,
          type: "status",
        });
      }
    }
  }

  // --- Damage ---
  if (sk.damage && enemies.length > 0) {
    let targets: ArenaUnit[] = [];
    // v2.12 火枪手狙击: 物防最高敌人
    if (sk.id === "hqs_snipe") {
      const maxDef = enemies.reduce(
        (m: any, e: any) =>
          !m || e.currentPhysicalDef > m.currentPhysicalDef ? e : m,
        undefined as any
      );
      if (maxDef) targets = [maxDef];
    } else if (sk.id === "hd_slash") {
      // v2.12 辉刀斩击: 随机1排
      const row = [0, 1, 2][Math.floor(Math.random() * 3)];
      targets = enemies.filter((e: any) => e.row === row);
    } else if (sk.aoe) {
      // v2.12 地狱之犬冲刺: 竖排(同列)而非随机
      if (sk.id === "dyq_dash") {
        targets = enemies.filter((e: any) => e.col === caster.col);
        if (targets.length === 0) targets = shuffle(enemies).slice(0, 3);
      } else {
        const shuffled = shuffle(enemies);
        targets = shuffled.slice(0, sk.aoe.maxTargets || enemies.length);
      }
    } else {
      const t = pickTarget(enemies, sk.priority, false);
      if (t) targets = [t];
    }
    // v3.0 前排优先特判: 炽热/亡魂骑士/骷髅大帝 (前中排有敌人时不选后排)
    if (
      ["crzs_punch", "wqqs_move", "kldd_hammer"].includes(sk.id) &&
      targets.length > 0
    ) {
      const frontMid = enemies.filter((e: any) => e.row !== Row.Back);
      if (
        frontMid.length > 0 &&
        targets.some((t: any) => t && t.row === Row.Back)
      ) {
        targets = targets
          .map((t: any) =>
            t && t.row === Row.Back
              ? pickTarget(frontMid as any, undefined, false)
              : t
          )
          .filter(Boolean);
      }
    }
    for (const dmgFormula of sk.damage) {
      // v3.16 辉刀斩击: 命中3人-35%
      let hdHitCount = 0;
      for (const t of targets) {
        if (t.isDead) continue;
        actionTargets.push(t.def.name);
        // Mage bond: tiered magic defense reduction
        const mageCnt = state.units.filter(
          (u: any) =>
            u.team === caster.team && !u.isDead && u.def.race === "mage"
        ).length;
        const mageMdefMult =
          mageCnt >= 4 ? 0.7 : mageCnt >= 3 ? 0.8 : mageCnt >= 2 ? 0.85 : 1; // v3.3: -30%/-20%/-15%魔防
        const origMdef = t.currentMagicalDef;
        if (mageMdefMult < 1 && dmgFormula.type === "magical")
          t.currentMagicalDef = Math.floor(t.currentMagicalDef * mageMdefMult);
        // v2.9 虎袭: 190-220% 随机 (文档区间)
        let ratio = dmgFormula.atkRatio ?? 1;
        if (sk.id === "hx_cut") ratio = 2.1 + Math.random() * 0.3; // v3.4 R3: 210-240%
        // v2.12 猛犸象踩踏: 前排+20%
        if (sk.id === "mmx_stomp" && t.row === Row.Front) ratio *= 1.2;
        // v3.0 猛犸象: 后排目标缴械3s
        if (sk.id === "mmx_stomp" && t.row === Row.Back) {
          t.statuses.push({
            type: StatusType.Disarm,
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
        // 地狱之犬命中3人伤害-30%
        if (
          caster.def.id === "dyq" &&
          sk.aoe &&
          targets.filter((x: any) => !x.isDead).length >= 3
        ) {
          result.finalDamage = Math.floor(result.finalDamage * 0.7);
        }
        // v2.7: 兽族4人AOE减伤8% (克龙族AOE)
        if (sk.aoe && t.aoeDamageReduction) {
          result.finalDamage = Math.floor(
            result.finalDamage * (1 - t.aoeDamageReduction)
          );
        }
        deferDamage(t, result.finalDamage, state);
        // v2.9 林地守护者天赋: 受技能伤50%几率获得护盾(攻击×600%,吸收伤害) CD5s
        const ldshzLv = (t as any).level || 100;
        if (
          t.def.id === "ldshz" &&
          !isRuined(t) &&
          result.finalDamage > 0 &&
          (!t._ldshzShieldCd || state.time >= t._ldshzShieldCd) &&
          Math.random() < 0.4 + ldshzLv * 0.002
        ) {
          // v3.16: 40%+0.2%/Lv
          t._ldshzShieldCd = state.time + 5;
          const absorbed = Math.floor(
            Math.min(result.finalDamage * 0.6, t.currentAttack * 6)
          ); // v3.3 护盾 600%攻击
          if (absorbed > 0) {
            result.finalDamage -= absorbed;
            addStat(state, t.id, "shieldAbsorbed", absorbed);
            // 护盾破碎: 我方全体平分恢复
            const allies2 = getAlive(state, t.team);
            const share = Math.floor(absorbed / Math.max(1, allies2.length));
            for (const a2 of allies2) {
              a2.currentHp = Math.min(a2.maxHp, a2.currentHp + share);
              addStat(state, a2.id, "totalHealingReceived", share);
            }
            trackTalent(state, t.id, "自然护盾", absorbed, "heal");
            state.battleLog.push({
              time: state.time,
              text: `🌳 ${t.def.name} 自然护盾: 吸收${absorbed} + 全队恢复${share}`,
              type: "heal",
            });
          }
        }
        // v2.12 圣灵守护: 同排友方魔伤转移给守护者
        if (dmgFormula.type === DamageType.Magical && result.finalDamage > 0) {
          const guard = state.units.find(
            (x: any) =>
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
            addStat(state, guard.id, "totalDamageReceived", result.finalDamage);
            result.finalDamage = 0;
          }
        }
        // v3.16 辉刀斩击: 命中3人-35%
        if (sk.id === "hd_slash") {
          hdHitCount++;
          if (hdHitCount === 3 && result.finalDamage > 0) {
            result.finalDamage = Math.floor(result.finalDamage * 0.65);
          }
        }
        // v3.16 裂地蛮熊拍击: 降20%物防6s（用户重设计）
        if (sk.id === "lbmx_smash" && result.finalDamage > 0) {
          t._lbmxArmorBreakUntil = Math.max(
            t._lbmxArmorBreakUntil || 0,
            state.time + 6
          );
          t._lbmxArmorBreakPct = 0.2;
        }
        // v2.9 秀逗大师技能吸血: 4%/层
        if (
          caster._xldsStacks &&
          caster._xldsExpire &&
          state.time < caster._xldsExpire &&
          result.finalDamage > 0
        ) {
          const ls = Math.floor(result.finalDamage * caster._xldsStacks * 0.04);
          caster.currentHp = Math.min(caster.maxHp, caster.currentHp + ls);
          addStat(state, caster.id, "lifeStealHealing", ls);
        }
        // v2.9 小精灵天赋: 我方技能造成伤害 → 回1.5%HP (每3s最多6%)
        for (const xjl of state.units.filter(
          (u: any) =>
            u.team === caster.team &&
            !u.isDead &&
            u.def.id === "xjl" &&
            !isRuined(u)
        )) {
          // v2.9 按文档: 每次技能伤害回1.5%, 每3s窗口累计上限6%
          if (
            xjl._xjlWindowStart === undefined ||
            state.time - xjl._xjlWindowStart >= 3
          ) {
            xjl._xjlWindowStart = state.time;
            xjl._xjlWindowHeal = 0;
          }
          const cap = Math.floor(xjl.maxHp * 0.06);
          const want = Math.floor(xjl.maxHp * 0.015);
          const heal = Math.max(
            0,
            Math.min(want, cap - (xjl._xjlWindowHeal || 0))
          );
          if (heal > 0) {
            xjl.currentHp = Math.min(xjl.maxHp, xjl.currentHp + heal);
            xjl._xjlWindowHeal = (xjl._xjlWindowHeal || 0) + heal;
            addStat(state, xjl.id, "totalHealingReceived", heal);
          }
        }
        // v2.9 白马行者天赋: 友方法师施加异常 → 自身CD-1s + 攻+0.8%永久
        const skStatus = (sk as any).status || (sk as any).statuses;
        const appliesDebuff = Array.isArray(skStatus)
          ? skStatus.length > 0
          : !!skStatus;
        if (appliesDebuff && !isRuined(caster)) {
          for (const bmxz of state.units.filter(
            (u: any) =>
              u.team === caster.team &&
              !u.isDead &&
              u.def.id === "bmxz" &&
              !isRuined(u)
          )) {
            bmxz.cooldownRemaining = Math.max(0, bmxz.cooldownRemaining - 1);
            bmxz._bmxzAtkBonus = (bmxz._bmxzAtkBonus || 0) + 0.008;
          }
        }
        // v2.9 圣灵战士天赋: 受魔伤50%反弹攻×85%纯伤+眩晕1s / 50%伤害-50%+恢复友方
        if (
          t.def.id === "slzs" &&
          !isRuined(t) &&
          result.finalDamage > 0 &&
          sk.damage?.[0]?.type === DamageType.Magical
        ) {
          if (Math.random() < 0.5) {
            const reflect = Math.floor(t.currentAttack * 1.0); // v3.16: 固定100%（文档）
            caster.currentHp -= reflect;
            addStat(state, t.id, "totalDamageDealt", reflect);
            addStat(state, caster.id, "totalDamageReceived", reflect);
            caster.statuses.push({
              type: StatusType.Stun,
              remainingSeconds: 1,
              stacks: 1,
            });
            trackTalent(state, t.id, "魔法反弹", reflect, "damage");
            state.battleLog.push({
              time: state.time,
              text: `🛡 ${t.def.name} 魔法反弹: ${reflect}纯伤+眩晕`,
              type: "damage",
            });
          }
        }
        // v2.9 宙斯天赋(技能): 50%几率附加目标当前生命8%魔法伤害
        if (
          caster.def.id === "zs" &&
          !isRuined(caster) &&
          result.finalDamage > 0 &&
          Math.random() < 0.5
        ) {
          const bonus = Math.floor(t.currentHp * 0.08);
          if (bonus > 0) {
            t.currentHp -= bonus;
            addStat(state, caster.id, "totalDamageDealt", bonus);
            addStat(state, t.id, "totalDamageReceived", bonus);
            addStat(state, caster.id, "magicalDamageDealt", bonus);
          }
        }
        // v3.0 死亡先知天赋: 每累积900伤害 +3.5%减伤(最多10层) v3.2: 700→900
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
            caster._swxzAccum = (caster._swxzAccum || 0) - 700; // P1: 按文档700
            caster._swxzDrLayers = (caster._swxzDrLayers || 0) + 1;
            caster.damageReduction = (caster.damageReduction || 0) + 0.035;
            trackTalent(state, caster.id, "诅咒累积减伤", 1, "count");
            state.battleLog.push({
              time: state.time,
              text: `☠ ${caster.def.name} 诅咒累积: 减伤+3.5% (共${(caster._swxzDrLayers * 3.5).toFixed(1)}%)`,
              type: "status",
            });
          }
        }
        // 技能伤害只算"受伤"不算"受击"（文档：受击打断仅对普攻/视为攻击的技能生效）
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
          dmgFormula.type,
          { hitCount: 1 }
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
          addStat(state, t.id, "critsTaken", 1); // v2.13 Step3 被暴击
        }
        if (result.isBlocked) {
          addStat(state, t.id, "blockCount", 1);
          addStat(state, t.id, "blockReduced", result.blocked);
        }
        t.lastHitBy = caster.id;
        // v2.13 炽热战士: 灼热拳击自受15%反伤 (20%→15%)
        if (sk.id === "crzs_punch" && result.finalDamage > 0) {
          const backfire = Math.floor(result.finalDamage * 0.1); // v3.3 自受10%反伤
          caster.currentHp -= backfire;
          addStat(state, caster.id, "totalDamageReceived", backfire);
        }
        // v2.12 骷髅大帝冥火: 标记目标(骷髅兵优先攻击) + 延迟4s后100%纯粹
        if (sk.id === "kldd_hammer") {
          t._hammerTarget = caster.id;
          t._hammerDueAt = state.time + 4;
          t._hammerDelayedDmg = Math.floor(caster.currentAttack * 0.75); // v3.3 75%纯粹
          // v3.3 骷髅大帝自身恢复 25% 攻击的血量
          const selfHeal = Math.floor(caster.currentAttack * 0.25);
          caster.currentHp = Math.min(
            caster.maxHp,
            caster.currentHp + selfHeal
          );
          addStat(state, caster.id, "totalHealingDone", selfHeal);
        }
        // v2.11 增益窗口统计: 鼓舞/狼吼/激昂 窗口内技能伤害
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
            text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}${result.isCrit ? "💥" : ""}${state._debug ? ` raw=${result.rawDamage.toFixed(0)} type=${dmgFormula.type} def=${dmgFormula.type === "magical" ? Math.floor(t.currentMagicalDef) : Math.floor(t.currentPhysicalDef)} dr=${((1 - result.afterDef / result.rawDamage) * 100).toFixed(0)}% front=${result.afterFrontRow.toFixed(0)} other=${result.afterOtherReduction.toFixed(0)} block=${result.blocked}${result.isCrit ? " crit*1.35=" + (result.finalDamage / (result.isCrit ? 1.35 : 1)).toFixed(0) : ""}` : ""}`,
            type: "damage",
          });
          // v3.3 法师羁绊: 每次施法 3人30%/4人50% 概率 → 全体法师 +2%/+3% 攻击
          // 持续 15s/25s，每层效果独立计算时间（只结算一次，不随 AOE 目标数重复）
          if (mageCnt >= 3 && !mageBondRolled) {
            mageBondRolled = true;
            const chance = mageCnt >= 4 ? 0.5 : 0.3;
            const gain = mageCnt >= 4 ? 0.03 : 0.02;
            const dur = mageCnt >= 4 ? 25 : 15;
            if (Math.random() < chance) {
              for (const m of state.units.filter(
                (x: any) =>
                  x.team === caster.team && !x.isDead && x.def.race === "mage"
              )) {
                const layers: { value: number; expire: number }[] =
                  m._mageAtkLayers || (m._mageAtkLayers = []);
                layers.push({ value: gain, expire: state.time + dur });
                m._mageAtkMult =
                  1 + layers.reduce((sum, l) => sum + l.value, 0);
              }
              log.push({
                time: state.time,
                text: `✨ 法师羁绊: 全体法师攻击+${Math.round(gain * 100)}%×${dur}s(独立计时)`,
                type: "status",
              });
            }
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
      // v2.12 寒冰飞龙冰封: 冰封4s (无法行动+免疫物理)
      if (sk.id === "hbfl_heal") {
        t.statuses.push({
          type: StatusType.Freeze,
          remainingSeconds: 4,
          stacks: 1,
        });
        // v3.3: 每秒 攻击×70% + 最大HP×3%，持续 4s（修「一次性当 DoT」）
        t.statuses.push({
          type: "hbfl_heal_dot" as any,
          remainingSeconds: 4,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.7 + t.maxHp * 0.03),
          sourceId: caster.id,
        } as any);
        state.battleLog.push({
          time: state.time,
          text: `🧊 ${t.def.name} 冰封4s，每秒治疗×4s`,
          type: "status",
        });
        continue;
      }
      // v3.14 灵弦歌者: 每秒恢复7s (20%自身攻击+10%目标攻击)
      if (sk.id === "lxgz_heal") {
        t.statuses.push({
          type: "lxgz_heal_dot" as any,
          remainingSeconds: 7,
          stacks: 1,
          value: Math.floor(caster.currentAttack * 0.2),
          sourceId: caster.id,
        } as any);
        log.push({
          time: state.time,
          text: `🎶 ${caster.def.name} 治愈琴音 ${t.def.name}: 每秒20%+目标攻10%×7s`,
          type: "heal",
        });
        continue;
      }
      const amount = calcHeal(caster, t, sk.heal.atkRatio ?? 1, {
        fixedAdd: sk.heal.fixedAdd,
        targetMaxHpRatio: sk.heal.targetMaxHpRatio,
        targetLostHpRatio: sk.heal.targetLostHpRatio,
      });
      // 独行马第4次升级: +90%治疗+驱散 (v2.48: 1.5→1.9)
      let finalAmount = amount;
      if (
        sk.id === "dxm_heal" &&
        caster._dxmCastCount &&
        caster._dxmCastCount % 4 === 0
      ) {
        finalAmount = Math.floor(amount * 1.9);
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
      // P1修复: 圣职者羁绊治疗削弱+镜像平分
      if ((caster as any)._holySuppress && sk.tags?.includes("治疗")) {
        const sp = (caster as any)._holySuppress;
        // v3.3: 我方全体平分「原本治疗量的 4%/10%/15%」
        const lv = (caster as any)._holyMirror;
        const mirrorPct = lv === 3 ? 0.15 : lv === 2 ? 0.1 : 0.04;
        const rawHeal = finalAmount;
        finalAmount = Math.floor(finalAmount * (1 - sp));
        const recipients = state.units.filter(
          (x: any) => x.team !== caster.team && !x.isDead
        );
        const share = Math.floor(
          (rawHeal * mirrorPct) / Math.max(1, recipients.length)
        );
        for (const h of recipients) {
          h.currentHp = Math.min(h.maxHp, h.currentHp + share);
        }
        state.battleLog.push({
          time: state.time,
          text: `🕊 圣职者羁绊: 敌方治疗-${Math.round(sp * 100)}% + 我方全体平分原本${Math.round(mirrorPct * 100)}%治疗`,
          type: "heal",
        });
      }
      // P1修复: 神谕者治疗增强+30%
      if (t._syzHealBoostUntil && t._syzHealBoostUntil > state.time) {
        finalAmount = Math.floor(finalAmount * 1.3);
      }
      caster.lastHealTarget = t.id; // v3: 治疗目标记录（演出用）
      t.lastHeal = { value: finalAmount, time: state.time }; // v3: 治疗量记录（演出结算）
      t.currentHp = Math.min(t.maxHp, t.currentHp + finalAmount);
      // v2.9 灵弦歌者天赋: 治疗 → 目标激昂 (攻+20% 攻速+12% 5s)
      if (caster.def.id === "lxgz" && !isRuined(caster)) {
        t._inspireAtkUntil = state.time + 6;
        t._inspireAtkMult = 1.2;
        trackTalent(
          state,
          caster.id,
          "激昂(+20%攻)",
          Math.floor(t.currentAttack * 0.2 * 5),
          "buff"
        ); // v2.11 等效值: 点数×5s
        log.push({
          time: state.time,
          text: `🎶 ${t.def.name} 激昂: 攻击+20%攻速+12% (5s)`,
          type: "status",
        });
      }
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

  // v2.12 通用移动: #移动 技能施放后移动至随机空位 (亡魂骑士/地狱之犬等)
  if (sk.tags?.includes("移动") && !isRuined(caster) && !sk.scriptId) {
    moveToRandomEmpty(caster, state);
    // v2.21 追风游侠: 移动后闪避+40%×4s
    if (caster.def.id === "zfyx") {
      caster.evasion = (caster.evasion || 0) + 0.4;
      caster._zfyxEvaUntil = state.time + 4;
    }
    log.push({
      time: state.time,
      text: `🏃 ${caster.def.name} 移动至 (${caster.row},${caster.col})`,
      type: "status",
    });
  }

  // --- Status effects ---
  if (sk.effects) {
    // v3.3 P0 修复: 绝不能修改 caster.def.skill.effects。
    // def 是 ALL_CHARACTERS 里的跨对局共享对象，旧实现每次被反制都永久
    // 缩短 duration / 削弱 value，批量测试中技能效果会逐场衰减到失效。
    const effSuppress =
      (caster as any)._holySuppress &&
      (sk.tags?.includes("增益") || sk.tags?.includes("控制"))
        ? (caster as any)._holySuppress
        : 0;
    if (effSuppress > 0) {
      const sp = effSuppress;
      if (
        sk.tags?.includes("增益") &&
        sk.effects.some((e: any) =>
          String(e.type).toLowerCase().includes("atk")
        )
      ) {
        // v3.3: 我方全体获得 10%/15%/20% 相同增益效果，持续 4s/5s/5s
        const mirrorPct =
          (caster as any)._holyMirror === 3
            ? 0.2
            : (caster as any)._holyMirror === 2
              ? 0.15
              : 0.1;
        for (const h of state.units.filter(
          (x: any) =>
            x.team !== caster.team && !x.isDead && x.def.race === "holy"
        )) {
          h._holyAtkMirrorUntil =
            state.time + ((caster as any)._holyMirror === 3 ? 5 : 4);
          h._holyAtkMirrorPct = mirrorPct;
        }
        state.battleLog.push({
          time: state.time,
          text: `🕊 圣职者羁绊: 敌方增益-${Math.round(sp * 100)}% + 圣职者攻+${Math.round(mirrorPct * 100)}%`,
          type: "status",
        });
      }
    }
    // v3.3 圣职者羁绊: #控制 → 使敌方随机 1 名角色受到 5%/10% 持续时间的效果与伤害的同技能
    if ((caster as any)._holySuppress && sk.tags?.includes("控制")) {
      const lv = (caster as any)._holyMirror;
      const pct = lv === 3 ? 0.1 : lv === 2 ? 0.05 : 0;
      if (pct > 0) {
        const pool = state.units.filter(
          (x: any) => x.team === caster.team && !x.isDead
        );
        const victim =
          pool.length > 0
            ? pool[Math.floor(Math.random() * pool.length)]
            : undefined;
        if (victim) {
          const ratio = (sk.damage?.[0]?.atkRatio ?? 1) * pct;
          const r = calcDamage(caster, victim, ratio, DamageType.Pure, {
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
            text: `🕊 圣职者羁绊(控制反制): ${victim.def.name} 受到 ${Math.round(pct * 100)}% 同技能`,
            type: "status",
          });
        }
      }
    }
    // v2.10 增益类效果(血怒/激昂等)施加给自己而非敌人
    const selfBuffTypes = ["bloodrage", "inspire", "atkup", "defup"];
    const isSelfBuff = sk.effects.some((e: any) =>
      selfBuffTypes.includes(String(e.type).toLowerCase())
    );
    const targets = isSelfBuff
      ? [caster]
      : sk.aoe
        ? sk.id === "xcl_star"
          ? pick2x2(enemies)
          : sk.id === "wlgyz_heal"
            ? shuffle(enemies).slice(0, 1)
            : shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
        : [pickTarget(enemies, sk.priority, false)].filter(Boolean);
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
        // v3.3 圣骑士: 免疫 [沉默]/[破坏]/[缴械]/[诅咒]
        if (
          [
            StatusType.Silence,
            StatusType.Ruin,
            StatusType.Disarm,
            StatusType.Curse,
          ].includes(eff.type) &&
          t.def.id === "sq"
        )
          continue;
        // For burn, calculate per-tick damage immediately using caster's attack
        const val =
          eff.type === "burn"
            ? Math.floor(caster.currentAttack * (eff.value || 0.05))
            : eff.value;
        // v2.21 湮灭法师: 束缚或破甲 (50/50)
        let effType = eff.type;
        if (
          sk.id === "ynfs_annihilate" &&
          eff.type === StatusType.Bind &&
          Math.random() < 0.5
        ) {
          effType = StatusType.ArmorBreak;
        }
        // v3.3 P0: 反制削弱只在施加时按局部系数计算，def 保持只读
        t.statuses.push({
          type: effType,
          remainingSeconds:
            eff.duration !== undefined
              ? Math.max(0.5, eff.duration * (1 - effSuppress))
              : eff.duration,
          stacks: 1,
          value: val !== undefined ? Math.floor(val * (1 - effSuppress)) : val,
        });
        // v2.12 亡魂骑士: 诅咒扩散到相邻格子随机3名敌方
        if (sk.id === "wqqs_move" && eff.type === StatusType.Curse) {
          const nearby = enemies.filter(
            (e: any) =>
              e.id !== t.id &&
              Math.max(Math.abs(e.row - t.row), Math.abs(e.col - t.col)) <= 1 &&
              !e.isDead
          );
          const spread = shuffle(nearby).slice(0, 3);
          for (const sp of spread) {
            sp.statuses.push({
              type: StatusType.Curse,
              remainingSeconds: eff.duration,
              stacks: 1,
            });
          }
        }
        // v2.10 狂战士血怒: 消耗10%当前HP
        if (eff.type === StatusType.Bloodrage && caster.def.id === "kzs") {
          const cost = Math.floor(caster.currentHp * 0.1);
          caster.currentHp -= cost;
          addStat(state, caster.id, "totalDamageReceived", cost);
          trackTalent(state, caster.id, "血怒(消耗10%HP)", cost, "count");
        }
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
  if (s && typeof s[field] === "number") {
    // v3.3-r5: survivalTime 记的是「时刻」而非「数量」。复活单位原本会被
    // updateDeaths 与 updateVictory 各记一次并累加，导致存活s > 战斗时长，
    // 进而让 10s 归一失真。改为覆盖取最后一次记录时刻。
    if (field === "survivalTime") s[field] = value;
    else s[field] += value;
  }
  // v3.3 圣裁者「最近 9s 累计伤害」滚动窗口（此前 _dmgRecent9s 从未赋值）
  if (field === "totalDamageDealt" && value > 0) {
    const u = state.units?.find((x: any) => x.id === unitId);
    if (u) {
      if (!u._dmgWindow) u._dmgWindow = [];
      u._dmgWindow.push({ t: state.time, v: value });
      const cutoff = state.time - 9;
      u._dmgWindow = u._dmgWindow.filter((e: any) => e.t >= cutoff);
      u._dmgRecent9s = u._dmgWindow.reduce(
        (sum: number, e: any) => sum + e.v,
        0
      );
    }
  }
}

export function trackSkill(
  state: any,
  unitId: string,
  skillId: string,
  skillName: string,
  damage: number,
  dmgType: string,
  options?: { hitCount?: number; expectedHits?: number; interrupted?: boolean }
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

/**
 * v2.10 天赋贡献埋点: 记录天赋触发次数与贡献量
 * valueType: damage(额外/反伤/DoT伤害) | heal(回血/吸血) | buff(增攻/降防等效量) | control(控制时长s) | count(纯次数)
 */
function trackTalent(
  state: any,
  unitId: string,
  talentName: string,
  value: number,
  valueType: "damage" | "heal" | "buff" | "control" | "count" = "count"
) {
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
  // v3.3-r5: 同步落到角色统计，供「每个角色细颗粒度」报告按角色汇总。
  // 口径提醒: 天赋归因伤害与 auto/skill 来源分轨有重叠，不可三者直接相加。
  if (valueType === "damage") addStat(state, unitId, "talentDamage", value);
  else if (valueType === "heal") addStat(state, unitId, "talentHealing", value);
  else if (valueType === "buff") addStat(state, unitId, "buffValue", value);
  else if (valueType === "control")
    addStat(state, unitId, "controlSeconds", value);
}

export function generateEnemyTeam(): { charId: string; row: Row }[] {
  // v3.3: 召唤物只在战斗中被召唤，不能作为可部署角色被随机选中
  const summonIds = new Set(SUMMON_CHARACTERS.map((c) => c.id));
  const pool = [...CHARACTER_MAP.values()].filter((c) => !summonIds.has(c.id));
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 6); // 6-8 units
  return selected.map((c) => ({
    charId: c.id,
    row: Math.floor(Math.random() * 3) as Row,
  }));
}
