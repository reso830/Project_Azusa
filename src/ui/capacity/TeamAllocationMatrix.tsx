import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import type { TeamPiCapacityView } from '../../domain/capacity/types';
import {
  capacityDates,
  capacityNumber,
  ForecastBreakdown,
} from './BreakdownPopover';
import styles from './capacity.module.css';

export function capacityColumns(view: TeamPiCapacityView) {
  return [
    {
      id: view.pi.id,
      title: view.pi.name,
      dates: capacityDates(view.pi.startDate, view.pi.endDate),
      sprint: undefined,
    },
    ...view.iterations.map((sprint) => ({
      id: sprint.iterationId,
      title: sprint.kind === 'ip' ? `${sprint.name} · IP` : sprint.name,
      dates: capacityDates(sprint.scheduledStartDate, sprint.scheduledEndDate),
      sprint,
    })),
  ];
}

export function CapacityColumnWidths({
  ids,
  expanded,
  minWidth,
}: {
  ids: string[];
  expanded?: string;
  minWidth: number;
}) {
  const group = useRef<HTMLTableColElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const viewport = group.current?.closest(`.${styles.scroll}`);
    if (!viewport) return;
    const measure = () => setViewportWidth(viewport.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  const weight = ids.length + (expanded && ids.includes(expanded) ? 1.8 : 0);
  const available = Math.max(viewportWidth, minWidth) - 300;
  let units = 0;
  return (
    <colgroup ref={group}>
      <col style={{ width: 300 }} />
      {ids.map((id) => {
        const left = Math.round((available * units) / weight);
        units += id === expanded ? 2.8 : 1;
        const right = Math.round((available * units) / weight);
        return <col key={id} style={{ width: right - left }} />;
      })}
    </colgroup>
  );
}

export function capacityTableWidth(
  columnCount: number,
  expanded?: string,
  categories = 0,
) {
  const units = columnCount + (expanded ? 1.8 : 0);
  return Math.ceil(
    300 + units * Math.max(102, expanded ? ((3 + categories) * 52) / 2.8 : 0),
  );
}

export function TeamAllocationMatrix({
  view,
  expanded,
}: {
  view: TeamPiCapacityView;
  expanded?: string;
}) {
  const columns = capacityColumns(view);
  const { allocation, overheadCategories } = view;
  const minWidth = capacityTableWidth(
    columns.length,
    expanded,
    overheadCategories.length,
  );
  const widths = (
    <CapacityColumnWidths
      ids={columns.map(({ id }) => id)}
      expanded={expanded}
      minWidth={minWidth}
    />
  );
  return (
    <section aria-labelledby="capacity-allocation">
      <div className={styles.sectionHeading}>
        <h2 id="capacity-allocation">Team allocation</h2>
      </div>
      {!allocation.isValid && (
        <p className={styles.warning} role="status">
          {allocation.artConfigStatus === 'not_configured'
            ? 'No development categories configured.'
            : `Invalid allocation · Development categories total ${allocation.effectiveTotalPct}% (100% required).`}
        </p>
      )}
      <div
        className={styles.scroll}
        role="region"
        aria-label="Team allocation matrix"
        tabIndex={0}
      >
        <table
          className={`${styles.table} ${styles.allocationTable}`}
          style={{ minWidth }}
        >
          {widths}
          <thead>
            <tr>
              <th scope="col">
                <Link
                  className={styles.tableAction}
                  href="/organization"
                  aria-label="Category · Manage categories in Organization"
                  title="Manage categories in Organization"
                >
                  Category
                </Link>
                <small>Planned / budget SP</small>
              </th>
              {columns.map(({ id, title, dates, sprint }) => (
                <th
                  key={id}
                  scope="col"
                  className={sprint?.isCurrent ? styles.current : undefined}
                >
                  {title}
                  <small>{dates}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className={styles.forecast}>
              <th scope="row">
                Forecast SP {allocation.isValid && <small> · 100%</small>}
              </th>
              {columns.map(({ id, title, sprint }) => (
                <td key={id}>
                  <ForecastBreakdown
                    view={view}
                    label={title}
                    sprint={sprint}
                  />
                </td>
              ))}
            </tr>
            {allocation.rows.map((category) => (
              <tr key={category.categoryId}>
                <th scope="row">
                  <div
                    className={styles.categoryLabel}
                    style={{ borderColor: category.color }}
                  >
                    <span>
                      {category.name}
                      <small>
                        {category.source === 'inherit'
                          ? 'Inherits train'
                          : 'Train'}{' '}
                        {category.artDefaultPct}%
                      </small>
                    </span>
                    <span
                      className={
                        category.source === 'override'
                          ? styles.overrideChip
                          : styles.inheritedPct
                      }
                    >
                      {category.effectivePct}%
                    </span>
                  </div>
                </th>
                {[
                  category.piBudgetSpDisplay,
                  ...category.byIteration.map((item) => item.budgetSpDisplay),
                ].map((budget, index) => (
                  <td key={columns[index]?.id}>
                    <strong>—</strong> <small>/ {capacityNumber(budget)}</small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">
                <div className={styles.rowSplit}>
                  Planned SP{' '}
                  {allocation.isValid && (
                    <span className={styles.valid}>Total 100% ✓</span>
                  )}
                </div>
              </th>
              {columns.map(({ id, sprint }) => (
                <td key={id}>
                  <strong>—</strong>{' '}
                  <small>
                    /{' '}
                    {capacityNumber(
                      sprint
                        ? sprint.forecastSpDisplay
                        : view.kpi.piForecastSpDisplay,
                    )}
                  </small>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
