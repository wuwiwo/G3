import { CharacterDef, Race, DamageType, StatusType, Row } from "../types";
// v1.5 全角色数据 · Lv.100 裸属性

// ======================== 兽族 ========================

const pp: CharacterDef = {
  id: "pp",
  name: "彭彭猪",
  race: Race.Beast,
  stats: {
    hp: 8720,
    attack: 544.8,
    physicalDef: 216,
    magicalDef: 163.5,
    attackInterval: 2.5,
  },
  growth: { hp: 80, attack: 5.2, physicalDef: 2, magicalDef: 1.5 },
  talent: "自身进入睡眠状态时，每秒恢复4%最大生命值",
  skill: {
    id: "pp_sleep",
    name: "催眠",
    tags: ["控制"],
    cooldown: 12,
    castTime: 0,
    description: "令自身与敌人最后排随机一名同时进入睡眠3s",
    effects: [{ type: StatusType.Sleep, duration: 3 }],
  },
};

const hl: CharacterDef = {
  id: "hl",
  name: "嚎叫巨牛",
  race: Race.Beast,
  stats: {
    hp: 6620,
    attack: 738,
    physicalDef: 338.8,
    magicalDef: 192.2,
    attackInterval: 3,
  },
  growth: { hp: 60, attack: 7, physicalDef: 3.2, magicalDef: 1.8 },
  talent: "开场降全场敌攻25%（Lv.100），持续6s",
  skill: {
    id: "hl_rage",
    name: "激怒",
    tags: ["增益"],
    cooldown: 999,
    castTime: 0,
    description: "首次HP<25%时，提升35%攻击+20%攻速，免疫异常至战斗结束",
  },
};

const yl: CharacterDef = {
  id: "yl",
  name: "夜行狼人",
  race: Race.Beast,
  stats: {
    hp: 5005,
    attack: 574.5,
    physicalDef: 261.5,
    magicalDef: 158.5,
    attackInterval: 1.8,
  },
  growth: { hp: 45, attack: 5.5, physicalDef: 2.5, magicalDef: 1.5 },
  talent: "开场加全兽攻30%，每8s衰减20%至40%",
  skill: {
    id: "yl_stealth",
    name: "潜行",
    tags: ["切入"],
    cooldown: 8,
    castTime: 0,
    description: "潜行(不可选中)，每秒回1%HP，下次攻击2.1倍，优先后排",
    damage: [{ type: DamageType.Physical, atkRatio: 2.1 }],
    priority: [
      { row: Row.Back, chance: 50 },
      { row: Row.Mid, chance: 40 },
      { row: Row.Front, chance: 10 },
    ],
  },
};

const hx: CharacterDef = {
  id: "hx",
  name: "虎啸",
  race: Race.Beast,
  stats: {
    hp: 6045,
    attack: 651.8,
    physicalDef: 295.2,
    magicalDef: 190.2,
    attackInterval: 2.2,
  },
  growth: { hp: 55, attack: 6.2, physicalDef: 2.8, magicalDef: 1.8 },
  talent: "兽族阵亡自身攻+7%、防+7%（Lv.100）至战斗结束",
  skill: {
    id: "hx_cut",
    name: "虎袭",
    tags: ["切入"],
    cooldown: 5,
    castTime: 0,
    description: "对随机2名各造成200-240%伤害，优先后排",
    damage: [{ type: DamageType.Physical, atkRatio: 2.2 }],
    aoe: { maxTargets: 2 },
    priority: [
      { row: Row.Back, chance: 60 },
      { row: Row.Mid, chance: 10 },
      { row: Row.Front, chance: 30 },
    ],
  },
};

const zzx: CharacterDef = {
  id: "zzx",
  name: "智慧猩",
  race: Race.Beast,
  stats: {
    hp: 5410,
    attack: 416,
    physicalDef: 163.5,
    magicalDef: 322,
    attackInterval: 3.5,
  },
  growth: { hp: 50, attack: 4, physicalDef: 1.5, magicalDef: 3 },
  talent: "开局封敌方对应位置技能/天赋6s（Lv.100）",
  skill: {
    id: "zzx_buff",
    name: "鼓舞",
    tags: ["增益"],
    cooldown: 9,
    castTime: 0,
    description: "使一名友方（优先兽族）提升40%攻击力5s+自身与目标双抗7s",
    scriptId: "zzx_buff",
  },
};

const dxm: CharacterDef = {
  id: "dxm",
  name: "独行马",
  race: Race.Beast,
  stats: {
    hp: 4955,
    attack: 378.5,
    physicalDef: 176.5,
    magicalDef: 164.6,
    attackInterval: 2.8,
  },
  growth: { hp: 45, attack: 3.5, physicalDef: 1.5, magicalDef: 1.4 },
  talent: "与自身同排所有友方技能冷却减少18%（Lv.100，含自身）",
  skill: {
    id: "dxm_heal",
    name: "治愈",
    tags: ["治疗"],
    cooldown: 7,
    castTime: 0,
    description: "治疗最低血量友方（优先兽族）：5×等级+攻击×170%",
    heal: { fixedAdd: 600, atkRatio: 1.7 },
  },
};

const lbmx: CharacterDef = {
  id: "lbmx",
  name: "裂地蛮熊",
  race: Race.Beast,
  stats: {
    hp: 5005,
    attack: 477.5,
    physicalDef: 301.2,
    magicalDef: 130.8,
    attackInterval: 3,
  },
  growth: { hp: 45, attack: 4.5, physicalDef: 2.8, magicalDef: 1.2 },
  talent: "开场嘲讽敌方前排强制攻击自身5s，无法使用技能",
  skill: {
    id: "lbmx_smash",
    name: "拍击",
    tags: ["范围"],
    cooldown: 8,
    castTime: 0,
    description: "前中排全体攻击×190%物理+降20%攻速5s（后排-40%伤害）",
    damage: [{ type: DamageType.Physical, atkRatio: 1.9 }],
    aoe: { rows: [Row.Front, Row.Mid], maxTargets: 6 },
  },
};

