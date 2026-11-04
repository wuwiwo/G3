import { useState, useCallback, useEffect } from 'react';
import { CharacterDef, CharacterStats, Skill, Race } from '../types';
import { BondEffect } from '../data/races';

const STORAGE_KEY = 'g3_custom_data';

export interface CustomOverride {
  stats?: Partial<CharacterStats>;
  growth?: Partial<CharacterDef['growth']>;
  skill?: Partial<Skill>;
  talent?: string;
}

export type CustomDataStore = Record<string, CustomOverride>;

function loadStore(): CustomDataStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveStore(store: CustomDataStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useCustomData() {
  const [store, setStore] = useState<CustomDataStore>(loadStore);

  useEffect(() => {
    const handler = () => setStore(loadStore());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const getOverride = useCallback((charId: string): CustomOverride | null => {
    return store[charId] || null;
  }, [store]);

  const setOverride = useCallback((charId: string, override: CustomOverride) => {
    const next = { ...store, [charId]: override };
    setStore(next);
    saveStore(next);
  }, [store]);

  const removeOverride = useCallback((charId: string) => {
    const next = { ...store };
    delete next[charId];
    setStore(next);
    saveStore(next);
  }, [store]);

  const resetAll = useCallback(() => {
    setStore({});
    saveStore({});
  }, []);

  const getBondOverrides = useCallback((): Record<string, Partial<BondEffect>> => {
    return (store as any)._bonds || {};
  }, [store]);

  const setBondOverrides = useCallback((overrides: Record<string, Partial<BondEffect>>) => {
    const next = { ...store, _bonds: overrides };
    setStore(next);
    saveStore(next);
  }, [store]);

  const updateBond = useCallback((race: string, patch: Partial<BondEffect>) => {
    const bonds = { ...(store as any)._bonds || {} };
    bonds[race] = { ...bonds[race], ...patch };
    const next = { ...store, _bonds: bonds };
    setStore(next);
    saveStore(next);
  }, [store]);

  const resetBond = useCallback((race: string) => {
    const bonds = { ...(store as any)._bonds || {} };
    delete bonds[race];
    const next = { ...store, _bonds: bonds };
    setStore(next);
    saveStore(next);
  }, [store]);

  return { store, getOverride, setOverride, removeOverride, resetAll,
    getBondOverrides, setBondOverrides, updateBond, resetBond };
}

/** Merge custom override on top of a base CharacterDef */
export function mergeOverride(base: CharacterDef, override: CustomOverride | null): CharacterDef {
  if (!override) return base;
  return {
    ...base,
    stats: { ...base.stats, ...override.stats },
    growth: { ...base.growth, ...override.growth },
    talent: override.talent ?? base.talent,
    skill: override.skill ? { ...base.skill, ...override.skill } : base.skill,
  };
}
