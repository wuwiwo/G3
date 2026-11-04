import React, { useMemo } from "react";
import { Race } from "../types";

/**
 * 像素风角色头像（代码绘制，无位图资源）
 *
 * 规格（遵循像素图标统一规范）：
 * - 逻辑网格 16×16，单元格 3×3px，viewBox 48×48，shape-rendering="crispEdges"
 * - 仅使用 <rect>，透明背景，无渐变 / 描边 / opacity，每个头像 ≤ 8 色
 * - 全局统一描边色 OUTLINE，眼睛（视觉焦点）固定在第 7 行，并排时视线齐平
 * - 主体包围盒 x∈[1,14] / y∈[1,14]，四周留 1 格空白
 * - 显示尺寸必须是 16 的整数倍（32/48/64/96），否则 crispEdges 会把格宽硬切成 2/3px
 *
 * 去重策略：种族决定「轮廓 + 特征」，职业决定「底部徽记」，角色名 hash 决定
 * 眉形 / 额饰 / 高光等细节，保证 52 个角色并排时不雷同。
 */
const OUTLINE = "#171a24";
const WHITE = "#f6f5ee";
const PUPIL = "#171a24";

interface Palette {
  m: string; // 主体
  l: string; // 亮部
  d: string; // 暗部
  a: string; // 强调（角 / 宝石 / 光环）
}

const PALETTES: Record<string, Palette> = {
  beast: { m: "#c98f5a", l: "#e8bb85", d: "#8a5a32", a: "#f2e2c0" },
  hunter: { m: "#5fa85a", l: "#9ad47f", d: "#356b39", a: "#e0bb72" },
  warrior: { m: "#c55a5a", l: "#ef8b7d", d: "#7d2f36", a: "#e8c46a" },
  mage: { m: "#5b86d6", l: "#93b9f5", d: "#2f4f96", a: "#d8a8ff" },
  undead: { m: "#a58bc9", l: "#d6c3ee", d: "#5f4789", a: "#7ff0c0" },
  dragon: { m: "#e08a3c", l: "#ffc06b", d: "#9c4d1c", a: "#ff7a5c" },
  holy: { m: "#e8cf7a", l: "#fff3bd", d: "#a98a35", a: "#ffffff" },
};
const FALLBACK: Palette = {
  m: "#8d8d99",
  l: "#c5c5cf",
  d: "#55555f",
  a: "#d8d8e0",
};

export const RACE_COLORS: Record<string, string> = {
  beast: "#8d6e63",
  hunter: "#4caf50",
  warrior: "#f44336",
  mage: "#2196f3",
  undead: "#9c27b0",
  dragon: "#ff9800",
  holy: "#ffd54f",
};

export const RACE_DARK: Record<string, string> = {
  beast: "#3e2723",
  hunter: "#1b5e20",
  warrior: "#b71c1c",
  mage: "#0d47a1",
  undead: "#4a148c",
  dragon: "#e65100",
};

export const RACE_DARK2: Record<string, string> = {
  beast: "#4e342e",
  hunter: "#2e7d32",
  warrior: "#c62828",
  mage: "#1565c0",
  undead: "#6a1b9a",
  dragon: "#ef6c00",
};

export const RACE_BG: Record<string, [string, string, string]> = {
  beast: ["#4e342e", "#3e2723", "#2a1c18"],
  hunter: ["#2e7d32", "#1b5e20", "#0d330d"],
  warrior: ["#c62828", "#b71c1c", "#7a1212"],
  mage: ["#1565c0", "#0d47a1", "#063a7a"],
  undead: ["#6a1b9a", "#4a148c", "#2e0e56"],
  dragon: ["#ef6c00", "#e65100", "#ab3d00"],
};

export const ROLE_ICON: Record<string, string> = {
  tank: "🛡",
  dps: "⚔",
  support: "✦",
  ranged: "🏹",
};

type Role = "tank" | "dps" | "support" | "ranged";

export function inferRole(stats: {
  hp: number;
  attack: number;
  physicalDef: number;
  attackInterval: number;
}): Role {
  const { hp, attack, physicalDef, attackInterval } = stats;
  if (hp > 9000 && physicalDef > 350) return "tank";
  if (attackInterval >= 3.5 && attack < 700) return "ranged";
  if (attack > 800) return "dps";
  if (hp < 6000 && attack < 700) return "support";
  return "dps";
}

