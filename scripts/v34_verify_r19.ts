/**
 * V3.4 R19 功能级验证（2026-11-06 用户裁定 6 口径 + R18 三项）
 *
 * 三层验证：
 *   Part A 数据层：characters.ts / races.ts 的字段与羁绊文本
 *   Part B 机制层：定向对局 + 源码静态断言
 *                 - R19-1 灵弦歌者「普通 / 增强交替」
 *                 - R19-2 治愈琴音 DoT 25%+20% / 6s
 *                 - R19-4 链接改「小精灵天赋 30% 效果」、删除 lifeSteal 近似
 *                 - R19-6 链接到期回滚 skillPower / 天赋效果
 *                 - R19-11 猎人叠攻 20s
 *   Part C 伤害层：calcDamage 比值法验证 holyDr 减伤链已实装（含魔法分支）
 *
 * 用法：
 *   npx esbuild scripts/v34_verify_r19.ts --bundle --platform=node --format=cjs --outfile=scripts/v34_verify_r19.cjs
 *   node scripts/v34_verify_r19.cjs
 */
import * as fs from "fs";
import * as path from "path";
import { initBattle, processTick } from "../src/engine/battle";
import { calcDamage, setBattleClock } from "../src/engine/damage";
import { CHARACTER_MAP } from "../src/data/characters";
import { getBondAtTier } from "../src/data/races";
import { Race } from "../src/types";
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

/** 定向对局：镜像同族阵容；观察对象保持满血以持续触发机制。 */
function runScenario(
  race: string,
  charId: string,
  ticks: number,
  force: "every-tick" | "none",
  sample?: (s: any, extra: any[]) => void
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
    processTick(state);
    const extra = state.battleLog.slice(before);
    sample?.(state, extra);
    const t = target();
    if (t && !t.isDead) t.currentHp = t.maxHp;
  }
  return { state, elapsed };
}

const srcBattle = fs.readFileSync(
  path.join(process.cwd(), "src", "engine", "battle.ts"),
  "utf-8"
);

// ============================================================
// Part A · 数据层
// ============================================================
section("Part A · 数据层：characters.ts / races.ts");
const lxgz = D("lxgz");
const xjl = D("xjl");

check(
  "R19-2 灵弦歌者 heal.targetAtkRatio=0.2（补齐目标攻×20%）",
  lxgz.skill.heal?.targetAtkRatio === 0.2,
  `实际 ${lxgz.skill.heal?.targetAtkRatio}`
);
check(
  "R19-2 灵弦歌者描述含「每秒自身攻×25%+目标攻×20%」",
  lxgz.skill.description.includes("每秒自身攻×25%+目标攻×20%")
);
check(
  "R19-5/6 小精灵技能描述保持「天赋30%效果」「承担25%伤害」",
  xjl.skill.description.includes("天赋30%效果") &&
    xjl.skill.description.includes("承担25%伤害")
);

const b2 = getBondAtTier(Race.Hunter, 2) as any;
const b3 = getBondAtTier(Race.Hunter, 3) as any;
const b4 = getBondAtTier(Race.Hunter, 4) as any;
check(
  "R19 猎人 2 名 攻速+10 / 命中+10 未变",
  b2.attackSpeedBonus === 10 && b2.hitRateBonus === 10,
  `实际 ${b2.attackSpeedBonus}/${b2.hitRateBonus}`
);
check(
  "R19-9 猎人 3 名 special 含「30%伤害」且无「35%伤害」",
  (b3.special || "").includes("30%伤害") &&
    !(b3.special || "").includes("35%伤害"),
  b3.special
);
check(
  "R19 猎人 3 名 攻速+15 / 命中+20 未变",
  b3.attackSpeedBonus === 15 && b3.hitRateBonus === 20
);
check(
  "R19-10/11 猎人 4 名 special 含「20s」「60%伤害」且无「40s」「70%伤害」",
  (b4.special || "").includes("20s") &&
    (b4.special || "").includes("60%伤害") &&
    !(b4.special || "").includes("40s") &&
    !(b4.special || "").includes("70%伤害"),
  b4.special
);
check(
  "R19 猎人 4 名 攻速+30 / 命中+40 未变",
  b4.attackSpeedBonus === 30 && b4.hitRateBonus === 40
);

