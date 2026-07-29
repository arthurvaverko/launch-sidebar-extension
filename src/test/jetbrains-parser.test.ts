import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { JetBrainsRunConfigParser, JetBrainsRunConfig } from '../utils/jetbrains-parser';

// Every XML-parsing method on JetBrainsRunConfigParser is private; the only public entry
// point is findRunConfigurations(workspaceFolder), which walks the filesystem. So the
// tests drive it through a real temp directory holding a .run/ folder and hand it a
// plain object shaped like a vscode.WorkspaceFolder.
let root: string;
let configs: JetBrainsRunConfig[];

const byName = (name: string): JetBrainsRunConfig => {
  const found = configs.find(c => c.name === name);
  assert.ok(found, `no configuration named ${name} was parsed`);
  return found;
};

const GO_XML = `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="Run Server" type="GoApplicationRunConfiguration" factoryName="Go Application">
    <module name="server" />
    <working_directory value="$PROJECT_DIR$/cmd/server" />
    <go_parameters value="-race" />
    <package value="github.com/acme/server/cmd/server" />
    <envs>
      <env name="ENV" value="dev" />
      <env name="PORT" value="8080" />
    </envs>
    <kind value="PACKAGE" />
    <method v="2" />
  </configuration>
</component>`;

const SHELL_XML = `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="Seed DB" type="ShConfigurationType">
    <option name="SCRIPT_TEXT" value="echo seeding" />
    <option name="SCRIPT_PATH" value="$PROJECT_DIR$/scripts/seed.sh" />
    <option name="SCRIPT_OPTIONS" value="--force" />
    <option name="SCRIPT_WORKING_DIRECTORY" value="$PROJECT_DIR$" />
    <option name="INTERPRETER_PATH" value="/bin/zsh" />
    <option name="EXECUTE_IN_TERMINAL" value="true" />
    <option name="EXECUTE_SCRIPT_FILE" value="true" />
    <envs>
      <env name="DB" value="local" />
    </envs>
    <method v="2" />
  </configuration>
</component>`;

// One .xml file holding two configurations, one of them missing the required name attribute.
const MULTI_XML = `<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="Unit Tests" type="GoTestRunConfiguration" factoryName="Go Test">
    <working_directory value="$PROJECT_DIR$" />
    <go_parameters value="-run TestFoo" />
    <package value="github.com/acme/server/internal" />
    <kind value="PACKAGE" />
    <framework value="gotest" />
  </configuration>
  <configuration default="false" type="ShConfigurationType">
    <option name="SCRIPT_TEXT" value="nameless" />
  </configuration>
</component>`;

const NOT_A_CONFIG_XML = `<project version="4">
  <component name="SomethingElse" />
</project>`;

