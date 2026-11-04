// 亡灵 vs 圣职者 批量对局（站位修复后验证）
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const undead = ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"];
const holy = ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"];
const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
const makeTeam = (ids: string[]) => ids.slice(0, 8).map((charId, i) => ({ charId, row: positions[i][0], col: positions[i][1] }));

const runs = parseInt(process.argv[2] || "100");
let udWins = 0, durations = 0;
for (let i = 0; i < runs; i++) {
  const state = initBattle(makeTeam(undead) as any, makeTeam(holy) as any) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  if (state.winner === "ally") udWins++;
  durations += state.time;
}
const udPct = (udWins / runs * 100).toFixed(1);
const holyPct = (100 - udWins / runs * 100).toFixed(1);
console.log(`亡灵 vs 圣职者 (${runs} 局, 站位修复后): 亡灵 ${udPct}% / 圣职者 ${holyPct}% | 场均时长 ${(durations/runs).toFixed(1)}s`);
