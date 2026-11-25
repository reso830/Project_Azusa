'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { formatLocalDate } from '@/domain/calendar/iso-week';
import {
  validateArtDefaultTotals,
  type TeamPiAllocationView,
} from '@/domain/categories/rules';
import { pickCurrentPi } from '@/domain/organization/context';
import {
  AddButton,
  api,
  ArchiveToggle,
  Editor,
  Field,
  Picker,
  RecordActions,
  RowsState,
  useRows,
  useWrites,
  type PanelProps,
  type RecordState,
  type Writes,
} from './controls';
import styles from './organization.module.css';

const resource = '/api/categories';
const kinds = [
  { value: 'development', label: 'Development' },
  { value: 'overhead', label: 'Overhead' },
] as const;
const roles = [
  { value: 'feature', label: 'Feature' },
  { value: 'maintenance_bugs', label: 'Bugs and Maintenance' },
  { value: 'standard', label: 'Standard' },
];
type Kind = (typeof kinds)[number]['value'];
type Category = RecordState & {
  kind: Kind;
  shortLabel: string;
  color: string;
  semanticRole: string | null;
  defaultPct: number | null;
  isReferenced: boolean;
};
type Catalog = {
  categories: Category[];
  totalCategoryCount: number;
  activeDevelopmentTotalPct: number;
  driftedAllocations: {
    teamId: string;
    teamName: string;
    piId: string;
    piName: string;
    effectiveTotalPct: number;
  }[];
};
type Draft = Record<string, string>;

function useResult<T>(path: string | null, revision: number) {
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    value?: T;
    error?: string;
  }>();
  const key = path && JSON.stringify([path, revision, attempt]);
  useEffect(() => {
    if (!path || !key) return;
    const controller = new AbortController();
    api<T>(path, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setResult({ key, value });
      },
      (error: Error) => {
        if (!controller.signal.aborted)
          setResult({ key, error: error.message });
      },
    );
    return () => controller.abort();
  }, [key, path]);
  const current = result?.key === key ? result : undefined;
  return {
    value: current?.value,
    loading: Boolean(path && !current),
    error: current?.error,
    retry: () => retry((value) => value + 1),
  };
}

function pickRecord<T extends RecordState>(records: T[], selected: string) {
  return (
    records.find(({ id }) => id === selected) ??
    records.find(({ recordStatus }) => recordStatus === 'active') ??
    records[0]
  );
}

function recordOptions(records: RecordState[]) {
  return records.map(({ id, name, recordStatus }) => ({
    value: id,
    label: recordStatus === 'archived' ? `${name} (Archived)` : name,
  }));
}

function percentage(value: string) {
  return /^\d+$/.test(value) && Number(value) <= 100 ? Number(value) : NaN;
}

