/**
 * 技能收益分析 - 分解每个角色的普攻/技能/治疗实际贡献
 * 用法: node scripts/skillProfit.cjs [种族] [场次]
 * 种族: beast/hunter/warrior/mage/undead/dragon/all
 */
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
  beast: "兽族", hunter: "猎人", warrior: "战士",
  mage: "法师", undead: "亡灵", dragon: "龙族",
};

const RACES = ["beast", "undead", "dragon", "mage", "hunter", "warrior"];

function makeTeam(ids: string[]): { charId: string; row: number; col: number }[] {
  const positions = [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]];
  return ids.slice(0, 8).map((cid, i) => ({ charId: cid, row: positions[i][0], col: positions[i][1] }));
}

function runDetailed(ally: string[], enemy: string[]) {
  const state = initBattle(makeTeam(ally) as any, makeTeam(enemy) as any) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  return {
    winner: state.winner || "enemy",
    duration: state.time,
    stats: (state as any).stats || [],
    skillStats: (state as any).skillStats || {},
  };
}

interface SkillAgg { casts: number; totalDamage: number; physDmg: number; magDmg: number; pureDmg: number; }
interface CharAgg {
  count: number;
  aaCasts: number; aaDmg: number; aaPhys: number; aaMag: number; aaPure: number;
  skills: Record<string, SkillAgg>;
  healTotal: number; lifeStealTotal: number;
  dmgDealt: number; dmgTaken: number; kills: number; deaths: number;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || "beast";
  const runs = args.length > 1 ? parseInt(args[1]) || 100 : 100;
  const races = target === "all" ? RACES : [target];

  console.log(`技能收益分析: ${races.map(r => RACE_CN[r]).join("/")} (每场 ${runs} 局)`);

  const agg: Record<string, CharAgg> = {};
  const meta: Record<string, { name: string; race: string }> = {};
  const idToName: Record<string, string> = {};
  let totalBattles = 0;

  const accumulate = (d: ReturnType<typeof runDetailed>) => {
    totalBattles++;
    for (const s of d.stats) {
      const key = s.name || s.unitId;
      if (!agg[key]) agg[key] = { count: 0, aaCasts: 0, aaDmg: 0, aaPhys: 0, aaMag: 0, aaPure: 0, skills: {}, healTotal: 0, lifeStealTotal: 0, dmgDealt: 0, dmgTaken: 0, kills: 0, deaths: 0 };
      const c = agg[key];
      c.count++;
      c.dmgDealt += s.totalDamageDealt || 0;
      c.dmgTaken += s.totalDamageReceived || 0;
      c.healTotal += (s.totalHealingDone || 0) - (s.lifeStealHealing || 0);
      c.lifeStealTotal += s.lifeStealHealing || 0;
      c.kills += s.kills || 0;
      c.deaths += s.deaths || 0;
      if (!meta[key] && s.name) meta[key] = { name: s.name, race: s.race };
      if (s.unitId && s.name) idToName[s.unitId] = s.name;
    }
    for (const [skey, sv] of Object.entries(d.skillStats)) {
      const ss = sv as any;
      const ownerName = idToName[ss.ownerId] || "?";
      if (!agg[ownerName]) agg[ownerName] = { count: 0, aaCasts: 0, aaDmg: 0, aaPhys: 0, aaMag: 0, aaPure: 0, skills: {}, healTotal: 0, lifeStealTotal: 0, dmgDealt: 0, dmgTaken: 0, kills: 0, deaths: 0 };
      const c = agg[ownerName];
      const sname = ss.skillName || "?";
      if (sname === "平砍") {
        c.aaCasts += ss.casts || 0;
        c.aaDmg += ss.totalDamage || 0;
        c.aaPhys += ss.physDmg || 0;
        c.aaMag += ss.magDmg || 0;
        c.aaPure += ss.pureDmg || 0;
      } else {
        if (!c.skills[sname]) c.skills[sname] = { casts: 0, totalDamage: 0, physDmg: 0, magDmg: 0, pureDmg: 0 };
        const sk = c.skills[sname];
        sk.casts += ss.casts || 0;
        sk.totalDamage += ss.totalDamage || 0;
        sk.physDmg += ss.physDmg || 0;
        sk.magDmg += ss.magDmg || 0;
        sk.pureDmg += ss.pureDmg || 0;
      }
    }
  };

  // 跑所有相关对局
  const oppRaces = RACES.filter(r => !races.includes(r));
  for (const a of races) {
    // 镜像
    for (let k = 0; k < runs; k++) accumulate(runDetailed(ROSTER[a], ROSTER[a]));
    // vs 其他
    for (const b of oppRaces) {
      for (let k = 0; k < runs; k++) accumulate(runDetailed(ROSTER[a], ROSTER[b]));
    }
  }

  // ===== 输出报告 =====
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const reportDir = path.join(__dirname, "..", "..", "docs", "data", "character_data", "skill_profit");
  fs.mkdirSync(reportDir, { recursive: true });

  const raceCN: Record<string, string> = { beast: "兽", hunter: "猎", warrior: "战", mage: "法", undead: "亡", dragon: "龙" };
  const L: string[] = [];
  L.push(`# 技能收益分析报告`);
  L.push("");
  L.push(`> 生成时间: ${now.toLocaleString("zh-CN")}`);
  L.push(`> 目标: ${races.map(r => RACE_CN[r]).join("/")} | 每场 ${runs} 局 | 共 ${totalBattles} 场`);
  L.push(`> 数据: 普攻/技能次数与伤害、治疗量、击杀、承伤（场均）`);
  L.push("");

