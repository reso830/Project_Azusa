import Link from 'next/link';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { snapToQuarterHour } from '../../domain/capacity/engine';
import type {
  MemberIterationBreakdown,
  TeamPiCapacityView,
} from '../../domain/capacity/types';
import {
  capacityNumber,
  ForecastBreakdown,
  MemberBreakdown,
} from './BreakdownPopover';
import type { CapacityMutation } from './CapacityPlannerWorkspace';
import {
  capacityColumns,
  CapacityColumnWidths,
  capacityTableWidth,
} from './TeamAllocationMatrix';
import styles from './capacity.module.css';

function CellMarkers({ cell }: { cell: MemberIterationBreakdown }) {
  return (
    <>
      {cell.absenceDaysRaw > 0 && (
        <span className={styles.leave}>
          −{capacityNumber(cell.absenceDaysRaw)}
          <span className={styles.visuallyHidden}> leave</span>
        </span>
      )}
      {cell.holidayDaysRaw > 0 && (
        <span className={styles.holiday}>
          −{capacityNumber(cell.holidayDaysRaw)}
          <span className={styles.visuallyHidden}> holiday</span>
          {cell.hasEstimatedHoliday ? ' est.' : ''}
        </span>
      )}
      {cell.hasOverDeductedWarning && (
        <span className={styles.holiday}>Over-deducted</span>
      )}
    </>
  );
}

function DeductionInput({
  label,
  days,
  hours,
  hoursPerDay,
  disabled,
  readOnly,
  onSave,
}: {
  label: string;
  days: number;
  hours: number;
  hoursPerDay: number;
  disabled: boolean;
  readOnly: boolean;
  onSave: (hours: number) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const savedDays = String(Number(days.toFixed(2)));

  // Refresh the saved value without replacing the focused input.
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = savedDays;
  }, [savedDays]);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const input = inputRef.current;
        if (!input || readOnly || disabled) return;
        const deductedHours = snapToQuarterHour(
          Number(input.value) * hoursPerDay,
        );
        if (deductedHours !== hours && !(await onSave(deductedHours))) return;
        input.value = String(Number((deductedHours / hoursPerDay).toFixed(2)));
      }}
    >
      <input
        ref={inputRef}
        name="days"
        aria-label={label}
        type="number"
        step="any"
        min="0"
        max={744 / hoursPerDay}
        onBlur={(event) => {
          const input = event.currentTarget;
          if (
            !readOnly &&
            !disabled &&
            input.value !== input.defaultValue &&
            input.validity.valid
          )
            input.form?.requestSubmit();
        }}
        required
        disabled={disabled}
        readOnly={readOnly}
        defaultValue={savedDays}
      />
    </form>
  );
}

