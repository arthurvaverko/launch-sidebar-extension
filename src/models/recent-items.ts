import * as vscode from 'vscode';
import { LaunchConfigurationItem } from './launch-items';
import { ScriptItem } from './script-item';
import { JetBrainsRunConfigItem } from './jetbrains-items';
import { MakefileTaskItem } from './makefile-task-item';
import { logDebug, logInfo, logWarning, logError } from '../extension';

/**
 * Type alias for the different types of items that can be in the recent items list
 */
export type LaunchItem = LaunchConfigurationItem | ScriptItem | JetBrainsRunConfigItem | MakefileTaskItem;

/**
 * Maximum number of recent items to keep track of
 */
const MAX_RECENT_ITEMS = 10;

/**
 * Storage key for recent items
 */
const RECENT_ITEMS_STORAGE_KEY = 'recentItems';

/**
 * Interface representing serialized recent item data
 */
interface SerializedRecentItem {
  name: string;
  type: string;
  itemType: 'launch' | 'script' | 'jetbrains' | 'makefile-task';
  // Additional properties based on item type
  scriptCommand?: string;
  packageJsonPath?: string;
  configuration?: object;
  xmlFilePath?: string;
  workspaceFolderName?: string;
  workspaceFolderPath?: string;
  makefilePath?: string;
  recipe?: string;
  // Additional JetBrains properties
  packagePath?: string;
  cmdString?: string;
  workingDirectory?: string;
  scriptText?: string;
  interpreter?: string;
  executeInTerminal?: boolean;
  executeScriptFile?: boolean;
  goParameters?: string;
  envVars?: Record<string, string>;
}

/**
 * Manages the list of recently run items
 */
