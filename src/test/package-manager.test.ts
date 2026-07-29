import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectPackageManager, detectRootPackageManager } from '../utils/package-manager';

// Real temp directories on the real filesystem - detectPackageManager uses fs.existsSync
// directly, so there is nothing to mock. Everything lives under one mkdtemp root that is
// removed in suiteTeardown; the root is guaranteed empty of lockfiles, which matters
// because the function looks two levels up from the package directory (see the
// "assumes packages/<name>" tests below).
let root: string;

const write = (relPath: string, content: string): string => {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
};

const writePkg = (relPath: string, pkg: unknown): string => write(relPath, JSON.stringify(pkg));

suite('package manager detection', () => {
  suiteSetup(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-sidebar-pm-'));
  });

  suiteTeardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('explicit packageManager field wins', () => {
    const pnpm = writePkg('explicit-pnpm/package.json', { packageManager: 'pnpm@8.6.0' });
    const yarn = writePkg('explicit-yarn/package.json', { packageManager: 'yarn@3.6.1' });
    const npm = writePkg('explicit-npm/package.json', { packageManager: 'npm@10.2.0' });
    assert.strictEqual(detectPackageManager(pnpm), 'pnpm');
    assert.strictEqual(detectPackageManager(yarn), 'yarn');
    assert.strictEqual(detectPackageManager(npm), 'npm');
  });

  test('explicit packageManager field is case insensitive', () => {
    const shouty = writePkg('explicit-case/package.json', { packageManager: 'PNPM@8.6.0' });
    assert.strictEqual(detectPackageManager(shouty), 'pnpm');
  });

  test('unknown packageManager value falls through to npm', () => {
    const bun = writePkg('explicit-bun/package.json', { packageManager: 'bun@1.0.0' });
    assert.strictEqual(detectPackageManager(bun), 'npm');
  });

  test('explicit packageManager field beats a local lockfile', () => {
    const pkg = writePkg('explicit-vs-lock/package.json', { packageManager: 'pnpm@8.6.0' });
    write('explicit-vs-lock/yarn.lock', '');
    assert.strictEqual(detectPackageManager(pkg), 'pnpm');
  });

  test('lockfile detection for each manager', () => {
    const pnpm = writePkg('lock-pnpm/package.json', {});
    write('lock-pnpm/pnpm-lock.yaml', 'lockfileVersion: 6.0\n');
    const yarn = writePkg('lock-yarn/package.json', {});
    write('lock-yarn/yarn.lock', '# yarn lockfile v1\n');
    const npm = writePkg('lock-npm/package.json', {});
    write('lock-npm/package-lock.json', '{}');

    assert.strictEqual(detectPackageManager(pnpm), 'pnpm');
    assert.strictEqual(detectPackageManager(yarn), 'yarn');
    assert.strictEqual(detectPackageManager(npm), 'npm');
  });

  test('pnpm lockfile wins when several lockfiles are present', () => {
    const pkg = writePkg('lock-all/package.json', {});
    write('lock-all/pnpm-lock.yaml', '');
    write('lock-all/yarn.lock', '');
    write('lock-all/package-lock.json', '{}');
    assert.strictEqual(detectPackageManager(pkg), 'pnpm');
  });

  test('lockfile is used when package.json is unreadable or absent', () => {
    const broken = write('broken/package.json', '{ this is not json');
    write('broken/yarn.lock', '');
    assert.strictEqual(detectPackageManager(broken), 'yarn');

    const missing = path.join(root, 'missing', 'package.json');
    write('missing/pnpm-lock.yaml', '');
    assert.strictEqual(detectPackageManager(missing), 'pnpm');
  });

  test('falls back to npm with nothing to go on', () => {
    const pkg = writePkg('bare/nested/deeper/package.json', {});
    assert.strictEqual(detectPackageManager(pkg), 'npm');
  });

  test('engines hints are honoured, but only after packageManager', () => {
    const enginesPnpm = writePkg('engines-pnpm/package.json', { engines: { pnpm: '>=8' } });
    write('engines-pnpm/yarn.lock', '');
    assert.strictEqual(detectPackageManager(enginesPnpm), 'pnpm');

    const both = writePkg('engines-vs-explicit/package.json', {
      engines: { npm: '>=8' },
      packageManager: 'yarn@3.6.1'
    });
    assert.strictEqual(detectPackageManager(both), 'yarn');
  });

  test('rootLockfileManager overrides everything for a nested package', () => {
    const nested = writePkg('mono/packages/a/package.json', { packageManager: 'yarn@3.6.1' });
    write('mono/packages/a/yarn.lock', '');
    write('mono/pnpm-lock.yaml', '');
    // Without the hint, the package's own explicit field is used...
    assert.strictEqual(detectPackageManager(nested), 'yarn');
    // ...with the hint, the hint wins over both the explicit field and the local lockfile.
    assert.strictEqual(detectPackageManager(nested, 'pnpm'), 'pnpm');
  });

  test('workspace-root lockfile is found for a package exactly two levels down', () => {
    const nested = writePkg('two-levels/packages/a/package.json', {});
    write('two-levels/pnpm-lock.yaml', '');
    assert.strictEqual(detectPackageManager(nested), 'pnpm');
  });

  // BUG (documented, not fixed): workspaceRoot is hard-coded to
  // path.resolve(packageDir, '../..'), so the root-lockfile fallback only works for
  // packages nested exactly two levels below the workspace root. Here the workspace root
  // holds a pnpm-lock.yaml and the package is one level down; expected 'pnpm', got 'npm'
  // because the code looked in the workspace root's PARENT instead.
  test('workspace-root lockfile is missed at other nesting depths (current behavior)', () => {
    const oneLevel = writePkg('one-level/pkg/package.json', {});
    write('one-level/pnpm-lock.yaml', '');
    assert.strictEqual(detectPackageManager(oneLevel), 'npm');

    const threeLevels = writePkg('three-levels/apps/web/api/package.json', {});
    write('three-levels/yarn.lock', '');
    assert.strictEqual(detectPackageManager(threeLevels), 'npm');
  });

  // BUG (documented, not fixed): isRootPackage is derived from the same
  // '../..' assumption, so it is only ever true for a package.json sitting at the
  // filesystem root. A real workspace-root package.json is therefore treated as
  // "nested" and its explicit packageManager field is discarded whenever a
  // rootLockfileManager is passed in. Expected 'pnpm' (the explicit field), got 'yarn'.
  test('root package.json is never recognised as the root package (current behavior)', () => {
    const rootPkg = writePkg('ws/package.json', { packageManager: 'pnpm@8.6.0' });
    write('ws/yarn.lock', '');
    assert.strictEqual(detectPackageManager(rootPkg), 'pnpm');
    assert.strictEqual(detectPackageManager(rootPkg, 'yarn'), 'yarn');
  });

  // BUG (documented, not fixed): the scripts heuristic can never report pnpm, because
  // 'pnpm ' contains the substring 'npm ', so the `!scriptValues.includes('npm ')`
  // guard is always false for pnpm scripts. Expected 'pnpm', got 'npm'.
  test('scripts heuristic detects yarn but never pnpm (current behavior)', () => {
    const yarn = writePkg('scripts-yarn/package.json', { scripts: { build: 'yarn run compile' } });
    assert.strictEqual(detectPackageManager(yarn), 'yarn');

    const pnpm = writePkg('scripts-pnpm/package.json', { scripts: { build: 'pnpm run compile' } });
    assert.strictEqual(detectPackageManager(pnpm), 'npm');
  });

  test('detectRootPackageManager returns the manager matching the lockfile, undefined when there is none', () => {
    write('root-pnpm/pnpm-lock.yaml', '');
    write('root-yarn/yarn.lock', '');
    write('root-npm/package-lock.json', '{}');
    fs.mkdirSync(path.join(root, 'root-none'), { recursive: true });

    assert.strictEqual(detectRootPackageManager(path.join(root, 'root-pnpm')), 'pnpm');
    assert.strictEqual(detectRootPackageManager(path.join(root, 'root-yarn')), 'yarn');
    assert.strictEqual(detectRootPackageManager(path.join(root, 'root-npm')), 'npm');
    assert.strictEqual(detectRootPackageManager(path.join(root, 'root-none')), undefined);
    assert.strictEqual(detectRootPackageManager(path.join(root, 'does-not-exist')), undefined);
  });

  test('detectRootPackageManager prefers pnpm over yarn and npm lockfiles', () => {
    write('root-multi/pnpm-lock.yaml', '');
    write('root-multi/yarn.lock', '');
    write('root-multi/package-lock.json', '{}');
    assert.strictEqual(detectRootPackageManager(path.join(root, 'root-multi')), 'pnpm');
  });
});
