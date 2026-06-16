import React, { useState, useEffect, useCallback } from "react";
import { TeamSetup } from "./components/TeamSetup";
import BattleField from "./components/BattleField";
import { BattleLog } from "./components/BattleLog";
import StatsPanel from "./components/StatsPanel";
import DataEditor from "./components/DataEditor";
import UnitDetail from "./components/UnitDetail";
import { BatchTest } from "./components/BatchTest";
import { useBattle } from "./hooks/useBattleState";
import { ArenaUnit } from "./types";

const VERSION = "v1.8.3";

const App: React.FC = () => {
  const { state, startBattle, reset, speed } = useBattle();
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

  useEffect(() => {
    if (!state || state.battleLog.length === 0) return;
    const last = state.battleLog[state.battleLog.length - 1];
    (state as any)._debug = debug;
    if (last.type === "skill" && last.sourceId) {
      const caster = state.units.find((u) => u.id === last.sourceId);
      if (caster) {
        setFocusUnit(caster);
        const t = setTimeout(() => setFocusUnit(null), 1200);
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
    color: active ? "#fff" : "#666",
    borderTop: active ? "2px solid #4a9eff" : "2px solid transparent",
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
        background: "#0d0d1a",
        color: "#e0e0e0",
        paddingBottom: 50,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {page === "setup" && <TeamSetup onStart={handleStart} />}

      {page === "battle" && state && (
        <>
          {/* Battle sub-tabs */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              background: "#111",
              borderBottom: "1px solid #222",
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
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  onClick={() => {
                    speed.current =
                      speed.current === 1 ? 2 : speed.current === 2 ? 4 : 1;
                  }}
                  style={btnStyle("#444")}
                >
                  {speed.current}x
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
              <div style={{ padding: 4 }}>
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
          background: "#111",
          borderTop: "1px solid #222",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: 4,
            top: -14,
            fontSize: 8,
            color: "#555",
            background: "#111",
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
