import { expect, it } from 'vitest';
import {
  formatProfileSubtitle,
  reconcileActiveContext,
} from '../../src/domain/organization/context';

const old = { id: 'old', name: 'Archived', recordStatus: 'archived' as const };
const team = { id: 'team', name: 'Team' };
const pi = { id: 'pi', name: 'PI' };
const train = { id: 'train', name: 'ART', teams: [old, team], pis: [old, pi] };
const empty = { id: 'empty', name: 'No Team', teams: [old], pis: [pi] };
const otherTeam = { id: 'other-team', name: 'Other Team' };
const other = { id: 'other', name: 'Other', teams: [otherTeam], pis: [] };

it('returns empty context when no active Team belongs to an active ART', () => {
  const selected = reconcileActiveContext(
    [empty, { ...train, recordStatus: 'archived' }],
    null,
  );
  expect(selected).toEqual({ train: null, team: null, pi: null });
  expect(formatProfileSubtitle(selected)).toBe('No ART or team configured');
});

it('restores a valid selection and falls back within the eligible ART', () => {
  const tree = [empty, train, other];
  expect(
    reconcileActiveContext(tree, { trainId: other.id, teamId: otherTeam.id }),
  ).toEqual({ train: other, team: otherTeam, pi: null });
  const fallback = reconcileActiveContext(tree, {
    trainId: train.id,
    teamId: old.id,
    piId: 'deleted',
  });
  expect(fallback).toEqual({ train, team, pi });
  expect(formatProfileSubtitle(fallback)).toBe('Team · ART');
  expect(reconcileActiveContext(tree, { trainId: 'deleted' })).toEqual(
    fallback,
  );
});

it('uses the active Team to recover its ART when saved IDs disagree', () => {
  for (const trainId of ['deleted', train.id]) {
    expect(
      reconcileActiveContext([train, other], {
        trainId,
        teamId: otherTeam.id,
        piId: pi.id,
      }),
    ).toEqual({
      train: other,
      team: otherTeam,
      pi: null,
    });
  }
});
