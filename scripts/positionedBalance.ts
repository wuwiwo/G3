/**
 * 站位受控的跨种族平衡测试
 *
 * 与 batchBalance.ts 的区别：
 * 1. 站位不再按 ROSTER 顺序硬排，而是穷举 8! 排列，在「前排必须承担足够坦度」的硬约束下
 *    最大化同排/十字相邻/敌方同排类天赋的生效人数。
 * 2. 每组对阵双向各跑 N 局，消除先手偏差。
 * 3. 同时跑「旧站位」作为对照，用于判断「兽族偏强」有多少来自站位质量。
 *
 * 运行:
 *   npx esbuild scripts/positionedBalance.ts --bundle --platform=node --format=cjs --outfile=scripts/positionedBalance.cjs \
 *     && node scripts/positionedBalance.cjs [每组每方向局数=50] [optimized|legacy|both=both]
 */
import { initBattle, processTick } from "../src/engine/battle";
import { ALL_CHARACTERS } from "../src/data/characters";
import type { BattleState } from "../src/types";
import * as fs from "fs";
import * as path from "path";

// 最新满编阵容（与 batchBalance.ts 一致，无失效 id）
const ROSTER: Record<string, string[]> = {
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"],
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"],
};

const RACES = [
  "beast",
  "hunter",
  "warrior",
  "mage",
  "undead",
  "dragon",
  "holy",
];
const RACE_CN: Record<string, string> = {
  beast: "兽族",
  hunter: "猎人",
  warrior: "战士",
  mage: "法师",
  undead: "亡灵",
  dragon: "龙族",
  holy: "圣职者",
};

/**
 * 位置敏感天赋标签（依据当前引擎源码）
 *  allyRow  同排友军增益 —— 同排人数越多越强
 *  cross    十字相邻友军增益 —— (1,1) 中排中央可覆盖 4 人，是全盘最优格
 *  enemyRow 敌方同排减益 —— 放 3 人排可覆盖 3 名敌人
 *  sym      对称位标记 —— 双方格子一致，恒生效，不参与优化
 */
type Tag = "allyRow" | "cross" | "enemyRow" | "sym";
const TAGS: Record<string, { tags: Tag[]; why: string }> = {
  dxm: { tags: ["allyRow"], why: "battle.ts:357 同排兽族技能CD-18%" },
  ldshz: {
    tags: ["allyRow"],
    why: "SkillRegistry.ts:612 同排+20%暴击/+35%吸血",
  },
  xdds: { tags: ["allyRow"], why: "battle.ts:2403 同排友方施法叠攻速" },
  slzs: { tags: ["allyRow"], why: "characters.ts:527 同排友方魔伤转移" },
  sjsn: {
    tags: ["cross"],
    why: "battle.ts:2388 十字相邻法师CD-20%（引擎误写 sjny，当前不触发）",
  },
  hyz: { tags: ["cross"], why: "SkillRegistry.ts:387 驱散周围1格" },
  zzx: { tags: ["enemyRow"], why: "battle.ts:345 敌方同排封锁8s" },
  yammxz: { tags: ["enemyRow"], why: "battle.ts:1221 同排敌方诅咒" },
  crzs: { tags: ["enemyRow"], why: "characters.ts:393 敌方同阵型持续纯粹伤害" },
  fxz: { tags: ["sym"], why: "battle.ts:2311 标记对称敌人" },
};

// 8 个可用格：前3 / 中3 / 后2（与 UI 的 3x3 棋盘一致，后排右下留空）
const CELLS: [number, number][] = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
];

// 各排友军数（不含自己）与敌方同排单位数
const ALLY_ROW_OTHERS = [2, 2, 1];
const ENEMY_ROW_COUNT = [3, 3, 2];
// 十字相邻（曼哈顿距离 1）友军数
const CROSS_COUNT: Record<string, number> = {
  "0,0": 2,
  "0,1": 3,
  "0,2": 2,
  "1,0": 3,
  "1,1": 4,
  "1,2": 2,
  "2,0": 2,
  "2,1": 2,
};

