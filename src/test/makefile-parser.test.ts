import * as assert from 'assert';
import { parseMakefileTargets } from '../utils/makefile-parser';

// No 'vscode' import on purpose: parseMakefileTargets is pure.

const names = (content: string): string[] => parseMakefileTargets(content).map(t => t.name);
const recipeOf = (content: string, name: string): string | undefined =>
  parseMakefileTargets(content).find(t => t.name === name)?.recipe;

suite('parseMakefileTargets', () => {
  test('variable assignments are not targets', () => {
    assert.deepStrictEqual(names('VERSION:=1.0'), []);
    assert.deepStrictEqual(names('NAME = value'), []);
    assert.deepStrictEqual(names('OTHER ?= value'), []);
    assert.deepStrictEqual(names('FLAGS += -g'), []);
    assert.deepStrictEqual(names('LATE ::= value'), []);
    assert.deepStrictEqual(names('export FOO=bar'), []);
  });

  test('assignments mixed with real rules only yield the rules', () => {
    const content = [
      'VERSION:=1.0',
      'CFLAGS += -Wall',
      '',
      'build:',
      '\tgo build ./...',
      ''
    ].join('\n');
    assert.deepStrictEqual(names(content), ['build']);
  });

  test('dots are legal in target names', () => {
    assert.deepStrictEqual(names('build.all:\n\techo hi\n'), ['build.all']);
  });

  test('multiple targets on one line share the recipe', () => {
    const parsed = parseMakefileTargets('a b c:\n\techo shared\n');
    assert.deepStrictEqual(parsed.map(t => t.name), ['a', 'b', 'c']);
    for (const target of parsed) {
      assert.strictEqual(target.recipe, 'echo shared');
    }
  });

  test('pattern rules are skipped', () => {
    assert.deepStrictEqual(names('%.o: %.c\n\tgcc -c $<\n'), []);
    // A pattern rule next to a real target must not swallow the real target
    assert.deepStrictEqual(names('%.o: %.c\n\tgcc -c $<\n\nall: main.o\n\tgcc -o app main.o\n'), ['all']);
  });

  test('dot-directives are skipped', () => {
    const content = [
      '.PHONY: all clean',
      '.DEFAULT_GOAL := help',
      '.SUFFIXES:',
      'all:',
      '\techo a'
    ].join('\n');
    assert.deepStrictEqual(names(content), ['all']);
  });

  test('double-colon rules still yield the target', () => {
    const parsed = parseMakefileTargets('all:: dep\n\techo d\n');
    assert.deepStrictEqual(parsed, [{ name: 'all', recipe: 'echo d' }]);
  });

  test('prerequisites are not treated as targets', () => {
    assert.deepStrictEqual(names('test: build lint\n\techo t\n'), ['test']);
  });

  test('recipe collects the indented lines and stops at the next rule', () => {
    const content = [
      'build:',
      '\techo one',
      '\techo two',
      'other:',
      '\techo three'
    ].join('\n');
    assert.strictEqual(recipeOf(content, 'build'), 'echo one\necho two');
    assert.strictEqual(recipeOf(content, 'other'), 'echo three');
  });

  test('recipe lines are trimmed and joined with newlines', () => {
    const content = 'help:\n\t@echo "usage"\n    @echo "more"\n';
    assert.strictEqual(recipeOf(content, 'help'), '@echo "usage"\n@echo "more"');
  });

  test('recipe stops at a non-indented line that is not a rule', () => {
    const content = 'build:\n\techo one\n# top level comment\n\techo two\n';
    assert.strictEqual(recipeOf(content, 'build'), 'echo one');
  });

  test('indented comments are skipped, not treated as the end of the recipe', () => {
    assert.strictEqual(recipeOf('build:\n\t# a comment\n\techo one\n\techo two\n', 'build'), 'echo one\necho two');
    assert.strictEqual(recipeOf('build:\n\techo one\n\t# a comment\n\techo two\n', 'build'), 'echo one\necho two');
  });

  test('blank lines inside a recipe are tolerated, as make does', () => {
    assert.strictEqual(recipeOf('build:\n\techo one\n\n\techo two\n', 'build'), 'echo one\necho two');
  });

  test('a blank line followed by the next rule still ends the recipe', () => {
    const content = 'build:\n\techo one\n\ntest:\n\techo two\n';
    assert.strictEqual(recipeOf(content, 'build'), 'echo one');
    assert.strictEqual(recipeOf(content, 'test'), 'echo two');
  });

  test('a target with no recipe yields an empty recipe', () => {
    assert.deepStrictEqual(parseMakefileTargets('build:\n'), [{ name: 'build', recipe: '' }]);
    assert.deepStrictEqual(parseMakefileTargets('build:'), [{ name: 'build', recipe: '' }]);
  });

  test('empty and whitespace-only input do not throw', () => {
    assert.deepStrictEqual(parseMakefileTargets(''), []);
    assert.deepStrictEqual(parseMakefileTargets('   \n\t\n\n'), []);
    assert.deepStrictEqual(parseMakefileTargets('\n'), []);
  });

  test('non-rule lines such as includes are ignored', () => {
    assert.deepStrictEqual(names('include common.mk\nbuild:\n\techo x\n'), ['build']);
  });

  test('CRLF line endings still parse', () => {
    assert.deepStrictEqual(parseMakefileTargets('build:\r\n\techo x\r\n'), [{ name: 'build', recipe: 'echo x' }]);
  });

  test('a realistic Makefile parses to exactly its targets', () => {
    const content = [
      '# Project makefile',
      'SHELL := /bin/bash',
      'VERSION:=1.0',
      'BINARY ?= app',
      '',
      '.PHONY: all build test clean',
      '',
      'all: build test',
      '',
      'build:',
      '\tgo build -o $(BINARY) ./cmd/app',
      '',
      'build.all:',
      '\tGOOS=linux go build ./...',
      '\tGOOS=darwin go build ./...',
      '',
      'test lint:',
      '\tgo test ./...',
      '',
      '%.o: %.c',
      '\tgcc -c $<',
      '',
      'clean:',
      '\trm -f $(BINARY)'
    ].join('\n');

    assert.deepStrictEqual(names(content), ['all', 'build', 'build.all', 'test', 'lint', 'clean']);
    assert.strictEqual(recipeOf(content, 'all'), '');
    assert.strictEqual(recipeOf(content, 'build'), 'go build -o $(BINARY) ./cmd/app');
    assert.strictEqual(recipeOf(content, 'build.all'), 'GOOS=linux go build ./...\nGOOS=darwin go build ./...');
    assert.strictEqual(recipeOf(content, 'test'), 'go test ./...');
    assert.strictEqual(recipeOf(content, 'lint'), 'go test ./...');
    assert.strictEqual(recipeOf(content, 'clean'), 'rm -f $(BINARY)');
  });
});
