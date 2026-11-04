import { Race } from "../types";

export interface BattleStats {
  unitId: string;
  name: string;
  race: Race;
  team: "ally" | "enemy";
  // Damage dealt
  totalDamageDealt: number;
  autoAttackDamage: number;
  skillDamage: number;
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  // Damage received (by type)
  totalDamageReceived: number;
  physicalDamageReceived: number;
  magicalDamageReceived: number;
  pureDamageReceived: number;
  // Healing
  totalHealingDone: number;
  totalHealingReceived: number;
  lifeStealHealing: number;
  skillHealing: number;
  // Defense
  blockCount: number;
  blockReduced: number;
  shieldAbsorbed: number;
  // Combat
  kills: number;
  deaths: number;
  skillCasts: number;
  critCount: number;
  critDamage: number;
  // v2.13 Step2/3: 技能/承伤细化
  skillInterrupts: number;    // 技能被打断次数
  hitsTaken: number;          // 被攻击次数
  critsTaken: number;         // 被暴击次数
  // Timing
  survivalTime: number;
}