type Grid = (string | null)[][];

function blank(): Grid {
  return Array.from({ length: 16 }, () => Array<string | null>(16).fill(null));
}

function put(g: Grid, x: number, y: number, c: string) {
  if (x < 0 || x > 15 || y < 0 || y > 15) return;
  g[y][x] = c;
}

function box(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) put(g, i, j, c);
  }
}

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 绘制 16×16 像素网格 */
function buildGrid(race: string, role: Role, seed: number): Grid {
  const g = blank();
  const p = PALETTES[race] || FALLBACK;

  // ── 通用头部：描边环 + 主体 + 亮额 + 暗下颌 ──
  box(g, 4, 3, 8, 10, OUTLINE);
  box(g, 5, 4, 6, 8, p.m);
  box(g, 5, 4, 6, 2, p.l);
  box(g, 5, 10, 6, 2, p.d);

  // ── 种族特征（同一种视觉母题只归属一个种族）──
  switch (race) {
    case "beast": {
      // 兽耳 + 獠牙 + 宽鼻
      box(g, 2, 2, 3, 3, OUTLINE);
      put(g, 3, 2, p.a);
      put(g, 3, 3, p.m);
      box(g, 11, 2, 3, 3, OUTLINE);
      put(g, 12, 2, p.a);
      put(g, 12, 3, p.m);
      box(g, 7, 9, 2, 1, p.d);
      put(g, 6, 10, p.a);
      put(g, 9, 10, p.a);
      break;
    }
    case "hunter": {
      // 兜帽 + 侧向羽饰 + 面罩
      box(g, 3, 1, 10, 4, OUTLINE);
      box(g, 4, 2, 8, 3, p.d);
      box(g, 5, 3, 6, 2, p.m);
      box(g, 12, 1, 1, 4, p.a);
      put(g, 13, 1, p.a);
      put(g, 11, 2, p.a);
      box(g, 6, 10, 4, 2, p.d);
      break;
    }
    case "warrior": {
      // 重盔 + 盔缨 + 面甲
      box(g, 3, 1, 10, 5, OUTLINE);
      box(g, 4, 2, 8, 4, p.l);
      box(g, 4, 2, 8, 1, p.m);
      box(g, 7, 1, 2, 2, p.a);
      box(g, 5, 6, 6, 1, p.d);
      box(g, 5, 9, 6, 1, OUTLINE);
      box(g, 5, 10, 6, 2, p.d);
      put(g, 7, 10, OUTLINE);
      put(g, 9, 10, OUTLINE);
      break;
    }
    case "mage": {
      // 尖顶法师帽 + 宝石 + 白须
      box(g, 6, 1, 4, 3, OUTLINE);
      box(g, 7, 1, 2, 2, p.m);
      put(g, 7, 2, p.a);
      box(g, 3, 3, 10, 2, OUTLINE);
      box(g, 4, 4, 8, 1, p.d);
      box(g, 6, 11, 4, 2, WHITE);
      box(g, 7, 12, 2, 1, p.l);
      break;
    }
    case "undead": {
      // 骷髅：空眼窝 + 鬼火瞳 + 牙列
      box(g, 5, 4, 6, 8, p.l);
      box(g, 6, 7, 2, 2, OUTLINE);
      box(g, 9, 7, 2, 2, OUTLINE);
      put(g, 6, 7, p.a);
      put(g, 9, 7, p.a);
      box(g, 6, 10, 5, 1, WHITE);
      put(g, 7, 10, OUTLINE);
      put(g, 9, 10, OUTLINE);
      put(g, 8, 9, OUTLINE);
      box(g, 4, 3, 8, 1, p.d);
      break;
    }
    case "dragon": {
      // 双角 + 侧翼 + 额鳞
      box(g, 2, 1, 2, 3, p.a);
      box(g, 12, 1, 2, 3, p.a);
      put(g, 2, 1, p.l);
      put(g, 13, 1, p.l);
      box(g, 1, 6, 2, 4, p.d);
      box(g, 13, 6, 2, 4, p.d);
      put(g, 1, 7, p.a);
      put(g, 14, 7, p.a);
      box(g, 7, 4, 2, 1, p.d);
      put(g, 6, 9, OUTLINE);
      put(g, 9, 9, OUTLINE);
      break;
    }
    case "holy": {
      // 光环 + 额十字 + 白袍领
      box(g, 5, 1, 6, 1, p.a);
      put(g, 4, 2, p.a);
      put(g, 11, 2, p.a);
      box(g, 7, 4, 2, 3, p.a);
      box(g, 6, 5, 4, 1, p.a);
      box(g, 3, 12, 10, 2, WHITE);
      box(g, 4, 13, 8, 1, p.l);
      break;
    }
    default: {
      box(g, 5, 4, 6, 8, p.m);
    }
  }

  // ── 眼睛（非骷髅）：焦点统一在第 7 行 ──
  if (race !== "undead") {
    box(g, 6, 7, 2, 2, WHITE);
    box(g, 9, 7, 2, 2, WHITE);
    put(g, 7, 7, PUPIL);
    put(g, 9, 7, PUPIL);
  }
  box(g, 6, 6, 2, 1, p.d);
  box(g, 9, 6, 2, 1, p.d);

  // ── 名称 hash 变体：眉形 / 额饰 / 高光 ──
  if (seed % 3 === 0) {
    put(g, 6, 6, OUTLINE);
    put(g, 10, 6, OUTLINE);
  }
  if (seed % 4 === 1) put(g, 8, 4, p.a);
  if (seed % 4 === 2) {
    put(g, 7, 4, WHITE);
    put(g, 9, 4, WHITE);
  }
  if (seed % 5 === 0) put(g, 5, 5, WHITE);
  if (race !== "undead" && race !== "warrior") {
    box(g, 7, 10, 2, 1, OUTLINE); // 嘴
  }

  // ── 职业徽记（底部第 13~14 行，不遮挡主体）──
  switch (role) {
    case "tank":
      box(g, 6, 13, 4, 2, OUTLINE);
      box(g, 7, 13, 2, 1, p.l);
      put(g, 7, 14, p.m);
      put(g, 8, 14, p.m);
      break;
    case "support":
      box(g, 7, 13, 2, 2, p.a);
      box(g, 6, 13, 4, 1, p.a);
      break;
    case "ranged":
      box(g, 6, 13, 1, 2, p.a);
      put(g, 7, 13, WHITE);
      put(g, 7, 14, WHITE);
      put(g, 8, 13, p.a);
      break;
    default: // dps：短剑
      box(g, 7, 13, 2, 2, WHITE);
      box(g, 6, 14, 4, 1, p.a);
      break;
  }
  return g;
}

