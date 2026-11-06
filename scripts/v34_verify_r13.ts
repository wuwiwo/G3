/**
 * V3.4 R13~R17 功能级验证（2026-11-06 用户直发 5 角色）
 *
 * 三层验证：
 *   Part A 数据层：CHARACTER_MAP 中 talent / description / cooldown / heal.atkRatio
 *   Part B 机制层：定向对局。对 castTime>0 的角色每 tick 强制 cooldownRemaining=0，
 *                 密集触发技能；从 battleLog / statuses / 内部字段采样断言。
 *                 castTime=0 的角色（xjl_link / sq_heal）不强制，避免每 tick 重复发动导致
 *                 skillPower/lifeSteal 无限叠加，改为自然冷却跑满时长。
 *   Part C 伤害层：calcDamage 单元验证新增减伤确实进入 otherReduction 有效链
 *                 （比值法 afterOtherReduction / afterFrontRow，规避暴击/格挡随机）。
 *
 * 用法：
 *   npx esbuild scripts/v34_verify_r13.ts --bundle --platform=node --format=cjs --outfile=scripts/v34_verify_r13.cjs
 *   node scripts/v34_verify_r13.cjs
 */
import { initBattle, processTick } from "../src/engine/battle";
import { calcDamage, setBattleClock } from "../src/engine/damage";
import { CHARACTER_MAP } from "../src/data/characters";
import { ROSTER } from "../src/lib/roleAnalysis";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  [PASS] ${name}${detail ? "  " + detail : ""}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  [FAIL] ${name}${detail ? "  " + detail : ""}`);
  }
}
function section(t: string) {
  console.log(`\n=== ${t} ===`);
}
const D = (id: string) => CHARACTER_MAP.get(id) as any;

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

type SampleFn = (s: any, extra: any[], pre: { dragonAlive: number }) => void;

/** 定向对局：镜像同族阵容，保证战斗时长；观察对象保持满血以持续触发机制。 */
function runScenario(
  race: string,
  charId: string,
  ticks: number,
  force: "every-tick" | "none",
  sample?: SampleFn
) {
  const state: any = initBattle(
    makeTeam(ROSTER[race]) as any,
    makeTeam(ROSTER[race]) as any
  );
  const target = () =>
    state.units.find((u: any) => u.def.id === charId && u.team === "ally");
  let elapsed = 0;
  while (state.phase === "fighting" && elapsed++ < ticks) {
    if (force === "every-tick") {
      for (const u of state.units) {
        if (u.def.id === charId && u.team === "ally" && !u.isDead)
          u.cooldownRemaining = 0;
      }
    }
    const before = state.battleLog.length;
    // updateStatuses 在 tick 开头按「上一 tick 结束时的存活数」重算 _lyzTalentDrPct，
    // 故把 processTick 之前的存活龙族数传给 sample，保证断言口径与引擎一致。
    const pre = {
      dragonAlive: state.units.filter(
        (u: any) => !u.isDead && u.def.race === "dragon"
      ).length,
    };
    processTick(state);
    const extra = state.battleLog.slice(before);
    sample?.(state, extra, pre);
    const t = target();
    if (t && !t.isDead) t.currentHp = t.maxHp;
  }
  return { state, elapsed };
}

// ============================================================
// Part A · 数据层：CHARACTER_MAP 角色定义
// ============================================================
section("Part A · 数据层：CHARACTER_MAP 角色定义");
const lxgz = D("lxgz");
const xjl = D("xjl");
const wlgyz = D("wlgyz");
const lyz = D("lyz");
const sq = D("sq");

check(
  "R13 灵弦歌者 描述含「下次发动每秒治疗+50%、减伤效果+50%」",
  lxgz.skill.description.includes("下次发动每秒治疗+50%") &&
    lxgz.skill.description.includes("减伤效果+50%")
);
check(
  "R14 小精灵 天赋含「每秒恢复1.5%最大HP」「每2s最多4%」",
  xjl.talent.includes("每秒恢复1.5%最大HP") && xjl.talent.includes("每2s最多4%")
);
check(
  "R14 小精灵 技能含「天赋30%效果」「承担25%伤害」",
  xjl.skill.description.includes("天赋30%效果") &&
    xjl.skill.description.includes("承担25%伤害")
);
check(
  "R15 亡灵歌咏者 描述含「优先恢复前排2名」「冷却-60%」",
  wlgyz.skill.description.includes("优先恢复前排2名") &&
    wlgyz.skill.description.includes("冷却-60%")
);
check(
  "R16 龙吟者 冷却=9",
  lyz.skill.cooldown === 9,
  `实际 ${lyz.skill.cooldown}`
);
check(
  "R16 龙吟者 天赋含「5%伤害降低」「8%」且不再写「防御」",
  lyz.talent.includes("5%伤害降低") &&
    lyz.talent.includes("8%") &&
    !lyz.talent.includes("防御")
);
check(
  "R16 龙吟者 描述含「每3次后下次升级」「全体龙族」",
  lyz.skill.description.includes("每3次后下次升级") &&
    lyz.skill.description.includes("全体龙族")
);
check(
  "R17 圣骑士 冷却=11",
  sq.skill.cooldown === 11,
  `实际 ${sq.skill.cooldown}`
);
check(
  "R17 圣骑士 heal.atkRatio=2.1",
  sq.skill.heal?.atkRatio === 2.1,
  `实际 ${sq.skill.heal?.atkRatio}`
);
check("R17 圣骑士 描述含「×210%」", sq.skill.description.includes("×210%"));

// ============================================================
// R13 灵弦歌者 · 治愈琴音增强链
// ============================================================
section("R13 灵弦歌者 · 治愈琴音增强链（hunter 镜像，100s）");
const healMult13 = new Set<number>();
const drField13 = new Set<number>();
const r13 = runScenario("hunter", "lxgz", 1000, "every-tick", (s, extra) => {
  for (const u of s.units) {
    for (const st of u.statuses || []) {
      if (
        (st as any).type === "lxgz_heal_dot" &&
        (st as any).healMult !== undefined
      )
        healMult13.add((st as any).healMult);
    }
    if (
      (u as any)._lxgzDrUntil &&
      (u as any)._lxgzDrUntil > s.time &&
      (u as any)._lxgzDrPct !== undefined
    )
      drField13.add((u as any)._lxgzDrPct);
  }
});
const log13 = r13.state.battleLog.map((e: any) => e.text);
const heal13 = log13.filter((t: string) => t.includes("治愈琴音"));
const enhanced13 = heal13.filter((t: string) => t.includes("（增强）"));
const drPct13 = new Set<number>();
for (const t of heal13) {
  const m = /(\d+)%减伤/.exec(t);
  if (m) drPct13.add(Number(m[1]));
}
console.log(
  `  对局 ${r13.elapsed} ticks / 时长 ${r13.state.time.toFixed(1)}s / 发动 ${heal13.length} 次 / 增强 ${enhanced13.length} 次`
);
check("R13 治愈琴音至少发动 2 次", heal13.length >= 2, `实际 ${heal13.length}`);
check(
  "R13 出现增强发动日志「（增强）」",
  enhanced13.length >= 1,
  `实际 ${enhanced13.length}`
);
check(
  "R13 减伤百分比同时出现 15% 与 23%（22.5%→23）",
  drPct13.has(15) && drPct13.has(23),
  `实际 ${[...drPct13].join("/")}`
);
check(
  "R13 lxgz_heal_dot.healMult 同时出现 1 与 1.5",
  healMult13.has(1) && healMult13.has(1.5),
  `实际 ${[...healMult13].join("/")}`
);
check(
  "R13 _lxgzDrPct 同时出现 0.15 与 0.225",
  drField13.has(0.15) && drField13.has(0.225),
  `实际 ${[...drField13].join("/")}`
);

// ============================================================
// R14 小精灵 · 天赋回血 / 链接 / 承担
// ============================================================
section("R14 小精灵 · 天赋回血 / 链接 / 承担（mage 镜像，120s 自然冷却）");
let linkLogs14 = 0;
const linkFields14: any[] = [];
const regenCycles14 = new Set<number>();
const windowCaps14: { heal: number; cap: number }[] = [];
let xjlDmgReceived14 = 0;
let xjlHealReceived14 = 0;
const r14 = runScenario("mage", "xjl", 1200, "none", (s, extra) => {
  const xjlU = s.units.find(
    (u: any) => u.def.id === "xjl" && u.team === "ally"
  );
  for (const e of extra) {
    if (e.text.includes("🔗") && e.text.includes("链接")) linkLogs14++;
  }
  for (const u of s.units) {
    if (
      u.team === "ally" &&
      (u as any)._linkOwnerId &&
      (u as any)._linkUntil > s.time
    ) {
      linkFields14.push({
        sp: (u as any).skillPower,
        ls: (u as any).lifeSteal,
        until: (u as any)._linkUntil - s.time,
        owner: (u as any)._linkOwnerId === xjlU?.id,
      });
    }
  }
  if (xjlU) {
    if ((xjlU as any)._xjlRegenCycle !== undefined)
      regenCycles14.add((xjlU as any)._xjlRegenCycle);
    if ((xjlU as any)._xjlWindowHeal !== undefined)
      windowCaps14.push({
        heal: (xjlU as any)._xjlWindowHeal,
        cap: Math.floor(xjlU.maxHp * 0.04),
      });
    const st = s.stats?.find((x: any) => x.unitId === xjlU.id);
    if (st) {
      xjlDmgReceived14 = st.totalDamageReceived || 0;
      xjlHealReceived14 = st.totalHealingReceived || 0;
    }
  }
});
console.log(
  `  对局 ${r14.elapsed} ticks / 时长 ${r14.state.time.toFixed(1)}s / 链接日志 ${linkLogs14}`
);
check("R14 链接技能至少发动 1 次", linkLogs14 >= 1, `实际 ${linkLogs14}`);
check(
  "R14 被链接友方持有链接字段",
  linkFields14.length > 0,
  `采样 ${linkFields14.length}`
);
check(
  "R14 链接 8s / skillPower+0.3 / lifeSteal+0.3 / owner=小精灵",
  linkFields14.length > 0 &&
    linkFields14.every(
      (f) =>
        f.owner &&
        f.until > 0 &&
        f.until <= 8.01 &&
        f.sp >= 1.3 - 1e-6 &&
        f.ls >= 0.3 - 1e-6
    ),
  linkFields14.length
    ? `样本 sp=${linkFields14[0].sp.toFixed(2)} ls=${linkFields14[0].ls.toFixed(2)} until=${linkFields14[0].until.toFixed(2)}`
    : ""
);
check(
  "R14 每秒 1.5% 回血逻辑执行（_xjlRegenCycle 变化）",
  regenCycles14.size >= 3,
  `不同秒数 ${regenCycles14.size}`
);
check(
  "R14 技能伤害回血窗口累计不超过 4% 上限",
  windowCaps14.length > 0 && windowCaps14.every((w) => w.heal <= w.cap),
  `采样 ${windowCaps14.length}`
);
check(
  "R14 小精灵确实承担伤害（totalDamageReceived > 0）",
  xjlDmgReceived14 > 0,
  `累计 ${xjlDmgReceived14}`
);
check(
  "R14 小精灵有治疗入账（回血链路通）",
  xjlHealReceived14 > 0,
  `累计 ${Math.round(xjlHealReceived14)}`
);

// ============================================================
// R15 亡灵歌咏者 · 前排优先 / 每 2 次后 CD-60%
// ============================================================
section("R15 亡灵歌咏者 · 前排优先 / 一次性 CD 倍率（undead 镜像，100s）");
let prevCast15 = 0;
let frontHits15 = 0;
let totalHits15 = 0;
const cdSamples15: number[] = [];
const r15 = runScenario("undead", "wlgyz", 1000, "every-tick", (s) => {
  const w = s.units.find((u: any) => u.def.id === "wlgyz" && u.team === "ally");
  if (!w) return;
  const cnt = (w as any)._wlgyzCastCount || 0;
  if (cnt > prevCast15) {
    prevCast15 = cnt;
    if (cnt % 3 === 0 && !w.isDead) cdSamples15.push(w.cooldownRemaining);
    // 本 tick 发动了死亡颂歌：用 lastAction.targetName 精确取治疗目标
    const la = (w as any).lastAction;
    if (la && Math.abs(la.time - s.time) < 1e-6 && la.targetName) {
      for (const n of String(la.targetName).split(",")) {
        const u = s.units.find(
          (x: any) => x.def.name === n && x.team === "ally"
        );
        if (u) {
          totalHits15++;
          if (u.row === 0) frontHits15++;
        }
      }
    }
  }
});
console.log(
  `  对局 ${r15.elapsed} ticks / 时长 ${r15.state.time.toFixed(1)}s / 发动 ${prevCast15} 次 / 治疗目标 ${totalHits15}`
);
check("R15 死亡颂歌至少发动 3 次", prevCast15 >= 3, `实际 ${prevCast15}`);
check(
  "R15 治疗目标优先前排（前排占比 >= 80%）",
  totalHits15 > 0 && frontHits15 / totalHits15 >= 0.8,
  `前排 ${frontHits15}/${totalHits15}`
);
check(
  "R15 每 2 次后下次发动冷却 -60%（cooldownRemaining≈3.2）",
  cdSamples15.some((v) => Math.abs(v - 3.2) < 0.5),
  `样本 ${cdSamples15
    .slice(0, 6)
    .map((v) => v.toFixed(2))
    .join("/")}`
);

// ============================================================
// R16 龙吟者 · 每龙 5% 伤害降低 / 阵亡回血 / 升级全体龙族
// ============================================================
section("R16 龙吟者 · 动态减伤 / 阵亡回血 / 升级全体龙族（dragon 镜像，120s）");
const drPairs16: { n: number; pct: number }[] = [];
let upgradeLogs16 = 0;
const upgradeTargets16: number[] = [];
let dragonDeathHeal16 = 0;
const r16 = runScenario(
  "dragon",
  "lyz",
  1200,
  "every-tick",
  (s, extra, pre) => {
    const lyzU = s.units.find(
      (u: any) => u.def.id === "lyz" && u.team === "ally"
    );
    if (lyzU && (lyzU as any)._lyzTalentDrPct !== undefined) {
      drPairs16.push({
        n: pre.dragonAlive,
        pct: (lyzU as any)._lyzTalentDrPct,
      });
    }
    for (const e of extra) {
      if (e.text.includes("龙吟恢复")) dragonDeathHeal16++;
      if (e.text.includes("[升级·全体龙族]")) upgradeLogs16++;
    }
    if (extra.some((e) => e.text.includes("[升级·全体龙族]"))) {
      upgradeTargets16.push(
        extra.filter(
          (e) => e.text.startsWith("🎵 ") && e.text.includes("[升级·全体龙族]")
        ).length
      );
    }
  }
);
console.log(
  `  对局 ${r16.elapsed} ticks / 时长 ${r16.state.time.toFixed(1)}s / 减伤采样 ${drPairs16.length} / 升级 ${upgradeLogs16} / 阵亡回血日志 ${dragonDeathHeal16}`
);
check(
  "R16 _lyzTalentDrPct 有采样",
  drPairs16.length > 0,
  `采样 ${drPairs16.length}`
);
check(
  "R16 减伤值 = min(0.8, 全场存活龙族数 × 0.05)",
  drPairs16.length > 0 &&
    drPairs16.every((p) => Math.abs(p.pct - Math.min(0.8, p.n * 0.05)) < 1e-6),
  drPairs16.length ? `样本 n=${drPairs16[0].n} pct=${drPairs16[0].pct}` : ""
);
check(
  "R16 升级那次日志出现「[升级·全体龙族]」",
  upgradeLogs16 >= 1,
  `实际 ${upgradeLogs16}`
);
check(
  "R16 升级那次对多名龙族生效",
  upgradeTargets16.length > 0 && upgradeTargets16.some((n) => n > 1),
  `目标数 ${upgradeTargets16.slice(0, 6).join("/")}`
);
check(
  "R16 龙族阵亡触发「龙吟恢复」日志",
  dragonDeathHeal16 >= 1,
  `实际 ${dragonDeathHeal16}`
);

// ============================================================
// R17 圣骑士 · 冷却 11s / 治疗量 攻击 ×210%
// ============================================================
section("R17 圣骑士 · 冷却 11s / 治疗量 攻击×210%（holy 镜像，120s 自然冷却）");
const sqSamples17: { heal: number; e1: number; e13: number }[] = [];
const r17 = runScenario("holy", "sq", 1200, "none", (s, extra) => {
  const sqU = s.units.find((u: any) => u.def.id === "sq" && u.team === "ally");
  for (const e of extra) {
    if (e.text.includes("圣光治愈") && sqU) {
      const m = /\+\s*(\d+)/.exec(e.text);
      if (m) {
        const atk = sqU.currentAttack;
        sqSamples17.push({
          heal: Number(m[1]),
          e1: Math.floor(atk * 2.1),
          e13: Math.floor(atk * 2.1 * 1.3),
        });
      }
    }
  }
});
console.log(
  `  对局 ${r17.elapsed} ticks / 时长 ${r17.state.time.toFixed(1)}s / 圣光治愈 ${sqSamples17.length} 次`
);
check(
  "R17 圣光治愈至少发动 1 次",
  sqSamples17.length >= 1,
  `实际 ${sqSamples17.length}`
);
check(
  "R17 治疗量 = 攻击×2.1（或驱散 ×1.3）",
  sqSamples17.length > 0 &&
    sqSamples17.every(
      (s) => Math.abs(s.heal - s.e1) <= 2 || Math.abs(s.heal - s.e13) <= 2
    ),
  sqSamples17.length
    ? `样本 heal=${sqSamples17[0].heal} e1=${sqSamples17[0].e1} e13=${sqSamples17[0].e13}`
    : ""
);

// ============================================================
// Part C · 伤害层：新增减伤进入 otherReduction 有效链
// ============================================================
section("Part C · 伤害层：新增减伤进入 otherReduction 有效链");
const sC: any = initBattle(
  makeTeam(ROSTER.dragon) as any,
  makeTeam(ROSTER.holy) as any
);
setBattleClock(10);
const atkC = sC.units.find((u: any) => u.team === "enemy" && !u.isDead);
const defC = sC.units.find((u: any) => u.team === "ally" && !u.isDead);
const ratioC = () => {
  const r: any = calcDamage(atkC, defC, 1.0, "physical" as any, {} as any);
  return r.afterFrontRow > 0 ? r.afterOtherReduction / r.afterFrontRow : NaN;
};
const baseC = ratioC();
(defC as any)._lxgzDrUntil = 20;
(defC as any)._lxgzDrPct = 0.15;
const r15C = ratioC();
(defC as any)._lxgzDrPct = 0.225;
const r225C = ratioC();
delete (defC as any)._lxgzDrUntil;
delete (defC as any)._lxgzDrPct;
(defC as any)._lyzTalentDrPct = 0.3;
const rLyzC = ratioC();
delete (defC as any)._lyzTalentDrPct;
console.log(
  `  base=${baseC.toFixed(4)}  15%→${(r15C / baseC).toFixed(4)}  22.5%→${(r225C / baseC).toFixed(4)}  龙族30%→${(rLyzC / baseC).toFixed(4)}`
);
check(
  "R13 治愈琴音 15% 减伤生效（相对比值≈0.85）",
  Math.abs(r15C / baseC - 0.85) < 0.02,
  `实测 ${(r15C / baseC).toFixed(4)}`
);
check(
  "R13 增强发动 22.5% 减伤生效（相对比值≈0.775）",
  Math.abs(r225C / baseC - 0.775) < 0.02,
  `实测 ${(r225C / baseC).toFixed(4)}`
);
check(
  "R16 龙族 30% 伤害降低生效（相对比值≈0.70）",
  Math.abs(rLyzC / baseC - 0.7) < 0.02,
  `实测 ${(rLyzC / baseC).toFixed(4)}`
);

// ============================================================
// 汇总
// ============================================================
console.log("\n============================================================");
console.log(`R13~R17 功能验证: ${pass} passed / ${fail} failed`);
if (fail > 0) {
  console.log("失败项:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log("VERIFY_FAILED");
  process.exitCode = 1;
} else {
  console.log("VERIFY_OK");
}
