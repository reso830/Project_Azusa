import { describe, expect, it } from 'vitest';
import {
  resolveTeamPiAllocation,
  validateArtDefaultTotals,
  validateTeamPiAllocationSave,
} from '@/domain/categories/rules';
import { SAMPLE_CATEGORY_CATALOG } from '@/domain/categories/sample-catalog';
import {
  ApplySampleCatalogSchema,
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  ReorderCategoriesSchema,
  SaveArtDefaultsSchema,
  SaveTeamPiAllocationSchema,
  TeamPiAllocationQuerySchema,
  UpdateCategorySchema,
} from '@/domain/categories/schemas';

const categories = SAMPLE_CATEGORY_CATALOG.map((category, index) => ({
  ...category,
  id: String(index),
  recordStatus: 'active' as const,
}));
const development = categories.filter(
  (category) => category.kind === 'development',
);
const context = {
  trainId: 'art',
  teamId: 'team',
  piId: 'pi',
  teamRecordStatus: 'active',
  piRecordStatus: 'active',
  piEndDate: '2027-03-12',
  today: '2027-03-12',
  activeDevCategories: development,
} as const;

describe('allocation rules', () => {
  it('distinguishes valid, invalid and not configured ART defaults', () => {
    expect(validateArtDefaultTotals(categories)).toEqual({
      activeDevelopmentTotalPct: 100,
      artConfigStatus: 'valid',
      artDefaultsValid: true,
    });
    for (const adjustment of [-5, 5]) {
      const edited = categories.map((category) =>
        category.id === '0'
          ? { ...category, defaultPct: 49 + adjustment }
          : category,
      );
      expect(validateArtDefaultTotals(edited)).toMatchObject({
        activeDevelopmentTotalPct: 100 + adjustment,
        artConfigStatus: 'invalid',
        artDefaultsValid: false,
      });
    }
    const partiallyArchived = categories.map((category) =>
      category.id === '4'
        ? { ...category, recordStatus: 'archived' as const }
        : category,
    );
    expect(validateArtDefaultTotals(partiallyArchived)).toEqual({
      activeDevelopmentTotalPct: 93,
      artConfigStatus: 'invalid',
      artDefaultsValid: false,
    });
    const archived = categories.map((category) => ({
      ...category,
      recordStatus: 'archived' as const,
    }));
    expect(validateArtDefaultTotals(archived)).toEqual({
      activeDevelopmentTotalPct: 0,
      artConfigStatus: 'not_configured',
      artDefaultsValid: false,
    });
  });

  it('resolves in presentation order and distinguishes zero from inheritance', () => {
    const resolve = (
      overridesByCategoryId: ReadonlyMap<string, number | null>,
    ) =>
      resolveTeamPiAllocation({
        ...context,
        activeDevCategories: [...development].reverse(),
        overridesByCategoryId,
      });
    expect(resolve(new Map()).items.map((item) => item.effectivePct)).toEqual([
      49, 20, 14, 10, 7,
    ]);
    const zero = resolve(
      new Map([
        ['0', 63],
        ['1', 15],
        ['3', 8],
        ['4', 0],
      ]),
    );
    expect(zero.items.map((item) => item.effectivePct)).toEqual([
      63, 15, 14, 8, 0,
    ]);
    expect(zero.items[4]).toMatchObject({ overridePct: 0, source: 'override' });
    const inherited = resolve(
      new Map([
        ['0', 56],
        ['1', 15],
        ['3', 8],
        ['4', null],
      ]),
    );
    expect(inherited.items.map((item) => item.effectivePct)).toEqual([
      56, 15, 14, 8, 7,
    ]);
    expect(inherited.items[4]).toMatchObject({
      overridePct: null,
      source: 'inherit',
    });
  });

  it('warns only for invalid splits on active Teams and active current or future PIs', () => {
    const activeDevCategories = development.map((category, index) => ({
      ...category,
      defaultPct: [45, 20, 18, 10, 7][index]!,
    }));
    const input = {
      ...context,
      activeDevCategories,
      overridesByCategoryId: new Map([
        ['0', 56],
        ['1', 15],
        ['3', 8],
      ]),
    };
    expect(resolveTeamPiAllocation(input)).toMatchObject({
      effectiveTotalPct: 104,
      isValid: false,
      hasDriftWarning: true,
    });
    for (const status of [
      { today: '2027-03-13' },
      { teamRecordStatus: 'archived' },
      { piRecordStatus: 'archived' },
    ] as const) {
      expect(resolveTeamPiAllocation({ ...input, ...status })).toMatchObject({
        effectiveTotalPct: 104,
        isValid: false,
        hasDriftWarning: false,
      });
    }
    expect(
      resolveTeamPiAllocation({
        ...input,
        activeDevCategories: development.map((category) =>
          category.id === '0' ? { ...category, defaultPct: 37 } : category,
        ),
        overridesByCategoryId: new Map(),
      }),
    ).toMatchObject({
      effectiveTotalPct: 88,
      artDefaultsValid: false,
      hasDriftWarning: true,
    });
    expect(
      resolveTeamPiAllocation({ ...input, activeDevCategories: [] }),
    ).toMatchObject({
      artConfigStatus: 'not_configured',
      isValid: false,
      hasDriftWarning: false,
    });
  });

  it('requires exact coverage and a 100% resolved total to save', () => {
    const overrides = development.map(({ id }) => ({
      categoryId: id,
      overridePct: null,
    }));
    expect(validateTeamPiAllocationSave(development, overrides)).toMatchObject({
      isValid: true,
    });
    expect(
      validateTeamPiAllocationSave(development, overrides.slice(1)),
    ).toEqual({
      isValid: false,
      reason: 'category_coverage',
      details: {
        missingCategoryIds: ['0'],
        duplicateCategoryIds: [],
        unexpectedCategoryIds: [],
      },
    });
    expect(
      validateTeamPiAllocationSave(development, [...overrides, overrides[0]!]),
    ).toEqual({
      isValid: false,
      reason: 'category_coverage',
      details: {
        missingCategoryIds: [],
        duplicateCategoryIds: ['0'],
        unexpectedCategoryIds: [],
      },
    });
    expect(
      validateTeamPiAllocationSave(development, [
        ...overrides.slice(1),
        { categoryId: 'unexpected', overridePct: null },
      ]),
    ).toEqual({
      isValid: false,
      reason: 'category_coverage',
      details: {
        missingCategoryIds: ['0'],
        duplicateCategoryIds: [],
        unexpectedCategoryIds: ['unexpected'],
      },
    });
    expect(
      validateTeamPiAllocationSave(
        development,
        overrides.map((entry) =>
          entry.categoryId === '0' ? { ...entry, overridePct: 44 } : entry,
        ),
      ),
    ).toEqual({
      isValid: false,
      reason: 'invalid_total',
      details: { currentTotal: 95, requiredTotal: 100 },
    });
  });
});

