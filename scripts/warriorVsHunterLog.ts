/** 战士vs猎人 - 单场日志: 看猎人普攻/分叉打战士的实际伤害 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const warrior = ["crzs", "hd", "fxz", "fdzs", "kzs", "slzs", "zqz", "jdds"];
const hunter = ["sszs", "bslr", "hqs", "mds", "zfyx", "lxgz", "xjlr", "xblr"];

function makeTeam(ids: string[]): { charId: string; row: number; col: number }[] {
  const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
  return ids.slice(0, 8).map((cid, i) => ({ charId: cid, row: positions[i][0], col: positions[i][1] }));
}

const state = initBattle(makeTeam(hunter) as any, makeTeam(warrior) as any) as unknown as BattleState;
let lastIdx = 0;
let safety = 0;
const hits: { t: number; text: string }[] = [];
while (state.phase === "fighting" && safety < 3000) {
  processTick(state as any);
  safety++;
  if (state.battleLog.length > lastIdx) {
    const entries = state.battleLog.slice(lastIdx);
    lastIdx = state.battleLog.length;
    for (const e of entries) {
      if (e.time <= 15 && e.type === "damage" && e.text.includes("🟦")) {
        hits.push({ t: e.time, text: e.text });
      }
    }
  }
}
console.log("前15s 猎人(🟦)对战士的伤害:");
for (const h of hits) console.log(`[${h.t.toFixed(1)}s] ${h.text.slice(0, 90)}`);
console.log(`\n胜负: ${state.winner === "ally" ? "猎人(ally)" : "战士(enemy)"} (${state.time.toFixed(1)}s)`);
