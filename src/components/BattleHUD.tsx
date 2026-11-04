import React, { useEffect, useMemo, useRef, useState } from "react";
import { BattleState } from "../types";
import { BattleStats } from "../types/stats";

/**
 * 实时战斗 HUD
 *
 * 数据来源：battle.units（血量/存活）、battle.stats（累计输出/治疗/击杀/伤害构成）。
 * DPS 与每秒伤害曲线由「相邻两帧的累计伤害差分」按逻辑秒分桶得到，
 * 因此 1x/2x/4x 速度下时间轴仍然对齐战斗内时间。
 */

type Side = "ally" | "enemy";

const SIDE_COLOR: Record<Side, string> = {
  ally: "#4fc3f7",
  enemy: "#ef5350",
};
const SIDE_NAME: Record<Side, string> = { ally: "我方", enemy: "敌方" };
const DMG_COLORS = { phys: "#ff7a45", mag: "#ab88ff", pure: "#e6e6e6" };

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

interface Snapshot {
  hp: number;
  maxHp: number;
  alive: number;
  total: number;
  damage: number;
  heal: number;
  kills: number;
  phys: number;
  mag: number;
  pure: number;
  dps: number;
  top: { name: string; value: number }[];
}

function teamStats(battle: BattleState, side: Side): BattleStats[] {
  return (battle.stats || []).filter(
    (s: any) => s.team === side
  ) as BattleStats[];
}

function sumDamage(battle: BattleState, side: Side): number {
  return teamStats(battle, side).reduce(
    (a, s) => a + (s.totalDamageDealt || 0),
    0
  );
}

function snapshot(battle: BattleState, side: Side, dps: number): Snapshot {
  const units = battle.units.filter((u) => u.team === side);
  const stats = teamStats(battle, side);
  const sum = (f: (s: BattleStats) => number) =>
    stats.reduce((a, s) => a + (f(s) || 0), 0);
  return {
    hp: units.reduce((a, u) => a + Math.max(0, u.currentHp), 0),
    maxHp: units.reduce((a, u) => a + (u.maxHp || 0), 0),
    alive: units.filter((u) => !u.isDead).length,
    total: units.length,
    damage: sum((s) => s.totalDamageDealt),
    heal: sum((s) => s.totalHealingDone),
    kills: sum((s) => s.kills),
    phys: sum((s) => s.physicalDamage),
    mag: sum((s) => s.magicalDamage),
    pure: sum((s) => s.pureDamage),
    dps,
    top: [...stats]
      .sort((a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0))
      .slice(0, 3)
      .map((s) => ({ name: s.name, value: s.totalDamageDealt || 0 })),
  };
}

interface Timeline {
  ally: number[];
  enemy: number[];
}

function useDamageTimeline(battle: BattleState): Timeline {
  const [timeline, setTimeline] = useState<Timeline>({ ally: [], enemy: [] });
  const dataRef = useRef<Timeline>({ ally: [], enemy: [] });
  const prevRef = useRef({ time: 0, ally: 0, enemy: 0 });
  const processedRef = useRef<BattleState | null>(null);

  useEffect(() => {
    // StrictMode / 同一 state 对象重复 effect 时只处理一次，避免重复累加
    if (processedRef.current === battle) return;
    processedRef.current = battle;

    const cur = {
      time: battle.time,
      ally: sumDamage(battle, "ally"),
      enemy: sumDamage(battle, "enemy"),
    };
    const prev = prevRef.current;
    if (cur.time < prev.time) {
      dataRef.current = { ally: [], enemy: [] };
      prevRef.current = { time: 0, ally: 0, enemy: 0 };
    }
    const base = prevRef.current;
    const tl = dataRef.current;
    const bucket = Math.max(0, Math.floor(cur.time));
    while (tl.ally.length <= bucket) {
      tl.ally.push(0);
      tl.enemy.push(0);
    }
    tl.ally[bucket] += Math.max(0, cur.ally - base.ally);
    tl.enemy[bucket] += Math.max(0, cur.enemy - base.enemy);
    prevRef.current = cur;
    setTimeline({ ally: [...tl.ally], enemy: [...tl.enemy] });
  }, [battle]);

  return timeline;
}

function recentDps(arr: number[], bucket: number): number {
  const from = Math.max(0, bucket - 2);
  const slice = arr.slice(from, bucket + 1);
  if (slice.length === 0) return 0;
  return slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
}

