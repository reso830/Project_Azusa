import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { kumikoIcons } from '../../src/ui/icons/kumiko-icons';
import { KumikoIcon } from '../../src/ui/icons/KumikoIcon';
it('preserves all 42 icons and their common SVG geometry', () => {
  expect(Object.keys(kumikoIcons)).toHaveLength(42);
  expect(Object.keys(kumikoIcons).sort()).toEqual(
    'team-board,art-board,pi-brief,capacity,iteration,dashboard,settings,search,add,filter,export,present,refresh,warning,dependency,delivery-flow,calendar,location,clock,members,risk,objective,velocity,asanoha,chevron,expand,backlog,sprint-plan,info,lock,copy-link,more,edit,close,check,close-item,flag-missed,flag-aging,flag-blocked,commit-committed,commit-stretch,commit-buffer'
      .split(',')
      .sort(),
  );
  for (const name of Object.keys(kumikoIcons) as (keyof typeof kumikoIcons)[]) {
    const svg = renderToStaticMarkup(createElement(KumikoIcon, { name }));
    for (const attribute of [
      'viewBox="0 0 24 24"',
      'fill="none"',
      'stroke="currentColor"',
      'stroke-width="1.75"',
      'stroke-linejoin="miter"',
      'stroke-miterlimit="10"',
      'stroke-linecap="butt"',
    ])
      expect(svg).toContain(attribute);
  }
  expect(kumikoIcons['delivery-flow']).toContain(
    'stroke="var(--kumiko-surface, #FFFFFF)"',
  );
  expect(kumikoIcons['commit-buffer']).toContain('stroke-dasharray');
  for (const name of [
    'warning',
    'flag-missed',
    'flag-aging',
    'flag-blocked',
    'commit-committed',
    'commit-stretch',
    'commit-buffer',
  ] as const)
    expect(kumikoIcons[name]).not.toContain('currentColor');
});

it('preserves the semantic glyph fills and contrast strokes', () => {
  const attributes = {
    warning: ['fill="#E07F24"', 'fill="#1A1B22"'],
    'flag-missed': ['fill="#D9443A"', 'fill="#FFFFFF"', 'stroke="#FFFFFF"'],
    'flag-aging': ['fill="#E39A1B"', 'stroke="#1A1B22"'],
    'flag-blocked': ['fill="#D9443A"', 'fill="#FFFFFF"'],
    'commit-committed': ['fill="#3E9A5B"', 'stroke="#FFFFFF"'],
    'commit-stretch': ['fill="#F2C230"', 'fill="none"', 'stroke="#1A1B22"'],
    'commit-buffer': ['stroke="#8A8D96"', 'stroke-dasharray="2.6 2"'],
  } as const;
  for (const [name, expected] of Object.entries(attributes)) {
    const markup = kumikoIcons[name as keyof typeof kumikoIcons];
    for (const attribute of expected) expect(markup).toContain(attribute);
    expect(markup).not.toMatch(/(?:fill|stroke)="#(?:000000|000)"/i);
  }
});
