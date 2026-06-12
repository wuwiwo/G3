import { Race } from '../types';

export interface BattleStats {
  unitId: string;
  name: string;
  race: Race;
  team: 'ally' | 'enemy';
  // Damage
  totalDamageDealt: number;
  totalDamageReceived: number;
  autoAttackDamage: number;
  skillDamage: number;
  // Healing
  totalHealingDone: number;
  totalHealingReceived: number;
  // Combat
  kills: number;
  deaths: number;
  skillCasts: number;
  critCount: number;
  critDamage: number;
  blockCount: number;
  blockReduced: number;
}
