/**
 * v2.0 批量平衡测试 - 21 组对阵 × N 场，输出完整胜率矩阵
 * 运行: npx esbuild scripts/batchBalance.ts --bundle --platform=node --format=cjs --outfile=scripts/batchBalance.cjs && node scripts/batchBalance.cjs
 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

// 每族 8 人满编阵容 - 按定位排列: [前排3, 中排3, 后排2]
// 前排=坦克/高HP, 中排=输出, 后排=治疗/辅助/脆皮
const ROSTER: Record<string, string[]> = {
  // v3.0: 删洞狮(ds)→补彭彭猪(pp); 删陷阱猎人(xjlr)→补冰霜猎人(bslr); 删暗影噬龙(aysl)→补星辰龙(xcl)
  // v3.10: 彭彭猪(15460最肉)前排, 嚎叫巨牛中排
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"], // v3.8: 追风中排(脆皮输出)
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"], // v3.16g: 地狱之犬→中排(输出核)
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"], // v3.0: 暗影→星辰
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"], // v3.8: 3坦克前排(圣骑士/圣裁者/殉道者)
};

const RACE_CN: Record<string, string> = {
  beast: "兽族",
  hunter: "猎人",
  warrior: "战士",
  mage: "法师",
  undead: "亡灵",
  dragon: "龙族",
  holy: "圣职者",
};

const RACES = [
  "beast",
  "undead",
  "dragon",
  "mage",
  "hunter",
  "warrior",
  "holy",
];

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
  return ids.slice(0, 8).map((cid, i) => ({
    charId: cid,
    row: positions[i][0],
    col: positions[i][1],
  }));
}

const RUNS = 30;

function runOne(ally: string[], enemy: string[]): "ally" | "enemy" | "draw" {
  const state = initBattle(
    makeTeam(ally) as any,
    makeTeam(enemy) as any
  ) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  return state.winner || "draw";
}

/** 带统计的完整对局: 返回胜者+单位统计+技能统计+时长 */
function runOneDetailed(ally: string[], enemy: string[]) {
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
    winner: state.winner || "draw",
    duration: state.time,
    stats: (state as any).stats || [],
    skillStats: (state as any).skillStats || {},
    talentStats: (state as any).talentStats || {},
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runs = args.length > 0 ? parseInt(args[0]) || RUNS : RUNS;

  console.log("=".repeat(78));
  console.log(`G3 批量平衡测试 · GDD v3.4 (每场 ${runs} 局)`);
  console.log("=".repeat(78));

  // 胜率矩阵: matrix[a][b] = a 对 b 的胜场数
  const matrix: Record<string, Record<string, number>> = {};
  for (const a of RACES) {
    matrix[a] = {};
    for (const b of RACES) matrix[a][b] = -1; // -1 = 未测(镜像)
  }

  // 单位统计聚合: key = 单位id, 累加场均数据
  const unitAgg: Record<string, Record<string, number>> = {};
  const unitMeta: Record<string, { name: string; race: string; team: string }> =
    {};
  const idToName: Record<string, string> = {};
  const skillAgg: Record<string, Record<string, number>> = {};
  const talentAgg: Record<string, Record<string, number>> = {};
  let totalDuration = 0;
  let totalBattles = 0;

  const accumulate = (d: ReturnType<typeof runOneDetailed>) => {
    totalDuration += d.duration;
    totalBattles++;
    for (const s of d.stats) {
      // 按角色名聚合 (unitId 每场重置 u_0~u_15, 不能用做key)
      const key = s.name || s.unitId;
      if (!unitAgg[key]) unitAgg[key] = { count: 0 };
      if (!unitMeta[key] && s.name)
        unitMeta[key] = { name: s.name, race: s.race, team: s.team };
      // 同时建立 unitId → name 映射 (技能统计反查用)
      if (s.unitId && s.name) idToName[s.unitId] = s.name;
      const u = unitAgg[key];
      u.count = (u.count || 0) + 1;
      u.totalDamage = (u.totalDamage || 0) + (s.totalDamageDealt || 0);
      u.physDmg = (u.physDmg || 0) + (s.physicalDamage || 0);
      u.magDmg = (u.magDmg || 0) + (s.magicalDamage || 0);
      u.pureDmg = (u.pureDmg || 0) + (s.pureDamage || 0);
      u.healing = (u.healing || 0) + (s.totalHealingDone || 0);
      u.lifeSteal = (u.lifeSteal || 0) + (s.lifeStealHealing || 0);
      u.dmgTaken = (u.dmgTaken || 0) + (s.totalDamageReceived || 0);
      u.kills = (u.kills || 0) + (s.kills || 0);
      u.deaths = (u.deaths || 0) + (s.deaths || 0);
      u.skillCasts = (u.skillCasts || 0) + (s.skillCasts || 0);
      u.critCount = (u.critCount || 0) + (s.critCount || 0);
      u.blockCount = (u.blockCount || 0) + (s.blockCount || 0);
      // v2.16 承伤分类字段
      u.physTaken = (u.physTaken || 0) + (s.physicalDamageReceived || 0);
      u.magTaken = (u.magTaken || 0) + (s.magicalDamageReceived || 0);
      u.pureTaken = (u.pureTaken || 0) + (s.pureDamageReceived || 0);
      u.hitsTaken = (u.hitsTaken || 0) + ((s as any).hitsTaken || 0);
      u.critsTaken = (u.critsTaken || 0) + ((s as any).critsTaken || 0);
      // v3.3-r5 细颗粒度: 输出来源分轨 / 收益分轨 / 存活归一
      u.autoDmg = (u.autoDmg || 0) + ((s as any).autoAttackDamage || 0);
      u.skillDmg = (u.skillDmg || 0) + ((s as any).skillDamage || 0);
      u.talentDmg = (u.talentDmg || 0) + ((s as any).talentDamage || 0);
      u.talentHeal = (u.talentHeal || 0) + ((s as any).talentHealing || 0);
      u.buffVal = (u.buffVal || 0) + ((s as any).buffValue || 0);
      u.ctrlSec = (u.ctrlSec || 0) + ((s as any).controlSeconds || 0);
      u.skillHeal = (u.skillHeal || 0) + ((s as any).skillHealing || 0);
      u.shieldAbs = (u.shieldAbs || 0) + ((s as any).shieldAbsorbed || 0);
      u.blockRed = (u.blockRed || 0) + ((s as any).blockReduced || 0);
      u.survTime = (u.survTime || 0) + ((s as any).survivalTime || 0);
    }
    for (const [skey, sv] of Object.entries(d.skillStats)) {
      const ss = sv as any;
      // 用 角色名_技能名 做key (unitId每场重置, 不能用)
      const ownerName = idToName[ss.ownerId] || "?";
      const aggKey = `${ownerName}_${ss.skillName}`;
      if (!skillAgg[aggKey])
        skillAgg[aggKey] = {
          casts: 0,
          totalDamage: 0,
          physDmg: 0,
          magDmg: 0,
          pureDmg: 0,
          ownerId: 0,
          hits: 0,
          expectedHits: 0,
          interrupts: 0,
        };
      const agg = skillAgg[aggKey];
      agg.casts += ss.casts || 0;
      agg.totalDamage += ss.totalDamage || 0;
      agg.physDmg += ss.physDmg || 0;
      agg.magDmg += ss.magDmg || 0;
      agg.pureDmg += ss.pureDmg || 0;
      agg.hits = (agg.hits || 0) + (ss.hits || 0);
      agg.expectedHits = (agg.expectedHits || 0) + (ss.expectedHits || 0);
      agg.interrupts = (agg.interrupts || 0) + (ss.interrupts || 0);
      agg.skillName = ss.skillName;
      agg.ownerName = ownerName;
    }
    // v2.11 天赋统计聚合
    for (const [tkey, tv] of Object.entries(d.talentStats)) {
      const ts2 = tv as any;
      const ownerName2 = idToName[ts2.ownerId] || "?";
      const aggKey2 = `${ownerName2}_${ts2.talentName}`;
      if (!talentAgg[aggKey2])
        talentAgg[aggKey2] = { triggers: 0, value: 0, valueType: "count" };
      const agg2 = talentAgg[aggKey2];
      agg2.triggers += ts2.triggers || 0;
      agg2.value += ts2.value || 0;
      agg2.valueType = ts2.valueType || "count";
      agg2.talentName = ts2.talentName;
      agg2.ownerName = ownerName2;
    }
  };

  for (let i = 0; i < RACES.length; i++) {
    for (let j = i + 1; j < RACES.length; j++) {
      const a = RACES[i];
      const b = RACES[j];
      let aWins = 0;
      for (let k = 0; k < runs; k++) {
        const d = runOneDetailed(ROSTER[a], ROSTER[b]);
        // v3.3: 180s 超时判平局而不是失败，双方各计 0.5 胜
        if (d.winner === "ally") aWins += 1;
        else if (d.winner === "draw") aWins += 0.5;
        accumulate(d);
      }
      matrix[a][b] = aWins;
      matrix[b][a] = runs - aWins;
      const pctA = ((aWins / runs) * 100).toFixed(0);
      const pctB = (100 - (aWins / runs) * 100).toFixed(0);
      console.log(
        `${RACE_CN[a].padEnd(4)} vs ${RACE_CN[b].padEnd(4)}: ${RACE_CN[a]} ${pctA}% / ${RACE_CN[b]} ${pctB}%`
      );
    }
  }

  // 镜像对局
  console.log("\n--- 镜像对局 (先手方) ---");
  for (const a of RACES) {
    let firstWins = 0;
    for (let k = 0; k < runs; k++) {
      const d = runOneDetailed(ROSTER[a], ROSTER[a]);
      if (d.winner === "ally") firstWins += 1;
      else if (d.winner === "draw") firstWins += 0.5;
      accumulate(d);
    }
    matrix[a][a] = firstWins;
    console.log(
      `${RACE_CN[a].padEnd(4)} 镜像: 先手 ${((firstWins / runs) * 100).toFixed(0)}% / 后手 ${(100 - (firstWins / runs) * 100).toFixed(0)}%`
    );
  }

  // 胜率矩阵输出
  console.log("\n" + "=".repeat(78));
  console.log("胜率矩阵 (行 = 该种族 vs 列种族):");
  console.log("=".repeat(78));
  const header = "        " + RACES.map((r) => RACE_CN[r].padStart(6)).join("");
  console.log(header);
  for (const a of RACES) {
    let row = `${RACE_CN[a].padEnd(6)} `;
    for (const b of RACES) {
      const w = matrix[a][b];
      if (w === -1) {
        row += "    - ";
      } else {
        const pct = Math.round((w / runs) * 100);
        const cell = `${pct}%`.padStart(6);
        // 极端比分高亮
        row += pct >= 75 || pct <= 25 ? `[${cell}]` : ` ${cell} `;
      }
    }
    console.log(row);
  }

  // 综合胜率
  console.log("\n综合胜率:");
  const totalWins: Record<string, { w: number; total: number }> = {};
  for (const a of RACES) {
    totalWins[a] = { w: 0, total: 0 };
  }
  for (let i = 0; i < RACES.length; i++) {
    for (let j = 0; j < RACES.length; j++) {
      if (i === j) continue;
      const w = matrix[RACES[i]][RACES[j]];
      if (w >= 0) {
        totalWins[RACES[i]].w += w;
        totalWins[RACES[i]].total += runs;
      }
    }
  }
  const sorted = Object.entries(totalWins).sort(
    (x, y) => y[1].w / y[1].total - x[1].w / x[1].total
  );
  const totalRows: { race: string; pct: string; bar: string }[] = [];
  for (const [race, { w, total }] of sorted) {
    const pct = ((w / total) * 100).toFixed(1);
    const bar =
      "█".repeat(Math.round((w / total) * 20)) +
      "░".repeat(20 - Math.round((w / total) * 20));
    totalRows.push({ race, pct, bar });
    console.log(`  ${RACE_CN[race].padEnd(4)} ${pct.padStart(6)}%  ${bar}`);
  }

  // ===== 写入报告文件 =====
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`;
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
  L.push(`# SLG 平衡测试报告`);
  L.push("");
  L.push(`> 生成时间: ${now.toLocaleString("zh-CN")}`);
  L.push(
    `> 每场 ${runs} 局 | GDD v3.4 / App v2.2 | 定位阵容 (前排坦克/中排输出/后排治疗)`
  );
  L.push("");

  // 综合胜率
  L.push(`## 综合胜率`);
  L.push("");
  L.push(`| 排名 | 种族 | 胜率 |`);
  L.push(`|:---:|------|:---:|`);
  totalRows.forEach(({ race, pct }, idx) => {
    L.push(`| ${idx + 1} | ${RACE_CN[race]} | **${pct}%** |`);
  });
  L.push("");

  // 各对局胜率
  L.push(`## 对局胜率明细`);
  L.push("");
  L.push(`| 对局 | 胜率 | 幅度判定 |`);
  L.push(`|------|:---:|------|`);
  for (let i = 0; i < RACES.length; i++) {
    for (let j = i + 1; j < RACES.length; j++) {
      const a = RACES[i],
        b = RACES[j];
      const w = matrix[a][b];
      const pct = (w / runs) * 100;
      const label =
        pct > 90
          ? "⚫ 碾压"
          : pct > 70
            ? "🔴 大幅克"
            : pct > 56
              ? "🟡 小幅克"
              : pct < 44
                ? `被${RACE_CN[b]}克`
                : "⚪ 均势";
      L.push(
        `| ${RACE_CN[a]} vs ${RACE_CN[b]} | ${RACE_CN[a]} ${pct.toFixed(1)}% / ${RACE_CN[b]} ${(100 - pct).toFixed(1)}% | ${label} |`
      );
    }
  }
  L.push("");

  // 镜像
  L.push(`## 镜像对局 (先手方胜率)`);
  L.push("");
  L.push(`| 种族 | 先手 | 后手 |`);
  L.push(`|------|:---:|:---:|`);
  for (const a of RACES) {
    const w = matrix[a][a];
    const pct = (w / runs) * 100;
    L.push(
      `| ${RACE_CN[a]} | ${pct.toFixed(1)}% | ${(100 - pct).toFixed(1)}% |`
    );
  }
  L.push("");

  // 矩阵
  L.push(`## 胜率矩阵 (行 = 该种族 vs 列胜率)`);
  L.push("");
  L.push(`| 行\\列 | ` + RACES.map((r) => RACE_CN[r]).join(" | ") + ` |`);
  L.push(`|------|` + RACES.map(() => "---|").join(""));
  for (const a of RACES) {
    const cells = RACES.map((b) => {
      const w = matrix[a][b];
      if (w === -1) return "-";
      return `${Math.round((w / runs) * 100)}%`;
    }).join(" | ");
    L.push(`| ${RACE_CN[a]} | ${cells} |`);
  }
  L.push("");

  // 克制关系
  L.push(`## 克制关系 (判定标准: >56%小幅 / >70%大幅 / >90%碾压)`);
  L.push("");
  for (const a of RACES) {
    const wins: string[] = [],
      loses: string[] = [];
    for (const b of RACES) {
      if (a === b) continue;
      const w = matrix[a][b];
      const pct = (w / runs) * 100;
      if (pct > 56) wins.push(`${RACE_CN[b]} ${pct.toFixed(0)}%`);
      else if (pct < 44) loses.push(`${RACE_CN[b]} ${(100 - pct).toFixed(0)}%`);
    }
    const tot = totalRows.find((t) => t.race === a);
    L.push(`### ${RACE_CN[a]} (综合 ${tot?.pct}%)`);
    L.push(`- 克制: ${wins.length ? wins.join(", ") : "无"}`);
    L.push(`- 被克: ${loses.length ? loses.join(", ") : "无"}`);
    L.push("");
  }

  // ===== 单位统计 =====
  const avgDuration =
    totalBattles > 0 ? (totalDuration / totalBattles).toFixed(1) : "0";
  L.push(`## 角色场均统计 (全部对局平均, 共 ${totalBattles} 场)`);
  L.push("");
  L.push(`平均战斗时长: **${avgDuration}s**`);
  L.push("");
  L.push(
    `| 角色 | 种族 | 输出 | 物伤 | 魔伤 | 纯粹 | 承伤 | 治疗 | 吸血 | 击杀 | 死亡 | 技能 | 暴击 | 格挡 |`
  );
  L.push(
    `|------|------|------|------|------|------|------|------|------|------|------|------|------|------|`
  );
  const unitEntries = Object.entries(unitAgg).sort(
    (x, y) => (y[1].totalDamage || 0) - (x[1].totalDamage || 0)
  );
  for (const [uid, u] of unitEntries) {
    const cnt = u.count || 1;
    const meta = unitMeta[uid];
    const raceCN: Record<string, string> = {
      beast: "兽",
      hunter: "猎",
      warrior: "战",
      mage: "法",
      undead: "亡",
      dragon: "龙",
    };
    const race = meta ? raceCN[meta.race] || meta.race : "?";
    const name = meta ? meta.name : uid;
    L.push(
      `| ${name} | ${race} | ${Math.round((u.totalDamage || 0) / cnt)} | ${Math.round((u.physDmg || 0) / cnt)} | ${Math.round((u.magDmg || 0) / cnt)} | ${Math.round((u.pureDmg || 0) / cnt)} | ${Math.round((u.dmgTaken || 0) / cnt)} | ${Math.round((u.healing || 0) / cnt)} | ${Math.round((u.lifeSteal || 0) / cnt)} | ${((u.kills || 0) / cnt).toFixed(2)} | ${((u.deaths || 0) / cnt).toFixed(2)} | ${((u.skillCasts || 0) / cnt).toFixed(1)} | ${((u.critCount || 0) / cnt).toFixed(1)} | ${((u.blockCount || 0) / cnt).toFixed(1)} |`
    );
  }
  L.push("");

  // ===== v3.3-r5 角色细颗粒度明细 =====
  const roleRows: any[] = [];
  let grandOutput = 0;
  // v3.3-r5: 必须用「场均」同量纲求和，否则占比会小一个数量级
  for (const [, u] of Object.entries(unitAgg))
    grandOutput += (u.totalDamage || 0) / (u.count || 1);
  for (const [name, u] of Object.entries(unitAgg)) {
    const cnt = u.count || 1;
    const race = unitMeta[name]?.race || "?";
    const avg = (k: string) => (u[k] || 0) / cnt;
    const out = avg("totalDamage");
    const auto = avg("autoDmg");
    const skill = avg("skillDmg");
    const heal = avg("healing");
    const shield = avg("shieldAbs");
    const block = avg("blockRed");
    const gain = heal + shield + block;
    const surv = avg("survTime");
    const per10 = (v: number) => (surv > 0 ? (v / surv) * 10 : 0);
    roleRows.push({
      name,
      race,
      raceCN: RACE_CN[race] || race,
      out,
      auto,
      skill,
      other: Math.max(0, out - auto - skill),
      talent: avg("talentDmg"),
      outShare: grandOutput > 0 ? (out / grandOutput) * 100 : 0,
      surv,
      out10: per10(out),
      heal,
      ls: avg("lifeSteal"),
      skillHeal: avg("skillHeal"),
      shield,
      block,
      gain,
      gain10: per10(gain),
      buff: avg("buffVal"),
      ctrl: avg("ctrlSec"),
      total10: per10(out) + per10(gain),
      value: out + gain, // 绝对贡献（不归一），与 10s综合 交叉验证
      taken: avg("dmgTaken"),
      kills: avg("kills"),
      deaths: avg("deaths"),
      casts: avg("skillCasts"),
    });
  }
  const by10 = [...roleRows].sort((a, b) => b.total10 - a.total10);
  // by10 是降序: 前 10% 边界在索引 n*0.1，后 10% 边界在 n*0.9。方向写反会把 51/56 个角色判成超模。
  const hiCut = by10[Math.floor(by10.length * 0.1)]?.total10 ?? Infinity;
  const loCut = by10[Math.floor(by10.length * 0.9)]?.total10 ?? 0;
  for (const r of roleRows) {
    r.verdict =
      r.total10 >= hiCut ? "超模" : r.total10 <= loCut ? "待加强" : "正常";
  }
  const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
  const f1 = (v: number) => v.toFixed(1);

  L.push(`## 角色细颗粒度明细 (v3.3-r5, ${totalBattles} 场)`);
  L.push("");
  L.push(
    `> **口径**: 普攻/技能/其他 = **来源分轨**，三者相加 ≈ 总输出；天赋伤害 = **归因分轨**（与来源分轨重叠、不可相加；部分天赋埋点记的是整段技能/DoT 伤害，可能与技能列相等或为其估算值）。`
  );
  L.push(
    `> **收益合计** = 治疗 + 护盾吸收 + 格挡减伤，统一为血量点数；吸血/技能治疗是治疗的子集，单列展示但不重复计入。`
  );
  L.push(
    `> 护盾吸收/格挡减伤归属**受益单位**（非施放者）；增益(点·秒)与控制(s)是不同度量衡，单独列，不并入合计。`
  );
  L.push(
    `> 10s归一 = 数值 ÷ 存活秒 × 10；**存活s = 累计在场秒数**（v3.4 R9 起每个 tick 对存活单位 +0.1，阵亡与复活等待期间不计）。**总贡献** = 总输出 + 收益合计（绝对值、不归一），用于与 10s综合 交叉验证。`
  );
  L.push(
    `> ⚠️ 短存活或「阵亡后仍可施法」的角色（如殉道者）10s归一会被放大，务必结合总输出/总贡献/存活s 一起看。跨族对比受对局时长影响，建议优先看同族内排名。判定: 10s综合 ≥ P90 为 🔴超模，≤ P10 为 🔵待加强。`
  );
  L.push("");
  L.push(`### 输出分轨 (按总输出降序)`);
  L.push("");
  L.push(
    `| 角色 | 种族 | 总输出 | 普攻 | 技能 | 其他 | 天赋归因 | 占全场% | 存活s | 10s输出 | 总贡献 | 判定 |`
  );
  L.push(`|------|------|---:|---:|---:|---:|---:|---:|---:|---:|---:|:---:|`);
  for (const r of [...roleRows].sort((a, b) => b.out - a.out)) {
    L.push(
      `| ${r.name} | ${r.raceCN} | ${fmt(r.out)} | ${fmt(r.auto)} | ${fmt(r.skill)} | ${fmt(r.other)} | ${fmt(r.talent)} | ${f1(r.outShare)} | ${f1(r.surv)} | ${fmt(r.out10)} | ${fmt(r.value)} | ${r.verdict === "超模" ? "🔴 超模" : r.verdict === "待加强" ? "🔵 待加强" : "⚪"} |`
    );
  }
  L.push("");
  L.push(`### 收益分轨 (按收益合计降序)`);
  L.push("");
  L.push(
    `| 角色 | 种族 | 治疗 | 吸血 | 技能治疗 | 护盾吸收 | 格挡减伤 | 收益合计 | 10s收益 | 增益点·秒 | 控制s | 10s综合 |`
  );
  L.push(`|------|------|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`);
  for (const r of [...roleRows].sort((a, b) => b.gain - a.gain)) {
    L.push(
      `| ${r.name} | ${r.raceCN} | ${fmt(r.heal)} | ${fmt(r.ls)} | ${fmt(r.skillHeal)} | ${fmt(r.shield)} | ${fmt(r.block)} | ${fmt(r.gain)} | ${fmt(r.gain10)} | ${fmt(r.buff)} | ${f1(r.ctrl)} | ${fmt(r.total10)} |`
    );
  }
  L.push("");
  L.push(`### 超模 / 待加强速览 (按 10s 综合贡献)`);
  L.push("");
  L.push(`| 排名 | 🔴 疑似超模 | 10s综合 | | 🔵 待加强 | 10s综合 |`);
  L.push(`|:---:|------|---:|:---:|------|---:|`);
  const bottom = [...by10].reverse();
  for (let i = 0; i < 10 && i < by10.length; i++) {
    L.push(
      `| ${i + 1} | ${by10[i].name}(${by10[i].raceCN}) | ${fmt(by10[i].total10)} | | ${bottom[i].name}(${bottom[i].raceCN}) | ${fmt(bottom[i].total10)} |`
    );
  }
  L.push("");

  // ===== 技能统计 (v2.14 Step2) =====
  L.push(`## 技能场均统计 (v2.14: 拆释放与命中)`);
  L.push("");
  L.push(
    `| 角色 | 技能 | 释放/场 | 被打断/场 | 命中率% | 场均命中 | 总伤 | 单次均伤 |`
  );
  L.push(`|------|------|:---:|:---:|:---:|:---:|------|:---:|`);
  const skillEntries = Object.entries(skillAgg)
    .filter(([, s]) => (s.skillName || "") !== "平砍") // 过滤普攻刷屏
    .sort((x, y) => (y[1].totalDamage || 0) - (x[1].totalDamage || 0));
  for (const [skey, s] of skillEntries.slice(0, 30)) {
    const casts = s.casts || 0;
    const hits = s.hits || 0;
    const expHits = s.expectedHits || casts;
    const hitRate =
      casts > 0 ? Math.round((hits / Math.max(1, expHits)) * 100) : 0;
    const avgHit = casts > 0 ? (hits / casts).toFixed(1) : "0";
    const avgDmg = casts > 0 ? Math.round((s.totalDamage || 0) / casts) : 0;
    L.push(
      `| ${s.ownerName || "?"} | ${s.skillName || "?"} | ${(casts / totalBattles).toFixed(1)} | ${((s.interrupts || 0) / totalBattles).toFixed(2)} | ${hitRate}% | ${avgHit} | ${Math.round((s.totalDamage || 0) / totalBattles)} | ${avgDmg} |`
    );
  }
  L.push("");

  // ===== 承伤分类 (v2.14 Step3) =====
  L.push(`## 角色承伤分类统计`);
  L.push("");
  L.push(
    `> 格挡率 = 格挡次数 ÷ 被攻击次数 | 被暴击率 = 被暴击次数 ÷ 被攻击次数`
  );
  L.push("");
  L.push(
    `| 种族 | 角色 | 物理承伤 | 魔法承伤 | 纯粹承伤 | 格挡率% | 被暴击率% |`
  );
  L.push(`|:---:|------|------|------|------|:---:|:---:|`);
  const RACE_CN2: Record<string, string> = {
    beast: "兽",
    hunter: "猎",
    warrior: "战",
    mage: "法",
    undead: "亡",
    dragon: "龙",
  };
  const takenEntries = Object.entries(unitAgg).sort(
    (x, y) => (y[1].dmgTaken || 0) - (x[1].dmgTaken || 0)
  );
  for (const [name, u] of takenEntries.slice(0, 30)) {
    const cnt = u.count || 1;
    const meta = unitMeta[name];
    const race = meta ? RACE_CN2[meta.race] || meta.race : "?";
    const hits = u.hitsTaken || 0;
    const blockRate =
      hits > 0 ? (((u.blockCount || 0) / hits) * 100).toFixed(1) : "-";
    const critRate =
      hits > 0 ? (((u.critsTaken || 0) / hits) * 100).toFixed(1) : "-";
    L.push(
      `| ${race} | ${name} | ${Math.round((u.physTaken || 0) / cnt)} | ${Math.round((u.magTaken || 0) / cnt)} | ${Math.round((u.pureTaken || 0) / cnt)} | ${blockRate} | ${critRate} |`
    );
  }
  L.push("");

  // ===== 天赋统计 (v2.11) =====
  L.push(`## 天赋场均统计`);
  L.push("");
  L.push(
    `> valueType: damage=额外伤害 | heal=回血/吸血 | buff=增攻/降防等效量 | control=控制时长s | count=次数`
  );
  L.push("");
  L.push(`| 角色 | 天赋 | 触发/场 | 贡献量/场 | 类型 |`);
  L.push(`|------|------|------|------|------|`);
  const VT_CN: Record<string, string> = {
    damage: "伤害",
    heal: "治疗",
    buff: "增益",
    control: "控制(s)",
    count: "次数",
  };
  const talentEntries = Object.entries(talentAgg).sort(
    (x, y) => (y[1].value || 0) - (x[1].value || 0)
  );
  for (const [tkey, t] of talentEntries) {
    const isCount = t.valueType === "count";
    const val = isCount
      ? (t.value / totalBattles).toFixed(1)
      : Math.round(t.value / totalBattles);
    L.push(
      `| ${t.ownerName} | ${t.talentName} | ${(t.triggers / totalBattles).toFixed(1)} | ${val} | ${VT_CN[t.valueType] || t.valueType} |`
    );
  }
  L.push("");

  const filePath = path.join(reportDir, `balance_${ts}.md`);
  fs.writeFileSync(filePath, L.join("\n"), "utf-8");
  console.log(`\n📄 报告已保存: ${filePath}`);

  // ===== v3.3-r5 结构化数据 + 交互看板 =====
  // v3.4: 胜率对局明细（与 App 内置看板同源，判定 58/42 阈值）
  const verdictOf = (pct: number) =>
    pct > 90
      ? "碾压"
      : pct > 70
        ? "大幅克制"
        : pct > 58
          ? "小幅克制"
          : pct >= 43
            ? "均势"
            : "被克";
  const matchups: any[] = [];
  for (let i = 0; i < RACES.length; i++) {
    for (let j = i + 1; j < RACES.length; j++) {
      const aPct = (matrix[RACES[i]][RACES[j]] / runs) * 100;
      matchups.push({
        a: RACE_CN[RACES[i]],
        b: RACE_CN[RACES[j]],
        aPct,
        bPct: 100 - aPct,
        verdict: verdictOf(aPct),
        mirror: false,
      });
    }
  }
  for (const r of RACES) {
    const aPct = (matrix[r][r] / runs) * 100;
    matchups.push({
      a: `${RACE_CN[r]}(先手)`,
      b: `${RACE_CN[r]}(后手)`,
      aPct,
      bPct: 100 - aPct,
      verdict: "镜像",
      mirror: true,
    });
  }
  const boardData = {
    generated:
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    version: "GDD v3.4 / App v2.2",
    battles: totalBattles,
    avgDuration: Number(avgDuration),
    rows: roleRows,
    matchups,
  };
  const rolesJsonPath = path.join(reportDir, `roles_${ts}.json`);
  fs.writeFileSync(rolesJsonPath, JSON.stringify(boardData, null, 2), "utf-8");
  console.log(`📦 角色数据: ${rolesJsonPath}`);

  const tplCandidates = [
    path.join(process.cwd(), "scripts", "role_board_template.html"),
    path.join(__dirname, "role_board_template.html"),
  ];
  const tplPath = tplCandidates.find((p) => fs.existsSync(p));
  if (tplPath) {
    const payload = JSON.stringify(boardData).replace(/<\//g, "<\\/");
    const html = fs
      .readFileSync(tplPath, "utf-8")
      .replace("__ROLE_DATA__", payload);
    const boardPath = path.join(reportDir, `character_board_${ts}.html`);
    fs.writeFileSync(boardPath, html, "utf-8");
    console.log(`📊 角色看板: ${boardPath}`);
  } else {
    console.log(
      `⚠️ 未找到 role_board_template.html，已跳过 HTML 看板（JSON 仍可用）`
    );
  }
}

main();