export class RecentItemsManager {
  private recentItems: LaunchItem[] = [];
  private context: vscode.ExtensionContext;
  private _onDidChangeRecentItems: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  readonly onDidChangeRecentItems: vscode.Event<void> = this._onDidChangeRecentItems.event;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    logInfo('Initializing RecentItemsManager');
    this.loadRecentItems();
  }
  
  /**
   * Adds an item to the recent items list
   * If the item already exists, it is moved to the beginning of the list
   * If the list is at max capacity, the oldest item is removed
   */
  public addRecentItem(item: LaunchItem): void {
    try {
      logInfo(`Adding recent item: ${item.name} (${item.constructor.name})`);
      
      // Remove the item if it already exists to avoid duplicates
      const initialLength = this.recentItems.length;
      this.recentItems = this.recentItems.filter(
        existing => !(existing.name === item.name && 
                     existing.constructor.name === item.constructor.name)
      );
      const afterFilterLength = this.recentItems.length;
      
      if (initialLength !== afterFilterLength) {
        logDebug(`Removed existing item "${item.name}" from position ${initialLength - afterFilterLength}`);
      }
      
      // Add the new item at the beginning
      this.recentItems.unshift(item);
      logDebug(`Added "${item.name}" to top of recent items list (total: ${this.recentItems.length})`);
      
      // Keep only MAX_RECENT_ITEMS
      if (this.recentItems.length > MAX_RECENT_ITEMS) {
        const removed = this.recentItems.pop();
        logDebug(`Removed oldest item "${removed?.name}" to maintain max size of ${MAX_RECENT_ITEMS}`);
      }
      
      // Save to storage
      this.saveRecentItems();
      
      // Notify listeners
      logDebug('Firing onDidChangeRecentItems event');
      this._onDidChangeRecentItems.fire();
    } catch (error) {
      logError(`Error adding recent item: ${error}`);
    }
  }
  
  /**
   * Removes a specific item from the recent items list
   */
  public removeRecentItem(item: LaunchItem): void {
    try {
      logInfo(`Removing item: ${item.name} (${item.constructor.name})`);
      const countBefore = this.recentItems.length;
      
      this.recentItems = this.recentItems.filter(
        existing => !(existing.name === item.name && 
                     existing.constructor.name === item.constructor.name)
      );
      
      const countAfter = this.recentItems.length;
      const itemsRemoved = countBefore - countAfter;
      
      if (itemsRemoved > 0) {
        logInfo(`Removed ${itemsRemoved} items, ${countAfter} remain`);
        
        // Save to storage
        this.saveRecentItems();
        
        // Notify listeners
        logDebug('Firing onDidChangeRecentItems event for item removal');
        this._onDidChangeRecentItems.fire();
      } else {
        logWarning(`Item "${item.name}" not found in recent items list, nothing removed`);
      }
    } catch (error) {
      logError(`Error removing recent item: ${error}`);
    }
  }
  
  /**
   * Gets the list of recent items
   * Items are returned in order of most recently used first
   */
  public getRecentItems(): LaunchItem[] {
    logDebug(`Getting recent items list (count: ${this.recentItems.length})`);
    // Return a copy of the recentItems array (already in most-recent-first order)
    return [...this.recentItems];
  }
  
  /**
   * Loads the recent items from extension storage
   */
  private loadRecentItems(): void {
    try {
      logDebug('Loading recent items from storage');
      // Log all available workspace folders
      const workspaceFolders = vscode.workspace.workspaceFolders || [];
      logDebug(`Workspace folders detected: ${workspaceFolders.map(f => `${f.name} (${f.uri.fsPath})`).join(', ')}`);
      const serializedItems = this.context.globalState.get<SerializedRecentItem[]>(RECENT_ITEMS_STORAGE_KEY, []);
      logDebug(`[PERSISTENCE] Found ${serializedItems.length} stored items in key '${RECENT_ITEMS_STORAGE_KEY}': ${JSON.stringify(serializedItems, null, 2)}`);
      this.recentItems = [];
      let loadedCount = 0;
      let skippedCount = 0;
      for (const item of serializedItems) {
        // Find the workspace folder by name and path
        let workspaceFolder: vscode.WorkspaceFolder | undefined;
        if (item.workspaceFolderName && item.workspaceFolderPath) {
          workspaceFolder = vscode.workspace.workspaceFolders?.find(
            folder => folder.name === item.workspaceFolderName && 
                     folder.uri.fsPath === item.workspaceFolderPath
          );
        }
        // Skip if workspace folder was not found
        if (!workspaceFolder && (item.itemType === 'launch' || item.itemType === 'script' || item.itemType === 'jetbrains' || item.itemType === 'makefile-task')) {
          logDebug(`Skipping item "${item.name}" - workspace folder not found. Looking for name: "${item.workspaceFolderName}", path: "${item.workspaceFolderPath}". Available folders: ${workspaceFolders.map(f => `${f.name} (${f.uri.fsPath})`).join(', ')}`);
          skippedCount++;
          continue;
        }
        
        // Create the appropriate item type
        try {
          if (item.itemType === 'launch' && item.configuration && workspaceFolder) {
            this.recentItems.push(new LaunchConfigurationItem(
              item.name,
              item.type,
              item.configuration as vscode.DebugConfiguration,
              workspaceFolder
            ));
            loadedCount++;
          } else if (item.itemType === 'script' && item.scriptCommand && item.packageJsonPath && workspaceFolder) {
            this.recentItems.push(new ScriptItem(
              item.name,
              item.scriptCommand,
              item.packageJsonPath,
              workspaceFolder
            ));
            loadedCount++;
          } else if (item.itemType === 'jetbrains' && item.xmlFilePath && workspaceFolder) {
            this.recentItems.push(new JetBrainsRunConfigItem(
              item.name,
              item.type,
              item.xmlFilePath,
              workspaceFolder,
              item.packagePath,
              item.cmdString,
              item.workingDirectory,
              item.scriptText,
              item.interpreter,
              item.executeInTerminal,
              item.executeScriptFile,
              item.goParameters,
              item.envVars
            ));
            loadedCount++;
          } else if (item.itemType === 'makefile-task' && item.makefilePath && workspaceFolder) {
            this.recentItems.push(new MakefileTaskItem(
              item.name,
              item.makefilePath,
              workspaceFolder,
              item.recipe
            ));
            loadedCount++;
          } else {
            logDebug(`Skipping item "${item.name}" - missing required properties for type ${item.itemType}`);
            skippedCount++;
          }
        } catch (itemError) {
          logWarning(`Error recreating item "${item.name}": ${itemError}`);
          skippedCount++;
        }
      }
      
      logInfo(`Loaded ${loadedCount} recent items (skipped ${skippedCount})`);
    } catch (error) {
      logError(`Error loading recent items: ${error}`);
      this.recentItems = [];
    }
  }
  
  /**
   * Saves the recent items to extension storage
   */
  private saveRecentItems(): void {
    try {
      logDebug(`Saving ${this.recentItems.length} recent items to storage`);
      const serializedItems: SerializedRecentItem[] = this.recentItems.map(item => {
        const baseItem: SerializedRecentItem = {
          name: item.name,
          type: item instanceof LaunchConfigurationItem ? item.type : 
                item instanceof JetBrainsRunConfigItem ? item.type : 'npm-script',
          itemType: item instanceof LaunchConfigurationItem ? 'launch' :
                   item instanceof ScriptItem ? 'script' :
                   item instanceof JetBrainsRunConfigItem ? 'jetbrains' : 'makefile-task',
          workspaceFolderName: item.workspaceFolder?.name,
          workspaceFolderPath: item.workspaceFolder?.uri.fsPath
        };
        
        // Add type-specific properties
        if (item instanceof LaunchConfigurationItem) {
          baseItem.configuration = item.configuration;
        } else if (item instanceof ScriptItem) {
          baseItem.scriptCommand = item.script;
          baseItem.packageJsonPath = item.packageJsonPath;
        } else if (item instanceof JetBrainsRunConfigItem) {
          baseItem.xmlFilePath = item.xmlFilePath;
          // Save all the additional properties needed for execution
          baseItem.packagePath = item.packagePath;
          baseItem.cmdString = item.cmdString;
          baseItem.workingDirectory = item.workingDirectory;
          baseItem.scriptText = item.scriptText;
          baseItem.interpreter = item.interpreter;
          baseItem.executeInTerminal = item.executeInTerminal;
          baseItem.executeScriptFile = item.executeScriptFile;
          baseItem.goParameters = item.goParameters;
          baseItem.envVars = item.envVars;
        } else if (item instanceof MakefileTaskItem) {
          baseItem.makefilePath = item.makefilePath;
          baseItem.recipe = item.recipe;
        }
        
        return baseItem;
      });
      logDebug(`[PERSISTENCE] Saving to key '${RECENT_ITEMS_STORAGE_KEY}': ${JSON.stringify(serializedItems, null, 2)}`);
      this.context.globalState.update(RECENT_ITEMS_STORAGE_KEY, serializedItems);
      logDebug('Recent items saved successfully');
    } catch (error) {
      logError(`Error saving recent items: ${error}`);
    }
  }
  
  /**
   * Clears the recent items list
   */
  public clearRecentItems(): void {
    logInfo('Clearing all recent items');
    this.recentItems = [];
    this.saveRecentItems();
    
    // Notify listeners
    logDebug('Firing onDidChangeRecentItems event for clear operation');
    this._onDidChangeRecentItems.fire();
  }
} 