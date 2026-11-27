import { useId, useRef, type ReactNode } from 'react';
import type {
  IterationCapacitySummary,
  MemberIterationBreakdown,
  ResolvedVelocity,
  TeamPiCapacityView,
} from '../../domain/capacity/types';
import styles from './capacity.module.css';

export const capacityNumber = (value: number | null, precision = 2) =>
  value === null
    ? '—'
    : value.toLocaleString('en-US', { maximumFractionDigits: precision });

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
export const capacityDates = (start: string, end: string) =>
  dateFormat.formatRange(
    new Date(`${start}T00:00:00Z`),
    new Date(`${end}T00:00:00Z`),
  );

export function velocityLabel(velocity: ResolvedVelocity) {
  switch (velocity.source) {
    case 'manual_seed':
      return 'Manual seed';
    case 'pi_override':
      return 'PI override';
    case 'sprint_override':
      return 'Sprint override';
    case 'rolling_4_sprint':
      return '4-Sprint rolling';
    case 'rolling_partial':
      return `${velocity.sprintCountUsed}-Sprint rolling`;
    case 'unset':
      return 'Unset';
  }
}

export function BreakdownPopover({
  label,
  title,
  trigger,
  children,
  disabled,
  onOpenChange,
}: {
  label: string;
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        className={styles.inspect}
        ref={button}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          dialog.current?.showModal();
          onOpenChange?.(true);
        }}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => {
          onOpenChange?.(false);
          button.current?.focus();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const { top, bottom, left, right } =
            event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < left ||
            event.clientX > right ||
            event.clientY < top ||
            event.clientY > bottom
          )
            event.currentTarget.close();
        }}
      >
        <div className={styles.dialogHeading}>
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => dialog.current?.close()}
          >
            Close
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}

export function ForecastBreakdown({
  view,
  sprint,
  label,
  kpi,
}: {
  view: TeamPiCapacityView;
  sprint?: IterationCapacitySummary;
  label: string;
  kpi?: boolean;
}) {
  const raw = sprint ? sprint.forecastSpRaw : view.kpi.piForecastSpRaw;
  const displayed = sprint
    ? sprint.forecastSpDisplay
    : view.kpi.piForecastSpDisplay;
  const days = sprint ? sprint.teamDevDaysRaw : view.kpi.piDevDaysRaw;
  const velocity = sprint?.velocity ?? view.velocity;
  return (
    <BreakdownPopover
      title={`${label} forecast breakdown`}
      label={`Inspect ${label} forecast · ${displayed === null ? 'unavailable' : `${capacityNumber(displayed)} SP`}`}
      trigger={
        displayed === null ? (
          '—'
        ) : kpi ? (
          <>
            {capacityNumber(displayed)} <small>SP</small>
          </>
        ) : (
          `${capacityNumber(displayed)} SP`
        )
      }
    >
      <dl className={styles.breakdown}>
        <dt>Team development days</dt>
        <dd>{capacityNumber(days, 4)}</dd>
        <dt>Normalized velocity</dt>
        <dd>
          {capacityNumber(velocity.value, 4)} · {velocityLabel(velocity)}
        </dd>
        <dt>Sprints in velocity history</dt>
        <dd>{velocity.sprintCountUsed}</dd>
        <dt>Raw forecast</dt>
        <dd>{capacityNumber(raw, 6)} SP</dd>
        <dt>Displayed forecast</dt>
        <dd>{capacityNumber(displayed)} SP</dd>
      </dl>
      <p>
        {sprint
          ? 'Team development days × normalized velocity, rounded to the nearest SP.'
          : 'PI forecast sums the displayed Sprint forecasts.'}
      </p>
    </BreakdownPopover>
  );
}

export function MemberBreakdown({
  view,
  member,
  sprint,
  cell,
  trigger,
}: {
  view: TeamPiCapacityView;
  member: TeamPiCapacityView['members'][number];
  sprint: IterationCapacitySummary;
  cell: MemberIterationBreakdown;
  trigger: ReactNode;
}) {
  return (
    <BreakdownPopover
      title={`${member.fullName} · ${sprint.name} breakdown`}
      label={`Inspect ${member.fullName} capacity for ${sprint.name} · ${capacityNumber(cell.devDaysRaw)}`}
      trigger={trigger}
    >
      <dl className={styles.breakdown}>
        <dt>Scheduled Sprint</dt>
        <dd>
          {capacityDates(sprint.scheduledStartDate, sprint.scheduledEndDate)} ·
          offset {sprint.offsetWorkdays} workdays
        </dd>
        <dt>Assigned weekdays</dt>
        <dd>
          {cell.assignedWeekdays} of {cell.scheduledWeekdays}
        </dd>
        <dt>Working days after holidays</dt>
        <dd>{capacityNumber(cell.workingDaysRaw)}</dd>
        <dt>Holidays</dt>
        <dd>
          {cell.holidays.length
            ? cell.holidays.map((holiday) => (
                <div key={holiday.id}>
                  {holiday.name} · {holiday.date}{' '}
                  {holiday.isEstimated ? '(est.)' : ''}
                </div>
              ))
            : 'None'}
        </dd>
        <dt>Active absences</dt>
        <dd>
          {cell.absences.length
            ? cell.absences.map((absence) => (
                <div key={absence.id}>
                  {absence.name} · {absence.date} ({absence.portion})
                </div>
              ))
            : 'None'}
        </dd>
        <dt>Effective leave</dt>
        <dd>{capacityNumber(cell.absenceDaysRaw)} days</dd>
        <dt>Overhead deductions</dt>
        <dd>
          {cell.overheadDeductions.length
            ? cell.overheadDeductions.map((deduction) => (
                <div key={deduction.categoryId}>
                  {view.overheadCategories.find(
                    (category) => category.categoryId === deduction.categoryId,
                  )?.name ?? 'Overhead'}{' '}
                  · {capacityNumber(deduction.deductedHours)}h /{' '}
                  {capacityNumber(deduction.daysRaw)}d
                </div>
              ))
            : 'None'}
        </dd>
        <dt>FTE</dt>
        <dd>{capacityNumber(member.fteFactor)}</dd>
        <dt>Development capacity</dt>
        <dd>
          {capacityNumber(cell.devDaysRaw)} days /{' '}
          {capacityNumber(cell.devHours)} hours
        </dd>
      </dl>
      <p className={styles.equation}>
        max(0, Days − Leaves − deductions) × FTE = Dev
      </p>
      <p className={styles.equation}>
        max(0, {capacityNumber(cell.workingDaysRaw)} −{' '}
        {capacityNumber(cell.absenceDaysRaw)} −{' '}
        {capacityNumber(cell.overheadDaysRaw)}) ×{' '}
        {capacityNumber(member.fteFactor)} = {capacityNumber(cell.devDaysRaw)}
      </p>
      {cell.hasOverDeductedWarning && (
        <p className={styles.warning}>Over-deducted → clamped to 0</p>
      )}
    </BreakdownPopover>
  );
}