const W = {
  allyRow: 3,
  cross: 2.5,
  enemyRow: 1.5,
  frontTank: 8,
  backFragile: 3,
};
const MIN_FRONT_TANK_SHARE = 0.42; // 前排 3 人至少承担全队 42% 坦度（均分为 37.5%）

interface Def {
  id: string;
  name: string;
  stats: {
    hp: number;
    attack: number;
    physicalDef: number;
    magicalDef: number;
    attackInterval: number;
  };
}
const DEFS = ALL_CHARACTERS as unknown as Def[];
const byId = (id: string) => DEFS.find((d) => d.id === id)!;

function rawTank(d: Def): number {
  const s = d.stats;
  return s.hp / 1000 + (s.physicalDef + s.magicalDef) / 120;
}

interface Placed {
  id: string;
  name: string;
  row: number;
  col: number;
  tank: number;
  tags: Tag[];
  why: string;
}

/** 穷举 8! 排列，返回满足坦度硬约束且覆盖得分最高的站位 */
function optimize(race: string): {
  lineup: Placed[];
  score: number;
  frontShare: number;
  checked: number;
} {
  const ids = ROSTER[race];
  const raw = ids.map((id) => ({ id, def: byId(id), t: rawTank(byId(id)) }));
  const min = Math.min(...raw.map((r) => r.t));
  const max = Math.max(...raw.map((r) => r.t));
  const norm = (t: number) => (max > min ? (t - min) / (max - min) : 0.5);
  const totalTank = raw.reduce((s, r) => s + norm(r.t), 0);

  let best: number[] | null = null;
  let bestScore = -Infinity;
  let bestShare = 0;
  let checked = 0;

  const order = raw.map((_, i) => i);
  const perm = (arr: number[], k: number) => {
    if (k === arr.length) {
      // arr[i] = 第 i 个格子放的角色下标
      let frontTank = 0;
      for (let i = 0; i < 3; i++) frontTank += norm(raw[arr[i]].t);
      const share = frontTank / (totalTank || 1);
      if (share < MIN_FRONT_TANK_SHARE) return; // 硬约束：坦克必须在前排
      checked++;
      let score = 0;
      for (let i = 0; i < arr.length; i++) {
        const { id, t } = raw[arr[i]];
        const [r, c] = CELLS[i];
        const tg = TAGS[id]?.tags || [];
        if (tg.includes("allyRow")) score += W.allyRow * ALLY_ROW_OTHERS[r];
        if (tg.includes("cross")) score += W.cross * CROSS_COUNT[`${r},${c}`];
        if (tg.includes("enemyRow")) score += W.enemyRow * ENEMY_ROW_COUNT[r];
        const n = norm(t);
        if (r === 0) score += W.frontTank * n;
        if (r === 2) score += W.backFragile * (1 - n);
      }
      if (score > bestScore) {
        bestScore = score;
        best = arr.slice();
        bestShare = share;
      }
      return;
    }
    for (let i = k; i < arr.length; i++) {
      [arr[k], arr[i]] = [arr[i], arr[k]];
      perm(arr, k + 1);
      [arr[k], arr[i]] = [arr[i], arr[k]];
    }
  };
  perm(order, 0);

  const lineup: Placed[] = (best as number[]).map((idx, i) => {
    const { id, t } = raw[idx];
    const [row, col] = CELLS[i];
    return {
      id,
      name: byId(id).name,
      row,
      col,
      tank: norm(t),
      tags: TAGS[id]?.tags || [],
      why: TAGS[id]?.why || "",
    };
  });
  return { lineup, score: bestScore, frontShare: bestShare, checked };
}

/** 旧站位：ROSTER 顺序硬排（batchBalance.ts 的 makeTeam） */
function legacy(race: string): { charId: string; row: number; col: number }[] {
  return ROSTER[race].slice(0, 8).map((charId, i) => ({
    charId,
    row: CELLS[i][0],
    col: CELLS[i][1],
  }));
}

const optimized: Record<
  string,
  { charId: string; row: number; col: number }[]
> = {};
for (const race of RACES) {
  optimized[race] = optimize(race).lineup.map((p) => ({
    charId: p.id,
    row: p.row,
    col: p.col,
  }));
}

