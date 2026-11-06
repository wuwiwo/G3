#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""平衡测试阵容 / 站位核查（只读，不改任何文件）。

口径完全复用 scripts/positionedBalance.ts:
  rawTank = hp/1000 + (physicalDef + magicalDef)/120
  族内 min-max 归一 → norm
  frontShare = 前3人 norm 之和 / 全队 norm 之和
  硬约束 MIN_FRONT_TANK_SHARE = 0.42（均分为 37.5%）

用法: python scripts/roster_audit.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHARS = ROOT / "src" / "data" / "characters.ts"
BATCH = ROOT / "scripts" / "batchBalance.ts"
MIN_SHARE = 0.42

code = CHARS.read_text(encoding="utf-8")
batch = BATCH.read_text(encoding="utf-8")

# --- 角色定义 ---
blocks = re.split(r"(?=const \w+:\s*CharacterDef\s*=\s*\{)", code)
defs = {}
for b in blocks:
    m_id = re.search(r'\bid:\s*"([^"]+)"', b)
    m_name = re.search(r'\bname:\s*"([^"]+)"', b)
    m_stats = re.search(r"\bstats:\s*\{([^}]*)\}", b, re.S)
    if not (m_id and m_name and m_stats):
        continue
    s = m_stats.group(1)
    def num(key):
        m = re.search(r"\b" + key + r":\s*([\d.]+)", s)
        return float(m.group(1)) if m else 0.0
    talent_m = re.search(r'\btalent:\s*"([^"]*)"', b)
    tags_m = re.search(r"\btags:\s*\[([^\]]*)\]", b)
    defs[m_id.group(1)] = {
        "name": m_name.group(1),
        "hp": num("hp"),
        "atk": num("attack"),
        "pdef": num("physicalDef"),
        "mdef": num("magicalDef"),
        "interval": num("attackInterval"),
        "talent": talent_m.group(1) if talent_m else "",
        "tags": tags_m.group(1) if tags_m else "",
    }

# --- ROSTER ---
rm = re.search(r"const ROSTER[^=]*=\s*\{([\s\S]*?)\n\};", batch)
roster = {}
for race, ids in re.findall(r'(\w+):\s*\[([^\]]*)\]', rm.group(1)):
    roster[race] = re.findall(r'"([^"]+)"', ids)

RACE_CN = {
    "beast": "兽族", "hunter": "猎人", "warrior": "战士", "mage": "法师",
    "undead": "亡灵", "dragon": "龙族", "holy": "圣职者",
}
ROW_CN = {0: "前", 1: "中", 2: "后"}

print("=" * 96)
print("平衡测试阵容站位核查（batchBalance.ts ROSTER 顺序硬排）")
print("口径: rawTank = HP/1000 + (物防+魔防)/120，族内 min-max 归一；前排坦度占比硬约束 ≥ 42%")
print("=" * 96)

summary = []
for race, ids in roster.items():
    rows = [defs.get(i) for i in ids]
    if any(r is None for r in rows):
        print(f"[{race}] 缺角色定义，跳过")
        continue
    raw = [r["hp"] / 1000 + (r["pdef"] + r["mdef"]) / 120 for r in rows]
    lo, hi = min(raw), max(raw)
    norm = [(v - lo) / (hi - lo) if hi > lo else 0.5 for v in raw]
    total = sum(norm) or 1
    front = sum(norm[:3]) / total * 100
    mid = sum(norm[3:6]) / total * 100
    back = sum(norm[6:]) / total * 100
    ok = "✅" if front / 100 >= MIN_SHARE else "❌"
    summary.append((RACE_CN.get(race, race), front, mid, back, ok))

    print(f"\n### {RACE_CN.get(race, race)}  {ok} 前排坦度占比 {front:.1f}% (中 {mid:.1f}% / 后 {back:.1f}%)")
    print(f"{'格':<7}{'角色':<12}{'HP':>8}{'物防':>8}{'魔防':>8}{'间隔':>7}{'坦度':>8}  {'定位线索'}")
    cells = [(0, 0), (0, 1), (0, 2), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1)]
    for i, (r, n) in enumerate(zip(rows, norm)):
        row, col = cells[i]
        hint = []
        t = r["tags"]
        if "治疗" in t or "治疗" in r["talent"]:
            hint.append("治疗")
        if "增益" in t:
            hint.append("增益")
        if "控制" in t:
            hint.append("控制")
        if "切入" in t:
            hint.append("切入")
        if "护盾" in r["talent"] or "减伤" in r["talent"] or "嘲讽" in r["talent"]:
            hint.append("坦/护")
        print(f"{ROW_CN[row]}{col}    {r['name']:<12}{r['hp']:>8.0f}{r['pdef']:>8.1f}{r['mdef']:>8.1f}{r['interval']:>7.1f}{n:>8.2f}  {'/'.join(hint) or '-'}")

    # 问题检测
    order = sorted(range(8), key=lambda i: norm[i], reverse=True)
    tankiest, frailest = order[:3], order[-2:]
    bad_front = [i for i in frailest if i < 3]
    bad_back = [i for i in tankiest if i >= 3]
    if bad_front:
        print("  ⚠️ 脆皮被放前排: " + ", ".join(f"{rows[i]['name']}({ROW_CN[cells[i][0]]}排,坦度{norm[i]:.2f})" for i in bad_front))
    if bad_back:
        print("  ⚠️ 最肉的没上前排: " + ", ".join(f"{rows[i]['name']}({ROW_CN[cells[i][0]]}排,坦度{norm[i]:.2f})" for i in bad_back))
    if race == "dragon":
        lyz = ids.index("lyz") if "lyz" in ids else -1
        print(f"  {'✅' if lyz < 3 else '❌'} 硬约束 龙吟者只能前排: 当前在 {ROW_CN[cells[lyz][0]]}排 (index {lyz})")
    if race == "beast":
        pp = ids.index("pp") if "pp" in ids else -1
        print(f"  {'✅' if pp < 3 else '❌'} 彭彭猪(最肉)上前排: 当前在 {ROW_CN[cells[pp][0]]}排 (index {pp})")

print("\n" + "=" * 96)
print("汇总（前排坦度占比，≥42% 为达标）")
print(f"{'种族':<10}{'前排':>10}{'中排':>10}{'后排':>10}   判定")
for name, f, m, b, ok in summary:
    print(f"{name:<10}{f:>9.1f}%{m:>9.1f}%{b:>9.1f}%   {ok}")
print("=" * 96)
