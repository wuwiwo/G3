// 阵容统计汇总 v2: 角色统计 + 技能效率（总伤害 vs 单目标伤害）
import { initBattle, processTick } from "../src/engine/battle";
import type { BattleState } from "../src/types";

const RACES = ["beast", "undead", "dragon", "mage", "hunter", "warrior", "holy"];
const RACE_CN: Record<string, string> = {
  beast: "兽族", undead: "亡灵", dragon: "龙族", mage: "法师",
  hunter: "猎人", warrior: "战士", holy: "圣职者",
};
const ROSTER: Record<string, string[]> = {
  // v3.0: 删洞狮(ds)→补彭彭猪(pp); 删陷阱猎人(xjlr)→补冰霜猎人(bslr); 删暗影噬龙(aysl)→补星辰龙(xcl)
  // v3.10: 彭彭猪(15460最肉)前排, 嚎叫巨牛中排
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"], // v3.8: 追风中排(脆皮输出)
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"], // v3.0: 暗影→星辰
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"], // v3.8: 3坦克前排(圣骑士/圣裁者/殉道者)
};

function makeTeam(ids: string[]): { charId: string; row: number; col: number }[] {
  const positions = [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1],
  ];
  return ids.slice(0, 8).map((cid, i) => ({
    charId: cid, row: positions[i][0], col: positions[i][1],
  }));
}

function runOneDetailed(ally: string[], enemy: string[]) {
  const state = initBattle(makeTeam(ally) as any, makeTeam(enemy) as any) as unknown as BattleState;
  let safety = 0;
  while (state.phase === "fighting" && safety < 5000) {
    processTick(state as any);
    safety++;
  }
  return {
    winner: state.winner || "enemy",
    stats: (state as any).stats || [],
    skillStats: (state as any).skillStats || {},
  };
}