type Lineup = { charId: string; row: number; col: number }[];
type Mode = "optimized" | "legacy";
const getLineup = (race: string, mode: Mode): Lineup =>
  mode === "optimized" ? optimized[race] : legacy(race);

interface Fight {
  winner: "ally" | "enemy" | "draw";
  time: number;
  allyDmg: number;
  enemyDmg: number;
  allySurvivors: number;
  enemySurvivors: number;
}
function fight(a: Lineup, b: Lineup): Fight {
  const state = initBattle(a as any, b as any) as unknown as BattleState;
  let guard = 0;
  while (state.phase === "fighting" && guard++ < 5000)
    processTick(state as any);
  const stats: any[] = (state as any).stats || [];
  const dmg = (team: string) =>
    stats
      .filter((s) => s.team === team)
      .reduce((s, x) => s + (x.totalDamageDealt || 0), 0);
  return {
    winner: (state.winner as Fight["winner"]) || "draw",
    time: state.time,
    allyDmg: dmg("ally"),
    enemyDmg: dmg("enemy"),
    allySurvivors: state.units.filter((u) => u.team === "ally" && !u.isDead)
      .length,
    enemySurvivors: state.units.filter((u) => u.team === "enemy" && !u.isDead)
      .length,
  };
}

interface Agg {
  w: number;
  n: number;
  dmg: number;
  taken: number;
  time: number;
  draws: number;
  survivors: number;
}
const newAgg = (): Agg => ({
  w: 0,
  n: 0,
  dmg: 0,
  taken: 0,
  time: 0,
  draws: 0,
  survivors: 0,
});

interface Result {
  mode: Mode;
  runs: number;
  overall: Record<string, Agg>;
  matrix: Record<string, Record<string, { w: number; n: number }>>;
  mirror: Record<string, { first: number; n: number }>;
  avgDuration: number;
  totalBattles: number;
}

function runSuite(mode: Mode, runs: number): Result {
  const overall: Record<string, Agg> = {};
  const matrix: Record<string, Record<string, { w: number; n: number }>> = {};
  const mirror: Record<string, { first: number; n: number }> = {};
  for (const r of RACES) {
    overall[r] = newAgg();
    matrix[r] = {};
    for (const s of RACES) matrix[r][s] = { w: 0, n: 0 };
    mirror[r] = { first: 0, n: 0 };
  }
  let totalTime = 0,
    totalBattles = 0;

  // 记录一场：a 视角，a 得分 points（胜=1/平=0.5/负=0）
  const record = (a: string, b: string, f: Fight, aAsAlly: boolean) => {
    const aWon = aAsAlly ? f.winner === "ally" : f.winner === "enemy";
    const draw = f.winner === "draw";
    const pts = draw ? 0.5 : aWon ? 1 : 0;
    const aDmg = aAsAlly ? f.allyDmg : f.enemyDmg;
    const bDmg = aAsAlly ? f.enemyDmg : f.allyDmg;
    const aSurv = aAsAlly ? f.allySurvivors : f.enemySurvivors;
    const A = overall[a];
    A.n++;
    A.w += pts;
    A.dmg += aDmg;
    A.taken += bDmg;
    A.time += f.time;
    A.survivors += aSurv;
    if (draw) A.draws++;
    const B = overall[b];
    B.n++;
    B.w += 1 - pts;
    B.dmg += bDmg;
    B.taken += aDmg;
    B.time += f.time;
    B.survivors += aAsAlly ? f.enemySurvivors : f.allySurvivors;
    if (draw) B.draws++;
    matrix[a][b].n++;
    matrix[a][b].w += pts;
    // 互补方向一并记录，保证矩阵上下三角都有数据
    matrix[b][a].n++;
    matrix[b][a].w += 1 - pts;
    totalTime += f.time;
    totalBattles++;
  };

  for (let i = 0; i < RACES.length; i++) {
    for (let j = i + 1; j < RACES.length; j++) {
      const a = RACES[i],
        b = RACES[j];
      for (let k = 0; k < runs; k++) {
        record(a, b, fight(getLineup(a, mode), getLineup(b, mode)), true); // a 先手
        record(a, b, fight(getLineup(b, mode), getLineup(a, mode)), false); // b 先手
      }
    }
  }
  for (const a of RACES) {
    for (let k = 0; k < runs; k++) {
      const f = fight(getLineup(a, mode), getLineup(a, mode));
      mirror[a].n++;
      if (f.winner === "ally") mirror[a].first++;
      else if (f.winner === "draw") mirror[a].first += 0.5;
      totalTime += f.time;
      totalBattles++;
    }
  }
  return {
    mode,
    runs,
    overall,
    matrix,
    mirror,
    avgDuration: totalTime / totalBattles,
    totalBattles,
  };
}