// ============================================================
// Part B · 机制层：R19-1 / R19-2 灵弦歌者
// ============================================================
section("Part B · R19-1/R19-2 灵弦歌者（hunter 镜像，80s）");
const casts: boolean[] = [];
const dotSamples: any[] = [];
let logTextOk = false;
// 敌方用 warrior（不含灵弦歌者），避免镜像对局里敌方同名日志混入增强链序列；
// ally 全员保持满血，保证每次发动都能找到 2 名治疗目标、序列不漏项。
const sL: any = initBattle(
  makeTeam(ROSTER.hunter) as any,
  makeTeam(ROSTER.warrior) as any
);
let elL = 0;
while (sL.phase === "fighting" && elL++ < 800) {
  const casterL = sL.units.find(
    (u: any) => u.def.id === "lxgz" && u.team === "ally" && !u.isDead
  );
  if (casterL) casterL.cooldownRemaining = 0;
  const before = sL.battleLog.length;
  processTick(sL);
  const extra = sL.battleLog.slice(before);
  const healLogs = extra.filter(
    (l: any) => typeof l.text === "string" && l.text.includes("治愈琴音")
  );
  if (healLogs.length) {
    casts.push(healLogs.some((l: any) => l.text.includes("（增强）")));
    if (healLogs.some((l: any) => l.text.includes("每秒25%+目标攻20%×6s")))
      logTextOk = true;
    const caster = sL.units.find(
      (u: any) => u.def.id === "lxgz" && u.team === "ally"
    );
    // 取【全场】remainingSeconds 最长的一条 = 本次刚施加的 DoT（6s）。
    // 旧写法只扫描「第一个带 DoT 的单位」，若本次发动的治疗目标变了，
    // 该单位身上的只有递减中的旧 DoT，会把 5.x 秒误采成新 DoT。
    let newest: any = null;
    let owner: any = null;
    for (const u of sL.units) {
      for (const d of (u.statuses || []).filter(
        (x: any) => (x.type as string) === "lxgz_heal_dot"
      )) {
        if (!newest || d.remainingSeconds > newest.remainingSeconds) {
          newest = d;
          owner = u;
        }
      }
    }
    if (newest) {
      dotSamples.push({
        value: newest.value,
        remaining: newest.remainingSeconds,
        mult: newest.healMult || 1,
        casterAtk: caster ? caster.currentAttack : 0,
        targetAtk: owner.currentAttack,
      });
    }
  }
  for (const u of sL.units)
    if (u.team === "ally" && !u.isDead) u.currentHp = u.maxHp;
}
console.log(
  `  对局 ${elL} ticks / 时长 ${sL.time.toFixed(1)}s / 发动 ${casts.length} 次 / DoT 采样 ${dotSamples.length} 条`
);
check("R19-1 治愈琴音至少发动 4 次", casts.length >= 4, `实际 ${casts.length}`);
check(
  "R19-1 增强链严格「普通/增强交替」",
  casts.length >= 4 && casts.every((v, i) => v === (i % 2 === 1)),
  `序列 ${casts
    .slice(0, 8)
    .map((v) => (v ? "增" : "普"))
    .join("")}`
);
check(
  "R19-2 DoT value≈施法者攻击×25%",
  dotSamples.length > 0 &&
    dotSamples.every(
      (d) => d.casterAtk > 0 && Math.abs(d.value / d.casterAtk - 0.25) < 0.01
    ),
  dotSamples.length
    ? `样本 value=${dotSamples[0].value} atk=${dotSamples[0].casterAtk.toFixed(0)}`
    : ""
);
check(
  "R19-2 DoT 持续 6s（每次发动新施加的 DoT 均为 6s）",
  dotSamples.length > 0 &&
    dotSamples.every((d) => Math.abs(d.remaining - 6) < 0.05),
  dotSamples.length
    ? `样本 n=${dotSamples.length} 首=${dotSamples[0].remaining} 最小=${Math.min(
        ...dotSamples.map((d) => d.remaining)
      )}`
    : ""
);
check(
  "R19-3 增强乘数仍为 1 / 1.5 交替",
  dotSamples.length >= 4 &&
    dotSamples.some((d) => Math.abs(d.mult - 1) < 0.001) &&
    dotSamples.some((d) => Math.abs(d.mult - 1.5) < 0.001),
  `样本 ${dotSamples
    .slice(0, 6)
    .map((d) => d.mult)
    .join("/")}`
);
check("R19-2 日志文案为「每秒25%+目标攻20%×6s」", logTextOk);