const ds: CharacterDef = {
  id: "ds",
  name: "洞狮",
  race: Race.Beast,
  stats: {
    hp: 3984,
    attack: 489.5,
    physicalDef: 196.2,
    magicalDef: 173.4,
    attackInterval: 2.8,
  },
  growth: { hp: 36, attack: 4.5, physicalDef: 1.8, magicalDef: 1.6 },
  talent: "免疫攻防降低效果",
  skill: {
    id: "ds_bite",
    name: "撕咬",
    tags: ["切入", "控制", "吸血"],
    cooldown: 9,
    castTime: 0,
    description: "撕咬1名敌人，每秒攻击×65%+10纯粹伤害+无法行动，自身恢复20%",
    damage: [{ type: DamageType.Pure, atkRatio: 0.65, fixedAdd: 10 }],
    priority: [
      { row: Row.Back, chance: 50 },
      { row: Row.Mid, chance: 30 },
      { row: Row.Front, chance: 20 },
    ],
  },
};

const mmx: CharacterDef = {
  id: "mmx",
  name: "猛犸象",
  race: Race.Beast,
  stats: {
    hp: 8205,
    attack: 594.5,
    physicalDef: 341.8,
    magicalDef: 237.8,
    attackInterval: 4,
  },
  growth: { hp: 75, attack: 5.5, physicalDef: 3.2, magicalDef: 2.2 },
  talent: "每7s卷曲4s：防+70%，攻-25%",
  skill: {
    id: "mmx_stomp",
    name: "踩踏",
    tags: [],
    cooldown: 9,
    castTime: 1,
    description: "110%攻击物理+自身防御×2纯粹（前排+20%）",
    damage: [
      { type: DamageType.Physical, atkRatio: 1.1 },
      { type: DamageType.Pure, selfDefMultiplier: 2 },
    ],
  },
};

// ======================== 猎人 ========================

const sszs: CharacterDef = {
  id: "sszs",
  name: "森之射手",
  race: Race.Hunter,
  stats: {
    hp: 4855,
    attack: 703.5,
    physicalDef: 193.2,
    magicalDef: 128.8,
    attackInterval: 2.1,
  },
  growth: { hp: 45, attack: 6.5, physicalDef: 1.8, magicalDef: 1.2 },
  talent: "25%闪避（同排有猎人则40%）",
  skill: {
    id: "sszs_bind",
    name: "束缚射击",
    tags: ["控制"],
    cooldown: 6,
    castTime: 0,
    description: "攻击×210%物理+束缚2s",
    damage: [{ type: DamageType.Physical, atkRatio: 2.1 }],
    effects: [{ type: StatusType.Bind, duration: 2 }],
  },
};

const bslr: CharacterDef = {
  id: "bslr",
  name: "冰霜猎人",
  race: Race.Hunter,
  stats: {
    hp: 4460,
    attack: 663.8,
    physicalDef: 162.5,
    magicalDef: 159.5,
    attackInterval: 2.3,
  },
  growth: { hp: 40, attack: 6.2, physicalDef: 1.5, magicalDef: 1.5 },
  talent: "30%概率无视基础防御（受击后失效3s）",
  skill: {
    id: "bslr_shot",
    name: "持续射击",
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "对1排敌人持续射击3s，每秒攻击×90%，每次降6%攻速（叠3层）",
    damage: [{ type: DamageType.Physical, atkRatio: 0.9 }],
    aoe: { maxTargets: 3 },
    scriptId: "bslr_shot",
  },
};

const hqs: CharacterDef = {
  id: "hqs",
  name: "火枪手",
  race: Race.Hunter,
  stats: {
    hp: 4905,
    attack: 688.6,
    physicalDef: 161.5,
    magicalDef: 158.5,
    attackInterval: 2,
  },
  growth: { hp: 45, attack: 6.4, physicalDef: 1.5, magicalDef: 1.5 },
  talent: "被切入时防御+90%、攻击+35%，持续5s（可叠加）",
  skill: {
    id: "hqs_snipe",
    name: "狙击",
    tags: [],
    cooldown: 10,
    castTime: 2.5,
    description: "物防最高敌人：物防×4纯粹+攻击×170%物理",
    damage: [
      { type: DamageType.Pure, defMultiplier: 4 },
      { type: DamageType.Physical, atkRatio: 1.7 },
    ],
  },
};

const mds: CharacterDef = {
  id: "mds",
  name: "美杜莎",
  race: Race.Hunter,
  stats: {
    hp: 5105,
    attack: 594.6,
    physicalDef: 196.2,
    magicalDef: 214,
    attackInterval: 2.6,
  },
  growth: { hp: 45, attack: 5.4, physicalDef: 1.8, magicalDef: 2 },
  talent: "攻击-15%，同时对2名敌人攻击；攻击束缚敌人有40%几率石化2s",
  skill: {
    id: "mds_skill",
    name: "石化凝视",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description: "前中后各1名敌人：攻击×140%魔法+束缚4s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.4 }],
    effects: [{ type: StatusType.Bind, duration: 4 }],
  },
};

const zfyx: CharacterDef = {
  id: "zfyx",
  name: "追风游侠",
  race: Race.Hunter,
  stats: {
    hp: 4242,
    attack: 685.6,
    physicalDef: 160.5,
    magicalDef: 108,
    attackInterval: 1.9,
  },
  growth: { hp: 38, attack: 6.4, physicalDef: 1.5, magicalDef: 1 },
  talent:
    "同排敌人每次切入→对敌方造成85%伤害攻击+同排友方加攻15%（10s，不叠加）",
  skill: {
    id: "zfyx_arrow",
    name: "三连射",
    tags: ["移动"],
    cooldown: 8,
    castTime: 0,
    description: "发射3枚弓箭，每次攻击×110%随机敌人，发射后随机移动至空位",
    damage: [{ type: DamageType.Physical, atkRatio: 1.1 }],
    aoe: { maxTargets: 3 },
  },
};

