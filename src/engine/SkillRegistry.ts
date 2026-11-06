import { ArenaUnit, StatusType, DamageType, Row } from "../types";
import { calcDamage } from "./damage";
import { trackSkill, getAttackableEnemies } from "./battle";

export type SkillHandler = (
  caster: ArenaUnit,
  state: any,
  log: any[],
  targets: ArenaUnit[]
) => void;

const registry = new Map<string, SkillHandler>();

export function registerSkillHandler(skillId: string, handler: SkillHandler) {
  registry.set(skillId, handler);
}
export function getSkillHandler(skillId: string): SkillHandler | undefined {
  return registry.get(skillId);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Skill Handler Registrations ----

// 龙吟者 — 特殊治疗+升级机制+临时复活
registerSkillHandler("lyz_heal", (caster, state, log) => {
  // v3.4 R16: 普通发动治疗最低 HP 的 1 名龙族；升级那次对我方全体龙族生效
  const dragons = state.units
    .filter(
      (u: any) => u.team === caster.team && !u.isDead && u.def.race === "dragon"
    )
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  if (dragons.length === 0) return;
  caster.castCount = (caster.castCount || 0) + 1;
  const upgraded = caster.castCount % 4 === 0; // v3.4 R16: 升级所需次数 4→3
  // v3.4 R16: 升级那次技能变为我方全体存活龙族生效
  const targets = upgraded ? dragons : [dragons[0]];
  for (const t of targets) {
    t.statuses.push({
      type: "lyz_heal_dot" as any,
      remainingSeconds: 4,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.4),
      sourceId: caster.id,
    } as any);
    t._lyzDrUntil = state.time + 4;
    t._lyzDr = 0.2;
    log.push({
      time: state.time,
      text: `🎵 ${caster.def.name} 治疗 ${t.def.name}: 每秒攻击×40% + 减伤20% ×4s${upgraded ? " [升级·全体龙族]" : ""}`,
      type: "heal",
    });
  }
  // v3.3 升级: 若存在阵亡龙族，随机复活 1 只并无敌 5s，结束后重新阵亡
  if (upgraded) {
    const dead = state.units.filter(
      (u: any) =>
        u.team === caster.team &&
        u.isDead &&
        u.def.race === "dragon" &&
        !u.tempReviveTimer
    );
    if (dead.length > 0) {
      const r = dead[Math.floor(Math.random() * dead.length)];
      r.isDead = false;
      r.currentHp = Math.max(1, Math.floor(r.maxHp * 0.5));
      r.statuses = [];
      r.tempReviveTimer = 5;
      r.invincibleTimer = 5;
      log.push({
        time: state.time,
        text: `🎵 ${caster.def.name} 升级复活 ${r.def.name} 无敌5s`,
        type: "status",
      });
    }
  }
});

// 食人魔魔法师 — 火焰爆轰(消耗HP+多重施法)
registerSkillHandler("srm_fire", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // 消耗5%当前生命值
  const cost = Math.floor(caster.currentHp * 0.05);
  caster.currentHp -= cost;
  // 主目标
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const result = calcDamage(
    caster,
    target,
    caster.def.skill.damage?.[0]?.atkRatio ?? 1.8,
    DamageType.Magical,
    {
      // v3.16: 180%
      isSkill: true,
    }
  );
  target.currentHp -= result.finalDamage;
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "magical"
  );
  target.statuses.push({
    type: StatusType.Stun,
    remainingSeconds: 0.5,
    stacks: 1,
  });
  target.lastDamage = {
    value: result.finalDamage,
    time: state.time,
    type: "magical",
  };
  target.lastHitBy = caster.id;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "magicalDamage", result.finalDamage);
  addStat(state, target.id, "totalDamageReceived", result.finalDamage);
  log.push({
    time: state.time,
    text: `🔥 ${caster.def.name} 火焰爆轰 ${target.def.name}: ${result.finalDamage}💥`,
    type: "damage",
  });
  // 多重施法: P0修复 独立判定 3次20% / 2次40% (原条件概率bug: 3次实际仅12%)
  const roll3 = Math.random();
  const nCasts = roll3 < 0.25 ? 3 : roll3 < 0.7 ? 2 : 1; // v3.16: 3次25%/2次70%
  for (let i = 1; i < nCasts; i++) {
    const t2 = enemies.filter((u: any) => u.id !== target.id);
    if (t2.length === 0) break;
    const extraTarget = t2[Math.floor(Math.random() * t2.length)];
    const r2 = calcDamage(caster, extraTarget, 1.6, DamageType.Magical, {
      isSkill: true,
    });
    extraTarget.currentHp -= r2.finalDamage;
    extraTarget.statuses.push({
      type: StatusType.Stun,
      remainingSeconds: 0.5,
      stacks: 1,
    });
    addStat(state, caster.id, "totalDamageDealt", r2.finalDamage);
    addStat(state, caster.id, "skillDamage", r2.finalDamage);
    addStat(state, caster.id, "magicalDamage", r2.finalDamage);
    addStat(state, extraTarget.id, "totalDamageReceived", r2.finalDamage);
    log.push({
      time: state.time,
      text: `🔥 ${caster.def.name} 额外火焰爆轰#${i + 1} ${extraTarget.def.name}: ${r2.finalDamage}💥`,
      type: "damage",
    });
  }
});

// 小精灵 — 链接
registerSkillHandler("xjl_link", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  // Priority: mage > adjacent > highest attack
  const mages = allies.filter((u: any) => u.def.race === "mage");
  const target =
    mages[0] ||
    allies.sort((a: any, b: any) => b.currentAttack - a.currentAttack)[0];
  if (target) {
    // v3.4 R19-5: 链接刷新时先回滚旧增量，避免 skillPower 反复叠加（到期只回滚一次会残留）
    const prevBonus = (target as any)._xjlSkillPowerBonus || 0;
    if (prevBonus > 0) {
      target.skillPower = Math.max(1, (target.skillPower || 1) - prevBonus);
    }
    target.skillPower = (target.skillPower || 1) + 0.3;
    (target as any)._xjlSkillPowerBonus = 0.3; // v3.4 R19: 记录增量，链接到期精确回滚
    // v3.4 R19: 删除 lifeSteal 近似；被链接友方获得小精灵天赋 30% 效果
    (target as any)._xjlTalentShare = 0.3;
    // v3.4 R14 链接伤害承担: 目标受伤25%转移给小精灵（deferDamage 实现，40%→25%）
    target._linkOwnerId = caster.id;
    target._linkUntil = state.time + 8;
    log.push({
      time: state.time,
      text: `🔗 ${caster.def.name} 链接 ${target.def.name}: 技能+30% 小精灵天赋30%效果`,
      type: "status",
    });
  }
});

