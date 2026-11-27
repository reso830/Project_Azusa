import type {
  ResolvedCategoryAllocation,
  TeamPiAllocationView,
} from '../categories/rules';
import type { TeamIterationSchedule } from '../organization/cadence';
import type { MemberRole } from '../organization/roles';

export type DeductionMode = 'fixed_days' | 'percent';
export type OverheadDeductionSource = 'pi_plan' | 'sprint_adjusted';
export type VelocitySource =
  | 'sprint_override'
  | 'pi_override'
  | 'rolling_4_sprint'
  | 'rolling_partial'
  | 'manual_seed'
  | 'unset';
export type ResolvedVelocity = {
  value: number | null;
  source: VelocitySource;
  sprintCountUsed: number;
  totalCompletedSp: number | null;
  totalActualDevDays: number | null;
  piOverrideValue: number | null;
  seedValue: number | null;
};
export type LoadThresholds = { underMax: number; overMin: number };
export type LoadBand = 'amber' | 'green' | 'red' | 'none';
export type LoadResult = {
  plannedSp: number;
  forecastSp: number;
  loadPct: number | null;
  band: LoadBand;
};
export type CompletedSprintHistoryEntry = {
  iterationId: string;
  endDate: string;
  kind: TeamIterationSchedule['kind'];
  completedDevelopmentSp: number;
  actualDevelopmentDays: number;
};

type RecordStatus = 'active' | 'archived';
type Team = {
  id: string;
  name: string;
  trainId: string;
  trainName: string;
  trainRecordStatus: RecordStatus;
  recordStatus: RecordStatus;
  hoursPerDay: number;
  sprintOffsetWorkdays: TeamIterationSchedule['offsetWorkdays'];
  deductionMode: DeductionMode;
  seedNormalizedVelocity: number | null;
};
type Pi = {
  id: string;
  trainId: string;
  name: string;
  startDate: string;
  endDate: string;
  lifecycleStatus: 'planning' | 'in_progress' | 'closed';
  recordStatus: RecordStatus;
};
type Location = { id: string; code: string; name: string; timeZone: string };
type Member = {
  memberId: string;
  fullName: string;
  nickname: string | null;
  initials: string;
  role: MemberRole;
  fteFactor: number;
  avatarColor: string | null;
  recordStatus: RecordStatus;
  location: Location;
};
type Assignment = {
  memberId: string;
  teamId: string;
  startDate: string;
  endDate: string | null;
};
type Holiday = {
  id: string;
  locationId: string;
  date: string;
  name: string;
  portion: 'full' | 'half';
  source: 'library' | 'company' | 'manual';
  confirmed: boolean;
};
type Absence = {
  id: string;
  memberId: string;
  date: string;
  name: string;
  portion: 'full' | 'am' | 'pm';
  status: 'active' | 'cancelled';
  affectsCapacity: boolean;
};
type OverheadCategory = {
  categoryId: string;
  name: string;
  shortLabel: string;
  color: string;
  sortOrder: number;
  recordStatus: RecordStatus;
};
type OverheadDeduction = {
  teamId: string;
  memberId: string;
  iterationId: string;
  categoryId: string;
  deductedHours: number;
  source: OverheadDeductionSource;
};

export type CapacityEngineInput = {
  today: string;
  team: Team;
  pi: Pi;
  iterations: readonly {
    id: string;
    piId: string;
    name: string;
    kind: TeamIterationSchedule['kind'];
    startDate: string;
    endDate: string;
  }[];
  members: readonly Member[];
  assignments: readonly Assignment[];
  holidays: readonly Holiday[];
  absences: readonly Absence[];
  overheadCategories: readonly OverheadCategory[];
  overheadDeductions: readonly OverheadDeduction[];
  allocation: TeamPiAllocationView;
  completedSprintHistory?: readonly CompletedSprintHistoryEntry[];
  piVelocityOverride?: number | null;
  sprintVelocityOverrides?: ReadonlyMap<string, number>;
  plannedSpByIteration?: ReadonlyMap<string, number>;
  plannedSpByCategoryAndIteration?: ReadonlyMap<
    string,
    ReadonlyMap<string, number>
  >;
  futureAvailability?: {
    ceremonies?: readonly { iterationId: string; hours: number }[];
    meetings?: readonly {
      memberId: string;
      iterationId: string;
      hours: number;
    }[];
    overtimeHours?: ReadonlyMap<string, ReadonlyMap<string, number>>;
  };
};

