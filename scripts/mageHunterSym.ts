/** 法师vs猎人对调验证 - 大样本确认不对称 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const mage = ["xdds", "sjsn", "bmxz", "srm", "ynfs", "syz", "zs", "xjl"];
const hunter = ["sszs", "bslr", "hqs", "mds", "zfyx", "lxgz", "xjlr", "xblr"];

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

function runOne(ally: string[], enemy: string[]): "ally" | "enemy" {
  const state = initBattle(
    makeTeam(ally) as any,
    makeTeam(enemy) as any
  ) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  return state.winner || "enemy";
}

async function main() {
  const RUNS = 300;
  // 方向1: 法师 ally
  let mWins = 0;
  for (let k = 0; k < RUNS; k++) if (runOne(mage, hunter) === "ally") mWins++;
  // 方向2: 猎人 ally (对调)
  let hWins = 0;
  for (let k = 0; k < RUNS; k++) if (runOne(hunter, mage) === "ally") hWins++;

  const pctM = (mWins / RUNS) * 100;
  const pctH = (hWins / RUNS) * 100;
  console.log(`法师vs猎人 ${RUNS}场/方向:`);
  console.log(`  法师(ally) vs 猎人(enemy): 法师胜 ${pctM.toFixed(1)}%`);
  console.log(`  猎人(ally) vs 法师(enemy): 猎人胜 ${pctH.toFixed(1)}%`);
  console.log(`  互补和: ${(pctM + pctH).toFixed(1)}% (理论100%)`);
  console.log(`  偏差: ${Math.abs(pctM + pctH - 100).toFixed(1)}pp`);
  console.log(`  300场 SE≈2.9%, 偏差>6pp 确认不对称`);
}

main();