// 末日使者 — 末日
registerSkillHandler("mrsz_doom", (caster, state, log) => {
  // v2.12 按文档: 消耗6%最大HP, HP<20%不可用
  if (caster.currentHp / caster.maxHp < 0.2) return;
  const cost = Math.floor(caster.maxHp * 0.06);
  caster.currentHp -= cost;
  // 目标: 近10s伤害最高 (用 totalDamageDealt 近似)
  const enemies = getAttackableEnemies(state, caster.team);
  const topDmg = enemies.sort(
    (a: any, b: any) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0)
  )[0];
  if (topDmg) {
    // v2.13 平衡: 8s + 减疗50% (11s/75%过强)
    topDmg._healReduction = 0.75; // v3.3 减疗75%
    topDmg._healReductionUntil = state.time + 8;
    topDmg.statuses.push({
      type: "doom" as any,
      remainingSeconds: 8,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.13), // v2.18: 10%→9%
      sourceId: caster.id,
    });
    topDmg.statuses.push({
      type: StatusType.Silence,
      remainingSeconds: 8,
      stacks: 1,
      sourceId: caster.id,
    });
    topDmg.statuses.push({
      type: StatusType.Ruin,
      remainingSeconds: 8,
      stacks: 1,
      sourceId: caster.id,
    });
    (state as any).trackTalent(
      state,
      caster.id,
      "末日(减疗50%+DoT)",
      1,
      "count"
    );
    log.push({
      time: state.time,
      text: `💀 ${caster.def.name} 对 ${topDmg.def.name} 施加末日8s: 减疗50%+每秒13%纯伤`,
      type: "status",
    });
  }
});

// 死亡先知 — 吸魂巫术
registerSkillHandler("swxz_drain", (caster, state, log) => {
  // v2.12 按文档: 前排70/中15/后15 + 每秒9%+2%×6s + 吸血25% + 结束后诅咒4s
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const roll = Math.random() * 100;
  let pool: any[];
  if (roll < 70) pool = enemies.filter((e: any) => e.row === Row.Front);
  else if (roll < 85) pool = enemies.filter((e: any) => e.row === Row.Mid);
  else pool = enemies.filter((e: any) => e.row === Row.Back);
  if (pool.length === 0) pool = enemies;
  const target = pool[Math.floor(Math.random() * pool.length)];
  const perTick = Math.floor(caster.currentAttack * 0.06 + target.maxHp * 0.01); // v3.3 自身攻6%+目标最大HP1%
  target.statuses.push({
    type: "drain" as any,
    remainingSeconds: 6,
    stacks: 1,
    value: perTick,
    sourceId: caster.id,
  });
  // v3.16g: 诅咒延迟到吸魂结束后（由引擎 drain 结算处追加）——不再提前挂
  // （原来提前挂 Curse 会被驱魔者等异常清除机制误触发）
  (state as any).trackTalent(
    state,
    caster.id,
    "吸魂巫术(DoT)",
    perTick * 6,
    "damage"
  );
  log.push({
    time: state.time,
    text: `💀 ${caster.def.name} 吸取 ${target.def.name}: 每秒${perTick}×6s+吸血25%`,
    type: "damage",
  });
});

// 神谕者 — 神之庇佑：减伤+延迟结算
registerSkillHandler("syz_bless", (caster, state, log) => {
  const allies = state.units
    .filter((u: any) => u.team === caster.team && !u.isDead)
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const targets = allies.slice(0, 2);
  for (const t of targets) {
    const neg = [
      "stun",
      "sleep",
      "petrify",
      "freeze",
      "bind",
      "burn",
      "armorBreak",
      "disarm",
      "curse",
      "ruin",
      "silence",
    ];
    t.statuses = t.statuses.filter((s: any) => !neg.includes(s.type));
    // Apply Inspire: 20% damage reduction for 7s
    t.statuses.push({
      type: StatusType.Inspire,
      remainingSeconds: 5, // 审阅修复: 7→5
      stacks: 1,
      value: 0.8,
    });
    t._syzHealBoostUntil = state.time + 5; // P1修复: 治疗增强+30%
    log.push({
      time: state.time,
      text: `🛡 ${caster.def.name} 庇佑 ${t.def.name}: 减伤20%+驱散`,
      type: "status",
    });
  }
  // Death trigger: heal all mages
  caster._syzDeathTrigger = true;
});

// 洞狮 — 撕咬 (v2.12 按文档: 每秒65%+10纯伤 DoT 3s + 无法行动 + 自身吸血20%)
registerSkillHandler("ds_bite", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // 优先后排
  const back = enemies.filter((e: any) => e.row === Row.Back);
  const mid = enemies.filter((e: any) => e.row === Row.Mid);
  const target = back[0] || mid[0] || enemies[0];
  // 无法行动 3s
  target.statuses.push({
    type: StatusType.Stun,
    remainingSeconds: 3,
    stacks: 1,
  });
  // 施加撕咬 DoT 状态 (每秒 65%攻击+10 纯伤, 3s)
  const perTick = Math.floor(caster.currentAttack * 0.95 + 10); // v3.15c: 77→95
  target.statuses.push({
    type: "bite" as any,
    remainingSeconds: 3,
    stacks: 1,
    value: perTick,
    sourceId: caster.id,
  });
  log.push({
    time: state.time,
    text: `🦷 ${caster.def.name} 撕咬 ${target.def.name}: 每秒${perTick}纯伤+眩晕3s`,
    type: "status",
  });
});

// 幽暗密行者 — 暗影换位 (v2.12 按文档: 换位+闪避20%×4s+对称2名沉默4s+135%纯伤)
registerSkillHandler("yammxz_swap", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const buddy = allies[Math.floor(Math.random() * allies.length)];
  // 换位
  const r0 = caster.row,
    c0 = caster.col;
  caster.row = buddy.row;
  caster.col = buddy.col;
  buddy.row = r0;
  buddy.col = c0;
  // 双方闪避+20%×4s
  caster.evasion = (caster.evasion || 0) + 0.2;
  buddy.evasion = (buddy.evasion || 0) + 0.2;
  caster._swapEvaUntil = state.time + 4;
  buddy._swapEvaUntil = state.time + 4;
  // v3.3: 随机 2 名敌人（原为对称 2 名）→ 沉默4s + 120%纯伤
  const enemies = getAttackableEnemies(state, caster.team);
  const hit = (shuffle(enemies) as any[]).slice(0, 2);
  for (const t of hit) {
    t.statuses.push({
      type: StatusType.Silence,
      remainingSeconds: 4,
      stacks: 1,
    });
    const dmg = Math.floor(caster.currentAttack * 1.2); // v3.3 120%纯粹
    t.currentHp -= dmg;
    addStat(state, t.id, "totalDamageReceived", dmg);
    addStat(state, caster.id, "totalDamageDealt", dmg);
    addStat(state, caster.id, "pureDamage", dmg);
    log.push({
      time: state.time,
      text: `🌑 ${caster.def.name} 暗影换位: ${t.def.name} 沉默4s+${dmg}纯伤`,
      type: "damage",
    });
  }
  (state as any).trackTalent(
    state,
    caster.id,
    "暗影换位",
    hit.length * 4,
    "control"
  );
});

