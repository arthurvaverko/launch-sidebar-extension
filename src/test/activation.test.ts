import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'arthurvaverko.launch-sidebar';

interface CommandContribution { command: string }

/**
 * Activation smoke tests.
 *
 * These exist because of a real regression: `launchConfigurations.titleBarManageHiddenItems`
 * was registered twice, the second registration threw, and `activate()` swallowed the error
 * in a catch block. Everything downstream of the throw — notably `setupFileWatchers()` —
 * silently never ran, so the sidebar stopped auto-refreshing and nothing failed visibly.
 *
 * `activate()` now rethrows, so a broken activation makes these tests fail rather than
 * shipping an extension that looks fine and quietly does half its job.
 */
suite('Activation', () => {
  /** The extension under test, activated. VS Code hands us the parsed manifest for free. */
  async function activated(): Promise<vscode.Extension<unknown>> {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `extension ${EXTENSION_ID} not found`);
    await extension.activate();
    return extension;
  }

  test('the extension is present and activates without throwing', async () => {
    const extension = await activated();
    assert.strictEqual(extension.isActive, true, 'extension did not become active');
  });

  test('every command declared in the manifest is actually registered', async () => {
    const extension = await activated();

    const declared: string[] = extension.packageJSON.contributes.commands
      .map((c: CommandContribution) => c.command);
    assert.ok(declared.length > 0, 'no commands declared in the manifest');

    const registered = new Set(await vscode.commands.getCommands(true));
    const missing = declared.filter(command => !registered.has(command));

    assert.deepStrictEqual(missing, [], `declared but not registered: ${missing.join(', ')}`);
  });

  test('every command a menu points at is declared', async () => {
    // Catches the inverse drift: a menu entry left pointing at a command that no longer exists
    const extension = await activated();
    const contributes = extension.packageJSON.contributes;

    const declared = new Set<string>(
      contributes.commands.map((c: CommandContribution) => c.command)
    );
    const menuCommands = (Object.values(contributes.menus) as CommandContribution[][])
      .flat()
      .map(entry => entry.command);

    const undeclared = menuCommands.filter(command => !declared.has(command));
    assert.deepStrictEqual(undeclared, [], `menus reference undeclared commands: ${undeclared.join(', ')}`);
  });

  test('the refresh command runs against the registered tree view', async () => {
    await activated();

    // Exercising the view is the cheapest proof the provider was registered and is usable.
    // With no workspace folders open this is the Recent Items section alone, which is fine —
    // the assertion that matters is that it resolves rather than rejecting.
    await vscode.commands.executeCommand('launchConfigurations.refresh');
  });
});
