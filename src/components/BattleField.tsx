import React, { useMemo } from 'react';
import { BattleState, Row, ROW_NAMES, ArenaUnit } from '../types';
import UnitSprite from './UnitSprite';

interface Props {
  battle: BattleState;
  side: 'ally' | 'enemy';
  onUnitClick?: (unit: ArenaUnit) => void;
}

const bondRC: Record<string,string> = {beast:'#8d6e63',hunter:'#4caf50',warrior:'#f44336',mage:'#2196f3',undead:'#9c27b0',dragon:'#ff9800'};
const bondNM: Record<string,string> = {beast:'兽',hunter:'猎',warrior:'战',mage:'法',undead:'亡',dragon:'龙'};

const BattleField: React.FC<Props> = ({ battle, side, onUnitClick }) => {
  // Build fixed 3x3 grid from unit positions
  const grid = useMemo(() => {
    const g: (ArenaUnit | null)[][] = [[null,null,null],[null,null,null],[null,null,null]];
    for (const u of battle.units) {
      if (u.team === side && u.row >= 0 && u.row <= 2 && u.col >= 0 && u.col <= 2) {
        g[u.row][u.col] = u;
      }
    }
    return g;
  }, [battle.units, side]);

  const isFinished = battle.phase === 'finished';
  const won = battle.winner === side;
  const bonds = battle.bonds?.[side] || [];

  // Enemy rows are reversed for mirror layout
  const rowOrder = side === 'ally' ? [Row.Front, Row.Mid, Row.Back] : [Row.Back, Row.Mid, Row.Front];

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: 6,
      background: side === 'ally'
        ? 'linear-gradient(180deg, #1a237e66, #0d47a133)'
        : 'linear-gradient(180deg, #b71c1c66, #880e4f33)',
      borderRadius: 10,
      border: isFinished ? `4px solid ${won ? '#4caf50' : '#f44336'}` : '4px solid transparent',
      position: 'relative',
    }}>
      {/* Result overlay */}
      {isFinished && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 28, fontWeight: 900, zIndex: 10,
          color: won ? '#4caf50' : '#f44336',
          textShadow: '0 2px 12px rgba(0,0,0,0.9)',
          background: 'rgba(0,0,0,0.7)', padding: '4px 20px', borderRadius: 8,
        }}>
          {won ? '胜利' : '败北'}
        </div>
      )}

      {/* Team label */}
      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#ccc' }}>
        {side === 'ally' ? '我方' : '敌方'}
      </div>

      {/* Active bonds — read from engine, not computed in UI */}
      {bonds.length > 0 && (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
          {bonds.map((b: any) => (
            <span key={b.race} style={{
              fontSize: 8, padding: '1px 5px', borderRadius: 3,
              background: bondRC[b.race] || '#555', color: '#000', fontWeight: 700,
            }}>
              {bondNM[b.race] || b.race}×{b.count}🌟
            </span>
          ))}
        </div>
      )}

      {/* 3x3 Grid — fixed positions by (row, col) */}
      {rowOrder.map(row => (
        <div key={row} style={{ display: 'flex', gap: 3, alignItems: 'center', minHeight: 76 }}>
          <div style={{ width: 26, fontSize: 10, color: '#666', fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>
            {ROW_NAMES[row]}
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 3 }}>
            {[0,1,2].map(col => {
              const unit = grid[row][col];
              return unit ? (
                <UnitSprite key={unit.id} unit={unit} onClick={() => onUnitClick?.(unit)} />
              ) : (
                <div key={`e-${row}-${col}`} style={{
                  height: 74, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#333',
                  border: '1px dashed #2a2a3e',
                }}>
                  空
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BattleField;
