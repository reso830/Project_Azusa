export const CATEGORY_KINDS = ['development', 'overhead'] as const;
export const CATEGORY_SEMANTIC_ROLES = [
  'feature',
  'maintenance_bugs',
  'standard',
] as const;

type CategoryKind = (typeof CATEGORY_KINDS)[number];
type SemanticRole = (typeof CATEGORY_SEMANTIC_ROLES)[number];
type RecordStatus = 'active' | 'archived';
export type ArtConfigStatus = 'not_configured' | 'valid' | 'invalid';

type CategoryDefault = {
  kind: CategoryKind;
  recordStatus: RecordStatus;
  defaultPct: number | null;
};

type DevelopmentAllocation = {
  id: string;
  name: string;
  shortLabel: string;
  color: string;
  semanticRole: SemanticRole;
  sortOrder: number;
  defaultPct: number;
};

export type ResolvedCategoryAllocation = Omit<
  DevelopmentAllocation,
  'id' | 'defaultPct'
> & {
  categoryId: string;
  artDefaultPct: number;
  overridePct: number | null;
  effectivePct: number;
  source: 'inherit' | 'override';
};

export type TeamPiAllocationView = {
  trainId: string;
  teamId: string;
  piId: string;
  piEndDate: string;
  isCurrentOrFuturePi: boolean;
  items: ResolvedCategoryAllocation[];
  artConfigStatus: ArtConfigStatus;
  artDefaultTotalPct: number;
  artDefaultsValid: boolean;
  effectiveTotalPct: number;
  isValid: boolean;
  hasDriftWarning: boolean;
};

const REQUIRED_TOTAL = 100;

function summarizeArtDefaults(total: number, count: number) {
  const artDefaultsValid = count > 0 && total === REQUIRED_TOTAL;
  const artConfigStatus: ArtConfigStatus =
    count === 0 ? 'not_configured' : artDefaultsValid ? 'valid' : 'invalid';
  return { artConfigStatus, artDefaultsValid };
}

export function validateArtDefaultTotals(
  categories: readonly CategoryDefault[],
) {
  const active = categories.filter(
    ({ kind, recordStatus }) =>
      kind === 'development' && recordStatus === 'active',
  );
  const activeDevelopmentTotalPct = active.reduce(
    (total, { defaultPct }) => total + (defaultPct ?? 0),
    0,
  );
  return {
    activeDevelopmentTotalPct,
    ...summarizeArtDefaults(activeDevelopmentTotalPct, active.length),
  };
}

export function resolveTeamPiAllocation({
  trainId,
  teamId,
  piId,
  teamRecordStatus,
  piRecordStatus,
  piEndDate,
  today,
  activeDevCategories,
  overridesByCategoryId,
}: {
  trainId: string;
  teamId: string;
  piId: string;
  teamRecordStatus: RecordStatus;
  piRecordStatus: RecordStatus;
  piEndDate: string;
  today: string;
  activeDevCategories: readonly DevelopmentAllocation[];
  overridesByCategoryId: ReadonlyMap<string, number | null>;
}): TeamPiAllocationView {
  const items = [...activeDevCategories]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map<ResolvedCategoryAllocation>(
      ({
        id,
        defaultPct,
        name,
        shortLabel,
        color,
        semanticRole,
        sortOrder,
      }) => {
        const overridePct = overridesByCategoryId.get(id) ?? null;
        return {
          categoryId: id,
          name,
          shortLabel,
          color,
          semanticRole,
          sortOrder,
          artDefaultPct: defaultPct,
          overridePct,
          effectivePct: overridePct ?? defaultPct,
          source: overridePct === null ? 'inherit' : 'override',
        };
      },
    );
  const artDefaultTotalPct = items.reduce(
    (total, item) => total + item.artDefaultPct,
    0,
  );
  const effectiveTotalPct = items.reduce(
    (total, item) => total + item.effectivePct,
    0,
  );
  const isCurrentOrFuturePi = piEndDate >= today;
  const isValid = items.length > 0 && effectiveTotalPct === REQUIRED_TOTAL;
  return {
    trainId,
    teamId,
    piId,
    piEndDate,
    isCurrentOrFuturePi,
    items,
    ...summarizeArtDefaults(artDefaultTotalPct, items.length),
    artDefaultTotalPct,
    effectiveTotalPct,
    isValid,
    hasDriftWarning:
      teamRecordStatus === 'active' &&
      piRecordStatus === 'active' &&
      isCurrentOrFuturePi &&
      items.length > 0 &&
      !isValid,
  };
}

export function validateTeamPiAllocationSave(
  activeDevCategories: readonly Pick<
    DevelopmentAllocation,
    'id' | 'defaultPct'
  >[],
  submittedOverrides: readonly {
    categoryId: string;
    overridePct: number | null;
  }[],
) {
  const activeIds = new Set(activeDevCategories.map(({ id }) => id));
  const overrides = new Map<string, number | null>();
  const duplicateIds = new Set<string>();
  for (const { categoryId, overridePct } of submittedOverrides) {
    if (overrides.has(categoryId)) duplicateIds.add(categoryId);
    overrides.set(categoryId, overridePct);
  }
  const missingCategoryIds = [...activeIds].filter((id) => !overrides.has(id));
  const duplicateCategoryIds = [...duplicateIds];
  const unexpectedCategoryIds = [...overrides.keys()].filter(
    (id) => !activeIds.has(id),
  );
  if (
    missingCategoryIds.length ||
    duplicateCategoryIds.length ||
    unexpectedCategoryIds.length
  ) {
    return {
      isValid: false as const,
      reason: 'category_coverage' as const,
      details: {
        missingCategoryIds,
        duplicateCategoryIds,
        unexpectedCategoryIds,
      },
    };
  }

  const currentTotal = activeDevCategories.reduce(
    (total, category) =>
      total + (overrides.get(category.id) ?? category.defaultPct),
    0,
  );
  if (currentTotal === REQUIRED_TOTAL) {
    return { isValid: true as const };
  }
  return {
    isValid: false as const,
    reason: 'invalid_total' as const,
    details: { currentTotal, requiredTotal: REQUIRED_TOTAL },
  };
}
