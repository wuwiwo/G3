import React, { useRef, useEffect } from "react";
import { BattleLogEntry } from "../types";

interface Props {
  entries: BattleLogEntry[];
  debug?: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  damage: "#f44336",
  heal: "#4caf50",
  status: "#ff9800",
  skill: "#2196f3",
  death: "#9c27b0",
  system: "#aaa",
};

export const BattleLog: React.FC<Props> = ({ entries, debug }) => {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  return (
    <div
      style={{
        height: 200,
        overflow: "auto",
        background: "#0d0d1a",
        border: "1px solid #222",
        borderRadius: 8,
        padding: 8,
        fontFamily: '"Cascadia Code", "Fira Code", monospace',
        fontSize: 11,
        lineHeight: 1.7,
      }}
    >
      {entries.map((e) => (
        <div key={e.id} style={{ color: TYPE_COLORS[e.type] || "#ccc" }}>
          <span style={{ color: "#444" }}>{e.time.toFixed(1)}s</span> {e.text}
          {debug && e.sourceId && (
            <span style={{ color: "#555", marginLeft: 4 }}>#{e.sourceId}</span>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
export default BattleLog;