/** 每秒伤害双折线（像素级紧凑 sparkline） */
function Sparkline({ timeline }: { timeline: Timeline }) {
  const n = Math.max(1, timeline.ally.length, timeline.enemy.length);
  const max = Math.max(1, ...timeline.ally, ...timeline.enemy);
  const w = 240;
  const h = 38;
  const points = (arr: number[]) =>
    Array.from({ length: n }, (_, i) => {
      const v = arr[i] || 0;
      const x = n <= 1 ? 0 : (i / (n - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  return (
    <div className="hud-spark">
      <div className="hud-spark-title">
        ⚡ 每秒伤害 <span style={{ color: SIDE_COLOR.ally }}>■我方</span>{" "}
        <span style={{ color: SIDE_COLOR.enemy }}>■敌方</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        width="100%"
        height={38}
      >
        <line
          x1="0"
          y1={h - 1}
          x2={w}
          y2={h - 1}
          stroke="var(--panel-border)"
          strokeWidth="1"
        />
        {n > 1 && (
          <>
            <polyline
              points={points(timeline.ally)}
              fill="none"
              stroke={SIDE_COLOR.ally}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <polyline
              points={points(timeline.enemy)}
              fill="none"
              stroke={SIDE_COLOR.enemy}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="hud-metric">
      <span className="hud-metric-label">{label}</span>
      <b style={{ color: color || "var(--text)" }}>{value}</b>
    </div>
  );
}

function TeamBlock({
  side,
  s,
  dmgTotal,
}: {
  side: Side;
  s: Snapshot;
  dmgTotal: number;
}) {
  const hpPct = s.maxHp > 0 ? (s.hp / s.maxHp) * 100 : 0;
  const dmgSum = s.phys + s.mag + s.pure || 1;
  const seg = (v: number) => `${(v / dmgSum) * 100}%`;
  return (
    <div className={`hud-team hud-team-${side}`}>
      <div className="hud-team-head">
        <span style={{ color: SIDE_COLOR[side], fontWeight: 800 }}>
          {side === "ally" ? "◀ " : ""}
          {SIDE_NAME[side]}
          {side === "enemy" ? " ▶" : ""}
        </span>
        <span className="hud-team-alive">
          存活 {s.alive}/{s.total} · 击杀 {s.kills}
        </span>
      </div>

      {/* 队伍总血量 */}
      <div className="hud-hpbar">
        <div
          style={{
            width: `${hpPct}%`,
            background: `linear-gradient(90deg, ${SIDE_COLOR[side]}aa, ${SIDE_COLOR[side]})`,
            marginLeft: side === "enemy" ? "auto" : undefined,
          }}
        />
      </div>
      <div className="hud-hpbar-caption">
        <span>{fmt(s.hp)} HP</span>
        <span>{hpPct.toFixed(1)}%</span>
      </div>

      {/* 关键指标 */}
      <div className="hud-metrics">
        <Metric label="总输出" value={fmt(s.damage)} color={SIDE_COLOR[side]} />
        <Metric label="DPS" value={fmt(s.dps)} />
        <Metric label="治疗" value={fmt(s.heal)} color="#69f0ae" />
      </div>

      {/* 伤害构成堆叠条 */}
      <div className="hud-composition" title="物理 / 魔法 / 纯粹 伤害构成">
        <span style={{ width: seg(s.phys), background: DMG_COLORS.phys }} />
        <span style={{ width: seg(s.mag), background: DMG_COLORS.mag }} />
        <span style={{ width: seg(s.pure), background: DMG_COLORS.pure }} />
      </div>
      <div className="hud-composition-caption">
        🔨{fmt(s.phys)} 🔮{fmt(s.mag)} ✨{fmt(s.pure)}
        <span style={{ marginLeft: "auto" }}>
          占比 {dmgTotal > 0 ? ((s.damage / dmgTotal) * 100).toFixed(0) : 0}%
        </span>
      </div>

      {/* 实时输出 TOP3 */}
      <div className="hud-top3">
        {s.top.length === 0 && <span className="hud-dim">暂无输出</span>}
        {s.top.map((t, i) => (
          <div key={t.name} className="hud-top3-row">
            <span className="hud-rank">{i + 1}</span>
            <span className="hud-top3-name">{t.name}</span>
            <div className="hud-top3-bar">
              <div
                style={{
                  width: `${s.top[0]?.value ? (t.value / s.top[0].value) * 100 : 0}%`,
                  background: SIDE_COLOR[side],
                }}
              />
            </div>
            <span className="hud-top3-val">{fmt(t.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Props {
  battle: BattleState;
}

const BattleHUD: React.FC<Props> = ({ battle }) => {
  const timeline = useDamageTimeline(battle);
  const bucket = Math.max(0, Math.floor(battle.time));

  const { ally, enemy } = useMemo(() => {
    const a = snapshot(battle, "ally", recentDps(timeline.ally, bucket));
    const e = snapshot(battle, "enemy", recentDps(timeline.enemy, bucket));
    return { ally: a, enemy: e };
  }, [battle, timeline, bucket]);

  const dmgTotal = ally.damage + enemy.damage;
  const advantage = dmgTotal > 0 ? (ally.damage / dmgTotal) * 100 : 50;

  return (
    <div className="battle-hud">
      {/* 优势条 + 战斗计时 */}
      <div className="hud-advantage">
        <span style={{ color: SIDE_COLOR.ally }}>{fmt(ally.damage)}</span>
        <div className="hud-advantage-track">
          <div
            style={{ width: `${advantage}%`, background: SIDE_COLOR.ally }}
          />
          <div
            style={{
              width: `${100 - advantage}%`,
              background: SIDE_COLOR.enemy,
            }}
          />
          <span className="hud-clock">⏱ {battle.time.toFixed(1)}s</span>
        </div>
        <span style={{ color: SIDE_COLOR.enemy }}>{fmt(enemy.damage)}</span>
      </div>

      <div className="hud-teams">
        <TeamBlock side="ally" s={ally} dmgTotal={dmgTotal} />
        <div className="hud-vs">
          {battle.phase === "finished" ? "终" : "VS"}
        </div>
        <TeamBlock side="enemy" s={enemy} dmgTotal={dmgTotal} />
      </div>

      <div className="hud-footer">
        <Sparkline timeline={timeline} />
        <div className="hud-legend">
          <span style={{ color: DMG_COLORS.phys }}>🔨物理</span>
          <span style={{ color: DMG_COLORS.mag }}>🔮魔法</span>
          <span style={{ color: DMG_COLORS.pure }}>✨纯粹</span>
          <span className="hud-dim">DPS = 近 3 秒均值</span>
        </div>
      </div>
    </div>
  );
};

export default BattleHUD;
