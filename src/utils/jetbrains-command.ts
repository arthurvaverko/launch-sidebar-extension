/**
 * Builds the shell command for a JetBrains run configuration.
 * Deliberately free of any 'vscode' import so it can be unit tested on its own.
 */

/** The subset of a run configuration needed to construct its command line */
export interface JetBrainsCommandSpec {
  type: string;
  packagePath?: string;
  cmdString?: string;
  scriptText?: string;
  interpreter?: string;
  executeScriptFile?: boolean;
  goParameters?: string;
}

/**
 * Quote an argument so a path or name containing spaces or shell metacharacters
 * cannot break out of the command line.
 * Double quotes are understood by POSIX shells, PowerShell and cmd alike; a literal
 * quote has no portable escape, so it is dropped rather than escaped.
 */
export function quoteArg(value: string): string {
  return `"${value.replace(/"/g, '')}"`;
}

/** True when a value is present and not just whitespace */
function present(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/** Join the parts of a command, dropping the ones that are absent or blank */
function join(...parts: (string | undefined)[]): string {
  return parts.filter(present).join(' ');
}

/**
 * Work out how to run a configuration.
 *
 * Dispatches on the configuration type rather than probing properties in sequence.
 * The previous property-order approach checked `cmdString` first, which meant a shell
 * configuration's SCRIPT_OPTIONS ("--force") and a Go test's parameters ("-run TestFoo")
 * were run as if they were whole commands.
 *
 * @returns The command to send to the terminal, or undefined if it cannot be determined
 */
export function buildJetBrainsCommand(config: JetBrainsCommandSpec): string | undefined {
  // Shell scripts: either run a script file through its interpreter, or run inline text
  if (config.type.includes('ShConfiguration')) {
    if (config.executeScriptFile && config.packagePath) {
      // SCRIPT_OPTIONS are arguments to the script, not a command of their own
      return join(config.interpreter || '/bin/bash', quoteArg(config.packagePath), config.cmdString);
    }
    return present(config.scriptText) ? config.scriptText : undefined;
  }

  // Go applications: go run [parameters] <package> [args]
  if (config.type.includes('GoApplicationRunConfiguration')) {
    if (!config.packagePath) {
      return undefined;
    }
    return join('go run', config.goParameters, config.packagePath, config.cmdString);
  }

  // Go tests: the package goes last, after the test flags
  if (config.type.includes('GoTestRunConfiguration')) {
    if (!config.packagePath) {
      return undefined;
    }
    return join('go test', config.goParameters, config.cmdString, config.packagePath);
  }

  // Any other configuration type: fall back to whatever it gave us, as before
  if (present(config.cmdString)) {
    return config.cmdString;
  }
  if (config.executeScriptFile && config.packagePath) {
    return join(config.interpreter || 'node', quoteArg(config.packagePath));
  }
  return present(config.scriptText) ? config.scriptText : undefined;
}
