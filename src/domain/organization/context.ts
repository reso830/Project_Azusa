type ContextRecord = {
  id: string;
  name: string;
  recordStatus?: 'active' | 'archived';
};

type ContextTrain = ContextRecord & {
  teams: readonly ContextRecord[];
  pis: readonly ContextRecord[];
};

type StoredContext = {
  trainId?: string | null;
  teamId?: string | null;
  piId?: string | null;
};

function isActive(record: ContextRecord): boolean {
  return record.recordStatus !== 'archived';
}

function selectActive<T extends ContextRecord>(
  records: readonly T[],
  id?: string | null,
): T | null {
  return (
    records.find((record) => record.id === id && isActive(record)) ??
    records.find(isActive) ??
    null
  );
}

export function reconcileActiveContext<T extends ContextTrain>(
  tree: readonly T[],
  stored?: StoredContext | null,
) {
  const eligibleTrains = tree.filter(
    (record) => isActive(record) && record.teams.some(isActive),
  );
  const train =
    eligibleTrains.find((record) =>
      record.teams.some((team) => team.id === stored?.teamId && isActive(team)),
    ) ?? selectActive(eligibleTrains, stored?.trainId);
  return {
    train,
    team: selectActive(train?.teams ?? [], stored?.teamId),
    pi: selectActive(train?.pis ?? [], stored?.piId),
  };
}

export function formatProfileSubtitle(selected: {
  train: { name: string } | null;
  team: { name: string } | null;
}): string {
  return selected.train && selected.team
    ? `${selected.team.name} · ${selected.train.name}`
    : 'No ART or team configured';
}
