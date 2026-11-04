// 验证: 吸魂结束诅咒（延迟挂诅咒）
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const undead = ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"];
const holy = ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"];
const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
const makeTeam = (ids: string[]) => ids.slice(0, 8).map((charId, i) => ({ charId, row: positions[i][0], col: positions[i][1] }));

const state = initBattle(makeTeam(undead) as any, makeTeam(holy) as any) as unknown as BattleState;
let safety = 0;
while (state.phase === "fighting" && safety < 5000) {
  processTick(state as any);
  safety++;
}
console.log(`结果: ${state.winner === "ally" ? "亡灵胜" : "圣职者胜"} (${state.time.toFixed(1)}s)`);
const log = (state as any).battleLog || [];
console.log(`总日志 ${log.length} 条——吸魂/诅咒相关:`);
for (const e of log) {
  const t = e.text;
  if (t.includes("吸魂") || t.includes("诅咒") || t.includes("驱魔")) {
    console.log(`${e.time.toFixed(1)}s ${t}`);
  }
}
