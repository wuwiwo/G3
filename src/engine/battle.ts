import {
  ArenaUnit, BattleState, BattleLogEntry,
  Row, StatusType, DamageType,
} from '../types';
import { BattleStats } from '../types/stats';
import { calcDamage, calcHeal, applyFatalStrike } from './damage';
import { getActiveBonds } from '../data/races';
import { getSkillHandler } from './SkillRegistry';
import { CHARACTER_MAP } from '../data/characters';

let nextUnitId = 0;
let nextLogId = 0;

function logEntry(time:number,text:string,type:BattleLogEntry['type'],extra?:Partial<BattleLogEntry>):BattleLogEntry {
  return {id:`l${nextLogId++}`,time,text,type,...extra};
}

function pfx(u: ArenaUnit): string {
  return (u.team === 'ally' ? '🟦' : '🟥') + u.def.name;
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

function lvScale(base: number, growth: number, level: number) {
  return base + growth * (level - 1);
}

export function createUnit(def: any, level: number, team: 'ally' | 'enemy', row: Row, col: number = 0): ArenaUnit {
  const hp = lvScale(def.stats.hp, def.growth.hp, level);
  return {
    id: `u_${nextUnitId++}`, def, level, team, row, col,
    currentHp: hp, maxHp: hp,
    currentAttack: lvScale(def.stats.attack, def.growth.attack, level),
    currentPhysicalDef: lvScale(def.stats.physicalDef, def.growth.physicalDef, level),
    currentMagicalDef: lvScale(def.stats.magicalDef, def.growth.magicalDef, level),
    cooldownRemaining: def.skill.cooldown * 0.5,
    castTimer: 0, isCasting: false,
    attackTimer: Math.random() * def.stats.attackInterval,
    isDead: false, statuses: [],
    autoAttackTargetId: undefined,
    evasion: def.id === 'sszs' ? (0.25) : 0,
    hitRateMod: def.id === 'hd' ? -0.1 : 0,
  };
}

function getAlive(state: BattleState, team?: 'ally' | 'enemy'): ArenaUnit[] {
  return state.units.filter(u => !u.isDead && (team === undefined || u.team === team));
}

function getEnemies(state: BattleState, selfTeam: 'ally' | 'enemy'): ArenaUnit[] {
  return state.units.filter(u => u.team !== selfTeam && !u.isDead);
}

function pickTarget(enemies: ArenaUnit[], rowPref?: { row: Row; chance: number }[]): ArenaUnit | undefined {
  if (enemies.length === 0) return undefined;
  if (rowPref && rowPref.length > 0) {
    // Weighted random by row
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        const inRow = enemies.filter(e => e.row === p.row);
        if (inRow.length > 0) return inRow[Math.floor(Math.random() * inRow.length)];
        break;
      }
    }
  }
  // Default: front row weighted
  const hasFront = enemies.some(e => e.row === Row.Front);
  const chances = hasFront
    ? [{ row: Row.Front, c: 50 }, { row: Row.Mid, c: 30 }, { row: Row.Back, c: 20 }]
    : [{ row: Row.Mid, c: 60 }, { row: Row.Back, c: 40 }];
  const total = chances.reduce((s, r) => s + r.c, 0);
  let roll = Math.random() * total;
  for (const p of chances) {
    roll -= p.c;
    if (roll <= 0) {
      const inRow = enemies.filter(e => e.row === p.row);
      if (inRow.length > 0) return inRow[Math.floor(Math.random() * inRow.length)];
      break;
    }
  }
  return enemies[Math.floor(Math.random() * enemies.length)];
}

