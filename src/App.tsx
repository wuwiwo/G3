import React, { useState } from 'react';
import { TeamSetup } from './components/TeamSetup';
import BattleField from './components/BattleField';
import { BattleLog } from './components/BattleLog';
import StatsPanel from './components/StatsPanel';
import UnitDetail from './components/UnitDetail';
import { useBattle } from './hooks/useBattleState';
import { ArenaUnit } from './types';
import { generateEnemyTeam } from './engine/battle';
import { ALL_CHARACTERS } from './data/characters';

const App: React.FC = () => {
  const { state, startBattle, reset, speed } = useBattle();
  const [page, setPage] = useState<'setup' | 'battle'>('setup');
  const [selectedUnit, setSelectedUnit] = useState<ArenaUnit | null>(null);
  const [allyTeam, setAllyTeam] = useState<{ charId: string; row: number; col: number }[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<{ charId: string; row: number; col: number }[]>([]);
  const [showExtra, setShowExtra] = useState(false);

  const handleStart = (ally: { charId: string; row: number; col: number }[], enemy: { charId: string; row: number; col: number }[]) => {
    setAllyTeam(ally);
    setEnemyTeam(enemy);
    startBattle(ally, enemy);
    setPage('battle');
  };

  const handleRematch = () => {
    if (allyTeam.length > 0 && enemyTeam.length > 0) {
      startBattle(allyTeam, enemyTeam);
    }
    setSelectedUnit(null);
  };

  if (page === 'setup') {
    return (
      <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#fff' }}>
        <TeamSetup onStart={handleStart} />
      </div>
    );
  }

  if (!state) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', color: '#fff' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 12px', background: '#111', borderBottom: '1px solid #222',
      }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>战斗</span>
          <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
            {state.phase === 'fighting' ? '⚔️' : '🏁'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { speed.current = speed.current === 1 ? 2 : speed.current === 2 ? 4 : 1; }}
            style={btnStyle('#555')}>
            ⏱ {speed.current}x
          </button>
          <button onClick={() => setShowExtra(!showExtra)} style={btnStyle('#555')}>
            📊 统计
          </button>
          <button onClick={handleRematch} disabled={state.phase !== 'finished'}
            style={btnStyle(state.phase === 'finished' ? '#2196f3' : '#333')}>
            🔄 再来
          </button>
          <button onClick={() => { reset(); setPage('setup'); }} style={btnStyle('#4caf50')}>
            ⚙️ 配置
          </button>
        </div>
      </div>

      {/* Battlefield - always visible, compact */}
      <div style={{ padding: 6 }}>
        <BattleField battle={state} side="ally" onUnitClick={setSelectedUnit} />
        <div style={{ textAlign: 'center', fontSize: 16, color: '#444', padding: '2px 0' }}>⚔</div>
        <BattleField battle={state} side="enemy" onUnitClick={setSelectedUnit} />
      </div>

      {/* Team status */}
      <div style={{
        padding: '4px 10px', fontSize: 11, color: '#666', textAlign: 'center',
        whiteSpace: 'nowrap', overflow: 'auto',
      }}>
        <span style={{ color: '#4fc3f7' }}>我方</span> 存活
        {state.units.filter(u => u.team === 'ally' && !u.isDead).length}/
        {state.units.filter(u => u.team === 'ally').length}
        <span style={{ margin: '0 8px', color: '#444' }}>|</span>
        <span style={{ color: '#ef5350' }}>敌方</span> 存活
        {state.units.filter(u => u.team === 'enemy' && !u.isDead).length}/
        {state.units.filter(u => u.team === 'enemy').length}
      </div>

      {/* Collapsible stats + log */}
      {showExtra && state.stats && (
        <div style={{ padding: '0 6px 20px' }}>
          <StatsPanel stats={state.stats} />
          <div style={{ height: 6 }} />
          <BattleLog entries={state.battleLog} />
        </div>
      )}

      {selectedUnit && <UnitDetail unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
    </div>
  );
};

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '6px 10px', fontSize: 11, fontWeight: 600,
    background: bg, color: '#fff', border: 'none',
    borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}

export default App;