// ============================================================
// Part B · 机制层：R19-4 / R19-6 小精灵链接
// ============================================================
section("Part B · R19-4/R19-6 小精灵链接（mage 镜像，120s 自然冷却）");
const linked: any[] = [];
const expired: any[] = [];
let prevLinked = new Set<string>();
const rXjl = runScenario("mage", "xjl", 1200, "none", (s) => {
  const nowLinked = new Set<string>();
  for (const u of s.units) {
    if ((u as any)._linkUntil) {
      nowLinked.add(u.id);
      linked.push({
        share: (u as any)._xjlTalentShare,
        sp: u.skillPower,
        ls: u.lifeSteal || 0,
        hasRegenCycle: (u as any)._xjlRegenCycle !== undefined,
      });
    }
  }
  for (const id of prevLinked) {
    if (!nowLinked.has(id)) {
      const u = s.units.find((x: any) => x.id === id);
      if (u)
        expired.push({
          sp: u.skillPower,
          share: (u as any)._xjlTalentShare,
          ls: u.lifeSteal || 0,
          linkUntil: u._linkUntil,
        });
    }
  }
  prevLinked = nowLinked;
});
console.log(
  `  对局 ${rXjl.elapsed} ticks / 时长 ${rXjl.state.time.toFixed(1)}s / 链接采样 ${linked.length} / 到期样本 ${expired.length}`
);
check("R19-4 链接至少生效 1 次", linked.length > 0, `实际 ${linked.length}`);
check(
  "R19-4 被链接友方获得 _xjlTalentShare=0.3",
  linked.length > 0 && linked.every((x) => Math.abs(x.share - 0.3) < 0.001),
  linked.length ? `样本 share=${linked[0].share}` : ""
);
const spAnomalies = Array.from(
  new Set(
    linked.filter((x) => Math.abs(x.sp - 1.3) >= 0.001).map((x) => String(x.sp))
  )
);
check(
  "R19-5 被链接友方 skillPower=1.3（+30% 技能增强不变）",
  linked.length > 0 && linked.every((x) => Math.abs(x.sp - 1.3) < 0.001),
  linked.length
    ? `样本 n=${linked.length} 首 sp=${linked[0].sp} 异常值=[${spAnomalies.join(
        ","
      )}]`
    : ""
);
check(
  "R19-4 已删除 lifeSteal +0.3 近似（被链接方 lifeSteal≈0）",
  linked.length > 0 && linked.every((x) => x.ls < 0.001),
  linked.length ? `样本 ls=${linked[0].ls}` : ""
);
check(
  "R19-4 被链接方参与小精灵天赋每秒自回（_xjlRegenCycle 存在）",
  linked.some((x) => x.hasRegenCycle)
);
check("R19-6 捕获到链接到期样本", expired.length > 0, `实际 ${expired.length}`);
check(
  "R19-6 到期回滚 skillPower→1",
  expired.length > 0 && expired.every((x) => Math.abs(x.sp - 1) < 0.001),
  expired.length ? `样本 sp=${expired[0].sp}` : ""
);
check(
  "R19-6 到期清除 _xjlTalentShare",
  expired.length > 0 && expired.every((x) => x.share === undefined),
  expired.length ? `样本 share=${expired[0].share}` : ""
);
check(
  "R19-6 到期清除 _linkUntil / _linkOwnerId",
  expired.length > 0 && expired.every((x) => x.linkUntil === undefined)
);