const lxgz: CharacterDef = {
  id: "lxgz",
  name: "灵弦歌者",
  race: Race.Hunter,
  stats: {
    hp: 4678,
    attack: 636,
    physicalDef: 194.2,
    magicalDef: 172.4,
    attackInterval: 2.6,
  },
  growth: { hp: 42, attack: 6, physicalDef: 1.8, magicalDef: 1.6 },
  talent: "治疗后使目标获得激昂：攻+20%、攻速+10%，持续5s",
  skill: {
    id: "lxgz_heal",
    name: "治愈琴音",
    tags: ["治疗"],
    cooldown: 11,
    castTime: 2,
    description: "弹奏2s→最低2名友方持续恢复5s，每秒攻击×25%+已损生命×8%",
    heal: { atkRatio: 0.25, targetLostHpRatio: 0.08 },
    aoe: { maxTargets: 2 },
  },
};

// ======================== 战士 ========================

const crzs: CharacterDef = {
  id: "crzs",
  name: "炽热战士",
  race: Race.Warrior,
  stats: {
    hp: 6105,
    attack: 619.2,
    physicalDef: 213,
    magicalDef: 162.5,
    attackInterval: 2.3,
  },
  growth: { hp: 55, attack: 5.8, physicalDef: 2, magicalDef: 1.5 },
  talent: "每秒自损1%HP，对同排敌方造成每秒攻击×1.5%+2纯粹伤害",
  skill: {
    id: "crzs_punch",
    name: "灼热拳击",
    tags: [],
    cooldown: 4,
    castTime: 0,
    description: "攻击×180%物理+灼烧3s，自受20%反伤",
    damage: [{ type: DamageType.Physical, atkRatio: 1.8 }],
    effects: [{ type: StatusType.Burn, duration: 3, value: 0.05 }],
  },
};

const hd: CharacterDef = {
  id: "hd",
  name: "辉刀",
  race: Race.Warrior,
  stats: {
    hp: 5590,
    attack: 668.8,
    physicalDef: 192.2,
    magicalDef: 130.8,
    attackInterval: 1.8,
  },
  growth: { hp: 50, attack: 6.2, physicalDef: 1.8, magicalDef: 1.2 },
  talent: "攻+15%，命中-15%，未命中受50%反伤",
  skill: {
    id: "hd_slash",
    name: "斩击",
    tags: [],
    cooldown: 8,
    castTime: 1.5,
    description: "随机1排全体：攻击×200%物理",
    damage: [{ type: DamageType.Physical, atkRatio: 2.0 }],
    aoe: { maxTargets: 3 },
  },
};

const fxz: CharacterDef = {
  id: "fxz",
  name: "分析者",
  race: Race.Warrior,
  stats: {
    hp: 6244,
    attack: 525.1,
    physicalDef: 259.6,
    magicalDef: 218,
    attackInterval: 2.5,
  },
  growth: { hp: 56, attack: 4.9, physicalDef: 2.4, magicalDef: 2 },
  talent: "标记对称敌人→闪避/额外防御=0，直到分析者阵亡",
  skill: {
    id: "fxz_analyze",
    name: "分析",
    tags: ["增益"],
    cooldown: 6,
    castTime: 0,
    description: "提升3名友方最低防御项5%防御力，可叠10次",
    scriptId: "fxz_analyze",
  },
};

const fdzs: CharacterDef = {
  id: "fdzs",
  name: "风之斗士",
  race: Race.Warrior,
  stats: {
    hp: 5996,
    attack: 644,
    physicalDef: 196.2,
    magicalDef: 132.8,
    attackInterval: 2,
  },
  growth: { hp: 54, attack: 6, physicalDef: 1.8, magicalDef: 1.2 },
  talent: "对前排伤害+30%",
  skill: {
    id: "fdzs_combo",
    name: "疾风连击",
    tags: [],
    cooldown: 8,
    castTime: 2,
    description: "2s内6次快速攻击，每次攻击×60%且无视基础防御",
    damage: [{ type: DamageType.Physical, atkRatio: 0.6 }],
    aoe: { maxTargets: 1 },
  },
};

const kzs: CharacterDef = {
  id: "kzs",
  name: "狂战士",
  race: Race.Warrior,
  stats: {
    hp: 6322,
    attack: 616.3,
    physicalDef: 174.4,
    magicalDef: 130.8,
    attackInterval: 2,
  },
  growth: { hp: 58, attack: 5.7, physicalDef: 1.6, magicalDef: 1.2 },
  talent: "每损失12%HP→+12%攻+自回（损失HP×2%/s），叠5层",
  skill: {
    id: "kzs_rage",
    name: "血怒",
    tags: ["增益"],
    cooldown: 11,
    castTime: 0,
    description: "消耗10%当前HP→6s内攻速+40%，每次攻击附加目标当前HP×3%纯粹",
    effects: [{ type: StatusType.Bloodrage, duration: 6 }],
  },
};

const slzs: CharacterDef = {
  id: "slzs",
  name: "圣灵战士",
  race: Race.Warrior,
  stats: {
    hp: 6095,
    attack: 539,
    physicalDef: 176.4,
    magicalDef: 271.5,
    attackInterval: 2.5,
  },
  growth: { hp: 55, attack: 5, physicalDef: 1.6, magicalDef: 2.5 },
  talent: "受魔法伤害→反伤攻×60%+25纯粹+眩晕1s",
  skill: {
    id: "slzs_guard",
    name: "守护",
    tags: [],
    cooldown: 14,
    castTime: 0,
    description: "消耗10%HP→守护7s：攻-30%、减伤+25%、同排友方魔伤转移自身",
  },
};