export function MemberCapacityTable({
  view,
  expanded,
  onExpand,
  busy,
  mutate,
}: {
  view: TeamPiCapacityView;
  expanded?: string;
  onExpand: (column: string) => void;
  busy: boolean;
  mutate: CapacityMutation;
}) {
  const columns = capacityColumns(view);
  const overhead = view.overheadCategories;
  const active = overhead.filter(
    (category) => category.recordStatus === 'active',
  );
  const fixed = view.team.deductionMode === 'fixed_days';
  const showBulk =
    active.length > 0 && view.iterations.length > 0 && view.members.length > 0;
  const [bulkCategory, setBulkCategory] = useState<string>();
  const bulkPanel = useId();
  const headerHint = useId();
  const bulkTrigger = useRef<HTMLButtonElement>(null);
  const [emptyBulk, setEmptyBulk] = useState(false);
  const subgrid = {
    '--capacity-subcolumns': 3 + overhead.length,
  } as CSSProperties;
  const minWidth = capacityTableWidth(
    columns.length,
    expanded,
    overhead.length,
  );
  const bulkEditor = (
    <div
      id={bulkPanel}
      className={styles.bulkPanel}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        setBulkCategory(undefined);
        bulkTrigger.current?.focus();
      }}
    >
      <form
        className={styles.bulkForm}
        key={view.team.deductionMode}
        onChange={() => setEmptyBulk(false)}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || view.readOnly) return;
          const values = new FormData(event.currentTarget);
          const entries = active.flatMap(({ categoryId }) => {
            const input = values.get(categoryId);
            return input === null || input === ''
              ? []
              : [{ categoryId, value: Number(input) }];
          });
          setEmptyBulk(entries.length === 0);
          if (!entries.length) return;
          void mutate('overhead-deductions/bulk', 'POST', {
            teamId: view.team.id,
            piId: view.pi.id,
            mode: view.team.deductionMode,
            entries,
          });
        }}
      >
        {active.map((category) => (
          <label key={category.categoryId}>
            {category.name} ({fixed ? 'days' : '%'})
            <input
              name={category.categoryId}
              type="number"
              min="0"
              max={fixed ? 31 : 100}
              step="any"
              disabled={view.readOnly}
              readOnly={busy}
            />
          </label>
        ))}
        <button
          className={styles.secondary}
          disabled={view.readOnly}
          aria-disabled={busy || undefined}
        >
          Bulk apply
        </button>
        {emptyBulk && (
          <p className={styles.bulkNotice} role="status">
            Enter at least one overhead deduction.
          </p>
        )}
      </form>
    </div>
  );
  return (
    <section aria-labelledby="member-capacity">
      <div className={styles.sectionHeading}>
        <h2 id="member-capacity">Member capacity</h2>
      </div>
      {view.members.length === 0 && (
        <p className={styles.notice}>
          No eligible Team members.{' '}
          <Link href="/organization">Manage in Organization →</Link>
        </p>
      )}
      <div
        className={styles.scroll}
        role="region"
        aria-label="Member capacity table"
        tabIndex={0}
      >
        <table
          className={`${styles.table} ${styles.memberTable}`}
          style={{ minWidth }}
        >
          <CapacityColumnWidths
            ids={columns.map(({ id }) => id)}
            expanded={expanded}
            minWidth={minWidth}
          />
          <thead>
            <tr>
              <th scope="col">
                <div className={styles.memberHeader}>Member</div>
              </th>
              {columns.map(({ id, title, dates, sprint }) => {
                const locationsOff = sprint?.holidayLocations.length ?? 0;
                const holidayCount = `${locationsOff} ${locationsOff === 1 ? 'location' : 'locations'} off`;
                const hintId = `${headerHint}-${id}`;
                const holidayHint = locationsOff
                  ? `${holidayCount} · ${sprint?.holidayLocations.map((location) => location.name).join(', ')}`
                  : undefined;
                return (
                  <th
                    scope="col"
                    key={id}
                    className={sprint?.isCurrent ? styles.current : undefined}
                  >
                    <div className={styles.columnHeader}>
                      <button
                        type="button"
                        className={`${styles.inspect} ${styles.columnToggle}`}
                        aria-expanded={id === expanded}
                        aria-describedby={holidayHint ? hintId : undefined}
                        title={holidayHint}
                        onClick={() => onExpand(id)}
                      >
                        <span className={styles.columnName}>{title}</span>
                        <span
                          className={styles.columnChevron}
                          aria-hidden="true"
                        >
                          {id === expanded ? '◂' : '▸'}
                        </span>
                      </button>
                      {sprint?.isCurrent && (
                        <span className={styles.visuallyHidden}>
                          Current Sprint
                        </span>
                      )}
                      <div className={styles.columnMeta}>
                        <small className={styles.columnDate} title={dates}>
                          {dates}
                        </small>
                        {holidayHint && (
                          <span id={hintId} className={styles.visuallyHidden}>
                            {holidayHint}
                          </span>
                        )}
                      </div>
                    </div>
                    {id === expanded && (
                      <div className={styles.subheadingGrid} style={subgrid}>
                        <span>Days</span>
                        <span>Leaves</span>
                        {overhead.map((category) => {
                          const { shortLabel } = category;
                          const defaultTraining =
                            category.name === 'Training' &&
                            shortLabel === 'Training' &&
                            category.color.toLowerCase() === '#5c7a1f';
                          let label = shortLabel;
                          if (defaultTraining) label = 'TR';
                          else if (shortLabel.length > 6)
                            label = shortLabel.includes(' ')
                              ? shortLabel
                                  .split(/\s+/)
                                  .map((word) => word[0])
                                  .join('')
                              : shortLabel.slice(0, 2);
                          return (
                            <span
                              key={category.categoryId}
                              title={category.name}
                              style={{
                                color: '#1a1b22',
                                backgroundColor: defaultTraining
                                  ? '#00b0f0'
                                  : `color-mix(in srgb, ${category.color} 45%, white)`,
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                        <span>Dev</span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {overhead.length > 0 && (
            <tbody
              className={styles.overheadRows}
              aria-label="Deducted first overhead"
            >
              {overhead.map((category, index) => {
                const editable =
                  showBulk &&
                  !view.readOnly &&
                  category.recordStatus === 'active';
                const open = editable && bulkCategory === category.categoryId;
                return (
                  <tr key={category.categoryId}>
                    <th scope="row" className={styles.overheadLabel}>
                      {editable ? (
                        <button
                          type="button"
                          className={styles.inspect}
                          aria-label={`Bulk overhead for ${category.name}`}
                          aria-expanded={open}
                          aria-controls={open ? bulkPanel : undefined}
                          title={`Bulk apply ${category.name}`}
                          onClick={(event) => {
                            bulkTrigger.current = event.currentTarget;
                            setEmptyBulk(false);
                            setBulkCategory(
                              open ? undefined : category.categoryId,
                            );
                          }}
                        >
                          {category.name}
                        </button>
                      ) : (
                        category.name
                      )}
                      {open && bulkEditor}
                    </th>
                    {[
                      {
                        iterationId: view.pi.id,
                        daysRaw: category.piTotalDaysRaw,
                        hours: category.piTotalHours,
                      },
                      ...category.byIteration,
                    ].map(({ iterationId, daysRaw, hours }) => {
                      const duration = (
                        <span
                          title={`${capacityNumber(daysRaw)} days · ${capacityNumber(hours)}h`}
                        >
                          {daysRaw ? `−${capacityNumber(daysRaw)}` : '—'}
                          <span className={styles.visuallyHidden}>
                            {' '}
                            ({capacityNumber(hours)}h)
                          </span>
                        </span>
                      );
                      return iterationId === expanded ? (
                        <td key={iterationId} className={styles.expandedCell}>
                          <div className={styles.subgrid} style={subgrid}>
                            <div style={{ gridColumn: index + 3 }}>
                              {duration}
                            </div>
                          </div>
                        </td>
                      ) : (
                        <td key={iterationId}>{duration}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          )}
          <tbody>
            {view.members.map((member) => (
              <tr key={member.memberId}>
                <th scope="row">
                  <div className={styles.memberLabel}>
                    <span
                      className={styles.avatar}
                      style={{ background: member.avatarColor ?? '#585c65' }}
                      aria-hidden="true"
                    >
                      {member.initials}
                    </span>
                    <span>
                      {member.fullName}
                      <small>
                        {member.role} ·{' '}
                        {member.fteFactor
                          .toFixed(member.fteFactor % 1 === 0 ? 1 : 2)
                          .replace(/(\.\d)0$/, '$1')}{' '}
                        FTE
                      </small>
                    </span>
                    <span
                      className={styles.location}
                      title={member.location.name}
                    >
                      {member.location.code}
                    </span>
                  </div>
                </th>
                <td
                  className={
                    expanded === view.pi.id ? styles.expandedCell : undefined
                  }
                >
                  {expanded === view.pi.id ? (
                    <div className={styles.subgrid} style={subgrid}>
                      <span>{capacityNumber(member.piWorkingDaysRaw)}</span>
                      <span>{capacityNumber(member.piAbsenceDaysRaw)}</span>
                      {overhead.map((category) => (
                        <span key={category.categoryId}>
                          {capacityNumber(
                            member.cells.reduce(
                              (total, cell) =>
                                total +
                                (cell.overheadDeductions.find(
                                  (deduction) =>
                                    deduction.categoryId ===
                                    category.categoryId,
                                )?.daysRaw ?? 0),
                              0,
                            ),
                          )}
                        </span>
                      ))}
                      <strong>{capacityNumber(member.piDevDaysRaw)}</strong>
                    </div>
                  ) : (
                    <strong className={styles.piValue}>
                      {capacityNumber(member.piDevDaysRaw)}
                    </strong>
                  )}
                </td>
                {view.iterations.map((sprint) => {
                  const cell = member.cells.find(
                    (candidate) => candidate.iterationId === sprint.iterationId,
                  );
                  if (!cell || cell.exclusionReason)
                    return (
                      <td key={sprint.iterationId}>
                        {cell?.exclusionReason === 'archived'
                          ? 'Archived'
                          : '—'}
                      </td>
                    );
                  return (
                    <td
                      key={sprint.iterationId}
                      className={
                        expanded === sprint.iterationId
                          ? styles.expandedCell
                          : undefined
                      }
                    >
                      {expanded === sprint.iterationId ? (
                        <div className={styles.subgrid} style={subgrid}>
                          <span className={styles.dayValue}>
                            {capacityNumber(cell.workingDaysRaw)}
                            {cell.hasEstimatedHoliday && (
                              <small
                                className={styles.holiday}
                                title="Estimated holiday"
                              >
                                {' '}
                                est.
                              </small>
                            )}
                          </span>
                          <span className={styles.leave}>
                            {capacityNumber(cell.absenceDaysRaw)}
                          </span>
                          {overhead.map((category) => {
                            const deduction = cell.overheadDeductions.find(
                              (entry) =>
                                entry.categoryId === category.categoryId,
                            );
                            const days = deduction?.daysRaw ?? 0;
                            const label = `${category.name} deduction days for ${member.fullName} in ${sprint.name}`;
                            return category.recordStatus === 'archived' ? (
                              <span key={category.categoryId}>
                                {capacityNumber(days)}
                              </span>
                            ) : (
                              <DeductionInput
                                key={category.categoryId}
                                label={label}
                                days={days}
                                hours={deduction?.deductedHours ?? 0}
                                hoursPerDay={view.team.hoursPerDay}
                                disabled={view.readOnly}
                                readOnly={busy}
                                onSave={(deductedHours) =>
                                  mutate('overhead-deductions', 'PUT', {
                                    teamId: view.team.id,
                                    memberId: member.memberId,
                                    iterationId: sprint.iterationId,
                                    categoryId: category.categoryId,
                                    deductedHours,
                                  })
                                }
                              />
                            );
                          })}
                          <div className={styles.dayValue}>
                            <MemberBreakdown
                              view={view}
                              sprint={sprint}
                              member={member}
                              cell={cell}
                              trigger={
                                <strong>
                                  {capacityNumber(cell.devDaysRaw)}
                                </strong>
                              }
                            />
                            {cell.hasOverDeductedWarning && (
                              <span
                                className={styles.holiday}
                                title="Over-deducted"
                                role="img"
                                aria-label="Over-deducted"
                              >
                                {' '}
                                ⚠
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className={styles.collapsed}>
                          <MemberBreakdown
                            view={view}
                            sprint={sprint}
                            member={member}
                            cell={cell}
                            trigger={
                              <strong>{capacityNumber(cell.devDaysRaw)}</strong>
                            }
                          />
                          <div className={styles.markers}>
                            <CellMarkers cell={cell} />
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Team dev days</th>
              {columns.map(({ id, sprint }) => {
                const dev = capacityNumber(
                  sprint?.teamDevDaysDisplay ?? view.kpi.piDevDaysDisplay,
                );
                if (id !== expanded)
                  return (
                    <td key={id}>
                      <strong>{dev}</strong>
                    </td>
                  );
                const absence =
                  sprint?.teamAbsenceDaysRaw ??
                  view.members.reduce(
                    (total, member) => total + member.piAbsenceDaysRaw,
                    0,
                  );
                const working = sprint
                  ? sprint.teamAvailableDaysRaw + absence
                  : view.members.reduce(
                      (total, member) => total + member.piWorkingDaysRaw,
                      0,
                    );
                return (
                  <td key={id} className={styles.expandedCell}>
                    <div className={styles.subgrid} style={subgrid}>
                      <span>{capacityNumber(working)}</span>
                      <span>{capacityNumber(absence)}</span>
                      {overhead.map((category) => (
                        <span key={category.categoryId}>
                          {capacityNumber(
                            sprint
                              ? (category.byIteration.find(
                                  (item) => item.iterationId === id,
                                )?.daysRaw ?? 0)
                              : category.piTotalDaysRaw,
                          )}
                        </span>
                      ))}
                      <strong>{dev}</strong>
                    </div>
                  </td>
                );
              })}
            </tr>
            <tr className={styles.forecast}>
              <th scope="row">
                Forecast SP{' '}
                <small>× {capacityNumber(view.velocity.value)}</small>
              </th>
              {columns.map(({ id, title, sprint }) => {
                const forecast = (
                  <ForecastBreakdown
                    view={view}
                    label={`Member table ${title}`}
                    sprint={sprint}
                  />
                );
                return id === expanded ? (
                  <td key={id} className={styles.expandedCell}>
                    <div className={styles.subgrid} style={subgrid}>
                      <div className={styles.devColumn}>{forecast}</div>
                    </div>
                  </td>
                ) : (
                  <td key={id}>{forecast}</td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
