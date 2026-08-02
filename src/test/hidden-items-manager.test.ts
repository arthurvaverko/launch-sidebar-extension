import * as assert from 'assert';
import * as vscode from 'vscode';
import { HiddenItemsManager, HiddenItem } from '../models/hidden-items-manager';

const ITEMS_KEY = 'launchSidebar.hiddenItems';
const SECTIONS_KEY = 'launchSidebar.hiddenSections';

/** A Memento backed by a plain object, enough for HiddenItemsManager */
class FakeMemento {
  constructor(private store: Record<string, unknown> = {}) {}
  keys(): readonly string[] { return Object.keys(this.store); }
  get<T>(key: string, defaultValue?: T): T | undefined {
    return (key in this.store ? this.store[key] : defaultValue) as T | undefined;
  }
  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      delete this.store[key];
    } else {
      this.store[key] = value;
    }
    return Promise.resolve();
  }
  setKeysForSync(): void { /* not used */ }
}

/** Build a context whose two state stores can be inspected independently */
function fakeContext(global: Record<string, unknown> = {}, workspace: Record<string, unknown> = {}) {
  const globalState = new FakeMemento(global);
  const workspaceState = new FakeMemento(workspace);
  const context = { globalState, workspaceState } as unknown as vscode.ExtensionContext;
  return { context, globalState, workspaceState };
}

const item = (id: string): HiddenItem => ({ id, name: id, type: 'configuration' });

/**
 * Issue #2: hidden items were stored in globalState, so hiding an OS-specific launch
 * configuration in one workspace hid it in every other workspace. They now live in
 * workspaceState, with a one-time read-through to the old global list so upgrading
 * users do not suddenly see everything they had hidden reappear.
 */
suite('HiddenItemsManager storage', () => {
  test('hiding an item writes to workspace state, not global state', () => {
    const { context, globalState, workspaceState } = fakeContext();
    const manager = new HiddenItemsManager(context);

    manager.hideItem(item('linux-only'));

    assert.deepStrictEqual(workspaceState.get<HiddenItem[]>(ITEMS_KEY)?.map(i => i.id), ['linux-only']);
    assert.strictEqual(globalState.get(ITEMS_KEY), undefined, 'global state must not be written');
  });

  test('hiding a section writes to workspace state, not global state', () => {
    const { context, globalState, workspaceState } = fakeContext();
    const manager = new HiddenItemsManager(context);

    manager.hideSection({ ...item('section-scripts'), isSection: true });

    assert.deepStrictEqual(workspaceState.get<HiddenItem[]>(SECTIONS_KEY)?.map(i => i.id), ['section-scripts']);
    assert.strictEqual(globalState.get(SECTIONS_KEY), undefined, 'global state must not be written');
  });

  test('two workspaces no longer share hidden items', () => {
    const shared: Record<string, unknown> = {};
    const workspaceA = new HiddenItemsManager(fakeContext(shared, {}).context);
    workspaceA.hideItem(item('mac-only'));

    // A different workspace: same global store, its own workspace store
    const workspaceB = new HiddenItemsManager(fakeContext(shared, {}).context);
    assert.strictEqual(workspaceB.isItemHidden('mac-only'), false);
    assert.strictEqual(workspaceA.isItemHidden('mac-only'), true);
  });

  test('an upgrading workspace inherits what was hidden globally', () => {
    const { context } = fakeContext({ [ITEMS_KEY]: [item('legacy')], [SECTIONS_KEY]: [item('legacy-section')] });
    const manager = new HiddenItemsManager(context);

    assert.strictEqual(manager.isItemHidden('legacy'), true);
    assert.strictEqual(manager.isSectionHidden('legacy-section'), true);
  });

  test('once the workspace has its own list, the global one is ignored', () => {
    const { context, workspaceState } = fakeContext(
      { [ITEMS_KEY]: [item('legacy')] },
      { [ITEMS_KEY]: [item('mine')] }
    );
    const manager = new HiddenItemsManager(context);

    assert.strictEqual(manager.isItemHidden('mine'), true);
    assert.strictEqual(manager.isItemHidden('legacy'), false);
    assert.deepStrictEqual(workspaceState.get<HiddenItem[]>(ITEMS_KEY)?.map(i => i.id), ['mine']);
  });

  test('restoring a migrated item sticks instead of reappearing from global state', () => {
    // The regression that matters: clearing must not fall back through to the old list
    const { context } = fakeContext({ [ITEMS_KEY]: [item('legacy')] });
    const manager = new HiddenItemsManager(context);
    assert.strictEqual(manager.isItemHidden('legacy'), true);

    manager.restoreItem('legacy');
    assert.strictEqual(manager.isItemHidden('legacy'), false);

    // A fresh manager over the same context must agree
    assert.strictEqual(new HiddenItemsManager(context).isItemHidden('legacy'), false);
  });

  test('clearing everything survives a reload', () => {
    const { context } = fakeContext({ [ITEMS_KEY]: [item('a')], [SECTIONS_KEY]: [item('s')] });
    const manager = new HiddenItemsManager(context);
    assert.strictEqual(manager.getHiddenItems().length + manager.getHiddenSections().length, 2);

    manager.clearAllHidden();

    const reloaded = new HiddenItemsManager(context);
    assert.deepStrictEqual(reloaded.getHiddenItems(), []);
    assert.deepStrictEqual(reloaded.getHiddenSections(), []);
  });
});