export function initBattle(
  allyChars: { charId: string; row: Row; col?: number }[],
  enemyChars: { charId: string; row: Row; col?: number }[],
): BattleState & { stats: BattleStats[] } {
  nextUnitId = 0;
  const makeUnits = (chars: { charId: string; row: Row }[], team: 'ally' | 'enemy') =>
    chars.map(c => {
      const def = CHARACTER_MAP.get(c.charId);
      return def ? createUnit(def, 100, team, c.row, c.col ?? 0) : null;
    }).filter(Boolean) as ArenaUnit[];

  const allies = makeUnits(allyChars, 'ally');
  const enemies = makeUnits(enemyChars, 'enemy');
  const units = [...allies, ...enemies];

  // Apply bonds
  const apply = (us: ArenaUnit[]) => {
    let dragonCount = 0;
    for (const [race, effect] of getActiveBonds(us)) {
      for (const u of us) {
        if (u.def.race === race) {
          if (effect.attackBonus) u.currentAttack *= 1 + effect.attackBonus / 100;
          if (effect.defenseBonus) {
            u.currentPhysicalDef *= 1 + effect.defenseBonus / 100;
            u.currentMagicalDef *= 1 + effect.defenseBonus / 100;
          }
        }
      }
      if (race === 'warrior') {
        for (const u of us) {
          if (u.def.race === race) {
            u.maxHp = Math.floor(u.maxHp * 1.5);
            u.currentHp = Math.floor(u.currentHp * 1.5);
          }
        }
      }
      if (race === 'dragon') dragonCount = us.filter(u=>u.def.race==='dragon').length;
    }
    // Dragon bond: starting cooldown reduced by additional 50%
    if (dragonCount >= 3) {
      for (const u of us) {
        if (u.def.race === 'dragon') {
          u.cooldownRemaining *= 0.4; // v1.6: 4龙=60%缩短 → 40%剩余
        }
      }
    }
  };
  apply(allies);
  apply(enemies);

  const stats: BattleStats[] = units.map(u => ({
    unitId: u.id, name: u.def.name, race: u.def.race,
    team: u.team, totalDamageDealt: 0, totalDamageReceived: 0,
    totalHealingDone: 0, totalHealingReceived: 0, kills: 0, deaths: 0, skillCasts: 0,
    autoAttackDamage: 0, skillDamage: 0,
    critCount: 0, critDamage: 0, blockCount: 0, blockReduced: 0,
  }));

  return {
    units, time: 0, phase: 'fighting', turnEvents: [],
    battleLog: [{ time: 0, text: '⚔️ 战斗开始！', type: 'system' }],
    stats,
    bonds: {
      ally: calcBonds(allies),
      enemy: calcBonds(enemies),
    },
  };

  function calcBonds(us: ArenaUnit[]): {race:string;count:number}[] {
    const rc: Record<string,number> = {};
    for(const u of us.filter(u=>!u.isDead)) {
      rc[u.def.race] = (rc[u.def.race]||0)+1;
    }
    return Object.entries(rc).filter(([_,c])=>c>=3).map(([r,c])=>({race:r,count:c}));
  }
}

const MAX_LOG = 2000;

export function processTick(state: any): any {
  if (state.phase !== 'fighting') return state;
  state.time += 0.1;
  updateStatuses(state);
  updateCasting(state);
  updateCooldowns(state);
  updateSkills(state);
  updateAutoAttacks(state);
  updateDeaths(state);
  updateRevivals(state);
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
        unit.currentHp -= dmg;
        addStat(state, unit.id, 'totalDamageReceived', dmg);
        state.battleLog.push({ time: state.time, text: `🔥 ${unit.def.name} 灼烧 ${dmg}`, type: 'damage' });
      }
    }
    unit.statuses = unit.statuses.filter(s => s.remainingSeconds > 0);
  }
}

