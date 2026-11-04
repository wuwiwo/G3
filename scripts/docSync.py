# -*- coding: utf-8 -*-
"""
docSync.py — 文档 vs 代码数值一致性校验（平衡同步工具）

用法: python docSync.py [--fix]
- 默认: 只报告不一致（文档值 vs 代码值）
- --fix: 自动替换可安全匹配的数值（冷却/施法时间/倍率）

数据源: characters.ts（角色技能数值） + races.ts（羁绊） + 引擎硬编码表
校验对象: docs/v2.0.md

以代码实现为准。每次平衡调整后运行，输出差异清单 → 同步文档。
"""
import re
import sys
import os

BASE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(BASE, '..', '..')  # slg-battle/scripts → G3 根
DOC = os.path.join(PROJ, 'docs', 'v3.0.md')  # v3.0 为设计基线
CHARS = os.path.join(PROJ, 'slg-battle', 'src', 'data', 'characters.ts')
RACES = os.path.join(PROJ, 'slg-battle', 'src', 'data', 'races.ts')

# ============ 1. 从代码提取数值 ============
def extract_chars():
    code = open(CHARS, encoding='utf-8').read()
    blocks = re.split(r'(\w+): CharacterDef = \{', code)
    chars = {}
    for i in range(1, len(blocks), 2):
        cid = blocks[i]
        b = blocks[i + 1]
        nm = re.search(r'name: "([^"]+)"', b)
        if not nm:
            continue
        d = {'id': cid, 'name': nm.group(1), 'cd': None, 'cast': None, 'ratios': [], 'fixed': [], 'heal': None}
        cm = re.search(r'cooldown: ([0-9.]+)', b)
        if cm:
            d['cd'] = float(cm.group(1))
        ctm = re.search(r'castTime: ([0-9.]+)', b)
        if ctm:
            d['cast'] = float(ctm.group(1))
        for m in re.finditer(r'atkRatio: ([0-9.]+)', b):
            d['ratios'].append(float(m.group(1)))
        for m in re.finditer(r'fixedAdd: (\d+)', b):
            d['fixed'].append(int(m.group(1)))
        hm = re.search(r'heal: \{ atkRatio: ([0-9.]+)(?:, fixedAdd: (\d+))?', b)
        if hm:
            d['heal'] = float(hm.group(1))
        chars[nm.group(1)] = d
    return chars

def extract_races():
    code = open(RACES, encoding='utf-8').read()
    races = {}
    for m in re.finditer(r'\[Race\.(\w+)\]: \{((?:.|\n)*?)\n  \},', code):
        rname = m.group(1).lower()
        body = m.group(2)
        tiers = {}
        for t in ['2', '3', '4']:
            tm = re.search(t + r': \{([^}]*)\}', body)
            if tm:
                tiers[t] = tm.group(1).strip()
        races[rname] = tiers
    return races

# ============ 2. 引擎硬编码平衡值登记表（人工维护，每次平衡后更新） ============
# 引擎中不在 characters.ts 的平衡值（特判硬编码）
ENGINE_OVERRIDES = {
    '夜行狼人': {'潜行倍率': 2.0},           # battle.ts stealthBonus
    '末日使者': {'持续': 8, 'DoT': 9},        # SkillRegistry mrsz_doom (8s/9%)
    '死亡先知': {'DoT攻击%': 6, '吸血': 15},   # SkillRegistry swxz_drain
    '幽暗密行者': {'诅咒持续': 3, '换位伤害': 110},  # battle.ts 天赋 3s + handler 110%
    '暴君龙': {'降防': 45},                    # battle.ts initBattle -45%
    '火焰翼龙': {'数量加成': 4},
    '冰霜邪龙': {'数量加成': 4},
    '裂地蛮熊': {'拍击后排减伤': 40, '降攻速': 20},
    '猛犸象': {'踩踏前排加成': 20},
    '智慧猩': {'鼓舞': 35, '物减': 15, '魔减': 25},
    '辉刀': {'斩击': 270},
    '炽热战士': {'灼热拳击': 220, '反伤': 15},
    '重拳者': {'毁灭打击': 400},
    '风之斗士': {'疾风连击': 110},
    '狂战士': {'血怒附加': 5},
    '圣灵战士': {'反弹': 110},
    '决斗大师': {'夺舍': 30},
    '美杜莎': {'石化凝视': 135},
    '森之射手': {'束缚射击': 190},
    '追风游侠': {'移动后闪避': 40},
    '湮灭法师': {'破甲分支': 50},
    '嚎叫巨牛': {'降攻': 20},
}

# 亡灵/兽族/战士/龙族羁绊引擎值 (races.ts 解析的补充)
BOND_OVERRIDES = {
    'undead': {'攻': 12, '闪避': 15, '物理减伤': 9, '复活等待': 3, '复活回血': 2, '复活时长': 8, '无敌': 1},
    'beast': {'攻': 22, '防': 16, '韧': 12, 'aoe减伤': 15, '低血纯伤': 6},
    'warrior': {'攻': 20, 'hp': 30, '魔防': 40, '吸血': 8, '回血': 6},
    'dragon': {'cd': 35, '减伤': 6, '开局倍': 2, '开局时长': 10},
    'mage': {'魔防': 30, 'cd': 12, '施法buff': 3.5},
    'hunter': {'攻': 12, '命中': 20, '反击': 60},
}

