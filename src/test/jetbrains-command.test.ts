import * as assert from 'assert';
import { buildJetBrainsCommand, quoteArg } from '../utils/jetbrains-command';

/**
 * The old command construction probed properties in a fixed order and checked `cmdString`
 * first. Because the parser maps a shell config's SCRIPT_OPTIONS and a Go test's
 * go_parameters onto that field, both were run as if they were whole commands —
 * `--force` and `-run TestFoo` respectively.
 */
suite('buildJetBrainsCommand', () => {
  suite('shell configurations', () => {
    const base = {
      type: 'ShConfigurationType',
      interpreter: '/bin/zsh',
      packagePath: '/work/scripts/seed.sh',
      scriptText: 'echo seeding'
    };

    test('runs the script file through its interpreter when EXECUTE_SCRIPT_FILE is set', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ ...base, executeScriptFile: true }),
        '/bin/zsh "/work/scripts/seed.sh"'
      );
    });

    test('treats SCRIPT_OPTIONS as arguments to the script, not as the command', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ ...base, executeScriptFile: true, cmdString: '--force' }),
        '/bin/zsh "/work/scripts/seed.sh" --force'
      );
    });

    test('runs the inline script text when EXECUTE_SCRIPT_FILE is not set', () => {
      assert.strictEqual(buildJetBrainsCommand({ ...base, executeScriptFile: false }), 'echo seeding');
    });

    test('script options never become the command on their own', () => {
      // The specific regression: this used to return '--force'
      const command = buildJetBrainsCommand({ ...base, executeScriptFile: false, cmdString: '--force' });
      assert.notStrictEqual(command, '--force');
      assert.strictEqual(command, 'echo seeding');
    });

    test('defaults to /bin/bash when no interpreter is given', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'ShConfigurationType', packagePath: '/w/s.sh', executeScriptFile: true }),
        '/bin/bash "/w/s.sh"'
      );
    });

    test('a path containing spaces stays a single argument', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'ShConfigurationType', packagePath: '/my work/s.sh', executeScriptFile: true }),
        '/bin/bash "/my work/s.sh"'
      );
    });

    test('a shell config with nothing runnable yields undefined', () => {
      assert.strictEqual(buildJetBrainsCommand({ type: 'ShConfigurationType' }), undefined);
    });
  });

  suite('Go configurations', () => {
    test('go application: parameters before the package, args after', () => {
      assert.strictEqual(
        buildJetBrainsCommand({
          type: 'GoApplicationRunConfiguration',
          goParameters: '-race',
          packagePath: 'github.com/acme/cmd/server',
          cmdString: '--port 8080'
        }),
        'go run -race github.com/acme/cmd/server --port 8080'
      );
    });

    test('go application without a package yields undefined', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'GoApplicationRunConfiguration', goParameters: '-race' }),
        undefined
      );
    });

    test('go test puts the package last, after the test flags', () => {
      // This used to return just '-run TestFoo'
      assert.strictEqual(
        buildJetBrainsCommand({
          type: 'GoTestRunConfiguration',
          cmdString: '-run TestFoo',
          packagePath: 'github.com/acme/internal'
        }),
        'go test -run TestFoo github.com/acme/internal'
      );
    });

    test('go test without flags still runs the package', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'GoTestRunConfiguration', packagePath: 'github.com/acme/internal' }),
        'go test github.com/acme/internal'
      );
    });
  });

  suite('other configuration types', () => {
    test('an unrecognised type falls back to its command string, as before', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'NodeJSConfigurationType', cmdString: 'node index.js' }),
        'node index.js'
      );
    });

    test('an unrecognised type can still run a script file', () => {
      assert.strictEqual(
        buildJetBrainsCommand({ type: 'NodeJSConfigurationType', executeScriptFile: true, packagePath: '/w/i.js' }),
        'node "/w/i.js"'
      );
    });

    test('an unrecognised type with nothing runnable yields undefined', () => {
      assert.strictEqual(buildJetBrainsCommand({ type: 'Mystery' }), undefined);
    });

    test('a whitespace-only command string is not treated as runnable', () => {
      assert.strictEqual(buildJetBrainsCommand({ type: 'Mystery', cmdString: '   ' }), undefined);
      assert.strictEqual(buildJetBrainsCommand({ type: 'ShConfigurationType', scriptText: '  ' }), undefined);
    });
  });

  suite('quoteArg', () => {
    test('wraps the value in double quotes', () => {
      assert.strictEqual(quoteArg('build'), '"build"');
      assert.strictEqual(quoteArg('my task'), '"my task"');
    });

    test('drops literal double quotes, which have no portable escape', () => {
      assert.strictEqual(quoteArg('a"b'), '"ab"');
    });

    test('contains shell separators rather than letting them break out', () => {
      assert.strictEqual(quoteArg('a; rm -rf /'), '"a; rm -rf /"');
      assert.strictEqual(quoteArg('a && b'), '"a && b"');
    });
  });
});
