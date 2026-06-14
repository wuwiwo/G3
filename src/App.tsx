import React, { useState, useEffect } from "react";
import { TeamSetup } from "./components/TeamSetup";
import BattleField from "./components/BattleField";
import { BattleLog } from "./components/BattleLog";
import StatsPanel from "./components/StatsPanel";
import DataEditor from "./components/DataEditor";
import UnitDetail from "./components/UnitDetail";
import { BatchTest } from "./components/BatchTest";
import { useBattle } from "./hooks/useBattleState";
import { ArenaUnit } from "./types";

const App: React.FC = () => {
  const { state, startBattle, reset, speed } = useBattle();
  const [page, setPage] = useState<"setup" | "battle" | "edit">("setup");
  const [selectedUnit, setSelectedUnit] = useState<ArenaUnit | null>(null);
  const [allyTeam, setAllyTeam] = useState<
    { charId: string; row: number; col: number }[]
  >([]);
  const [enemyTeam, setEnemyTeam] = useState<
    { charId: string; row: number; col: number }[]
  >([]);
  const [showExtra, setShowExtra] = useState(false);
  const [debug, setDebug] = useState(false);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0d1a",
        color: "#fff",
        paddingBottom: 50,
      }}
    >
      {/* Page content */}
      {page === "setup" && <TeamSetup onStart={handleStart} />}

      {page === "battle" && state && (
        <>
          {/* Header */}
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "6px 10px",
              background: "#111",
              borderBottom: "1px solid #222",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              战斗 {state.phase === "fighting" ? "⚔️" : "🏁"}
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
                style={btnStyle("#555")}
              >
                ⏱{speed.current}x
              </button>
              <button
                onClick={() => setShowExtra(!showExtra)}
                style={btnStyle("#555")}
              >
                📊
              </button>
              <button onClick={() => setDebug(!debug)} style={btnStyle("#555")}>
                🐛{debug ? "ON" : "OFF"}
              </button>
              <button
                onClick={handleRematch}
                disabled={state.phase !== "finished"}
                style={btnStyle(
                  state.phase === "finished" ? "#2196f3" : "#333"
                )}
              >
                🔄
              </button>
            </div>
          </div>

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
            🟦{state.units.filter((u) => u.team === "ally" && !u.isDead).length}
            /{state.units.filter((u) => u.team === "ally").length}
            <span style={{ margin: "0 6px" }}>|</span>
            🟥
            {state.units.filter((u) => u.team === "enemy" && !u.isDead).length}/
            {state.units.filter((u) => u.team === "enemy").length}
          </div>

          {showExtra && state.stats && (
            <div style={{ padding: "0 4px 10px" }}>
              <StatsPanel stats={state.stats} />
              <BattleLog entries={state.battleLog} debug={debug} />
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
        <button
          onClick={() => setPage("setup")}
          style={tabStyle(page === "setup")}
        >
          ⚙️ 部署
        </button>
        <button
          onClick={() => setPage("battle")}
          style={tabStyle(page === "battle")}
          disabled={!state}
        >
          ⚔️ 战斗
        </button>
        <button
          onClick={() => setPage("edit")}
          style={tabStyle(page === "edit")}
        >
          📝 编辑
        </button>
        <button
          onClick={() => setTestMode(!testMode)}
          style={tabStyle(testMode)}
        >
          🧪 测试
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
  };
}

export default App;
