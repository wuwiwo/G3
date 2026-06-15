import React, { useState } from "react";
import { CharacterDef, RACE_NAMES, Race, Equipment } from "../types";
import {
  useCustomData,
  CustomOverride,
  mergeOverride,
} from "../hooks/useCustomData";
import { getBaseBondTiers, BondEffect } from "../data/races";
import { refreshCharacterMap, ALL_CHARACTERS } from "../data/characters";
import { ALL_EQUIPMENT, EQUIPMENT_MAP } from "../data/equipment";

interface Props {
  onClose: () => void;
}

const LEVEL = 100;

function toBase(lv100: number, growth: number) {
  return Math.round((lv100 - growth * (LEVEL - 1)) * 10) / 10;
}
function toLv100(base: number, growth: number) {
  return Math.round((base + growth * (LEVEL - 1)) * 10) / 10;
}

function StatRow({
  label,
  lv100,
  growth,
  onChange,
}: {
  label: string;
  lv100: number;
  growth: number;
  onChange: (lv100: number, growth: number) => void;
}) {
  const base = toBase(lv100, growth);
  const inp: React.CSSProperties = {
    width: 56,
    background: "#1a1a2e",
    border: "1px solid #333",
    color: "#ddd",
    borderRadius: 4,
    padding: "4px 4px",
    fontSize: 11,
    fontFamily: "monospace",
    textAlign: "center",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        marginBottom: 3,
      }}
    >
      <span style={{ color: "#888", width: 30 }}>{label}</span>
      <input
        type="number"
        step={1}
        value={Math.round(base)}
        onChange={(e) =>
          onChange(toLv100(parseFloat(e.target.value) || 0, growth), growth)
        }
        style={inp}
      />
      <span style={{ color: "#444" }}>+</span>
      <input
        type="number"
        step={0.1}
        value={growth}
        onChange={(e) => {
          const g = parseFloat(e.target.value) || 0;
          onChange(toLv100(base, g), g);
        }}
        style={{ ...inp, width: 50 }}
      />
      <span style={{ color: "#555", fontSize: 9 }}>/级</span>
      <span style={{ color: "#4a9eff", marginLeft: "auto", fontSize: 10 }}>
        Lv.{LEVEL} {toLv100(base, growth).toFixed(0)}
      </span>
    </div>
  );
}

