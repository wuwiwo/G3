/**
 * 角色细颗粒度分析核心（浏览器 / App 内置版）。
 *
 * 口径与 scripts/batchBalance.ts 的 r5 章节完全一致：
 *   普攻/技能/其他 = 来源分轨；天赋伤害 = 归因分轨（重叠、不可相加）
 *   收益合计 = 治疗 + 护盾吸收 + 格挡减伤；增益点·秒 / 控制 s 单独列
 *   10s归一 = 数值 ÷ 存活s × 10；总贡献 = 总输出 + 收益合计
 *   ≥P90 判超模，≤P10 判待加强
 * ⚠️ 改这里的字段或公式时，必须同步 scripts/batchBalance.ts 与 HANDOFF.md 第 9 节。
 *
 * 纯计算模块：不依赖 DOM / fs / Node API，可直接在浏览器运行。
 * 采用分片 + setTimeout(0) 让出主线程，避免 2800 场对局把 UI 卡死。
 */
import { initBattle, processTick } from "../engine/battle";
import type { BattleState } from "../types";

export const ROSTER: Record<string, string[]> = {
  beast: ["pp", "mmx", "lbmx", "hx", "hl", "yl", "dxm", "zzx"],
  hunter: ["ldshz", "mds", "sszs", "zfyx", "xblr", "hqs", "lxgz", "bslr"],
  warrior: ["fxz", "fdzs", "crzs", "hd", "zqz", "slzs", "kzs", "jdds"],
  mage: ["srm", "xjl", "syz", "xdds", "zs", "bmxz", "sjsn", "ynfs"],
  undead: ["kldd", "swxz", "mrsz", "dyq", "wqqs", "yammxz", "wlgyz", "hyz"],
  dragon: ["dl", "bjl", "lyz", "xyfl", "hlyl", "bsxl", "xcl", "hbfl"],
  holy: ["sq", "sc", "xd", "fz", "qm", "qd", "sqz", "zq"],
};

export const RACES = [
  "beast",
  "undead",
  "dragon",
  "mage",
  "hunter",
  "warrior",
  "holy",
];
export const RACE_CN: Record<string, string> = {
  beast: "兽族",
  undead: "亡灵",
  dragon: "龙族",
  mage: "法师",
  hunter: "猎人",
  warrior: "战士",
  holy: "圣职者",
};

export interface RoleRow {
  name: string;
  race: string;
  raceCN: string;
  out: number;
  auto: number;
  skill: number;
  other: number;
  talent: number;
  outShare: number;
  surv: number;
  out10: number;
  heal: number;
  ls: number;
  skillHeal: number;
  shield: number;
  block: number;
  gain: number;
  gain10: number;
  buff: number;
  ctrl: number;
  total10: number;
  value: number;
  taken: number;
  kills: number;
  deaths: number;
  casts: number;
  verdict: "超模" | "待加强" | "正常";
}

export interface Insight {
  kind: "critical" | "warn" | "info";
  title: string;
  body: string;
}

export interface AnalysisResult {
  runs: number;
  battles: number;
  avgDuration: number;
  generated: string;
  rows: RoleRow[];
  overall: { race: string; raceCN: string; pct: number }[];
  mirror: { raceCN: string; first: number }[];
  matchups: {
    a: string;
    b: string;
    aPct: number;
    bPct: number;
    verdict: string;
    mirror: boolean;
  }[];
  insights: Insight[];
  thresholds: {
    hiCut: number;
    loCut: number;
    medianSurv: number;
    medianTotal10: number;
  };
}

interface Detailed {
  winner: string;
  duration: number;
  stats: any[];
}

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

function runOneDetailed(ally: string[], enemy: string[]): Detailed {
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
    winner: (state as any).winner || "draw",
    duration: state.time,
    stats: (state as any).stats || [],
  };
}

