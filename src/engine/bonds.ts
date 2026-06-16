import { Race } from "../types";
import { ALL_CHARACTERS } from "../data/characters";
import { getBondAtTier, RACE_CONFIG } from "../data/races";

export interface BondInfo {
  race: Race;
  count: number;
  desc: string;
}

/** Compute active bonds from an array of unit definitions (used by TeamSetup) */
export function calcBondsFromDefs(
  units: { charId: string | null }[]
): BondInfo[] {
  const counts: Record<string, number> = {};
  for (const u of units) {
    if (!u.charId) continue;
    const ch = ALL_CHARACTERS.find((c) => c.id === u.charId);
    if (ch) counts[ch.race] = (counts[ch.race] || 0) + 1;
  }
  return (Object.entries(counts) as [Race, number][])
    .filter(([_, c]) => c >= 2)
    .map(([race, count]) => {
      const eff = getBondAtTier(race, count);
      const desc = [
        eff.attackBonus ? `攻+${eff.attackBonus}%` : "",
        eff.defenseBonus ? `防+${eff.defenseBonus}%` : "",
        eff.hpBonus ? `HP+${eff.hpBonus}%` : "",
        eff.hitRateBonus ? `命中+${eff.hitRateBonus}%` : "",
        eff.evasionBonus ? `闪避+${eff.evasionBonus}%` : "",
        eff.special || "",
      ]
        .filter(Boolean)
        .join(" ");
      return { race, count, desc };
    });
}

export const GRID_ROWS = 3;
export const GRID_COLS = 3;
export const MAX_TEAM_SIZE = 8;
export const TOTAL_GRID = GRID_ROWS * GRID_COLS;

export function posToRC(index: number): { row: number; col: number } {
  return { row: Math.floor(index / GRID_COLS), col: index % GRID_COLS };
}
