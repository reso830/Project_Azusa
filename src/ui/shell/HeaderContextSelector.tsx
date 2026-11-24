'use client';

import Link from 'next/link';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatLocalDate } from '../../domain/calendar/iso-week';
import { KumikoIcon } from '../icons/KumikoIcon';
import { useOrganizationContext } from './OrganizationContext';
import styles from './shell.module.css';

type PickerKind = 'team' | 'pi';
type Choice = {
  id: string;
  name: string;
  dateRange?: string;
  status?: PiStatus;
};
type PiStatus = 'Upcoming' | 'Current' | 'Done';
type ChoiceGroup = { label?: string; choices: readonly Choice[] };
const piDates = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

function ContextPicker({
  kind,
  name,
  selectedId,
  groups,
  open,
  onOpenChange,
  select,
}: {
  kind: PickerKind;
  name: string;
  selectedId?: string;
  groups: readonly ChoiceGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  select: (id: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = kind === 'team' ? 'Team' : 'PI';
  const id = `azusa-context-${kind}`;

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, onOpenChange]);

  function focusOption(key: string) {
    const items = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ) ?? [],
    );
    if (!items.length) return;
    const index = items.findIndex((item) => item === document.activeElement);
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? items.length - 1
          : key === 'ArrowUp'
            ? index < 0
              ? items.length - 1
              : (index + items.length - 1) % items.length
            : (index + 1) % items.length;
    items[next]?.focus();
  }

  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      onOpenChange(false);
      trigger.current?.focus();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (open) focusOption(event.key);
      else {
        onOpenChange(true);
        requestAnimationFrame(() => focusOption(event.key));
      }
    }
  }

  return (
    <div
      ref={root}
      className={styles.contextPicker}
      onKeyDown={keyboard}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onOpenChange(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className={styles.contextTrigger}
        aria-label={`${label}: ${name}. Switch ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <span title={name}>{name}</span>
        <KumikoIcon name="chevron" size={13} />
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={`Switch ${label}`}
          className={styles.contextPanel}
        >
          {groups.map(({ label, choices }) => (
            <div role="group" aria-label={label} key={label ?? kind}>
              {label && (
                <span aria-hidden="true" className={styles.groupLabel}>
                  {label}
                </span>
              )}
              {choices.map((choice) => (
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={choice.id === selectedId}
                  key={choice.id}
                  onClick={() => {
                    select(choice.id);
                    onOpenChange(false);
                    trigger.current?.focus();
                  }}
                >
                  <span className={styles.choiceLabel}>
                    <span>{choice.name}</span>
                    {choice.dateRange && (
                      <span className={styles.choiceDates}>
                        {choice.dateRange}
                      </span>
                    )}
                  </span>
                  {choice.status && (
                    <span
                      className={`${styles.piStatus} ${styles[`pi${choice.status}`]}`}
                    >
                      {choice.status}
                    </span>
                  )}
                  {!choice.status && choice.id === selectedId && (
                    <KumikoIcon name="check" size={14} />
                  )}
                </button>
              ))}
              {choices.length === 0 && (
                <span className={styles.noChoices}>No active PIs</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeaderContextSelector({
  open,
  onTeamOpenChange,
  onPiOpenChange,
}: {
  open: PickerKind | null;
  onTeamOpenChange: (open: boolean) => void;
  onPiOpenChange: (open: boolean) => void;
}) {
  const { trains, selected, setTeamId, setPiId } = useOrganizationContext();
  if (!selected.train || !selected.team) return null;
  const today =
    open === 'pi'
      ? formatLocalDate(
          new Date(),
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        ).replaceAll('/', '-')
      : '';
  // Badge is date-derived; lifecycleStatus stays 'planning' until F012 transitions it.
  const piChoices = today
    ? // Prototype lists PIs newest first; the API returns them oldest first.
      [...selected.train.pis]
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((pi): Choice => ({
          ...pi,
          dateRange: piDates.formatRange(
            new Date(pi.startDate),
            new Date(pi.endDate),
          ),
          status:
            today < pi.startDate
              ? 'Upcoming'
              : today > pi.endDate
                ? 'Done'
                : 'Current',
        }))
    : [];
  return (
    <nav aria-label="Context" className={styles.context}>
      <Link
        href="/program-board"
        className={styles.contextArt}
        title={selected.train.name}
      >
        {selected.train.name}
      </Link>
      <span aria-hidden="true" className={styles.contextDivider}>
        ›
      </span>
      <ContextPicker
        kind="team"
        name={selected.team.name}
        selectedId={selected.team.id}
        open={open === 'team'}
        onOpenChange={onTeamOpenChange}
        select={setTeamId}
        groups={trains.map((train) => ({
          label: train.name,
          choices: train.teams,
        }))}
      />
      <span aria-hidden="true" className={styles.contextDivider}>
        ›
      </span>
      <ContextPicker
        kind="pi"
        name={selected.pi?.name ?? 'No active PI'}
        selectedId={selected.pi?.id}
        open={open === 'pi'}
        onOpenChange={onPiOpenChange}
        select={setPiId}
        groups={[{ choices: piChoices }]}
      />
    </nav>
  );
}
