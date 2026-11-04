// 亡灵 vs 圣职者 单局日志（站位 = batchBalance ROSTER）
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const undead = ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"]; // v3.16g: 地狱之犬→中排
const holy = ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"];

const positions = [
  [0, 0], [0, 1], [0, 2],
  [1, 0], [1, 1], [1, 2],
  [2, 0], [2, 1],
];
const makeTeam = (ids: string[]) =>
  ids.slice(0, 8).map((charId, i) => ({ charId, row: positions[i][0], col: positions[i][1] }));

// 打印站位表
const RACE_CN: Record<string, string> = { undead: "亡灵", holy: "圣职者" };
for (const [name, roster] of [["undead", undead], ["holy", holy]] as const) {
  console.log(`\n【${RACE_CN[name]}】站位（ROSTER 顺序 = 站位顺序）:`);
  const rows: string[][] = [[], [], []];
  roster.slice(0, 8).forEach((cid, i) => {
    rows[positions[i][0]].push(cid);
  });
  console.log("  前排:", rows[0].join(" / "));
  console.log("  中排:", rows[1].join(" / "));
  console.log("  后排:", rows[2].join(" / "));
}

// 跑一局
const state = initBattle(makeTeam(undead) as any, makeTeam(holy) as any) as unknown as BattleState;
let safety = 0;
while (state.phase === "fighting" && safety < 5000) {
  processTick(state as any);
  safety++;
}
const winner = state.winner || "?";
console.log(`\n===== 对局结果: ${winner === "ally" ? "亡灵胜" : "圣职者胜"} (时长 ${state.time.toFixed(1)}s, ${safety} ticks) =====`);
console.log("===== 完整战斗日志（前 120 条）=====");
const log = (state as any).battleLog || [];
log.slice(0, 120).forEach((e: any) => {
  console.log(`${e.time.toFixed(1)}s ${e.text}`);
});
if (log.length > 120) console.log(`... 共 ${log.length} 条，已截断`);
console.log("\n===== 终局统计 =====");
for (const s of (state as any).stats || []) {
  console.log(`${s.team === "ally" ? "🟦" : "🟥"} ${s.name}: 伤害${s.totalDamageDealt} 治疗${s.totalHealingDone} 击杀${s.kills} 死亡${s.deaths ? 1 : 0}`);
}
