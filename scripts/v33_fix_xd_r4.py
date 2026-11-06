#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""r4: 殉道者天赋「文档驱动」修正脚本（幂等 / --dry-run / 原子性）。

背景: r1 脚本 v33_apply.py 把殉道者天赋写成 90%纯粹 / 8%回血，
      但设计源 docs/V3.3平衡性调整.md 的当前值为 30% / 5%，
      且该错误值被同步进了 docs/v3.0.md，导致 docSync 两边一致却都偏离设计源。

做法: 不硬编码目标值，直接从设计文档解析；任一锚点缺失则整份不写入。
用法: python scripts/v33_fix_xd_r4.py [--dry-run]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]          # slg-battle/
G3 = ROOT.parent                                    # G3/
DOC = G3 / "docs" / "V3.3平衡性调整.md"
BASE = G3 / "docs" / "v3.0.md"
CHARS = ROOT / "src" / "data" / "characters.ts"
BATTLE = ROOT / "src" / "engine" / "battle.ts"
DRY = "--dry-run" in sys.argv


def read(p: Path) -> str:
    return p.read_bytes().decode("utf-8")


def write(p: Path, s: str) -> None:
    p.write_bytes(s.encode("utf-8"))


# --- 1. 从设计源解析目标值 ---
doc = read(DOC)
sec = re.search(r"8）殉道者([\s\S]*?)(?=\n\s*\d+）|$)", doc)
if not sec:
    sys.exit("FATAL: 设计文档里找不到「8）殉道者」章节")
m = re.search(r"天赋：.*?攻击×(\d+)%纯粹伤害.*?最大生命×(\d+)%", sec.group(1))
if not m:
    sys.exit("FATAL: 殉道者天赋行无法解析出倍率")
dmg_pct, heal_pct = int(m.group(1)), int(m.group(2))
dmg_ratio, heal_ratio = dmg_pct / 100.0, heal_pct / 100.0
print(f"设计源目标值: 纯粹 {dmg_pct}% ({dmg_ratio}) / 回血 {heal_pct}% ({heal_ratio})")

# --- 2. 精确锚点替换 ---
patches = [
    (CHARS,
     'talent: "每当友方角色阵亡，给予敌方全体自身攻击×90%纯粹，我方剩余单位恢复最大生命×8%"',
     f'talent: "每当友方角色阵亡，给予敌方全体自身攻击×{dmg_pct}%纯粹，我方剩余单位恢复最大生命×{heal_pct}%"'),
    (BATTLE,
     "const dr = Math.floor(martyr.currentAttack * 0.9);",
     f"const dr = Math.floor(martyr.currentAttack * {dmg_ratio}); // v3.3 文档 {dmg_pct}%纯粹"),
    (BATTLE,
     "a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * 0.08));",
     f"a.currentHp = Math.min(a.maxHp, a.currentHp + Math.floor(a.maxHp * {heal_ratio}));"),
    (BATTLE,
     'addStat(state, martyr.id, "totalHealingDone", Math.floor(a.maxHp * 0.08));',
     f'addStat(state, martyr.id, "totalHealingDone", Math.floor(a.maxHp * {heal_ratio}));'),
    (BATTLE,
     "敌方全体攻击×90%纯粹, 我方剩余回8%最大HP",
     f"敌方全体攻击×{dmg_pct}%纯粹, 我方剩余回{heal_pct}%最大HP"),
    (BASE,
     "* 天赋: 每当友方角色阵亡，给予敌方全体自身攻击×90%纯粹，我方剩余单位恢复最大生命×8%",
     f"* 天赋: 每当友方角色阵亡，给予敌方全体自身攻击×{dmg_pct}%纯粹，我方剩余单位恢复最大生命×{heal_pct}%"),
]

contents = {}
for path, old, new in patches:
    if path not in contents:
        contents[path] = read(path)
    c = contents[path]
    n = c.count(old)
    if n != 1:
        # 已应用过则允许跳过（幂等）
        if c.count(new) >= 1 and n == 0:
            print(f"  SKIP(已应用): {path.name} <- {old[:44]}")
            continue
        sys.exit(f"FATAL: 锚点命中 {n} 次（期望 1）: {path.name} :: {old[:60]}")
    contents[path] = c.replace(old, new, 1)
    print(f"  OK: {path.name} :: {old[:50]}")

if DRY:
    print("\n[--dry-run] 全部锚点验证通过，未写入任何文件。")
    sys.exit(0)

for path, content in contents.items():
    write(path, content)
    print(f"WROTE {path}")
print("\n完成：殉道者天赋已按设计文档同步（数据层 / 引擎 / 日志 / 基线文档）。")
