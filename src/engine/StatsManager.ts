import { BattleStats } from '../types/stats';

/**
 * Centralized stats recording — single entry point for all battle statistics.
 * Instead of addStat(state, id, 'totalDamageDealt', n) scattered across battle.ts,
 * use statsManager.recordDamage(id, n, 'auto') etc.
 */
export class StatsManager {
  private stats: Map<string, BattleStats> = new Map();

  constructor(initial: BattleStats[]) {
    for (const s of initial) {
      this.stats.set(s.unitId, s);
    }
  }

  getStats(): BattleStats[] {
    return Array.from(this.stats.values());
  }

  get(unitId: string): BattleStats | undefined {
    return this.stats.get(unitId);
  }

  /** Record auto-attack or skill damage */
  recordDamage(unitId: string, amount: number, type: 'auto' | 'skill', isCrit: boolean = false) {
    const s = this.stats.get(unitId);
    if (!s) return;
    s.totalDamageDealt += amount;
    if (type === 'auto') s.autoAttackDamage += amount;
    else s.skillDamage += amount;
    if (isCrit) { s.critCount++; s.critDamage += amount; }
  }

  /** Record damage received */
  recordDamageReceived(unitId: string, amount: number) {
    const s = this.stats.get(unitId);
    if (s) s.totalDamageReceived += amount;
  }

  /** Record healing done and received */
  recordHeal(sourceId: string, targetId: string, amount: number) {
    const src = this.stats.get(sourceId);
    const tgt = this.stats.get(targetId);
    if (src) src.totalHealingDone += amount;
    if (tgt) tgt.totalHealingReceived += amount;
  }

  /** Record a kill */
  recordKill(unitId: string) {
    const s = this.stats.get(unitId);
    if (s) s.kills++;
  }

  /** Record a death */
  recordDeath(unitId: string) {
    const s = this.stats.get(unitId);
    if (s) s.deaths++;
  }

  /** Record a skill cast */
  recordSkillCast(unitId: string) {
    const s = this.stats.get(unitId);
    if (s) s.skillCasts++;
  }

  /** Record a block */
  recordBlock(unitId: string, reduced: number) {
    const s = this.stats.get(unitId);
    if (s) { s.blockCount++; s.blockReduced += reduced; }
  }
}
