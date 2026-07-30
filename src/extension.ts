/**
 * Launch Sidebar Extension
 * 
 * Adds a sidebar view to display and quickly launch debug configurations and npm scripts
 * from a workspace with just a single click.
 */
import * as vscode from 'vscode';
import * as path from 'path';

import { LaunchConfigurationItem } from './models/launch-items';
import { ScriptItem } from './models/script-item';
import { JetBrainsRunConfigItem } from './models/jetbrains-items';
import { LaunchConfigurationProvider } from './providers/launch-configuration-provider';
import { RecentItemsManager } from './models/recent-items';
import { RecentItemWrapper } from './models/recent-items-section';
import { MakefileTaskItem } from './models/makefile-task-item';
import { HiddenItemsManager, HiddenItem } from './models/hidden-items-manager';
import { SectionItem } from './models/section-item';
import { buildJetBrainsCommand, quoteArg } from './utils/jetbrains-command';

// Create a dedicated output channel for logging
export const outputChannel = vscode.window.createOutputChannel('Launch Sidebar');

/**
 * Helper function for logging to the output channel and console
 * @param message Message to log
 * @param tag Optional category tag for filtering logs
 */
export function log(message: string, tag: string = 'INFO'): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] [${tag}] ${message}`;
  outputChannel.appendLine(formattedMessage);
}

// Enhanced logger functions for different log levels
export function logDebug(message: string): void {
  log(message, 'DEBUG');
}

export function logInfo(message: string): void {
  log(message, 'INFO');
}

export function logWarning(message: string): void {
  log(message, 'WARNING');
}

export function logError(message: string): void {
  log(message, 'ERROR');
}

/**
 * Terminal manager to track and reuse terminals
 */
class TerminalManager {
  private terminals: Map<string, vscode.Terminal> = new Map();

  /**
   * Get or create a terminal for a specific task
   * @param name The name of the terminal
   * @param cwd The working directory for the terminal
   * @param env Optional environment variables to seed the terminal with
   * @returns A terminal instance (either existing or new)
   */
  public getOrCreateTerminal(name: string, cwd: string, env?: Record<string, string>): vscode.Terminal {
    // Create a unique key for this terminal based on name, working directory and env.
    // The env is part of the key so a cached terminal is never reused with stale variables.
    const terminalKey = `${name}:${cwd}:${env ? JSON.stringify(env) : ''}`;

    // Check if we already have this terminal
    if (this.terminals.has(terminalKey)) {
      const terminal = this.terminals.get(terminalKey);

      // Verify the terminal still exists (not closed by user)
      if (terminal && this.isTerminalStillAlive(terminal)) {
        log(`Reusing existing terminal: ${name}`);
        return terminal;
      }
    }

    // Create a new terminal
    log(`Creating new terminal: ${name} in ${cwd}`);
    const terminal = vscode.window.createTerminal({
      name,
      cwd,
      env
    });

    // Store it for future reuse
    this.terminals.set(terminalKey, terminal);

    return terminal;
  }
  
  /**
   * Check if a terminal is still alive (not disposed)
   */
  private isTerminalStillAlive(terminal: vscode.Terminal): boolean {
    // Get current terminals from vscode
    const activeTerminals = vscode.window.terminals;
    
    // Check if our terminal is still in the list
    return activeTerminals.includes(terminal);
  }
  
  /**
   * Remove disposed terminals from the tracking
   */
  public cleanupTerminals(): void {
    // Create a new map with only the active terminals
    const newMap = new Map<string, vscode.Terminal>();
    
    for (const [key, terminal] of this.terminals.entries()) {
      if (this.isTerminalStillAlive(terminal)) {
        newMap.set(key, terminal);
      }
    }
    
    this.terminals = newMap;
  }
}

// Create a global terminal manager instance
export const terminalManager = new TerminalManager();

/**
 * Activates the extension
 * Sets up the sidebar view, tree data provider, and command handlers
 */
export function activate(context: vscode.ExtensionContext) {
  logInfo('=== Launch Sidebar Extension Activating ===');
  logInfo(`VS Code version: ${vscode.version}`);
  logInfo(`Extension path: ${context.extensionPath}`);
  
  try {
    // Check workspace info
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    logInfo(`Workspace folders: ${workspaceFolders.length}`);
    workspaceFolders.forEach((folder, index) => {
      logInfo(`Workspace #${index + 1}: ${folder.name} (${folder.uri.fsPath})`);
    });
  
    // Create the recent items manager
    logInfo('Creating RecentItemsManager');
    const recentItemsManager = new RecentItemsManager(context);
    
    // Create the hidden items manager
    logInfo('Creating HiddenItemsManager');
    const hiddenItemsManager = new HiddenItemsManager(context);
    
    // Create tree data provider and register views
    logInfo('Creating LaunchConfigurationProvider');
    const launchProvider = new LaunchConfigurationProvider(recentItemsManager);
    
    // Set the hidden items manager reference in the provider
    launchProvider.setHiddenItemsManager(hiddenItemsManager);
    
    // Initialize the static RecentItemsManager reference
    logInfo('Setting up RecentItemWrapper static references');
    RecentItemWrapper.setRecentItemsManager(recentItemsManager);
    
    // Create a bound refresh function that won't lose context
    const boundRefresh = () => {
      logDebug('Bound refresh function called');
      launchProvider.refresh();
    };
    
    // Set the refresh function
    RecentItemWrapper.setRefreshFunction(boundRefresh);
  
    // Register terminal closed event to cleanup terminal references
    logInfo('Registering event listeners');
    context.subscriptions.push(
      vscode.window.onDidCloseTerminal(() => {
        logDebug('Terminal closed, cleaning up');
        terminalManager.cleanupTerminals();
      })
    );
    
    // Register the view containers and tree views
    logInfo('Registering tree view and commands');
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('launchConfigurations', launchProvider),
      vscode.commands.registerCommand('launch-sidebar.runRecentOriginalItem', (item: any) => {
        const original = item && item.originalItem ? item.originalItem : item;
        logInfo(`Running original recent item: ${original?.name}`);
        if (original && typeof original.execute === 'function') {
          original.execute();
        } else if (original && original.command) {
          vscode.commands.executeCommand(original.command.command, original);
        } else {
          logWarning('No execute method or command found for recent original item');
        }
      }),
      vscode.commands.registerCommand('launch-sidebar.editRecentOriginalItem', (item: any) => {
        const original = item && item.originalItem ? item.originalItem : item;
        logInfo(`Editing original recent item: ${original?.name}`);
        if (original && typeof original.edit === 'function') {
          original.edit();
        } else if (original && original.command) {
          if (original.command.command && original.command.command.includes('edit')) {
            vscode.commands.executeCommand(original.command.command, original);
          } else {
            vscode.window.showWarningMessage('No edit method or command found for recent original item');
          }
        } else {
          vscode.window.showWarningMessage('No edit method or command found for recent original item');
        }
      }),
      vscode.commands.registerCommand('launch-sidebar.removeRecentItem', (wrapper: RecentItemWrapper) => {
        logInfo(`Removing recent item: ${wrapper.originalItem?.name}`);
        wrapper.remove();
        // Force a refresh of the tree view after removing the item
        logDebug('Command handler: forcing tree view refresh');
        RecentItemWrapper.forceRefresh();
      })
    );
  
    // Update tree when workspace folders change
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        logInfo('Workspace folders changed, refreshing');
        launchProvider.refresh();
      })
    );
    
    // Register commands for the extension
    registerCommands(context, launchProvider, recentItemsManager, hiddenItemsManager);
    
    // Set up file watchers
    setupFileWatchers(context, launchProvider);
    
    logInfo('Launch Sidebar Extension successfully activated');
  } catch (error) {
    logError(`Error activating extension: ${error}`);
    vscode.window.showErrorMessage(`Launch Sidebar: Error activating extension: ${error}`);
    // Rethrow: swallowing this used to leave the extension half-initialised and
    // looking healthy, which is how a duplicate command registration silently
    // skipped setupFileWatchers() for a year. A failed activation should fail loudly.
    throw error;
  }
}