// 魂之引渡者 — 魂能护盾 (v2.12 按文档: 消耗全部魂能+瞬移最低HP亡灵旁+护盾攻击×90%×层数×7s+驱散周围1格)
registerSkillHandler("hyz_shield", (caster, state, log) => {
  const stacks = caster._hyzStacks || 0;
  if (stacks <= 0) return;
  caster._hyzStacks = 0;
  // 瞬移至最低HP亡灵相邻空位 (无空位原地)
  const undeadAllies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.def.race === "undead"
  );
  const lowest =
    undeadAllies.sort(
      (a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
    )[0] || caster;
  if (lowest.id !== caster.id) {
    // 找 lowest 相邻空位 (4方向)
    const occupied = new Set(
      state.units
        .filter((u: any) => u.team === caster.team && !u.isDead)
        .map((u: any) => `${u.row},${u.col}`)
    );
    const neighbors = [
      { row: lowest.row - 1, col: lowest.col },
      { row: lowest.row + 1, col: lowest.col },
      { row: lowest.row, col: lowest.col - 1 },
      { row: lowest.row, col: lowest.col + 1 },
    ].filter(
      (p) =>
        p.row >= 0 &&
        p.row < 3 &&
        p.col >= 0 &&
        p.col < 3 &&
        !occupied.has(`${p.row},${p.col}`)
    );
    if (neighbors.length > 0) {
      const dest = neighbors[Math.floor(Math.random() * neighbors.length)];
      caster.row = dest.row;
      caster.col = dest.col;
      log.push({
        time: state.time,
        text: `👻 ${caster.def.name} 瞬移至 ${lowest.def.name} 旁`,
        type: "status",
      });
    }
  }
  // 护盾: 攻击×90%×层数, 7s
  const shieldVal = Math.floor(caster.currentAttack * 0.8 * stacks); // v3.3 80%×层
  caster._shield = (caster._shield || 0) + shieldVal;
  caster._shieldUntil = state.time + 7;
  lowest._shield = (lowest._shield || 0) + shieldVal;
  lowest._shieldUntil = state.time + 7;
  // 驱散周围1格负面 (自身+目标)
  const neg = [
    "stun",
    "sleep",
    "petrify",
    "freeze",
    "bind",
    "burn",
    "armorBreak",
    "disarm",
    "curse",
    "ruin",
    "silence",
    "poison",
    "doom",
  ];
  for (const t of [caster, lowest]) {
    t.statuses = t.statuses.filter((s: any) => !neg.includes(String(s.type)));
  }
  (state as any).trackTalent(state, caster.id, "魂能护盾", shieldVal, "heal");
  log.push({
    time: state.time,
    text: `🛡 ${caster.def.name} 魂能护盾: ${shieldVal}×2人 7s (消耗${stacks}层)`,
    type: "heal",
  });
});

// 火焰翼龙 — 火焰喷吐 (v2.12 按文档: 前排最低血 + 每秒50%魔法×6s DoT)
registerSkillHandler("hlyl_fire", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // 前排最低血 (无前排按中→后顺序)
  let pool = enemies.filter((e: any) => e.row === Row.Front);
  if (pool.length === 0) pool = enemies.filter((e: any) => e.row === Row.Mid);
  if (pool.length === 0) pool = enemies.filter((e: any) => e.row === Row.Back);
  pool.sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const target = pool[0];
  target.statuses.push({
    type: "hlyl_burn" as any,
    remainingSeconds: 7,
    stacks: 1,
    value: Math.floor(
      caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35)
    ),
    sourceId: caster.id,
  });
  (state as any).trackTalent(
    state,
    caster.id,
    "火焰喷吐(DoT)",
    Math.floor(
      caster.currentAttack *
        (caster.def.skill.damage?.[0]?.atkRatio ?? 0.35) *
        7
    ),
    "damage"
  );
  log.push({
    time: state.time,
    text: `🔥 ${caster.def.name} 喷吐 ${target.def.name}: 每秒35%魔法×7s`,
    type: "status",
  });
});

// 血翼飞龙 — 乱序打击 (v2.12 按文档: 随机2排 + 60%打乱位置 + 命中5-6人-30%)
registerSkillHandler("xyfl_chaos", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // 随机2排
  // v3.3: 随机 4 名敌人（不再是随机 2 排）
  const targets = (shuffle(enemies) as any[]).slice(0, 4);
  const hitCount = targets.length;
  for (const t of targets) {
    // v3.3: 240%物理，倍率从数据层读取；不再有「命中5人-30%」
    const ratio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.4;
    const result = calcDamage(caster, t, ratio, DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `🩸 ${caster.def.name} 乱序 ${t.def.name}: ${result.finalDamage}`,
      type: "damage",
    });
  }
  // v3.3: 必定在这 4 名目标之间随机打乱位置
  const cells = targets.map((t: any) => ({ row: t.row, col: t.col }));
  const shuffledCells = shuffle(cells);
  targets.forEach((t: any, i: number) => {
    t.row = shuffledCells[i].row;
    t.col = shuffledCells[i].col;
  });
  (state as any).trackTalent(state, caster.id, "乱序打击", hitCount, "count");
  log.push({
    time: state.time,
    text: `🩸 ${caster.def.name} 乱序打击: 命中${hitCount}人`,
    type: "status",
  });
});

// 水晶室女 — 冰封 (v2.12 按文档: 束缚+缴械3s + 每秒90%魔法DoT×3s)
registerSkillHandler("sjsn_freeze", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  target.statuses.push({
    type: StatusType.Bind,
    remainingSeconds: 3,
    stacks: 1,
  });
  target.statuses.push({
    type: StatusType.Disarm,
    remainingSeconds: 3,
    stacks: 1,
  });
  target.statuses.push({
    type: "sjsn_dot" as any,
    remainingSeconds: 3,
    stacks: 1,
    value: Math.floor(caster.currentAttack * 0.8), // v3.16: 80%,
    sourceId: caster.id,
  });
  (state as any).trackTalent(
    state,
    caster.id,
    "冰封(DoT)",
    Math.floor(caster.currentAttack * 0.9 * 3),
    "damage"
  );
  log.push({
    time: state.time,
    text: `🧊 ${caster.def.name} 冰封 ${target.def.name}: 束缚+缴械+每秒90%×3s`,
    type: "status",
  });
});

// 美杜莎 — 石化凝视 (v2.12 按文档: 前中后各1名 + 140% + 束缚4s)
registerSkillHandler("mds_skill", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const targets: any[] = [];
  for (const r of [0, 1, 2]) {
    const inRow = enemies.filter((e: any) => e.row === r);
    if (inRow.length > 0)
      targets.push(inRow[Math.floor(Math.random() * inRow.length)]);
  }
  for (const t of targets) {
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 1.35,
      DamageType.Pure,
      { isSkill: true }
    ); // v3.16: 135%纯粹+石化
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastHitBy = caster.id;
    t.statuses.push({
      type: StatusType.Petrify,
      remainingSeconds: 3,
      stacks: 1,
    }); // v3.16: 石化3s
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, caster.id, "magicalDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `🐍 ${caster.def.name} 石化凝视 ${t.def.name}: ${result.finalDamage}+束缚4s`,
      type: "damage",
    });
  }
});

