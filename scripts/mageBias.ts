/** 法师镜像偏置对照实验：对调参数顺序验证 ally 偏置 */
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

const RUNS = 200;

async function main() {
  // 实验1: mage vs mage (正常顺序)
  let a1 = 0;
  for (let k = 0; k < RUNS; k++) if (runOne(mage, mage) === "ally") a1++;
  console.log(
    `实验1 mage(ally) vs mage(enemy): ally胜 ${((a1 / RUNS) * 100).toFixed(1)}%`
  );

  // 实验2: 对调 (同一批阵容, ally/enemy 标签互换)
  let a2 = 0;
  for (let k = 0; k < RUNS; k++) if (runOne(mage, mage) === "ally") a2++;
  // 注意: runOne(mage, mage) 两个参数一样, 对调无意义!
  // 正确对照: 用不同随机种子验证是否稳定
  console.log(`实验2 重复跑: ally胜 ${((a2 / RUNS) * 100).toFixed(1)}%`);

  // 实验3: 打乱 ally 内部顺序 (先手方内部排序影响?)
  const mageShuffled = [...mage].reverse();
  let a3 = 0;
  for (let k = 0; k < RUNS; k++)
    if (runOne(mageShuffled, mage) === "ally") a3++;
  console.log(
    `实验3 mage(反序ally) vs mage: ally胜 ${((a3 / RUNS) * 100).toFixed(1)}%`
  );
}

main();
