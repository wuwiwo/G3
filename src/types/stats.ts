import { Race } from "../types";

export interface BattleStats {
  unitId: string;
  name: string;
  race: Race;
  team: "ally" | "enemy";
  // Damage
  totalDamageDealt: number;
  totalDamageReceived: number;
  autoAttackDamage: number;
  skillDamage: number;
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  // Healing
  totalHealingDone: number;
  totalHealingReceived: number;
  lifeStealHealing: number;
  skillHealing: number;
  // Combat
  kills: number;
  deaths: number;
  skillCasts: number;
  critCount: number;
  critDamage: number;
  blockCount: number;
  blockReduced: number;
  // Survival
  survivalTime: number;
}