// 圣灵战士 — 守护 (v2.12 按文档: 消耗10%HP + 攻-30% + 减伤25% + 同排魔伤转移 7s)
registerSkillHandler("slzs_guard", (caster, state, log) => {
  const cost = Math.floor(caster.currentHp * 0.1);
  caster.currentHp -= cost;
  caster._slzsGuardUntil = state.time + 7;
  caster._slzsAtkMult = 0.7;
  caster._slzsDr = 0.25;
  (state as any).trackTalent(state, caster.id, "守护(减伤25%)", 7, "control");
  log.push({
    time: state.time,
    text: `🛡 ${caster.def.name} 守护7s: 攻-30%+减伤25%+魔伤转移`,
    type: "status",
  });
});

// 风之斗士 — 疾风连击 (v3.4 用户直发: 5次×65%, 无视防御, 目标随机)
registerSkillHandler("fdzs_combo", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const t = enemies[Math.floor(Math.random() * enemies.length)];
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 0.65,
      DamageType.Physical,
      {
        // v3.4: 读data 65%
        isSkill: true,
        ignoreExtraDef: true, // v3.4 R4: 无视额外防御，保留基础防御
      }
    );
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    total += result.finalDamage;
  }
  addStat(state, caster.id, "totalDamageDealt", total);
  addStat(state, caster.id, "skillDamage", total);
  (state as any).trackTalent(
    state,
    caster.id,
    "疾风连击(5连)",
    total,
    "damage"
  );
  log.push({
    time: state.time,
    text: `🌪 ${caster.def.name} 疾风连击: 5次攻击 总伤${total}`,
    type: "damage",
  });
});

// 彭彭猪 — 催眠 (v2.12 按文档: 后排随机一名 + 自身同时睡眠, 后排无人只睡自己)
registerSkillHandler("pp_sleep", (caster, state, log) => {
  // v3.3 催眠: 随机发动 1 个效果
  const enemies = getAttackableEnemies(state, caster.team);
  if (Math.random() < 0.5) {
    // ① 自身与随机一名敌人同时睡眠 4s（优先后排）
    caster.statuses.push({
      type: StatusType.Sleep,
      remainingSeconds: 4,
      stacks: 1,
    });
    const back = enemies.filter((e: any) => e.row === Row.Back);
    const pool = back.length > 0 ? back : enemies;
    if (pool.length > 0) {
      const target = pool[Math.floor(Math.random() * pool.length)];
      target.statuses.push({
        type: StatusType.Sleep,
        remainingSeconds: 4,
        stacks: 1,
      });
      log.push({
        time: state.time,
        text: `💤 ${caster.def.name} 催眠① ${target.def.name}: 双方睡眠4s`,
        type: "status",
      });
    } else {
      log.push({
        time: state.time,
        text: `💤 ${caster.def.name} 催眠①: 无敌人，只睡自己4s`,
        type: "status",
      });
    }
  } else {
    // ② 自身睡眠 5s，随机 2 名敌人困意 6s（命中率 -75%）
    caster.statuses.push({
      type: StatusType.Sleep,
      remainingSeconds: 5,
      stacks: 1,
    });
    const picked = (shuffle(enemies) as any[]).slice(0, 2);
    for (const t of picked) {
      t._drowsyUntil = state.time + 6;
      t.hitRateMod = (t.hitRateMod || 0) - 0.75;
      t._drowsyApplied = 0.75;
    }
    log.push({
      time: state.time,
      text: `💤 ${caster.def.name} 催眠② 自身睡5s，${picked.length}名敌人困意6s(命中率-75%)`,
      type: "status",
    });
  }
});

// 夜行狼人 — 潜行
registerSkillHandler("yl_stealth", (caster, state, log) => {
  // 进入潜行: 不可被选中, 每秒回2%HP, 下次攻击2倍+20%吸血
  caster.statuses.push({
    type: StatusType.Stealth,
    remainingSeconds: 8,
    stacks: 1,
  });
  caster._stealthAttack = true;
  if ((state as any).trackTalent)
    (state as any).trackTalent(state, caster.id, "潜行(进入)", 1, "count");
  log.push({
    time: state.time,
    text: `🌙 ${caster.def.name} 进入潜行: 下次攻击×2+吸血20%`,
    type: "status",
  });
});

// 陷阱猎人 — 超级陷阱
registerSkillHandler("xjlr_trap", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  // v2.12 无法移动/切入 = Bind 20s (描述: 持续20s) + 每2s DoT
  target.statuses.push({
    type: StatusType.Bind,
    remainingSeconds: 20,
    stacks: 1,
  });
  target.statuses.push({
    type: "trap_dot" as any,
    remainingSeconds: 20,
    stacks: 1,
    value: Math.floor(target.maxHp * 0.02), // 每2s 最大HP×2% (80%攻击在下跳计算)
    sourceId: caster.id,
    casterAtk: caster.currentAttack,
  });
  log.push({
    time: state.time,
    text: `🕳 ${caster.def.name} 在 ${target.def.name} 位置放置超级陷阱`,
    type: "status",
  });
});

// 林地守护者 — 自然守护
registerSkillHandler("ldshz_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  // v2.12 6s 标记 (过期恢复, 不再永久)
  for (const a of allies) {
    a.currentPhysicalDef = Math.floor(a.currentPhysicalDef * 1.2);
    a.currentMagicalDef = Math.floor(a.currentMagicalDef * 1.2);
    a._ldshzDefUntil = state.time + 6;
    a._ldshzDefApplied = true;
  }
  // Same-row back-row allies get crit + lifesteal
  const sameRow = allies.filter(
    (a: any) => a.row === caster.row && a.id !== caster.id
  );
  for (const a of sameRow) {
    a.critRate = (a.critRate || 0) + 0.2;
    a.lifeSteal = (a.lifeSteal || 0) + 0.35; // v3.16: 30→35%
    a._ldshzBuffUntil = state.time + 6;
  }
  log.push({
    time: state.time,
    text: `🌿 ${caster.def.name} 释放自然守护: 全队+20%双防6s`,
    type: "status",
  });
});

// 决斗大师 — 战力夺舍
registerSkillHandler("jdds_steal", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  enemies.sort((a: any, b: any) => b.currentAttack - a.currentAttack);
  const target = enemies[0];
  const stealAtk = Math.floor(target.currentAttack * 0.2); // v3.3 夺取20%
  target.currentAttack -= stealAtk;
  caster.currentAttack += stealAtk;
  // Store stolen attack for 5s reversal
  caster._stolenAtk = (caster._stolenAtk || 0) + stealAtk;
  caster._stealExpire = state.time + 5;
  log.push({
    time: state.time,
    text: `⚔ ${caster.def.name} 夺取 ${target.def.name} 攻击力: +${stealAtk}`,
    type: "status",
  });
});

// 暗影噬龙 — 暗影突袭
registerSkillHandler("aysl_strike", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // v2.12 目标: 后排生命最低 (无后排则全场最低)
  const back = enemies.filter((e: any) => e.row === Row.Back);
  const pool = back.length > 0 ? back : enemies;
  pool.sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp);
  const target = pool[0];
  const result = calcDamage(caster, target, 2.3, DamageType.Physical, {
    isSkill: true,
  });
  target.currentHp -= result.finalDamage;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "physicalDamage", result.finalDamage);
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "physical"
  );
  target._markDmg = (target._markDmg || 0) + 0.25; // +25% damage taken
  target._markExpire = state.time + 4;
  log.push({
    time: state.time,
    text: `🌑 ${caster.def.name} 突袭 ${target.def.name}: ${result.finalDamage}${result.isCrit ? "💥" : ""}+暗影标记4s`,
    type: "damage",
  });
});

