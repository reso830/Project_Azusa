'use client';
import { useEffect, useState } from 'react';
import { getTodayWidgetModel } from '../../domain/calendar/iso-week';
import {
  computeTeamIterationSchedule,
  resolveTodayCadenceStatus,
} from '../../domain/organization/cadence';
import { useOrganizationContext } from './OrganizationContext';
import styles from './shell.module.css';
export function TodayWidget({
  hiddenForSearchOverlap,
}: {
  hiddenForSearchOverlap: boolean;
}) {
  const [model, setModel] = useState<ReturnType<typeof getTodayWidgetModel>>();
  const {
    selected: { team, pi },
  } = useOrganizationContext();
  useEffect(() => {
    let zone: string | undefined;
    try {
      zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}
    const schedules =
      team && pi
        ? pi.iterations.map((iteration) =>
            computeTeamIterationSchedule(
              { ...iteration, piId: pi.id },
              team.id,
              team.sprintOffsetWorkdays,
            ),
          )
        : [];
    const update = () => {
      const clock = getTodayWidgetModel(new Date(), zone);
      const cadence = resolveTodayCadenceStatus(
        clock.dateText.replaceAll('/', '-'),
        pi,
        schedules,
      );
      setModel({ ...clock, piSprintText: cadence.label });
    };
    update();
    const timer = setInterval(update, 15000);
    return () => clearInterval(timer);
  }, [pi, team]);
  return (
    <div
      data-testid="today-widget"
      role="timer"
      aria-label="Current date, calendar week, PI and sprint status, and local time"
      className={`${styles.today} ${team ? styles.todayWithTeam : ''} ${hiddenForSearchOverlap ? styles.hideToday : ''}`}
    >
      <span className={styles.todayDate}>
        {model ? (
          <>
            <span className={styles.todayCalendar}>
              <span>{model.dateText}</span>
              <span aria-hidden="true">·</span>
              <span>{model.cwText}</span>
              <span aria-hidden="true">|</span>
            </span>
            <span>{model.piSprintText}</span>
          </>
        ) : (
          <span aria-hidden="true">&nbsp;</span>
        )}
      </span>
      <span className={styles.clockLine}>
        <time className={styles.clock}>{model?.clockTime ?? '\u00a0'}</time>
        <span className={styles.zone}>{model?.clockZone}</span>
      </span>
    </div>
  );
}