export type MemberIterationAvailability = {
  scheduledWeekdays: number;
  assignedWeekdays: number;
  scheduledMinutes: number;
  workingMinutes: number;
  holidayMinutes: number;
  absenceMinutes: number;
  availableMinutes: number;
  workingDaysRaw: number;
  holidayDaysRaw: number;
  absenceDaysRaw: number;
  availableDaysRaw: number;
  holidays: (Holiday & { isEstimated: boolean })[];
  absences: Absence[];
  hasEstimatedHoliday: boolean;
};
export type MemberIterationBreakdown = MemberIterationAvailability & {
  iterationId: string;
  exclusionReason: 'role' | 'archived' | 'unassigned' | null;
  overheadMinutes: number;
  overheadDaysRaw: number;
  preFteMinutes: number;
  devDaysRaw: number;
  devMinutes: number;
  devHours: number;
  hasOverDeductedWarning: boolean;
  warnings: 'over_deducted'[];
  overheadDeductions: (Pick<
    OverheadDeduction,
    'categoryId' | 'deductedHours' | 'source'
  > & { daysRaw: number })[];
};
export type OverheadCategorySummary = OverheadCategory & {
  piTotalHours: number;
  piTotalDaysRaw: number;
  byIteration: { iterationId: string; hours: number; daysRaw: number }[];
};
export type IterationCapacitySummary = TeamIterationSchedule & {
  scheduledWeekdays: number;
  isCurrent: boolean;
  eligibleFte: number;
  holidayLocations: (Location & { isEstimated: boolean })[];
  teamDevDaysRaw: number;
  teamDevDaysDisplay: number;
  teamDevHours: number;
  teamAvailableDaysRaw: number;
  teamAbsenceDaysRaw: number;
  overheadByCategory: { categoryId: string; hours: number; daysRaw: number }[];
  velocity: ResolvedVelocity;
  forecastSpRaw: number | null;
  forecastSpDisplay: number | null;
  plannedSp: number | null;
  load: LoadResult | null;
};
export type SprintCategoryBudget = {
  categoryId: string;
  budgetSpRaw: number | null;
  budgetSpDisplay: number | null;
};
export type CategoryBudgetRow = ResolvedCategoryAllocation & {
  piBudgetSpRaw: number | null;
  piBudgetSpDisplay: number | null;
  piPlannedSp: number | null;
  byIteration: (Omit<SprintCategoryBudget, 'categoryId'> & {
    iterationId: string;
    plannedSp: number | null;
    load: LoadResult | null;
  })[];
};
export type TeamPiCapacityView = {
  team: Team;
  pi: Pi;
  readOnly: boolean;
  velocity: ResolvedVelocity;
  kpi: {
    plannedSp: number | null;
    plannedSpStatus: 'available' | 'not_yet_available';
    piDevDaysRaw: number;
    piDevDaysDisplay: number;
    piDevHours: number;
    piForecastSpRaw: number | null;
    piForecastSpDisplay: number | null;
    eligibleFte: number;
    eligibleMemberCount: number;
    totalAssignedMemberCount: number;
    excludedMemberCount: number;
  };
  iterations: IterationCapacitySummary[];
  overheadCategories: OverheadCategorySummary[];
  allocation: Omit<TeamPiAllocationView, 'items'> & {
    rows: CategoryBudgetRow[];
  };
  members: (Member & {
    piDevDaysRaw: number;
    piDevHours: number;
    piWorkingDaysRaw: number;
    piHolidayDaysRaw: number;
    piAbsenceDaysRaw: number;
    piOverheadDaysRaw: number;
    cells: MemberIterationBreakdown[];
  })[];
  excludedMembers: (Pick<
    Member,
    'memberId' | 'fullName' | 'initials' | 'role'
  > & {
    locationCode: string;
    exclusionReason: 'role' | 'archived';
    excludedIterationIds: string[];
  })[];
};