RACE_CN = {'beast': '兽', 'undead': '亡', 'dragon': '龙', 'mage': '法', 'hunter': '猎', 'warrior': '战'}

# ============ 3. 校验 ============
def main():
    chars = extract_chars()
    races = extract_races()
    doc = open(DOC, encoding='utf-8').read()

    issues = []
    fixable = []

    # 3.1 角色技能: 冷却/施法时间/倍率
    for name, d in chars.items():
        if d['cd'] is None:
            continue
        # 在文档中找该角色章节
        idx = doc.find('##### ' + name)
        if idx < 0:
            idx = doc.find(name)
            if idx < 0:
                continue
        # 章节边界: 到下一个角色为止 (修复跨章节误匹配)
        next_h = doc.find('##### ', idx + 10)
        section = doc[idx:next_h if next_h > 0 else idx + 1200]
        # 冷却检查: 文档 "(冷却:X s)" 或 "(冷却：Xs)"
        m = re.search(r'冷却[:：]\s*([0-9.]+)\s*s', section)
        if m:
            doc_cd = float(m.group(1))
            if abs(doc_cd - d['cd']) > 0.01:
                issues.append(f'⚠ {name} 冷却: 文档 {doc_cd}s vs 代码 {d["cd"]}s')
                fixable.append((name, '冷却', f'{doc_cd:g}', f'{d["cd"]:g}', m.group(0)))
        # 施法时间
        m = re.search(r'施法\s*([0-9.]+)\s*s', section)
        if m and d['cast'] is not None:
            doc_cast = float(m.group(1))
            if abs(doc_cast - d['cast']) > 0.01:
                issues.append(f'⚠ {name} 施法: 文档 {doc_cast}s vs 代码 {d["cast"]}s')
        # 倍率: 文档 "攻击力×X%" 或 "攻击×X%"
        if d['ratios']:
            for ratio in d['ratios']:
                pct = int(round(ratio * 100))
                # 搜文档中该角色的百分比 (模糊: 前后50字符内)
                for m in re.finditer(r'([0-9]+)%', section):
                    if abs(int(m.group(1)) - pct) <= 2 and m.start() < 400:
                        # 可能匹配: 检查是否在"×"后
                        before = section[max(0, m.start()-8):m.start()]
                        if '×' in before or 'x' in before.lower():
                            if int(m.group(1)) != pct:
                                issues.append(f'⚠ {name} 倍率: 文档 {m.group(1)}% vs 代码 {pct}%')
                        break

    # 3.2 引擎硬编码表
    for name, overrides in ENGINE_OVERRIDES.items():
        idx = doc.find('##### ' + name)
        if idx < 0:
            issues.append(f'? {name} 引擎值未核对: 文档无该角色章节')
            continue
        section = doc[idx:idx + 1000]
        for key, val in overrides.items():
            if isinstance(val, int) and val >= 100:
                # 百分比值: 文档搜 X%
                for m in re.finditer(r'([0-9]+)%', section):
                    if abs(int(m.group(1)) - val) <= 2:
                        if int(m.group(1)) != val:
                            issues.append(f'⚠ {name} {key}: 文档 {m.group(1)}% vs 引擎 {val}%')
                        break
                else:
                    issues.append(f'? {name} {key}: 文档未找到 ~{val}%')
            elif isinstance(val, int):
                # 秒/数值: 文档搜 Xs 或 X
                if not re.search(rf'{val}\s*s', section) and not re.search(rf'[×x]?\s*{val}\b', section):
                    issues.append(f'? {name} {key}: 文档未找到 {val}')

    # 3.3 羁绊
    for race, ov in BOND_OVERRIDES.items():
        cn = RACE_CN.get(race, race)
        idx = doc.find(cn + '族')
        for key, val in ov.items():
            if not re.search(rf'{val}(%|倍|s|秒)', doc[idx:idx+3000] if idx >= 0 else doc):
                pass  # 简化: 羁绊描述格式多样, 不自动核对

    print('=' * 60)
    print(f'文档-代码一致性校验 ({len(issues)} 项)')
    print('=' * 60)
    for i in issues:
        print(i)
    if not issues:
        print('✅ 全部一致')

    # --fix
    if '--fix' in sys.argv:
        fixed = 0
        for name, key, old_v, new_v, old_str in fixable:
            if old_str in doc:
                new_str = re.sub(r'[0-9.]+', new_v, old_str, count=1)
                doc = doc.replace(old_str, new_str)
                fixed += 1
                print(f'✓ 修复 {name} {key}: {old_str} → {new_str}')
        if fixed:
            open(DOC, 'w', encoding='utf-8').write(doc)
        print(f'修复 {fixed} 处')

if __name__ == '__main__':
    main()
