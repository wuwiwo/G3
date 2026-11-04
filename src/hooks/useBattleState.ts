import { useState, useRef, useCallback, useEffect } from 'react';
import { BattleState } from '../types';
import { initBattle, processTick } from '../engine/battle';

export function useBattle() {
  const [state, setState] = useState<BattleState | null>(null);
  const [running, setRunning] = useState(false);
  const stateRef = useRef<BattleState | null>(null);
  const animRef = useRef<number | null>(null);
  const lastTime = useRef(0);
  const accumulatorRef = useRef(0);
  const speedRef = useRef(1);
  // v3: 技能暂停聚焦（剑与远征风格）——默认开启
  const [pauseOnSkill, setPauseOnSkillState] = useState(
    () => localStorage.getItem("g3-pause-skill") !== "false"
  );
  const pauseOnSkillRef = useRef(false); // 修复: tick 闭包用 ref（避免捕获旧 state）
  const setPauseOnSkill = useCallback((v: boolean) => {
    pauseOnSkillRef.current = v;
    localStorage.setItem("g3-pause-skill", String(v));
    setPauseOnSkillState(v);
  }, []);
  const pauseUntilRef = useRef(0);
  const lastSkillLogTimeRef = useRef(-1);
  // v3: 手动暂停（战斗播放/暂停）
  const [manualPaused, setManualPaused] = useState(false);
  const manualPausedRef = useRef(false);
  // v3: 聚焦覆盖层状态（暂停期间显示技能名大字）
  const [skillPauseActive, setSkillPauseActive] = useState(false);
  const [pausedSkillName, setPausedSkillName] = useState("");
  const [pausedSkillCasterId, setPausedSkillCasterId] = useState<string | null>(null);
  const [pausedSkillType, setPausedSkillType] = useState("attack");
  const [pausedSkillTargetId, setPausedSkillTargetId] = useState<string | null>(null);
  const [pausedSkillLine, setPausedSkillLine] = useState("");

  const startBattle = useCallback((allyTeam: any[], enemyTeam: any[]) => {
    const battle = initBattle(allyTeam, enemyTeam) as unknown as BattleState;
    stateRef.current = battle;
    setState(battle);
    setRunning(true);
    lastTime.current = performance.now();
    accumulatorRef.current = 0;
    // v3修复: 跨战斗重置技能暂停状态（否则旧战斗的 time 基准导致永不触发）
    lastSkillLogTimeRef.current = -1;
    pauseUntilRef.current = 0;
  }, []);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const now = performance.now();

      // v3: 技能暂停——暂停期间直接跳过推进（lastTime 每帧更新，避免恢复后追赶）
      // v3: 手动暂停（优先级最高）
      if (manualPausedRef.current && stateRef.current?.phase === "fighting") {
        lastTime.current = now;
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      if (
        pauseOnSkill &&
        now < pauseUntilRef.current &&
        stateRef.current?.phase === "fighting"
      ) {
        lastTime.current = now;
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      if (pauseOnSkill && now >= pauseUntilRef.current && pauseUntilRef.current > 0) {
        pauseUntilRef.current = 0;
        setSkillPauseActive(false);
        setPausedSkillName("");
        setPausedSkillCasterId(null);
        setPausedSkillTargetId(null);
        setPausedSkillLine("");
      }
      const elapsed = (now - lastTime.current) / 1000;
      lastTime.current = now;
      accumulatorRef.current += elapsed * speedRef.current;

      let changed = false;
      if (stateRef.current && stateRef.current.phase === 'fighting') {
        // v3: 检测新技能事件 → 设置暂停窗口
        if (pauseOnSkill) {
          const logs = stateRef.current.battleLog || [];
          // 从尾部扫描最新 skill 日志（释放日志可能被后续伤害日志覆盖）
          let lastLog = null;
          for (let i = logs.length - 1; i >= Math.max(0, logs.length - 20); i--) {
            if (logs[i].type === "skill") {
              lastLog = logs[i];
              break;
            }
          }
          if (
            lastLog &&
            lastLog.time > lastSkillLogTimeRef.current
          ) {
            lastSkillLogTimeRef.current = lastLog.time;
            pauseUntilRef.current = performance.now() + 2000; // v3: 2s 更明显
            // 提取技能名（"XX 释放【技能名】"）
            const m = lastLog.text.match(/释放【(.+?)】/);
            setPausedSkillName(m ? m[1] : "技能");
            setPausedSkillCasterId((lastLog as any).sourceId || null);
            // 技能类型（攻击/治疗/buff/控制）——用于高亮区分
            const caster = stateRef.current.units.find((u: any) => u.id === lastLog.sourceId);
            const sk = caster?.def?.skill;
            let st = "attack";
            if (sk?.heal || sk?.tags?.includes("治疗")) st = "heal";
            else if (sk?.tags?.includes("增益")) st = "buff";
            else if (sk?.tags?.includes("控制")) st = "control";
            setPausedSkillType(st);
            // 目标按类型（攻击=lastHitTarget / 治疗=lastHealTarget / 增益=自身）
            const targetId =
              st === "heal"
                ? (caster as any)?.lastHealTarget || null
                : st === "buff"
                  ? null
                  : (caster as any)?.lastHitTarget || null;
            setPausedSkillTargetId(targetId);
            setPausedSkillLine((caster as any)?.lastLine || "");
            setSkillPauseActive(true);
            // 本帧立即暂停（防止技能后继续推进）
            lastTime.current = now;
            animRef.current = requestAnimationFrame(tick);
            return;
          }
        }
        while (accumulatorRef.current >= 0.1) {
          const cur = stateRef.current!;
          stateRef.current = processTick(cur);
          accumulatorRef.current -= 0.1;
          changed = true;
          if (stateRef.current!.phase !== 'fighting') break;
        }
        if (changed) {
          setState({ ...stateRef.current! } as BattleState);
        }
      } else {
        setRunning(false);
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [running, pauseOnSkill]);

  const reset = useCallback(() => {
    setRunning(false); setState(null); stateRef.current = null;
  }, []);

  const togglePause = useCallback(() => {
    manualPausedRef.current = !manualPausedRef.current;
    setManualPaused(manualPausedRef.current);
  }, []);
  return { state, running, startBattle, reset, speed: speedRef, pauseOnSkill, setPauseOnSkill, skillPauseActive, pausedSkillName, pausedSkillCasterId, pausedSkillType, pausedSkillTargetId, pausedSkillLine, manualPaused, togglePause };
}