const NUM_FIELDS: [string, string][] = [
  ["totalDamage", "totalDamageDealt"],
  ["physDmg", "physicalDamage"],
  ["magDmg", "magicalDamage"],
  ["pureDmg", "pureDamage"],
  ["healing", "totalHealingDone"],
  ["lifeSteal", "lifeStealHealing"],
  ["dmgTaken", "totalDamageReceived"],
  ["kills", "kills"],
  ["deaths", "deaths"],
  ["skillCasts", "skillCasts"],
  ["critCount", "critCount"],
  ["blockCount", "blockCount"],
  ["physTaken", "physicalDamageReceived"],
  ["magTaken", "magicalDamageReceived"],
  ["pureTaken", "pureDamageReceived"],
  ["hitsTaken", "hitsTaken"],
  ["critsTaken", "critsTaken"],
  ["autoDmg", "autoAttackDamage"],
  ["skillDmg", "skillDamage"],
  ["talentDmg", "talentDamage"],
  ["talentHeal", "talentHealing"],
  ["buffVal", "buffValue"],
  ["ctrlSec", "controlSeconds"],
  ["skillHeal", "skillHealing"],
  ["shieldAbs", "shieldAbsorbed"],
  ["blockRed", "blockReduced"],
  ["survTime", "survivalTime"],
];