/** 同行相邻同色格合并为更宽的 <rect>，减少节点数 */
function toSvg(grid: Grid): string {
  const parts: string[] = [];
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      const c = grid[y][x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < 16 && grid[y][x + w] === c) w++;
      parts.push(
        `<rect x="${x * 3}" y="${y * 3}" width="${w * 3}" height="3" fill="${c}"/>`
      );
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" shape-rendering="crispEdges">${parts.join("")}</svg>`;
}

const uriCache = new Map<string, string>();

export function avatarDataUri(race: string, name: string, role: Role): string {
  const key = `${race}|${role}|${name}`;
  let uri = uriCache.get(key);
  if (!uri) {
    uri =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(toSvg(buildGrid(race, role, hashName(name))));
    uriCache.set(key, uri);
  }
  return uri;
}

interface AvatarProps {
  name: string;
  race: Race | string;
  stats?: {
    hp: number;
    attack: number;
    physicalDef: number;
    attackInterval: number;
  };
  size?: number;
  dead?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  race,
  stats,
  size = 48,
  dead,
}) => {
  // 显示尺寸必须是 16 的整数倍，避免 crispEdges 把 3px 格切成 2/3px
  const px = Math.max(16, Math.round(size / 16) * 16);
  const role = stats ? inferRole(stats) : "dps";
  const src = useMemo(
    () => avatarDataUri(String(race), name, role),
    [race, name, role]
  );
  return (
    <img
      src={src}
      width={px}
      height={px}
      alt=""
      draggable={false}
      style={{
        imageRendering: "pixelated",
        display: "block",
        flexShrink: 0,
        borderRadius: 6,
        background: "rgba(10,12,18,0.35)",
        filter: dead ? "grayscale(1) brightness(0.45)" : undefined,
        transition: "filter 0.3s",
      }}
    />
  );
};

export default Avatar;