// 秀逗大师 — 火球/陨石升级
registerSkillHandler("xdds_fire", (caster, state, log, targets) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  caster._meteorCount = (caster._meteorCount || 0) + 1;
  const isMeteor = caster._meteorCount >= 3;
  if (isMeteor) caster._meteorCount = 0;
  if (!isMeteor) {
    // Normal fireball: single target
    const t = pickTarget(enemies, caster.def.skill.priority, false);
    if (!t) return;
    const fzRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.05;
    const result = calcDamage(caster, t, fzRatio, DamageType.Magical, {
      // P0修复: 读data(2.05)
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "magical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    log.push({
      time: state.time,
      text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(火球)`,
      type: "damage",
    });
    // Mage bond skill life steal
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  } else {
    // Meteor: 1 random row, 260% magic + burn 3s
    const rowPref = [
      { row: Row.Front, chance: 40 },
      { row: Row.Mid, chance: 35 },
      { row: Row.Back, chance: 25 },
    ];
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    let selectedRow = Row.Front;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        selectedRow = p.row;
        break;
      }
    }
    const targetsInRow = enemies.filter((e: any) => e.row === selectedRow);
    if (targetsInRow.length === 0) return;
    for (const t of targetsInRow) {
      const result = calcDamage(caster, t, 3.0, DamageType.Magical, {
        // v3.16 用户: 陨石300%
        isSkill: true,
      });
      t.currentHp -= result.finalDamage;
      trackSkill(
        state,
        caster.id,
        caster.def.skill.id,
        caster.def.skill.name,
        result.finalDamage,
        "physical"
      );
      t.lastDamage = {
        value: result.finalDamage,
        time: state.time,
        type: "magical",
      };
      t.lastHitBy = caster.id;
      addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
      addStat(state, caster.id, "skillDamage", result.finalDamage);
      addStat(state, t.id, "totalDamageReceived", result.finalDamage);
      t.statuses.push({
        type: StatusType.Burn,
        remainingSeconds: 3,
        stacks: 1,
        value: Math.floor(caster.currentAttack * 0.05),
      });
      log.push({
        time: state.time,
        text: `🔥 ${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(陨石)`,
        type: "damage",
      });
    }
  }
});

// 暴君龙 — 翅击：第1个180%+降攻速，第2个230%
registerSkillHandler("bjl_wing", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  // v3.3: 中排、后排各 1 名
  const mid = shuffle(enemies.filter((e: any) => e.row === Row.Mid)) as any[];
  const back = shuffle(enemies.filter((e: any) => e.row === Row.Back)) as any[];
  const picked: any[] = [mid[0], back[0]].filter(Boolean);
  if (picked.length < 2)
    picked.push(
      ...(
        shuffle(enemies.filter((e: any) => !picked.includes(e))) as any[]
      ).slice(0, 2 - picked.length)
    );
  const targets = picked.slice(0, 2);
  const dmgRatios = [
    caster.def.skill.damage?.[0]?.atkRatio ?? 2.0,
    caster.def.skill.damage?.[1]?.atkRatio ?? 2.4,
  ];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const result = calcDamage(caster, t, dmgRatios[i], DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    if (i === 0) {
      // v2.12 第1目标: 30%降攻速×4s
      t._slowUntil = Math.max(t._slowUntil || 0, state.time + 4);
      t._slowPct = 0.3;
    }
    log.push({
      time: state.time,
      text: `${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(翅击#${i + 1})`,
      type: "damage",
    });
    applyMageLifeSteal(caster, state, log, result.finalDamage);
  }
});

// 地龙 — 龙踏：全屏+行系数
registerSkillHandler("dl_stomp", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  const rowMultipliers: Record<number, number> = { 0: 1.3, 1: 1.0, 2: 0.7 }; // v3.3 130/100/70%
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.5; // v2.36; // v2.32c
  for (const t of enemies) {
    const ratio = baseRatio * (rowMultipliers[t.row] ?? 1.0);
    const result = calcDamage(caster, t, ratio, DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    // v2.12 降命中20%×5s (可过期恢复)
    t.hitRateMod = (t.hitRateMod || 0) - 0.2;
    t._hitRedUntil = Math.max(t._hitRedUntil || 0, state.time + 5);
  }
  log.push({
    time: state.time,
    text: `🌍 ${caster.def.name} 释放龙踏: 全屏物理伤害+降命中20%`,
    type: "damage",
  });
});

// 西部猎人 — 跳跃射击：3发子弹
registerSkillHandler("xblr_shot", (caster, state, log) => {
  // v2.12 跳至空位
  const occupied = new Set(
    state.units
      .filter((u: any) => u.team === caster.team && !u.isDead)
      .map((u: any) => `${u.row},${u.col}`)
  );
  const empties: { row: number; col: number }[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++) {
      if (!occupied.has(`${r},${c}`)) empties.push({ row: r, col: c });
    }
  if (empties.length > 0) {
    const dest = empties[Math.floor(Math.random() * empties.length)];
    caster.row = dest.row;
    caster.col = dest.col;
  }
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const nTargets = Math.floor(Math.random() * 3) + 1;
  const targets = shuffle(enemies).slice(0, nTargets) as any[];
  const ratios = [0.8, 0.9, 1.2];
  for (const t of targets) {
    for (let i = 0; i < 3; i++) {
      const result = calcDamage(caster, t, ratios[i], DamageType.Physical, {
        isSkill: true,
      });
      let dmg = result.finalDamage;
      if (i === 2) dmg = Math.floor(dmg * 1.35);
      t.currentHp -= dmg;
      trackSkill(
        state,
        caster.id,
        caster.def.skill.id,
        caster.def.skill.name,
        dmg,
        "physical"
      );
      addStat(state, caster.id, "totalDamageDealt", dmg);
      addStat(state, caster.id, "skillDamage", dmg);
      addStat(state, caster.id, "physicalDamage", dmg);
      addStat(state, t.id, "totalDamageReceived", dmg);
    }
  }
  log.push({
    time: state.time,
    text: `🏹 ${caster.def.name} 跳跃射击: ${targets.length}名敌人`,
    type: "damage",
  });
});

// 冰霜猎人 — 持续射击+降攻速
registerSkillHandler("bslr_shot", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  // v2.12 随机1排目标
  const row = [0, 1, 2][Math.floor(Math.random() * 3)];
  const targets = enemies.filter((e: any) => e.row === row) as any[];
  if (targets.length === 0) return;
  for (const t of targets) {
    // v3.15 每秒150%×3s DoT + 降6%攻速×3层(18%)（DoT修复后回调）
    t.statuses.push({
      type: "bslr_dot" as any,
      remainingSeconds: 3,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.9), // v3.16f 回滚: 文档90%/s
      sourceId: caster.id,
    });
    // v3.16c 文档机制: 每次命中降10%攻击或20%攻速，持续4s（叠3层）
    t._bslrDebuffUntil = Math.max(t._bslrDebuffUntil || 0, state.time + 4);
    if (Math.random() < 0.5) {
      t._bslrAtkDown = Math.min(0.3, (t._bslrAtkDown || 0) + 0.1);
    } else {
      t._bslrSlowDown = Math.min(0.6, (t._bslrSlowDown || 0) + 0.2);
    }
    log.push({
      time: state.time,
      text: `❄️ ${caster.def.name} 持续射击 ${t.def.name}: 每秒120%×3s+降攻/降速4s`,
      type: "status",
    });
  }
  return;
  for (const t of targets) {
    const result = calcDamage(caster, t, 0.9, DamageType.Physical, {
      isSkill: true,
    });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastDamage = {
      value: result.finalDamage,
      time: state.time,
      type: "physical",
    };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(state, caster.id, "physicalDamage", result.finalDamage);
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
    // Attack speed reduction: 6% per stack, max 3 stacks
    const asStack = t._bslrSlowStack || 0;
    if (asStack < 3) {
      t._bslrSlowStack = asStack + 1;
      t.attackTimer *= 1.06; // 6% slower
    }
    log.push({
      time: state.time,
      text: `🏹 ${pfx(caster)} → ${pfx(t)}: ${result.finalDamage}💥(攻速-6%)`,
      type: "damage",
    });
  }
});