function createAccumulator() {
  const agg: Record<string, Record<string, number>> = {};
  const meta: Record<string, string> = {};
  let battles = 0;
  let totalDuration = 0;

  return {
    add(d: Detailed) {
      battles += 1;
      totalDuration += d.duration;
      for (const s of d.stats) {
        const key = s.name || s.unitId;
        if (!agg[key]) agg[key] = { count: 0 };
        if (!meta[key] && s.race) meta[key] = s.race;
        const u = agg[key];
        u.count += 1;
        for (const [k, src] of NUM_FIELDS) u[k] = (u[k] || 0) + (s[src] || 0);
      }
    },
    finish(matrix: number[][], runs: number): AnalysisResult {
      let grandOutput = 0;
      for (const [, u] of Object.entries(agg))
        grandOutput += (u.totalDamage || 0) / (u.count || 1);

      const rows: RoleRow[] = Object.entries(agg).map(([name, u]) => {
        const cnt = u.count || 1;
        const race = meta[name] || "?";
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
        return {
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
          value: out + gain,
          taken: avg("dmgTaken"),
          kills: avg("kills"),
          deaths: avg("deaths"),
          casts: avg("skillCasts"),
          verdict: "正常",
        };
      });

      const by10 = [...rows].sort((a, b) => b.total10 - a.total10);
      const hiCut = by10[Math.floor(by10.length * 0.1)]?.total10 ?? Infinity;
      const loCut = by10[Math.floor(by10.length * 0.9)]?.total10 ?? 0;
      for (const r of rows)
        r.verdict =
          r.total10 >= hiCut ? "超模" : r.total10 <= loCut ? "待加强" : "正常";

      const survSorted = [...rows].map((r) => r.surv).sort((a, b) => a - b);
      const t10Sorted = [...rows].map((r) => r.total10).sort((a, b) => a - b);
      const mid = (arr: number[]) => arr[Math.floor(arr.length / 2)] || 0;
      const medianSurv = mid(survSorted);
      const medianTotal10 = mid(t10Sorted);

      const overall = RACES.map((race, i) => {
        let wins = 0,
          n = 0;
        for (let j = 0; j < RACES.length; j++) {
          if (i === j || matrix[i][j] < 0) continue;
          wins += matrix[i][j];
          n += runs;
        }
        return {
          race,
          raceCN: RACE_CN[race],
          pct: n > 0 ? (wins / n) * 100 : 0,
        };
      }).sort((a, b) => b.pct - a.pct);

      const mirror = RACES.map((race, i) => ({
        raceCN: RACE_CN[race],
        first: (matrix[i][i] / runs) * 100,
      }));

      // 胜率对局表：21 组跨族对阵 + 7 组同族镜像（SKILL 第二节 58/42 克制阈值）
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
      const matchups: AnalysisResult["matchups"] = [];
      for (let i = 0; i < RACES.length; i++) {
        for (let j = i + 1; j < RACES.length; j++) {
          const aPct = (matrix[i][j] / runs) * 100;
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
      for (let i = 0; i < RACES.length; i++) {
        const aPct = (matrix[i][i] / runs) * 100;
        matchups.push({
          a: `${RACE_CN[RACES[i]]}(先手)`,
          b: `${RACE_CN[RACES[i]]}(后手)`,
          aPct,
          bPct: 100 - aPct,
          verdict: "镜像",
          mirror: true,
        });
      }

      const now = new Date();
      const p = (v: number) => String(v).padStart(2, "0");
      return {
        runs,
        battles,
        avgDuration: battles > 0 ? totalDuration / battles : 0,
        generated: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}`,
        rows,
        overall,
        mirror,
        matchups,
        insights: buildInsights(
          rows,
          overall,
          mirror,
          runs,
          hiCut,
          loCut,
          medianSurv,
          medianTotal10
        ),
        thresholds: { hiCut, loCut, medianSurv, medianTotal10 },
      };
    },
  };
}

const fmt = (v: number) => Math.round(v).toLocaleString("en-US");

/** 规则化自动分析：全部由统计派生，不调用任何 AI，结论可复核 */
function buildInsights(
  rows: RoleRow[],
  overall: { raceCN: string; pct: number }[],
  mirror: { raceCN: string; first: number }[],
  runs: number,
  hiCut: number,
  loCut: number,
  medianSurv: number,
  medianTotal10: number
): Insight[] {
  const out: Insight[] = [];
  const by10 = [...rows].sort((a, b) => b.total10 - a.total10);
  const over = by10.filter((r) => r.verdict === "超模");
  const under = [...by10].reverse().filter((r) => r.verdict === "待加强");

  if (runs < 100) {
    out.push({
      kind: "info",
      title: "样本量提示",
      body: `当前 ${runs} 局/对阵（共 ${28 * runs} 场），52-58% 边缘对局有 ±3% 量级噪声。SKILL 第二节建议 150-200 局；本结果适合看趋势，收敛数值前请重跑更高场次。`,
    });
  }

  const best = overall[0],
    worst = overall[overall.length - 1];
  out.push({
    kind: "warn",
    title: "种族格局",
    body: `${best.raceCN} 综合 ${best.pct.toFixed(1)}% 最高，${worst.raceCN} ${worst.pct.toFixed(1)}% 最低，极差 ${(best.pct - worst.pct).toFixed(1)}pp。全矩阵为单向对局 + 同族镜像，跨族比较请在「同一套站位」下进行。`,
  });

  for (const r of over.slice(0, 3)) {
    const parts = [
      `10s综合 ${fmt(r.total10)}（超模阈值 ${fmt(hiCut)}），总贡献 ${fmt(r.value)}。`,
      `输出来源：技能 ${r.out > 0 ? ((r.skill / r.out) * 100).toFixed(0) : 0}% / 普攻 ${r.out > 0 ? ((r.auto / r.out) * 100).toFixed(0) : 0}% / 其他 ${r.out > 0 ? ((r.other / r.out) * 100).toFixed(0) : 0}%；天赋归因 ${fmt(r.talent)}（与来源分轨重叠）。`,
    ];
    if (r.gain > 0)
      parts.push(
        `收益 ${fmt(r.gain)}（占输出 ${((r.gain / Math.max(1, r.out)) * 100).toFixed(0)}%）。`
      );
    if (r.surv < medianSurv * 0.6) {
      parts.push(
        `⚠️ 存活仅 ${r.surv.toFixed(1)}s（全场中位 ${medianSurv.toFixed(1)}s），短存活或「阵亡后仍可施法」会放大 10s归一，请以总贡献 ${fmt(r.value)} 为准。`
      );
    }
    if (r.out > 0 && r.other / r.out > 0.5 && r.talent < r.out * 0.1) {
      parts.push(
        `⚠️ 输出中 ${((r.other / r.out) * 100).toFixed(0)}% 未归入普攻/技能分轨，且天赋归因≈0 —— 多为天赋/反伤/DoT 直接结算，建议补 trackTalent 埋点以便归因。`
      );
    }
    out.push({
      kind: "critical",
      title: `疑似超模 · ${r.name}（${r.raceCN}）`,
      body: parts.join(""),
    });
  }

  for (const r of under.slice(0, 3)) {
    const gap = medianTotal10 > 0 ? (r.total10 / medianTotal10) * 100 : 0;
    const weak = r.out10 < r.gain10 ? "输出" : "收益";
    out.push({
      kind: "warn",
      title: `待加强 · ${r.name}（${r.raceCN}）`,
      body: `10s综合 ${fmt(r.total10)}，仅为全场中位 ${fmt(medianTotal10)} 的 ${gap.toFixed(0)}%（待加强阈值 ${fmt(loCut)}）；总贡献 ${fmt(r.value)}，主要缺口在${weak}侧（10s输出 ${fmt(r.out10)} / 10s收益 ${fmt(r.gain10)}）。`,
    });
  }

  const martyr = rows.find((r) => r.name === "殉道者");
  if (martyr && martyr.verdict === "超模") {
    out.push({
      kind: "warn",
      title: "站位混淆变量",
      body: `圣职者阵容把全族最脆的殉道者放在前排，等于人为催发「每当友方阵亡」天赋。该角色的超模结论受站位影响，详见 docs/analysis/v3.3_阵容站位核查.md。`,
    });
  }

  const badMirror = mirror.filter((m) => m.first < 45 || m.first > 55);
  const mirrorText = mirror
    .map((m) => `${m.raceCN} ${m.first.toFixed(0)}%`)
    .join("、");
  if (runs < 30) {
    out.push({
      kind: "info",
      title: "引擎对称性",
      body: `${runs} 局/对阵样本不足，镜像先手率仅供参考（${mirrorText}），本轮不做 45-55% 判定；建议 100 局以上或 300 局专项复核。`,
    });
  } else {
    out.push({
      kind: badMirror.length ? "warn" : "info",
      title: "引擎对称性",
      body: badMirror.length
        ? `镜像先手偏离 45-55%：${badMirror.map((m) => `${m.raceCN} ${m.first.toFixed(0)}%`).join("、")}；小样本下可能是噪声，建议专项 300 局复核。`
        : `7 族镜像先手均落在 45-55%（${mirror.map((m) => m.first.toFixed(0)).join("/")}%），未发现 ally/enemy 系统性偏置。`,
    });
  }

  return out;
}

/** 分片跑全矩阵 + 镜像；onProgress 用于进度条，isCancelled 用于中途取消 */
export async function analyzeAll(
  runs: number,
  onProgress: (ratio: number, label: string) => void,
  isCancelled: () => boolean
): Promise<AnalysisResult | null> {
  const acc = createAccumulator();
  const matrix: number[][] = RACES.map(() => RACES.map(() => -1));
  const total = 21 * runs + 7 * runs;
  let done = 0;
  const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

  for (let i = 0; i < RACES.length; i++) {
    for (let j = i + 1; j < RACES.length; j++) {
      const a = RACES[i],
        b = RACES[j];
      let aWins = 0;
      for (let k = 0; k < runs; k++) {
        const d = runOneDetailed(ROSTER[a], ROSTER[b]);
        if (d.winner === "ally") aWins += 1;
        else if (d.winner === "draw") aWins += 0.5;
        acc.add(d);
        done += 1;
        if (done % 10 === 0) {
          onProgress(done / total, `${RACE_CN[a]} vs ${RACE_CN[b]}`);
          await yieldToUI();
          if (isCancelled()) return null;
        }
      }
      matrix[i][j] = aWins;
      matrix[j][i] = runs - aWins;
    }
  }

  for (let i = 0; i < RACES.length; i++) {
    const a = RACES[i];
    let firstWins = 0;
    for (let k = 0; k < runs; k++) {
      const d = runOneDetailed(ROSTER[a], ROSTER[a]);
      if (d.winner === "ally") firstWins += 1;
      else if (d.winner === "draw") firstWins += 0.5;
      acc.add(d);
      done += 1;
      if (done % 10 === 0) {
        onProgress(done / total, `${RACE_CN[a]} 镜像`);
        await yieldToUI();
        if (isCancelled()) return null;
      }
    }
    matrix[i][i] = firstWins;
  }

  onProgress(1, "分析完成");
  return acc.finish(matrix, runs);
}
