'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { getOrganizationContextTree } from '../../application/organization/cadence-service';
import { reconcileActiveContext } from '../../domain/organization/context';

type Tree = Awaited<ReturnType<typeof getOrganizationContextTree>>['trains'];
type Selection = { trainId?: string; teamId?: string; piId?: string };
const storageKey = 'azusa:active-context:v1';

function readSelection(): Selection {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return {
      trainId: typeof stored?.trainId === 'string' ? stored.trainId : undefined,
      teamId: typeof stored?.teamId === 'string' ? stored.teamId : undefined,
      piId: typeof stored?.piId === 'string' ? stored.piId : undefined,
    };
  } catch {
    return {};
  }
}

function useOrganizationState() {
  const [trains, setTrains] = useState<Tree>([]);
  const [stored, setStored] = useState<Selection>({});
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/organization/context', {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) return;
      const { trains } = (await response.json()) as { trains: Tree };
      if (!controller.signal.aborted && Array.isArray(trains)) {
        setTrains(trains);
        setLoaded(true);
      }
    } catch {
      // Keep the current selection when context is unavailable.
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setStored(readSelection());
    void refresh();
    return () => request.current?.abort();
  }, [refresh]);

  const match = reconcileActiveContext(trains, stored);
  const selected = {
    train: match.train,
    team: match.train?.teams.find((team) => team.id === match.team?.id) ?? null,
    pi: match.train?.pis.find((pi) => pi.id === match.pi?.id) ?? null,
  };
  const trainId = selected.train?.id;
  const teamId = selected.team?.id;
  const piId = selected.pi?.id;
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ trainId, teamId, piId }),
      );
    } catch {}
  }, [loaded, trainId, teamId, piId]);

  function setTeamId(id: string) {
    const train = trains.find((train) =>
      train.teams.some((team) => team.id === id),
    );
    if (!train) return;
    setStored({
      trainId: train.id,
      teamId: id,
      piId: train.id === trainId ? piId : undefined,
    });
  }

  function setPiId(id: string) {
    if (!selected.train?.pis.some((pi) => pi.id === id)) return;
    setStored({ trainId, teamId, piId: id });
  }

  return { trains, selected, setTeamId, setPiId, refresh, loading };
}

const OrganizationContext = createContext<ReturnType<
  typeof useOrganizationState
> | null>(null);

export function OrganizationContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <OrganizationContext.Provider value={useOrganizationState()}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('OrganizationContextProvider is required.');
  return context;
}