export const DataEditor: React.FC<Props> = ({ onClose }) => {
  const {
    store,
    getOverride,
    setOverride,
    removeOverride,
    resetAll,
    updateBond,
    resetBond,
    getBondOverrides,
  } = useCustomData();
  const [tab, setTab] = useState<"chars" | "bonds" | "equip">("chars");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");

  // We need allCharacters. We can't import from characters.ts directly without the refreshCharacterMap.
  // Use dynamic import or pass from App. Let's import statically.
  const allChars: CharacterDef[] = ALL_CHARACTERS || [];

  const char = allChars.find((c: CharacterDef) => c.id === selectedId);
  const override = getOverride(selectedId);
  const merged = char ? mergeOverride(char, override) : null;
  const bondOverrides = getBondOverrides();

  const update = (patch: Partial<CustomOverride>) => {
    const current = override ? { ...override } : {};
    if (patch.stats) current.stats = { ...current.stats, ...patch.stats };
    if (patch.growth) current.growth = { ...current.growth, ...patch.growth };
    if (patch.skill) current.skill = { ...current.skill, ...patch.skill };
    setOverride(selectedId, current);
  };

  const handleSaveAndClose = () => {
    refreshCharacterMap();
    onClose();
  };

  const filtered = allChars.filter(
    (c: CharacterDef) => c.name.includes(search) || c.id.includes(search)
  );

  return (
    <div
      style={{
        padding: "8px 10px 20px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: 600,
        margin: "0 auto",
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 0,
          marginBottom: 10,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #222",
        }}
      >
        <button
          onClick={() => setTab("chars")}
          style={{
            flex: 1,
            padding: "8px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            background: tab === "chars" ? "#1a3a5c" : "#111",
            color: tab === "chars" ? "#4a9eff" : "#666",
          }}
        >
          📝 角色属性
        </button>
        <button
          onClick={() => setTab("bonds")}
          style={{
            flex: 1,
            padding: "8px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            background: tab === "bonds" ? "#1a3a5c" : "#111",
            color: tab === "bonds" ? "#ff9800" : "#666",
          }}
        >
          🏛 羁绊加成
        </button>
        <button
          onClick={() => setTab("equip")}
          style={{
            flex: 1,
            padding: "8px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            background: tab === "equip" ? "#1a3a5c" : "#111",
            color: tab === "equip" ? "#4caf50" : "#666",
          }}
        >
          🎒 装备数据
        </button>
      </div>

      {tab === "chars" && (
        <>
          {/* Search + selector */}
          <input
            placeholder="搜索角色名或ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...inpStyle,
              width: "100%",
              marginBottom: 8,
              padding: "8px 10px",
              fontSize: 13,
              borderRadius: 6,
            }}
          />
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {filtered.slice(0, 20).map((c: CharacterDef) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  borderRadius: 4,
                  cursor: "pointer",
                  border: "1px solid #333",
                  background: c.id === selectedId ? "#1a3a5c" : "#111",
                  color: c.id === selectedId ? "#fff" : "#888",
                  fontWeight: c.id === selectedId ? 600 : 400,
                }}
              >
                {c.name}
                {store[c.id] && (
                  <span style={{ color: "#f90", marginLeft: 3, fontSize: 9 }}>
                    ✎
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Selected character editor */}
          {merged && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  padding: "8px 10px",
                  background: "#111",
                  borderRadius: 6,
                }}
              >
                <div>
                  <span
                    style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}
                  >
                    {merged.name}
                  </span>
                  <span style={{ color: "#888", fontSize: 10, marginLeft: 6 }}>
                    {RACE_NAMES[merged.race]} · {merged.id}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {override && (
                    <button
                      onClick={() => removeOverride(selectedId)}
                      style={resetBtn}
                    >
                      恢复默认
                    </button>
                  )}
                </div>
              </div>

              <Card title={`属性`}>
                <div style={{ color: "#555", fontSize: 10, marginBottom: 6 }}>
                  Lv.1 基础值 + 每级成长 → Lv.{LEVEL} 自动计算
                </div>
                <StatRow
                  label="HP"
                  lv100={merged.stats.hp}
                  growth={merged.growth.hp}
                  onChange={(lv100, growth) =>
                    update({ stats: { hp: lv100 }, growth: { hp: growth } })
                  }
                />
                <StatRow
                  label="攻击"
                  lv100={merged.stats.attack}
                  growth={merged.growth.attack}
                  onChange={(lv100, growth) =>
                    update({
                      stats: { attack: lv100 },
                      growth: { attack: growth },
                    })
                  }
                />
                <StatRow
                  label="物防"
                  lv100={merged.stats.physicalDef}
                  growth={merged.growth.physicalDef}
                  onChange={(lv100, growth) =>
                    update({
                      stats: { physicalDef: lv100 },
                      growth: { physicalDef: growth },
                    })
                  }
                />
                <StatRow
                  label="魔防"
                  lv100={merged.stats.magicalDef}
                  growth={merged.growth.magicalDef}
                  onChange={(lv100, growth) =>
                    update({
                      stats: { magicalDef: lv100 },
                      growth: { magicalDef: growth },
                    })
                  }
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 6,
                  }}
                >
                  <span style={{ color: "#888", fontSize: 11, width: 60 }}>
                    攻击间隔
                  </span>
                  <input
                    type="number"
                    step={0.1}
                    value={merged.stats.attackInterval}
                    onChange={(e) =>
                      update({
                        stats: {
                          attackInterval: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    style={{ width: 56, ...inpStyle, textAlign: "center" }}
                  />
                  <span style={{ color: "#555", fontSize: 11 }}>秒</span>
                </div>
              </Card>

              <Card title="技能">
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <LabeledInput
                    label="冷却(s)"
                    value={merged.skill.cooldown}
                    step={0.1}
                    onChange={(v) => update({ skill: { cooldown: v } })}
                  />
                  <LabeledInput
                    label="施法(s)"
                    value={merged.skill.castTime}
                    step={0.1}
                    onChange={(v) => update({ skill: { castTime: v } })}
                  />
                </div>
                {merged.skill.damage &&
                  merged.skill.damage.map((d: any, i: number) => (
                    <div key={i} style={{ marginTop: 6 }}>
                      <div
                        style={{ color: "#666", fontSize: 10, marginBottom: 2 }}
                      >
                        伤害倍率
                        {merged!.skill.damage!.length > 1 ? ` #${i + 1}` : ""}
                        <span style={{ color: "#888" }}>
                          {" "}
                          ≈{" "}
                          {Math.floor(
                            merged!.stats.attack * (d.atkRatio ?? 1)
                          )}{" "}
                          伤
                        </span>
                      </div>
                      <input
                        type="number"
                        step={0.05}
                        value={d.atkRatio ?? 1}
                        onChange={(e) => {
                          const dmg = [...(merged!.skill.damage || [])];
                          dmg[i] = {
                            ...dmg[i],
                            atkRatio: parseFloat(e.target.value) || 0,
                          };
                          update({ skill: { damage: dmg } });
                        }}
                        style={{ width: 80, ...inpStyle }}
                      />
                    </div>
                  ))}
                {merged.skill.heal && (
                  <div style={{ marginTop: 6 }}>
                    <LabeledInput
                      label="治疗倍率"
                      value={merged.skill.heal.atkRatio ?? 1}
                      step={0.05}
                      onChange={(v) =>
                        update({
                          skill: {
                            heal: { ...merged!.skill.heal!, atkRatio: v },
                          },
                        })
                      }
                    />
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {tab === "bonds" && (
        <div>
          {Object.entries(getBaseBondTiers()).map(([race, tiers]) => {
            const ov = bondOverrides[race] || {};
            const eff4 = tiers[4] || {};
            const atk = ov.attackBonus ?? eff4.attackBonus ?? 0;
            const def = ov.defenseBonus ?? eff4.defenseBonus ?? 0;
            const hp = ov.hpBonus ?? eff4.hpBonus ?? 0;
            const sp = ov.special ?? eff4.special ?? "";
            return (
              <Card
                key={race}
                title={`${RACE_NAMES[race as Race]} · 2名/3名/4名分档`}
              >
                <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>
                  2名: 攻+{tiers[2]?.attackBonus ?? 0}% 防+
                  {tiers[2]?.defenseBonus ?? 0}% HP+{tiers[2]?.hpBonus ?? 0}%
                  {" | "}3名: 攻+{tiers[3]?.attackBonus ?? 0}% 防+
                  {tiers[3]?.defenseBonus ?? 0}% HP+{tiers[3]?.hpBonus ?? 0}%
                  {" | "}4名: 攻+{tiers[4]?.attackBonus ?? 0}% 防+
                  {tiers[4]?.defenseBonus ?? 0}% HP+{tiers[4]?.hpBonus ?? 0}%
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
                  <LabeledInput
                    label="攻击+%(覆写)"
                    value={atk}
                    onChange={(v) => updateBond(race, { attackBonus: v })}
                  />
                  <LabeledInput
                    label="防御+%(覆写)"
                    value={def}
                    onChange={(v) => updateBond(race, { defenseBonus: v })}
                  />
                  {hp > 0 && (
                    <LabeledInput
                      label="HP+%(覆写)"
                      value={hp}
                      onChange={(v) => updateBond(race, { hpBonus: v })}
                    />
                  )}
                </div>
                <input
                  value={sp}
                  onChange={(e) =>
                    updateBond(race, { special: e.target.value })
                  }
                  style={{ ...inpStyle, width: "100%", fontSize: 10 }}
                  placeholder="特殊效果覆写..."
                />
                {bondOverrides[race] && (
                  <div style={{ marginTop: 4 }}>
                    <button onClick={() => resetBond(race)} style={resetBtn}>
                      恢复默认
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {tab === "equip" && (
        <div>
          {ALL_EQUIPMENT.map((eq) => (
            <Card key={eq.id} title={`🎒 ${eq.name}`}>
              <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>
                {eq.description}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {eq.stats?.attackPercent != null && (
                  <span style={{ fontSize: 9, color: "#f44336" }}>
                    攻+{eq.stats.attackPercent}%
                  </span>
                )}
                {eq.stats?.hpPercent != null && (
                  <span style={{ fontSize: 9, color: "#4caf50" }}>
                    HP+{eq.stats.hpPercent}%
                  </span>
                )}
                {eq.stats?.physicalDefPercent != null && (
                  <span style={{ fontSize: 9, color: "#ff9800" }}>
                    物防+{eq.stats.physicalDefPercent}%
                  </span>
                )}
                {eq.stats?.magicalDefPercent != null && (
                  <span style={{ fontSize: 9, color: "#7c4dff" }}>
                    魔防+{eq.stats.magicalDefPercent}%
                  </span>
                )}
                {eq.stats?.critRate != null && (
                  <span style={{ fontSize: 9, color: "#e91e63" }}>
                    暴击+{eq.stats.critRate}%
                  </span>
                )}
                {eq.stats?.hitRate != null && (
                  <span style={{ fontSize: 9, color: "#2196f3" }}>
                    命中+{eq.stats.hitRate}%
                  </span>
                )}
                {eq.stats?.lifeSteal != null && (
                  <span style={{ fontSize: 9, color: "#e91e63" }}>
                    吸血+{eq.stats.lifeSteal}%
                  </span>
                )}
                {(!eq.stats || Object.keys(eq.stats).length === 0) && (
                  <span style={{ fontSize: 9, color: "#888" }}>
                    被动效果（无属性加成）
                  </span>
                )}
              </div>
              <div style={{ fontSize: 8, color: "#555", marginTop: 4 }}>
                标签: {eq.tags?.join(", ") || "无"}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Save / Reset bar */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          justifyContent: "center",
          padding: "10px 0",
        }}
      >
        <button
          onClick={handleSaveAndClose}
          style={{
            padding: "10px 32px",
            fontSize: 13,
            fontWeight: 700,
            background: "#4a9eff",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          ✅ 保存并生效
        </button>
        <button
          onClick={resetAll}
          style={{
            padding: "10px 20px",
            fontSize: 13,
            background: "#3a1515",
            color: "#f88",
            border: "1px solid #622",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          🗑 全部重置
        </button>
      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div
    style={{
      marginBottom: 10,
      padding: 10,
      background: "#111",
      borderRadius: 8,
      border: "1px solid #222",
    }}
  >
    <div
      style={{
        color: "#4a9eff",
        fontSize: 11,
        fontWeight: 600,
        marginBottom: 8,
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const LabeledInput: React.FC<{
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}> = ({ label, value, step = 1, onChange }) => (
  <div style={{ flex: 1 }}>
    <div style={{ color: "#666", fontSize: 9, marginBottom: 2 }}>{label}</div>
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{ ...inpStyle, width: "100%" }}
    />
  </div>
);

const inpStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  color: "#ddd",
  borderRadius: 4,
  padding: "4px 6px",
  fontSize: 11,
  fontFamily: "monospace",
  boxSizing: "border-box",
};
const resetBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #622",
  color: "#f88",
  borderRadius: 4,
  padding: "2px 8px",
  fontSize: 10,
  cursor: "pointer",
};

export default DataEditor;