/**
 * Register commands for the extension
 */
function registerCommands(
  context: vscode.ExtensionContext,
  launchConfigurationProvider: LaunchConfigurationProvider,
  recentItemsManager: RecentItemsManager,
  hiddenItemsManager: HiddenItemsManager
): void {
  // Command: Refresh configuration list
  const refreshCommand = vscode.commands.registerCommand('launchConfigurations.refresh', () => {
    launchConfigurationProvider.refresh();
    vscode.window.showInformationMessage('Launch configurations refreshed');
  });
  
  // Command: Launch a debug configuration
  const launchCommand = vscode.commands.registerCommand('launchConfigurations.launch', async (item: LaunchConfigurationItem) => {
    try {
      if (item.workspaceFolder) {
        // Start debugging with the selected configuration
        await vscode.debug.startDebugging(item.workspaceFolder, item.configuration);
        
        // Add to recent items
        recentItemsManager.addRecentItem(item);
        launchConfigurationProvider.refresh();
        
        // Show notification
        vscode.window.showInformationMessage(`Launched debug configuration: ${item.name}`);
      } else {
        vscode.window.showErrorMessage('Unable to launch configuration: No workspace folder found');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to launch configuration: ${error}`);
    }
  });
  
  // Command: Edit a debug configuration
  const editCommand = vscode.commands.registerCommand('launchConfigurations.edit', async (item: LaunchConfigurationItem) => {
    try {
      if (item.position) {
        // Open the file at the correct position
        const document = await vscode.workspace.openTextDocument(item.position.uri);
        const editor = await vscode.window.showTextDocument(document);
        
        // Create a selection from the start to end positions
        const startPosition = new vscode.Position(item.position.startLine, item.position.startCharacter);
        const endPosition = new vscode.Position(item.position.endLine, item.position.endCharacter);
        const selection = new vscode.Selection(startPosition, startPosition);
        
        // Set the selection and reveal the range in the editor
        editor.selection = selection;
        editor.revealRange(
          new vscode.Range(startPosition, endPosition),
          vscode.TextEditorRevealType.InCenter
        );
      } else if (item.workspaceFolder) {
        // If we don't have a position but do have a workspace folder, just open the launch.json file
        const launchJsonPath = path.join(item.workspaceFolder.uri.fsPath, '.vscode', 'launch.json');
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(launchJsonPath));
        await vscode.window.showTextDocument(document);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open configuration for editing: ${error}`);
    }
  });
  
  // Command: Run a script with the appropriate package manager (npm, yarn, or pnpm)
  const runScriptCommand = vscode.commands.registerCommand('launchConfigurations.runScript', async (item: ScriptItem) => {
    try {
      // Get the directory containing the package.json
      const packageDir = path.dirname(item.packageJsonPath);
      
      // Use the detected package manager for this script
      const packageManager = item.packageManager;
      
      // Create a terminal for running the script
      const terminal = terminalManager.getOrCreateTerminal(`${packageManager}: ${item.name}`, packageDir);
      
      // Run the script using the appropriate package manager
      terminal.sendText(`${packageManager} run ${quoteArg(item.name)}`);
      terminal.show();
      
      // Add to recent items
      recentItemsManager.addRecentItem(item);
      launchConfigurationProvider.refresh();
      
      // Show notification
      vscode.window.showInformationMessage(`Running ${packageManager} script: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run script: ${error}`);
    }
  });
  
  // Command: Edit an npm script
  const editScriptCommand = vscode.commands.registerCommand('launchConfigurations.editScript', async (item: ScriptItem) => {
    try {
      // Open the package.json file
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.packageJsonPath));
      const editor = await vscode.window.showTextDocument(document);
      
      // Search for the script in the file
      const text = document.getText();
      const scriptRegex = new RegExp(`["']${item.name}["']\\s*:\\s*["']([^"']*)["']`);
      const match = scriptRegex.exec(text);
      
      if (match) {
        // Calculate the position
        const position = document.positionAt(match.index);
        
        // Set cursor position and reveal it
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open script for editing: ${error}`);
    }
  });
  
  // Command: Run a JetBrains configuration
  const runJetBrainsConfigCommand = vscode.commands.registerCommand('launchConfigurations.runJetBrainsConfig', async (item: JetBrainsRunConfigItem) => {
    try {
      // Get the directory containing the configuration
      const workDir = item.workingDirectory || item.workspaceFolder.uri.fsPath;

      // Create a terminal for running the configuration, seeding any configured env vars
      // at creation time so this works on every shell (POSIX, PowerShell, cmd)
      const terminal = terminalManager.getOrCreateTerminal(`JetBrains: ${item.name}`, workDir, item.envVars);

      // Construct the command to run
      const command = buildJetBrainsCommand(item);

      if (!command) {
        throw new Error('Unable to determine how to run this configuration');
      }
      
      // Run the command in the terminal
      terminal.sendText(command);
      terminal.show();
      
      // Add to recent items
      recentItemsManager.addRecentItem(item);
      launchConfigurationProvider.refresh();
      
      // Show notification
      vscode.window.showInformationMessage(`Running JetBrains configuration: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run JetBrains configuration: ${error}`);
    }
  });
  
  // Command: Edit a JetBrains configuration
  const editJetBrainsConfigCommand = vscode.commands.registerCommand('launchConfigurations.editJetBrainsConfig', async (item: JetBrainsRunConfigItem) => {
    try {
      // Open the XML file
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.xmlFilePath));
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open JetBrains configuration for editing: ${error}`);
    }
  });
  
  // Command: Clear recent items 
  const clearRecentItemsCommand = vscode.commands.registerCommand('launchConfigurations.clearRecentItems', () => {
    recentItemsManager.clearRecentItems();
    launchConfigurationProvider.refresh();
    vscode.window.showInformationMessage('Recent items list cleared');
  });
  
  // Command: Run a Makefile task
  const runMakefileTaskCommand = vscode.commands.registerCommand('launchConfigurations.runMakefileTask', async (item: MakefileTaskItem) => {
    try {
      const makefileDir = path.dirname(item.makefilePath);
      const terminal = terminalManager.getOrCreateTerminal(`make: ${item.name}`, makefileDir);
      terminal.sendText(`make ${quoteArg(item.name)}`);
      terminal.show();
      // Add to recent items
      recentItemsManager.addRecentItem(item);
      launchConfigurationProvider.refresh();
      vscode.window.showInformationMessage(`Running make task: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run make task: ${error}`);
    }
  });

  // Command: Edit a Makefile task
  const editMakefileTaskCommand = vscode.commands.registerCommand('launchConfigurations.editMakefileTask', async (item: MakefileTaskItem) => {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.makefilePath));
      const editor = await vscode.window.showTextDocument(document);
      // Try to find the target line
      const text = document.getText();
      const targetRegex = new RegExp(`^${item.name}:`, 'm');
      const match = targetRegex.exec(text);
      if (match) {
        const position = document.positionAt(match.index);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open Makefile for editing: ${error}`);
    }
  });
  
  // Add command to hide an item
  context.subscriptions.push(
    vscode.commands.registerCommand('launchConfigurations.hideItem', (item: LaunchConfigurationItem | ScriptItem | JetBrainsRunConfigItem | MakefileTaskItem) => {
      logInfo(`Hiding item: ${item.name}`);
      
      // Create a hidden item object
      const hiddenItem: HiddenItem = {
        id: item.id || `${item.name}-${item.contextValue}`,
        name: item.name,
        type: item.contextValue || '',
        path: getItemPath(item),
        folder: item.workspaceFolder?.name
      };
      
      // Add to hidden items
      hiddenItemsManager.hideItem(hiddenItem);
      
      // Refresh the tree view
      launchConfigurationProvider.refresh();
    })
  );
  
  // Add command to hide a section
  context.subscriptions.push(
    vscode.commands.registerCommand('launchConfigurations.hideSection', (section: SectionItem) => {
      logInfo(`Hiding section: ${section.label} (${section.sectionType})`);
      
      // Use the shared helper method to generate the section ID
      const sectionId = LaunchConfigurationProvider.generateSectionId(section);
      
      // Log the exact section ID for debugging
      logInfo(`Section ID: ${sectionId}`);
      
      // Create a hidden section object
      const hiddenSection: HiddenItem = {
        id: sectionId,
        name: section.label as string,
        type: section.sectionType,
        folder: section.workspaceFolder?.name,
        path: section.packageJsonPath || section.makefilePath,
        isSection: true
      };
      
      // Add to hidden sections
      hiddenItemsManager.hideSection(hiddenSection);
      
      // Refresh the tree view
      launchConfigurationProvider.refresh();
    })
  );
  
  // Add command to manage hidden items
  context.subscriptions.push(
    vscode.commands.registerCommand('launchConfigurations.manageHiddenItems', async () => {
      logInfo('Opening hidden items management dialog');
      
      const hiddenItems = hiddenItemsManager.getHiddenItems();
      const hiddenSections = hiddenItemsManager.getHiddenSections();
      const totalHidden = hiddenItems.length + hiddenSections.length;
      
      if (totalHidden === 0) {
        // Show an informative message with instructions about how to hide items
        vscode.window.showInformationMessage(
          'No hidden items or sections to manage. Right-click on an item or section to hide it.'
        );
        return;
      }
      
      // Create quick pick items for hidden individual items
      const itemQuickPickItems = hiddenItems.map(item => ({
        label: `$(eye-closed) ${item.name}`,
        description: item.folder ? `in ${item.folder}` : '',
        detail: `Type: ${item.type}`,
        item: item,
        isSection: false
      }));
      
      // Create quick pick items for hidden sections
      const sectionQuickPickItems = hiddenSections.map(section => ({
        label: `$(folder) ${section.name}`,
        description: section.folder ? `in ${section.folder}` : '',
        detail: `Section: ${section.type}`,
        item: section,
        isSection: true
      }));
      
      // Combine all quick pick items
      const allQuickPickItems = [...sectionQuickPickItems, ...itemQuickPickItems];
      
      // Add options to restore all
      allQuickPickItems.push({
        label: 'Restore All Hidden Items and Sections',
        description: '',
        detail: `Will restore ${hiddenItems.length} items and ${hiddenSections.length} sections`,
        item: { id: 'restore-all', name: 'Restore All', type: 'special' },
        isSection: false
      });
      
      if (hiddenSections.length > 0) {
        allQuickPickItems.push({
          label: 'Restore All Hidden Sections',
          description: '',
          detail: `Will restore ${hiddenSections.length} sections`,
          item: { id: 'restore-all-sections', name: 'Restore All Sections', type: 'special' },
          isSection: true
        });
      }
      
      if (hiddenItems.length > 0) {
        allQuickPickItems.push({
          label: 'Restore All Hidden Items',
          description: '',
          detail: `Will restore ${hiddenItems.length} items`,
          item: { id: 'restore-all-items', name: 'Restore All Items', type: 'special' },
          isSection: false
        });
      }
      
      // Show quick pick
      const selectedItem = await vscode.window.showQuickPick(allQuickPickItems, {
        title: `Manage Hidden Items (${totalHidden} hidden)`,
        placeHolder: 'Select an item to restore',
        canPickMany: false
      });
      
      if (!selectedItem) {
        return;
      }
      
      // Handle selection
      if (selectedItem.item.id === 'restore-all') {
        // Restore all items and sections
        hiddenItemsManager.clearAllHidden();
        vscode.window.showInformationMessage('All hidden items and sections have been restored.');
      } else if (selectedItem.item.id === 'restore-all-sections') {
        // Restore all sections
        hiddenItemsManager.clearHiddenSections();
        vscode.window.showInformationMessage('All hidden sections have been restored.');
      } else if (selectedItem.item.id === 'restore-all-items') {
        // Restore all items
        hiddenItemsManager.clearHiddenItems();
        vscode.window.showInformationMessage('All hidden items have been restored.');
      } else if (selectedItem.isSection) {
        // Restore a specific section
        hiddenItemsManager.restoreSection(selectedItem.item.id);
        vscode.window.showInformationMessage(`Section "${selectedItem.item.name}" has been restored.`);
      } else {
        // Restore a specific item
        hiddenItemsManager.restoreItem(selectedItem.item.id);
        vscode.window.showInformationMessage(`Item "${selectedItem.item.name}" has been restored.`);
      }
      
      // Refresh the tree view
      launchConfigurationProvider.refresh();
    })
  );
  
  // Register all commands
  context.subscriptions.push(
    refreshCommand,
    launchCommand,
    editCommand,
    runScriptCommand,
    editScriptCommand,
    runJetBrainsConfigCommand,
    editJetBrainsConfigCommand,
    clearRecentItemsCommand,
    runMakefileTaskCommand,
    editMakefileTaskCommand
  );
}

/**
 * Helper function to get the file path from various item types
 */
function getItemPath(item: LaunchConfigurationItem | ScriptItem | JetBrainsRunConfigItem | MakefileTaskItem): string | undefined {
  if (item instanceof ScriptItem) {
    return item.packageJsonPath;
  } else if (item instanceof JetBrainsRunConfigItem) {
    // JetBrains items might store the path differently, check its properties
    return (item as any).xmlPath || (item as any).filePath || (item as any).path;
  } else if (item instanceof MakefileTaskItem) {
    return item.makefilePath;
  } else if (item instanceof LaunchConfigurationItem) {
    // Launch configuration items might store the path differently
    return (item as any).configurationFilePath || (item as any).filePath || (item as any).path;
  }
  return undefined;
}

/**
 * Sets up file watchers to automatically refresh the view when related files change
 */
function setupFileWatchers(
  context: vscode.ExtensionContext,
  launchConfigurationProvider: LaunchConfigurationProvider
): void {
  // Watch for changes to launch.json files
  const launchJsonWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
  launchJsonWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  launchJsonWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  launchJsonWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Watch for changes to package.json files (for npm scripts)
  const packageJsonWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
  packageJsonWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  packageJsonWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  packageJsonWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Watch for changes to JetBrains run configuration files
  const jetBrainsConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.run/**/*.xml');
  jetBrainsConfigWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  jetBrainsConfigWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  jetBrainsConfigWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Watch for changes to Makefile files (for Makefile tasks)
  const makefileWatcher = vscode.workspace.createFileSystemWatcher('**/Makefile');
  makefileWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  makefileWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  makefileWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Register the watchers for disposal when the extension is deactivated
  context.subscriptions.push(
    launchJsonWatcher,
    packageJsonWatcher,
    jetBrainsConfigWatcher,
    makefileWatcher
  );
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
  log('Deactivating Launch Sidebar extension');
  
  // Clean up any terminals we're tracking
  terminalManager.cleanupTerminals();
}