const zqz: CharacterDef = {
  id: "zqz",
  name: "重拳者",
  race: Race.Warrior,
  stats: {
    hp: 6244,
    attack: 812.5,
    physicalDef: 214,
    magicalDef: 132.8,
    attackInterval: 3,
  },
  growth: { hp: 56, attack: 7.5, physicalDef: 2, magicalDef: 1.2 },
  talent: "每4次普攻→下次攻击+35%吸血+破甲4s",
  skill: {
    id: "zqz_strike",
    name: "毁灭打击",
    tags: ["切入"],
    cooldown: 10,
    castTime: 1,
    description: "攻击×290%物理+自晕2s+目标晕2s",
    damage: [{ type: DamageType.Physical, atkRatio: 2.9 }],
    effects: [{ type: StatusType.Stun, duration: 2 }],
    interruptOnAttack: true,
    priority: [{ row: Row.Mid, chance: 100 }],
  },
};

// ======================== 法师 ========================

const xdds: CharacterDef = {
  id: "xdds",
  name: "秀逗大师",
  race: Race.Mage,
  stats: {
    hp: 4480,
    attack: 649,
    physicalDef: 132.8,
    magicalDef: 235.8,
    attackInterval: 2.6,
  },
  growth: { hp: 40, attack: 6, physicalDef: 1.2, magicalDef: 2.2 },
  talent: "同排友方每次技能提升自身6%攻速，5层上限",
  skill: {
    id: "xdds_fire",
    name: "火球",
    tags: [],
    cooldown: 7,
    castTime: 1.5,
    description: "攻击×210%魔法，每3次升级陨石(1排+攻击×260%+灼烧3s)",
    damage: [{ type: DamageType.Magical, atkRatio: 2.1 }],
    priority: [
      { row: Row.Front, chance: 40 },
      { row: Row.Mid, chance: 35 },
      { row: Row.Back, chance: 25 },
    ],
    scriptId: "xdds_fire",
  },
};

