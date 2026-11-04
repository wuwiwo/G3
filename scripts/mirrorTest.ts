/** 镜像对局专项测试 - 大样本验证先手问题 */
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
  beast: "兽族",
  hunter: "猎人",
  warrior: "战士",
  mage: "法师",
  undead: "亡灵",
  dragon: "龙族",
};

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

const RUNS = 100;

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
  console.log(`镜像对局测试 (每场 ${RUNS} 局, 100场大样本)`);
  console.log("=".repeat(60));
  for (const race of Object.keys(ROSTER)) {
    let firstWins = 0;
    for (let k = 0; k < RUNS; k++) {
      const w = runOne(ROSTER[race], ROSTER[race]);
      if (w === "ally") firstWins++;
    }
    const pct = ((firstWins / RUNS) * 100).toFixed(1);
    const bar =
      "█".repeat(Math.round((firstWins / RUNS) * 20)) +
      "░".repeat(20 - Math.round((firstWins / RUNS) * 20));
    const verdict =
      pct >= "55" ? "⚠ 先手偏高" : pct <= "45" ? "⚠ 后手偏高" : "✅ 均衡";
    console.log(
      `${RACE_CN[race].padEnd(4)} 先手 ${pct.padStart(6)}%  ${bar}  ${verdict}`
    );
  }
}

main();