function updateCasting(state: any) {
  for (const unit of getAlive(state)) {
    if (!unit.isCasting) continue;
    unit.castTimer -= 0.1;
    if (unit.castTimer <= 0) {
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
    const cannotCast = [StatusType.Stun,StatusType.Sleep,StatusType.Petrify,StatusType.Freeze,StatusType.Silence]
      .some(t => unit.statuses.some((s:any) => s.type === t));
    const isBound = unit.statuses.some((s:any) => s.type === StatusType.Bind);
    if (cannotCast) continue;
    if (isBound && unit.def.skill.tags?.some((t:string) => t === '切入' || t === '移动')) continue;
    const sk = unit.def.skill;
    if (sk.castTime > 0) {
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
    const cannotAttack = [StatusType.Stun,StatusType.Sleep,StatusType.Petrify,StatusType.Freeze,StatusType.Disarm]
      .some(t => unit.statuses.some((s:any) => s.type === t));
    if (cannotAttack) continue;
    unit.attackTimer -= 0.1;
    if (unit.attackTimer <= 0) {
      const target = pickTarget(getEnemies(state, unit.team));
      if (target) {
        const result = calcDamage(unit, target, 1, DamageType.Physical, { evasion: target.evasion, hitRateMod: unit.hitRateMod });
        const fs = applyFatalStrike(unit, result.finalDamage, false);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        target.currentHp -= result.finalDamage;
        // Track crit/block stats
        if (result.isCrit) { addStat(state, unit.id, 'critCount', 1); addStat(state, unit.id, 'critDamage', result.finalDamage); }
        if (result.isBlocked) { addStat(state, target.id, 'blockCount', 1); addStat(state, target.id, 'blockReduced', result.blocked); }
        target.lastDamage = { value: result.finalDamage, time: state.time, type: 'physical' };
        target.lastAction = { time: state.time, isTarget: true };
        unit.lastAction = { time: state.time, targetName: target.def.name, isTarget: false };
        target.lastHitBy = unit.id;
        addStat(state, unit.id, 'totalDamageDealt', result.finalDamage);
        addStat(state, unit.id, 'autoAttackDamage', result.finalDamage);
        addStat(state, target.id, 'totalDamageReceived', result.finalDamage);
        if (result.finalDamage > 0) {
          unit.lastHitTarget = target.id;
          target.lastHitBy = unit.id;
          state.battleLog.push({ time: state.time, text: `${pfx(unit)} ⚔️ ${pfx(target)}: ${result.finalDamage}${result.isCrit ? '💥' : ''}`, type: 'damage' });
        }
      }
      unit.attackTimer = unit.def.stats.attackInterval * 1.5;
    }
  }
}

function updateDeaths(state: any) {
  for (const u of state.units) {
    if (u.currentHp > 0 || u.isDead) continue;
    u.isDead = true;
    addStat(state, u.id, 'deaths', 1);
    // Credit kill to last attacker
    if (u.lastHitBy) addStat(state, u.lastHitBy, 'kills', 1);
    state.battleLog.push({ time: state.time, text: `💀 ${pfx(u)} 阵亡！`, type: 'death' });
    if (u.def.race === 'undead' && !u.hasRevived) {
      const alive = state.units.filter((x:any) => x.team === u.team && !x.isDead);
      const totalU = state.units.filter((x:any) => x.team === u.team && x.def.race === 'undead').length;
      if (totalU >= 3) {
        for (const m of alive) { if (m.def.race === 'undead') m.currentHp = Math.max(1, Math.floor(m.currentHp * 0.95)); }
        u.reviving = { timer: 7, hpPct: 0.35 };
        state.battleLog.push({ time: state.time, text: `💀 ${u.def.name} ${totalU >= 4 ? '4' : '3'}羁绊激活，7s后复活！`, type: 'status' });
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
        u.reviving = undefined;
        u.invincibleTimer = 1;
        u.hasRevived = true;
        state.battleLog.push({ time: state.time, text: `🔄 ${u.def.name} 复活！恢复${Math.floor(pct*100)}%HP`, type: 'status' });
      }
    }
    // Temporary revival countdown (龙吟者)
    if (u.tempReviveTimer && u.tempReviveTimer > 0) {
      u.tempReviveTimer -= 0.1;
      if (u.tempReviveTimer <= 0 && !u.isDead) {
        u.isDead = true;
        u.tempReviveTimer = undefined;
        state.battleLog.push({ time: state.time, text: `⏳ ${u.def.name} 临时复活结束`, type: 'status' });
      }
    }
    if (u.invincibleTimer && u.invincibleTimer > 0) {
      u.invincibleTimer -= 0.1;
      if (u.invincibleTimer <= 0) u.invincibleTimer = undefined;
    }
  }
}

function updateVictory(state: any) {
  const a = getAlive(state).filter((u:any) => u.team === 'ally');
  const e = getAlive(state).filter((u:any) => u.team === 'enemy');
  if (a.length === 0 || e.length === 0) {
    state.phase = 'finished';
    state.winner = a.length > 0 ? 'ally' : 'enemy';
    state.battleLog.push({ time: state.time, text: `🏁 ${state.winner === 'ally' ? '我方' : '敌方'}胜利！`, type: 'system' });
  }
}

function updateBonds(state: any) {
  const calc = (team: string) => {
    const rc: Record<string,number> = {};
    for (const u of state.units.filter((x:any) => x.team === team && !x.isDead))
      rc[u.def.race] = (rc[u.def.race]||0) + 1;
    return Object.entries(rc).filter(([_,c]) => c >= 3).map(([r,c]) => ({race:r,count:c}));
  };
  state.bonds = { ally: calc('ally'), enemy: calc('enemy') };
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
  addStat(state, caster.id, 'skillCasts', 1);
  const sk = caster.def.skill;
  const enemies = getEnemies(state, caster.team);
  const allies = getAlive(state, caster.team);

  log.push({ time: state.time, text: `${caster.def.name} 释放【${sk.name}】`, type: 'skill' });
  caster.lastSkillCast = { name: sk.name, time: state.time };

  // Script-driven skill: delegate to SkillRegistry
  const handler = getSkillHandler(sk.scriptId || '');
  if (handler) {
    const scriptTargets = sk.aoe
      ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : [pickTarget(enemies, sk.priority)].filter(Boolean) as ArenaUnit[];
    handler(caster, state, log, scriptTargets);
    return;
  }

  let actionTargets: string[] = [];

  // --- Hunter counter-attack (if skill has #切入 tag) ---
  const isCutIn = sk.tags?.includes('切入');
  if (isCutIn && enemies.length > 0) {
    // Determine initial targets
    let cutTargets: ArenaUnit[] = [];
    if (sk.aoe) {
      cutTargets = shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length);
    } else {
      const t = pickTarget(enemies, sk.priority);
      if (t) cutTargets = [t];
    }
    // Check each target's team for hunter bond
    for (const t of cutTargets) {
      if (t.isDead) continue;
      const targetTeam = state.units.filter((u:any) => u.team === t.team && !u.isDead);
      const hunterCount = targetTeam.filter((u:any) => u.def.race === 'hunter').length;
      if (hunterCount >= 3) {
        // Counter-attack: 100% physical damage, ignores defense
        // Use calcDamage for counter (respects defense, block, crit)
        const counterResult = calcDamage(t, caster, 1, DamageType.Physical, { isSkill: true });
        const counterDmg = counterResult.finalDamage;
        caster.currentHp -= counterDmg;
        caster.lastDamage = { value: counterDmg, time: state.time, type: 'physical' };
        caster.lastAction = { time: state.time, isTarget: true };
        log.push({ time: state.time, text: `🔄 ${t.def.name} 反击 ${pfx(caster)}: ${counterDmg}${counterResult.isCrit ? '💥' : ''}`, type: 'damage' });
        addStat(state, t.id, 'totalDamageDealt', counterDmg);
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
        // Mage bond: -50% magic defense
        const mageCnt = state.units.filter((u:any) => u.team===caster.team && !u.isDead && u.def.race==='mage').length;
        const origMdef = t.currentMagicalDef;
        if (mageCnt >= 3 && dmgFormula.type === 'magical') t.currentMagicalDef = Math.floor(t.currentMagicalDef * 0.5);
        const result = calcDamage(caster, t, dmgFormula.atkRatio ?? 1, dmgFormula.type, {
          fixedAdd: dmgFormula.fixedAdd,
          defMultiplier: dmgFormula.defMultiplier,
          defSquaredDiv: dmgFormula.defSquaredDiv,
          selfDefMultiplier: dmgFormula.selfDefMultiplier,
          targetMaxHpRatio: dmgFormula.targetMaxHpRatio,
          isSkill: true,
          evasion: t.evasion,
          hitRateMod: caster.hitRateMod,
        });
        const fs = applyFatalStrike(caster, result.finalDamage, true);
        if (fs.triggered) result.isCrit = true;
        result.finalDamage = fs.damage;
        t.currentHp -= result.finalDamage;
        if (mageCnt >= 3 && dmgFormula.type === 'magical') t.currentMagicalDef = origMdef;
        t.lastDamage = { value: result.finalDamage, time: state.time, type: dmgFormula.type };
        t.lastAction = { time: state.time, isTarget: true };
        addStat(state, caster.id, 'totalDamageDealt', result.finalDamage);
        addStat(state, caster.id, 'skillDamage', result.finalDamage);
        addStat(state, t.id, 'totalDamageReceived', result.finalDamage);
        if (result.isCrit) { addStat(state, caster.id, 'critCount', 1); addStat(state, caster.id, 'critDamage', result.finalDamage); }
        if (result.isBlocked) { addStat(state, t.id, 'blockCount', 1); addStat(state, t.id, 'blockReduced', result.blocked); }
        t.lastHitBy = caster.id;
        if (result.finalDamage > 0) {
          log.push({ time: state.time, text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}${result.isCrit ? '💥' : ''}`, type: 'damage' });
        }
      }
    }
  }

  // --- Heal ---
  if (sk.heal) {
    let targets: ArenaUnit[] = [];
    if (sk.id === 'dxm_heal') {
      // Prefer beast, then lowest HP
      const beast = allies.filter(a => a.def.race === 'beast').sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      const all = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
      targets = [beast[0] || all[0]];
    } else if (sk.id === 'lxgz_heal') {
      targets = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp).slice(0, 2);
    } else if (sk.id === 'wlgyz_heal') {
      targets = shuffle(allies).slice(0, 2);
    } else if (sk.id === 'hbfl_heal') {
      const candidates = allies.filter(a => a.def.race === 'dragon' && a.currentHp / a.maxHp < 0.3);
      targets = candidates.length > 0 ? [candidates[0]] : [];
    } else {
      targets = allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp).slice(0, 1);
    }

    for (const t of targets) {
      if (t.isDead) continue;
      actionTargets.push(t.def.name);
      const amount = calcHeal(caster, t, sk.heal.atkRatio ?? 1, {
        fixedAdd: sk.heal.fixedAdd,
        targetMaxHpRatio: sk.heal.targetMaxHpRatio,
        targetLostHpRatio: sk.heal.targetLostHpRatio,
      });
      t.currentHp = Math.min(t.maxHp, t.currentHp + amount);
      t.lastHeal = { value: amount, time: state.time };
      t.lastAction = { time: state.time, isTarget: true };
      addStat(state, caster.id, 'totalHealingDone', amount);
      addStat(state, t.id, 'totalHealingReceived', amount);
      log.push({ time: state.time, text: `${pfx(caster)} 💚 ${pfx(t)}: +${amount}`, type: 'heal' });
    }
  }

  if (actionTargets.length > 0) {
    caster.lastAction = { time: state.time, targetName: [...new Set(actionTargets)].join(',') };
  }

  // --- Status effects ---
  if (sk.effects) {
    const targets = sk.aoe
      ? shuffle(enemies).slice(0, sk.aoe.maxTargets || enemies.length)
      : [pickTarget(enemies, sk.priority)].filter(Boolean);
    for (const t of targets) {
      if (!t || t.isDead) continue;
      for (const eff of sk.effects) {
        // For burn, calculate per-tick damage immediately using caster's attack
        const val = eff.type === 'burn' ? Math.floor(caster.currentAttack * (eff.value || 0.05)) : eff.value;
        t.statuses.push({ type: eff.type, remainingSeconds: eff.duration, stacks: 1, value: val });
      }
    }
  }
}

function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === 'number') s[field] += value;
}

export function generateEnemyTeam(): { charId: string; row: Row }[] {
  const pool = [...CHARACTER_MAP.values()];
  const shuffled = pool.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.floor(Math.random() * 3) + 6); // 6-8 units
  return selected.map(c => ({
    charId: c.id,
    row: Math.floor(Math.random() * 3) as Row,
  }));
}
