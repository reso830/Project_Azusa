import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { expect, it } from 'vitest';
import { parsers } from 'prettier/plugins/markdown';
import type { ParserOptions } from 'prettier';

const documents = [
  'README.md',
  'docs/REPO_MAP.md',
  'CHANGELOG.md',
  'docs/architecture/overview.md',
  'docs/architecture/domain-model.md',
  'docs/architecture/data-dictionary.md',
  'docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md',
  'docs/operations/database-and-recovery.md',
];
const read = (file: string) => readFile(path.resolve(file), 'utf8');

it.each(documents)(
  '%s contains substantive documentation without placeholders',
  async (file) => {
    const content = await read(file);
    expect(content.trim().length).toBeGreaterThan(100);
    expect(content).not.toMatch(/\b(?:TBD|TODO)\b|to be defined/i);
    expect(content).not.toContain('\uFFFD');
  },
);

type MarkdownNode = {
  type: string;
  url?: string;
  children?: MarkdownNode[];
};
function descendants(node: MarkdownNode): MarkdownNode[] {
  return [node, ...(node.children ?? []).flatMap(descendants)];
}

it('resolves every local README Markdown link and indexes all documentation artifacts', async () => {
  const ast: MarkdownNode = await parsers.markdown.parse(
    await read('README.md'),
    {} as ParserOptions,
  );
  const targets = descendants(ast).flatMap((node) =>
    node.url ? [node.url] : [],
  );
  expect(targets.length).toBeGreaterThan(0);
  const linked = new Set<string>();
  for (const target of targets) {
    if (/^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) continue;
    const relative = decodeURIComponent(target.split(/[?#]/)[0] ?? '');
    const resolved = path.resolve(relative || 'README.md');
    await expect(
      stat(resolved),
      `Broken README link: ${target}`,
    ).resolves.toBeDefined();
    linked.add(resolved);
  }
  const required = new Set(documents.filter((file) => file !== 'README.md'));
  async function collect(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (/\.(?:md|zip)$/i.test(entry.name)) required.add(file);
    }
  }
  await collect('docs');
  for (const file of required)
    expect(linked.has(path.resolve(file)), `README index omits ${file}`).toBe(
      true,
    );
});

it('retains the proposed nineteen-feature roadmap across five milestones without accepting later features', async () => {
  const features: { id: string; milestone: string; checked: string }[] = [];
  let milestone = '';
  for (const line of (await read('docs/feature-roadmap.md')).split(/\r?\n/)) {
    const heading = /^# (M[0-4])\b/.exec(line);
    if (heading) milestone = heading[1]!;
    const feature = /^- \[([ xX])\] \*\*(F\d{3})\b/.exec(line);
    if (feature)
      features.push({ id: feature[2]!, milestone, checked: feature[1]! });
  }
  const expected = Array.from({ length: 19 }, (_, index) => {
    const n = index + 1;
    return {
      id: `F${String(n).padStart(3, '0')}`,
      milestone:
        n <= 5 ? 'M0' : n <= 12 ? 'M1' : n <= 15 ? 'M2' : n <= 18 ? 'M3' : 'M4',
    };
  });
  expect(features.map(({ id, milestone }) => ({ id, milestone }))).toEqual(
    expected,
  );
  expect(
    features
      .filter(({ id }) => id !== 'F001')
      .every(({ checked }) => checked === ' '),
  ).toBe(true);
});

it('keeps application release metadata synchronized', async () => {
  const pkg = JSON.parse(await read('package.json'));
  const lock = JSON.parse(await read('package-lock.json'));
  expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect([lock.version, lock.packages[''].version]).toEqual([
    pkg.version,
    pkg.version,
  ]);
  expect(await read('CHANGELOG.md')).toContain(`## [${pkg.version}] - `);
  const appVersions = [
    ...(await read('src/persistence/migrate.ts')).matchAll(
      /appVersion:\s*['"]([^'"]+)['"]/g,
    ),
  ].map((match) => match[1]);
  expect(appVersions.length).toBeGreaterThan(0);
  expect(appVersions.every((version) => version === pkg.version)).toBe(true);
});

it('documents the supported runtime, environment overrides, and all seven quality gates', async () => {
  const content = await read('README.md');
  const pkg = JSON.parse(await read('package.json'));
  expect(content).toContain(pkg.engines.node);
  for (const script of [
    'lint',
    'format:check',
    'typecheck',
    'test:run',
    'build',
    'test:visual',
    'test:e2e',
  ]) {
    expect(pkg.scripts[script]).toBeTypeOf('string');
    expect(content).toContain(`npm run ${script}`);
  }
  for (const variable of [
    'AZUSA_DB_DIR',
    'AZUSA_BACKUP_DIR',
    'AZUSA_ACTOR_ID',
    'AZUSA_NEXT_DIST_DIR',
    'NEXT_TELEMETRY_DISABLED',
  ])
    expect(content).toContain(variable);
});
