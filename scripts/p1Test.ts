/** P1 验证 - 关键对局 250 场 */
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
  const RUNS = 250;
  const matchups: [string, string][] = [
    ["warrior", "hunter"],
    ["hunter", "warrior"],
    ["hunter", "undead"],
    ["hunter", "beast"],
    ["hunter", "dragon"],
    ["warrior", "dragon"],
    ["warrior", "mage"],
  ];
  console.log(`P1 验证 (每场 ${RUNS} 局)`);
  console.log("=".repeat(55));
  for (const [a, b] of matchups) {
    let aWins = 0;
    for (let k = 0; k < RUNS; k++)
      if (runOne(ROSTER[a], ROSTER[b]) === "ally") aWins++;
    const pct = ((aWins / RUNS) * 100).toFixed(1);
    console.log(
      `${RACE_CN[a].padEnd(4)} vs ${RACE_CN[b].padEnd(4)}: ${RACE_CN[a]} ${pct}% / ${RACE_CN[b]} ${(100 - (aWins / RUNS) * 100).toFixed(1)}%`
    );
  }
}

main();