function Total({ count, total }: { count: number; total: number }) {
  const valid = count > 0 && total === 100;
  return (
    <span
      className={`${styles.allocationTotal} ${valid ? styles.totalValid : ''}`}
      role="status"
    >
      {count === 0
        ? 'Not configured'
        : !Number.isFinite(total)
          ? 'Enter a whole number from 0 to 100'
          : valid
            ? '100% ✓'
            : `${total}% — must total 100%`}
    </span>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className={styles.swatch}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function PercentInput({
  label,
  value,
  disabled,
  optional,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={styles.percentInput}
      type="text"
      inputMode="numeric"
      aria-label={label}
      aria-invalid={
        !(optional && value === '') && !Number.isFinite(percentage(value))
      }
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function MutationError({ message }: { message?: string }) {
  return message ? (
    <p className={styles.error} role="alert">
      {message}
    </p>
  ) : null;
}

function CategoryEditor({
  trainId,
  category,
  writes,
  close,
}: {
  trainId: string;
  category?: Category;
  writes: Writes;
  close: () => void;
}) {
  const [kind, setKind] = useState<string>(category?.kind ?? 'development');
  const path = category ? `${resource}/${category.id}` : resource;
  return (
    <Editor
      title={category ? 'Edit Category' : 'Add Category'}
      busy={writes.busy}
      error={writes.errorFor(path)}
      close={close}
      submit={(data) =>
        writes.write(
          path,
          category ? 'PATCH' : 'POST',
          {
            ...Object.fromEntries(data),
            ...(!category && { trainId }),
            ...(kind === 'overhead' && { semanticRole: null }),
          },
          path,
        )
      }
    >
      <Field
        label="Category name"
        name="name"
        value={category?.name}
        required
      />
      <Field
        label="Short label"
        name="shortLabel"
        value={category?.shortLabel}
        required
      />
      <Field
        label="Color"
        name="color"
        value={category?.color ?? '#2E8B57'}
        required
      />
      <Picker
        label="Kind"
        name="kind"
        value={kind}
        change={setKind}
        options={
          category?.isReferenced
            ? kinds.filter(({ value }) => value === category.kind)
            : kinds
        }
      />
      {kind === 'development' && (
        <Picker
          label="Semantic role"
          name="semanticRole"
          options={roles}
          defaultValue={category?.semanticRole ?? 'standard'}
          required
        />
      )}
    </Editor>
  );
}

function ArtWorkCategories({
  train,
  catalog,
  archived,
  setArchived,
  writes,
}: {
  train: RecordState;
  catalog: ReturnType<typeof useResult<Catalog>>;
  archived: boolean;
  setArchived: (value: boolean) => void;
  writes: Writes;
}) {
  const [editing, setEditing] = useState<Category | 'new'>();
  const [draft, setDraft] = useState<Draft>({});
  const readOnly = train.recordStatus === 'archived';
  const rows = catalog.value?.categories ?? [];
  const development = rows.filter(
    ({ kind, recordStatus }) =>
      kind === 'development' && recordStatus === 'active',
  );
  const defaults = development.map((category) => ({
    ...category,
    defaultPct: percentage(draft[category.id] ?? String(category.defaultPct)),
  }));
  const totals = validateArtDefaultTotals(defaults);
  const defaultsPath = `${resource}/defaults`;
  const reorderPath = `${resource}/reorder`;
  const samplePath = `${resource}/sample`;
  const busy = readOnly || writes.busy;

  function open(value?: Category | 'new') {
    writes.clearError();
    setEditing(value);
  }

  async function saveDefaults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !totals.artDefaultsValid) return;
    const allocations = defaults.map(({ id, defaultPct }) => ({
      categoryId: id,
      defaultPct,
    }));
    if (
      await writes.write(
        defaultsPath,
        'PUT',
        { trainId: train.id, allocations },
        defaultsPath,
      )
    )
      setDraft({});
  }

  function move(
    kind: Kind,
    group: Category[],
    index: number,
    direction: number,
  ) {
    const target = index + direction;
    const row = group[index];
    const neighbor = group[target];
    if (!row || !neighbor) return;
    const orderedIds = group.map(({ id }) => id);
    orderedIds[index] = neighbor.id;
    orderedIds[target] = row.id;
    void writes.write(
      reorderPath,
      'POST',
      { trainId: train.id, kind, orderedIds },
      reorderPath,
    );
  }

  return (
    <section className={styles.card} aria-label="ART Work Categories">
      <div className={styles.toolbar}>
        <h2>ART Work Categories</h2>
        <ArchiveToggle
          checked={archived}
          change={(value) => {
            open();
            setArchived(value);
          }}
        />
        {!readOnly && (
          <AddButton
            label="Add Category"
            onClick={() => open('new')}
            disabled={writes.busy || !catalog.value}
          />
        )}
      </div>
      {readOnly && <p className={styles.muted}>Archived ART — read-only</p>}
      {editing && (
        <CategoryEditor
          key={editing === 'new' ? 'new' : editing.id}
          trainId={train.id}
          category={editing === 'new' ? undefined : editing}
          writes={writes}
          close={() => open()}
        />
      )}
      <RowsState data={catalog} />
      <MutationError
        message={writes.errorFor(samplePath) ?? writes.errorFor(reorderPath)}
      />
      {catalog.value && (
        <form onSubmit={saveDefaults}>
          <div className={styles.allocationSummary}>
            <span>ART development total</span>
            <Total
              count={development.length}
              total={totals.activeDevelopmentTotalPct}
            />
            {catalog.value.totalCategoryCount === 0 && !readOnly && (
              <span className={styles.actions}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void writes.write(
                      samplePath,
                      'POST',
                      { trainId: train.id },
                      samplePath,
                    )
                  }
                >
                  Apply sample catalog
                </button>
              </span>
            )}
          </div>
          {catalog.value.driftedAllocations.length > 0 && (
            <div className={styles.driftNotice} role="status">
              <strong>Drift warning</strong>
              <ul>
                {catalog.value.driftedAllocations.map(
                  ({ teamId, teamName, piId, piName, effectiveTotalPct }) => (
                    <li key={`${teamId}:${piId}`}>
                      {teamName} · {piName}{' '}
                      <span className={styles.mono}>{effectiveTotalPct}%</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          )}
          {kinds.map(({ value: kind, label }) => {
            const active = rows.filter(
              (row) => row.kind === kind && row.recordStatus === 'active',
            );
            const group = [
              ...active,
              ...rows.filter(
                (row) => row.kind === kind && row.recordStatus === 'archived',
              ),
            ];
            return (
              <section
                key={kind}
                className={styles.categoryGroup}
                aria-label={label}
              >
                <h3>{label}</h3>
                {group.length === 0 && (
                  <p className={styles.muted}>
                    No {label.toLowerCase()} categories.
                  </p>
                )}
                {group.map((row, index) => (
                  <div
                    key={row.id}
                    className={styles.record}
                    role="group"
                    aria-label={row.name}
                  >
                    <div className={styles.categoryIdentity}>
                      <Swatch color={row.color} />
                      <div>
                        <strong>{row.name}</strong>
                        {row.recordStatus === 'archived' && (
                          <span className={styles.badge}>Archived</span>
                        )}
                        <div className={styles.categoryDetail}>
                          {row.shortLabel}
                          {row.semanticRole &&
                            ` · ${roles.find(({ value }) => value === row.semanticRole)?.label}`}
                        </div>
                      </div>
                    </div>
                    {kind === 'development' && (
                      <div className={styles.percentField}>
                        <PercentInput
                          label={`${row.name} ART default percentage`}
                          value={draft[row.id] ?? String(row.defaultPct)}
                          disabled={busy || row.recordStatus === 'archived'}
                          onChange={(value) =>
                            setDraft({ ...draft, [row.id]: value })
                          }
                        />
                        <span aria-hidden="true">%</span>
                      </div>
                    )}
                    {!readOnly && (
                      <div className={styles.actions}>
                        {row.recordStatus === 'active' && (
                          <>
                            <button
                              type="button"
                              disabled={busy || index === 0}
                              onClick={() => move(kind, active, index, -1)}
                            >
                              Move up
                            </button>
                            <button
                              type="button"
                              disabled={busy || index === active.length - 1}
                              onClick={() => move(kind, active, index, 1)}
                            >
                              Move down
                            </button>
                          </>
                        )}
                        <RecordActions
                          record={row}
                          resource={resource}
                          writes={writes}
                          edit={() => open(row)}
                          allowDelete={!row.isReferenced}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </section>
            );
          })}
          <MutationError message={writes.errorFor(defaultsPath)} />
          <div className={`${styles.actions} ${styles.allocationFooter}`}>
            <button
              className={styles.primary}
              type="submit"
              disabled={
                busy ||
                !totals.artDefaultsValid ||
                !defaults.some(
                  ({ id, defaultPct }) =>
                    rows.find((row) => row.id === id)?.defaultPct !==
                    defaultPct,
                )
              }
            >
              Save ART defaults
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function TeamAllocationForm({
  view,
  path,
  readOnly,
  writes,
}: {
  view?: TeamPiAllocationView;
  path: string | null;
  readOnly: boolean;
  writes: Writes;
}) {
  const [draft, setDraft] = useState<Draft>({});
  const rows = (view?.items ?? []).map((item) => {
    const input =
      draft[item.categoryId] ??
      (item.overridePct === null ? '' : String(item.overridePct));
    const overridePct = input === '' ? null : percentage(input);
    return {
      ...item,
      input,
      savedOverride: item.overridePct,
      overridePct,
      effectivePct: overridePct ?? item.artDefaultPct,
    };
  });
  const total = rows.reduce((sum, { effectivePct }) => sum + effectivePct, 0);
  const changed = rows.some(
    ({ savedOverride, overridePct }) => savedOverride !== overridePct,
  );
  const busy = readOnly || writes.busy || !rows.length;
  const savePath = `${resource}/allocations`;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || total !== 100 || !view || !changed) return;
    const { teamId, piId } = view;
    const overrides = rows.map(({ categoryId, overridePct }) => ({
      categoryId,
      overridePct,
    }));
    if (
      await writes.write(savePath, 'PUT', { teamId, piId, overrides }, savePath)
    )
      setDraft({});
  }

  return (
    <form onSubmit={save}>
      {view && (
        <div className={styles.allocationSummary}>
          <span>Effective development total</span>
          <Total count={rows.length} total={total} />
        </div>
      )}
      {view?.artConfigStatus === 'invalid' && (
        <p className={styles.driftNotice}>
          ART defaults total {view.artDefaultTotalPct}%. Adjust this Team
          allocation to 100% before saving.
        </p>
      )}
      {view?.hasDriftWarning && (
        <p className={styles.driftNotice} role="status">
          <strong>Drift warning</strong> · Saved allocation totals{' '}
          {view.effectiveTotalPct}%.
        </p>
      )}
      {rows.length > 0 && (
        <table
          className={`${styles.table} ${styles.allocationTable}`}
          aria-label="Team PI development allocation"
        >
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">ART default</th>
              <th scope="col">Team override</th>
              <th scope="col">Effective</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({
                categoryId,
                name,
                color,
                artDefaultPct,
                input,
                effectivePct,
              }) => (
                <tr key={categoryId}>
                  <th scope="row">
                    <span className={styles.categoryIdentity}>
                      <Swatch color={color} />
                      {name}
                    </span>
                  </th>
                  <td className={styles.mono}>{artDefaultPct}%</td>
                  <td>
                    <div
                      className={`${styles.actions} ${styles.overrideControls}`}
                    >
                      <PercentInput
                        label={`${name} override percentage`}
                        value={input}
                        disabled={busy}
                        optional
                        onChange={(value) =>
                          setDraft({ ...draft, [categoryId]: value })
                        }
                      />
                      <span
                        className={
                          input === '' ? styles.inheritBadge : styles.badge
                        }
                      >
                        {input === '' ? 'Inherit' : 'Override'}
                      </span>
                      {input !== '' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            setDraft({ ...draft, [categoryId]: '' })
                          }
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </td>
                  <td className={styles.mono}>
                    {Number.isFinite(effectivePct) ? `${effectivePct}%` : '—'}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
      <MutationError
        message={
          writes.errorFor(savePath) ??
          (path ? writes.errorFor(path) : undefined)
        }
      />
      <div className={`${styles.actions} ${styles.allocationFooter}`}>
        <button
          type="submit"
          className={styles.primary}
          disabled={busy || total !== 100 || !changed}
        >
          Save Team allocation
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (path && (await writes.write(path, 'DELETE', undefined, path)))
              setDraft({});
          }}
        >
          Reset all to ART defaults
        </button>
      </div>
    </form>
  );
}

function TeamPiAllocation({
  train,
  writes,
}: {
  train: RecordState;
  writes: Writes;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const [teamId, setTeam] = useState('');
  const [piId, setPi] = useState('');
  const query = `trainId=${train.id}&includeArchived=${showArchived}`;
  const teams = useRows<RecordState>(`teams?${query}`, 0);
  const pis = useRows<RecordState & { startDate: string; endDate: string }>(
    `pis?${query}`,
    0,
  );
  const team = pickRecord(teams.rows, teamId);
  const today = formatLocalDate(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ).replaceAll('/', '-');
  const pi =
    pis.rows.find(({ id }) => id === piId) ??
    pickCurrentPi(pis.rows, today) ??
    pis.rows[0];
  const path =
    team && pi
      ? `${resource}/allocations?teamId=${team.id}&piId=${pi.id}`
      : null;
  const allocation = useResult<TeamPiAllocationView>(path, writes.revision);
  const readOnly = [train, team, pi].some(
    (record) => record?.recordStatus === 'archived',
  );
  return (
    <section className={styles.card} aria-label="Team PI Allocation">
      <div className={styles.toolbar}>
        <h2>Team PI Allocation</h2>
        {readOnly && <span className={styles.badge}>Archived — read-only</span>}
        <ArchiveToggle
          label="Show archived Teams/PIs"
          checked={showArchived}
          change={setShowArchived}
        />
      </div>
      <div className={`${styles.filters} ${styles.allocationPickers}`}>
        <Picker
          label="Team"
          value={team?.id ?? ''}
          change={setTeam}
          options={recordOptions(teams.rows)}
          placeholder="Select Team"
        />
        <Picker
          label="PI"
          value={pi?.id ?? ''}
          change={setPi}
          options={recordOptions(pis.rows)}
          placeholder="Select PI"
        />
      </div>
      <RowsState data={teams} />
      <RowsState data={pis} />
      <RowsState
        data={allocation}
        empty={
          !path && !teams.loading && !pis.loading && !teams.error && !pis.error
            ? 'Add a Team and PI in this ART to configure allocation.'
            : undefined
        }
      />
      <TeamAllocationForm
        key={path}
        view={allocation.value}
        path={path}
        readOnly={readOnly}
        writes={writes}
      />
    </section>
  );
}

function ArtAllocation({
  train,
  writes,
}: {
  train: RecordState;
  writes: Writes;
}) {
  const [archived, setArchived] = useState(false);
  const catalog = useResult<Catalog>(
    `${resource}?trainId=${train.id}&includeArchived=${archived}`,
    writes.revision,
  );
  return (
    <>
      <ArtWorkCategories
        train={train}
        catalog={catalog}
        archived={archived}
        setArchived={setArchived}
        writes={writes}
      />
      <TeamPiAllocation train={train} writes={writes} />
    </>
  );
}

export function CategoriesAndAllocationPanel({ onMutated }: PanelProps) {
  const [trainId, setTrain] = useState('');
  const trains = useRows<RecordState>('trains?includeArchived=true', 0);
  const writes = useWrites(onMutated);
  const train = pickRecord(trains.rows, trainId);
  return (
    <div className={styles.stack}>
      <div className={styles.filters}>
        <Picker
          label="ART"
          value={train?.id ?? ''}
          change={(value) => {
            writes.clearError();
            setTrain(value);
          }}
          options={recordOptions(trains.rows)}
          placeholder="Select ART"
        />
        <RowsState
          data={trains}
          empty={
            !train
              ? 'Create an ART in ARTs & PI Cadence to configure categories.'
              : undefined
          }
        />
      </div>
      {train && <ArtAllocation key={train.id} train={train} writes={writes} />}
    </div>
  );
}
