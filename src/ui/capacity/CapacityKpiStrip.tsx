import { useRef } from 'react';
import type { TeamPiCapacityView } from '../../domain/capacity/types';
import type {
  CapacityEditor,
  CapacityMutation,
} from './CapacityPlannerWorkspace';
import {
  BreakdownPopover,
  ForecastBreakdown,
  capacityNumber,
  velocityLabel,
} from './BreakdownPopover';
import styles from './capacity.module.css';
import { SavedNumberInput } from './SavedNumberInput';

export function CapacityKpiStrip({
  view,
  busy,
  mutate,
  mutationError,
  activeEditor,
  onEditorChange,
}: {
  view: TeamPiCapacityView;
  busy: boolean;
  mutate: CapacityMutation;
  mutationError?: string;
  activeEditor?: CapacityEditor;
  onEditorChange: (editor: CapacityEditor, open: boolean) => void;
}) {
  const { kpi, velocity, team, pi } = view;
  const pair = { teamId: team.id, piId: pi.id };
  const source = velocityLabel(velocity);
  const developmentDays = capacityNumber(kpi.piDevDaysDisplay);
  const saveOverride = useRef<HTMLButtonElement>(null);
  const excludedTitle = `Excluded members (${view.excludedMembers.length})`;
  const fteValue = kpi.eligibleFte.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  const fte = (
    <>
      {fteValue} <small>FTE</small>
    </>
  );
  const saveWorkday = (input: HTMLInputElement) => {
    if (view.readOnly || busy || !input.validity.valid) return;
    const hoursPerDay = input.valueAsNumber;
    if (hoursPerDay !== team.hoursPerDay)
      void mutate('team-settings', 'PATCH', { teamId: team.id, hoursPerDay });
  };
  return (
    <section className={styles.kpis} aria-label="Capacity summary">
      <article className={styles.planned}>
        <h2>Planned SP</h2>
        <div className={styles.kpiValue}>
          — <small>Not yet available</small>
        </div>
      </article>
      <article>
        <h2>Development capacity</h2>
        <div className={styles.kpiValue}>
          <BreakdownPopover
            label={`${developmentDays} days · Edit hours per day`}
            title="Development capacity"
            trigger={
              <>
                {developmentDays} <small>days</small>
              </>
            }
            disabled={view.readOnly}
            onOpenChange={(open) => onEditorChange('workday', open)}
          >
            {activeEditor === 'workday' && mutationError && (
              <p className={styles.warning} role="alert">
                {mutationError}
              </p>
            )}
            <div className={styles.editorForm}>
              <label>
                Hours per day
                <SavedNumberInput
                  min="1"
                  max="24"
                  step="0.5"
                  savedValue={team.hoursPerDay}
                  readOnly={busy}
                  title="Save with Enter or by leaving the field"
                  onBlur={(event) => saveWorkday(event.currentTarget)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || busy) return;
                    event.preventDefault();
                    if (event.currentTarget.reportValidity())
                      saveWorkday(event.currentTarget);
                  }}
                  required
                />
              </label>
            </div>
          </BreakdownPopover>
        </div>
      </article>
      <article>
        <h2>Normalized velocity</h2>
        <div className={styles.velocityActions}>
          <BreakdownPopover
            label={`${source} · Edit velocity${velocity.value === null ? ' · Set seed' : ''}`}
            title="Normalized velocity"
            trigger={<span className={styles.chip}>{source}</span>}
            disabled={view.readOnly}
            onOpenChange={(open) => onEditorChange('velocity', open)}
          >
            {activeEditor === 'velocity' && mutationError && (
              <p className={styles.warning} role="alert">
                {mutationError}
              </p>
            )}
            <form
              className={styles.editorForm}
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || view.readOnly) return;
                const form = event.currentTarget;
                const value = new FormData(form).get('seed');
                await mutate('team-settings', 'PATCH', {
                  teamId: team.id,
                  seedNormalizedVelocity: value === '' ? null : Number(value),
                });
              }}
            >
              <label>
                Team velocity seed
                <SavedNumberInput
                  name="seed"
                  min="0"
                  max="1000"
                  step="any"
                  savedValue={team.seedNormalizedVelocity}
                  disabled={view.readOnly}
                  readOnly={busy}
                />
              </label>
              <button
                className={styles.secondary}
                disabled={view.readOnly}
                aria-disabled={busy || undefined}
              >
                Save seed
              </button>
            </form>
            <form
              className={styles.editorForm}
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy || view.readOnly) return;
                const value = Number(
                  new FormData(event.currentTarget).get('override'),
                );
                await mutate('velocity-override', 'PUT', {
                  ...pair,
                  velocity: value,
                });
              }}
            >
              <label>
                PI velocity override
                <SavedNumberInput
                  name="override"
                  min="0"
                  max="1000"
                  step="any"
                  savedValue={velocity.piOverrideValue}
                  required
                  disabled={view.readOnly}
                  readOnly={busy}
                />
              </label>
              <button
                ref={saveOverride}
                className={styles.secondary}
                disabled={view.readOnly}
                aria-disabled={busy || undefined}
              >
                Save PI override
              </button>
              {velocity.piOverrideValue !== null && (
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={view.readOnly}
                  aria-disabled={busy || undefined}
                  onClick={async (event) => {
                    if (busy || view.readOnly) return;
                    const button = event.currentTarget;
                    const cleared = await mutate(
                      `velocity-override?${new URLSearchParams(pair)}`,
                      'DELETE',
                    );
                    if (cleared && document.activeElement === button)
                      saveOverride.current?.focus();
                  }}
                >
                  Clear PI override
                </button>
              )}
            </form>
          </BreakdownPopover>
        </div>
        <div className={`${styles.kpiValue} ${styles.accent}`}>
          {capacityNumber(velocity.value)} <small>SP / day</small>
        </div>
      </article>
      <article>
        <h2>Forecast SP</h2>
        <div className={styles.kpiValue}>
          <ForecastBreakdown view={view} label="PI" kpi />
        </div>
      </article>
      <article>
        <h2>Team FTE</h2>
        <div className={styles.kpiValue}>
          {view.excludedMembers.length ? (
            <BreakdownPopover
              label={`${fteValue} FTE · ${excludedTitle}`}
              title={excludedTitle}
              trigger={fte}
            >
              <ul className={styles.excluded}>
                {view.excludedMembers.map((member) => (
                  <li key={member.memberId}>
                    {member.fullName} ·{' '}
                    {member.exclusionReason === 'archived'
                      ? 'Archived'
                      : member.role}{' '}
                    · {member.locationCode}
                    {member.excludedIterationIds.length > 0 &&
                      member.excludedIterationIds.length <
                        view.iterations.length && (
                        <small>
                          {view.iterations
                            .filter((sprint) =>
                              member.excludedIterationIds.includes(
                                sprint.iterationId,
                              ),
                            )
                            .map((sprint) => sprint.name)
                            .join(', ')}
                        </small>
                      )}
                  </li>
                ))}
              </ul>
            </BreakdownPopover>
          ) : (
            fte
          )}
        </div>
      </article>
    </section>
  );
}
