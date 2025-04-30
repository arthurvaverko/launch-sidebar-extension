import * as vscode from 'vscode';
import { LaunchItem, RecentItemsManager } from './recent-items';
import { logDebug, logInfo, logWarning, logError } from '../extension';
import { SectionType } from './section-item';

/**
 * Tree item representing the Recent Items section in the sidebar
 */
export class RecentItemsSection extends vscode.TreeItem {
  constructor() {
    super('Recently Used', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'section-recent-items';
    Object.defineProperty(this, 'contextValue', {
      writable: false,
      configurable: false,
      value: 'section-recent-items'
    });
    this.iconPath = new vscode.ThemeIcon('history');
    this.tooltip = 'Recently used launch configurations, scripts, and JetBrains run configurations';
    this.sectionType = SectionType.RECENT;
    // Debug: log contextValue and stack trace
    console.log('[Launch Sidebar] RecentItemsSection constructed with contextValue:', this.contextValue);
  }

  public readonly sectionType: SectionType;
}

/**
 * Tree item wrapper for recent items that maintains their original functionality
 * but adds them to the Recent Items section
 */
export class RecentItemWrapper extends vscode.TreeItem {
  public originalItem: LaunchItem;
  private static recentItemsManager: RecentItemsManager;
  private static refreshTreeView: (() => void) | undefined;
  private static instanceCounter = 0;
  private instanceId: number;

  constructor(item: LaunchItem) {
    super(item.label || 'Unnamed Item', vscode.TreeItemCollapsibleState.None);
    this.originalItem = item;
    this.instanceId = ++RecentItemWrapper.instanceCounter;
    
    logDebug(`Creating RecentItemWrapper #${this.instanceId} for ${item.name} (${item.constructor.name})`);
    
    // Copy properties from the original item
    this.label = item.label;
    this.description = item.description;
    this.tooltip = item.tooltip;
    this.iconPath = item.iconPath;
    
    // Use a special context value to allow targeting recent items specifically
    // This context value must match the menu contributions in package.json
    this.contextValue = `recent-item ${item.contextValue || ''}`.trim();
    
    // Add play and edit actions to the context menu
    // These are handled by the menu contributions in package.json
    // The context value above ensures the correct menu items appear
    // The delete action is already present as 'launch-sidebar.removeRecentItem'
    // No further code is needed here for the icons, as they are defined in package.json

    // Set the default command to run the original item, not the wrapper
    if (item.command) {
      this.command = { ...item.command, arguments: [item] };
    } else if (typeof item.execute === 'function') {
      this.command = {
        title: 'Run',
        command: 'launch-sidebar.runRecentOriginalItem',
        arguments: [item]
      };
    } else {
      this.command = undefined;
    }
  }
  
  /**
   * Sets the RecentItemsManager instance to use for tracking
   */
  public static setRecentItemsManager(manager: RecentItemsManager): void {
    logInfo(`Setting RecentItemsManager: ${!!manager}`);
    if (!manager) {
      logWarning('Warning: manager is undefined or null');
    }
    RecentItemWrapper.recentItemsManager = manager;
  }
  
  /**
   * Sets the refresh function to call when items are updated
   */
  public static setRefreshFunction(refreshFn: () => void): void {
    logInfo(`Setting refresh function: ${!!refreshFn}`);
    if (!refreshFn) {
      logWarning('Warning: refreshFn is undefined or null');
    } else {
      // Test the refresh function to ensure it's callable
      try {
        logDebug('Testing refresh function...');
        RecentItemWrapper.refreshTreeView = refreshFn;
      } catch (e) {
        logError(`Error testing refresh function: ${e}`);
      }
    }
  }
  
  /**
   * Force a refresh of the tree view
   * This is a public method that can be called directly
   */
  public static forceRefresh(): void {
    logDebug(`Force refreshing tree view: ${!!RecentItemWrapper.refreshTreeView}`);
    if (RecentItemWrapper.refreshTreeView) {
      try {
        RecentItemWrapper.refreshTreeView();
        logDebug('Refresh function called successfully');
      } catch (error) {
        logError(`Error during refresh: ${error}`);
      }
    } else {
      logWarning('No refresh function available');
    }
  }
  
  /**
   * Executes the wrapped item's execute method if it exists
   */
  public async execute(): Promise<void> {
    logInfo(`Executing recent item #${this.instanceId}: ${this.originalItem?.name}`);
    
    // Add to recent items, moving this item to the top
    if (RecentItemWrapper.recentItemsManager && this.originalItem) {
      try {
        logDebug(`Adding ${this.originalItem.name} to recent items from #${this.instanceId}`);
        RecentItemWrapper.recentItemsManager.addRecentItem(this.originalItem);
        
        // Refresh the tree view to show updated ordering
        logDebug(`Refreshing tree view after adding ${this.originalItem.name}`);
        RecentItemWrapper.forceRefresh();
      } catch (error) {
        logError(`Error adding ${this.originalItem.name} to recent items: ${error}`);
      }
    } else {
      if (!RecentItemWrapper.recentItemsManager) {
        logWarning('Cannot add to recent items: RecentItemsManager not initialized');
      }
      if (!this.originalItem) {
        logWarning('Cannot add to recent items: originalItem is undefined');
      }
    }
  }

  /**
   * Removes the wrapped item from the recent items
   */
  public async remove(): Promise<void> {
    logInfo(`Removing recent item #${this.instanceId}: ${this.originalItem?.name}`);
    
    if (RecentItemWrapper.recentItemsManager && this.originalItem) {
      try {
        logDebug(`Removing ${this.originalItem.name} from recent items from #${this.instanceId}`);
        RecentItemWrapper.recentItemsManager.removeRecentItem(this.originalItem);
        
        // Refresh the tree view to show updated ordering
        logDebug(`Refreshing tree view after removing ${this.originalItem.name}`);
        RecentItemWrapper.forceRefresh();
      } catch (error) {
        logError(`Error removing ${this.originalItem.name} from recent items: ${error}`);
      }
    } else {
      if (!RecentItemWrapper.recentItemsManager) {
        logWarning('Cannot remove from recent items: RecentItemsManager not initialized');
      }
      if (!this.originalItem) {
        logWarning('Cannot remove from recent items: originalItem is undefined');
      }
    }
  }
}