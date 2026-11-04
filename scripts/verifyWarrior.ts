// 快速验证战士天赋是否生效 (跑一场兽族 vs 战士, 检查天赋日志)
import { initBattle, processTick } from "../src/engine/battle";

const beastIds = ["pp", "mmx", "lbmx", "hx", "ds", "yl", "dxm", "zzx"];
const warriorIds = ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"];

function makeTeam(ids: string[]): { charId: string; row: number; col: number }[] {
  const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
  return ids.slice(0, 8).map((cid, i) => ({ charId: cid, row: positions[i][0], col: positions[i][1] }));
}

const state = initBattle(makeTeam(beastIds) as any, makeTeam(warriorIds) as any) as any;
let safety = 0;
let lastIdx = 0;
while (state.phase === "fighting" && safety < 5000) {
  processTick(state);
  safety++;
}
console.log("=== 战士天赋日志检查 ===");
for (const e of state.battleLog as any[]) {
  const t = e.text as string;
  if (
    t.includes("天赋") ||
    t.includes("反弹") ||
    t.includes("击杀奖励") ||
    t.includes("狂战") ||
    t.includes("辉刀") ||
    t.includes("风之斗士") ||
    t.includes("圣灵") ||
    t.includes("决斗") ||
    t.includes("未命中")
  ) {
    console.log(`[${e.time}s] ${t}`);
  }
}
console.log("=== 结果 ===");
console.log("winner:", state.winner);