// ============================================================
// Part B · 机制层：R19-9~11 猎人羁绊
// ============================================================
section("Part B · R19-9~11 猎人羁绊额外攻击 / 叠攻时长");
check(
  "R19-9/10 battle.ts extraDmgRatio = 0.6 / 0.3",
  srcBattle.includes("const extraDmgRatio = hunterCnt >= 4 ? 0.6 : 0.3;")
);
check(
  "R19-11 battle.ts 猎人叠攻 expire = 20s / 25s",
  srcBattle.includes("expire: state.time + (hunterCount2 >= 4 ? 20 : 25),")
);
const layerDeltas: number[] = [];
// 敌方用 beast（多 #切入 技能：虎啸/夜行狼人/猛犸象等），每 tick 强制敌方 CD=0
// 以密集触发「被 #切入 命中 → 猎人叠攻」；ally 全员满血保证 hunterCount>=4。
const sH: any = initBattle(
  makeTeam(ROSTER.hunter) as any,
  makeTeam(ROSTER.beast) as any
);
let elH = 0;
while (sH.phase === "fighting" && elH++ < 1200) {
  for (const u of sH.units)
    if (u.team === "enemy" && !u.isDead) u.cooldownRemaining = 0;
  processTick(sH);
  for (const u of sH.units) {
    if (u.team === "ally" && (u as any)._hunterBondLayers?.length) {
      for (const l of (u as any)._hunterBondLayers)
        layerDeltas.push(l.expire - sH.time);
    }
  }
  for (const u of sH.units)
    if (u.team === "ally" && !u.isDead) u.currentHp = u.maxHp;
}
const maxDelta = layerDeltas.length ? Math.max(...layerDeltas) : NaN;
console.log(
  `  对局 ${elH} ticks / 时长 ${sH.time.toFixed(1)}s / 叠攻采样 ${layerDeltas.length} / 最大剩余 ${maxDelta.toFixed(2)}s`
);
check(
  "R19-11 猎人叠攻施加时时长为 20s（非 40s）",
  layerDeltas.length > 0 && maxDelta > 19.5 && maxDelta <= 20.01,
  `实测 ${maxDelta.toFixed(2)}s`
);

// ============================================================
// Part C · 伤害层：holyDr 减伤链已实装
// ============================================================
section("Part C · 伤害层：holyDr 减伤进入 otherReduction 有效链");
const sC: any = initBattle(
  makeTeam(ROSTER.dragon) as any,
  makeTeam(ROSTER.holy) as any
);
setBattleClock(10);
const atkC = sC.units.find((u: any) => u.team === "enemy" && !u.isDead);
const defC: any = sC.units.find((u: any) => u.team === "ally" && !u.isDead);
const clearDef = () => {
  for (const k of [
    "_lyzDrUntil",
    "_lyzDr",
    "_qdDrUntil",
    "_qdDrPct",
    "_sqShieldUntil",
    "_xdBlessUntil",
    "_scDr",
    "_lxgzDrUntil",
    "_lxgzDrPct",
    "_lyzTalentDrPct",
    "_hlRageDrMult",
  ])
    delete defC[k];
};
const ratio = (type: "physical" | "magical" = "physical") => {
  const r: any = calcDamage(atkC, defC, 1.0, type as any, {} as any);
  return r.afterFrontRow > 0 ? r.afterOtherReduction / r.afterFrontRow : NaN;
};
clearDef();
const base = ratio();
clearDef();
defC._lyzDrUntil = 20;
defC._lyzDr = 0.2;
const rLyzPhys = ratio("physical");
const rLyzMag = ratio("magical");
clearDef();
defC._qdDrUntil = 20;
defC._qdDrPct = 0.3;
const rQd = ratio();
clearDef();
defC._sqShieldUntil = 20;
const rShieldMag = ratio("magical");
const rShieldPhys = ratio("physical");
clearDef();
defC._xdBlessUntil = 20;
const rBless = ratio();
clearDef();
const savedDef = defC.def;
defC.def = { ...savedDef, id: "sc" }; // 圣裁者分支按 def.id === "sc" 判定
defC._scDr = 0.2;
const rSc = ratio();
defC.def = savedDef;
clearDef();
defC._lyzDrUntil = 20;
defC._lyzDr = 0.2;
defC._qdDrUntil = 20;
defC._qdDrPct = 0.3;
const rMulti = ratio();
clearDef();
defC._lxgzDrUntil = 20;
defC._lxgzDrPct = 0.15;
const rLxgzDr = ratio();
clearDef();
defC._lyzTalentDrPct = 0.3;
const rLyzTalent = ratio();
clearDef();

