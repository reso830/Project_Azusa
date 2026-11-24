export const MEMBER_ROLES = [
  'Admin',
  'RTE',
  'SM',
  'PO',
  'Team member',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export function contributesToDevCapacity(role: MemberRole): boolean {
  return role !== 'PO' && role !== 'SM';
}
