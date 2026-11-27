import type { TeamPiAllocationView } from '../categories/rules';
import type { SprintCategoryBudget } from './types';

export function calculateSprintCategoryBudgets(
  forecastSpDisplay: number | null,
  forecastSpRaw: number | null,
  allocation: TeamPiAllocationView,
): SprintCategoryBudget[] | null {
  if (!allocation.isValid || forecastSpDisplay === null) return null;
  const candidates = allocation.items.map(
    ({ categoryId, sortOrder, effectivePct }) => {
      const numerator = forecastSpDisplay * effectivePct;
      return {
        sortOrder,
        remainder: numerator % 100,
        budget: {
          categoryId,
          budgetSpDisplay: Math.floor(numerator / 100),
          budgetSpRaw:
            forecastSpRaw === null
              ? null
              : (forecastSpRaw * effectivePct) / 100,
        },
      };
    },
  );
  const leftover =
    forecastSpDisplay -
    candidates.reduce((sum, { budget }) => sum + budget.budgetSpDisplay, 0);
  const ranked = [...candidates].sort(
    (a, b) =>
      b.remainder - a.remainder ||
      a.sortOrder - b.sortOrder ||
      a.budget.categoryId.localeCompare(b.budget.categoryId),
  );
  for (const { budget } of ranked.slice(0, leftover))
    budget.budgetSpDisplay += 1;
  return candidates.map(({ budget }) => budget);
}

export function aggregatePiCategoryBudgets(
  sprints: readonly (readonly SprintCategoryBudget[] | null)[],
): SprintCategoryBudget[] | null {
  if (sprints.some((sprint) => sprint === null)) return null;
  const totals = new Map<string, SprintCategoryBudget>();
  for (const sprint of sprints) {
    for (const budget of sprint ?? []) {
      const prior = totals.get(budget.categoryId);
      totals.set(
        budget.categoryId,
        prior
          ? {
              categoryId: budget.categoryId,
              budgetSpRaw:
                prior.budgetSpRaw === null || budget.budgetSpRaw === null
                  ? null
                  : prior.budgetSpRaw + budget.budgetSpRaw,
              budgetSpDisplay:
                prior.budgetSpDisplay === null ||
                budget.budgetSpDisplay === null
                  ? null
                  : prior.budgetSpDisplay + budget.budgetSpDisplay,
            }
          : { ...budget },
      );
    }
  }
  return [...totals.values()];
}
