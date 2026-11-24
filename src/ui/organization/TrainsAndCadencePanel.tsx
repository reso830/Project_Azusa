'use client';

import { useState } from 'react';
import { suggestYywwName } from '../../domain/organization/cadence';
import {
  AddButton,
  ArchiveToggle,
  Editor,
  Field,
  Picker,
  RecordActions,
  RowsState,
  displayStatus,
  optionsFor,
  useRows,
  useWrites,
  type PanelProps,
  type RecordState,
} from './controls';
import styles from './organization.module.css';

type Pi = RecordState & {
  startDate: string;
  endDate: string;
  lifecycleStatus: string;
};
type Iteration = {
  id: string;
  name: string;
  kind: string;
  startDate: string;
  endDate: string;
  teamSchedule?: { scheduledStartDate: string; scheduledEndDate: string };
};
type Editing =
  | { type: 'art'; record?: RecordState }
  | { type: 'pi'; record?: Pi }
  | { type: 'iteration'; record?: Iteration };

function IterationFields({ record }: { record?: Iteration }) {
  const [name, setName] = useState(record?.name ?? '');
  const [end, setEnd] = useState(record?.endDate ?? '');
  return (
    <>
      <label className={styles.field}>
        Name
        <input
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <Picker
        label="Iteration kind"
        name="kind"
        defaultValue={record?.kind ?? 'development'}
        options={[
          { value: 'development', label: 'Development' },
          { value: 'ip', label: 'IP' },
        ]}
      />
      <Field
        label="Start date"
        name="startDate"
        type="date"
        value={record?.startDate}
        required
      />
      <label className={styles.field}>
        End date
        <input
          type="date"
          name="endDate"
          required
          value={end}
          onChange={(event) => setEnd(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => setName(suggestYywwName(end))}
        disabled={!/^\d{4}-\d{2}-\d{2}$/.test(end)}
      >
        Suggest YYWW
      </button>
    </>
  );
}

export function TrainsAndCadencePanel({ onMutated }: PanelProps) {
  const writes = useWrites(onMutated);
  const [archivedArts, setArchivedArts] = useState(false);
  const [archivedPis, setArchivedPis] = useState(false);
  const [trainId, setTrain] = useState('');
  const [piId, setPi] = useState('');
  const [previewId, setPreview] = useState('');
  const [editing, setEditing] = useState<Editing>();
  const arts = useRows<RecordState>(
    `trains?includeArchived=${archivedArts}`,
    writes.revision,
  );
  const art = arts.rows.find((row) => row.id === trainId) ?? arts.rows[0];
  const pis = useRows<Pi>(
    art ? `pis?trainId=${art.id}&includeArchived=${archivedPis}` : null,
    writes.revision,
  );
  const pi = pis.rows.find((row) => row.id === piId) ?? pis.rows[0];
  const teams = useRows<RecordState>(
    art ? `teams?trainId=${art.id}` : null,
    writes.revision,
  );
  const preview = teams.rows.find((team) => team.id === previewId);
  const iterations = useRows<Iteration>(
    pi
      ? `pis/${pi.id}/iterations${preview ? `?teamId=${preview.id}` : ''}`
      : null,
    writes.revision,
  );

  function open(editor?: Editing) {
    writes.clearError();
    setEditing(editor);
  }

  function submit(data: FormData) {
    if (!editing) return Promise.resolve(false);
    const values = Object.fromEntries(data);
    const id = editing.record?.id;
    switch (editing.type) {
      case 'art':
        return writes.write(
          id ? `trains/${id}` : 'trains',
          id ? 'PATCH' : 'POST',
          values,
        );
      case 'pi':
        return writes.write(
          id ? `pis/${id}` : 'pis',
          id ? 'PATCH' : 'POST',
          id ? values : { ...values, trainId: art?.id },
        );
      case 'iteration':
        return writes.write(
          id ? `iterations/${id}` : `pis/${pi?.id}/iterations`,
          id ? 'PATCH' : 'POST',
          values,
        );
    }
  }

  const editor = editing && (
    <Editor
      key={`${editing.type}-${editing.record?.id ?? 'new'}`}
      title={`${editing.record ? 'Edit' : 'Add'} ${editing.type === 'art' ? 'ART' : editing.type === 'pi' ? 'PI' : 'Iteration'}`}
      busy={writes.busy}
      error={writes.errorFor()}
      submit={submit}
      close={() => open()}
    >
      {editing.type === 'iteration' ? (
        <IterationFields record={editing.record} />
      ) : (
        <>
          <Field
            label="Name"
            name="name"
            required
            value={editing.record?.name}
          />
          {editing.type === 'pi' && (
            <>
              <Field
                label="Start date"
                name="startDate"
                type="date"
                required
                value={editing.record?.startDate}
              />
              <Field
                label="End date"
                name="endDate"
                type="date"
                required
                value={editing.record?.endDate}
              />
            </>
          )}
        </>
      )}
    </Editor>
  );

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-label="ARTs">
        <div className={styles.toolbar}>
          <h2>ARTs</h2>
          <ArchiveToggle
            checked={archivedArts}
            change={(value) => {
              open();
              setArchivedArts(value);
            }}
            label="Show archived ARTs"
          />
          <AddButton label="Add ART" onClick={() => open({ type: 'art' })} />
        </div>
        {editing?.type === 'art' && editor}
        <RowsState
          data={arts}
          empty={!arts.rows.length ? 'No ARTs configured.' : undefined}
        />
        {art && (
          <>
            <div className={styles.filters}>
              <Picker
                label="ART"
                value={art.id}
                change={(id) => {
                  open();
                  setTrain(id);
                  setPi('');
                  setPreview('');
                }}
                options={optionsFor(arts.rows)}
              />
            </div>
            <div role="group" className={styles.record} aria-label={art.name}>
              <span>
                <strong>{art.name}</strong>{' '}
                <span className={styles.badge}>
                  {displayStatus(art.recordStatus)}
                </span>
              </span>
              <RecordActions
                key={art.id}
                record={art}
                resource="trains"
                writes={writes}
                edit={() => open({ type: 'art', record: art })}
              />
            </div>
          </>
        )}
      </section>
      {art && (
        <section className={styles.card} aria-label="Program increments">
          <div className={styles.toolbar}>
            <h2>Program increments</h2>
            <ArchiveToggle
              checked={archivedPis}
              change={(value) => {
                open();
                setArchivedPis(value);
              }}
              label="Show archived PIs"
            />
            <AddButton
              label="Add PI"
              disabled={art.recordStatus === 'archived'}
              onClick={() => open({ type: 'pi' })}
            />
          </div>
          {editing?.type === 'pi' && editor}
          <RowsState
            data={pis}
            empty={
              !pis.rows.length ? 'No PIs configured for this ART.' : undefined
            }
          />
          {pi && (
            <>
              <div className={styles.filters}>
                <Picker
                  label="PI"
                  value={pi.id}
                  change={(id) => {
                    open();
                    setPi(id);
                  }}
                  options={optionsFor(pis.rows)}
                />
              </div>
              <div role="group" className={styles.record} aria-label={pi.name}>
                <span>
                  <strong>{pi.name}</strong>{' '}
                  <span className={styles.badge}>
                    {displayStatus(pi.lifecycleStatus)}
                  </span>
                  {pi.recordStatus === 'archived' && (
                    <span className={styles.badge}>Archived</span>
                  )}
                  <span className={styles.dates}>
                    {pi.startDate} – {pi.endDate}
                  </span>
                </span>
                <RecordActions
                  key={pi.id}
                  record={pi}
                  resource="pis"
                  writes={writes}
                  edit={() => open({ type: 'pi', record: pi })}
                />
              </div>
            </>
          )}
        </section>
      )}
      {pi && (
        <section className={styles.card} aria-label="Iterations">
          <div className={styles.toolbar}>
            <h2>Iterations</h2>
            <AddButton
              label="Add Iteration"
              disabled={pi.recordStatus === 'archived'}
              onClick={() => open({ type: 'iteration' })}
            />
          </div>
          {teams.rows.length > 0 && (
            <div className={styles.filters}>
              <Picker
                label="Team schedule preview"
                value={preview?.id ?? ''}
                change={setPreview}
                options={optionsFor(teams.rows)}
                placeholder="Canonical ART dates only"
              />
            </div>
          )}
          {editing?.type === 'iteration' && editor}
          <RowsState
            data={iterations}
            empty={
              !iterations.rows.length
                ? 'No Iterations configured for this PI.'
                : undefined
            }
          />
          {iterations.rows.map((iteration) => (
            <div
              key={iteration.id}
              role="group"
              className={styles.record}
              aria-label={iteration.name}
            >
              <span>
                <strong>{iteration.name}</strong>{' '}
                <span className={styles.badge}>
                  {iteration.kind === 'ip' ? 'IP' : 'Development'}
                </span>
                <span className={styles.dates}>
                  ART: {iteration.startDate} – {iteration.endDate}
                </span>
                {iteration.teamSchedule && (
                  <span className={styles.dates}>
                    Team: {iteration.teamSchedule.scheduledStartDate} –{' '}
                    {iteration.teamSchedule.scheduledEndDate}
                  </span>
                )}
              </span>
              <RecordActions
                record={iteration}
                resource="iterations"
                writes={writes}
                edit={() => open({ type: 'iteration', record: iteration })}
              />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
