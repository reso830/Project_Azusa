import type { CapacityEngineInput } from '@/domain/capacity/types';
import { resolveTeamPiAllocation } from '@/domain/categories/rules';
import { SAMPLE_CATEGORY_CATALOG } from '@/domain/categories/sample-catalog';

export function capacityGoldenFixture(adjusted = false): CapacityEngineInput {
  const today = '2027-02-05';
  const team = {
    id: 'palawan',
    trainId: 'payments',
    trainName: 'Payments ART',
    name: 'Palawan',
    trainRecordStatus: 'active',
    recordStatus: 'active',
    hoursPerDay: 8,
    sprintOffsetWorkdays: 0,
    deductionMode: 'fixed_days',
    seedNormalizedVelocity: 0.92,
  } as const;
  const pi = {
    id: 'pi-2027.1',
    name: 'PI-2027.1',
    trainId: team.trainId,
    startDate: '2027-01-04',
    endDate: '2027-03-12',
    lifecycleStatus: 'planning',
    recordStatus: 'active',
  } as const;
  const iterations: CapacityEngineInput['iterations'] = (
    [
      ['2702', '01-04', '01-15'],
      ['2704', '01-18', '01-29'],
      ['2706', '02-01', '02-12'],
      ['2708', '02-15', '02-26'],
      ['2710', '03-01', '03-12'],
    ] as const
  ).map(([id, start, end]) => ({
    id,
    piId: pi.id,
    name: id,
    kind: id === '2710' ? 'ip' : 'development',
    startDate: `2027-${start}`,
    endDate: `2027-${end}`,
  }));
  const locations = {
    PH: ['Philippines', 'Asia/Manila'],
    SG: ['Singapore', 'Asia/Singapore'],
    'AU-WA': ['Western Australia', 'Australia/Perth'],
    IN: ['India', 'Asia/Kolkata'],
    UK: ['United Kingdom', 'Europe/London'],
    'US-TX': ['Texas', 'America/Chicago'],
  } as const;
  const members: CapacityEngineInput['members'] = (
    [
      ['andrea', 'Andrea Santos', 'PH', 1, 'Team member', '#2F62C8'],
      ['ben', 'Ben Cruz', 'PH', 1, 'Team member', '#11806F'],
      ['carlo', 'Carlo Reyes', 'SG', 1, 'Team member', '#7A4CC2'],
      ['dana', 'Dana Lim', 'AU-WA', 1, 'Team member', '#B8407E'],
      ['enzo', 'Enzo Garcia', 'IN', 1, 'Team member', '#C93A3A'],
      ['faye', 'Faye Tan', 'UK', 1, 'Team member', '#5C7A1F'],
      ['gio', 'Gio Mendoza', 'US-TX', 1, 'Team member', '#A65307'],
      ['hana', 'Hana Villanueva', 'PH', 0.5, 'Team member', '#5F6F86'],
      ['sm', 'Maya Santos', 'PH', 1, 'SM', null],
      ['po', 'Pat Reyes', 'PH', 1, 'PO', null],
    ] as const
  ).map(([memberId, fullName, code, fteFactor, role, avatarColor]) => ({
    memberId,
    fullName,
    fteFactor,
    role,
    avatarColor,
    nickname: null,
    initials: fullName
      .split(' ')
      .map((name) => name[0])
      .join(''),
    recordStatus: 'active',
    location: {
      id: code,
      code,
      name: locations[code][0],
      timeZone: locations[code][1],
    },
  }));
  const holidays: CapacityEngineInput['holidays'] = (
    [
      ['PH', '02-25', 'EDSA Revolution Anniversary', true],
      ['SG', '02-08', 'Chinese New Year (in lieu)', true],
      ['SG', '03-10', 'Hari Raya Puasa', false],
      ['AU-WA', '01-26', 'Australia Day', true],
      ['AU-WA', '03-01', 'Labour Day', true],
      ['IN', '01-26', 'Republic Day', true],
      ['US-TX', '01-18', 'Martin Luther King Jr. Day', true],
      ['US-TX', '02-15', 'Presidents’ Day', true],
    ] as const
  ).map(([locationId, date, name, confirmed]) => ({
    id: `${locationId}-${date}`,
    locationId,
    date: `2027-${date}`,
    name,
    confirmed,
    portion: 'full',
    source: 'manual',
  }));
  const absenceDates = {
    andrea: ['01-19', '01-20', '03-02'],
    ben: ['01-06', '02-16', '02-17', '02-18'],
    carlo: ['02-04', '02-05'],
    enzo: ['01-07', '01-08', '02-09'],
    faye: ['02-19'],
    gio: ['01-20', '01-21', '01-22', '03-04', '03-05'],
  };
  const absences: CapacityEngineInput['absences'] = Object.entries(
    absenceDates,
  ).flatMap(([memberId, dates]) =>
    dates.map((date) => ({
      id: `${memberId}-${date}`,
      memberId,
      date: `2027-${date}`,
      name:
        memberId === 'enzo' && date === '02-09' ? 'Sick leave' : 'Annual leave',
      portion: 'full',
      status: 'active',
      affectsCapacity: true,
    })),
  );
  const activeDevCategories = SAMPLE_CATEGORY_CATALOG.filter(
    (category) => category.kind === 'development',
  ).map((category) => ({ ...category, id: `dev-${category.sortOrder}` }));
  const overheadCategories = SAMPLE_CATEGORY_CATALOG.filter(
    (category) => category.kind === 'overhead',
  ).map(({ name, shortLabel, color, sortOrder }) => ({
    categoryId: sortOrder === 0 ? 'gw' : 'training',
    name,
    shortLabel,
    color,
    sortOrder,
    recordStatus: 'active' as const,
  }));
  const overheadDeductions: CapacityEngineInput['overheadDeductions'] = members
    .filter(({ role }) => role === 'Team member')
    .flatMap(({ memberId }) =>
      iterations.flatMap(({ id: iterationId }) =>
        [
          {
            categoryId: 'gw',
            deductedHours:
              adjusted && memberId === 'carlo' && iterationId === '2706'
                ? 4
                : 8,
          },
          { categoryId: 'training', deductedHours: 4 },
        ].map((deduction) => ({
          ...deduction,
          memberId,
          iterationId,
          teamId: team.id,
          source: 'pi_plan' as const,
        })),
      ),
    );
  return {
    today,
    team,
    pi,
    iterations,
    members,
    holidays,
    absences,
    overheadCategories,
    overheadDeductions,
    assignments: members.map(({ memberId }) => ({
      memberId,
      teamId: team.id,
      startDate: pi.startDate,
      endDate: null,
    })),
    allocation: resolveTeamPiAllocation({
      trainId: team.trainId,
      teamId: team.id,
      piId: pi.id,
      piEndDate: pi.endDate,
      today,
      teamRecordStatus: team.recordStatus,
      piRecordStatus: pi.recordStatus,
      activeDevCategories,
      overridesByCategoryId: new Map(
        [56, 15, 14, 8, 7].map((pct, index) => [`dev-${index}`, pct]),
      ),
    }),
  };
}
