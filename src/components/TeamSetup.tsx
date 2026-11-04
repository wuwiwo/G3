import React, { useState, useEffect, useRef } from "react";
import { Row, Race, RACE_NAMES, CharacterDef } from "../types";
import { ALL_CHARACTERS, CHARACTER_MAP } from "../data/characters";
import { ALL_EQUIPMENT, EQUIPMENT_MAP } from "../data/equipment";
import CharDetail from "./CharDetail";
import { useSavedTeams } from "../hooks/useSavedTeams";
import { calcBondsFromDefs } from "../engine/bonds";

const RACE_ORDER: Race[] = [
  "beast",
  "hunter",
  "warrior",
  "mage",
  "undead",
  "dragon",
  "holy",
] as any;

// ─── 主题色板（暗金王座 · Qwen 方案） ───
const THEME = {
  bg: "var(--bg)",
  bgGradient: "var(--bg-grad)",
  panel: "var(--panel)",
  panelGradient: "var(--panel-grad)",
  panelBorder: "var(--panel-border)",
  panelBorderBright: "var(--panel-border-bright)",
  panelShadow: "var(--shadow)",
  panelInnerGlow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  slotEmpty: "var(--slot-empty)",
  slotEmptyBorder: "var(--slot-border)",
  slotHover: "rgba(94,158,255,0.08)",
  slotHoverBorder: "rgba(94,158,255,0.35)",
  slotDragging: "rgba(94,158,255,0.12)",
  slotDraggingBorder: "rgba(94,158,255,0.55)",
  text: "var(--text)",
  textDim: "var(--text-dim)",
  textFaint: "var(--text-faint)",
  accent: "var(--accent)",
  accentGlow: "color-mix(in srgb, var(--accent) 30%, transparent)",
  danger: "var(--danger)",
  ok: "var(--ok)",
  okGlow: "rgba(92,196,122,0.35)",
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
};
// 种族色（提亮版）
const RC: Record<string, string> = {
  beast: "var(--race-beast)",
  hunter: "var(--race-hunter)",
  warrior: "var(--race-warrior)",
  mage: "var(--race-mage)",
  undead: "var(--race-undead)",
  dragon: "var(--race-dragon)",
  holy: "var(--race-holy)",
};
const RC_DIM: Record<string, string> = {
  beast: "color-mix(in srgb, var(--race-beast) 18%, transparent)",
  hunter: "color-mix(in srgb, var(--race-hunter) 18%, transparent)",
  warrior: "color-mix(in srgb, var(--race-warrior) 18%, transparent)",
  mage: "color-mix(in srgb, var(--race-mage) 18%, transparent)",
  undead: "color-mix(in srgb, var(--race-undead) 18%, transparent)",
  dragon: "color-mix(in srgb, var(--race-dragon) 18%, transparent)",
  holy: "color-mix(in srgb, var(--race-holy) 18%, transparent)",
};
const RL: Record<string, string> = {
  beast: "兽族",
  hunter: "猎人",
  warrior: "战士",
  mage: "法师",
  undead: "亡灵",
  dragon: "龙族",
  holy: "圣职者",
};
const ROW_LABELS = ["前排", "中排", "后排"];

export interface SlotInfo {
  charId: string;
  row: Row;
  col: number;
  equipmentId?: string;
}
function posRC(i: number): { row: Row; col: number } {
  return { row: Math.floor(i / 3) as Row, col: i % 3 };
}

const EQ_ICONS: Record<string, string> = {
  daedalus: "🗡",
  arcane_shield: "🛡",
  heart: "❤",
  divine_rapier: "⚔",
  desolator: "🔪",
  holy_locket: "📿",
  poison_blade: "🗡",
  turban: "🧣",
  black_turban: "🎭",
  magic_adapter: "🔮",
  wave_suppressor: "🌊",
  formation_breaker: "💥",
  dragon_heart: "🐉",
  bone_gnaw: "🦴",
  battle_aid: "🤝",
  victory_horn: "📯",
  cursed_tome: "📕",
  demon_slayer: "⚡",
  hard_helm: "⛑",
  life_boots: "👢",
};

