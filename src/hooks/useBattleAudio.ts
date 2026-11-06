import { useEffect, useRef } from "react";
import { BattleState } from "../types";
import { sound, SoundKind } from "../audio/SoundEngine";

/**
 * 把战斗日志增量映射成音效事件。
 * 只扫描新增的日志条目（cursor），并按技能标签区分攻击 / 治疗 / 增益 / 控制；
 * 同类音效的密集触发由 SoundEngine 内部限流兜底。
 */
export function useBattleAudio(state: BattleState | null): void {
  const cursor = useRef(0);
  const lastTime = useRef(0);
  const finishedPlayed = useRef(false);

  useEffect(() => {
    if (!state) {
      cursor.current = 0;
      lastTime.current = 0;
      finishedPlayed.current = false;
      return;
    }

    // 时间回退 = 重开一场战斗，重置游标
    if (state.time < lastTime.current) {
      cursor.current = 0;
      finishedPlayed.current = false;
    }
    lastTime.current = state.time;

    const logs = state.battleLog || [];
    if (cursor.current > logs.length) cursor.current = 0;

    for (let i = cursor.current; i < logs.length; i++) {
      const e = logs[i];
      switch (e.type) {
        case "skill": {
          const caster = state.units.find((u) => u.id === e.sourceId);
          const skill = caster?.def?.skill;
          const tags = skill?.tags || [];
          let kind: SoundKind = "skill";
          if (skill?.heal || tags.includes("治疗")) kind = "heal";
          else if (tags.includes("增益")) kind = "buff";
          else if (tags.includes("控制")) kind = "control";
          sound.play(kind);
          break;
        }
        case "damage":
          sound.play(/💥|暴击/.test(e.text) ? "crit" : "hit");
          break;
        case "heal":
          sound.play("heal");
          break;
        case "death":
          sound.play("death");
          break;
        default:
          break;
      }
    }
    cursor.current = logs.length;

    if (state.phase === "finished" && !finishedPlayed.current) {
      finishedPlayed.current = true;
      // v3.3: 超时是平局而不是失败，不播放失败音效
      if (state.winner === "ally") sound.play("victory");
      else if (state.winner === "enemy") sound.play("defeat");
    }
  }, [state]);
}
