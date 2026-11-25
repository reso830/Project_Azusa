type ContextRecord = {
  id: string;
  name: string;
  recordStatus?: 'active' | 'archived';
};

type ContextTrain = ContextRecord & {
  teams: readonly ContextRecord[];
  pis: readonly (ContextRecord & { startDate: string; endDate: string })[];
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

/** First active PI by start date that has not ended, else the latest active PI. */
export function pickCurrentPi<
  T extends ContextRecord & { startDate: string; endDate: string },
>(pis: readonly T[], today: string): T | null {
  const active = pis
    .filter(isActive)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return active.find((pi) => pi.endDate >= today) ?? active.at(-1) ?? null;
}

export function reconcileActiveContext<T extends ContextTrain>(
  tree: readonly T[],
  stored: StoredContext | null,
  today: string,
) {
  const eligibleTrains = tree.filter(
    (record) => isActive(record) && record.teams.some(isActive),
  );
  const train =
    eligibleTrains.find((record) =>
      record.teams.some((team) => team.id === stored?.teamId && isActive(team)),
    ) ?? selectActive(eligibleTrains, stored?.trainId);
  const pis = train?.pis ?? [];
  return {
    train,
    team: selectActive(train?.teams ?? [], stored?.teamId),
    pi:
      pis.find((pi) => pi.id === stored?.piId && isActive(pi)) ??
      pickCurrentPi(pis, today),
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