  // 按输出排序遍历角色
  const charEntries = Object.entries(agg).sort((x, y) => (y[1].dmgDealt || 0) - (x[1].dmgDealt || 0));
  const targetNames = new Set<string>();
  for (const a of races) {
    for (const cid of ROSTER[a]) {
      // 需要名字映射: 简化 - 用 meta 里所有属于目标种族的
    }
  }

  for (const [name, c] of charEntries) {
    const cnt = c.count || 1;
    const metaInfo = meta[name];
    const isTarget = metaInfo && races.includes(metaInfo.race);
    if (!isTarget) continue;

    const aaDmg = c.aaDmg / cnt;
    const skillDmg = c.dmgDealt / cnt - aaDmg;
    const heal = c.healTotal / cnt;
    const ls = c.lifeStealTotal / cnt;
    const dmgTaken = c.dmgTaken / cnt;

    L.push(`## ${name}（${raceCN[metaInfo.race]}）`);
    L.push("");
    L.push(`| 项目 | 场均 | 占输出 |`);
    L.push(`|------|:---:|:---:|`);
    L.push(`| 总输出 | **${Math.round(c.dmgDealt / cnt)}** | 100% |`);
    L.push(`| 普攻 | ${Math.round(aaDmg)}（${(c.aaCasts / cnt).toFixed(1)}次） | ${(aaDmg / (c.dmgDealt / cnt) * 100).toFixed(1)}% |`);
    // 治疗技能行
    if (heal > 50) {
      L.push(`| 【治疗技能】 | ${Math.round(heal)} | — |`);
    }
    // 技能明细
    const skillList = Object.entries(c.skills).sort((x, y) => (y[1].totalDamage || 0) - (x[1].totalDamage || 0));
    let skillTotalPct = 0;
    let trackedSkillDmg = 0;
    for (const [sname, sk] of skillList) {
      const sdmg = (sk.totalDamage || 0) / cnt;
      trackedSkillDmg += sdmg;
      const pct = sdmg / (c.dmgDealt / cnt) * 100;
      skillTotalPct += pct;
      const types: string[] = [];
      if (sk.physDmg > 0) types.push(`物${Math.round(sk.physDmg / cnt)}`);
      if (sk.magDmg > 0) types.push(`魔${Math.round(sk.magDmg / cnt)}`);
      if (sk.pureDmg > 0) types.push(`纯${Math.round(sk.pureDmg / cnt)}`);
      L.push(`| 【${sname}】 | ${Math.round(sdmg)}（${((sk.casts || 0) / cnt).toFixed(1)}次） | ${pct.toFixed(1)}% |`);
    }
    L.push(`| 技能合计 | ${Math.round(skillDmg)} | ${skillTotalPct.toFixed(1)}% |`);
    // 未track的差额 = 羁绊附加伤害 (如兽族低血纯伤)
    const untracked = skillDmg - trackedSkillDmg;
    if (untracked > 50) {
      L.push(`| ⚠ 羁绊附加伤害（低血纯伤等，未计入技能/普攻） | ${Math.round(untracked)} | ${(untracked / (c.dmgDealt / cnt) * 100).toFixed(1)}% |`);
    }
    L.push("");
    L.push(`| 项目 | 场均 |`);
    L.push(`|------|:---:|`);
    L.push(`| 治疗（技能） | ${Math.round(heal)} |`);
    if (ls > 0) L.push(`| 吸血 | ${Math.round(ls)} |`);
    L.push(`| 承伤 | ${Math.round(dmgTaken)} |`);
    L.push(`| 击杀 | ${(c.kills / cnt).toFixed(2)} |`);
    L.push(`| 死亡 | ${(c.deaths / cnt).toFixed(2)} |`);
    L.push("");
    // 输出结构柱状图
    const totalD = c.dmgDealt / cnt || 1;
    const aaBar = "█".repeat(Math.round(aaDmg / totalD * 20));
    L.push(`输出结构: 普攻${(aaDmg / totalD * 100).toFixed(0)}% ${aaBar} | 技能${(skillDmg / totalD * 100).toFixed(0)}% ${"█".repeat(Math.round(skillDmg / totalD * 20))}`);
    L.push("");
    L.push("---");
    L.push("");
  }

  const filePath = path.join(reportDir, `profit_${target}_${ts}.md`);
  fs.writeFileSync(filePath, L.join("\n"), "utf-8");
  console.log(`\n📄 收益分析已保存: ${filePath}`);

  // 控制台摘要
  console.log("\n=== 输出结构摘要 ===");
  for (const [name, c] of charEntries) {
    const metaInfo = meta[name];
    if (!metaInfo || !races.includes(metaInfo.race)) continue;
    const cnt = c.count || 1;
    const aaDmg = c.aaDmg / cnt;
    const totalD = c.dmgDealt / cnt;
    const aaPct = (aaDmg / totalD * 100).toFixed(0);
    const skillDmg = totalD - aaDmg;
    const heal = c.healTotal / cnt;
    console.log(`${name.padEnd(5)} 输出${Math.round(totalD).toString().padStart(6)} 普攻${aaPct}% 技能${(100 - Number(aaPct)).toString().padStart(3)}% 治疗${Math.round(heal).toString().padStart(5)}`);
  }
}

main();
