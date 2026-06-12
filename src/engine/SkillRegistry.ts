import { ArenaUnit, StatusType } from '../types';
import { CHARACTER_MAP } from '../data/characters';

export type SkillHandler = (caster: ArenaUnit, state: any, log: any[], targets: ArenaUnit[]) => void;

const registry = new Map<string, SkillHandler>();

export function registerSkillHandler(skillId: string, handler: SkillHandler) {
  registry.set(skillId, handler);
}
export function getSkillHandler(skillId: string): SkillHandler | undefined {
  return registry.get(skillId);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Skill Handler Registrations ----

// 龙吟者 — 特殊治疗+升级机制+临时复活
registerSkillHandler('lyz_heal', (caster, state, log, targets) => {
  if (!caster.def.skill.heal) return;
  const allies = state.units.filter((u: any) => u.team === caster.team && !u.isDead);
  const deadDragons = state.units.filter((u: any) => u.team === caster.team && u.isDead && u.def.race === 'dragon');

  // Track cast count
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = (caster.castCount >= 4);

  // Target selection: lowest HP dragon(s)
  let targetsList = allies.filter((u: any) => u.def.race === 'dragon')
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);

  if (targetsList.length === 0) return;

  const selected = upgraded ? targetsList.slice(0, 2) : [targetsList[0]];
  const ratio = upgraded ? 0.75 : 0.5;
  const dr = upgraded ? 0.25 : 0.15;

  for (const t of selected) {
    const healAmt = Math.floor(caster.currentAttack * ratio);
    t.currentHp = Math.min(t.maxHp, t.currentHp + healAmt);
    log.push({ time: state.time, text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: +${healAmt}${upgraded ? '(强化)' : ''}`, type: 'heal' });
  }

  // Temporary revive a dead dragon if any ally dragon died this battle
  if (deadDragons.length > 0) {
    const reviveTarget = deadDragons[Math.floor(Math.random() * deadDragons.length)];
    reviveTarget.isDead = false;
    reviveTarget.currentHp = Math.floor(reviveTarget.maxHp * 0.5);
    reviveTarget.statuses = [];
    reviveTarget.tempReviveTimer = 5;
    log.push({ time: state.time, text: `🎵 ${caster.def.name} 临时复活 ${reviveTarget.def.name} 5s!`, type: 'status' });
  }
});

// 小精灵 — 链接
registerSkillHandler('xjl_link', (caster, state, log) => {
  const allies = state.units.filter((u:any) => u.team === caster.team && !u.isDead && u.id !== caster.id);
  if (allies.length === 0) return;
  // Priority: mage > adjacent > highest attack
  const mages = allies.filter((u:any) => u.def.race === 'mage');
  const target = mages[0] || allies.sort((a:any,b:any)=>b.currentAttack-a.currentAttack)[0];
  if (target) {
    target.skillPower = (target.skillPower || 1) + 0.4;
    target.lifeSteal = (target.lifeSteal || 0) + 0.25;
    log.push({ time: state.time, text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+40%吸血+25%`, type: 'status' });
  }
});

// 末日使者 — 末日
registerSkillHandler('mrsz_doom', (caster, state, log) => {
  if (caster.currentHp / caster.maxHp < 0.2) return; // HP<20% can't cast
  // Self damage
  const cost = Math.floor(caster.maxHp * 0.15);
  caster.currentHp -= cost;
  // Find target: highest total damage dealt in last ~10s
  const enemies = state.units.filter((u:any) => u.team !== caster.team && !u.isDead);
  const topDmg = enemies.sort((a:any,b:any) => (b.totalDamageDealt||0) - (a.totalDamageDealt||0))[0];
  if (topDmg) {
    topDmg.statuses.push({ type:StatusType.Silence, remainingSeconds:7, stacks:1, sourceId:caster.id });
    topDmg.statuses.push({ type:StatusType.Ruin, remainingSeconds:7, stacks:1, sourceId:caster.id });
    log.push({ time: state.time, text: `💀 ${caster.def.name} 对 ${topDmg.def.name} 施加末日7s!`, type: 'status' });
  }
});

// 死亡先知 — 吸魂巫术
registerSkillHandler('swxz_drain', (caster, state, log) => {
  const enemies = state.units.filter((u:any) => u.team !== caster.team && !u.isDead);
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  if (!target) return;
  const perTick = Math.floor(target.currentAttack * 0.2 + target.maxHp * 0.03);
  const totalDmg = perTick * 5;
  target.currentHp -= totalDmg;
  const heal = Math.floor(totalDmg * 0.4);
  caster.currentHp = Math.min(caster.maxHp, caster.currentHp + heal);
  target.statuses.push({ type:StatusType.Curse, remainingSeconds:4, stacks:1 });
  log.push({ time: state.time, text: `💀 ${caster.def.name} 吸取 ${target.def.name}: ${totalDmg}伤害+${heal}治疗`, type: 'damage' });
});

// Initialize all registered handlers
export function initSkillHandlers() {
  // Registrations are done at module load time above
}
