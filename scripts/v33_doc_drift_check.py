#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""V3.3 设计文档 vs 引擎角色文本 的数值漂移核查（只读，不改任何文件）。

用法: python scripts/v33_doc_drift_check.py
输出: 每个角色在设计文档 / characters.ts 中出现的百分数集合与差集，
      供人工确认是否属于「实装偏离文档」。docSync 只校验冷却/施法/倍率，
      天赋文本不在其覆盖范围，故需本脚本补充。
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs" / "V3.3平衡性调整.md"
CODE = ROOT / "slg-battle" / "src" / "data" / "characters.ts"

doc_text = DOC.read_text(encoding="utf-8")
code_text = CODE.read_text(encoding="utf-8")

PCT = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def pcts(s: str):
    return sorted({float(x) for x in PCT.findall(s)}, key=lambda v: v)


# --- 文档：按 "N）角色名" 分节 ---
head_re = re.compile(r"^\s*\d+）\s*(.+?)\s*$", re.M)
heads = [(m.start(), m.group(1).strip()) for m in head_re.finditer(doc_text)]
heads.append((len(doc_text), "__END__"))

doc_sections = {}
for i in range(len(heads) - 1):
    start, name = heads[i]
    end = heads[i + 1][0]
    doc_sections.setdefault(name, []).append(doc_text[start:end])

# --- 代码：按 name: "角色名" 到下一个 const/}; 分块 ---
name_re = re.compile(r'\bname:\s*"([^"]+)"', re.M)
code_marks = [(m.start(), m.group(1)) for m in name_re.finditer(code_text)]
code_marks.append((len(code_text), "__END__"))

code_sections = {}
for i in range(len(code_marks) - 1):
    start, name = code_marks[i]
    end = code_marks[i + 1][0]
    code_sections[name] = code_text[start:end]

# --- 比对 ---
print("=" * 74)
print("V3.3 文档 vs characters.ts 天赋/技能文本 数值漂移核查")
print("=" * 74)
print(f"文档角色条目 {len(doc_sections)} 个 / 代码角色 {len(code_sections)} 个\n")

matched = 0
drift = []
for name, chunks in doc_sections.items():
    if name not in code_sections:
        continue
    matched += 1
    d = pcts("\n".join(chunks))
    c = pcts(code_sections[name])
    only_doc = [x for x in d if x not in c]
    only_code = [x for x in c if x not in d]
    if only_doc or only_code:
        drift.append((name, d, c, only_doc, only_code))

print(f"可匹配角色 {matched} 个，其中存在数值差异 {len(drift)} 个：\n")
for name, d, c, od, oc in drift:
    print(f"[{name}]")
    print(f"  文档: {d}")
    print(f"  代码: {c}")
    print(f"  仅文档有: {od}")
    print(f"  仅代码有: {oc}")
    print()

print("=" * 74)
print("说明：差集包含表述改写/小数化/等价换算，需逐条人工判定，")
print("      不代表全部是缺陷。重点看『仅文档有』里的大数值与『仅代码有』里的旧值。")