it('defines the approved starter catalog and group order', () => {
  expect(
    development.map(({ semanticRole, defaultPct, sortOrder }) => [
      semanticRole,
      defaultPct,
      sortOrder,
    ]),
  ).toEqual([
    ['feature', 49, 0],
    ['maintenance_bugs', 20, 1],
    ['standard', 14, 2],
    ['standard', 10, 3],
    ['standard', 7, 4],
  ]);
  expect(development[0]?.shortLabel).toBe('Feature dev.');
  expect(
    categories
      .filter(({ kind }) => kind === 'overhead')
      .map(({ defaultPct, semanticRole, sortOrder }) => [
        defaultPct,
        semanticRole,
        sortOrder,
      ]),
  ).toEqual([
    [null, null, 0],
    [null, null, 1],
  ]);
});

describe('category request schemas', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const pair = { teamId: id, piId: id };
  const category = {
    trainId: id,
    name: ' Feature ',
    shortLabel: ' FD ',
    color: '#2E8B57',
    kind: 'development',
    semanticRole: 'feature',
  };

  it('parses supported payloads and rejects extra fields at each boundary', () => {
    const examples = [
      [ListCategoriesQuerySchema, { trainId: id, includeArchived: 'false' }],
      [TeamPiAllocationQuerySchema, pair],
      [CreateCategorySchema, category],
      [UpdateCategorySchema, { shortLabel: 'Dev' }],
      [
        ReorderCategoriesSchema,
        { trainId: id, kind: 'overhead', orderedIds: [id] },
      ],
      [ApplySampleCatalogSchema, { trainId: id }],
      [
        SaveArtDefaultsSchema,
        { trainId: id, allocations: [{ categoryId: id, defaultPct: 100 }] },
      ],
      [
        SaveTeamPiAllocationSchema,
        { ...pair, overrides: [{ categoryId: id, overridePct: 0 }] },
      ],
    ] as const;
    for (const [schema, example] of examples) {
      expect(schema.safeParse(example).success).toBe(true);
      for (const field of ['actor', 'createdBy', 'updatedBy', 'unknown']) {
        expect(
          schema.safeParse({ ...example, [field]: 'injected' }).success,
        ).toBe(false);
      }
    }
    expect(CreateCategorySchema.parse(category)).toMatchObject({
      name: 'Feature',
      shortLabel: 'FD',
    });
    expect(
      ListCategoriesQuerySchema.parse(examples[0][1]).includeArchived,
    ).toBe(false);
  });

  it('rejects ART and default percentage changes in a category patch', () => {
    expect(UpdateCategorySchema.safeParse({ trainId: id }).success).toBe(false);
    expect(UpdateCategorySchema.safeParse({ defaultPct: 0 }).success).toBe(
      false,
    );
  });

  it('uses plain validation messages for labels, colors and percentages', () => {
    const metadataError = CreateCategorySchema.safeParse({
      ...category,
      name: ' ',
      shortLabel: ' ',
      color: '#fff',
    }).error;
    expect(metadataError?.issues.map(({ message }) => message)).toEqual([
      'Enter a value',
      'Enter a value',
      'Enter a color such as #2F62C8',
    ]);
    for (const value of [12.5, -1, 101, '0']) {
      const error = SaveArtDefaultsSchema.safeParse({
        trainId: id,
        allocations: [{ categoryId: id, defaultPct: value }],
      }).error;
      expect(error?.issues[0]?.message).toBe(
        'Enter a whole number from 0 to 100',
      );
    }
  });

  it('rejects invalid IDs, metadata, group ordering, and percentages', () => {
    for (const patch of [
      { trainId: 'bad' },
      { name: ' ' },
      { shortLabel: '' },
      { color: '#fff' },
      { defaultPct: 0 },
      { kind: 'overhead' },
      { semanticRole: null },
    ]) {
      expect(
        CreateCategorySchema.safeParse({ ...category, ...patch }).success,
      ).toBe(false);
    }
    expect(
      CreateCategorySchema.safeParse({
        ...category,
        kind: 'overhead',
        semanticRole: null,
      }).success,
    ).toBe(true);
    for (const orderedIds of [[], [id, id]]) {
      expect(
        ReorderCategoriesSchema.safeParse({
          trainId: id,
          kind: 'overhead',
          orderedIds,
        }).success,
      ).toBe(false);
    }
    for (const pct of [12.5, -1, 101, '0']) {
      expect(
        SaveArtDefaultsSchema.safeParse({
          trainId: id,
          allocations: [{ categoryId: id, defaultPct: pct }],
        }).success,
      ).toBe(false);
      expect(
        SaveTeamPiAllocationSchema.safeParse({
          ...pair,
          overrides: [{ categoryId: id, overridePct: pct }],
        }).success,
      ).toBe(false);
    }
    expect(
      SaveTeamPiAllocationSchema.safeParse({
        ...pair,
        overrides: [{ categoryId: id, overridePct: null, actor: 'injected' }],
      }).success,
    ).toBe(false);
  });
});
