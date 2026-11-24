'use client';

import { useState } from 'react';
import { MEMBER_ROLES } from '../../domain/organization/roles';
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

type Team = RecordState & {
  trainId: string;
  sprintOffsetWorkdays: number;
  hoursPerDay: number;
};
type Location = RecordState & { code: string };
type Member = Omit<RecordState, 'name'> & {
  fullName: string;
  initials: string;
  nickname: string;
  role: string;
  fteFactor: number;
  avatarColor: string;
  location: Location;
  locationId: string;
  contributesToDevCapacity: boolean;
  pendingMove: {
    teamId: string;
    teamName: string;
    effectiveDate: string;
  } | null;
};
type Editing =
  | { type: 'team'; record?: Team }
  | { type: 'member'; record?: Member }
  | { type: 'move'; record: Member };

export function TeamsAndMembersPanel({ onMutated }: PanelProps) {
  const writes = useWrites(onMutated);
  const [trainId, setTrain] = useState('');
  const [teamId, setTeam] = useState('');
  const [showTeams, setShowTeams] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [editing, setEditing] = useState<Editing>();
  const arts = useRows<RecordState>(
    'trains?includeArchived=true',
    writes.revision,
  );
  const art = arts.rows.find((row) => row.id === trainId) ?? arts.rows[0];
  const teams = useRows<Team>(
    art ? `teams?trainId=${art.id}&includeArchived=${showTeams}` : null,
    writes.revision,
  );
  const team = teams.rows.find((row) => row.id === teamId) ?? teams.rows[0];
  const members = useRows<Member>(
    team ? `members?teamId=${team.id}&includeArchived=${showMembers}` : null,
    writes.revision,
  );
  const locations = useRows<Location>(
    editing?.type === 'member' ? 'locations' : null,
    writes.revision,
  );
  const allTeams = useRows<Team>(
    editing?.type === 'move' ? 'teams' : null,
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
    if (editing.type === 'team') {
      const fields = {
        name: values.name,
        sprintOffsetWorkdays: Number(values.sprintOffsetWorkdays),
      };
      return writes.write(
        id ? `teams/${id}` : 'teams',
        id ? 'PATCH' : 'POST',
        id ? fields : { ...fields, trainId: art?.id },
      );
    }
    if (editing.type === 'move') {
      return writes.write(`members/${editing.record.id}`, 'PATCH', {
        teamId: values.teamId,
        ...(values.effectiveDate && { effectiveDate: values.effectiveDate }),
      });
    }
    const { locationId, ...fields } = values;
    return writes.write(
      id ? `members/${id}` : 'members',
      id ? 'PATCH' : 'POST',
      {
        ...fields,
        fteFactor: Number(values.fteFactor),
        ...(locationId && { locationId }),
        ...(!id && { teamId: team?.id }),
      },
    );
  }

  const editor = editing && (
    <Editor
      key={`${editing.type}-${editing.record?.id ?? 'new'}`}
      title={
        editing.type === 'move'
          ? 'Move Member'
          : `${editing.record ? 'Edit' : 'Add'} ${editing.type === 'team' ? 'Team' : 'Member'}`
      }
      busy={writes.busy}
      error={writes.errorFor()}
      submit={submit}
      close={() => open()}
    >
      {editing.type === 'team' && (
        <>
          <Field
            label="Name"
            name="name"
            value={editing.record?.name}
            required
          />
          <Picker
            label="Sprint offset"
            name="sprintOffsetWorkdays"
            defaultValue={String(editing.record?.sprintOffsetWorkdays ?? 0)}
            options={[
              { value: '-1', label: '−1 working day · lead' },
              { value: '0', label: '0 · aligned' },
              { value: '1', label: '+1 working day · lag' },
            ]}
          />
          <p className={styles.muted}>
            Offsets count Monday–Friday and preserve the ART’s Iteration dates.
          </p>
        </>
      )}
      {editing.type === 'member' && (
        <>
          <Field
            label="Full name"
            name="fullName"
            value={editing.record?.fullName}
            required
          />
          <Field
            label="Nickname"
            name="nickname"
            value={editing.record?.nickname}
          />
          <Field
            label="Initials"
            name="initials"
            value={editing.record?.initials}
            required
          />
          <Picker
            label="Role"
            name="role"
            defaultValue={editing.record?.role ?? 'Team member'}
            options={MEMBER_ROLES.map((role) => ({ value: role, label: role }))}
          />
          <Field
            label="FTE factor"
            name="fteFactor"
            type="number"
            value={editing.record?.fteFactor ?? 1}
            step="any"
            min="0"
            max="1"
            required
          />
          {locations.loading || locations.error ? (
            <RowsState data={locations} />
          ) : (
            <Picker
              label="Location"
              name="locationId"
              required={!editing.record}
              defaultValue={editing.record?.locationId ?? ''}
              placeholder={
                editing.record ? 'Keep existing Location' : 'Select a Location'
              }
              options={locations.rows.map((location) => ({
                value: location.id,
                label: `${location.code} · ${location.name}`,
              }))}
            />
          )}
          <Field
            label="Avatar color"
            name="avatarColor"
            type="color"
            value={editing.record?.avatarColor ?? '#2f62c8'}
          />
        </>
      )}
      {editing.type === 'move' && (
        <>
          {allTeams.loading || allTeams.error ? (
            <RowsState data={allTeams} />
          ) : (
            <Picker
              label="Destination Team"
              name="teamId"
              required
              placeholder="Select a Team"
              defaultValue={editing.record.pendingMove?.teamId ?? ''}
              options={allTeams.rows.map((team) => ({
                value: team.id,
                label: `${team.name} · ${arts.rows.find((art) => art.id === team.trainId)?.name ?? ''}`,
              }))}
            />
          )}
          <Field
            label="Effective date"
            name="effectiveDate"
            type="date"
            value={editing.record.pendingMove?.effectiveDate}
          />
          <p className={styles.muted}>
            Leave the date blank to move today. Cancel a pending move before
            choosing a different date.
          </p>
        </>
      )}
    </Editor>
  );

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-label="Teams">
        <div className={styles.toolbar}>
          <h2>Teams</h2>
          <ArchiveToggle
            checked={showTeams}
            change={(value) => {
              open();
              setShowTeams(value);
            }}
            label="Show archived Teams"
          />
          <AddButton
            label="Add Team"
            disabled={!art || art.recordStatus === 'archived'}
            onClick={() => open({ type: 'team' })}
          />
        </div>
        <RowsState
          data={arts}
          empty={
            !arts.rows.length ? 'Create an ART before adding Teams.' : undefined
          }
        />
        {art && (
          <div className={styles.filters}>
            <Picker
              label="ART"
              value={art.id}
              change={(id) => {
                open();
                setTrain(id);
                setTeam('');
              }}
              options={optionsFor(arts.rows)}
            />
          </div>
        )}
        {editing?.type === 'team' && editor}
        {art && (
          <RowsState
            data={teams}
            empty={
              !teams.rows.length
                ? 'No Teams configured for this ART.'
                : undefined
            }
          />
        )}
        {team && (
          <>
            <div className={styles.filters}>
              <Picker
                label="Team"
                value={team.id}
                change={(id) => {
                  open();
                  setTeam(id);
                }}
                options={optionsFor(teams.rows)}
              />
            </div>
            <div role="group" className={styles.record} aria-label={team.name}>
              <span>
                <strong>{team.name}</strong>{' '}
                <span className={styles.badge}>
                  {displayStatus(team.recordStatus)}
                </span>
                <span className={styles.dates}>
                  {team.hoursPerDay.toFixed(1)} h/day ·{' '}
                  {team.sprintOffsetWorkdays > 0 ? '+' : ''}
                  {team.sprintOffsetWorkdays} working-day offset
                </span>
              </span>
              <RecordActions
                key={team.id}
                record={team}
                resource="teams"
                writes={writes}
                edit={() => open({ type: 'team', record: team })}
              />
            </div>
          </>
        )}
      </section>
      {team && (
        <section className={styles.card} aria-label="Members">
          <div className={styles.toolbar}>
            <h2>Members</h2>
            <ArchiveToggle
              checked={showMembers}
              change={(value) => {
                open();
                setShowMembers(value);
              }}
              label="Show archived Members"
            />
            <AddButton
              label="Add Member"
              disabled={team.recordStatus === 'archived'}
              onClick={() => open({ type: 'member' })}
            />
          </div>
          {editing?.type !== 'team' && editor}
          <RowsState
            data={members}
            empty={
              !members.rows.length
                ? 'No Members assigned to this Team.'
                : undefined
            }
          />
          {members.rows.map((member) => (
            <div
              key={member.id}
              role="group"
              className={styles.record}
              aria-label={member.fullName}
            >
              <span>
                <strong>{member.fullName}</strong>{' '}
                <span className={styles.badge}>{member.role}</span>
                {member.recordStatus === 'archived' && (
                  <span className={styles.badge}>Archived</span>
                )}
                {!member.contributesToDevCapacity && (
                  <span className={styles.badge}>
                    Excluded from dev capacity
                  </span>
                )}
                <span className={styles.dates}>
                  {member.location.code} · {member.fteFactor.toFixed(2)} FTE
                </span>
                {member.pendingMove && (
                  <span className={styles.dates}>
                    Pending move to {member.pendingMove.teamName} ·{' '}
                    {member.pendingMove.effectiveDate}
                  </span>
                )}
              </span>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={writes.busy}
                  onClick={() => open({ type: 'move', record: member })}
                >
                  Move
                </button>
                {member.pendingMove && (
                  <button
                    type="button"
                    disabled={writes.busy}
                    onClick={() => {
                      void writes.write(
                        `members/${member.id}/pending-move`,
                        'DELETE',
                        undefined,
                        `members/${member.id}`,
                      );
                    }}
                  >
                    Cancel pending move
                  </button>
                )}
                <RecordActions
                  record={{ ...member, name: member.fullName }}
                  resource="members"
                  writes={writes}
                  edit={() => open({ type: 'member', record: member })}
                />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
