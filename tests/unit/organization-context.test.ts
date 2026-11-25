import { expect, it } from 'vitest';
import {
  formatProfileSubtitle,
  pickCurrentPi,
  reconcileActiveContext,
} from '../../src/domain/organization/context';

const today = '2027-02-01';
const pi = { id: 'pi', name: 'PI', startDate: today, endDate: '2027-02-26' };
const old = {
  ...pi,
  id: 'old',
  name: 'Archived',
  recordStatus: 'archived' as const,
};
const team = { id: 'team', name: 'Team' };
const train = { id: 'train', name: 'ART', teams: [old, team], pis: [old, pi] };
const empty = { id: 'empty', name: 'No Team', teams: [old], pis: [pi] };
const otherTeam = { id: 'other-team', name: 'Other Team' };
const other = { id: 'other', name: 'Other', teams: [otherTeam], pis: [] };

it('returns empty context when no active Team belongs to an active ART', () => {
  const selected = reconcileActiveContext(
    [empty, { ...train, recordStatus: 'archived' }],
    null,
    today,
  );
  expect(selected).toEqual({ train: null, team: null, pi: null });
  expect(formatProfileSubtitle(selected)).toBe('No ART or team configured');
});

it('restores a valid selection and falls back within the eligible ART', () => {
  const tree = [empty, train, other];
  expect(
    reconcileActiveContext(
      tree,
      { trainId: other.id, teamId: otherTeam.id },
      today,
    ),
  ).toEqual({ train: other, team: otherTeam, pi: null });
  const fallback = reconcileActiveContext(
    tree,
    {
      trainId: train.id,
      teamId: old.id,
      piId: 'deleted',
    },
    today,
  );
  expect(fallback).toEqual({ train, team, pi });
  expect(formatProfileSubtitle(fallback)).toBe('Team · ART');
  expect(reconcileActiveContext(tree, { trainId: 'deleted' }, today)).toEqual(
    fallback,
  );
});

it('uses the active Team to recover its ART when saved IDs disagree', () => {
  for (const trainId of ['deleted', train.id]) {
    expect(
      reconcileActiveContext(
        [train, other],
        {
          trainId,
          teamId: otherTeam.id,
          piId: pi.id,
        },
        today,
      ),
    ).toEqual({
      train: other,
      team: otherTeam,
      pi: null,
    });
  }
});

const past = {
  ...pi,
  id: 'past',
  startDate: '2027-01-01',
  endDate: '2027-01-29',
};
const future = {
  ...pi,
  id: 'future',
  startDate: '2027-03-01',
  endDate: '2027-03-26',
};
const tree = [{ ...train, pis: [future, old, past, pi] }];

it.each([
  ['2027-02-01', null, 'pi'],
  ['2027-02-26', 'old', 'pi'],
  ['2027-02-27', 'deleted', 'future'],
  ['2027-04-01', null, 'future'],
  ['2027-02-01', 'past', 'past'],
])(
  'selects the appropriate PI on %s with saved ID %s',
  (date, piId, expected) => {
    expect(reconcileActiveContext(tree, { piId }, date).pi?.id).toBe(expected);
  },
);

it('picks the current PI, then the next, then the latest active PI', () => {
  const pis = [future, old, past, pi];
  expect(pickCurrentPi(pis, '2027-01-15')?.id).toBe('past');
  expect(pickCurrentPi(pis, '2027-02-27')?.id).toBe('future');
  expect(pickCurrentPi(pis, '2027-04-01')?.id).toBe('future');
  expect(pickCurrentPi([old], today)).toBeNull();
});
