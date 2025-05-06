import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { ConfigPosition } from '../models/config-position';
import { LaunchConfigurationItem, LaunchConfigurationErrorItem } from '../models/launch-items';
import { JetBrainsRunConfigItem } from '../models/jetbrains-items';
import { ScriptItem } from '../models/script-item';
import { SectionItem, SectionType } from '../models/section-item';
import { RecentItemsSection, RecentItemWrapper } from '../models/recent-items-section';
import { RecentItemsManager } from '../models/recent-items';
import { detectPackageManager, detectRootPackageManager, PackageManager } from '../utils/package-manager';
import { JetBrainsRunConfigParser } from '../utils/jetbrains-parser';
import { MakefileTaskItem } from '../models/makefile-task-item';
import { HiddenItemsManager } from '../models/hidden-items-manager';

// Union type for our tree items
export type LaunchTreeItem = LaunchConfigurationItem | LaunchConfigurationErrorItem | ScriptItem | SectionItem | JetBrainsRunConfigItem | RecentItemsSection | RecentItemWrapper | MakefileTaskItem;

/**
 * Tree data provider for the Launch Sidebar extension
 * Provides a hierarchical view of launch configurations and npm scripts
 * organized by workspace folders
 */
export class LaunchConfigurationProvider implements vscode.TreeDataProvider<LaunchTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LaunchTreeItem | undefined | null | void> = new vscode.EventEmitter<LaunchTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LaunchTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private recentItemsManager: RecentItemsManager;
  private hiddenItemsManager?: HiddenItemsManager;
  private titleBarCommand?: vscode.Disposable;
  
  constructor(recentItemsManager: RecentItemsManager) {
    this.recentItemsManager = recentItemsManager;
    // Listen for changes to recent items
    this.recentItemsManager.onDidChangeRecentItems(() => {
      console.log('Recent items changed, refreshing tree view');
      this.refresh();
    });
  }
  
  /**
   * Set the hidden items manager reference
   */
  public setHiddenItemsManager(hiddenItemsManager: HiddenItemsManager): void {
    this.hiddenItemsManager = hiddenItemsManager;
    // Listen for changes to hidden items
    this.hiddenItemsManager.onDidChangeHiddenItems(() => {
      console.log('Hidden items changed, refreshing tree view');
      this.refresh();
      // Update title bar indicator
      this.updateTitleBarIndicator();
    });
    
    // Initial update of the title bar indicator
    this.updateTitleBarIndicator();
  }
  
  /**
   * Update the title bar indicator to show hidden item count
   */
  private updateTitleBarIndicator(): void {
    // Clean up previous command if it exists
    if (this.titleBarCommand) {
      this.titleBarCommand.dispose();
    }
    
    // Skip if no hidden items manager
    if (!this.hiddenItemsManager) {
      return;
    }
    
    // Get total hidden count
    const totalHidden = this.hiddenItemsManager.getTotalHiddenCount();
    
    // Always show the eye icon in the title bar
    // If there are hidden items, add a badge with the count
    const iconTitle = totalHidden > 0 ? 
      `$(eye-closed) Manage Hidden Items (${totalHidden})` : 
      `$(eye-closed) Manage Hidden Items`;
    
    // Register the command with the appropriate title
    this.titleBarCommand = vscode.commands.registerCommand('launchConfigurations.titleBarManageHiddenItems', async () => {
      // Execute the actual command
      await vscode.commands.executeCommand('launchConfigurations.manageHiddenItems');
    });
    
    // Update the command title to include the count if needed
    vscode.commands.executeCommand('setContext', 'launchSidebar.hiddenItemsTitle', iconTitle);
    vscode.commands.executeCommand('setContext', 'launchSidebar.hasHiddenItems', totalHidden > 0);
    vscode.commands.executeCommand('setContext', 'launchSidebar.hiddenItemsCount', totalHidden);
  }
  
  /**
   * Refresh the tree view
   * Triggers a reload of all configurations and scripts
   */
  refresh(): void {
    console.log('LaunchConfigurationProvider.refresh() called');
    this._onDidChangeTreeData.fire();
  }

  /**
   * Generate a consistent section ID
   * This ensures the same logic is used everywhere
   */
  public static generateSectionId(section: SectionItem): string {
    let sectionId = `section-${section.sectionType}`;
    
    // Add folder name if available
    if (section.workspaceFolder?.name) {
      sectionId += `-${section.workspaceFolder.name}`;
    }
    
    // Add package.json path for script sections
    if (section.packageJsonPath) {
      const relativePath = section.workspaceFolder ? 
        path.relative(section.workspaceFolder.uri.fsPath, section.packageJsonPath) : 
        section.packageJsonPath;
      sectionId += `-${relativePath}`;
    }
    
    // Add makefile path for makefile sections
    if (section.makefilePath) {
      const relativePath = section.workspaceFolder ? 
        path.relative(section.workspaceFolder.uri.fsPath, section.makefilePath) : 
        section.makefilePath;
      sectionId += `-${relativePath}`;
    }

    return sectionId;
  }

  /**
   * Get the tree item representation of an element
   */
  getTreeItem(element: LaunchTreeItem): vscode.TreeItem {
    // If this is a section, add hidden items indicator if needed
    if (element instanceof SectionItem && this.hiddenItemsManager) {
      // Don't add indicators for the recent items section
      if (element.sectionType !== SectionType.RECENT) {
        // Generate the section ID using the helper method
        const sectionId = LaunchConfigurationProvider.generateSectionId(element);
        
        // Check if THIS SPECIFIC section has hidden items
        // We need to check the hidden items to see if any are from this section
        const hiddenItems = this.hiddenItemsManager.getHiddenItems();
        
        // Filter for items that belong to this section
        const sectionHiddenItems = hiddenItems.filter(item => {
          // Match folder
          if (element.workspaceFolder?.name && item.folder !== element.workspaceFolder.name) {
            return false;
          }
          
          // Match path for scripts and makefile tasks
          if (element.packageJsonPath && item.path === element.packageJsonPath) {
            return true;
          }
          
          if (element.makefilePath && item.path === element.makefilePath) {
            return true;
          }
          
          // Match section type if paths don't match
          if (!element.packageJsonPath && !element.makefilePath) {
            if (element.sectionType === SectionType.SCRIPTS && item.type === 'script') {
              return true;
            } else if (element.sectionType === SectionType.LAUNCH_CONFIGURATIONS && item.type === 'configuration') {
              return true;
            } else if (element.sectionType === SectionType.JETBRAINS_CONFIGS && item.type === 'jetbrains-run-config') {
              return true;
            } else if (element.sectionType === SectionType.MAKEFILE_TASKS && item.type === 'makefile-task') {
              return true;
            }
          }
          
          return false;
        });
        
        const hasHiddenItems = sectionHiddenItems.length > 0;
        
        if (hasHiddenItems) {
          // Add hidden items indicator to description
          if (!element.description) {
            element.description = `(${sectionHiddenItems.length} hidden)`;
          }
          
          // Add tooltip about hidden items
          if (element.tooltip) {
            element.tooltip = `${element.tooltip}\n\nThis section has ${sectionHiddenItems.length} hidden items. Click "Manage Hidden Items" in the title bar to restore them.`;
          } else {
            element.tooltip = `This section has ${sectionHiddenItems.length} hidden items. Click "Manage Hidden Items" in the title bar to restore them.`;
          }
        }
      }
    }
    
    return element;
  }

  /**
   * Determine if a section should be shown based on hidden status
   */
  private shouldShowSection(section: SectionItem): boolean {
    if (!this.hiddenItemsManager) {
      return true;
    }
    
    // Recent items section is always shown
    if (section.sectionType === SectionType.RECENT) {
      return true;
    }
    
    // Use the helper method to generate the section ID
    const sectionId = LaunchConfigurationProvider.generateSectionId(section);
    
    // Log for debugging
    console.log(`Checking section: ${section.label}, ID: ${sectionId}`);
    
    // Check if the section is hidden
    return !this.hiddenItemsManager.isSectionHidden(sectionId);
  }

  /**
   * Determine if an item should be shown based on hidden status
   */
  private shouldShowItem(item: LaunchTreeItem): boolean {
    if (!this.hiddenItemsManager) {
      return true;
    }
    
    // Section items and recent items are always shown (handled separately)
    if (item instanceof SectionItem || item instanceof RecentItemsSection || item instanceof RecentItemWrapper) {
      return true;
    }
    
    // Check if the item is hidden
    const itemName = 'name' in item ? item.name : ''; // Use type guard to check for name property
    const itemId = item.id || `${itemName}-${item.contextValue}`;
    return !this.hiddenItemsManager.isItemHidden(itemId);
  }

  /**
   * Get the children of a given element
   * If element is undefined, returns root level sections
   * If element is a section, returns its children (configs or scripts)
   */
  async getChildren(element?: LaunchTreeItem): Promise<LaunchTreeItem[]> {
    let items: LaunchTreeItem[] = [];
    
    // If a section item is provided, return its children
    if (element instanceof SectionItem) {
      if (element.sectionType === SectionType.LAUNCH_CONFIGURATIONS && element.workspaceFolder) {
        items = await this.getLaunchConfigurations(element.workspaceFolder);
      } else if (element.sectionType === SectionType.SCRIPTS && element.packageJsonPath && element.workspaceFolder) {
        items = await this.getPackageScripts(element.packageJsonPath, element.workspaceFolder);
      } else if (element.sectionType === SectionType.JETBRAINS_CONFIGS && element.workspaceFolder) {
        items = await this.getJetBrainsConfigurations(element.workspaceFolder);
      } else if (element.sectionType === SectionType.MAKEFILE_TASKS && element.makefilePath && element.workspaceFolder) {
        items = await this.getMakefileTasks(element.makefilePath, element.workspaceFolder);
      }
      
      // Filter out hidden items
      return items.filter(item => this.shouldShowItem(item));
    }
    // If RecentItemsSection, return recent items
    else if (element instanceof RecentItemsSection) {
      items = this.getRecentItems();
      return items;
    }
    // If any other item is provided or no item, return the root items (sections)
    else if (!element) {
      items = await this.getSections();
      
      // Filter out hidden sections
      return items.filter(item => {
        if (item instanceof SectionItem) {
          return this.shouldShowSection(item);
        }
        return true;
      });
    }
    
    return [];
  }

  /**
   * Get recent items for the sidebar
   */
  private getRecentItems(): LaunchTreeItem[] {
    console.log('Getting recent items');
    const recentItems = this.recentItemsManager.getRecentItems();
    console.log(`Found ${recentItems.length} recent items`);
    return recentItems.map(item => new RecentItemWrapper(item));
  }

  /**
   * Get all sections for the sidebar
   * Creates section headers for launch configurations, npm scripts, and JetBrains run configurations
   * for each workspace folder
   */
  private async getSections(): Promise<LaunchTreeItem[]> {
    // Root level - create a section for each workspace folder
    const sections: LaunchTreeItem[] = [];
    
    // Add Recent Items section at the top
    sections.push(new RecentItemsSection());
    
    // Get all workspace folders sorted alphabetically by name
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const sortedFolders = [...workspaceFolders].sort((a, b) => a.name.localeCompare(b.name));
    
    for (const folder of sortedFolders) {
      // Add launch configurations section if a launch.json file exists
      const launchJsonPath = path.join(folder.uri.fsPath, '.vscode', 'launch.json');
      if (fs.existsSync(launchJsonPath)) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}`,
          SectionType.LAUNCH_CONFIGURATIONS,
          folder
        ));
      }
      
      // Add package.json scripts section if a package.json file exists
      const packageJsonPath = path.join(folder.uri.fsPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}`,
          SectionType.SCRIPTS,
          folder,
          packageJsonPath
        ));
      }

      // Add JetBrains run configurations section if a .run directory exists
      const hasJetBrainsConfigs = await this.hasJetBrainsRunConfigurations(folder);
      if (hasJetBrainsConfigs) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}`,
          SectionType.JETBRAINS_CONFIGS,
          folder
        ));
      }

      // Add Makefile tasks section if a Makefile exists
      const makefilePath = path.join(folder.uri.fsPath, 'Makefile');
      if (fs.existsSync(makefilePath)) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}`,
          SectionType.MAKEFILE_TASKS,
          folder,
          undefined,
          makefilePath
        ));
      }

      // Also check for nested package.json files (up to 2 levels deep)
      await this.addNestedPackageSections(folder, sections);
    }
    
    return sections;
  }

  /**
   * Adds sections for nested package.json files in workspace folders
   * Scans up to 2 levels deep for better monorepo support
   * Excludes node_modules directories
   */
  private async addNestedPackageSections(folder: vscode.WorkspaceFolder, sections: LaunchTreeItem[]): Promise<void> {
    try {
      const directories = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true });
      for (const dir of directories) {
        // Skip node_modules directories
        if (dir.isDirectory() && dir.name !== 'node_modules') {
          const nestedPackageJsonPath = path.join(folder.uri.fsPath, dir.name, 'package.json');
          if (fs.existsSync(nestedPackageJsonPath)) {
            sections.push(new SectionItem(
              `${dir.name}: npm Scripts`,
              SectionType.SCRIPTS,
              folder,
              nestedPackageJsonPath
            ));
          }
          
          // Check one more level
          const nestedDirPath = path.join(folder.uri.fsPath, dir.name);
          const nestedDirectories = fs.readdirSync(nestedDirPath, { withFileTypes: true });
          for (const nestedDir of nestedDirectories) {
            // Skip node_modules directories at this level too
            if (nestedDir.isDirectory() && nestedDir.name !== 'node_modules') {
              const deepNestedPackageJsonPath = path.join(nestedDirPath, nestedDir.name, 'package.json');
              if (fs.existsSync(deepNestedPackageJsonPath)) {
                sections.push(new SectionItem(
                  `${dir.name}/${nestedDir.name}: npm Scripts`,
                  SectionType.SCRIPTS,
                  folder,
                  deepNestedPackageJsonPath
                ));
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning for nested package.json files in ${folder.name}:`, error);
    }
  }
  
  /**
   * Get launch configurations for a specific workspace folder
   * Reads the .vscode/launch.json file and parses configurations
   */
  private async getLaunchConfigurations(folder: vscode.WorkspaceFolder): Promise<LaunchTreeItem[]> {
    const items: LaunchTreeItem[] = [];
    
    try {
      // Read launch.json file from the .vscode directory in the workspace folder
      const launchJsonPath = path.join(folder.uri.fsPath, '.vscode', 'launch.json');
      
      if (fs.existsSync(launchJsonPath)) {
        try {
          // Load the file as a VS Code document URI
          const uri = vscode.Uri.file(launchJsonPath);
          
          // Use VS Code's built-in JSON parser that supports comments and trailing commas
          const document = await vscode.workspace.openTextDocument(uri);
          
          // Parse the JSON with VS Code's built-in JSON parser
          const launchConfig = vscode.workspace.getConfiguration('launch', uri);
          
          // Process regular configurations
          await this.processRegularConfigurations(launchConfig, document, folder, items);
          
          // Process compound configurations
          await this.processCompoundConfigurations(launchConfig, document, folder, items);
          
        } catch (error) {
          // TypeScript treats catch clause variables as 'unknown' by default
          const jsonError = error as Error;
          
          // Create a properly typed error item for the tree view
          items.push(new LaunchConfigurationErrorItem(
            `Error in ${folder.name}/.vscode/launch.json`,
            folder.name,
            jsonError.message || String(error)
          ));
          console.error(`Error parsing launch.json in ${folder.name}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error reading launch configurations from ${folder.name}:`, error);
    }
    
    return items;
  }

  /**
   * Process regular launch configurations from a workspace's launch.json
   */
  private async processRegularConfigurations(
    launchConfig: vscode.WorkspaceConfiguration,
    document: vscode.TextDocument,
    folder: vscode.WorkspaceFolder,
    items: LaunchTreeItem[]
  ): Promise<void> {
    // Get regular configurations
    const configurations = launchConfig.get('configurations') as vscode.DebugConfiguration[] | undefined;
    
    if (configurations && Array.isArray(configurations)) {
      // Sort configurations alphabetically by name
      const sortedConfigs = [...configurations].sort((a, b) => a.name.localeCompare(b.name));
      
      for (const config of sortedConfigs) {
        if (config.name && config.type) {
          // Find position of this configuration in the document
          const position = this.findConfigPosition(document, config.name);
          
          items.push(new LaunchConfigurationItem(
            config.name,
            config.type,
            config,
            folder,
            position
          ));
        }
      }
    }
  }

  /**
   * Process compound launch configurations from a workspace's launch.json
   */
  private async processCompoundConfigurations(
    launchConfig: vscode.WorkspaceConfiguration,
    document: vscode.TextDocument,
    folder: vscode.WorkspaceFolder,
    items: LaunchTreeItem[]
  ): Promise<void> {
    // Get compound configurations
    const compounds = launchConfig.get('compounds') as Array<{name: string, configurations: string[]}> | undefined;
    
    if (compounds && Array.isArray(compounds)) {
      // Sort compound configurations alphabetically by name
      const sortedCompounds = [...compounds].sort((a, b) => a.name.localeCompare(b.name));
      
      for (const compound of sortedCompounds) {
        if (compound.name && compound.configurations) {
          // Create a special configuration for compound launch
          const compoundConfig: vscode.DebugConfiguration = {
            type: 'compound',
            name: compound.name,
            request: 'launch',
            configurations: compound.configurations
          };
          
          // Find the position of this compound configuration
          const position = this.findConfigPosition(document, compound.name);
          
          items.push(new LaunchConfigurationItem(
            compound.name,
            'compound',
            compoundConfig,
            folder,
            position
          ));
        }
      }
    }
  }

  /**
   * Find the position of a configuration in a document by name
   * Used to locate configurations for editing
   */
  private findConfigPosition(document: vscode.TextDocument, configName: string): ConfigPosition | undefined {
    const configRegex = new RegExp(`[\\s\\n]*{[\\s\\n]*["']name["']\\s*:\\s*["']${configName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g');
    const text = document.getText();
    const match = configRegex.exec(text);
    
    if (match) {
      const startPos = document.positionAt(match.index);
      
      // Find the end of this configuration block by counting braces
      let braceCount = 1; // We already found the opening brace
      let endPos = document.positionAt(match.index + match[0].length);
      let currentOffset = match.index + match[0].length;
      
      while (braceCount > 0 && currentOffset < text.length) {
        const char = text[currentOffset];
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
        }
        currentOffset++;
        
        if (braceCount === 0) {
          endPos = document.positionAt(currentOffset);
          break;
        }
      }
      
      return {
        startLine: startPos.line,
        startCharacter: startPos.character,
        endLine: endPos.line,
        endCharacter: endPos.character,
        uri: document.uri
      };
    }
    
    return undefined;
  }
  
  /**
   * Get package scripts from a package.json file
   * Detects appropriate package manager (npm, yarn, pnpm) for running scripts
   */
  private async getPackageScripts(packageJsonPath: string, folder: vscode.WorkspaceFolder): Promise<LaunchTreeItem[]> {
    const items: LaunchTreeItem[] = [];
    
    try {
      if (fs.existsSync(packageJsonPath)) {
        // First detect the root package manager for consistency across workspace
        const rootPackageManager = detectRootPackageManager(folder.uri.fsPath);
        
        // Then detect the package manager for this specific package.json
        const packageManager = detectPackageManager(packageJsonPath, rootPackageManager);
        
        // Read the package.json file
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        
        if (packageJson.scripts && typeof packageJson.scripts === 'object') {
          // Get script names and sort them alphabetically
          const scriptNames = Object.keys(packageJson.scripts).sort();
          
          for (const scriptName of scriptNames) {
            const scriptCommand = packageJson.scripts[scriptName];
            items.push(new ScriptItem(
              scriptName,
              scriptCommand,
              packageJsonPath,
              folder,
              packageManager // Pass the detected package manager to each script item
            ));
          }
        }
      }
    } catch (error) {
      console.error(`Error reading package.json scripts from ${packageJsonPath}:`, error);
    }
    
    return items;
  }

  /**
   * Checks if a workspace folder has JetBrains run configurations
   */
  private async hasJetBrainsRunConfigurations(folder: vscode.WorkspaceFolder): Promise<boolean> {
    try {
      // First, check for configurations in the .run directory
      try {
        // Look for .run directory (case insensitive)
        const items = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true });
        
        // Find the .run directory (may be .Run, .RUN, etc.)
        const runDirEntry = items.find(item => 
          item.isDirectory() && item.name.toLowerCase() === '.run'
        );
        
        if (runDirEntry) {
          const runDirPath = path.join(folder.uri.fsPath, runDirEntry.name);
          
          // Check if there are any XML files in the .run directory
          const xmlFiles = fs.readdirSync(runDirPath, { withFileTypes: true })
            .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.xml');
          
          if (xmlFiles.length > 0) {
            return true;
          }
        }
      } catch (e) {
        // Ignore errors while checking .run directory
      }
      
      // Next, check for configurations in the .idea/runConfigurations directory
      try {
        // Look for .idea directory
        const ideaDirPath = path.join(folder.uri.fsPath, '.idea');
        if (fs.existsSync(ideaDirPath)) {
          // Look for runConfigurations directory
          const runConfigsDirPath = path.join(ideaDirPath, 'runConfigurations');
          if (fs.existsSync(runConfigsDirPath)) {
            // Check if there are any XML files in the .idea/runConfigurations directory
            const xmlFiles = fs.readdirSync(runConfigsDirPath, { withFileTypes: true })
              .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.xml');
            
            if (xmlFiles.length > 0) {
              return true;
            }
          }
        }
      } catch (e) {
        // Ignore errors while checking .idea directory
      }
      
      // No JetBrains configurations found in either location
      return false;
    } catch (err) {
      console.error(`Error checking for JetBrains run configurations in ${folder.name}:`, err);
      return false;
    }
  }

  /**
   * Get JetBrains run configurations for a specific workspace folder
   * Reads the XML files in the .run directory and parses them
   */
  private async getJetBrainsConfigurations(folder: vscode.WorkspaceFolder): Promise<LaunchTreeItem[]> {
    const items: LaunchTreeItem[] = [];
    
    try {
      // Use the JetBrainsRunConfigParser to find and parse run configurations
      const runConfigs = await JetBrainsRunConfigParser.findRunConfigurations(folder);
      
      // Sort configurations alphabetically by name
      const sortedConfigs = [...runConfigs].sort((a, b) => a.name.localeCompare(b.name));
      
      // Create tree items for each configuration
      for (const config of sortedConfigs) {
        items.push(new JetBrainsRunConfigItem(
          config.name,
          config.type,
          config.xmlFilePath,
          folder,
          config.packagePath,
          config.command,
          config.workingDirectory,
          config.scriptText,
          config.interpreter,
          config.executeInTerminal,
          config.executeScriptFile,
          config.goParameters,
          config.envVars
        ));
      }
    } catch (error) {
      console.error(`Error reading JetBrains run configurations from ${folder.name}:`, error);
    }
    
    return items;
  }

  /**
   * Get Makefile tasks from a Makefile
   */
  private async getMakefileTasks(makefilePath: string, folder: vscode.WorkspaceFolder): Promise<LaunchTreeItem[]> {
    const items: LaunchTreeItem[] = [];
    try {
      if (fs.existsSync(makefilePath)) {
        const makefileContent = fs.readFileSync(makefilePath, 'utf8');
        // Regex to match targets: lines like 'target: ...' not starting with whitespace or '#'
        const targetRegex = /^(?![ \t#])([a-zA-Z0-9_\-]+):([^=\n]*)/gm;
        let match;
        while ((match = targetRegex.exec(makefileContent)) !== null) {
          const name = match[1];
          // Find the recipe (lines after the target, indented)
          const recipeLines: string[] = [];
          let nextLineIdx = match.index + match[0].length;
          let nextLineMatch;
          const lines = makefileContent.slice(nextLineIdx).split('\n');
          for (const line of lines) {
            if (/^\s+/.test(line) && !/^\s*#/.test(line)) {
              recipeLines.push(line.trim());
            } else {
              break;
            }
          }
          const recipe = recipeLines.join('\n');
          items.push(new MakefileTaskItem(name, makefilePath, folder, recipe));
        }
      }
    } catch (error) {
      console.error(`Error reading Makefile tasks from ${makefilePath}:`, error);
    }
    return items;
  }
}
