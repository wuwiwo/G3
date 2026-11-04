/** 阵营对称性验证 - 对调双方参数, 检查胜负是否互补 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const ROSTER: Record<string, string[]> = {
  beast: ["pp", "mmx", "lbmx", "hx", "ds", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "zfyx", "sszs", "xblr", "hqs", "lxgz", "xjlr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["swxz", "kldd", "dyq", "mrsz", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "xyfl", "hlyl", "bsxl", "aysl", "lyz", "hbfl"],
};

const RACE_CN: Record<string, string> = {
  beast: "兽族", hunter: "猎人", warrior: "战士",
  mage: "法师", undead: "亡灵", dragon: "龙族",
};

const RACES = ["beast", "undead", "dragon", "mage", "hunter", "warrior"];

function makeTeam(ids: string[]): { charId: string; row: number; col: number }[] {
  const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
  return ids.slice(0, 8).map((cid, i) => ({ charId: cid, row: positions[i][0], col: positions[i][1] }));
}

function runOne(ally: string[], enemy: string[]): "ally" | "enemy" {
  const state = initBattle(makeTeam(ally) as any, makeTeam(enemy) as any) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) { processTick(state as any); safety++; }
  return state.winner || "enemy";
}

async function main() {
  const RUNS = 150;
  console.log(`阵营对称性验证 (每方向 ${RUNS} 局)`);
  console.log("=".repeat(72));
  console.log("对局            A视角  B视角  互补和  判定");
  console.log("-".repeat(72));
  let totalDev = 0, worst = 0;
  const pairs: [string, string][] = [];
  for (let i = 0; i < RACES.length; i++)
    for (let j = i + 1; j < RACES.length; j++) pairs.push([RACES[i], RACES[j]]);

  for (const [a, b] of pairs) {
    // 方向1: A 是 ally
    let aWins = 0;
    for (let k = 0; k < RUNS; k++) if (runOne(ROSTER[a], ROSTER[b]) === "ally") aWins++;
    const pctAB = aWins / RUNS * 100;
    // 方向2: B 是 ally (对调)
    let bWins = 0;
    for (let k = 0; k < RUNS; k++) if (runOne(ROSTER[b], ROSTER[a]) === "ally") bWins++;
    const pctBA = bWins / RUNS * 100;

    const sum = pctAB + pctBA; // 理论 100: A赢B的比例 + B赢A的比例
    const dev = Math.abs(sum - 100);
    totalDev += dev;
    worst = Math.max(worst, dev);
    const verdict = dev > 10 ? "🔴 不对称!" : dev > 5 ? "🟡 偏差" : "✅ 对称";
    console.log(
      `${RACE_CN[a].padEnd(4)} vs ${RACE_CN[b].padEnd(4)}: ${pctAB.toFixed(1).padStart(6)}%  ${pctBA.toFixed(1).padStart(6)}%  ${sum.toFixed(1).padStart(6)}%  ${verdict}`
    );
  }
  console.log("-".repeat(72));
  console.log(`平均偏差: ${(totalDev / pairs.length).toFixed(2)}pp | 最大偏差: ${worst.toFixed(1)}pp`);
  console.log(`\n判定标准: 互补和≈100% = 引擎对称 (无ally/enemy偏置)`);
  console.log(`偏差>10pp 说明存在阵营不对称 (类似之前的神谕者bug)`);
}

main();