// 智慧猩 — 鼓舞：攻+40%+双抗
registerSkillHandler("zzx_buff", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.id !== caster.id
  );
  if (allies.length === 0) return;
  const beast = allies.filter((u: any) => u.def.race === "beast");
  const target = beast[0] || allies.sort(() => Math.random() - 0.5)[0];
  // v3.3 鼓舞: +25%攻 7s；自身与目标 10%物减 + 20%魔减 7s
  const atkBuff = Math.floor(target.currentAttack * 0.25);
  target.currentAttack += atkBuff;
  target._atkBuffAmt = (target._atkBuffAmt || 0) + atkBuff;
  target._atkBuffUntil = state.time + 7;
  // v2.11 增益窗口标记 (供转化率分析)
  target._atkBuffPct = 0.25;
  if ((state as any).trackTalent)
    (state as any).trackTalent(
      state,
      caster.id,
      "鼓舞(+25%攻)",
      atkBuff * 7,
      "buff"
    );
  caster._zzxDrPhys = 0.1;
  caster._zzxDrMag = 0.2;
  caster._zzxDrUntil = state.time + 7;
  target._zzxDrPhys = 0.1;
  target._zzxDrMag = 0.2;
  target._zzxDrUntil = state.time + 7;
  log.push({
    time: state.time,
    text: `📯 ${caster.def.name} 鼓舞 ${target.def.name}: +25%攻+物减10%魔减20%×7s`,
    type: "status",
  });
});

// 冰霜邪龙 — 每3次升级冰冻
registerSkillHandler("bsxl_freeze", (caster, state, log) => {
  // v3.3: 随机 1 排敌人
  const aliveEnemies = getAttackableEnemies(state, caster.team);
  const rows = [...new Set(aliveEnemies.map((u: any) => u.row))];
  if (rows.length === 0) return;
  const row = rows[Math.floor(Math.random() * rows.length)];
  const enemies = aliveEnemies.filter((u: any) => u.row === row);
  caster._bsxlFreezeCount = (caster._bsxlFreezeCount || 0) + 1;
  const isFreeze = caster._bsxlFreezeCount >= 2; // v3.3 每 2 次
  if (isFreeze) caster._bsxlFreezeCount = 0;

  for (const t of enemies) {
    let dmgRatio = 0.8;
    let dmgType = DamageType.Magical;
    if (isFreeze) {
      dmgRatio = 0.8;
      dmgType = DamageType.Pure;
      t.statuses.push({
        type: StatusType.Freeze,
        remainingSeconds: 3,
        stacks: 1,
      });
    } else {
      // v2.12 非冰冻: 每秒80%魔法×3s DoT + 降20%攻速×3s
      t.statuses.push({
        type: "bsxl_dot" as any,
        remainingSeconds: 4,
        stacks: 1,
        value: Math.floor(
          caster.currentAttack * (caster.def.skill.damage?.[0]?.atkRatio ?? 0.6)
        ),
        sourceId: caster.id,
      });
      t._slowUntil = Math.max(t._slowUntil || 0, state.time + 4); // v3.3 降攻速4s
      t._slowPct = 0.4; // v3.3 降攻速40%
      dmgRatio = 0; // DoT 接管伤害
    }
    const result = calcDamage(caster, t, dmgRatio, dmgType, { isSkill: true });
    t.currentHp -= result.finalDamage;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      result.finalDamage,
      "physical"
    );
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
    addStat(state, caster.id, "skillDamage", result.finalDamage);
    addStat(
      state,
      caster.id,
      dmgType === "magical" ? "magicalDamage" : "pureDamage",
      result.finalDamage
    );
    addStat(state, t.id, "totalDamageReceived", result.finalDamage);
  }
  log.push({
    time: state.time,
    text: `❄️ ${caster.def.name} ${isFreeze ? "冰冻吐息(纯粹)" : "冰霜吐息"}`,
    type: "damage",
  });
});

// 分析者 — 提升3名友方最低防御项5%防御力
registerSkillHandler("fxz_analyze", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead
  );
  const shuffled = allies.sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, 3).filter((u: any) => u.id !== caster.id);
  if (targets.length === 0) return;
  for (const t of targets) {
    if (t.currentPhysicalDef < t.currentMagicalDef) {
      t.currentPhysicalDef = Math.floor(t.currentPhysicalDef * 1.06);
    } else {
      t.currentMagicalDef = Math.floor(t.currentMagicalDef * 1.05);
    }
  }
  log.push({
    time: state.time,
    text: `📊 ${caster.def.name} 分析: 提升${targets.length}名友方防御`,
    type: "status",
  });
});

// 白马行者 — 蓄力：随机1/2/3s，不同蓄力时间对应不同目标排
registerSkillHandler("bmxz_charge", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const chargeTime = caster._chargeTime || 2;
  caster._chargeTime = undefined;
  // Determine target rows based on charge time
  let targetRows: number[];
  if (chargeTime <= 1)
    targetRows = [0]; // 前排
  else if (chargeTime <= 2)
    targetRows = [0, 1]; // 前中排
  else targetRows = [0, 1, 2]; // 全场
  const targets = enemies.filter((e: any) => targetRows.includes(e.row));
  if (targets.length === 0) return;
  const baseDmg = caster.currentAttack * 1.9;
  const dmgPerTarget =
    targets.length >= 5 ? Math.floor(baseDmg * 0.7) : Math.floor(baseDmg);
  for (const t of targets) {
    const result = calcDamage(
      caster,
      t,
      caster.def.skill.damage?.[0]?.atkRatio ?? 2.0,
      DamageType.Magical,
      {
        isSkill: true,
      }
    );
    let finalDmg = result.finalDamage;
    if (targets.length >= 5) finalDmg = Math.floor(finalDmg * 0.7);
    t.currentHp -= finalDmg;
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      finalDmg,
      "magical"
    );
    t.lastDamage = { value: finalDmg, time: state.time, type: "magical" };
    t.lastHitBy = caster.id;
    addStat(state, caster.id, "totalDamageDealt", finalDmg);
    addStat(state, caster.id, "skillDamage", finalDmg);
    addStat(state, caster.id, "magicalDamage", finalDmg);
    addStat(state, t.id, "totalDamageReceived", finalDmg);
  }
  const label = chargeTime <= 1 ? "前排" : chargeTime <= 2 ? "前中排" : "全场";
  log.push({
    time: state.time,
    text: `⚡ ${caster.def.name} 蓄力${chargeTime}s → ${label}: ${Math.floor(baseDmg)}魔法伤害`,
    type: "damage",
  });
});

