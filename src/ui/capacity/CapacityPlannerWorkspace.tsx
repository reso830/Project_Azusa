'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CapacityViewQuerySchema } from '../../domain/capacity/schemas';
import type { TeamPiCapacityView } from '../../domain/capacity/types';
import { useOrganizationContext } from '../shell/OrganizationContext';
import { CapacityKpiStrip } from './CapacityKpiStrip';
import { MemberCapacityTable } from './MemberCapacityTable';
import { TeamAllocationMatrix } from './TeamAllocationMatrix';
import styles from './capacity.module.css';

type LoadResult =
  | { key: string; revision: number; view: TeamPiCapacityView }
  | { key: string; revision: number; error: string };
export type CapacityMutation = (
  path: string,
  method: 'PATCH' | 'PUT' | 'POST' | 'DELETE',
  body?: object,
) => Promise<boolean>;
export type CapacityEditor = 'workday' | 'velocity';

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null);
  return typeof payload?.error?.message === 'string'
    ? payload.error.message
    : 'Capacity could not be loaded or saved.';
}

export function CapacityPlannerWorkspace() {
  const router = useRouter();
  const search = useSearchParams();
  const { selected, loading, unavailable, refresh, setSelection } =
    useOrganizationContext();
  const [result, setResult] = useState<LoadResult>();
  const [revision, setRevision] = useState(0);
  const [dismissed, setDismissed] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [expanded, setExpanded] = useState<{ key: string; column: string }>();
  const [saveError, setSaveError] = useState<{
    key: string;
    message: string;
  }>();
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<{ key: string; kind: CapacityEditor }>();
  const pending = useRef(false);
  const entry = useRef<{ query: string; header: string }>(undefined);
  const raw = search.toString();
  const linked =
    raw !== dismissed && (search.has('teamId') || search.has('piId'));
  const parsed = CapacityViewQuerySchema.safeParse({
    teamId: search.get('teamId'),
    piId: search.get('piId'),
  });
  const linkValid =
    parsed.success &&
    search.getAll('teamId').length === 1 &&
    search.getAll('piId').length === 1;
  const linkedTeam = linked && linkValid ? parsed.data.teamId : undefined;
  const linkedPi = linked && linkValid ? parsed.data.piId : undefined;
  const teamId = linkedTeam ?? selected.team?.id;
  const piId = linkedPi ?? selected.pi?.id;
  const header = `${selected.team?.id ?? ''}/${selected.pi?.id ?? ''}`;
  const key = teamId && piId ? `${teamId}/${piId}` : '';
  const current = result?.key === key ? result : undefined;
  const view = current && 'view' in current ? current.view : undefined;
  const error = current && 'error' in current ? current.error : undefined;

  useEffect(() => {
    if (!linked) {
      entry.current = undefined;
      if (!raw && dismissed) setDismissed('');
      return;
    }
    if (loading) return;
    const clear = (notice: boolean) => {
      setDismissed(raw);
      if (notice) setInvalid(true);
      router.replace('/capacity');
    };
    if (!linkedTeam || !linkedPi) return clear(true);
    if (entry.current?.query !== raw) entry.current = { query: raw, header };
    if (entry.current.header !== header) return clear(false);
    if (
      view &&
      !view.readOnly &&
      setSelection({ teamId: linkedTeam, piId: linkedPi })
    )
      clear(false);
  }, [
    dismissed,
    header,
    linked,
    linkedPi,
    linkedTeam,
    loading,
    raw,
    router,
    setSelection,
    view,
  ]);

  useEffect(() => {
    if (!teamId || !piId || loading || (linked && !linkValid)) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ teamId, piId });
    async function load() {
      try {
        const response = await fetch(`/api/capacity?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          if (
            linked &&
            [400, 404, 409].includes(response.status) &&
            !controller.signal.aborted
          ) {
            setInvalid(true);
            setDismissed(raw);
            router.replace('/capacity');
            return;
          }
          throw new Error(await responseError(response));
        }
        const data = (await response.json()) as TeamPiCapacityView;
        if (!controller.signal.aborted)
          setResult({ key, revision, view: data });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResult({
            key,
            revision,
            error:
              cause instanceof Error
                ? cause.message
                : 'Capacity could not be loaded.',
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, linked, linkValid, loading, piId, raw, revision, router, teamId]);

  const mutate: CapacityMutation = async (path, method, body) => {
    if (
      !view ||
      view.readOnly ||
      current?.revision !== revision ||
      pending.current
    )
      return false;
    pending.current = true;
    setSaving(true);
    setSaveError(undefined);
    try {
      const response = await fetch(`/api/capacity/${path}`, {
        method,
        ...(body && {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      setRevision((prior) => prior + 1);
      return true;
    } catch (cause) {
      setSaveError({
        key,
        message:
          cause instanceof Error
            ? cause.message
            : 'Capacity could not be saved.',
      });
      return false;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const column = expanded?.key === key ? expanded.column : undefined;
  const busy = saving || current?.revision !== revision;
  const mutationError = saveError?.key === key ? saveError.message : undefined;
  const activeEditor = editor?.key === key ? editor.kind : undefined;
  const loadError =
    error ??
    (unavailable && !view
      ? 'The organization database is unavailable.'
      : undefined);

  return (
    <div className={styles.workspace}>
      <div className={styles.titleRow}>
        <h1>Capacity planner</h1>
        <div className={styles.titleControls}>
          {view && (
            <>
              <div className={styles.mode}>
                <span>Deduction mode</span>
                <div
                  role="group"
                  aria-label="Deduction mode"
                  className={styles.segments}
                >
                  {(['fixed_days', 'percent'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={view.team.deductionMode === mode}
                      disabled={view.readOnly}
                      aria-disabled={busy || undefined}
                      onClick={() => {
                        if (!busy && mode !== view.team.deductionMode)
                          void mutate('team-settings', 'PATCH', {
                            teamId: view.team.id,
                            deductionMode: mode,
                          });
                      }}
                    >
                      {mode === 'fixed_days' ? 'Fixed days' : '% of available'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <Link className={styles.primary} href="/calendar">
            Team calendar
          </Link>
        </div>
      </div>
      {invalid && (
        <div className={styles.notice} role="status">
          Link could not be opened — showing current selection
          <button
            className={styles.secondary}
            onClick={() => setInvalid(false)}
          >
            Dismiss
          </button>
        </div>
      )}
      {mutationError && !activeEditor && (
        <div className={styles.notice} role="alert">
          {mutationError}
        </div>
      )}
      {loadError && (
        <div className={styles.notice} role="alert">
          {loadError}
          <button
            className={styles.secondary}
            onClick={() => {
              setResult(undefined);
              setRevision((prior) => prior + 1);
              void refresh();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!loadError && !view && (loading || !!key) && (
        <p role="status">Loading capacity…</p>
      )}
      {!loadError && !view && !loading && !key && (
        <div className={styles.notice}>
          Select a Team and PI to view capacity.{' '}
          <Link href="/organization">Manage in Organization →</Link>
        </div>
      )}
      {view?.readOnly && (
        <div className={styles.notice} role="status">
          Viewing archived {view.team.name} · {view.pi.name} (read-only)
          <button
            className={styles.secondary}
            onClick={() => {
              setDismissed(raw);
              router.replace('/capacity');
            }}
          >
            Return to active selection
          </button>
        </div>
      )}
      {view && (
        <>
          <CapacityKpiStrip
            key={`kpis:${key}`}
            view={view}
            busy={busy}
            mutate={mutate}
            mutationError={mutationError}
            activeEditor={activeEditor}
            onEditorChange={(kind, open) =>
              setEditor((current) => {
                if (open) return { key, kind };
                return current?.key === key && current.kind === kind
                  ? undefined
                  : current;
              })
            }
          />
          {!view.iterations.length && (
            <div className={styles.notice}>
              This PI has no Iterations.{' '}
              <Link href="/organization">Manage in Organization →</Link>
            </div>
          )}
          <TeamAllocationMatrix view={view} expanded={column} />
          <MemberCapacityTable
            key={`members:${key}`}
            view={view}
            expanded={column}
            busy={busy}
            mutate={mutate}
            onExpand={(next) =>
              setExpanded({ key, column: next === column ? '' : next })
            }
          />
        </>
      )}
    </div>
  );
}
