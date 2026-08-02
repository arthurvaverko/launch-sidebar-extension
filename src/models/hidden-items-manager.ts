import * as vscode from 'vscode';
import { logInfo, logDebug } from '../extension';

/**
 * Interface defining the structure of a hidden item
 */
export interface HiddenItem {
  id: string;        // Unique identifier for the item
  name: string;      // Display name of the item
  type: string;      // Type of the item (script, launch config, etc.)
  path?: string;     // Path to the item's configuration file
  folder?: string;   // Workspace folder containing the item
  isSection?: boolean; // Whether this is a section rather than an individual item
}

/**
 * Manages the list of hidden items for the Launch Sidebar extension
 */
export class HiddenItemsManager {
  private _hiddenItems: HiddenItem[] = [];
  private _hiddenSections: HiddenItem[] = [];
  private readonly _itemsStorageKey = 'launchSidebar.hiddenItems';
  private readonly _sectionsStorageKey = 'launchSidebar.hiddenSections';
  private _context: vscode.ExtensionContext;
  private _onDidChangeHiddenItems: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  
  /**
   * Event that fires when the hidden items list changes
   */
  readonly onDidChangeHiddenItems: vscode.Event<void> = this._onDidChangeHiddenItems.event;
  
  /**
   * Constructor
   * @param context The extension context used for storage
   */
  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this.loadHiddenItems();
    this.loadHiddenSections();
  }
  
  /**
   * Read a stored list, preferring this workspace's own value.
   *
   * Hidden items used to live in globalState, which meant hiding an OS-specific launch
   * configuration in one workspace hid it in every other workspace too. They are now kept
   * per workspace; a workspace that has never stored anything falls back to the old global
   * list once, so upgrading users keep what they had hidden. From the first change onwards
   * the workspace has its own copy and the global list is no longer consulted.
   */
  private load(storageKey: string): HiddenItem[] {
    const workspaceValue = this._context.workspaceState.get<HiddenItem[]>(storageKey);
    if (workspaceValue) {
      return workspaceValue;
    }
    return this._context.globalState.get<HiddenItem[]>(storageKey) ?? [];
  }

  /**
   * Load hidden items from storage
   */
  private loadHiddenItems(): void {
    try {
      this._hiddenItems = this.load(this._itemsStorageKey);
      logInfo(`Loaded ${this._hiddenItems.length} hidden items from storage`);
    } catch (error) {
      logInfo(`Error loading hidden items: ${error}`);
      this._hiddenItems = [];
    }
  }

  /**
   * Load hidden sections from storage
   */
  private loadHiddenSections(): void {
    try {
      this._hiddenSections = this.load(this._sectionsStorageKey);
      logInfo(`Loaded ${this._hiddenSections.length} hidden sections from storage`);
    } catch (error) {
      logInfo(`Error loading hidden sections: ${error}`);
      this._hiddenSections = [];
    }
  }

  /**
   * Save hidden items to storage
   */
  private saveHiddenItems(): void {
    this._context.workspaceState.update(this._itemsStorageKey, this._hiddenItems);
    logDebug(`Saved ${this._hiddenItems.length} hidden items to storage`);
    this._onDidChangeHiddenItems.fire();
  }

  /**
   * Save hidden sections to storage
   */
  private saveHiddenSections(): void {
    this._context.workspaceState.update(this._sectionsStorageKey, this._hiddenSections);
    logDebug(`Saved ${this._hiddenSections.length} hidden sections to storage`);
    this._onDidChangeHiddenItems.fire();
  }
  
  /**
   * Add an item to the hidden items list
   * @param item The item to hide
   */
  public hideItem(item: HiddenItem): void {
    // Check if item is already hidden
    if (!this.isItemHidden(item.id)) {
      this._hiddenItems.push(item);
      logInfo(`Hidden item: ${item.name} (${item.type})`);
      this.saveHiddenItems();
    }
  }

  /**
   * Add a section to the hidden sections list
   * @param section The section to hide
   */
  public hideSection(section: HiddenItem): void {
    // Check if section is already hidden
    if (!this.isSectionHidden(section.id)) {
      section.isSection = true;
      this._hiddenSections.push(section);
      logInfo(`Hidden section: ${section.name} (${section.type})`);
      this.saveHiddenSections();
    }
  }
  
  /**
   * Remove an item from the hidden items list
   * @param itemId The ID of the item to restore
   */
  public restoreItem(itemId: string): void {
    const initialLength = this._hiddenItems.length;
    this._hiddenItems = this._hiddenItems.filter(item => item.id !== itemId);
    
    if (initialLength !== this._hiddenItems.length) {
      logInfo(`Restored item with ID: ${itemId}`);
      this.saveHiddenItems();
    }
  }

  /**
   * Remove a section from the hidden sections list
   * @param sectionId The ID of the section to restore
   */
  public restoreSection(sectionId: string): void {
    const initialLength = this._hiddenSections.length;
    this._hiddenSections = this._hiddenSections.filter(section => section.id !== sectionId);
    
    if (initialLength !== this._hiddenSections.length) {
      logInfo(`Restored section with ID: ${sectionId}`);
      this.saveHiddenSections();
    }
  }
  
  /**
   * Check if an item is hidden
   * @param itemId The ID of the item to check
   * @returns True if the item is hidden, false otherwise
   */
  public isItemHidden(itemId: string): boolean {
    return this._hiddenItems.some(item => item.id === itemId);
  }

  /**
   * Check if a section is hidden
   * @param sectionId The ID of the section to check
   * @returns True if the section is hidden, false otherwise
   */
  public isSectionHidden(sectionId: string): boolean {
    return this._hiddenSections.some(section => section.id === sectionId);
  }
  
  /**
   * Get all hidden items
   * @returns Array of hidden items
   */
  public getHiddenItems(): HiddenItem[] {
    return [...this._hiddenItems];
  }

  /**
   * Get all hidden sections
   * @returns Array of hidden sections
   */
  public getHiddenSections(): HiddenItem[] {
    return [...this._hiddenSections];
  }

  /**
   * Clear all hidden items
   */
  public clearHiddenItems(): void {
    if (this._hiddenItems.length > 0) {
      this._hiddenItems = [];
      logInfo('Cleared all hidden items');
      this.saveHiddenItems();
    }
  }

  /**
   * Clear all hidden sections
   */
  public clearHiddenSections(): void {
    if (this._hiddenSections.length > 0) {
      this._hiddenSections = [];
      logInfo('Cleared all hidden sections');
      this.saveHiddenSections();
    }
  }

  /**
   * Clear all hidden items and sections
   */
  public clearAllHidden(): void {
    this.clearHiddenItems();
    this.clearHiddenSections();
  }
} 