// Initialize all registered handlers
export function initSkillHandlers() {
  // Registrations are done at module load time above
}

// ============ 圣职者 (v3.0 实装) ============

// 符咒大师 — 符咒: 150% + 印记×10%
registerSkillHandler("fz_curse", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const target = enemies[Math.floor(Math.random() * enemies.length)];
  const stacks = target._fzMarks || 0;
  const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 1.8;
  const ratio = baseRatio * (1 + stacks * 0.08); // v3.3 每层+8%
  const result = calcDamage(caster, target, ratio, DamageType.Magical, {
    isSkill: true,
  });
  target.currentHp -= result.finalDamage;
  addStat(state, caster.id, "totalDamageDealt", result.finalDamage);
  addStat(state, caster.id, "skillDamage", result.finalDamage);
  addStat(state, caster.id, "magicalDamage", result.finalDamage);
  trackSkill(
    state,
    caster.id,
    caster.def.skill.id,
    caster.def.skill.name,
    result.finalDamage,
    "physical"
  );
  target.lastDamage = {
    value: result.finalDamage,
    time: state.time,
    type: "magical",
  };
  target.lastHitBy = caster.id;
  log.push({
    time: state.time,
    text: `🧿 ${caster.def.name} 符咒 ${pfx(target)}: ${result.finalDamage}${stacks > 0 ? ` (印记${stacks}层)` : ""}`,
    type: "damage",
  });
});

// 驱魔者 — 2×2范围 180%魔法 (有增益→纯粹)
registerSkillHandler("qm_exorcise", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const pick = shuffle(enemies).slice(0, 4) as any[];
  let total = 0;
  for (const t of pick as any[]) {
    const hasBuff = (t.statuses || []).some(
      (s: any) =>
        ["atkBuff", "inspire", "_hqsStacks"].includes(s.type) ||
        s.type === StatusType.Bloodrage
    );
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.0;
    const r = calcDamage(
      caster,
      t,
      baseRatio,
      hasBuff ? DamageType.Pure : DamageType.Magical,
      { isSkill: true }
    );
    t.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "pureDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "pure"
    );
    total += r.finalDamage;
  }
  log.push({
    time: state.time,
    text: `⛩ ${caster.def.name} 驱魔: 2×2范围 ${total}${pick.some((t: any) => (t.statuses || []).length > 0) ? " (含纯粹)" : ""}`,
    type: "damage",
  });
});

// 圣骑士 — 治疗2圣职者210% + 驱散+30% + 圣之护盾（v3.4 R17）
registerSkillHandler("sq_heal", (caster, state, log) => {
  const allies = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.def.race === "holy"
  );
  const sorted = allies.sort(
    (a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp
  );
  const targets = sorted.slice(0, 2);
  for (const t of targets) {
    let mult = 1.0;
    const hasNeg = (t.statuses || []).length > 0;
    if (hasNeg) {
      t.statuses = t.statuses.filter(
        (s: any) =>
          ![
            "stun",
            "sleep",
            "petrify",
            "freeze",
            "bind",
            "burn",
            "armorBreak",
            "disarm",
            "curse",
            "ruin",
            "silence",
            "doom",
            "poison",
            "slow",
          ].includes(String(s.type).toLowerCase())
      );
      mult = 1.3;
    }
    const heal = Math.floor(
      caster.currentAttack * (caster.def.skill.heal?.atkRatio ?? 2.1) * mult
    );
    caster.lastHealTarget = t.id; // v3.15: 治疗统计
    t.lastHeal = { value: heal, time: state.time };
    addStat(state, caster.id, "totalHealingDone", heal);
    addStat(state, caster.id, "totalHealing", heal);
    addStat(state, t.id, "totalHealingReceived", heal);
    t.currentHp = Math.min(t.maxHp, t.currentHp + heal);
    // 圣之护盾 8s
    t._sqShieldUntil = state.time + 7; // v3.3 护盾7s
    log.push({
      time: state.time,
      text: `🛡 ${caster.def.name} 圣光治愈 ${pfx(t)}: +${heal}${hasNeg ? " (驱散+30%)" : ""} +圣之护盾7s`,
      type: "heal",
    });
  }
});

// 祈祷者 — 随机祈祷
registerSkillHandler("qd_pray", (caster, state, log) => {
  caster._qdMissStreak = (caster._qdMissStreak || 0) + 1;
  let roll = Math.random();
  let outcome: string;
  if (caster._qdMissStreak >= 3) {
    outcome = roll < 0.4 ? "大成功" : "成功";
  } else {
    outcome =
      roll < 0.1
        ? "大成功"
        : roll < 0.4
          ? "成功"
          : roll < 0.9
            ? "一般"
            : "失败";
  }
  if (outcome === "大成功" || outcome === "成功") caster._qdMissStreak = 0;
  const lowest = state.units
    .filter((u: any) => u.team === caster.team && !u.isDead)
    .sort((a: any, b: any) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  if (outcome === "大成功") {
    if (lowest) {
      lowest._qdInvulnUntil = state.time + 5;
      lowest._qdRegenUntil = state.time + 5;
      lowest._qdRegenPct = 0.02;
    }
    caster._qdInvulnUntil = state.time + 5;
    caster._qdRegenUntil = state.time + 5;
    caster._qdRegenPct = 0.02;
    log.push({
      time: state.time,
      text: `🙏 祈祷大成功: 无敌+回2%/s×5s`,
      type: "heal",
    });
  } else if (outcome === "成功") {
    if (lowest) {
      lowest._qdDrUntil = state.time + 5;
      lowest._qdDrPct = 0.4;
      lowest._qdRegenUntil = state.time + 5;
      lowest._qdRegenPct = 0.01;
    }
    log.push({
      time: state.time,
      text: `🙏 祈祷成功: 减伤40%+回1%/s×5s`,
      type: "heal",
    });
  } else if (outcome === "一般") {
    if (lowest) {
      lowest._qdDrUntil = state.time + 5;
      lowest._qdDrPct = 0.2;
    }
    log.push({
      time: state.time,
      text: `🙏 祈祷一般: 减伤20%×5s`,
      type: "status",
    });
  } else {
    const dmg = Math.floor(caster.maxHp * 0.1);
    caster.currentHp -= dmg;
    log.push({
      time: state.time,
      text: `🙏 祈祷失败: 自损${dmg}`,
      type: "damage",
    });
  }
});

// 圣拳者 — 后排3×70%
registerSkillHandler("sqz_combo", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const back = enemies.filter((e: any) => e.row === Row.Back);
  const pool = back.length > 0 ? back : enemies;
  const target = pool[Math.floor(Math.random() * pool.length)];
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 0.8;
    const r = calcDamage(caster, target, baseRatio, DamageType.Physical, {
      isSkill: true,
    });
    target.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "physicalDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "physical"
    );
    total += r.finalDamage;
  }
  target.lastHitBy = caster.id;
  log.push({
    time: state.time,
    text: `👊 ${caster.def.name} 圣拳连击 ${pfx(target)}: ${total}`,
    type: "damage",
  });
});