async function main() {
  const runs = parseInt(process.argv[2] || "50");
  const agg: Record<string, Record<string, any>> = {};
  const skillAgg: Record<string, Record<string, any>> = {};
  const idToName: Record<string, string> = {};

  for (const a of RACES) {
    agg[a] = {};
    skillAgg[a] = {};
    for (let j = 0; j < RACES.length; j++) {
      const b = RACES[j];
      for (let k = 0; k < runs; k++) {
        const d = runOneDetailed(ROSTER[a], ROSTER[b]);
        for (const s of d.stats) {
          if (s.team !== "ally") continue;
          const name = s.name;
          if (!agg[a][name]) agg[a][name] = { count: 0, dmg: 0, phys: 0, mag: 0, pure: 0, heal: 0, taken: 0, kills: 0, deaths: 0, skill: 0, crits: 0, blocks: 0 };
          const u = agg[a][name];
          u.count++;
          u.dmg += s.totalDamageDealt || 0;
          u.phys += s.physicalDamage || 0;
          u.mag += s.magicalDamage || 0;
          u.pure += s.pureDamage || 0;
          u.heal += s.totalHealingDone || 0;
          u.taken += s.totalDamageReceived || 0;
          u.kills += s.kills || 0;
          u.deaths += s.deaths || 0;
          u.skill += s.skillCasts || 0;
          u.crits += s.critCount || 0;
          u.blocks += s.blockCount || 0;
          if (s.unitId && s.name) idToName[s.unitId] = s.name;
        }
        // 技能统计（本方角色）
        for (const [skey, sv] of Object.entries(d.skillStats)) {
          const ss = sv as any;
          const ownerName = idToName[ss.ownerId] || "?";
          // 只统计本方（ownerId 是 ally 单位）
          const ownerUnit = (d.stats as any[]).find((x: any) => x.unitId === ss.ownerId);
          if (!ownerUnit || ownerUnit.team !== "ally") continue;
          const aggKey = `${ownerName}_${ss.skillName}`;
          if (!skillAgg[a][aggKey]) skillAgg[a][aggKey] = { casts: 0, totalDamage: 0, hits: 0, expectedHits: 0, ownerName };
          const agg2 = skillAgg[a][aggKey];
          agg2.casts += ss.casts || 0;
          agg2.totalDamage += ss.totalDamage || 0;
          agg2.hits += ss.hits || 0;
          agg2.expectedHits += ss.expectedHits || 0;
          agg2.skillName = ss.skillName;
        }
      }
    }
  }
  const gamesPerUnit = runs * RACES.length;
  console.log(`阵容统计 v2 (每角色场均, ${runs}局×${RACES.length}对阵 = ${gamesPerUnit}局)`);
  console.log("=".repeat(112));
  for (const a of RACES) {
    const entries = Object.entries(agg[a]).sort((x, y) => y[1].dmg - x[1].dmg);
    const teamDmg = entries.reduce((s, [, v]) => s + v.dmg, 0) / gamesPerUnit;
    const teamTaken = entries.reduce((s, [, v]) => s + v.taken, 0) / gamesPerUnit;
    const teamHeal = entries.reduce((s, [, v]) => s + v.heal, 0) / gamesPerUnit;
    const teamKills = entries.reduce((s, [, v]) => s + v.kills, 0) / gamesPerUnit;
    console.log(`\n【${RACE_CN[a]}】 总伤害 ${Math.round(teamDmg).toLocaleString()} | 承伤 ${Math.round(teamTaken).toLocaleString()} | 治疗 ${Math.round(teamHeal).toLocaleString()} | 击杀 ${teamKills.toFixed(1)}`);
    console.log("-".repeat(112));
    console.log("角色".padEnd(7) + "总伤".padStart(9) + "物".padStart(7) + "魔".padStart(7) + "纯".padStart(7) + "承伤".padStart(8) + "治疗".padStart(8) + "杀".padStart(4) + "死".padStart(4) + "技能".padStart(5) + "暴".padStart(4) + "挡".padStart(4));
    for (const [name, v] of entries) {
      console.log(
        name.padEnd(7) +
        Math.round(v.dmg / v.count).toLocaleString().padStart(9) +
        Math.round(v.phys / v.count).toLocaleString().padStart(7) +
        Math.round(v.mag / v.count).toLocaleString().padStart(7) +
        Math.round(v.pure / v.count).toLocaleString().padStart(7) +
        Math.round(v.taken / v.count).toLocaleString().padStart(8) +
        Math.round(v.heal / v.count).toLocaleString().padStart(8) +
        (v.kills / v.count).toFixed(1).padStart(4) +
        (v.deaths / v.count).toFixed(1).padStart(4) +
        (v.skill / v.count).toFixed(1).padStart(5) +
        (v.crits / v.count).toFixed(1).padStart(4) +
        (v.blocks / v.count).toFixed(1).padStart(4)
      );
    }
    // 技能效率表
    const skEntries = Object.entries(skillAgg[a])
      .map(([k, v]) => ({ key: k, ...v }))
      .sort((x, y) => (y.totalDamage / y.casts) - (x.totalDamage / x.casts));
    if (skEntries.length > 0) {
      console.log("\n  ── 技能效率 (总伤害 vs 单目标伤害) ──");
      console.log("  技能".padEnd(26) + "施放".padStart(5) + "场均总伤".padStart(9) + "每施放总伤".padStart(10) + "每目标伤".padStart(9) + "均目标".padStart(6) + "类型".padStart(5));
      for (const e of skEntries) {
        if (e.casts <= 0 || e.skillName === "平砍") continue; // 过滤普攻条目
        const perCast = Math.round(e.totalDamage / Math.max(1, e.casts));
        const avgTargets = e.expectedHits / Math.max(1, e.casts); // 平均目标数（施放时一次累计）
        const perTarget = Math.round(perCast / Math.max(0.5, avgTargets)); // 每目标伤害
        const type = avgTargets >= 2.5 ? "AOE" : avgTargets >= 1.5 ? "多目标" : avgTargets > 0.5 ? "单体" : "?";
        console.log(
          `  ${e.ownerName}·${e.skillName}`.padEnd(26) +
          e.casts.toFixed(1).padStart(5) +
          Math.round(e.totalDamage / 350).toLocaleString().padStart(9) +
          perCast.toLocaleString().padStart(10) +
          perTarget.toLocaleString().padStart(9) +
          avgTargets.toFixed(1).padStart(6) +
          type.padStart(5)
        );
      }
    }
  }
}

main();
