/**
 * Pure Makefile target parsing. Deliberately free of any 'vscode' import so it can be
 * unit tested on its own.
 */

/** A runnable Makefile target and the recipe lines that follow it */
export interface MakefileTarget {
  name: string;
  recipe: string;
}

// A rule line: not indented, not a comment, `targets: prerequisites` or `targets:: prerequisites`.
// The negative lookahead on `:=` / `::=` keeps `VERSION:=1.0` style variable assignments out.
const RULE_LINE = /^(?![ \t#])([^:=\n]+?)::?(?!=)([^\n]*)$/;

// Variable assignment forms that are not rules at all: NAME = / := / ::= / ?= / +=
const ASSIGNMENT_LINE = /^[^:=\n]*(::=|:=|\?=|\+=|=)/;

/**
 * Parse the runnable targets out of a Makefile's contents.
 * Skips variable assignments, pattern rules (`%.o: %.c`) and dot-directives (`.PHONY`),
 * and supports multiple targets declared on one line (`a b c:`).
 */
export function parseMakefileTargets(content: string): MakefileTarget[] {
  const targets: MakefileTarget[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // `NAME ?= value` and friends look like nothing else; drop them before the rule test
    if (ASSIGNMENT_LINE.test(line)) {
      continue;
    }

    const match = RULE_LINE.exec(line);
    if (!match) {
      continue;
    }

    // Recipe: the indented, non-comment lines directly below the rule.
    // Blank lines and indented comments are ignored rather than ending the recipe,
    // matching how make itself treats them; the first unindented line ends it.
    const recipeLines: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      if (next.trim() === '' || /^\s+#/.test(next)) {
        continue;
      }
      if (!/^\s+/.test(next)) {
        break;
      }
      recipeLines.push(next.trim());
    }
    const recipe = recipeLines.join('\n');

    for (const name of match[1].trim().split(/\s+/)) {
      // Skip pattern rules and dot-directives (.PHONY, .DEFAULT_GOAL, .SUFFIXES, ...)
      if (name.includes('%') || name.startsWith('.')) {
        continue;
      }
      targets.push({ name, recipe });
    }
  }

  return targets;
}