// 朱雀之神 — 1排220%魔法+灼烧4s
registerSkillHandler("zq_flame", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const row = [0, 1, 2][Math.floor(Math.random() * 3)];
  const targets = enemies.filter((e: any) => e.row === row);
  let total = 0;
  for (const t of targets) {
    const baseRatio = caster.def.skill.damage?.[0]?.atkRatio ?? 2.5;
    const r = calcDamage(caster, t, baseRatio, DamageType.Magical, {
      isSkill: true,
    });
    t.currentHp -= r.finalDamage;
    addStat(state, caster.id, "totalDamageDealt", r.finalDamage);
    addStat(state, caster.id, "skillDamage", r.finalDamage);
    addStat(state, caster.id, "magicalDamage", r.finalDamage);
    trackSkill(
      state,
      caster.id,
      caster.def.skill.id,
      caster.def.skill.name,
      r.finalDamage,
      "magical"
    );
    total += r.finalDamage;
    t.statuses.push({
      type: StatusType.Burn,
      remainingSeconds: 4,
      stacks: 1,
      value: Math.floor(caster.currentAttack * 0.05),
    });
  }
  log.push({
    time: state.time,
    text: `🔥 ${caster.def.name} 朱雀焚天 ${targets.length}人: ${total}+灼烧4s`,
    type: "damage",
  });
});

// 圣裁者 — 审判之光
registerSkillHandler("sc_judge", (caster, state, log) => {
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const top = enemies.sort(
    (a: any, b: any) => (b._dmgRecent9s || 0) - (a._dmgRecent9s || 0)
  )[0];
  // v3.3: 只把「增益状态」算作有增益，负面/DoT 不算
  const NEGATIVE = [
    "stun",
    "sleep",
    "petrify",
    "freeze",
    "bind",
    "burn",
    "curse",
    "poison",
    "doom",
    "ruin",
    "silence",
    "disarm",
    "slow",
    "armorBreak",
    "sc_judge_dot",
  ];
  const hasBuff = (top.statuses || []).some(
    (s: any) => !NEGATIVE.includes(String(s.type).toLowerCase())
  );
  const atk = hasBuff ? top.currentAttack : caster.currentAttack;
  top.statuses.push({
    type: StatusType.Silence,
    remainingSeconds: 5,
    stacks: 1,
  });
  top.statuses.push({
    type: "sc_judge_dot" as any,
    remainingSeconds: 4,
    stacks: 1,
    value: Math.floor(atk * 0.35),
    sourceId: caster.id,
    clearBuffsOnEnd: hasBuff,
  });
  // v3.3: 效果「结束后」清除目标全部增益，不再立即清空（旧实现会自删沉默与 DoT）
  log.push({
    time: state.time,
    text: `⚖ ${caster.def.name} 审判之光 ${pfx(top)}: 沉默+35%纯粹×4s${hasBuff ? " (结束清增益)" : ""}`,
    type: "control",
  });
});

// 殉道者 — 牺牲嘲讽
registerSkillHandler("xd_sacrifice", (caster, state, log) => {
  // v3.4: 使敌方随机 1 名造成伤害-20%，每秒受到目标自身防御总和×20%纯粹，持续4s
  const enemies = getAttackableEnemies(state, caster.team);
  if (enemies.length === 0) return;
  const t = enemies[Math.floor(Math.random() * enemies.length)];
  t._xdDmgDownUntil = state.time + 4;
  t._xdDmgDown = 0.2;
  const defSum = (t.currentPhysicalDef || 0) + (t.currentMagicalDef || 0);
  t.statuses.push({
    type: "xd_dot" as any,
    remainingSeconds: 4,
    stacks: 1,
    value: Math.max(1, Math.floor(defSum * 0.2)),
    sourceId: caster.id,
  } as any);
  log.push({
    time: state.time,
    text: `✝ ${caster.def.name} 牺牲: ${t.def.name} 造成伤害-20% + 每秒${Math.floor(defSum * 0.2)}纯粹×4s`,
    type: "control",
  });
});

function pickTarget(
  enemies: any[],
  rowPref?: { row: number; chance: number }[],
  excludeStealth = true
): any | undefined {
  if (enemies.length === 0) return undefined;
  if (rowPref && rowPref.length > 0) {
    const total = rowPref.reduce((s, r) => s + r.chance, 0);
    let roll = Math.random() * total;
    for (const p of rowPref) {
      roll -= p.chance;
      if (roll <= 0) {
        const inRow = enemies.filter((e: any) => e.row === p.row);
        if (inRow.length > 0)
          return inRow[Math.floor(Math.random() * inRow.length)];
        break;
      }
    }
  }
  return enemies[Math.floor(Math.random() * enemies.length)];
}

function applyMageLifeSteal(
  caster: any,
  state: any,
  log: any[],
  damage: number
) {
  if (damage <= 0) return;
  const mageCnt = state.units.filter(
    (u: any) => u.team === caster.team && !u.isDead && u.def.race === "mage"
  ).length;
  const lsPct = mageCnt >= 4 ? 0.3 : mageCnt >= 3 ? 0.15 : 0;
  if (lsPct > 0) {
    const lsHeal = Math.floor(damage * lsPct);
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `💉 ${pfx(caster)} 技能吸血 +${lsHeal}`,
      type: "heal",
    });
  }
  if ((caster.lifeSteal ?? 0) > 0) {
    const lsHeal = Math.floor(damage * (caster.lifeSteal ?? 0));
    caster.currentHp = Math.min(caster.maxHp, caster.currentHp + lsHeal);
    log.push({
      time: state.time,
      text: `🔗 ${pfx(caster)} 链接吸血 +${lsHeal}`,
      type: "heal",
    });
  }
}

function pfx(u: any): string {
  const r: string = u.def.race;
  const tag =
    (
      {
        beast: "兽",
        hunter: "猎",
        warrior: "战",
        mage: "法",
        undead: "亡",
        dragon: "龙",
      } as any
    )[r] || r;
  return `${u.team === "ally" ? "🟦" : "🟥"}[${tag}]${u.def.name}`;
}

function addStat(state: any, unitId: string, field: string, value: number) {
  const s = state.stats?.find((st: any) => st.unitId === unitId);
  if (s && typeof s[field] === "number") s[field] += value;
}
