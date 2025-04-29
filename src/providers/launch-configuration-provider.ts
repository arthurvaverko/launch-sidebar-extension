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

// Union type for our tree items
export type LaunchTreeItem = LaunchConfigurationItem | LaunchConfigurationErrorItem | ScriptItem | SectionItem | JetBrainsRunConfigItem | RecentItemsSection | RecentItemWrapper;

/**
 * Tree data provider for the Launch Sidebar extension
 * Provides a hierarchical view of launch configurations and npm scripts
 * organized by workspace folders
 */
export class LaunchConfigurationProvider implements vscode.TreeDataProvider<LaunchTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LaunchTreeItem | undefined | null | void> = new vscode.EventEmitter<LaunchTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LaunchTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private recentItemsManager: RecentItemsManager;
  
  constructor(recentItemsManager: RecentItemsManager) {
    this.recentItemsManager = recentItemsManager;
    // Listen for changes to recent items
    this.recentItemsManager.onDidChangeRecentItems(() => {
      console.log('Recent items changed, refreshing tree view');
      this.refresh();
    });
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
   * Get the tree item representation of an element
   */
  getTreeItem(element: LaunchTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of a given element
   * If element is undefined, returns root level sections
   * If element is a section, returns its children (configs or scripts)
   */
  async getChildren(element?: LaunchTreeItem): Promise<LaunchTreeItem[]> {
    // If a section item is provided, return its children
    if (element instanceof SectionItem) {
      if (element.sectionType === SectionType.LAUNCH_CONFIGURATIONS && element.workspaceFolder) {
        return this.getLaunchConfigurations(element.workspaceFolder);
      } else if (element.sectionType === SectionType.SCRIPTS && element.packageJsonPath && element.workspaceFolder) {
        return this.getPackageScripts(element.packageJsonPath, element.workspaceFolder);
      } else if (element.sectionType === SectionType.JETBRAINS_CONFIGS && element.workspaceFolder) {
        return this.getJetBrainsConfigurations(element.workspaceFolder);
      }
      return [];
    }
    
    // If RecentItemsSection, return recent items
    if (element instanceof RecentItemsSection) {
      return this.getRecentItems();
    }
    
    // If any other item is provided or no item, return the root items (sections)
    if (element) {
      return [];
    }

    return this.getSections();
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
}
