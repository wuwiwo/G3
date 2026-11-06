/** R7~R12 功能级验证：护卫/debuff/日志编号/存活口径。 */
import {
  initBattle,
  processTick,
  getAttackableEnemies,
} from "../src/engine/battle";
import { ROSTER } from "../src/lib/roleAnalysis";

function makeTeam(ids: string[]) {
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
    .map((charId, i) => ({
      charId,
      row: positions[i][0],
      col: positions[i][1],
    }));
}

const state: any = initBattle(
  makeTeam(ROSTER.undead) as any,
  makeTeam(ROSTER.dragon) as any
);
let guardSamples = 0;
let guardViolations = 0;
let guardClearedSamples = 0;
let guardClearedOk = 0;
let safety = 0;

while (state.phase === "fighting" && safety++ < 5000) {
  processTick(state);
  const kldd = state.units.find((u: any) => u.def.id === "kldd");
  if (!kldd) continue;
  const guards = state.units.filter(
    (u: any) => u.isSummon && u.summonerId === kldd.id && !u.isDead
  ).length;
  const attackable: any[] = getAttackableEnemies(state, "enemy"); // 龙族视角的可选目标
  if (guards > 0 && !kldd.isDead) {
    guardSamples++;
    if (attackable.some((u: any) => u.id === kldd.id)) guardViolations++;
  } else if (guards === 0 && !kldd.isDead) {
    guardClearedSamples++;
    if (attackable.some((u: any) => u.id === kldd.id)) guardClearedOk++;
  }
}

const log: string = state.battleLog.map((e: any) => e.text).join("\n");
const summonTags = ["骷髅兵#1", "骷髅兵#2", "骷髅兵#3"].filter((t) =>
  log.includes(t)
);
const reviveDebuffLogs = (log.match(/复活后15s内造成伤害-25%/g) || []).length;
const martyrPureAfterDeath = (log.match(/殉道纯粹/g) || []).length;

console.log("=== R7~R12 功能验证（亡灵 vs 龙族 单场） ===");
console.log("时长", state.time.toFixed(1), "胜者", state.winner);
console.log("R11 护卫: 有召唤物时采样", guardSamples, "违规", guardViolations);
console.log(
  "R11 解禁: 召唤物全灭后采样",
  guardClearedSamples,
  "可正常选中",
  guardClearedOk
);
console.log(
  "R10 日志编号:",
  summonTags.join("/") || "无",
  "（共",
  summonTags.length,
  "/3）"
);
console.log("R12 复活 debuff 提示条数:", reviveDebuffLogs);
console.log("R7 殉道者天赋日志(本局应0):", martyrPureAfterDeath);

const stats: any[] = state.stats || [];
const undead = stats.filter(
  (s: any) => s.team === "ally" && s.name !== "骷髅兵"
);
console.log("--- 存活口径（累计在场秒数，应 <= 战斗时长） ---");
for (const s of undead) {
  console.log(
    `  ${s.name}: 存活${(s.survivalTime || 0).toFixed(1)}s 死亡${s.deaths} 输出${Math.round(s.totalDamageDealt)}`
  );
}

const badSurv = undead.filter(
  (s: any) => (s.survivalTime || 0) > state.time + 0.01
);
const ok =
  guardViolations === 0 &&
  summonTags.length === 3 &&
  reviveDebuffLogs > 0 &&
  badSurv.length === 0;
console.log(ok ? "VERIFY_OK" : "VERIFY_FAILED");
if (!ok) process.exitCode = 1;
