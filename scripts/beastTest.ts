/**
 * 兽族专项测试 - 兽族 vs 全部阵容 + 镜像
 * 输出: 胜率 + 角色统计 + 技能统计 + 一场战斗log
 */
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const ROSTER: Record<string, string[]> = {
  beast: ["hl", "mmx", "lbmx", "hx", "ds", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "zfyx", "sszs", "xblr", "hqs", "lxgz", "xjlr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["swxz", "kldd", "dyq", "mrsz", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "aysl", "hbfl"], // v2.32 龙吟者前排(天赋要求)
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

function runDetailed(ally: string[], enemy: string[], collectLog = false) {
  const state = initBattle(
    makeTeam(ally) as any,
    makeTeam(enemy) as any
  ) as unknown as BattleState;
  let safety = 0;
  const log: { t: number; text: string }[] = [];
  let lastIdx = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
    if (collectLog && state.battleLog.length > lastIdx) {
      const entries = state.battleLog.slice(lastIdx);
      lastIdx = state.battleLog.length;
      for (const e of entries) {
        if (
          e.time <= 25 &&
          (e.type === "skill" || e.type === "death" || e.type === "system")
        ) {
          log.push({ t: e.time, text: e.text });
        }
      }
    }
  }
  return {
    winner: state.winner || "enemy",
    duration: state.time,
    stats: (state as any).stats || [],
    skillStats: (state as any).skillStats || {},
    talentStats: (state as any).talentStats || {},
    _units: state.units.map((u: any) => ({
      name: u.def.name,
      _buffWinPhys: u._buffWinPhys || 0,
      _buffWinSkill: u._buffWinSkill || 0,
    })),
    log,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const runs = args.length > 0 ? parseInt(args[0]) || 100 : 100;
  // v2.31 参数化: node beastTest.cjs [场次] [种族]  (默认 beast)
  const raceArg = args[1] || "beast";
  const mainRace = (ROSTER[raceArg] ? raceArg : "beast") as string;
  const mainCN = RACE_CN[mainRace];
  const opponents = (Object.keys(ROSTER) as string[]).filter(
    (r) => r !== mainRace
  );

  console.log(`🟫 ${mainCN}专项测试 (每场 ${runs} 局)`);
  console.log("=".repeat(70));

  const results: {
    vs: string;
    pct: number;
    duration: number;
    variance?: number;
  }[] = [];
  const unitAgg: Record<string, Record<string, number>> = {};
  const unitMeta: Record<string, { name: string; race: string }> = {};
  const idToName: Record<string, string> = {};
  const skillAgg: Record<string, Record<string, number>> = {};
  const talentAgg: Record<string, Record<string, number>> = {};
  // v2.13 Step3: 胜负分桶 (仅主测方)
  const unitAggWin: Record<string, Record<string, number>> = {};
  const unitAggLose: Record<string, Record<string, number>> = {};
  let totalBattles = 0,
    totalDuration = 0,
    totalWins = 0;

  const accumulate = (d: ReturnType<typeof runDetailed>, won?: boolean) => {
    totalDuration += d.duration;
    totalBattles++;
    if (won) totalWins++;
    for (const s of d.stats) {
      const key = s.name;
      if (!unitAgg[key]) unitAgg[key] = { count: 0 };
      const u = unitAgg[key];
      u.count++;
      u.totalDamage = (u.totalDamage || 0) + (s.totalDamageDealt || 0);
      u.physDmg = (u.physDmg || 0) + (s.physicalDamage || 0);
      u.magDmg = (u.magDmg || 0) + (s.magicalDamage || 0);
      u.pureDmg = (u.pureDmg || 0) + (s.pureDamage || 0);
      u.healing = (u.healing || 0) + (s.totalHealingDone || 0);
      u.dmgTaken = (u.dmgTaken || 0) + (s.totalDamageReceived || 0);
      u.physTaken = (u.physTaken || 0) + (s.physicalDamageReceived || 0);
      u.magTaken = (u.magTaken || 0) + (s.magicalDamageReceived || 0);
      u.pureTaken = (u.pureTaken || 0) + (s.pureDamageReceived || 0);
      u.kills = (u.kills || 0) + (s.kills || 0);
      u.deaths = (u.deaths || 0) + (s.deaths || 0);
      u.skillCasts = (u.skillCasts || 0) + (s.skillCasts || 0);
      u.critCount = (u.critCount || 0) + (s.critCount || 0);
      u.blockCount = (u.blockCount || 0) + (s.blockCount || 0);
      u.survival = (u.survival || 0) + (s.survivalTime || 0);
      u.hitsTaken = (u.hitsTaken || 0) + ((s as any).hitsTaken || 0);
      u.critsTaken = (u.critsTaken || 0) + ((s as any).critsTaken || 0);
      u.team = (s as any).team || u.team || "?";
      // v2.11 增益窗口 (来自单位字段, stats 不包含时从 0 开始)
      if (!u.buffWinPhys) u.buffWinPhys = 0;
      if (!u.buffWinSkill) u.buffWinSkill = 0;
      if (!unitMeta[key] && s.name)
        unitMeta[key] = { name: s.name, race: s.race };
      if (s.unitId && s.name) idToName[s.unitId] = s.name;
      // v2.13 Step3 胜负分桶 (仅主测方 ally)
      if (won !== undefined && s.team === "ally") {
        const bucket = won ? unitAggWin : unitAggLose;
        if (!bucket[key]) bucket[key] = { count: 0 };
        const bu = bucket[key];
        bu.count++;
        bu.totalDamage = (bu.totalDamage || 0) + (s.totalDamageDealt || 0);
        bu.survival = (bu.survival || 0) + (s.survivalTime || 0);
        bu.kills = (bu.kills || 0) + (s.kills || 0);
        bu.deaths = (bu.deaths || 0) + (s.deaths || 0);
      }
    }
    // v2.11 从 state.units 读取增益窗口统计 (引擎单位字段)
    const bwUnits = (d as any)._units || [];
    for (const wu of bwUnits) {
      const key = wu.name;
      if (!unitAgg[key]) unitAgg[key] = { count: 1 };
      const u = unitAgg[key];
      u.buffWinPhys = (u.buffWinPhys || 0) + (wu._buffWinPhys || 0);
      u.buffWinSkill = (u.buffWinSkill || 0) + (wu._buffWinSkill || 0);
    }
    for (const [skey, sv] of Object.entries(d.skillStats)) {
      const ss = sv as any;
      const ownerName = idToName[ss.ownerId] || "?";
      const aggKey = `${ownerName}_${ss.skillName}`;
      if (!skillAgg[aggKey])
        skillAgg[aggKey] = {
          casts: 0,
          totalDamage: 0,
          physDmg: 0,
          magDmg: 0,
          pureDmg: 0,
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

  // 镜像
  let mirrorWins = 0;
  for (let k = 0; k < runs; k++) {
    const d = runDetailed(ROSTER[mainRace], ROSTER[mainRace]);
    const won = d.winner === "ally";
    if (won) mirrorWins++;
    accumulate(d, won);
  }
  console.log(
    `🟫 ${mainCN} vs ${mainCN}(镜像): 先手 ${((mirrorWins / runs) * 100).toFixed(1)}%`
  );
  results.push({
    vs: `${mainCN}(镜像)`,
    pct: (mirrorWins / runs) * 100,
    duration: 0,
  });

  // 对阵其他5族
  let sampleLog: { t: number; text: string }[] = [];
  let winLog: { t: number; text: string }[] = [];
  let loseLog: { t: number; text: string }[] = [];
  for (const opp of opponents) {
    let wins = 0;
    let durationSum = 0;
    const durs: number[] = [];
    for (let k = 0; k < runs; k++) {
      // v2.32 修复: 前30场收集log, 保证胜/败场各抽到一场 (此前只在k=0收集, 第一场败则胜场log永远空)
      const d = runDetailed(ROSTER[mainRace], ROSTER[opp], k < 30);
      const won = d.winner === "ally";
      if (won) wins++;
      durationSum += d.duration;
      durs.push(d.duration);
      accumulate(d, won);
      if (opp === "undead" && k === 0) sampleLog = d.log;
      // v2.13 Step3 胜/败 log 各收集一场
      if (winLog.length === 0 && won) winLog = d.log;
      if (loseLog.length === 0 && !won) loseLog = d.log;
    }
    const pct = (wins / runs) * 100;
    const dur = (durationSum / runs).toFixed(1);
    const mean = durationSum / runs;
    const variance = Math.sqrt(
      durs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / runs
    );
    console.log(
      `🟫 ${mainCN} vs ${RACE_CN[opp]}: ${mainCN} ${pct.toFixed(1)}% / 时长 ${dur}s ±${variance.toFixed(1)}`
    );
    results.push({
      vs: `vs ${RACE_CN[opp]}`,
      pct,
      duration: parseFloat(dur),
      variance,
    });
  }

  // ===== 输出报告 =====
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
  L.push(`# ${mainCN}专项测试报告`);
  L.push("");
  L.push(`> 生成时间: ${now.toLocaleString("zh-CN")}`);
  L.push(`> 每场 ${runs} 局 | 引擎 v2.0 | 定位阵容`);
  L.push("");
  L.push(`## 兽族胜率总览`);
  L.push("");
  L.push(`> 克制判定: >56% 小幅克 / >70% 大幅克 / >90% 碾压 | 目标区间 45-55%`);
  L.push("");
  L.push(`| 对局 | 兽族胜率 | 判定 | 平均时长 | 时长方差 |`);
  L.push(`|------|:---:|:---:|:---:|:---:|`);
  for (const r of results) {
    const pct = r.pct;
    let verdict = "✅ 均衡";
    if (pct >= 90) verdict = "🔴 碾压";
    else if (pct >= 70) verdict = "🔴 大幅克";
    else if (pct >= 56) verdict = "🟡 小幅克";
    else if (pct <= 10) verdict = "🔵 被碾压";
    else if (pct <= 30) verdict = "🔵 大幅被克";
    else if (pct <= 44) verdict = "🟡 小幅被克";
    L.push(
      `| 兽族 ${r.vs} | **${pct.toFixed(1)}%** | ${verdict} | ${r.duration}s | ±${((r as any).variance || 0).toFixed(1)} |`
    );
  }
  L.push("");

  L.push(`## 角色场均统计 · 主测方 (${mainCN}, 共 ${totalBattles} 场)`);
  L.push("");
  L.push(`平均战斗时长: **${(totalDuration / totalBattles).toFixed(1)}s**`);
  L.push("");
  L.push(
    `> 占比 = 占本队总和的 % | 10s输出/10s承伤 = 存活归一化 | 技能/暴击/格挡 = 场均次数`
  );
  L.push("");
  const unitEntries = Object.entries(unitAgg).sort(
    (x, y) => (y[1].totalDamage || 0) - (x[1].totalDamage || 0)
  );
  const mainTeam = unitEntries.filter(([, u]) => (u as any).team === "ally");
  const oppTeam = unitEntries.filter(([, u]) => (u as any).team !== "ally");
  // 同队总和
  const teamTotals: Record<
    string,
    { dmg: number; taken: number; heal: number }
  > = {};
  for (const [name, u] of unitEntries) {
    const t = (u as any).team || "?";
    if (!teamTotals[t]) teamTotals[t] = { dmg: 0, taken: 0, heal: 0 };
    teamTotals[t].dmg += u.totalDamage || 0;
    teamTotals[t].taken += u.dmgTaken || 0;
    teamTotals[t].heal += u.healing || 0;
  }
  const raceCN: Record<string, string> = {
    beast: "兽",
    hunter: "猎",
    warrior: "战",
    mage: "法",
    undead: "亡",
    dragon: "龙",
  };
  const fmtRow = (name: string, u: any, t: string) => {
    const cnt = u.count || 1;
    const tt = teamTotals[t] || { dmg: 1, taken: 1, heal: 1 };
    const dmgPct = (((u.totalDamage || 0) / Math.max(1, tt.dmg)) * 100).toFixed(
      1
    );
    const takenPct = (
      ((u.dmgTaken || 0) / Math.max(1, tt.taken)) *
      100
    ).toFixed(1);
    const surv = (u.survival || 0) / cnt;
    const avgDmg = (u.totalDamage || 0) / cnt;
    const avgTaken = (u.dmgTaken || 0) / cnt;
    const d10 = surv > 2 ? Math.round(avgDmg / (surv / 10)) : 0;
    const t10 = surv > 2 ? Math.round(avgTaken / (surv / 10)) : 0;
    return `| ${name} | ${Math.round(avgDmg)} | ${dmgPct}% | ${Math.round(avgTaken)} | ${takenPct}% | ${Math.round((u.healing || 0) / cnt)} | ${((u.kills || 0) / cnt).toFixed(2)} | ${((u.deaths || 0) / cnt).toFixed(2)} | ${surv.toFixed(1)} | ${d10} | ${t10} | ${((u.skillCasts || 0) / cnt).toFixed(1)} | ${((u.critCount || 0) / cnt).toFixed(1)} | ${((u.blockCount || 0) / cnt).toFixed(1)} |`;
  };
  L.push(
    `| 角色 | 输出 | 占比% | 承伤 | 占比% | 治疗 | 击杀 | 死亡 | 存活s | 10s输出 | 10s承伤 | 技能 | 暴击 | 格挡 |`
  );
  L.push(
    `|------|------|:---:|------|:---:|------|:---:|:---:|:---:|:---:|------|------|:---:|:---:|`
  );
  for (const [name, u] of mainTeam) L.push(fmtRow(name, u, "ally"));
  L.push("");

  // v2.13 Step3 胜负分裂 (仅主测方)
  L.push(
    `## 角色胜负分裂统计 (主测方: 赢${totalWins}局 / 输${totalBattles - totalWins}局)`
  );
  L.push("");
  L.push(
    `> 输出差% = (赢局-输局)/输局 | 正值=该角色是胜负关键 | 负值/接近0=胜负不取决于它`
  );
  L.push("");
  L.push(
    `| 角色 | 赢局输出 | 输局输出 | 输出差% | 赢局存活 | 输局存活 | 赢局击杀 | 输局击杀 |`
  );
  L.push(`|------|------|------|:---:|:---:|:---:|:---:|:---:|`);
  for (const [name, u] of [...mainTeam].sort(
    (a, b) => (b[1].totalDamage || 0) - (a[1].totalDamage || 0)
  )) {
    const w = unitAggWin[name];
    const l = unitAggLose[name];
    if (!w || !l) continue;
    const wCnt = w.count || 1,
      lCnt = l.count || 1;
    const wDmg = (w.totalDamage || 0) / wCnt;
    const lDmg = (l.totalDamage || 0) / lCnt;
    const diff = lDmg > 0 ? (((wDmg - lDmg) / lDmg) * 100).toFixed(0) : "∞";
    const wSurv = ((w.survival || 0) / wCnt).toFixed(1);
    const lSurv = ((l.survival || 0) / lCnt).toFixed(1);
    L.push(
      `| ${name} | ${Math.round(wDmg)} | ${Math.round(lDmg)} | ${diff}% | ${wSurv} | ${lSurv} | ${((w.kills || 0) / wCnt).toFixed(2)} | ${((l.kills || 0) / lCnt).toFixed(2)} |`
    );
  }
  L.push("");

  // v2.13 Step3 承伤分类
  L.push(`## 角色承伤分类统计 (全部对局)`);
  L.push("");
  L.push(`> 格挡率 = 格挡次数 ÷ 被攻击次数 | 暴击率 = 被暴击次数 ÷ 被攻击次数`);
  L.push("");
  L.push(
    `| 阵营 | 角色 | 物理承伤 | 魔法承伤 | 纯粹承伤 | 格挡减伤 | 格挡率% | 被暴击率% |`
  );
  L.push(`|:---:|------|------|------|------|------|:---:|:---:|`);
  for (const [name, u] of unitEntries) {
    const cnt = u.count || 1;
    const teamCN = u.team === "ally" ? "🟦主测" : "🟥对手";
    const hits = u.hitsTaken || 0;
    const blockRate =
      hits > 0 ? (((u.blockCount || 0) / hits) * 100).toFixed(1) : "-";
    const critRate =
      hits > 0 ? (((u.critsTaken || 0) / hits) * 100).toFixed(1) : "-";
    L.push(
      `| ${teamCN} | ${name} | ${Math.round((u.physTaken || 0) / cnt)} | ${Math.round((u.magTaken || 0) / cnt)} | ${Math.round((u.pureTaken || 0) / cnt)} | ${Math.round((u.blockCount || 0) / cnt)} | ${blockRate} | ${critRate} |`
    );
  }
  L.push("");

  // v2.11 增益转化分析: 窗口内普攻 vs 技能 + 实际转化伤害估算
  L.push(`## 增益转化分析 (鼓舞/狼吼/激昂 窗口内输出结构)`);
  L.push("");
  L.push(
    `> 窗口内伤害 = 增益持续期间打出的伤害 | 普攻占比高 = 增益更多喂了平A(技能在冷却) | 估算增益伤害 = 窗口内伤害 × 0.3/1.3 (按平均+30%估算) | 放大 = 估算增益伤害 ÷ 总输出`
  );
  L.push("");
  L.push(
    `| 角色 | 窗口内普攻 | 窗口内技能 | 普攻占比% | 窗口伤害合计 | 估算增益伤害 | 总输出 | 输出放大% |`
  );
  L.push(`|------|------|------|:---:|------|------|------|:---:|`);
  const mainTeamDmg = mainTeam.reduce(
    (s, [, u]) => s + (u.totalDamage || 0),
    0
  );
  for (const [name, u] of [...mainTeam].sort(
    (a, b) =>
      (b[1].buffWinPhys || 0) +
      (b[1].buffWinSkill || 0) -
      ((a[1].buffWinPhys || 0) + (a[1].buffWinSkill || 0))
  )) {
    const bwP = (u.buffWinPhys || 0) / totalBattles;
    const bwS = (u.buffWinSkill || 0) / totalBattles;
    const bwTotal = bwP + bwS;
    if (bwTotal < 100) continue; // 跳过窗口伤害过小的
    const physPct = ((bwP / bwTotal) * 100).toFixed(1);
    const estGain = Math.round((bwTotal * 0.3) / 1.3);
    const total = (u.totalDamage || 1) / (u.count || 1);
    const amp = ((estGain / total) * 100).toFixed(1);
    L.push(
      `| ${name} | ${Math.round(bwP)} | ${Math.round(bwS)} | ${physPct}% | ${Math.round(bwTotal)} | ${estGain} | ${Math.round(total)} | ${amp}% |`
    );
  }
  L.push("");

  L.push(`## 角色场均统计 · 对手方 (5 族混合, 按种族分组)`);
  L.push("");
  L.push(
    `> 占比 = 占全对手总和的 % (口径: 5 族混合, 仅供参考) | 10s 归一与占比同理`
  );
  L.push("");
  L.push(
    `| 种族 | 角色 | 输出 | 承伤 | 治疗 | 击杀 | 死亡 | 存活s | 10s输出 | 10s承伤 |`
  );
  L.push(`|:---:|------|------|------|------|:---:|:---:|:---:|------|------|`);
  const RACE_ORDER = { undead: 0, dragon: 1, mage: 2, hunter: 3, warrior: 4 };
  const oppSorted = [...oppTeam].sort((a, b) => {
    const ra = (unitMeta[a[0]]?.race || "") as string;
    const rb = (unitMeta[b[0]]?.race || "") as string;
    const oa = RACE_ORDER[ra as keyof typeof RACE_ORDER] ?? 9;
    const ob = RACE_ORDER[rb as keyof typeof RACE_ORDER] ?? 9;
    if (oa !== ob) return oa - ob;
    return (b[1].totalDamage || 0) - (a[1].totalDamage || 0);
  });
  for (const [name, u] of oppSorted) {
    const cnt = u.count || 1;
    const meta = unitMeta[name];
    const race = meta ? raceCN[meta.race] || meta.race : "?";
    const surv = (u.survival || 0) / cnt;
    const avgDmg = (u.totalDamage || 0) / cnt;
    const avgTaken = (u.dmgTaken || 0) / cnt;
    const d10 = surv > 2 ? Math.round(avgDmg / (surv / 10)) : 0;
    const t10 = surv > 2 ? Math.round(avgTaken / (surv / 10)) : 0;
    L.push(
      `| ${race} | ${name} | ${Math.round(avgDmg)} | ${Math.round(avgTaken)} | ${Math.round((u.healing || 0) / cnt)} | ${((u.kills || 0) / cnt).toFixed(2)} | ${((u.deaths || 0) / cnt).toFixed(2)} | ${surv.toFixed(1)} | ${d10} | ${t10} |`
    );
  }
  L.push("");

  L.push(`## 技能场均统计 (v2.13 Step2: 拆释放与命中)`);
  L.push("");
  L.push(
    `> 命中率 = 命中数 ÷ 期望命中数 | 单次均伤 = 总伤 ÷ 释放次数 | 10s频率 = 存活归一化释放频率`
  );
  L.push("");
  L.push(
    `| 角色 | 技能 | 释放/场 | 被打断/场 | 命中率% | 场均命中 | 总伤 | 单次均伤 | 10s频率 |`
  );
  L.push(`|------|------|:---:|:---:|:---:|:---:|------|:---:|:---:|`);
  // v2.32 修复: 只显示伤害型技能 (总伤>0), 排除治愈/鼓舞/潜行等辅助技能
  const skillEntries = Object.entries(skillAgg)
    .filter(
      ([, s]) => (s.skillName || "") !== "平砍" && (s.totalDamage || 0) > 0
    )
    .sort((x, y) => (y[1].totalDamage || 0) - (x[1].totalDamage || 0));
  for (const [k, s] of skillEntries.slice(0, 25)) {
    const casts = s.casts || 0;
    const hits = s.hits || 0;
    const expHits = s.expectedHits || casts;
    const hitRate =
      casts > 0 ? Math.round((hits / Math.max(1, expHits)) * 100) : 0;
    const avgHit = casts > 0 ? (hits / casts).toFixed(1) : "0";
    const avgDmg = casts > 0 ? Math.round((s.totalDamage || 0) / casts) : 0;
    L.push(
      `| ${s.ownerName} | ${s.skillName} | ${(casts / totalBattles).toFixed(1)} | ${((s.interrupts || 0) / totalBattles).toFixed(2)} | ${hitRate}% | ${avgHit} | ${Math.round((s.totalDamage || 0) / totalBattles)} | ${avgDmg} | - |`
    );
  }
  L.push("");

  // v2.10 天赋场均统计 (v3.0 规范: 按类型分表)
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
  const talentOfType = (vt: string) =>
    talentEntries.filter(([, t]) => t.valueType === vt);
  const fmtTalent = (t: any) => {
    const isCount = t.valueType === "count";
    const val = isCount
      ? (t.value / totalBattles).toFixed(1)
      : Math.round(t.value / totalBattles);
    return `| ${t.ownerName} | ${t.talentName} | ${(t.triggers / totalBattles).toFixed(1)} | ${val} | ${VT_CN[t.valueType] || t.valueType} |`;
  };

  L.push(`## 天赋场均统计 · 伤害类 (v3.0 规范分表)`);
  L.push("");
  L.push(`| 角色 | 天赋 | 触发/场 | 贡献伤害/场 | 类型 |`);
  L.push(`|------|------|:---:|------|------|`);
  const dmgTalents = talentOfType("damage");
  for (const [k, t] of dmgTalents) L.push(fmtTalent(t));
  if (dmgTalents.length === 0) L.push(`| - | (无) | - | - | - |`);
  L.push("");

  L.push(`## 天赋场均统计 · 增益/控制类`);
  L.push("");
  L.push(
    `> buff 口径: 攻击力点·秒 (Δ攻击点数 × 持续时间) | control: 控制总时长s | 各类型同口径可横向比较`
  );
  L.push("");
  L.push(`| 角色 | 天赋 | 触发/场 | 贡献量/场 | 类型 |`);
  L.push(`|------|------|:---:|------|------|`);
  const buffTalents = [...talentOfType("buff"), ...talentOfType("control")];
  for (const [k, t] of buffTalents) L.push(fmtTalent(t));
  if (buffTalents.length === 0) L.push(`| - | (无) | - | - | - |`);
  L.push("");

  L.push(`## 天赋场均统计 · 治疗/次数类`);
  L.push("");
  L.push(`| 角色 | 天赋 | 触发/场 | 贡献量/场 | 类型 |`);
  L.push(`|------|------|:---:|------|------|`);
  const healTalents = [...talentOfType("heal"), ...talentOfType("count")];
  for (const [k, t] of healTalents) L.push(fmtTalent(t));
  if (healTalents.length === 0) L.push(`| - | (无) | - | - | - |`);
  L.push("");

  // 战斗log样例: 胜/败各一场 (v2.13 Step3)
  const fmtLog = (log: { t: number; text: string }[]) =>
    log
      .slice(0, 30)
      .map((e) => `[${e.t.toFixed(1)}s] ${e.text}`)
      .join("\n");
  L.push(`## 战斗log · ${mainCN}胜场 (vs ${RACE_CN[opponents[0]]}, 前30s)`);
  L.push("");
  L.push("```");
  L.push(fmtLog(winLog));
  L.push("```");
  L.push("");
  L.push(`## 战斗log · ${mainCN}败场 (vs ${RACE_CN[opponents[0]]}, 前30s)`);
  L.push("");
  L.push("```");
  L.push(fmtLog(loseLog));
  L.push("```");
  L.push("");

  const filePath = path.join(reportDir, `${mainRace}_${ts}.md`);
  fs.writeFileSync(filePath, L.join("\n"), "utf-8");
  console.log(`\n📄 报告已保存: ${filePath}`);

  // 控制台输出 log 摘要
  console.log("\n=== 兽族 vs 亡灵 战斗log (前25s) ===");
  for (const e of sampleLog.slice(0, 40))
    console.log(`[${e.t.toFixed(1)}s] ${e.text.slice(0, 80)}`);
}

main();