const rel = (v: number) => v / base;
console.log(
  `  base=${base.toFixed(4)} | lyz物理=${rel(rLyzPhys).toFixed(4)} lyz魔法=${rel(rLyzMag).toFixed(4)} qd=${rel(rQd).toFixed(4)} 护盾魔=${rel(rShieldMag).toFixed(4)} 护盾物=${rel(rShieldPhys).toFixed(4)} 祝福=${rel(rBless).toFixed(4)} 圣裁=${rel(rSc).toFixed(4)} 叠加=${rel(rMulti).toFixed(4)} 灵弦=${rel(rLxgzDr).toFixed(4)} 龙天赋=${rel(rLyzTalent).toFixed(4)}`
);
check(
  "R19-8 龙吟治愈 20% 减伤对物理生效（≈0.80）",
  Math.abs(rel(rLyzPhys) - 0.8) < 0.02,
  `实测 ${rel(rLyzPhys).toFixed(4)}`
);
check(
  "R19-8 龙吟治愈 20% 减伤对魔法也生效（≈0.80）",
  Math.abs(rel(rLyzMag) - 0.8) < 0.02,
  `实测 ${rel(rLyzMag).toFixed(4)}`
);
check(
  "R19-8 祈祷者 30% 减伤生效（≈0.70）",
  Math.abs(rel(rQd) - 0.7) < 0.02,
  `实测 ${rel(rQd).toFixed(4)}`
);
check(
  "R19-8 圣骑士护盾魔伤 -30% 生效（≈0.70）",
  Math.abs(rel(rShieldMag) - 0.7) < 0.02,
  `实测 ${rel(rShieldMag).toFixed(4)}`
);
check(
  "R19-8 圣骑士护盾不影响物理伤害（≈1.00）",
  Math.abs(rel(rShieldPhys) - 1) < 0.02,
  `实测 ${rel(rShieldPhys).toFixed(4)}`
);
check(
  "R19-8 殉道祝福 -10% 生效（≈0.90）",
  Math.abs(rel(rBless) - 0.9) < 0.02,
  `实测 ${rel(rBless).toFixed(4)}`
);
check(
  "R19-8 圣裁者减伤 20% 生效（≈0.80）",
  Math.abs(rel(rSc) - 0.8) < 0.02,
  `实测 ${rel(rSc).toFixed(4)}`
);
check(
  "R19-8 多源减伤乘法叠加（0.8×0.7≈0.56）",
  Math.abs(rel(rMulti) - 0.56) < 0.02,
  `实测 ${rel(rMulti).toFixed(4)}`
);
check(
  "回归 R13 灵弦歌者 15% 减伤仍生效（≈0.85）",
  Math.abs(rel(rLxgzDr) - 0.85) < 0.02,
  `实测 ${rel(rLxgzDr).toFixed(4)}`
);
check(
  "回归 R16 龙吟者天赋 30% 减伤仍生效（≈0.70）",
  Math.abs(rel(rLyzTalent) - 0.7) < 0.02,
  `实测 ${rel(rLyzTalent).toFixed(4)}`
);

// ============================================================
// 汇总
// ============================================================
console.log("\n============================================================");
console.log(`R19 功能验证: ${pass} passed / ${fail} failed`);
if (fail > 0) {
  console.log("失败项:");
  for (const f of failures) console.log(`  - ${f}`);
  console.log("VERIFY_FAILED");
  process.exitCode = 1;
} else {
  console.log("VERIFY_OK");
}
