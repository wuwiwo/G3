import React, { useState, useEffect, useCallback, useRef } from "react";
import { TeamSetup } from "./components/TeamSetup";
import BattleField from "./components/BattleField";
import { BattleLog } from "./components/BattleLog";
import StatsPanel from "./components/StatsPanel";
import DataEditor from "./components/DataEditor";
import UnitDetail from "./components/UnitDetail";
import { BatchTest } from "./components/BatchTest";
import KillFeed from "./components/KillFeed";
import { useBattle } from "./hooks/useBattleState";
import { ArenaUnit } from "./types";

const VERSION = "v2.0";

const App: React.FC = () => {
  const {
    state,
    startBattle,
    reset,
    speed,
    pauseOnSkill,
    setPauseOnSkill,
    skillPauseActive,
    pausedSkillName,
    pausedSkillCasterId,
    pausedSkillType,
    pausedSkillTargetId,
    pausedSkillLine,
    manualPaused,
    togglePause,
  } = useBattle();
  const [page, setPage] = useState<"setup" | "battle" | "edit">("setup");
  const [battleTab, setBattleTab] = useState<"field" | "stats">("field");
  const [selectedUnit, setSelectedUnit] = useState<ArenaUnit | null>(null);
  const [allyTeam, setAllyTeam] = useState<
    { charId: string; row: number; col: number }[]
  >([]);
  const [enemyTeam, setEnemyTeam] = useState<
    { charId: string; row: number; col: number }[]
  >([]);
  const [debug, setDebug] = useState(true);
  const [focusUnit, setFocusUnit] = useState<ArenaUnit | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(
    () => (localStorage.getItem("g3-theme") as "dark" | "light") || "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("g3-theme", theme);
  }, [theme]);

    // v3: 镜头拉近已取消（画面不动）

  // v3: 技能演出阶段序列（大字→台词→箭头→目标高亮→受击）
  const [cinemaStage, setCinemaStage] = useState(0);
  useEffect(() => {
    if (!skillPauseActive) {
      setCinemaStage(0);
      return;
    }
    setCinemaStage(0);
    const timers = [
      setTimeout(() => setCinemaStage(1), 500), // 台词
      setTimeout(() => setCinemaStage(2), 1000), // 箭头
      setTimeout(() => setCinemaStage(3), 1500), // 目标高亮
      setTimeout(() => setCinemaStage(4), 2000), // 受击动画
    ];
    return () => timers.forEach(clearTimeout);
  }, [skillPauseActive]);

  const SKILL_TYPE_COLOR: Record<string, string> = {
    attack: "#ff6b6b",
    heal: "#5ecf8a",
    buff: "#5e9eff",
    control: "#b388ff",
  };
  const SKILL_TYPE_LABEL: Record<string, string> = {
    attack: "攻击",
    heal: "治疗",
    buff: "增益",
    control: "控制",
  };

  useEffect(() => {
    if (!state || state.battleLog.length === 0) return;
    const last = state.battleLog[state.battleLog.length - 1];
    (state as any)._debug = debug;
    if (last.type === "skill" && last.sourceId) {
      const caster = state.units.find((u) => u.id === last.sourceId);
      if (caster) {
        setFocusUnit(caster);
        const t = setTimeout(() => setFocusUnit(null), 1500); // v3: 与技能暂停同步
        return () => clearTimeout(t);
      }
    }
  }, [state?.battleLog.length]);

  const handleStart = (
    ally: { charId: string; row: number; col: number }[],
    enemy: { charId: string; row: number; col: number }[]
  ) => {
    setAllyTeam(ally);
    setEnemyTeam(enemy);
    startBattle(ally, enemy);
    setPage("battle");
    setBattleTab("field");
  };

  const handleRematch = () => {
    if (allyTeam.length > 0 && enemyTeam.length > 0)
      startBattle(allyTeam, enemyTeam);
    setSelectedUnit(null);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 0",
    fontSize: 12,
    fontWeight: 600,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: active ? "var(--text)" : "var(--text-faint)",
    borderTop: active ? "2px solid var(--accent)" : "2px solid transparent",
    transition: "color 0.2s",
  });

  const copyLog = useCallback(() => {
    if (!state) return;
    const text = state.battleLog
      .map((e) => `[${e.time.toFixed(1)}s] ${e.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  }, [state]);

  const copyStats = useCallback(() => {
    if (!state?.stats) return;
    const rows = [
      [
        "角色",
        "队伍",
        "输出",
        "物伤",
        "魔伤",
        "纯粹",
        "承伤",
        "治疗",
        "吸血",
        "击杀",
        "死亡",
        "技能",
        "存活",
      ],
    ];
    for (const s of state.stats) {
      const u = state.units.find((x) => x.id === s.unitId);
      rows.push([
        u?.def.name || "?",
        u?.team || "?",
        String(s.totalDamageDealt || 0),
        String(s.physicalDamage || 0),
        String(s.magicalDamage || 0),
        String(s.pureDamage || 0),
        String(s.totalDamageReceived || 0),
        String(s.totalHealingDone || 0),
        String(s.lifeStealHealing || 0),
        String(s.kills || 0),
        String(s.deaths || 0),
        String(s.skillCasts || 0),
        String(s.survivalTime?.toFixed(1) || "0"),
      ]);
    }
    navigator.clipboard.writeText(rows.map((r) => r.join("\t")).join("\n"));
  }, [state]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        paddingBottom: 50,
        fontFamily: "system-ui, -apple-system, sans-serif",
        transition: "background .3s, color .3s",
      }}
    >
      {/* v3: 技能演出（大字→台词→箭头→目标高亮→受击动画） */}
      {skillPauseActive && (() => {
        const typeColor = SKILL_TYPE_COLOR[pausedSkillType] || "#ffd54f";
        const typeLabel = SKILL_TYPE_LABEL[pausedSkillType] || "技能";
        // 施法者/目标屏幕位置（箭头用）
        const casterEl = pausedSkillCasterId
          ? document.querySelector(`[data-cell-id="${pausedSkillCasterId}"]`)
          : null;
        const targetEl = pausedSkillTargetId
          ? document.querySelector(`[data-cell-id="${pausedSkillTargetId}"]`)
          : null;
        const casterRect = casterEl ? casterEl.getBoundingClientRect() : null;
        const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;
        const ax = casterRect ? casterRect.left + casterRect.width / 2 : 0;
        const ay = casterRect ? casterRect.top + casterRect.height / 2 : 0;
        const bx = targetRect ? targetRect.left + targetRect.width / 2 : 0;
        const by = targetRect ? targetRect.top + targetRect.height / 2 : 0;
        const targetName = pausedSkillTargetId
          ? state?.units.find((u) => u.id === pausedSkillTargetId)?.def.name || ""
          : "";
        const casterName = pausedSkillCasterId
          ? state?.units.find((u) => u.id === pausedSkillCasterId)?.def.name || ""
          : "";
        // 技能详情（描述/数值）+ 结算值
        const casterUnit = pausedSkillCasterId
          ? state?.units.find((u) => u.id === pausedSkillCasterId)
          : null;
        const skillDef = casterUnit?.def?.skill;
        const skillDesc = skillDef?.description || "";
        const skillMeta = [
          skillDef?.cooldown ? `冷却 ${skillDef.cooldown}s` : "",
          skillDef?.castTime ? `施法 ${skillDef.castTime}s` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        // 结算数值（攻击=目标最近受击 / 治疗=目标最近治疗）
        const targetUnit = pausedSkillTargetId
          ? state?.units.find((u) => u.id === pausedSkillTargetId)
          : null;
        const settleDmg = targetUnit?.lastDamage?.value || 0;
        const settleHeal = targetUnit?.lastHeal?.value || 0;
        const settleText =
          pausedSkillType === "heal"
            ? settleHeal > 0
              ? `💚 +${settleHeal.toLocaleString()}`
              : "💚 治疗"
            : pausedSkillType === "attack" && settleDmg > 0
              ? `💥 -${settleDmg.toLocaleString()}`
              : "";
        return (
          <>
            {/* 目标受击动画（stage 4） */}
            {targetEl && cinemaStage >= 4 && (
              <style>{`[data-cell-id="${pausedSkillTargetId}"] { animation: shake 0.5s ease-in-out 2; box-shadow: 0 0 0 3px ${typeColor} !important; }`}</style>
            )}
            {/* 暗化遮罩 */}
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                zIndex: 95,
                pointerEvents: "none",
                animation: "fadeIn 0.2s ease-out",
              }}
            />
            {/* 演出箭头（stage 2+） */}
            {cinemaStage >= 2 && casterRect && targetRect && (
              <svg
                style={{
                  position: "fixed",
                  inset: 0,
                  width: "100vw",
                  height: "100vh",
                  zIndex: 96,
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <marker id="cinemaArrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="10" markerHeight="10" orient="auto">
                    <path d="M 0 0 L 12 6 L 0 12 L 3 6 z" fill={typeColor} />
                  </marker>
                </defs>
                <line
                  x1={ax} y1={ay} x2={bx} y2={by}
                  stroke={typeColor}
                  strokeWidth={4}
                  strokeDasharray="8 5"
                  markerEnd="url(#cinemaArrow)"
                  style={{ animation: "arrowPulse 0.4s ease-out" }}
                />
              </svg>
            )}
            {/* 施法者高亮（金色，全程） */}
            {casterEl && (
              <style>{`[data-cell-id="${pausedSkillCasterId}"] { box-shadow: 0 0 0 3px #ffd54f, 0 0 20px rgba(255,213,79,0.7) !important; transform: scale(1.06); }`}</style>
            )}
            {/* 目标高亮（stage 3+） */}
            {targetEl && cinemaStage >= 3 && (
              <style>{`[data-cell-id="${pausedSkillTargetId}"] { box-shadow: 0 0 0 4px ${typeColor} !important; }`}</style>
            )}
            {/* 大字文本（持续整个演出） */}
            <div
              style={{
                position: "fixed",
                top: "18%",
                left: 0,
                right: 0,
                zIndex: 97,
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#ffd54f",
                  textShadow: "0 2px 6px rgba(0,0,0,0.9)",
                  letterSpacing: 2,
                  marginBottom: 4,
                }}
              >
                {casterName} 施放
              </div>
              <div
                style={{
                  fontSize: "clamp(24px, 8vw, 44px)",
                  fontWeight: 900,
                  color: typeColor,
                  textShadow: `0 0 24px ${typeColor}, 0 0 60px ${typeColor}88, 0 2px 4px rgba(0,0,0,0.8)`,
                  letterSpacing: 5,
                  animation: "critPop 0.4s ease-out forwards",
                }}
              >
                {pausedSkillName}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 2px 6px rgba(0,0,0,0.9), 0 0 16px rgba(255,255,255,0.3)",
                  letterSpacing: 2,
                }}
              >
                ✦ {typeLabel} · {targetName ? `→ ${targetName}` : pausedSkillType === "buff" ? "→ 自身/友方" : ""} ✦
              </div>
              {/* 技能详情卡（数值） */}
              {skillDesc && (
                <div
                  className="cinema-detail-card"
                  style={{
                    display: "inline-block",
                    marginTop: 14,
                    background: "rgba(0,0,0,0.72)",
                    border: `1px solid ${typeColor}55`,
                    borderRadius: 12,
                    padding: "10px 20px",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.92)",
                    maxWidth: "76%",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  {skillDesc}
                  {skillMeta && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                      {skillMeta}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* 结算数值（stage 4） */}
            {cinemaStage >= 4 && settleText && (
              <div
                style={{
                  position: "fixed",
                  top: "52%",
                  left: 0,
                  right: 0,
                  zIndex: 97,
                  textAlign: "center",
                  pointerEvents: "none",
                  animation: "critPop 0.4s ease-out forwards",
                }}
              >
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: pausedSkillType === "heal" ? "#5ecf8a" : "#ff5252",
                    textShadow: `0 0 20px ${
                      pausedSkillType === "heal" ? "#5ecf8a" : "#ff5252"
                    }, 0 2px 4px rgba(0,0,0,0.8)`,
                  }}
                >
                  {settleText}
                </span>
              </div>
            )}
            {/* 台词（stage 1+） */}
            {cinemaStage >= 1 && pausedSkillLine && (
              <div
                style={{
                  position: "fixed",
                  bottom: "22%",
                  left: 0,
                  right: 0,
                  zIndex: 97,
                  textAlign: "center",
                  pointerEvents: "none",
                  animation: "fadeIn 0.3s ease-out",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    background: "rgba(0,0,0,0.7)",
                    border: `1px solid ${typeColor}66`,
                    borderRadius: 12,
                    padding: "10px 22px",
                    fontSize: 17,
                    color: "#fff",
                    maxWidth: "70%",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                  }}
                >
                  💬 {pausedSkillLine}
                </div>
              </div>
            )}
          </>
        );
      })()}
      {/* 主题切换 */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        title="切换明暗主题"
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 99,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "var(--btn-bg)",
          color: "var(--text)",
          border: "1px solid var(--panel-border-bright)",
          cursor: "pointer",
          fontSize: 16,
          boxShadow: "var(--shadow)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
      {page === "setup" && <TeamSetup onStart={handleStart} />}

      {page === "battle" && state && (
        <>
          {/* Battle sub-tabs */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "var(--nav-bg)",
              borderBottom: "1px solid var(--nav-border)",
            }}
          >
            {/* Header controls */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 10px",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {state.phase === "fighting" ? "⚔" : "■"}{" "}
                {state.phase === "fighting" ? "战斗中" : "已结束"}
                <span style={{ fontSize: 11, color: "#888", marginLeft: 6 }}>
                  {state.time.toFixed(1)}s
                </span>
              </span>
              <div className="topbar-controls" style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* v3: 手动暂停 */}
                <button
                  onClick={togglePause}
                  style={btnStyle(manualPaused ? "#f44336" : "#444")}
                  title="暂停/继续战斗"
                >
                  {manualPaused ? "▶ 继续" : "⏸ 暂停"}
                </button>
                <button
                  onClick={() => {
                    speed.current =
                      speed.current === 1 ? 2 : speed.current === 2 ? 4 : 1;
                  }}
                  style={btnStyle("#444")}
                >
                  {speed.current}x
                </button>
                {/* v3: 技能暂停聚焦（剑与远征风格） */}
                <button
                  onClick={() => setPauseOnSkill(!pauseOnSkill)}
                  style={btnStyle(pauseOnSkill ? "#b8922e" : "#444")}
                  title="技能发动时暂停+聚焦施法者"
                >
                  {pauseOnSkill ? "⏸技能" : "▶技能"}
                </button>
                <button
                  onClick={() => setDebug(!debug)}
                  style={btnStyle(debug ? "#4a9eff" : "#444")}
                >
                  D{debug ? "N" : "FF"}
                </button>
                <button
                  onClick={handleRematch}
                  disabled={state.phase !== "finished"}
                  style={btnStyle(
                    state.phase === "finished" ? "#2196f3" : "#333"
                  )}
                >
                  ↻
                </button>
              </div>
            </div>
            {/* Sub-tab bar */}
            <div style={{ display: "flex", background: "#0d0d1a" }}>
              <button
                onClick={() => setBattleTab("field")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 11,
                  fontWeight: 600,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: battleTab === "field" ? "#4a9eff" : "#555",
                  borderBottom:
                    battleTab === "field"
                      ? "2px solid #4a9eff"
                      : "2px solid transparent",
                  transition: "color 0.15s",
                }}
              >
                战斗区
              </button>
              <button
                onClick={() => setBattleTab("stats")}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 11,
                  fontWeight: 600,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: battleTab === "stats" ? "#4a9eff" : "#555",
                  borderBottom:
                    battleTab === "stats"
                      ? "2px solid #4a9eff"
                      : "2px solid transparent",
                  transition: "color 0.15s",
                }}
              >
                统计页
              </button>
            </div>
          </div>

          {battleTab === "field" && (
            <>
              <div
                style={{
                  padding: 4,
                  position: "relative",
                }}
              >
                <KillFeed
                  log={state.battleLog}
                  units={state.units as any}
                  battleTime={state.time}
                />
                <BattleField
                  battle={state}
                  side="ally"
                  onUnitClick={setSelectedUnit}
                  focusUnit={focusUnit}
                />
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    color: "#333",
                    padding: "1px 0",
                  }}
                >
                  ⚔
                </div>
                <BattleField
                  battle={state}
                  side="enemy"
                  onUnitClick={setSelectedUnit}
                  focusUnit={focusUnit}
                />
              </div>
              <div
                style={{
                  padding: "2px 10px",
                  fontSize: 10,
                  color: "#555",
                  textAlign: "center",
                }}
              >
                <span style={{ color: "#4fc3f7" }}>●</span>{" "}
                {
                  state.units.filter((u) => u.team === "ally" && !u.isDead)
                    .length
                }
                /{state.units.filter((u) => u.team === "ally").length}
                <span style={{ margin: "0 8px", color: "#333" }}>|</span>
                <span style={{ color: "#ef5350" }}>●</span>{" "}
                {
                  state.units.filter((u) => u.team === "enemy" && !u.isDead)
                    .length
                }
                /{state.units.filter((u) => u.team === "enemy").length}
              </div>
            </>
          )}

          {battleTab === "stats" && state.stats && (
            <div style={{ padding: "0 4px 10px" }}>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  justifyContent: "flex-end",
                  marginBottom: 4,
                }}
              >
                <button onClick={copyStats} style={smBtn}>
                  复制统计
                </button>
                <button onClick={copyLog} style={smBtn}>
                  复制日志
                </button>
              </div>
              <StatsPanel stats={state.stats} />
              <div style={{ marginTop: 4 }}>
                <BattleLog entries={state.battleLog} debug={debug} />
              </div>
            </div>
          )}

          {selectedUnit && (
            <UnitDetail
              unit={selectedUnit}
              onClose={() => setSelectedUnit(null)}
            />
          )}
        </>
      )}

      {page === "edit" && <DataEditor onClose={() => setPage("battle")} />}

      {testMode && (
        <BatchTest
          allyTeam={allyTeam}
          enemyTeam={enemyTeam}
          onClose={() => setTestMode(false)}
        />
      )}

      {/* Bottom tab bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          background: "var(--nav-bg)",
          borderTop: "1px solid var(--nav-border)",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 4,
            top: -14,
            fontSize: 8,
            color: "var(--text-faint)",
            background: "var(--nav-bg)",
            padding: "0 4px",
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          }}
        >
          {VERSION}
        </div>
        <button
          onClick={() => setPage("setup")}
          style={tabStyle(page === "setup")}
        >
          部署
        </button>
        <button
          onClick={() => setPage("battle")}
          style={tabStyle(page === "battle")}
          disabled={!state}
        >
          战斗
        </button>
        <button
          onClick={() => setPage("edit")}
          style={tabStyle(page === "edit")}
        >
          编辑
        </button>
        <button
          onClick={() => setTestMode(!testMode)}
          style={tabStyle(testMode)}
        >
          测试
        </button>
      </div>
    </div>
  );
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 600,
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    transition: "background 0.15s",
  };
}

const smBtn: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 9,
  fontWeight: 600,
  background: "#222",
  color: "#aaa",
  border: "1px solid #333",
  borderRadius: 4,
  cursor: "pointer",
};

export default App;
