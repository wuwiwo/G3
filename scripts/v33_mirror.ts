/**
 * v3.3 引擎对称性专项：每族跑 N 局镜像对局，输出先手胜率与 Wilson 95% CI。
 * 用法: npx esbuild scripts/v33_mirror.ts --bundle --platform=node --format=cjs --outfile=scripts/v33_mirror.cjs && node scripts/v33_mirror.cjs [场次]
 * 判据(SKILL.md 二): 先手 45-55% 为对称；300 局波动约 ±3%。
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
const CN: Record<string, string> = {
  beast: "兽族",
  hunter: "猎人",
  warrior: "战士",
  mage: "法师",
  undead: "亡灵",
  dragon: "龙族",
  holy: "圣职者",
};
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
const makeTeam = (ids: string[]) =>
  ids
    .slice(0, 8)
    .map((charId, i) => ({
      charId,
      row: positions[i][0],
      col: positions[i][1],
    }));

const runs = parseInt(process.argv[2] || "300", 10) || 300;
console.log(`=== 镜像对称性专项：每族 ${runs} 局 ===`);
const z = 1.96;
for (const [race, ids] of Object.entries(ROSTER)) {
  let first = 0;
  for (let k = 0; k < runs; k++) {
    const s: any = initBattle(makeTeam(ids) as any, makeTeam(ids) as any);
    let guard = 0;
    while (s.phase === "fighting" && guard < 3000) {
      processTick(s);
      guard++;
    }
    if (s.winner === "ally") first += 1;
    else if (s.winner === "draw") first += 0.5;
  }
  const p = first / runs;
  const denom = 1 + (z * z) / runs;
  const center = (p + (z * z) / (2 * runs)) / denom;
  const half =
    (z * Math.sqrt((p * (1 - p)) / runs + (z * z) / (4 * runs * runs))) / denom;
  const lo = ((center - half) * 100).toFixed(1);
  const hi = ((center + half) * 100).toFixed(1);
  const pct = (p * 100).toFixed(1);
  const flag = Math.abs(p - 0.5) > 0.05 ? "  ⚠ 超出 45-55%" : "  ✅";
  console.log(
    `${CN[race].padEnd(4)} 先手 ${pct}%  Wilson95% [${lo}%, ${hi}%]${flag}`
  );
}
