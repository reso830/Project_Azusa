'use client';

import { useState } from 'react';
import { defaultLocations } from '@/domain/organization/default-locations';
import {
  AddButton,
  ArchiveToggle,
  Editor,
  Field,
  Picker,
  RecordActions,
  RowsState,
  displayStatus,
  useRows,
  useWrites,
  type PanelProps,
  type RecordState,
} from './controls';
import styles from './organization.module.css';

type Location = RecordState & {
  code: string;
  countryCode: string;
  subdivisionCode: string | null;
  timeZone: string;
  calendarSource: string;
  lastRefreshedAt: string | null;
  seededYears: number[];
  memberCount: number;
  holidayCount: number;
};
type Holiday = {
  id: string;
  name: string;
  date: string;
  portion: string;
  source: string;
  confirmed: boolean;
  effective: boolean;
};

const refreshedDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const seedOrder = defaultLocations.map(({ code }) => code);

function locationOrder(code: string) {
  const index = seedOrder.indexOf(code);
  return index === -1 ? seedOrder.length : index;
}

function utcOffset(timeZone: string) {
  const offset = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(new Date())
    .find((part) => part.type === 'timeZoneName')?.value;
  return offset && offset !== 'GMT' ? offset.replace('GMT', 'UTC') : 'UTC+0';
}

export function LocationsPanel({ onMutated }: PanelProps) {
  const writes = useWrites(onMutated);
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Location | 'new'>();
  const [inspectedId, setInspected] = useState('');
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const locations = useRows<Location>(
    `locations?includeArchived=${archived}&year=${year}`,
    writes.revision,
  );
  const orderedLocations = locations.rows.toSorted(
    (left, right) => locationOrder(left.code) - locationOrder(right.code),
  );
  const inspected = locations.rows.find(
    (location) => location.id === inspectedId,
  );
  const holidays = useRows<Holiday>(
    inspected ? `locations/${inspected.id}/holidays?year=${year}` : null,
    writes.revision,
  );

  function open(location?: Location | 'new') {
    writes.clearError();
    setEditing(location);
  }
  const existing = editing === 'new' ? undefined : editing;

  function submit(data: FormData) {
    const { code, subdivisionCode, ...fields } = Object.fromEntries(data);
    return writes.write(
      existing ? `locations/${existing.id}` : 'locations',
      existing ? 'PATCH' : 'POST',
      {
        ...fields,
        subdivisionCode: String(subdivisionCode ?? '').trim() || null,
        ...(!existing && { code }),
      },
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-label="Locations">
        <div className={styles.toolbar}>
          <div className={styles.locationHeading}>
            <h2>Locations</h2>
            {!locations.loading && !locations.error && (
              <p className={styles.subtitle}>
                {locations.rows.length}{' '}
                {archived
                  ? 'Locations including archived records'
                  : 'in use across the organization'}
              </p>
            )}
          </div>
          <ArchiveToggle
            checked={archived}
            change={(value) => {
              open();
              setInspected('');
              setArchived(value);
            }}
            label="Show archived Locations"
          />
          <AddButton label="Add Location" onClick={() => open('new')} />
        </div>
        <div className={styles.filters}>
          <Picker
            label="Holiday year"
            value={year}
            change={setYear}
            options={[
              ...new Set([
                year,
                ...locations.rows.flatMap((location) =>
                  location.seededYears.map(String),
                ),
              ]),
            ]
              .sort()
              .map((value) => ({ value, label: value }))}
          />
        </div>
        {editing && (
          <Editor
            key={existing?.id ?? 'new'}
            title={existing ? 'Edit Location' : 'Add Location'}
            busy={writes.busy}
            error={writes.errorFor()}
            submit={submit}
            close={() => open()}
          >
            <Field
              label="Code"
              name="code"
              value={existing?.code}
              readOnly={Boolean(existing)}
              required
            />
            <Field
              label="Location name"
              name="name"
              value={existing?.name}
              required
            />
            <Field
              label="Country code"
              name="countryCode"
              value={existing?.countryCode}
              required
            />
            <Field
              label="Subdivision code"
              name="subdivisionCode"
              value={existing?.subdivisionCode ?? ''}
            />
            <Field
              label="Time zone"
              name="timeZone"
              value={existing?.timeZone}
              required
            />
            <Field
              label="Calendar source"
              name="calendarSource"
              value={existing?.calendarSource}
              required
            />
          </Editor>
        )}
        <RowsState
          data={locations}
          empty={!locations.rows.length ? 'No Locations to show.' : undefined}
        />
        {locations.rows.length > 0 && (
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Location registry"
          >
            <table className={`${styles.table} ${styles.registryTable}`}>
              <thead>
                <tr>
                  {[
                    'Code',
                    'Location',
                    'Calendar source',
                    'Time zone',
                    'Members',
                    'Holidays',
                    'Last refreshed',
                    'Actions',
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedLocations.map((location) => (
                  <tr key={location.id}>
                    <td>
                      <span className={styles.code}>{location.code}</span>
                    </td>
                    <td>
                      {location.name}
                      {location.recordStatus === 'archived' && (
                        <span className={styles.badge}>Archived</span>
                      )}
                    </td>
                    <td>{location.calendarSource}</td>
                    <td title={location.timeZone}>
                      {utcOffset(location.timeZone)}
                    </td>
                    <td>{location.memberCount}</td>
                    <td>{location.holidayCount}</td>
                    <td>
                      {location.lastRefreshedAt
                        ? refreshedDate.format(
                            new Date(location.lastRefreshedAt),
                          )
                        : '—'}
                    </td>
                    <td>
                      <RecordActions
                        record={location}
                        resource="locations"
                        writes={writes}
                        edit={() => open(location)}
                        inspect={() => setInspected(location.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {inspected && (
        <section
          className={styles.card}
          aria-label={`${inspected.name} holidays`}
        >
          <div className={styles.toolbar}>
            <h2>{inspected.name} holidays</h2>
            <button type="button" onClick={() => setInspected('')}>
              Close holidays
            </button>
          </div>
          <RowsState
            data={holidays}
            empty={
              !holidays.rows.length
                ? 'No Holidays for this selection.'
                : undefined
            }
          />
          {holidays.rows.length > 0 && (
            <div
              className={styles.tableScroll}
              tabIndex={0}
              role="region"
              aria-label="Holiday records"
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Date', 'Holiday', 'Portion', 'Source', 'Status'].map(
                      (heading) => (
                        <th key={heading} scope="col">
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {holidays.rows.map((holiday) => (
                    <tr key={holiday.id}>
                      <td className={styles.mono}>{holiday.date}</td>
                      <td>{holiday.name}</td>
                      <td>{displayStatus(holiday.portion)}</td>
                      <td>{displayStatus(holiday.source)}</td>
                      <td>
                        {holiday.confirmed ? (
                          'Confirmed'
                        ) : (
                          <abbr className={styles.badge} title="Estimated date">
                            est.
                          </abbr>
                        )}
                        {!holiday.effective && (
                          <span className={styles.badge}>Overridden</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
