/** 法师镜像 - 前25s完整时间线对比 ally/enemy 行动 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const mage = ["xdds", "sjsn", "bmxz", "srm", "ynfs", "syz", "zs", "xjl"];

function makeTeam(
  ids: string[]
): { charId: string; row: number; col: number }[] {
  const positions = [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
  ];
  return ids
    .slice(0, 8)
    .map((cid, i) => ({
      charId: cid,
      row: positions[i][0],
      col: positions[i][1],
    }));
}

const state = initBattle(
  makeTeam(mage) as any,
  makeTeam(mage) as any
) as unknown as BattleState;
let lastIdx = 0;
let safety = 0;
while (state.phase === "fighting" && safety < 2500) {
  processTick(state as any);
  safety++;
  if (state.battleLog.length > lastIdx) {
    const entries = state.battleLog.slice(lastIdx);
    lastIdx = state.battleLog.length;
    for (const e of entries) {
      if (
        e.time <= 25 &&
        (e.type === "skill" ||
          e.type === "death" ||
          e.type === "system" ||
          (e.type === "status" &&
            (e.text.includes("打断") || e.text.includes("羁绊"))))
      ) {
        console.log(`[${e.time.toFixed(1)}s] ${e.text}`);
      }
    }
  }
}
console.log(
  `\n胜负: ${state.winner === "ally" ? "ally" : "enemy"} (${state.time.toFixed(1)}s)`
);
