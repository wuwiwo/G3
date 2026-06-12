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

  const startBattle = useCallback((allyTeam: any[], enemyTeam: any[]) => {
    const battle = initBattle(allyTeam, enemyTeam) as unknown as BattleState;
    stateRef.current = battle;
    setState(battle);
    setRunning(true);
    lastTime.current = performance.now();
    accumulatorRef.current = 0;
  }, []);

  useEffect(() => {
    if (!running) return;

    const tick = () => {
      const now = performance.now();
      const elapsed = (now - lastTime.current) / 1000;
      lastTime.current = now;
      accumulatorRef.current += elapsed * speedRef.current;

      let changed = false;
      if (stateRef.current && stateRef.current.phase === 'fighting') {
        while (accumulatorRef.current >= 0.1) {
          stateRef.current = processTick(stateRef.current);
          accumulatorRef.current -= 0.1;
          changed = true;
          if (stateRef.current.phase !== 'fighting') break;
        }
        if (changed) {
          setState({ ...stateRef.current });
        }
      } else {
        setRunning(false);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setState(null);
    stateRef.current = null;
  }, []);

  return { state, running, startBattle, reset, speed: speedRef };
}