/** 一键部署：种族角色按 前排(HP最高3) → 中排 → 后排(治疗类) 自动布阵 */
function deployOrder(race: Race): CharacterDef[] {
  const chars = ALL_CHARACTERS.filter((c) => c.race === race);
  const isHealer = (c: CharacterDef) =>
    c.skill.tags?.includes("治疗") || c.skill.heal !== undefined;
  const tanks = [...chars]
    .sort((a, b) => b.stats.hp - a.stats.hp)
    .slice(0, 3);
  const rest = chars.filter((c) => !tanks.includes(c));
  const healers = rest.filter(isHealer);
  const dps = rest.filter((c) => !isHealer(c));
  return [...tanks, ...dps, ...healers].slice(0, 9);
}

function TeamPanel({
  side,
  label,
  color,
  active,
  onFocus,
  onChange,
}: {
  side: "ally" | "enemy";
  label: string;
  color: string;
  active: boolean;
  onFocus: () => void;
  onChange?: (data: SlotInfo[]) => void;
}) {
  const { teams, saveTeam, deleteTeam } = useSavedTeams();
  const [grid, setGrid] = useState<
    { charId: string | null; equipmentId?: string | null }[]
  >(Array.from({ length: 9 }, () => ({ charId: null, equipmentId: null })));
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<CharacterDef | null>(null);
  const [pool, setPool] = useState(true);
  const [exp, setExp] = useState<Record<string, boolean>>({
    beast: false,
    hunter: false,
    warrior: false,
    mage: false,
    undead: false,
    dragon: false,
    holy: false,
  });
  const [sname, setSname] = useState("");
  const [equipMode, setEquipMode] = useState(false);
  const [equipSel, setEquipSel] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragRef = useRef<{ charId: string; from?: number } | null>(null);

  const placed = grid.filter((s) => s.charId).length;
  const bonds = calcBondsFromDefs(grid);

  const emit = (
    g: { charId: string | null; equipmentId?: string | null }[]
  ) => {
    const data = g
      .map((s, i) => {
        const rc = posRC(i);
        return {
          charId: s.charId || "",
          row: rc.row,
          col: rc.col,
          equipmentId: s.equipmentId || undefined,
        };
      })
      .filter((s) => s.charId);
    if (onChange) onChange(data as SlotInfo[]);
  };

  // ─── 拖拽：角色 → 格子 ───
  const onDropChar = (i: number) => {
    const d = dragRef.current;
    setDragOver(null);
    if (!d) return;
    const ng = grid.map((s) => ({ ...s }));
    // 从格子拖出（换位/移动）
    if (d.from !== undefined) {
      if (d.from === i) return;
      const tmp = ng[i];
      ng[i] = { ...ng[d.from], equipmentId: ng[i].equipmentId || ng[d.from].equipmentId };
      ng[d.from] = tmp;
    } else {
      // 从池子拖入
      const ex = ng.findIndex((s) => s.charId === d.charId);
      if (ex >= 0) ng[ex] = { charId: null, equipmentId: null };
      if (ng[i].charId && d.from === undefined && placed >= 8) return;
      ng[i] = { charId: d.charId, equipmentId: ng[i].equipmentId };
      setSel(null);
    }
    setGrid(ng);
    emit(ng);
    dragRef.current = null;
  };
  // 拖出移除（拖到面板外/移除区）
  const onDragRemove = () => {
    const d = dragRef.current;
    if (!d) return;
    if (d.from !== undefined) {
      const ng = grid.map((s) => ({ ...s }));
      ng[d.from!] = { charId: null, equipmentId: null };
      setGrid(ng);
      emit(ng);
    }
    dragRef.current = null;
  };

  const clickGrid = (i: number) => {
    onFocus();
    if (equipMode) {
      const ng = grid.map((s) => ({ ...s }));
      if (!ng[i].charId) return;
      if (equipSel) {
        // 选中装备 → 装备到该角色
        for (let j = 0; j < ng.length; j++) {
          if (ng[j].equipmentId === equipSel)
            ng[j] = { ...ng[j], equipmentId: null };
        }
        ng[i] = { ...ng[i], equipmentId: equipSel };
        setEquipSel(null);
      } else {
        // 未选中 → 移除该格装备
        ng[i] = { ...ng[i], equipmentId: null };
      }
      setGrid(ng);
      emit(ng);
      return;
    }
    if (!sel) return;
    const ng = grid.map((s) => ({ ...s }));
    const ex = ng.findIndex((s) => s.charId === sel);
    if (ex >= 0) ng[ex] = { charId: null, equipmentId: null };
    if (ng[i].charId === null || placed < 8)
      ng[i] = { charId: sel, equipmentId: ng[i].equipmentId };
    setGrid(ng);
    setSel(null);
    emit(ng);
  };

  const remove = (i: number) => {
    const ng = grid.map((s) => ({ ...s }));
    ng[i] = { charId: null, equipmentId: null };
    setGrid(ng);
    emit(ng);
  };

  const randomize = () => {
    const p = [...ALL_CHARACTERS].sort(() => Math.random() - 0.5);
    const ng = Array.from({ length: 9 }, (_, i) =>
      i === 8
        ? { charId: null, equipmentId: null }
        : { charId: p[i % p.length].id, equipmentId: null }
    );
    setGrid(ng);
    emit(ng);
  };
  const clear = () => {
    const ng = Array.from({ length: 9 }, () => ({
      charId: null,
      equipmentId: null,
    }));
    setGrid(ng);
    emit(ng);
  };
  /** 一键部署种族 */
  const deploy = (race: Race) => {
    onFocus();
    const order = deployOrder(race);
    const ng = grid.map((s) => {
      if (s.charId && CHARACTER_MAP.get(s.charId)?.race === race)
        return { charId: null, equipmentId: null };
      return { ...s };
    });
    let idx = 0;
    for (const ch of order) {
      while (idx < 9 && ng[idx].charId) idx++;
      if (idx >= 9) break;
      ng[idx] = { charId: ch.id, equipmentId: null };
      idx++;
    }
    setGrid(ng);
    emit(ng);
  };

  const load = (t: any) => {
    const ng = Array.from({ length: 9 }, () => ({
      charId: null,
      equipmentId: null,
    }));
    (t?.units || t || []).slice(0, 9).forEach((u: any) => {
      if (u.charId) {
        const idx = (u.row ?? 0) * 3 + (u.col ?? 0);
        if (idx >= 0 && idx < 9)
          ng[idx] = { charId: u.charId, equipmentId: u.equipmentId || null };
      }
    });
    setGrid(ng);
    emit(ng);
  };
  useEffect(() => {
    emit(grid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raceRows = RACE_ORDER.map((r) => ({
    race: r,
    chars: ALL_CHARACTERS.filter((c) => c.race === r),
    open: exp[r],
  }));

  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    height: "var(--btn-h)",
    padding: "0 12px",
    fontSize: "var(--font-sm)",
    fontWeight: 600,
    background: "var(--btn-bg)",
    color: THEME.textDim,
    border: `1px solid ${THEME.panelBorder}`,
    borderRadius: THEME.radiusSm,
    cursor: "pointer",
    transition: "all .15s",
    ...extra,
  });

  return (
    <div
      style={{
        marginBottom: 12,
        background: THEME.panelGradient,
        borderRadius: THEME.radiusLg,
        border: active
          ? `1.5px solid ${color}55`
          : `1px solid ${THEME.panelBorder}`,
        boxShadow: active
          ? `${THEME.panelShadow}, 0 0 20px ${color}12`
          : THEME.panelShadow,
        padding: 16,
        transition: "border-color .25s ease, box-shadow .25s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 顶部装饰色带 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: active
            ? `linear-gradient(90deg, transparent, ${color}80, transparent)`
            : "transparent",
          transition: "background .3s ease",
        }}
      />
      {/* ── 面板头 ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 2,
              background: color,
              boxShadow: `0 0 6px ${color}66`,
            }}
          />
          <span>{label}</span>
          <span style={{ fontSize: 12, color: THEME.textDim, fontWeight: 600 }}>
            {placed}/8
          </span>
          {sel && (
            <span style={{ fontSize: 10, color: THEME.ok, marginLeft: 6 }}>
              ✓ 已选，点击格子放置
            </span>
          )}
        </span>
        <div className="panel-controls" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button
            onClick={() => setEquipMode(!equipMode)}
            style={btn(equipMode ? { background: "#5c4a1e", color: "#ffd76a", borderColor: "#8a6d1f" } : {})}
          >
            {equipMode ? "✅ 装备" : "🎒 装备"}
          </button>
          <button onClick={() => setPool(!pool)} style={btn()}>
            {pool ? "🔼" : "🔽"} 角色
          </button>
          <button onClick={clear} style={btn({ color: THEME.textDim })}>
            清空
          </button>
          <button onClick={randomize} style={btn({ color: THEME.textDim })}>
            🎲 随机
          </button>
        </div>
      </div>

      {/* ── 羁绊 ── */}
      {bonds.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
          {bonds.map((b) => (
            <span
              key={b.race}
              className="bond-chip"
              style={{
                fontSize: 12,
                padding: "5px 12px",
                borderRadius: 20,
                background: `linear-gradient(135deg, ${RC_DIM[b.race]} 0%, color-mix(in srgb, var(--panel) 85%, transparent) 100%)`,
                color: RC[b.race],
                fontWeight: 600,
                border: `1px solid color-mix(in srgb, ${RC[b.race]} 30%, transparent)`,
                boxShadow: `0 1px 4px rgba(0,0,0,0.3), inset 0 1px 0 ${RC[b.race]}15`,
                letterSpacing: 0.3,
                textShadow: `0 0 8px color-mix(in srgb, ${RC[b.race]} 20%, transparent)`,
              }}
            >
              {RL[b.race]}×{b.count} ·{" "}
              <b style={{ color: "var(--accent)", fontWeight: 700 }}>
                {b.desc}
              </b>
            </span>
          ))}
        </div>
      )}

      {/* ── 3×3 布阵 ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr",
          gap: 4,
          marginBottom: 8,
          background: "rgba(0,0,0,0.35)",
          padding: 8,
          borderRadius: THEME.radiusMd,
          border: `1px solid ${THEME.panelBorder}`,
          boxShadow: `inset 0 2px 8px rgba(0,0,0,0.4), ${THEME.panelInnerGlow}`,
        }}
      >
        <div style={{ display: "contents" }}>
          {[0, 1, 2].map((r) => (
            <div
              key={r}
              style={{
                fontSize: 10,
                color: THEME.textDim,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {ROW_LABELS[r]}
            </div>
          ))}
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}
        >
          {grid.map((slot, i) => {
            const ch = slot.charId
              ? CHARACTER_MAP.get(slot.charId) || null
              : null;
            const raceColor = ch ? RC[ch.race] : null;
            const eq = slot.equipmentId
              ? EQUIPMENT_MAP.get(slot.equipmentId)
              : null;
            const isOver = dragOver === i;
            return (
              <div
                key={i}
                onClick={() => clickGrid(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (equipMode && slot.equipmentId) {
                    const ng = grid.map((s) => ({ ...s }));
                    ng[i] = { ...ng[i], equipmentId: null };
                    setGrid(ng);
                    emit(ng);
                  } else {
                    remove(i);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== i) setDragOver(i);
                }}
                onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropChar(i);
                }}
                draggable={!!ch}
                onDragStart={(e) => {
                  if (ch) {
                    dragRef.current = { charId: ch.id, from: i };
                    e.dataTransfer.effectAllowed = "move";
                  }
                }}
                onDragEnd={() => {
                  dragRef.current = null;
                  setDragOver(null);
                }}
                style={{
                  height: "var(--slot-size)",
                  borderRadius: 10,
                  background: ch
                    ? `linear-gradient(160deg, color-mix(in srgb, ${raceColor} 15%, transparent) 0%, color-mix(in srgb, var(--panel) 92%, transparent) 100%)`
                    : isOver
                      ? `linear-gradient(135deg, ${THEME.slotDragging}, rgba(94,158,255,0.06))`
                      : `linear-gradient(135deg, ${THEME.slotEmpty}, rgba(0,0,0,0.2))`,
                  border: isOver
                    ? `2px solid ${THEME.slotDraggingBorder}`
                    : ch
                      ? `1.5px solid color-mix(in srgb, ${raceColor} 55%, transparent)`
                      : `1.5px dashed ${THEME.slotEmptyBorder}`,
                  boxShadow: isOver
                    ? `0 0 16px rgba(94,158,255,0.15), inset 0 0 8px rgba(94,158,255,0.08)`
                    : ch
                      ? `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 ${raceColor}22`
                      : "inset 0 1px 3px rgba(0,0,0,0.3)",
                  cursor: ch ? "grab" : sel ? "pointer" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all .12s",
                  position: "relative",
                }}
              >
                {ch ? (
                  <>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--text)",
                        textShadow: "var(--text-shadow)",
                      }}
                    >
                      {ch.name}
                    </span>
                    <span style={{ fontSize: 10, color: raceColor || THEME.textDim, marginTop: 2, fontWeight: 600 }}>
                      {RL[ch.race]}
                    </span>
                    {eq && (
                      <span style={{ fontSize: 7, color: "#ffd76a", marginTop: 1 }}>
                        {EQ_ICONS[eq.id] || "🎒"} {eq.name}
                      </span>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 14, color: "rgba(180,160,120,0.18)", fontWeight: 300 }}>
                    +
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 移除区（拖到这里移除） ── */}
      <div
        className="trash-zone"
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add("dragover");
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("dragover");
          onDragRemove();
        }}
        style={{
          height: 44,
          borderRadius: 10,
          border: `1.5px dashed color-mix(in srgb, var(--danger) 45%, transparent)`,
          color: "var(--danger)",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
          background: "color-mix(in srgb, var(--danger) 5%, transparent)",
          letterSpacing: 0.3,
        }}
      >
        🗑 拖到这里移除
      </div>

      {/* ── 角色池 ── */}
      {pool && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {raceRows.map((rr) => (
            <div
              key={rr.race}
              style={{
                borderRadius: 8,
                background: rr.open ? RC_DIM[rr.race] : "transparent",
                border: rr.open
                  ? `1px solid ${RC[rr.race]}26`
                  : "1px solid transparent",
                overflow: "hidden",
              }}
            >
              <div
                onClick={() =>
                  setExp((e) => ({ ...e, [rr.race]: !e[rr.race] }))
                }
                className="race-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  cursor: "pointer",
                  userSelect: "none",
                  borderRadius: rr.open ? "8px 8px 0 0" : 8,
                  background: rr.open ? "rgba(0,0,0,0.15)" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    color: THEME.textFaint,
                    transition: "transform .2s",
                    transform: rr.open ? "rotate(0deg)" : "rotate(-90deg)",
                  }}
                >
                  ▸
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: RC[rr.race],
                    textShadow: `0 0 12px color-mix(in srgb, ${RC[rr.race]} 22%, transparent)`,
                    letterSpacing: 0.5,
                  }}
                >
                  {RL[rr.race]}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: THEME.textFaint,
                    background: "rgba(255,255,255,0.04)",
                    padding: "1px 5px",
                    borderRadius: 4,
                  }}
                >
                  {rr.chars.length}名
                </span>
                <span style={{ flex: 1 }} />
                <button
                  className="deploy-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    deploy(rr.race);
                  }}
                  style={{
                    height: 34,
                    padding: "0 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: `linear-gradient(135deg, color-mix(in srgb, ${RC[rr.race]} 18%, transparent), color-mix(in srgb, ${RC[rr.race]} 6%, transparent))`,
                    color: RC[rr.race],
                    border: `1px solid color-mix(in srgb, ${RC[rr.race]} 35%, transparent)`,
                    borderRadius: 6,
                    cursor: "pointer",
                    letterSpacing: 0.3,
                    ['--rc-glow' as any]: `${RC[rr.race]}25`,
                  }}
                >
                  ⚡ <span className="deploy-word">一键部署</span>
                </button>
              </div>
              {rr.open && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    padding: "3px 8px 8px",
                  }}
                >
                  {rr.chars.map((ch) => {
                    const isPlaced = grid.some((s) => s.charId === ch.id);
                    return (
                      <div
                        key={ch.id}
                        className="race-btn"
                        draggable={!isPlaced}
                        onDragStart={(e) => {
                          if (isPlaced) {
                            e.preventDefault();
                            return;
                          }
                          dragRef.current = { charId: ch.id };
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        style={{
                          display: "flex",
                          borderRadius: 6,
                          overflow: "hidden",
                          border: `1px solid ${
                            isPlaced
                              ? "rgba(255,255,255,0.06)"
                              : `${RC[rr.race]}30`
                          }`,
                          background: isPlaced
                            ? "rgba(255,255,255,0.02)"
                            : `linear-gradient(90deg, ${RC[rr.race]}15 0%, #161c26 30%, #161c26 100%)`,
                          opacity: isPlaced ? 0.4 : 1,
                          ['--rc-glow' as any]: `${RC[rr.race]}20`,
                          transition: "all .15s",
                        }}
                      >
                        <div
                          onClick={() => {
                            if (!isPlaced) {
                              setSel(ch.id);
                              onFocus();
                            }
                          }}
                          title="点击选择 · 拖拽上阵"
                          style={{
                            padding: "6px 10px",
                            fontSize: "var(--font-sm)",
                            whiteSpace: "nowrap",
                            color: isPlaced ? THEME.textFaint : THEME.text,
                            cursor: isPlaced ? "default" : "pointer",
                            borderLeft: `3px solid ${RC[rr.race]}`,
                            fontWeight: 500,
                          }}
                        >
                          {ch.name}
                          {isPlaced ? " ✓" : ""}
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetail(ch);
                          }}
                          style={{
                            padding: "6px 8px",
                            fontSize: 11,
                            background: "rgba(255,255,255,0.04)",
                            color: THEME.textDim,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          👁
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 存档 ── */}
      <div
        style={{
          display: "flex",
          gap: 5,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 8,
          paddingTop: 8,
          borderTop: `1px solid ${THEME.panelBorder}`,
        }}
      >
        <input
          value={sname}
          onChange={(e) => setSname(e.target.value)}
          placeholder="阵容名"
          style={{
            width: 70,
            fontSize: 10,
            padding: "3px 6px",
            background: "var(--input-bg)",
            border: `1px solid ${THEME.panelBorder}`,
            color: THEME.text,
            borderRadius: 6,
            outline: "none",
          }}
        />
        <button
          onClick={() => {
            if (sname) {
              const d = grid
                .map((s, i) => {
                  const rc = posRC(i);
                  return {
                    charId: s.charId || "",
                    row: rc.row,
                    col: rc.col,
                    equipmentId: s.equipmentId || undefined,
                  };
                })
                .filter((s) => s.charId);
              saveTeam(sname, d as any);
              setSname("");
            }
          }}
          style={{
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 600,
            background: "color-mix(in srgb, var(--accent) 22%, transparent)",
            color: "var(--accent)",
            border: `1px solid color-mix(in srgb, var(--accent) 45%, transparent)`,
            borderRadius: THEME.radiusSm,
            cursor: "pointer",
          }}
        >
          保存
        </button>
        {teams.length > 0 && (
          <select
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (idx >= 0) {
                const t = teams[idx];
                if (t) load(t);
              }
            }}
            style={{
              fontSize: 10,
              padding: "3px 4px",
              background: "var(--input-bg)",
              color: THEME.textDim,
              border: `1px solid ${THEME.panelBorder}`,
              borderRadius: 6,
              maxWidth: 110,
            }}
          >
            <option value="">读取阵容</option>
            {teams.map((t, i) => (
              <option key={t.id} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── 装备模式 ── */}
      {equipMode && (
        <div
          style={{
            marginTop: 8,
            padding: 8,
            background: "color-mix(in srgb, var(--accent) 6%, transparent)",
            borderRadius: 10,
            border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--accent)",
              marginBottom: 5,
              fontWeight: 600,
            }}
          >
            {equipSel
              ? `已选装备 — 点击场上角色装备（右键移除）`
              : `装备区 — 点击装备选择，再点击场上角色装备（最多 6 件）`}
          </div>
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              maxHeight: 110,
              overflowY: "auto",
            }}
          >
            {ALL_EQUIPMENT.map((eq) => {
              const usedBy = grid.findIndex((s) => s.equipmentId === eq.id);
              const selected = equipSel === eq.id;
              return (
                <div
                  key={eq.id}
                  onClick={() => {
                    if (usedBy >= 0) {
                      // 已装备 → 点击取消（移除）
                      const ng = grid.map((s) => ({ ...s }));
                      ng[usedBy] = { ...ng[usedBy], equipmentId: null };
                      setGrid(ng);
                      emit(ng);
                    } else {
                      setEquipSel(selected ? null : eq.id);
                    }
                  }}
                  title={`${eq.name}\n${eq.description}`}
                  style={{
                    fontSize: 9,
                    padding: "3px 7px",
                    borderRadius: 6,
                    background: selected
                      ? "color-mix(in srgb, var(--accent) 25%, transparent)"
                      : usedBy >= 0
                        ? "color-mix(in srgb, var(--ok) 18%, transparent)"
                        : "var(--btn-bg)",
                    color: selected
                      ? "var(--accent)"
                      : usedBy >= 0
                        ? "var(--ok)"
                        : "var(--text-dim)",
                    border: `1px solid ${
                      selected
                        ? "color-mix(in srgb, var(--accent) 60%, transparent)"
                        : usedBy >= 0
                          ? "color-mix(in srgb, var(--ok) 40%, transparent)"
                          : "var(--panel-border)"
                    }`,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                    transition: "all .12s",
                  }}
                >
                  <span>{EQ_ICONS[eq.id] || "🎒"}</span>
                  <span>{eq.name}</span>
                  {usedBy >= 0 && (
                    <span style={{ fontSize: 7, color: "var(--text-faint)" }}>
                      ✓格{usedBy + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 4 }}>
            点击已装备的装备卡可移除 · 悬停查看属性 · 已用{" "}
            {grid.filter((s) => s.equipmentId).length}/6
          </div>
        </div>
      )}

      {/* ── 提示 ── */}
      <div
        style={{
          fontSize: 12,
          color: THEME.textFaint,
          marginTop: 8,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>
          {sel ? (
            "⬆️ 点击格子放置 · 拖拽上阵"
          ) : (
            <>
              <span className="tip-long">拖拽或点击角色 → 上阵 · 右键移除 · </span>⚡一键部署
            </>
          )}
        </span>
      </div>
      {detail && <CharDetail char={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export const TeamSetup: React.FC<{
  onStart: (ally: SlotInfo[], enemy: SlotInfo[]) => void;
}> = ({ onStart }) => {
  const [ally, setAlly] = useState<SlotInfo[]>([]);
  const [enemy, setEnemy] = useState<SlotInfo[]>([]);
  const [focus, setFocus] = useState<"ally" | "enemy">("ally");
  const { teams, deleteTeam } = useSavedTeams();
  const [delMode, setDelMode] = useState(false);
  const ready = ally.length > 0 && enemy.length > 0;

  return (
    <div
      style={{
        padding: "8px 10px 40px",
        maxWidth: 640,
        margin: "0 auto",
        minHeight: "100vh",
        background: THEME.bgGradient,
      }}
    >
      {/* ── 顶栏 ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--bg) 97%, transparent) 0%, color-mix(in srgb, var(--bg) 88%, transparent) 100%)",
          backdropFilter: "blur(12px)",
          padding: "8px 4px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${THEME.panelBorderBright}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: THEME.text,
            letterSpacing: 1,
            textShadow: "var(--text-shadow)",
          }}
        >
          ⚔ 阵容配置
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => setDelMode(!delMode)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              background: delMode ? "color-mix(in srgb, var(--danger) 18%, transparent)" : "var(--btn-bg)",
              color: delMode ? "var(--danger)" : "var(--text-dim)",
              border: `1px solid ${delMode ? "rgba(212,84,90,.4)" : THEME.panelBorder}`,
              borderRadius: THEME.radiusSm,
              cursor: "pointer",
            }}
          >
            {delMode ? "✓ 完成" : "🗑 存档管理"}
          </button>
          <button
            className="start-btn"
            onClick={() => onStart(ally, enemy)}
            disabled={!ready}
            style={{
              padding: "8px 28px",
              fontSize: 13,
              fontWeight: 800,
              border: `1px solid ${ready ? "rgba(92,196,122,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 8,
              background: ready
                ? "linear-gradient(135deg, #2a5a3a 0%, #1a3a28 50%, #2a5a3a 100%)"
                : "var(--btn-bg)",
              color: ready ? "#a8e8c4" : "var(--text-faint)",
              cursor: ready ? "pointer" : "not-allowed",
              boxShadow: ready
                ? "0 3px 16px rgba(92,196,122,0.3), 0 0 24px rgba(92,196,122,0.1), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "none",
              letterSpacing: 1.5,
              textShadow: ready ? "0 0 8px rgba(92,196,122,0.4)" : "none",
            }}
          >
            开始 ⚔️
          </button>
        </div>
      </div>

      {/* 删除存档模式 */}
      {delMode && teams.length > 0 && (
        <div
          style={{
            background: "var(--btn-bg)",
            border: "1px solid rgba(239,107,107,.3)",
            borderRadius: 10,
            padding: 8,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 10, color: "#ff9d9d", marginBottom: 4 }}>
            点击删除存档：
          </div>
          {teams.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px 0",
                borderBottom: "1px solid rgba(255,255,255,.06)",
              }}
            >
              <span style={{ fontSize: 11, color: THEME.textDim }}>{t.name}</span>
              <button
                onClick={() => deleteTeam(t.id)}
                style={{
                  padding: "2px 10px",
                  fontSize: 9,
                  background: "rgba(239,107,107,.15)",
                  color: "#ff9d9d",
                  border: "1px solid rgba(239,107,107,.35)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}

      <TeamPanel
        side="ally"
        label="◆ 我方"
        color="#b8922e"
        active={focus === "ally"}
        onFocus={() => setFocus("ally")}
        onChange={setAlly}
      />
      <div
        style={{
          textAlign: "center",
          fontSize: 14,
          color: THEME.textDim,
          padding: "2px 0",
          letterSpacing: 2,
        }}
      >
        ⚔ VS ⚔
      </div>
      <TeamPanel
        side="enemy"
        label="◆ 敌方"
        color="#b7472a"
        active={focus === "enemy"}
        onFocus={() => setFocus("enemy")}
        onChange={setEnemy}
      />
      {!ready && (
        <div
          style={{
            textAlign: "center",
            color: THEME.textFaint,
            fontSize: 11,
            marginTop: 8,
          }}
        >
          配置双方阵容即可开战
        </div>
      )}
    </div>
  );
};
