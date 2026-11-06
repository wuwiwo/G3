#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""V3.4 修订 R5~R6（用户 2026-11-06 直发）· 逐条补丁。

用法: python scripts/v34_revise2.py --step R5 [--dry-run]
设计源: ../docs/V3.4平衡性调整.md 第 7 节
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G3 = ROOT.parent
DRY = "--dry-run" in sys.argv
STEP = sys.argv[sys.argv.index("--step") + 1] if "--step" in sys.argv else None

CH = ROOT / "src/data/characters.ts"
DMG = ROOT / "src/engine/damage.ts"
V30 = G3 / "docs/v3.0.md"

ARMOR_OLD = """    // v2.12 破甲: 基础防御失效, 额外防御50% (简化: def×0.5)
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak))
      def *= 0.5;"""
ARMOR_NEW = """    // v3.4 R6: 破甲 = 基础防御失效，额外防御保留 50%（按 R4 分层，不再重复乘算）
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak)) {
      const abBase = Math.min(baseDef, Math.max(0, def));
      def = Math.max(0, def - abBase) * 0.5;
    }"""

STEPS = {
    "R5": ("殉道者攻击成长 +7.0→+6.0", [
        (CH,
         "    attack: 1147.4, // v3.3 成长 8→7: 454.4+7×99 // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强",
         "    attack: 1048.4, // v3.4 R5 成长 7→6: 454.4+6×99（1级base不变） // v3.10 ×1.12 // v3.9 ×0.85 // v3.8 ×0.9 // v3.7 ×1.1 // v3.6: ×1.15 // v3.5: 圣职者加强"),
        (CH,
         "  growth: { hp: 60, attack: 7.0, physicalDef: 1.5, magicalDef: 1.5 }, // v3.3 8.0→7.0",
         "  growth: { hp: 60, attack: 6.0, physicalDef: 1.5, magicalDef: 1.5 }, // v3.4 R5 7.0→6.0"),
        (V30,
         "* 攻击力:454.4(+7.0/级)  ← v3.3: 每级成长 8.0→7.0，Lv100 由 1246.4 → 1147.4",
         "* 攻击力:454.4(+6.0/级)  ← v3.4 R5: 每级成长 7.0→6.0，Lv100 由 1147.4 → 1048.4（1 级 base 不变）"),
    ]),
    "R6": ("破甲分层修正（删重复 + 基础失效/额外减半）", [
        (DMG,
         """  if (type === DamageType.Physical) {
    let def = defender.currentPhysicalDef;
    const baseDef = defender.basePhysicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
""" + ARMOR_OLD,
         """  if (type === DamageType.Physical) {
    let def = defender.currentPhysicalDef;
    const baseDef = defender.basePhysicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
""" + ARMOR_NEW),
        (DMG,
         """  } else if (type === DamageType.Magical) {
    let def = defender.currentMagicalDef;
    const baseDef = defender.baseMagicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
""" + ARMOR_OLD,
         """  } else if (type === DamageType.Magical) {
    let def = defender.currentMagicalDef;
    const baseDef = defender.baseMagicalDef ?? def;
    // v2.9 猛犸象卷曲: 防+50%
    if (defender.statuses.some((s: any) => (s.type as string) === "curl"))
      def *= 1.5;
""" + ARMOR_NEW),
        (DMG,
         """    // ArmorBreak: base defense失效, extra defense 50% (total = current * 0.5)
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak))
      def *= 0.5;""",
         "    // v3.4 R6: 破甲已在分支开头按分层处理，此处不再重复"),
        (DMG,
         """    // ArmorBreak: also applies to magical defense (both def types)
    if (defender.statuses.some((s: any) => s.type === StatusType.ArmorBreak))
      def *= 0.5;""",
         "    // v3.4 R6: 破甲已在分支开头按分层处理，此处不再重复"),
    ]),
}


def read(p: Path) -> str:
    return p.read_bytes().decode("utf-8")


def apply(name: str) -> bool:
    title, patches = STEPS[name]
    print(f"\n--- {name}: {title} ---")
    cache: dict[Path, str] = {}
    for p, old, new in patches:
        if p not in cache:
            cache[p] = read(p)
        c = cache[p]
        nl = "\r\n" if "\r\n" in c else "\n"
        o = old.replace("\n", nl) if nl != "\n" else old
        nw = new.replace("\n", nl) if nl != "\n" else new
        n = c.count(o)
        if n == 1:
            cache[p] = c.replace(o, nw, 1)
            print(f"  OK   {p.name}: {old[:56].replace(chr(10), ' ')}")
        elif n == 0 and c.count(nw) >= 1:
            print(f"  SKIP {p.name}: 已应用")
        else:
            print(f"  FAIL {p.name}: 命中 {n} 次 :: {old[:90]}")
            return False
    if not DRY:
        for p, s in cache.items():
            p.write_bytes(s.encode("utf-8"))
        print(f"  WROTE {len(cache)} files")
    else:
        print("  [--dry-run] 锚点全部通过，未写入")
    return True


targets = [STEP] if STEP else list(STEPS.keys())
for s in targets:
    if not apply(s):
        print(f"\n中止于 {s}（原子性）")
        sys.exit(1)
sys.exit(0)