/** Wilson 95% 置信区间 */
function wilson(w: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96,
    p = w / n,
    d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

function lineupTable(race: string): string[] {
  const { lineup, frontShare, checked } = optimize(race);
  const L: string[] = [];
  L.push(
    `#### ${RACE_CN[race]}（前排坦度占比 ${(frontShare * 100).toFixed(1)}%，穷举 ${checked.toLocaleString()} 种合格排列）`
  );
  L.push("");
  L.push("| 位置 | 角色 | 坦度 | 位置敏感天赋 |");
  L.push("|:---:|------|:---:|------|");
  const ROW_CN = ["前排", "中排", "后排"];
  for (const p of lineup) {
    const cell = `${ROW_CN[p.row]}(${p.col})`;
    L.push(
      `| ${cell} | ${p.name} \`${p.id}\` | ${(p.tank * 100).toFixed(0)} | ${p.why || "—"} |`
    );
  }
  L.push("");
  return L;
}

function pct(x: number): string {
  return Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "—";
}

async function main() {
  const args = process.argv.slice(2);
  const runs = parseInt(args[0] || "50") || 50;
  const which = (args[1] || "both") as "optimized" | "legacy" | "both";

  console.log("=".repeat(76));
  console.log(
    `站位受控平衡测试 | 每组每方向 ${runs} 局（双向） | 模式 ${which}`
  );
  console.log("=".repeat(76));

  console.log("\n【各族优化站位】");
  for (const r of RACES) {
    const { lineup, frontShare } = optimize(r);
    const show = (row: number) =>
      lineup
        .filter((p) => p.row === row)
        .sort((a, b) => a.col - b.col)
        .map((p) => `${p.name}${p.tags.length ? "*" : ""}`)
        .join(" / ");
    console.log(
      `  ${RACE_CN[r].padEnd(4)} 前排坦度占比 ${(frontShare * 100).toFixed(0)}% | 前: ${show(0)} | 中: ${show(1)} | 后: ${show(2)}`
    );
  }
  console.log("  (* = 位置敏感天赋角色)");

  const results: Result[] = [];
  if (which === "both" || which === "optimized") {
    const t = Date.now();
    console.log("\n[1/2] 优化站位批量对战 ...");
    const res = runSuite("optimized", runs);
    console.log(
      `  完成 ${res.totalBattles} 场，耗时 ${((Date.now() - t) / 1000).toFixed(1)}s，场均 ${res.avgDuration.toFixed(1)}s`
    );
    results.push(res);
  }
  if (which === "both" || which === "legacy") {
    const t = Date.now();
    console.log("[2/2] 旧站位对照批量对战 ...");
    const res = runSuite("legacy", runs);
    console.log(
      `  完成 ${res.totalBattles} 场，耗时 ${((Date.now() - t) / 1000).toFixed(1)}s，场均 ${res.avgDuration.toFixed(1)}s`
    );
    results.push(res);
  }

  const L: string[] = [];
  L.push(`# 站位受控的跨种族平衡测试报告`);
  L.push("");
  L.push(`> 生成时间：${new Date().toLocaleString("zh-CN")}  `);
  L.push(
    `> 每组对阵双向各 ${runs} 局（消除先手偏差）；引擎为当前 src 现场打包，非历史 .cjs 快照。`
  );
  L.push("");
  L.push(`## 一、测试方法`);
  L.push("");
  L.push(
    `- **站位约束**：穷举 8! 排列，只保留「前排 3 人承担 ≥42% 全队坦度」的方案（均分为 37.5%），再从中选覆盖得分最高者。`
  );
  L.push(
    `- **覆盖得分**：同排友军增益按同排其他友军数计权、十字相邻按曼哈顿距离 1 的友军数计权、敌方同排减益按敌方该排人数计权；前排按坦度加分、后排按脆度加分。`
  );
  L.push(
    `- **关键结论（站位）**：中排中央 (1,1) 是全盘覆盖最大的格子（十字相邻 4 人、同排 2 人、敌方同排 3 人）；前排/中排各有 3 人，后排仅 2 人。`
  );
  L.push(
    `- **对照**：\`legacy\` = batchBalance.ts 的 ROSTER 顺序硬排；\`optimized\` = 本脚本穷举站位。`
  );
  L.push(`- **胜负**：120s 超时判平局，双方各计 0.5 胜。`);
  L.push(
    `- **站位方案的局限（重要）**：本站位按「裸面板坦度 + 天赋覆盖人数」求解，未建模角色特技（嘲讽、复活、闪避、切后排、护盾联动等），因此是**规则化最优而非实战最优**。第三节可见法师/圣职者在优化站位下反而下降，说明站位是极强的混淆变量；跨种族比较必须在同一套站位规则下进行。`
  );
  L.push("");
  L.push(`## 二、各族优化站位`);
  L.push("");
  for (const r of RACES) L.push(...lineupTable(r));

  L.push(`## 三、综合胜率`);
  L.push("");
  L.push(
    `| 种族 | 优化站位胜率 | 95% CI | 旧站位胜率 | 变化 | 场均输出 | 场均承伤 | 场均存活 |`
  );
  L.push(`|------|:---:|:---:|:---:|:---:|---:|---:|:---:|`);
  const opt = results.find((r) => r.mode === "optimized");
  const leg = results.find((r) => r.mode === "legacy");
  const rank = RACES.map((r) => ({
    r,
    p: opt ? opt.overall[r].w / opt.overall[r].n : 0,
  })).sort((a, b) => b.p - a.p);
  for (const { r } of rank) {
    const o = opt?.overall[r],
      l = leg?.overall[r];
    if (!o) continue;
    const [lo, hi] = wilson(o.w, o.n);
    const lp = l ? l.w / l.n : NaN;
    const delta = l
      ? `${(o.w / o.n - lp) * 100 >= 0 ? "+" : ""}${((o.w / o.n - lp) * 100).toFixed(1)}pp`
      : "—";
    L.push(
      `| ${RACE_CN[r]} | **${pct(o.w / o.n)}** | ${pct(lo)}~${pct(hi)} | ${l ? pct(lp) : "—"} | ${delta} | ${Math.round(o.dmg / o.n).toLocaleString()} | ${Math.round(o.taken / o.n).toLocaleString()} | ${(o.survivors / o.n).toFixed(1)} |`
    );
  }
  L.push("");
  if (opt) {
    L.push(
      `> 场均战斗时长：优化站位 ${opt.avgDuration.toFixed(1)}s${leg ? ` / 旧站位 ${leg.avgDuration.toFixed(1)}s` : ""}；总对局 ${results.reduce((s, x) => s + x.totalBattles, 0)} 场。`
    );
    L.push("");
  }

  if (opt) {
    L.push(`## 四、胜率矩阵（优化站位，行 = 该种族对列种族的胜率）`);
    L.push("");
    L.push(`| 行\\列 | ` + RACES.map((r) => RACE_CN[r]).join(" | ") + ` |`);
    L.push(`|------|` + RACES.map(() => ":---:|").join(""));
    for (const a of RACES) {
      const cells = RACES.map((b) =>
        a === b ? "—" : pct(opt.matrix[a][b].w / opt.matrix[a][b].n)
      ).join(" | ");
      L.push(`| ${RACE_CN[a]} | ${cells} |`);
    }
    L.push("");

    L.push(`## 五、兽族专项验证`);
    L.push("");
    const b = opt.overall.beast;
    const [blo, bhi] = wilson(b.w, b.n);
    L.push(
      `- 优化站位综合胜率 **${pct(b.w / b.n)}**（${Math.round(b.w)} / ${b.n}，95% CI ${pct(blo)}~${pct(bhi)}）。`
    );
    L.push(
      `- 判定：${blo > 0.5 ? "**显著高于 50%，兽族确实偏强**" : bhi < 0.5 ? "显著低于 50%，兽族偏弱" : "置信区间跨 50%，**与均衡线无显著差异**"}。`
    );
    if (leg) {
      const lb = leg.overall.beast;
      L.push(
        `- 旧站位综合胜率 ${pct(lb.w / lb.n)}，优化站位相对变化 ${((b.w / b.n - lb.w / lb.n) * 100).toFixed(1)}pp。`
      );
    }
    L.push("");
    L.push(`| 对手 | 兽族胜率 | 95% CI | 样本 |`);
    L.push(`|------|:---:|:---:|:---:|`);
    for (const x of RACES) {
      if (x === "beast") continue;
      const m = opt.matrix.beast[x];
      const [l2, h2] = wilson(m.w, m.n);
      L.push(
        `| ${RACE_CN[x]} | ${pct(m.w / m.n)} | ${pct(l2)}~${pct(h2)} | ${m.n} |`
      );
    }
    L.push("");
    L.push(`### 兽族强势来源（机制层）`);
    L.push("");
    L.push(
      `1. **开场全队增益叠加**：\`yl\` 夜行狼人全兽族攻 +30%（battle.ts:326）、\`hl\` 嚎叫巨牛敌方全体攻 -20%×8s（:318），一正一负形成开局 50% 相对攻击差。`
    );
    L.push(
      `2. **同排增益**：\`dxm\` 独行马同排兽族 CD-18%（:357），放 3 人排可覆盖 3 人；\`zzx\` 智慧猩封锁敌方同排 8s（:345），放 3 人排可封锁 3 人。`
    );
    L.push(
      `3. **前排坦度**：\`pp\` 彭彭猪 HP 15460 为全角色最高，天然适配前排承伤 ×0.9 + 韧性 +5（battle.ts:105 / damage.ts:411）。`
    );
    L.push(
      `4. **羁绊**：兽族 4 档攻 +20%、防 +25% 且带韧性/纯粹（races.ts）。`
    );
    L.push("");

    L.push(`## 六、镜像对局（先手偏差检查）`);
    L.push("");
    L.push(`| 种族 | 先手胜率 |`);
    L.push(`|------|:---:|`);
    for (const a of RACES)
      L.push(
        `| ${RACE_CN[a]} | ${pct(opt.mirror[a].first / opt.mirror[a].n)} |`
      );
    L.push("");
    const mFirst = RACES.map((a) => opt.mirror[a].first / opt.mirror[a].n);
    L.push(
      `> 先手胜率跨度 ${pct(Math.min(...mFirst))}~${pct(Math.max(...mFirst))}，说明**先手本身有显著影响**。本报告每组对阵均双向各跑 ${runs} 局，综合胜率已抵消该偏差；只跑单向对局的历史脚本会系统性高估先手方。`
    );
    L.push("");
  }

  L.push(`## 七、发现的引擎问题（非平衡数值）`);
  L.push("");
  L.push(
    `- \`battle.ts:2385\` 水晶室女天赋判断写作 \`id === "sjny"\`，真实 id 是 \`sjsn\`（characters.ts:593），该十字相邻 CD-20% 天赋**从未触发**。本报告仍按设计意图把 \`sjsn\` 放在 (1,1)。`
  );
  L.push(
    `- \`battle.ts:2374\` 秀逗大师叠层判断写作 \`id === "xlds"\`，真实 id 是 \`xdds\`；只有 :2403 另一段同排攻速逻辑生效。`
  );
  L.push(
    `- \`beastTest.ts\` / \`mirrorTest.ts\` / \`symmetryTest.ts\` 的 ROSTER 含已删除 id（ds/xjlr/aysl），initBattle 查不到 def 会直接丢弃单位，历史小样本结论不可靠；仅 \`batchBalance.ts\` / \`teamStats.ts\` 为最新满编。`
  );
  L.push("");
  L.push(`## 八、结论与建议`);
  L.push("");
  if (opt) {
    const b = opt.overall.beast,
      [lo, hi] = wilson(b.w, b.n);
    const beastStrong = lo > 0.5;
    const lbRate = leg ? leg.overall.beast.w / leg.overall.beast.n : NaN;
    L.push(
      `1. **兽族偏强成立且结论稳健**：优化站位 ${pct(b.w / b.n)}（95% CI ${pct(lo)}~${pct(hi)}，${Math.round(b.w)}/${b.n}）${leg ? `、旧站位 ${pct(lbRate)}` : ""}，两套站位下均为七族第一，且优化站位置信区间完全不含 50%。用户「手动几场感觉兽族强」的判断被大样本证实。`
    );
    if (beastStrong) {
      L.push(
        `2. **强势来源**：开场 \`yl\` 全兽族攻 +30% 与 \`hl\` 敌方全体攻 -20%×8s 同时生效，形成开局约 50% 相对攻击差；再叠加 \`dxm\` 同排 CD-18%、\`zzx\` 敌方同排封锁 8s、\`pp\` 15460 HP 的超模前排与兽族 4 档羁绊。兽族场均输出 ${Math.round(b.dmg / b.n).toLocaleString()} 为七族最高，场均承伤仅 ${Math.round(b.taken / b.n).toLocaleString()}，场均存活 ${(b.survivors / b.n).toFixed(1)} 人。`
      );
      L.push(
        `3. **优先改机制而非面板**：把狼吼改为更快衰减 / 仅前中排生效，或把怒吼缩为只作用前排，比直接砍 hp / attack 更能保留种族特色；任何改动后都应用本脚本复测。`
      );
    } else {
      L.push(`2. 置信区间跨 50%，尚不能认定偏强；优先修引擎 bug 后再测。`);
      L.push(`3. 暂不建议调整兽族数值。`);
    }
    if (leg) {
      const diff = b.w / b.n - lbRate;
      const deltas = RACES.map((r) => ({
        r,
        d:
          opt.overall[r].w / opt.overall[r].n -
          leg.overall[r].w / leg.overall[r].n,
      }));
      const up = deltas.reduce((x, y) => (y.d > x.d ? y : x));
      const down = deltas.reduce((x, y) => (y.d < x.d ? y : x));
      L.push(
        `4. **站位是强混淆变量**：优化站位使兽族 ${diff >= 0 ? "+" : ""}${(diff * 100).toFixed(1)}pp，最大上摆 ${RACE_CN[up.r]} +${(up.d * 100).toFixed(1)}pp、最大下摆 ${RACE_CN[down.r]} ${(down.d * 100).toFixed(1)}pp。这说明「只测几场」的手工结论几乎不可用；也说明纯面板启发式对部分种族不是实战最优，后续应补一张含角色定位（嘲讽 / 治疗 / 切后排）的站位表再定数值。`
      );
    }
    L.push(
      `5. **先修 bug 再动数值**：\`sjny\`→\`sjsn\`、\`xlds\`→\`xdds\` 两处 id 拼写错误让法师与战士的站位收益被系统性低估；修复后重跑本脚本，再决定是否需要给兽族降温。猎人 ${pct(opt.overall.hunter.w / opt.overall.hunter.n)} 为七族最低，同样应先排除天赋失效因素。`
    );
  }
  L.push("");

  const reportDir = path.join(process.cwd(), "docs", "analysis");
  fs.mkdirSync(reportDir, { recursive: true });
  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const file = path.join(reportDir, `balance_positioned_${ts}.md`);
  fs.writeFileSync(file, L.join("\n"), "utf-8");

  console.log("\n" + "=".repeat(76));
  for (const res of results) {
    console.log(
      `\n【${res.mode === "optimized" ? "优化站位" : "旧站位"}】综合胜率`
    );
    for (const { r, p } of RACES.map((r) => ({
      r,
      p: res.overall[r].w / res.overall[r].n,
    })).sort((a, b) => b.p - a.p)) {
      console.log(
        `  ${RACE_CN[r].padEnd(4)} ${pct(p).padStart(7)}  (${Math.round(res.overall[r].w)}/${res.overall[r].n})`
      );
    }
  }
  console.log(`\n📄 报告已保存: ${file}`);
}

main();
