import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CharacterDef } from "../types";
import Avatar, { inferRole, ROLE_ICON } from "./Avatar";

/** 右键介绍浮层的定位目标。 */
export interface IntroTarget {
  char: CharacterDef;
  /** 鼠标位置（视口坐标） */
  x: number;
  y: number;
  /** 来自布阵格子时记录格子下标，用于浮层内的「移除」按钮 */
  slotIndex?: number;
  /** 「前排·第1格」 */
  slotLabel?: string;
  /** 该格已装备的装备名 */
  equipmentName?: string;
}

interface Props {
  target: IntroTarget;
  raceColor: string;
  raceLabel: string;
  onClose: () => void;
  /** 仅当右键布阵格子时提供 */
  onRemove?: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  tank: "前排坦克",
  dps: "近战输出",
  support: "辅助治疗",
  ranged: "远程输出",
};

/** 防御 → 减伤百分比（与 CharDetail 中的口径一致） */
function defRed(def: number): string {
  return (Math.min(def / (def + 200), 0.8) * 100).toFixed(1);
}

function Section({
  title,
  meta,
  tone,
  children,
}: {
  title: string;
  meta?: string;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="char-intro-section">
      <div className="char-intro-section-title" style={{ color: tone }}>
        {title}
        {meta && <span className="char-intro-section-meta">{meta}</span>}
      </div>
      <div className="char-intro-section-body">{children}</div>
    </div>
  );
}

/**
 * 部署页「右键查看介绍」浮层。
 *
 * - 用 createPortal 挂到 body，避免被 TeamPanel 的 overflow/transform 裁剪或
 *   被祖先元素创建的 containing block 影响 fixed 定位。
 * - 位置按鼠标坐标计算，并在 useLayoutEffect 里测量自身尺寸做视口边界收敛。
 * - 左键点击外部 / Esc / 页面滚动 / 窗口尺寸变化均自动关闭。
 */
const CharIntroPopover: React.FC<Props> = ({
  target,
  raceColor,
  raceLabel,
  onClose,
  onRemove,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const { char, x, y, slotLabel, equipmentName } = target;
  const s = char.stats;
  const role = inferRole(s);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(x + 14, window.innerWidth - r.width - 8));
    const top = Math.max(
      8,
      Math.min(y + 14, window.innerHeight - r.height - 8)
    );
    setPos({ left, top });
  }, [x, y, char.id, slotLabel, equipmentName]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      // 右键：交由新目标的 onContextMenu 更新浮层，不在这里关闭
      if (e.button === 2) return;
      if (ref.current?.contains(e.target as Node)) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const dismiss = () => closeRef.current();
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss);
    };
  }, []);

  const stats: { label: string; value: string }[] = [
    { label: "生命", value: s.hp.toLocaleString() },
    { label: "攻击", value: s.attack.toLocaleString() },
    { label: "物防", value: `${s.physicalDef} · ${defRed(s.physicalDef)}%` },
    { label: "魔防", value: `${s.magicalDef} · ${defRed(s.magicalDef)}%` },
    { label: "攻速", value: `${s.attackInterval}s / 次` },
    { label: "技能CD", value: `${char.skill.cooldown}s` },
  ];

  return createPortal(
    <div
      ref={ref}
      className="char-intro"
      style={{
        position: "fixed",
        left: pos?.left ?? x + 14,
        top: pos?.top ?? y + 14,
        visibility: pos ? "visible" : "hidden",
        ["--intro-accent" as any]: raceColor,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="char-intro-head">
        <Avatar name={char.name} race={char.race} stats={s} size={48} />
        <div className="char-intro-title">
          <div className="char-intro-name">{char.name}</div>
          <div className="char-intro-sub" style={{ color: raceColor }}>
            {raceLabel} · {ROLE_ICON[role]} {ROLE_LABEL[role]}
          </div>
          <div className="char-intro-chips">
            {slotLabel && (
              <span className="char-intro-chip">📍 {slotLabel}</span>
            )}
            {equipmentName && (
              <span className="char-intro-chip eq">🎒 {equipmentName}</span>
            )}
          </div>
        </div>
        <button
          className="char-intro-close"
          onClick={onClose}
          title="关闭（Esc）"
        >
          ✕
        </button>
      </div>

      <div className="char-intro-stats">
        {stats.map((it) => (
          <div className="char-intro-stat" key={it.label}>
            <span>{it.label}</span>
            <b>{it.value}</b>
          </div>
        ))}
      </div>

      <Section title="天赋" tone="#ffb74d">
        {char.talent}
      </Section>

      <Section
        title={`技能 · ${char.skill.name}`}
        meta={`CD ${char.skill.cooldown}s · ${
          char.skill.castTime > 0 ? `施法 ${char.skill.castTime}s` : "瞬发"
        }`}
        tone="#64b5f6"
      >
        {char.skill.description}
        {char.skill.tags?.length > 0 && (
          <div className="char-intro-tags">
            {char.skill.tags.map((t) => (
              <span className="char-intro-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
      </Section>

      <div className="char-intro-foot">
        {onRemove && (
          <button
            className="char-intro-remove"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            🗑 移除该角色
          </button>
        )}
        <span className="char-intro-hint">
          右键任意角色看介绍 · Shift+右键直接移除 · Esc 关闭
        </span>
      </div>
    </div>,
    document.body
  );
};

export default CharIntroPopover;
