/** 法师镜像 - 统计首次行动/首次击杀的阵营归属 */
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

const RUNS = 200;
let allyWin = 0;
let firstSkillAlly = 0;
let firstSkillTime = 0;
let firstKillAlly = 0;

for (let k = 0; k < RUNS; k++) {
  const state = initBattle(
    makeTeam(mage) as any,
    makeTeam(mage) as any
  ) as unknown as BattleState;
  let safety = 0;
  let fsDone = false,
    fkDone = false;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
    // 首个技能
    if (!fsDone) {
      for (const e of state.battleLog) {
        if (e.type === "skill") {
          firstSkillAlly +=
            e.sourceId?.startsWith("u_") && parseInt(e.sourceId.slice(2)) < 8
              ? 1
              : 0;
          firstSkillTime += e.time;
          fsDone = true;
          break;
        }
      }
    }
    // 首个阵亡
    if (!fkDone) {
      for (const e of state.battleLog) {
        if (e.type === "death") {
          // sourceId = 死者? 检查格式
          const isAlly = e.text.includes("🟦");
          firstKillAlly += isAlly ? 1 : 0; // 统计先死的是 ally 还是 enemy
          fkDone = true;
          break;
        }
      }
    }
  }
  if (state.winner === "ally") allyWin++;
}

console.log(`总场次: ${RUNS}`);
console.log(`ally 胜率: ${((allyWin / RUNS) * 100).toFixed(1)}%`);
console.log(
  `首个技能为 ally: ${((firstSkillAlly / RUNS) * 100).toFixed(1)}% (平均首技能时间 ${(firstSkillTime / RUNS).toFixed(2)}s)`
);
console.log(
  `首个阵亡为 ally: ${((firstKillAlly / RUNS) * 100).toFixed(1)}% (先死=劣势方)`
);
