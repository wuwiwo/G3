/** 法师镜像 - 对比 ally/enemy 起始冷却与首次普攻时间 */
import { initBattle } from "../src/engine/battle";
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
let allyCdSum = 0,
  enemyCdSum = 0;
let allyAtkSum = 0,
  enemyAtkSum = 0;
let allyCdLess = 0;

for (let k = 0; k < RUNS; k++) {
  const state = initBattle(
    makeTeam(mage) as any,
    makeTeam(mage) as any
  ) as unknown as BattleState;
  let aCd = 0,
    eCd = 0,
    aAtk = 0,
    eAtk = 0;
  for (const u of state.units) {
    if (u.team === "ally") {
      aCd += u.cooldownRemaining;
      aAtk += u.attackTimer;
    } else {
      eCd += u.cooldownRemaining;
      eAtk += u.attackTimer;
    }
  }
  allyCdSum += aCd;
  enemyCdSum += eCd;
  allyAtkSum += aAtk;
  enemyAtkSum += eAtk;
  if (aCd < eCd) allyCdLess++;
}

console.log(`起始冷却 (越低越早放技能):`);
console.log(`  ally 平均: ${(allyCdSum / RUNS / 8).toFixed(2)}s`);
console.log(`  enemy 平均: ${(enemyCdSum / RUNS / 8).toFixed(2)}s`);
console.log(`  ally总CD更小的比例: ${((allyCdLess / RUNS) * 100).toFixed(1)}%`);
console.log(`首次普攻时间 (越低越早):`);
console.log(`  ally 平均: ${(allyAtkSum / RUNS / 8).toFixed(2)}s`);
console.log(`  enemy 平均: ${(enemyAtkSum / RUNS / 8).toFixed(2)}s`);
