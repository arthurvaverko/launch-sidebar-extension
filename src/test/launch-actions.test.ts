import * as assert from 'assert';
import * as vscode from 'vscode';
import { LaunchConfigurationProvider, LaunchTreeItem } from '../providers/launch-configuration-provider';
import { LaunchConfigurationItem } from '../models/launch-items';
import { ScriptItem } from '../models/script-item';
import { JetBrainsRunConfigItem } from '../models/jetbrains-items';
import { MakefileTaskItem } from '../models/makefile-task-item';
import { SectionItem, SectionType } from '../models/section-item';

const EXTENSION_ID = 'arthurvaverko.launch-sidebar';

interface CommandContribution { command: string; title: string; icon?: string }
interface MenuContribution { command: string; when?: string; group?: string }

function contributes(): { commands: CommandContribution[]; menus: Record<string, MenuContribution[]>; configuration: any } {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `extension ${EXTENSION_ID} not found`);
  return extension.packageJSON.contributes;
}

/**
 * Issue #1: run without debugging, and an opt-in click-to-run.
 *
 * The behaviour these drive lives in VS Code's own UI (inline buttons, tree item clicks),
 * so what is verifiable here is the contract: the commands exist, are registered, are wired
 * to the right menu slots, and the setting is declared with a safe default.
 */
suite('Launch actions', () => {
  suiteSetup(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  test('Run Without Debugging is declared and registered', async () => {
    const declared = contributes().commands.find(c => c.command === 'launchConfigurations.launchNoDebug');
    assert.ok(declared, 'launchNoDebug is not declared in the manifest');
    assert.strictEqual(declared.title, 'Run Without Debugging');

    const registered = await vscode.commands.getCommands(true);
    assert.ok(registered.includes('launchConfigurations.launchNoDebug'), 'launchNoDebug is not registered');
  });

  test('the two launch actions are visually distinguishable', () => {
    const commands = contributes().commands;
    const debugIcon = commands.find(c => c.command === 'launchConfigurations.launch')?.icon;
    const runIcon = commands.find(c => c.command === 'launchConfigurations.launchNoDebug')?.icon;

    assert.ok(debugIcon && runIcon, 'both launch actions need an icon');
    assert.notStrictEqual(debugIcon, runIcon, 'two buttons sharing one icon are indistinguishable');
  });

  test('both launch actions are inline on debug configurations, in a defined order', () => {
    const forConfigs = contributes().menus['view/item/context']
      .filter(m => m.when === 'view == launchConfigurations && viewItem == configuration' && m.group?.startsWith('inline'));

    const byCommand = new Map(forConfigs.map(m => [m.command, m.group]));
    assert.strictEqual(byCommand.get('launchConfigurations.launchNoDebug'), 'inline@1');
    assert.strictEqual(byCommand.get('launchConfigurations.launch'), 'inline@2');
    assert.strictEqual(byCommand.get('launchConfigurations.edit'), 'inline@3');
  });

  test('run-without-debugging is offered only for debug configurations', () => {
    // Scripts, Makefile targets and JetBrains configs have no debug/no-debug distinction
    const entries = contributes().menus['view/item/context']
      .filter(m => m.command === 'launchConfigurations.launchNoDebug');

    assert.strictEqual(entries.length, 1);
    assert.ok(entries[0].when?.includes('viewItem == configuration'));
  });

  test('runOnClick is declared and defaults to off', () => {
    const property = contributes().configuration.properties['launchSidebar.runOnClick'];
    assert.ok(property, 'launchSidebar.runOnClick is not declared');
    assert.strictEqual(property.type, 'boolean');
    assert.strictEqual(property.default, false, 'a stray click must not launch anything by default');
  });

  test('the effective runOnClick value is off out of the box', () => {
    const value = vscode.workspace.getConfiguration('launchSidebar').get<boolean>('runOnClick');
    assert.strictEqual(value, false);
  });

  suite('runOnClick command mapping', () => {
    const folder: vscode.WorkspaceFolder = { uri: vscode.Uri.file('/work'), name: 'work', index: 0 };

    test('each runnable item type maps to the command that runs it', () => {
      const cases: [LaunchTreeItem, string][] = [
        [new LaunchConfigurationItem('Debug', 'node', { type: 'node', name: 'Debug', request: 'launch' }, folder),
          'launchConfigurations.launch'],
        [new ScriptItem('build', 'tsc', '/work/package.json', folder), 'launchConfigurations.runScript'],
        [new JetBrainsRunConfigItem('Seed', 'ShConfigurationType', '/work/.run/s.xml', folder),
          'launchConfigurations.runJetBrainsConfig'],
        [new MakefileTaskItem('all', '/work/Makefile', folder), 'launchConfigurations.runMakefileTask']
      ];

      for (const [item, expected] of cases) {
        assert.strictEqual(LaunchConfigurationProvider.runCommandFor(item), expected,
          `${item.constructor.name} mapped to the wrong command`);
      }
    });

    test('every mapped command is one the extension actually registers', async () => {
      const registered = new Set(await vscode.commands.getCommands(true));
      const mapped = [
        new LaunchConfigurationItem('Debug', 'node', { type: 'node', name: 'Debug', request: 'launch' }, folder),
        new ScriptItem('build', 'tsc', '/work/package.json', folder),
        new JetBrainsRunConfigItem('Seed', 'ShConfigurationType', '/work/.run/s.xml', folder),
        new MakefileTaskItem('all', '/work/Makefile', folder)
      ].map(item => LaunchConfigurationProvider.runCommandFor(item));

      for (const command of mapped) {
        assert.ok(command && registered.has(command), `${command} is mapped but not registered`);
      }
    });

    test('non-runnable items get no click command', () => {
      const section = new SectionItem('work', SectionType.SCRIPTS, folder, '/work/package.json');
      assert.strictEqual(LaunchConfigurationProvider.runCommandFor(section), undefined);
    });
  });
});