suite('JetBrainsRunConfigParser', () => {
  suiteSetup(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-sidebar-jb-'));
    fs.mkdirSync(path.join(root, '.run'));
    fs.writeFileSync(path.join(root, '.run', 'go.run.xml'), GO_XML);
    fs.writeFileSync(path.join(root, '.run', 'shell.run.xml'), SHELL_XML);
    fs.writeFileSync(path.join(root, '.run', 'multi.xml'), MULTI_XML);
    fs.writeFileSync(path.join(root, '.run', 'other.xml'), NOT_A_CONFIG_XML);
    fs.writeFileSync(path.join(root, '.run', 'broken.xml'), '<component><configuration name=');
    fs.writeFileSync(path.join(root, '.run', 'notes.txt'), 'ignored, not xml');

    const folder: vscode.WorkspaceFolder = { uri: vscode.Uri.file(root), name: 'jb-ws', index: 0 };
    configs = await JetBrainsRunConfigParser.findRunConfigurations(folder);
  });

  suiteTeardown(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('finds every named configuration in .run and ignores the rest', () => {
    assert.deepStrictEqual(configs.map(c => c.name).sort(), ['Run Server', 'Seed DB', 'Unit Tests']);
  });

  test('a missing .run and .idea directory yields no configurations', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-sidebar-jb-empty-'));
    try {
      const folder: vscode.WorkspaceFolder = { uri: vscode.Uri.file(empty), name: 'empty', index: 0 };
      assert.deepStrictEqual(await JetBrainsRunConfigParser.findRunConfigurations(folder), []);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  test('a nonexistent workspace path does not throw', async () => {
    const folder: vscode.WorkspaceFolder = {
      uri: vscode.Uri.file(path.join(root, 'no-such-dir')),
      name: 'gone',
      index: 0
    };
    assert.deepStrictEqual(await JetBrainsRunConfigParser.findRunConfigurations(folder), []);
  });

  test('go application config: package, working dir, parameters and env vars', () => {
    const go = byName('Run Server');
    assert.strictEqual(go.type, 'GoApplicationRunConfiguration');
    assert.strictEqual(go.packagePath, 'github.com/acme/server/cmd/server');
    assert.strictEqual(go.goParameters, '-race');
    assert.strictEqual(go.workingDirectory, path.join(root, 'cmd', 'server'));
    assert.strictEqual(go.xmlFilePath, path.join(root, '.run', 'go.run.xml'));
    assert.strictEqual(go.envVars?.ENV, 'dev');
  });

  // BUG (documented, not fixed): the XML parser runs with parseAttributeValue: true, so a
  // numeric env value comes back as a number even though envVars is typed
  // Record<string, string>. Expected the string '8080'.
  test('numeric env values are numbers, not strings (current behavior)', () => {
    const port = byName('Run Server').envVars?.PORT as unknown;
    assert.strictEqual(typeof port, 'number');
    assert.strictEqual(port, 8080);
  });

  test('go test config maps go_parameters onto command', () => {
    const test = byName('Unit Tests');
    assert.strictEqual(test.type, 'GoTestRunConfiguration');
    assert.strictEqual(test.packagePath, 'github.com/acme/server/internal');
    assert.strictEqual(test.command, '-run TestFoo');
    assert.strictEqual(test.workingDirectory, root);
  });

  test('shell config: script text, path, options, interpreter and $PROJECT_DIR$ expansion', () => {
    const sh = byName('Seed DB');
    assert.strictEqual(sh.type, 'ShConfigurationType');
    assert.strictEqual(sh.scriptText, 'echo seeding');
    assert.strictEqual(sh.packagePath, path.join(root, 'scripts', 'seed.sh'));
    assert.strictEqual(sh.command, '--force');
    assert.strictEqual(sh.workingDirectory, root);
    assert.strictEqual(sh.interpreter, '/bin/zsh');
  });

  // BUG (documented, not fixed): option values are parsed with parseAttributeValue: true,
  // so value="true" arrives as the boolean true and the `value === 'true'` string
  // comparison never matches. Both flags are therefore stuck at false, and
  // extension.ts only takes the "run the script file" branch when executeScriptFile is
  // true. Expected true for both.
  test('EXECUTE_IN_TERMINAL / EXECUTE_SCRIPT_FILE are always false (current behavior)', () => {
    const sh = byName('Seed DB');
    assert.strictEqual(sh.executeInTerminal, false);
    assert.strictEqual(sh.executeScriptFile, false);
  });

  // GAP (documented, not fixed): processShellConfiguration never reads <envs>, so env vars
  // declared on a shell configuration are dropped. Expected { DB: 'local' }.
  test('shell configs drop their env vars (current behavior)', () => {
    assert.strictEqual(byName('Seed DB').envVars, undefined);
  });

  test('configurations in .idea/runConfigurations are picked up too', async () => {
    const ideaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-sidebar-jb-idea-'));
    try {
      const dir = path.join(ideaRoot, '.idea', 'runConfigurations');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Run_Server.xml'), GO_XML);

      const folder: vscode.WorkspaceFolder = { uri: vscode.Uri.file(ideaRoot), name: 'idea-ws', index: 0 };
      const found = await JetBrainsRunConfigParser.findRunConfigurations(folder);
      assert.deepStrictEqual(found.map(c => c.name), ['Run Server']);
      assert.strictEqual(found[0].packagePath, 'github.com/acme/server/cmd/server');
    } finally {
      fs.rmSync(ideaRoot, { recursive: true, force: true });
    }
  });
});
