import { Race } from '../types';

export interface BondEffect {
  attackBonus: number;
  defenseBonus: number;
  special?: string;
}

export const BOND_EFFECTS: Record<Race, BondEffect> = {
  [Race.Beast]:  { attackBonus: 25, defenseBonus: 15, special: '对低于50%HP敌人攻击附带20%吸血' },
  [Race.Hunter]: { attackBonus: 40, defenseBonus: 0,  special: '被切入时先发动一次100%伤害的无视防御反击' },
  [Race.Warrior]:{ attackBonus: 0,  defenseBonus: 0,  special: '生命+50%，每10s免疫异常5s' },
  [Race.Mage]:   { attackBonus: 0,  defenseBonus: 0,  special: '减少敌方50%魔法防御，每次技能30%减10%冷却' },
  [Race.Undead]: { attackBonus: 20, defenseBonus: 25, special: '首个阵亡后全队失去5%HP，7s后复活恢复35%HP+无敌1s' },
  [Race.Dragon]: { attackBonus: 30, defenseBonus: 0,  special: '所有龙族技能起始冷却缩短60%' },
};

/** Centralized race display config */
export const RACE_CONFIG: Record<string, { label: string; color: string; short: string }> = {
  [Race.Beast]:  { label: '兽族', color: '#8d6e63', short: '兽' },
  [Race.Hunter]: { label: '猎人', color: '#4caf50', short: '猎' },
  [Race.Warrior]:{ label: '战士', color: '#f44336', short: '战' },
  [Race.Mage]:   { label: '法师', color: '#2196f3', short: '法' },
  [Race.Undead]: { label: '亡灵', color: '#9c27b0', short: '亡' },
  [Race.Dragon]: { label: '龙族', color: '#ff9800', short: '龙' },
};

export const RACE_BG: Record<string, string> = {
  [Race.Beast]:  'linear-gradient(135deg,#4e342e,#3e2723)',
  [Race.Hunter]: 'linear-gradient(135deg,#1b5e20,#2e7d32)',
  [Race.Warrior]:'linear-gradient(135deg,#b71c1c,#c62828)',
  [Race.Mage]:   'linear-gradient(135deg,#0d47a1,#1565c0)',
  [Race.Undead]: 'linear-gradient(135deg,#4a148c,#6a1b9a)',
  [Race.Dragon]: 'linear-gradient(135deg,#e65100,#ef6c00)',
};

export function countRaceOnTeam(units: { def: { race: Race } }[]): Map<Race, number> {
  const counts = new Map<Race, number>();
  for (const u of units) {
    counts.set(u.def.race, (counts.get(u.def.race) ?? 0) + 1);
  }
  return counts;
}

export function getActiveBonds(units: { def: { race: Race } }[]): Map<Race, BondEffect> {
  const counts = countRaceOnTeam(units);
  const active = new Map<Race, BondEffect>();
  for (const [race, count] of counts) {
    if (count >= 3) {
      active.set(race, BOND_EFFECTS[race]);
    }
  }
  return active;
}
