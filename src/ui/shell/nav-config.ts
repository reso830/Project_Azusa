import type { KumikoIconName } from '../icons/kumiko-icons';
export type Destination = {
  group: string;
  title: string;
  href: string;
  icon: KumikoIconName;
  milestone: string;
  feature: string;
};
export const destinations: Destination[] = [
  {
    group: 'PI',
    title: 'Team PI board',
    href: '/',
    icon: 'team-board',
    milestone: 'M1',
    feature: 'F009',
  },
  {
    group: 'PI',
    title: 'ART program board',
    href: '/program-board',
    icon: 'art-board',
    milestone: 'M4',
    feature: 'F019',
  },
  {
    group: 'PI',
    title: 'Team PI brief',
    href: '/pi-brief',
    icon: 'pi-brief',
    milestone: 'M1',
    feature: 'F011',
  },
  {
    group: 'Capacity',
    title: 'Team calendar',
    href: '/calendar',
    icon: 'calendar',
    milestone: 'M0',
    feature: 'F005',
  },
  {
    group: 'Capacity',
    title: 'Capacity planner',
    href: '/capacity',
    icon: 'capacity',
    milestone: 'M0',
    feature: 'F004',
  },
  {
    group: 'Sprint',
    title: 'Team backlog',
    href: '/backlog',
    icon: 'backlog',
    milestone: 'M1',
    feature: 'F008',
  },
  {
    group: 'Sprint',
    title: 'Sprint planning',
    href: '/sprint-planning',
    icon: 'sprint-plan',
    milestone: 'M2',
    feature: 'F013',
  },
  {
    group: 'Sprint',
    title: 'Iteration board',
    href: '/iteration',
    icon: 'iteration',
    milestone: 'M2',
    feature: 'F014',
  },
  {
    group: 'Insights',
    title: 'Team dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    milestone: 'M3',
    feature: 'F017',
  },
];
