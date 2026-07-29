import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { LaunchConfigurationProvider } from '../providers/launch-configuration-provider';
import { SectionItem, SectionType } from '../models/section-item';

// generateSectionId is a pure static: it only reads fields off the SectionItem, so a
// SectionItem built with a hand-rolled WorkspaceFolder is enough - no live workspace needed.
const folder = (name: string, fsPath: string): vscode.WorkspaceFolder =>
  ({ uri: vscode.Uri.file(fsPath), name, index: 0 });

const idOf = (section: SectionItem): string => LaunchConfigurationProvider.generateSectionId(section);

suite('LaunchConfigurationProvider.generateSectionId', () => {
  test('section type alone when there is no folder', () => {
    assert.strictEqual(idOf(new SectionItem('Launch', SectionType.LAUNCH_CONFIGURATIONS)), 'section-launch-configs');
    assert.strictEqual(idOf(new SectionItem('Recent', SectionType.RECENT)), 'section-recent');
  });

  test('folder name is appended when present', () => {
    const section = new SectionItem('Launch', SectionType.LAUNCH_CONFIGURATIONS, folder('my-app', '/ws/my-app'));
    assert.strictEqual(idOf(section), 'section-launch-configs-my-app');
  });

  test('script sections use the package.json path relative to the folder', () => {
    const ws = folder('my-app', path.join(path.sep, 'ws', 'my-app'));
    const nested = new SectionItem(
      'Scripts',
      SectionType.SCRIPTS,
      ws,
      path.join(ws.uri.fsPath, 'packages', 'api', 'package.json')
    );
    assert.strictEqual(
      idOf(nested),
      `section-scripts-my-app-${path.join('packages', 'api', 'package.json')}`
    );

    const rootLevel = new SectionItem('Scripts', SectionType.SCRIPTS, ws, path.join(ws.uri.fsPath, 'package.json'));
    assert.strictEqual(idOf(rootLevel), 'section-scripts-my-app-package.json');
  });

  test('makefile sections use the makefile path relative to the folder', () => {
    const ws = folder('my-app', path.join(path.sep, 'ws', 'my-app'));
    const section = new SectionItem(
      'Makefile',
      SectionType.MAKEFILE_TASKS,
      ws,
      undefined,
      path.join(ws.uri.fsPath, 'build', 'Makefile')
    );
    assert.strictEqual(idOf(section), `section-makefile-tasks-my-app-${path.join('build', 'Makefile')}`);
  });

  test('without a folder the absolute path is used verbatim', () => {
    const absolute = path.join(path.sep, 'elsewhere', 'package.json');
    const section = new SectionItem('Scripts', SectionType.SCRIPTS, undefined, absolute);
    assert.strictEqual(idOf(section), `section-scripts-${absolute}`);
  });

  test('ids are stable and distinguish sibling packages', () => {
    const ws = folder('my-app', path.join(path.sep, 'ws', 'my-app'));
    const make = (pkgDir: string): SectionItem =>
      new SectionItem('Scripts', SectionType.SCRIPTS, ws, path.join(ws.uri.fsPath, pkgDir, 'package.json'));

    assert.strictEqual(idOf(make('api')), idOf(make('api')));
    assert.notStrictEqual(idOf(make('api')), idOf(make('web')));
  });
});
