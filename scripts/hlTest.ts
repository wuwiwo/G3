/**
 * 嚎叫巨牛 (hl) 替换测试 - 兽族定位阵容不同变体 vs 全种族
 * 变体: none(原阵容) / zzx / ds / pp / mmx (hl 替换谁)
 * 输出: 各变体胜率对比 + 角色统计
 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const BASE_BEAST = ["pp", "mmx", "lbmx", "hx", "ds", "yl", "dxm", "zzx"];
const VARIANTS: Record<string, string[]> = {
  none: BASE_BEAST,
  zzx: BASE_BEAST.map((x) => (x === "zzx" ? "hl" : x)), // 替换智慧猩(辅助)
  ds: BASE_BEAST.map((x) => (x === "ds" ? "hl" : x)), // 替换洞狮(控制)
  pp: BASE_BEAST.map((x) => (x === "pp" ? "hl" : x)), // 替换彭彭猪(主坦)
  mmx: BASE_BEAST.map((x) => (x === "mmx" ? "hl" : x)), // 替换猛犸象(副坦)
};

const OPPONENTS: Record<string, string[]> = {
  undead: ["swxz", "kldd", "dyq", "mrsz", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "xyfl", "hlyl", "bsxl", "aysl", "lyz", "hbfl"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  hunter: ["ldshz", "mds", "zfyx", "sszs", "xblr", "hqs", "lxgz", "xjlr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
};
const RACE_CN: Record<string, string> = {
  undead: "亡灵",
  dragon: "龙族",
  mage: "法师",
  hunter: "猎人",
  warrior: "战士",
};
const VARIANT_CN: Record<string, string> = {
  none: "原阵容",
  zzx: "hl换智慧猩",
  ds: "hl换洞狮",
  pp: "hl换彭彭猪",
  mmx: "hl换猛犸象",
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

function runDetailed(ally: string[], enemy: string[]) {
  const state = initBattle(
    makeTeam(ally) as any,
    makeTeam(enemy) as any
  ) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  return {
    winner: state.winner || "enemy",
    duration: state.time,
    stats: (state as any).stats || [],
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runs = args.length > 0 ? parseInt(args[0]) || 100 : 100;
  const variants = ["none", "zzx", "ds", "pp", "mmx"];

  console.log(`🟫 嚎叫巨牛替换测试 (每变体 ${runs} 局 × 5对手 + 镜像)`);
  console.log("=".repeat(78));

  // 变体 × 对手 胜率矩阵
  const matrix: Record<
    string,
    Record<string, { pct: number; dur: number; mirror: number }>
  > = {};
  const unitAgg: Record<string, Record<string, number>> = {};
  const unitMeta: Record<string, { name: string; race: string }> = {};

  for (const v of variants) {
    matrix[v] = {};
    const roster = VARIANTS[v];
    // 镜像
    let mw = 0;
    for (let k = 0; k < runs; k++) {
      const d = runDetailed(roster, roster);
      if (d.winner === "ally") mw++;
    }
    matrix[v]["镜像"] = { pct: (mw / runs) * 100, dur: 0, mirror: 1 };
    console.log(
      `🟫 [${VARIANT_CN[v]}] 镜像: 先手 ${((mw / runs) * 100).toFixed(1)}%`
    );

    for (const [opp, ids] of Object.entries(OPPONENTS)) {
      let wins = 0,
        durSum = 0;
      for (let k = 0; k < runs; k++) {
        const d = runDetailed(roster, ids);
        if (d.winner === "ally") wins++;
        durSum += d.duration;
        for (const s of d.stats) {
          const key = s.name;
          if (!unitAgg[key]) unitAgg[key] = { count: 0 };
          const u = unitAgg[key];
          u.count++;
          u.totalDamage = (u.totalDamage || 0) + (s.totalDamageDealt || 0);
          u.healing = (u.healing || 0) + (s.totalHealingDone || 0);
          u.dmgTaken = (u.dmgTaken || 0) + (s.totalDamageReceived || 0);
          u.kills = (u.kills || 0) + (s.kills || 0);
          u.deaths = (u.deaths || 0) + (s.deaths || 0);
          if (!unitMeta[key]) unitMeta[key] = { name: s.name, race: s.race };
        }
      }
      const pct = (wins / runs) * 100;
      const dur = durSum / runs;
      matrix[v][opp] = { pct, dur, mirror: 0 };
      console.log(
        `🟫 [${VARIANT_CN[v]}] vs ${RACE_CN[opp]}: ${pct.toFixed(1)}% / ${dur.toFixed(1)}s`
      );
    }
    console.log("");
  }

  // ===== 报告输出 =====
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const reportDir = path.join(
    __dirname,
    "..",
    "..",
    "docs",
    "data",
    "balance_reports"
  );
  fs.mkdirSync(reportDir, { recursive: true });

  const L: string[] = [];
  L.push(`# 嚎叫巨牛替换测试报告`);
  L.push("");
  L.push(`> 生成时间: ${now.toLocaleString("zh-CN")}`);
  L.push(`> 每变体 ${runs} 局 × 5 对手 + 镜像 | 引擎 v2.0 | 定位阵容`);
  L.push("");
  L.push(`## 变体胜率总览`);
  L.push("");
  L.push(
    `| 变体 | 镜像(先手) | vs亡灵 | vs龙族 | vs法师 | vs猎人 | vs战士 | 综合(非镜像) |`
  );
  L.push(`|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|`);
  for (const v of variants) {
    const m = matrix[v];
    const others = ["undead", "dragon", "mage", "hunter", "warrior"];
    const avg =
      others.reduce((s, o) => s + (m[o]?.pct || 0), 0) / others.length;
    L.push(
      `| ${VARIANT_CN[v]} | ${m["镜像"].pct.toFixed(1)}% | ${(m["undead"]?.pct || 0).toFixed(1)}% | ${(m["dragon"]?.pct || 0).toFixed(1)}% | ${(m["mage"]?.pct || 0).toFixed(1)}% | ${(m["hunter"]?.pct || 0).toFixed(1)}% | ${(m["warrior"]?.pct || 0).toFixed(1)}% | **${avg.toFixed(1)}%** |`
    );
  }
  L.push("");

  L.push(`## 与"原阵容"胜率差 (Δ = 变体 - 原阵容)`);
  L.push("");
  L.push(`| 变体 | vs亡灵 | vs龙族 | vs法师 | vs猎人 | vs战士 | 综合Δ |`);
  L.push(`|------|:---:|:---:|:---:|:---:|:---:|:---:|`);
  const base = matrix["none"];
  for (const v of variants) {
    if (v === "none") continue;
    const m = matrix[v];
    const others = ["undead", "dragon", "mage", "hunter", "warrior"];
    const dAvg =
      others.reduce((s, o) => s + (m[o]?.pct || 0) - (base[o]?.pct || 0), 0) /
      others.length;
    L.push(
      `| ${VARIANT_CN[v]} | ${((m["undead"]?.pct || 0) - (base["undead"]?.pct || 0)).toFixed(1)} | ${((m["dragon"]?.pct || 0) - (base["dragon"]?.pct || 0)).toFixed(1)} | ${((m["mage"]?.pct || 0) - (base["mage"]?.pct || 0)).toFixed(1)} | ${((m["hunter"]?.pct || 0) - (base["hunter"]?.pct || 0)).toFixed(1)} | ${((m["warrior"]?.pct || 0) - (base["warrior"]?.pct || 0)).toFixed(1)} | **${dAvg.toFixed(1)}** |`
    );
  }
  L.push("");

  L.push(`## 嚎叫巨牛表现 (全部变体对局累计)`);
  L.push("");
  L.push(`| 指标 | 数值 |`);
  L.push(`|------|------|`);
  const hlAgg = unitAgg["嚎叫巨牛"];
  if (hlAgg) {
    const cnt = hlAgg.count || 1;
    L.push(`| 出场场次 | ${hlAgg.count} |`);
    L.push(`| 场均输出 | ${Math.round((hlAgg.totalDamage || 0) / cnt)} |`);
    L.push(`| 场均治疗 | ${Math.round((hlAgg.healing || 0) / cnt)} |`);
    L.push(`| 场均承伤 | ${Math.round((hlAgg.dmgTaken || 0) / cnt)} |`);
    L.push(`| 场均击杀 | ${((hlAgg.kills || 0) / cnt).toFixed(2)} |`);
    L.push(`| 场均死亡 | ${((hlAgg.deaths || 0) / cnt).toFixed(2)} |`);
  } else {
    L.push(`| 出场场次 | 0 (未上场?) |`);
  }
  L.push("");

  L.push(`## 结论`);
  L.push("");
  L.push(`- 对比各变体综合胜率, 判断 hl 替换哪个位置收益最大/最小`);
  L.push(`- 若某变体显著优于原阵容 → 定位阵容更新, hl 入列`);
  L.push(`- 若全部劣于原阵容 → hl 天赋或数值偏弱, 需加强`);
  L.push("");

  const filePath = path.join(reportDir, `hl_test_${ts}.md`);
  fs.writeFileSync(filePath, L.join("\n"), "utf-8");
  console.log(`\n📄 报告已保存: ${filePath}`);
}

main();