const sjsn: CharacterDef = {
  id: "sjsn",
  name: "水晶室女",
  race: Race.Mage,
  stats: {
    hp: 4460,
    attack: 594.5,
    physicalDef: 111,
    magicalDef: 196.2,
    attackInterval: 3.2,
  },
  growth: { hp: 40, attack: 5.5, physicalDef: 1, magicalDef: 1.8 },
  talent: "上下左右格友方法师冷却减少20%（Lv.100）",
  skill: {
    id: "sjsn_freeze",
    name: "冰封",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description: "1名敌方束缚+缴械+每秒攻击×90%魔法，持续3s",
    damage: [{ type: DamageType.Magical, atkRatio: 0.9 }],
    effects: [
      { type: StatusType.Bind, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
    ],
  },
};

const bmxz: CharacterDef = {
  id: "bmxz",
  name: "白马行者",
  race: Race.Mage,
  stats: {
    hp: 5996,
    attack: 644,
    physicalDef: 196.2,
    magicalDef: 132.8,
    attackInterval: 2,
  },
  growth: { hp: 54, attack: 6, physicalDef: 1.8, magicalDef: 1.2 },
  talent: "友方全场法师每次施加异常→自身技能减1s冷却",
  skill: {
    id: "bmxz_charge",
    name: "蓄力",
    tags: [],
    cooldown: 10,
    castTime: 0,
    description: "随机蓄力1/2/3s→前排/前中排/全场：攻击×190%魔法(命中5名-30%)",
    damage: [{ type: DamageType.Magical, atkRatio: 1.9 }],
    interruptOnAttack: true,
    aoe: { maxTargets: 9 },
    scriptId: "bmxz_charge",
  },
};

const srm: CharacterDef = {
  id: "srm",
  name: "食人魔魔法师",
  race: Race.Mage,
  stats: {
    hp: 7085,
    attack: 574.7,
    physicalDef: 268.5,
    magicalDef: 217,
    attackInterval: 3.2,
  },
  growth: { hp: 65, attack: 5.3, physicalDef: 2.5, magicalDef: 2 },
  talent: "技能35%触发2次，16.5%触发3次",
  skill: {
    id: "srm_fire",
    name: "火焰爆轰",
    tags: ["控制"],
    cooldown: 6,
    castTime: 0,
    description: "攻击×155%魔法+眩晕0.8s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.55 }],
    effects: [{ type: StatusType.Stun, duration: 0.8 }],
  },
};

const ynfs: CharacterDef = {
  id: "ynfs",
  name: "湮灭法师",
  race: Race.Mage,
  stats: {
    hp: 4460,
    attack: 596.5,
    physicalDef: 160.5,
    magicalDef: 216,
    attackInterval: 3.2,
  },
  growth: { hp: 40, attack: 5.5, physicalDef: 1.5, magicalDef: 2 },
  talent: "开场移走自身+对称敌人3/6s",
  skill: {
    id: "ynfs_annihilate",
    name: "湮灭",
    tags: ["控制"],
    cooldown: 10,
    castTime: 2,
    description: "2×2格子：目标总防御²/350纯粹+束缚4s",
    damage: [{ type: DamageType.Pure, defSquaredDiv: 350 }],
    effects: [{ type: StatusType.Bind, duration: 4 }],
  },
};

const syz: CharacterDef = {
  id: "syz",
  name: "神谕者",
  race: Race.Mage,
  stats: {
    hp: 4560,
    attack: 602.5,
    physicalDef: 193.2,
    magicalDef: 257.6,
    attackInterval: 3.4,
  },
  growth: { hp: 40, attack: 5.5, physicalDef: 1.8, magicalDef: 2.4 },
  talent:
    "攻击时80%概率治疗最低血量友方×40%。阵亡时治疗全法师6s(攻×60%/s,+10%/s)",
  skill: {
    id: "syz_bless",
    name: "神之庇佑",
    tags: [],
    cooldown: 12,
    castTime: 0,
    description: "2名最低血量友方：减伤20%+延迟5s结算+驱散，持续7s",
    effects: [{ type: StatusType.Inspire, duration: 7, value: 0.8 }],
    scriptId: "syz_bless",
  },
};

// ======================== 亡灵 ========================

const wqqs: CharacterDef = {
  id: "wqqs",
  name: "亡魂骑士",
  race: Race.Undead,
  stats: {
    hp: 4360,
    attack: 537,
    physicalDef: 133.8,
    magicalDef: 237.8,
    attackInterval: 2.6,
  },
  growth: { hp: 40, attack: 5, physicalDef: 1.2, magicalDef: 2.2 },
  talent: "每个诅咒敌人+8%攻击（复活后+50%）",
  skill: {
    id: "wqqs_move",
    name: "亡魂突袭",
    tags: ["移动"],
    cooldown: 7,
    castTime: 0,
    description: "随机移动→对1名敌人造成攻击×100%纯粹+周围格子诅咒3s",
    damage: [{ type: DamageType.Pure, atkRatio: 1.0 }],
    effects: [{ type: StatusType.Curse, duration: 3 }],
  },
};

const kldd: CharacterDef = {
  id: "kldd",
  name: "骷髅大帝",
  race: Race.Undead,
  stats: {
    hp: 7035,
    attack: 606.4,
    physicalDef: 257.6,
    magicalDef: 216,
    attackInterval: 2.6,
  },
  growth: { hp: 65, attack: 5.6, physicalDef: 2.4, magicalDef: 2 },
  talent: "开场召3骷髅兵，阵亡时骷髅同亡，复活后重召",
  skill: {
    id: "kldd_hammer",
    name: "冥火之锤",
    tags: [],
    cooldown: 8,
    castTime: 0,
    description: "攻击×170%魔法+眩晕1s；3s后追加80%纯粹",
    damage: [
      { type: DamageType.Magical, atkRatio: 1.7 },
      { type: DamageType.Pure, atkRatio: 0.8 },
    ],
    effects: [{ type: StatusType.Stun, duration: 1 }],
  },
};

const klb: CharacterDef = {
  id: "klb",
  name: "骷髅兵",
  race: Race.Undead,
  stats: {
    hp: 1090,
    attack: 178.5,
    physicalDef: 109,
    magicalDef: 322,
    attackInterval: 3,
  },
  growth: { hp: 10, attack: 1.5, physicalDef: 1, magicalDef: 3 },
  talent: "优先攻击冥火之锤目标；无视40%防御；30%伤害治疗骷髅大帝",
  skill: {
    id: "klb_attack",
    name: "攻击",
    tags: [],
    cooldown: 2,
    castTime: 0,
    description: "普通攻击",
    damage: [{ type: DamageType.Physical, atkRatio: 1.0 }],
  },
};

const yammxz: CharacterDef = {
  id: "yammxz",
  name: "幽暗密行者",
  race: Race.Undead,
  stats: {
    hp: 4805,
    attack: 604.5,
    physicalDef: 148.6,
    magicalDef: 173.4,
    attackInterval: 2.5,
  },
  growth: { hp: 45, attack: 5.5, physicalDef: 1.4, magicalDef: 1.6 },
  talent: "每8s使同排敌方诅咒5s；复活后升级为诅咒+破坏",
  skill: {
    id: "yammxz_swap",
    name: "暗影换位",
    tags: ["移动"],
    cooldown: 7,
    castTime: 0,
    description: "与友方换位→对称2名敌人沉默4s+攻击×90%纯粹",
    damage: [{ type: DamageType.Pure, atkRatio: 0.9 }],
    effects: [{ type: StatusType.Silence, duration: 4 }],
  },
};

const dyq: CharacterDef = {
  id: "dyq",
  name: "地狱之犬",
  race: Race.Undead,
  stats: {
    hp: 2854,
    attack: 614.4,
    physicalDef: 194.2,
    magicalDef: 172.4,
    attackInterval: 2.6,
  },
  growth: { hp: 26, attack: 5.6, physicalDef: 1.8, magicalDef: 1.6 },
  talent: "攻击15%/技能35%触发致命一击×140%（独立于暴击取高，复活后175%）",
  skill: {
    id: "dyq_dash",
    name: "冲刺",
    tags: ["移动"],
    cooldown: 7,
    castTime: 0,
    description: "竖排全体攻击×170%魔法+30%灼烧4s（命中3人-30%）",
    damage: [{ type: DamageType.Magical, atkRatio: 1.7 }],
    effects: [{ type: StatusType.Burn, duration: 4, value: 0.05, chance: 0.3 }],
    aoe: { maxTargets: 3 },
  },
};

// ======================== 龙族 ========================

const hlyl: CharacterDef = {
  id: "hlyl",
  name: "火焰翼龙",
  race: Race.Dragon,
  stats: {
    hp: 5232,
    attack: 604.5,
    physicalDef: 154.6,
    magicalDef: 259.6,
    attackInterval: 2.4,
  },
  growth: { hp: 48, attack: 5.5, physicalDef: 1.4, magicalDef: 2.4 },
  talent: "每非龙-5%攻，每龙+5%攻（不含自身）+其他龙+2%攻",
  skill: {
    id: "hlyl_fire",
    name: "火焰喷吐",
    tags: [],
    cooldown: 8,
    castTime: 1,
    description: "前排最低血：每秒攻击×50%魔法，持续6s",
    damage: [{ type: DamageType.Magical, atkRatio: 0.5 }],
    aoe: { maxTargets: 1 },
  },
};

const bsxl: CharacterDef = {
  id: "bsxl",
  name: "冰霜邪龙",
  race: Race.Dragon,
  stats: {
    hp: 6064,
    attack: 493.5,
    physicalDef: 198.2,
    magicalDef: 325,
    attackInterval: 2.6,
  },
  growth: { hp: 56, attack: 4.5, physicalDef: 1.8, magicalDef: 3 },
  talent: "每非龙-5%攻防，每龙+5%防+其他龙+2%防",
  skill: {
    id: "bsxl_freeze",
    name: "冰霜吐息",
    tags: ["控制"],
    cooldown: 10,
    castTime: 1,
    description: "后排全部：降20%攻速+每秒攻击×80%魔法3s；每3次→冰冻",
    damage: [{ type: DamageType.Magical, atkRatio: 0.8 }],
    aoe: { maxTargets: 3 },
  },
};

const xyfl: CharacterDef = {
  id: "xyfl",
  name: "血翼飞龙",
  race: Race.Dragon,
  stats: {
    hp: 6402,
    attack: 659,
    physicalDef: 154.6,
    magicalDef: 301.2,
    attackInterval: 2.3,
  },
  growth: { hp: 58, attack: 6, physicalDef: 1.4, magicalDef: 2.8 },
  talent: "每非龙+4%异常时长，每龙-4%+其他龙-2%",
  skill: {
    id: "xyfl_chaos",
    name: "乱序打击",
    tags: ["控制"],
    cooldown: 9,
    castTime: 1,
    description: "随机2排全体：攻击×190%物理+60%打乱位置",
    damage: [{ type: DamageType.Physical, atkRatio: 1.9 }],
    aoe: { maxTargets: 6 },
  },
};

const hbfl: CharacterDef = {
  id: "hbfl",
  name: "寒冰飞龙",
  race: Race.Dragon,
  stats: {
    hp: 5054,
    attack: 547,
    physicalDef: 220,
    magicalDef: 199.2,
    attackInterval: 2.6,
  },
  growth: { hp: 46, attack: 5, physicalDef: 2, magicalDef: 1.8 },
  talent: "每非龙+4%冷却，每龙-4%+其他龙-2%",
  skill: {
    id: "hbfl_heal",
    name: "冰封治疗",
    tags: ["治疗"],
    cooldown: 12,
    castTime: 1,
    description: "冰封<50%HP龙族4s（免疫物理），每秒攻击×50%+最大HP×4%",
    heal: { atkRatio: 0.5, targetMaxHpRatio: 0.04 },
  },
};

const bjl: CharacterDef = {
  id: "bjl",
  name: "暴君龙",
  race: Race.Dragon,
  stats: {
    hp: 5976,
    attack: 678.8,
    physicalDef: 181.4,
    magicalDef: 254.7,
    attackInterval: 2.3,
  },
  growth: { hp: 54, attack: 6.2, physicalDef: 1.6, magicalDef: 2.3 },
  talent: "开场降全场非龙防御50%（Lv.100），每6s-15%至原本25%",
  skill: {
    id: "bjl_wing",
    name: "翅击",
    tags: ["切入"],
    cooldown: 9,
    castTime: 0,
    description: "中后排各1名：第1个180%物伤+30%降攻速4s，第2个230%物伤",
    damage: [
      { type: DamageType.Physical, atkRatio: 1.8 },
      { type: DamageType.Physical, atkRatio: 2.3 },
    ],
    aoe: { maxTargets: 2 },
    scriptId: "bjl_wing",
  },
};

// ======================== 导出 ========================

const zs: CharacterDef = {
  id: "zs",
  name: "宙斯",
  race: Race.Mage,
  stats: {
    hp: 5530,
    attack: 634.2,
    physicalDef: 194.2,
    magicalDef: 222,
    attackInterval: 3.2,
  },
  growth: { hp: 50, attack: 5.8, physicalDef: 1.8, magicalDef: 2 },
  talent: "普攻35%/技能50%附加目标当前HP×8%魔法伤害",
  skill: {
    id: "zs_storm",
    name: "神之怒雷",
    tags: [],
    cooldown: 11,
    castTime: 2,
    description: "全屏攻击×150-180%魔法",
    damage: [
      { type: DamageType.Magical, atkRatio: 1.65, targetCurrentHpRatio: 0.08 },
    ],
    aoe: { maxTargets: 9 },
    interruptOnDamage: true,
  },
};

const xjl: CharacterDef = {
  id: "xjl",
  name: "小精灵",
  race: Race.Mage,
  stats: {
    hp: 7730,
    attack: 490.5,
    physicalDef: 148.6,
    magicalDef: 173.4,
    attackInterval: 3.6,
  },
  growth: { hp: 70, attack: 4.5, physicalDef: 1.4, magicalDef: 1.6 },
  talent: "友方技能造成伤害时自身回1%HP（每3s最多6%）",
  skill: {
    id: "xjl_link",
    name: "链接",
    tags: [],
    cooldown: 11,
    castTime: 0,
    description: "链接1名友方8s：+30%技能增强+20%技能吸血，自身承担25%伤害",
    scriptId: "xjl_link",
  },
};

const swxz: CharacterDef = {
  id: "swxz",
  name: "死亡先知",
  race: Race.Undead,
  stats: {
    hp: 7134,
    attack: 547,
    physicalDef: 214,
    magicalDef: 259.6,
    attackInterval: 2.6,
  },
  growth: { hp: 66, attack: 5, physicalDef: 2, magicalDef: 2.4 },
  talent: "对诅咒敌人累积500伤害→2%减伤，最大40%（20层）",
  skill: {
    id: "swxz_drain",
    name: "吸魂巫术",
    tags: [],
    cooldown: 9,
    castTime: 0,
    description:
      "吸取随机单位5s：每秒攻击×10%+最大HP×3%魔法，自身吸血20%。优先前排。被目标攻击中断。结束后诅咒4s",
    scriptId: "swxz_drain",
    priority: [
      { row: Row.Front, chance: 70 },
      { row: Row.Mid, chance: 15 },
      { row: Row.Back, chance: 15 },
    ],
  },
};

const xcl: CharacterDef = {
  id: "xcl",
  name: "星辰龙",
  race: Race.Dragon,
  stats: {
    hp: 5698,
    attack: 634.2,
    physicalDef: 174.4,
    magicalDef: 247.7,
    attackInterval: 2.3,
  },
  growth: { hp: 52, attack: 5.8, physicalDef: 1.6, magicalDef: 2.3 },
  talent: "首个非龙角色发动技能→使其技能冷却翻倍（全局仅1次）",
  skill: {
    id: "xcl_star",
    name: "星辰冲击",
    tags: ["控制"],
    cooldown: 10,
    castTime: 2,
    description: "2×2随机格子：攻击×180%魔法+20%沉默/20%缴械3s",
    damage: [{ type: DamageType.Magical, atkRatio: 1.8 }],
    aoe: { maxTargets: 4 },
    effects: [
      { type: StatusType.Silence, duration: 3 },
      { type: StatusType.Disarm, duration: 3 },
    ],
  },
};

const dl: CharacterDef = {
  id: "dl",
  name: "地龙",
  race: Race.Dragon,
  stats: {
    hp: 5451,
    attack: 631.3,
    physicalDef: 225,
    magicalDef: 213.1,
    attackInterval: 2.1,
  },
  growth: { hp: 49, attack: 5.7, physicalDef: 2, magicalDef: 1.9 },
  talent: "攻击者受自身攻击×20%纯粹伤害",
  skill: {
    id: "dl_stomp",
    name: "龙踏",
    tags: ["控制"],
    cooldown: 10,
    castTime: 2,
    description: "全屏攻击×150%物理（前排140%/中排110%/后排80%）+降命中20%5s",
    damage: [{ type: DamageType.Physical, atkRatio: 1.5 }],
    aoe: { maxTargets: 9 },
    scriptId: "dl_stomp",
  },
};

const lyz: CharacterDef = {
  id: "lyz",
  name: "龙吟者",
  race: Race.Dragon,
  stats: {
    hp: 5848,
    attack: 535,
    physicalDef: 218,
    magicalDef: 232,
    attackInterval: 5,
  },
  growth: { hp: 52, attack: 5, physicalDef: 2, magicalDef: 2.1 },
  talent: "只能放前排。每龙+5%攻，每非龙-4%攻。离开前排每秒-3%HP",
  skill: {
    id: "lyz_heal",
    name: "龙吟治愈",
    tags: ["治疗"],
    cooldown: 11,
    castTime: 2,
    description:
      "最低HP龙族：每秒攻击×40%+20%减伤4s；4次后升级双目标70%+30%减伤；龙族阵亡时随机复活1只5s",
    heal: { atkRatio: 0.4 },
    scriptId: "lyz_heal",
  },
};

const xjlr: CharacterDef = {
  id: "xjlr",
  name: "陷阱猎人",
  race: Race.Hunter,
  stats: {
    hp: 5005,
    attack: 654,
    physicalDef: 173.4,
    magicalDef: 131.8,
    attackInterval: 2.8,
  },
  growth: { hp: 45, attack: 6, physicalDef: 1.6, magicalDef: 1.2 },
  talent:
    "开局放2个陷阱：格子上的敌人无法使用移动/切入，每3s受最大HP×5%伤害。阵亡清空",
  skill: {
    id: "xjlr_trap",
    name: "超级陷阱",
    tags: ["控制"],
    cooldown: 8,
    castTime: 0,
    description:
      "放1个超级陷阱：无法移动/切入，每2s攻击×80%+最大HP×2%纯粹，持续20s",
    scriptId: "xjlr_trap",
  },
};

const xblr: CharacterDef = {
  id: "xblr",
  name: "西部猎人",
  race: Race.Hunter,
  stats: {
    hp: 4678,
    attack: 636,
    physicalDef: 194.2,
    magicalDef: 172.4,
    attackInterval: 2.6,
  },
  growth: { hp: 42, attack: 6, physicalDef: 1.8, magicalDef: 1.6 },
  talent: "其他猎人反击时自身也攻击1次，暴击率+40%",
  skill: {
    id: "xblr_shot",
    name: "跳跃射击",
    tags: ["移动"],
    cooldown: 10,
    castTime: 0,
    description: "跳至空位→1-3名敌人各3发：80%/90%/120%+第3发必暴击",
    damage: [{ type: DamageType.Physical, atkRatio: 0.97 }],
    aoe: { maxTargets: 3 },
    scriptId: "xblr_shot",
  },
};

const ldshz: CharacterDef = {
  id: "ldshz",
  name: "林地守护者",
  race: Race.Hunter,
  stats: {
    hp: 6342,
    attack: 540,
    physicalDef: 245.8,
    magicalDef: 218,
    attackInterval: 2.4,
  },
  growth: { hp: 58, attack: 5, physicalDef: 2.2, magicalDef: 2 },
  talent: "受技能伤害45%概率获得护盾(攻击×500%)4s，期间格挡100%",
  skill: {
    id: "ldshz_buff",
    name: "自然守护",
    tags: ["增益"],
    cooldown: 12,
    castTime: 0,
    description: "全队+20%双防+同排后排友方+20%暴击+30%吸血6s",
    scriptId: "ldshz_buff",
  },
};

const jdds: CharacterDef = {
  id: "jdds",
  name: "决斗大师",
  race: Race.Warrior,
  stats: {
    hp: 6244,
    attack: 812.5,
    physicalDef: 214,
    magicalDef: 132.8,
    attackInterval: 3,
  },
  growth: { hp: 56, attack: 7.5, physicalDef: 2, magicalDef: 1.2 },
  talent: "击杀敌人受150%攻击反冲+永久+7%攻击+3%防御",
  skill: {
    id: "jdds_steal",
    name: "战力夺舍",
    tags: [],
    cooldown: 6,
    castTime: 0,
    description: "夺取敌方攻最高角色20%攻击力5s",
    scriptId: "jdds_steal",
  },
};

// ===== v1.6.4 数值调整 =====

const wlgyz: CharacterDef = {
  id: "wlgyz",
  name: "亡灵歌咏者",
  race: Race.Undead,
  stats: {
    hp: 3845,
    attack: 426,
    physicalDef: 164.5,
    magicalDef: 262.6,
    attackInterval: 2.9,
  },
  growth: { hp: 35, attack: 4, physicalDef: 1.5, magicalDef: 2.4 },
  talent: "诅咒敌人每秒受目标攻击×1%+20纯粹",
  skill: {
    id: "wlgyz_heal",
    name: "死亡颂歌",
    tags: ["治疗", "减益"],
    cooldown: 11,
    castTime: 2,
    description: "恢复随机2名友方攻击×190%生命+诅咒随机1名敌方3s",
    heal: { atkRatio: 1.9 },
    aoe: { maxTargets: 2 },
    effects: [{ type: StatusType.Curse, duration: 3 }],
    interruptOnAttack: true,
  },
};

const mrsz: CharacterDef = {
  id: "mrsz",
  name: "末日使者",
  race: Race.Undead,
  stats: {
    hp: 5014,
    attack: 711.4,
    physicalDef: 161.5,
    magicalDef: 205.1,
    attackInterval: 2.7,
  },
  growth: { hp: 42, attack: 6.6, physicalDef: 1.5, magicalDef: 1.9 },
  talent: "攻击异常敌人+10%吸血，复活后+100%",
  skill: {
    id: "mrsz_doom",
    name: "末日",
    tags: ["控制"],
    cooldown: 13,
    castTime: 0,
    description:
      "消耗20%HP→锁定近10s伤害最高目标：减疗50%+每秒13%atk纯粹+沉默+破坏，7s（HP<20%不可用）",
    scriptId: "mrsz_doom",
  },
};

const hyz: CharacterDef = {
  id: "hyz",
  name: "魂之引渡者",
  race: Race.Undead,
  stats: {
    hp: 4112,
    attack: 495.4,
    physicalDef: 134.8,
    magicalDef: 221,
    attackInterval: 2.8,
  },
  growth: { hp: 38, attack: 4.6, physicalDef: 1.2, magicalDef: 2 },
  talent: "每5s/施加负面→+1魂能(5层)，每层+2%攻+亡灵+6%攻速",
  skill: {
    id: "hyz_shield",
    name: "魂能护盾",
    tags: ["移动"],
    cooldown: 12,
    castTime: 0,
    description:
      "消耗全部魂能→瞬移最低HP亡灵旁+护盾(攻击×80%×层数)+驱散周围1格",
    effects: [{ type: StatusType.Shield, duration: 7 }],
  },
};

const aysl: CharacterDef = {
  id: "aysl",
  name: "暗影噬龙",
  race: Race.Dragon,
  stats: {
    hp: 5272,
    attack: 673.8,
    physicalDef: 132.8,
    magicalDef: 227.9,
    attackInterval: 2.2,
  },
  growth: { hp: 48, attack: 6.2, physicalDef: 1.2, magicalDef: 2.1 },
  talent: "对<60%HP敌人附加已损失HP×6%纯粹(≤自身攻击×100%)+禁疗4s",
  skill: {
    id: "aysl_strike",
    name: "暗影突袭",
    tags: ["切入"],
    cooldown: 10,
    castTime: 2,
    description:
      "蓄力2s→瞬移后排最低血目标：攻击×230%物理+暗影标记(受伤害+25%)4s；标记目标死亡→自回20%HP+全龙-20%CD",
    scriptId: "aysl_strike",
  },
};

export const ALL_CHARACTERS: CharacterDef[] = [
  pp,
  hl,
  yl,
  hx,
  zzx,
  dxm,
  lbmx,
  ds,
  mmx,
  sszs,
  bslr,
  hqs,
  mds,
  zfyx,
  lxgz,
  xjlr,
  xblr,
  ldshz,
  crzs,
  hd,
  fxz,
  fdzs,
  kzs,
  slzs,
  zqz,
  jdds,
  xdds,
  sjsn,
  bmxz,
  srm,
  ynfs,
  syz,
  zs,
  xjl,
  wqqs,
  wlgyz,
  kldd,
  yammxz,
  dyq,
  hyz,
  mrsz,
  swxz,
  hlyl,
  bsxl,
  xyfl,
  hbfl,
  bjl,
  lyz,
  xcl,
  dl,
  aysl,
];

export const CHARACTER_MAP = buildCharacterMap();

function buildCharacterMap(): Map<string, CharacterDef> {
  let overrides: Record<string, any> = {};
  try {
    const raw = localStorage.getItem("g3_custom_data");
    if (raw) overrides = JSON.parse(raw);
  } catch {}
  return new Map(
    ALL_CHARACTERS.map((c) => {
      const ov = overrides[c.id];
      if (!ov) return [c.id, c];
      return [
        c.id,
        {
          ...c,
          stats: { ...c.stats, ...ov.stats },
          growth: { ...c.growth, ...ov.growth },
          talent: ov.talent ?? c.talent,
          skill: ov.skill ? { ...c.skill, ...ov.skill } : c.skill,
        },
      ];
    })
  );
}

/** Rebuild CHARACTER_MAP after custom data changes */
export function refreshCharacterMap() {
  const newMap = buildCharacterMap();
  CHARACTER_MAP.clear();
  for (const [k, v] of newMap) CHARACTER_MAP.set(k, v);
}
