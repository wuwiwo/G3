import { useState, useEffect, useCallback } from 'react';

export interface SavedTeam {
  id: string;
  name: string;
  units: { charId: string; row: number; col: number }[];
  createdAt: number;
}

const STORAGE_KEY = 'slg_saved_teams';
const MAX_TEAMS = 30;

function genId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
}

export function useSavedTeams() {
  const [teams, setTeams] = useState<SavedTeam[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return raw.map((t: any) => ({
        id: t.id || genId(),
        name: t.name || '未命名',
        units: t.units || [],
        createdAt: t.createdAt || Date.now(),
      })).slice(-MAX_TEAMS);
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
  }, [teams]);

  const saveTeam = useCallback((name: string, units: { charId: string; row: number; col: number }[]) => {
    const id = genId();
    const team: SavedTeam = { id, name, units: units.map(u => ({ ...u })), createdAt: Date.now() };
    setTeams(prev => {
      // Remove oldest duplicates (same name)
      const filtered = prev.filter(t => t.name !== name);
      return [...filtered, team].slice(-MAX_TEAMS);
    });
    return team;
  }, []);

  const deleteTeam = useCallback((id: string) => {
    setTeams(prev => prev.filter(t => t.id !== id));
  }, []);

  return { teams, saveTeam, deleteTeam };
}
