/**
 * v3.3 机制实装验证：跑一场指定对阵，打印关键机制日志与单位存活统计。
 * 运行: npx esbuild scripts/v33_verify.ts --bundle --platform=node --format=cjs --outfile=scripts/v33_verify.cjs && node scripts/v33_verify.cjs [allyRace] [enemyRace]
 */
import { initBattle, processTick } from "../src/engine/battle";

const ROSTER: Record<string, string[]> = {
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"],
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"],
};

const a = process.argv[2] || "undead";
const b = process.argv[3] || "holy";
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
const team = (ids: string[]) =>
  ids
    .slice(0, 8)
    .map((charId, i) => ({
      charId,
      row: positions[i][0],
      col: positions[i][1],
    }));

const state: any = initBattle(team(ROSTER[a]) as any, team(ROSTER[b]) as any);
let guard = 0;
while (state.phase === "fighting" && guard < 3000) {
  processTick(state);
  guard++;
}

const keys = [
  "骷髅",
  "冥火",
  "复活",
  "狂热",
  "护盾",
  "圣之",
  "审判",
  "冰冻",
  "激怒",
  "催眠",
  "灵魂",
  "牺牲",
];
console.log(
  `=== ${a} vs ${b}: ${state.winner} @ ${state.time.toFixed(1)}s (${guard} ticks) ===`
);
console.log(
  `单位数 ${state.units.length}，其中骷髅兵 ${state.units.filter((u: any) => u.def.id === "klb").length}`
);
for (const l of state.battleLog) {
  if (keys.some((k) => l.text.includes(k)))
    console.log(`  [${l.time.toFixed(1)}s] ${l.text}`);
}
const klbUnits = state.units.filter((u: any) => u.def.id === "klb");
for (const u of klbUnits) {
  const s = (state.stats || []).find((x: any) => x.unitId === u.id);
  console.log(
    `  ${u.id}: HP ${u.currentHp}/${u.maxHp} 输出 ${s?.totalDamageDealt ?? 0} 存活 ${s?.survivalTime ?? "-"}`
  );
}
