import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Interface to track position in the document for a configuration
 */
interface ConfigPosition {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
  uri: vscode.Uri;
}

/**
 * Represents a debug launch configuration item in the tree view.
 */
class LaunchConfigurationItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly configuration: vscode.DebugConfiguration,
    public readonly workspaceFolder: vscode.WorkspaceFolder | undefined,
    public readonly position?: ConfigPosition
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${name} (${type})`;
    this.description = type;
    this.contextValue = 'configuration';
    this.iconPath = new vscode.ThemeIcon('debug');
    
    // No command on the item itself - we'll use the play button instead
    // This allows clicking on the item to just select it
  }
}

/**
 * Represents an error in the launch configuration
 */
class LaunchConfigurationErrorItem extends vscode.TreeItem {
  constructor(
    public readonly message: string,
    public readonly folderName: string,
    public readonly errorMessage: string
  ) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.description = "Invalid JSON syntax";
    this.tooltip = `${errorMessage}\nPlease fix the JSON syntax in this file.`;
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'error';
  }
}

/**
 * Gets an appropriate icon based on a script name with color coding
 */
function getScriptIcon(scriptName: string): vscode.ThemeIcon {
  const scriptNameLower = scriptName.toLowerCase();
  
  // Test-related scripts (purple)
  if (/test|spec|e2e/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('beaker', new vscode.ThemeColor('testing.iconPassed'));
  }
  
  // Build scripts (orange)
  if (/build|compile|bundle|package/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('package', new vscode.ThemeColor('statusBarItem.warningBackground'));
  }
  
  // Development scripts (green)
  if (/dev|start|serve|run/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('debugIcon.startForeground'));
  }
  
  // Generate scripts (blue)
  if (/gen|generate|create/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.blue'));
  }
  
  // Lint and check scripts (yellow)
  if (/lint|eslint|tslint|check|format/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('checklist', new vscode.ThemeColor('charts.yellow'));
  }
  
  // Clean scripts (red)
  if (/clean|clear|reset|delete/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('trash', new vscode.ThemeColor('errorForeground'));
  }
  
  // Export scripts (cyan)
  if (/export|publish|release/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('export', new vscode.ThemeColor('charts.cyan'));
  }
  
  // Preview scripts (light blue)
  if (/preview|view|show/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('preview', new vscode.ThemeColor('editor.infoForeground'));
  }
  
  // Debug scripts (orange-red)
  if (/debug/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('debug', new vscode.ThemeColor('debugIcon.breakpointForeground'));
  }
  
  // Deploy scripts (pink)
  if (/deploy|upload/.test(scriptNameLower)) {
    return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.red'));
  }
  
  // Default icon (gray)
  return new vscode.ThemeIcon('terminal', new vscode.ThemeColor('descriptionForeground'));
}

/**
 * Represents a package.json script item in the tree view
 */
class ScriptItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly script: string,
    public readonly packageJsonPath: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = script;
    this.description = script;
    this.contextValue = 'script';
    this.iconPath = getScriptIcon(name);
    
    // No command on the item itself - we'll use the play button instead
    // This allows clicking on the item to just select it
  }
}

/**
 * Represents a section header in the tree view
 */
class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly sectionType: 'launch-configs' | 'scripts',
    public readonly workspaceFolder?: vscode.WorkspaceFolder,
    public readonly packageJsonPath?: string
  ) {
    // Use uppercase for section headers to make them stand out
    super(title.toUpperCase(), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `section-${sectionType}`;
    
    // Use more prominent icons and formatting for sections
    if (sectionType === 'launch-configs') {
      this.iconPath = new vscode.ThemeIcon('debug-alt-small', new vscode.ThemeColor('activityBarBadge.background'));
    } else {
      this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('activityBarBadge.background'));
    }
    
    // Add highlighting to make sections stand out
    this.description = ''; // Clear description for cleaner look
  }
}

// Union type for our tree items
type LaunchTreeItem = LaunchConfigurationItem | LaunchConfigurationErrorItem | ScriptItem | SectionItem;

/**
 * Tree data provider for debug launch configurations.
 */
class LaunchConfigurationProvider implements vscode.TreeDataProvider<LaunchTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<LaunchTreeItem | undefined | null | void> = new vscode.EventEmitter<LaunchTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LaunchTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
  
  constructor() {}
  
  /**
   * Refresh the tree view
   */
  refresh(): void {
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
   */
  async getChildren(element?: LaunchTreeItem): Promise<LaunchTreeItem[]> {
    // If a section item is provided, return its children
    if (element instanceof SectionItem) {
      if (element.sectionType === 'launch-configs' && element.workspaceFolder) {
        return this.getLaunchConfigurations(element.workspaceFolder);
      } else if (element.sectionType === 'scripts' && element.packageJsonPath && element.workspaceFolder) {
        return this.getPackageScripts(element.packageJsonPath, element.workspaceFolder);
      }
      return [];
    }
    
    // If any other item is provided or no item, return the root items (sections)
    if (element) {
      return [];
    }

    // Root level - create a section for each workspace folder
    const sections: LaunchTreeItem[] = [];
    
    // Get all workspace folders sorted alphabetically by name
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const sortedFolders = [...workspaceFolders].sort((a, b) => a.name.localeCompare(b.name));
    
    for (const folder of sortedFolders) {
      // Add launch configurations section if a launch.json file exists
      const launchJsonPath = path.join(folder.uri.fsPath, '.vscode', 'launch.json');
      if (fs.existsSync(launchJsonPath)) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}: Launch Configurations`,
          'launch-configs',
          folder
        ));
      }
      
      // Add package.json scripts section if a package.json file exists
      const packageJsonPath = path.join(folder.uri.fsPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        sections.push(new SectionItem(
          `${path.basename(folder.uri.fsPath)}: npm Scripts`,
          'scripts',
          folder,
          packageJsonPath
        ));
      }

      // Also check for nested package.json files (up to 2 levels deep)
      try {
        const directories = fs.readdirSync(folder.uri.fsPath, { withFileTypes: true });
        for (const dir of directories) {
          if (dir.isDirectory()) {
            const nestedPackageJsonPath = path.join(folder.uri.fsPath, dir.name, 'package.json');
            if (fs.existsSync(nestedPackageJsonPath)) {
              sections.push(new SectionItem(
                `${dir.name}: npm Scripts`,
                'scripts',
                folder,
                nestedPackageJsonPath
              ));
            }
            
            // Check one more level
            const nestedDirectories = fs.readdirSync(path.join(folder.uri.fsPath, dir.name), { withFileTypes: true });
            for (const nestedDir of nestedDirectories) {
              if (nestedDir.isDirectory()) {
                const deepNestedPackageJsonPath = path.join(folder.uri.fsPath, dir.name, nestedDir.name, 'package.json');
                if (fs.existsSync(deepNestedPackageJsonPath)) {
                  sections.push(new SectionItem(
                    `${dir.name}/${nestedDir.name}: npm Scripts`,
                    'scripts',
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
    
    return sections;
  }
  
  /**
   * Get launch configurations for a specific workspace folder
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
          const content = document.getText();
          
          // Parse the JSON with VS Code's built-in JSON parser
          const launchConfig = vscode.workspace.getConfiguration('launch', uri);
          
          // Try to find position of each configuration in the file
          const findConfigPositions = (configName: string): ConfigPosition | undefined => {
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
                uri
              };
            }
            
            return undefined;
          };
          
          // Get regular configurations
          const configurations = launchConfig.get('configurations') as vscode.DebugConfiguration[] | undefined;
          
          if (configurations && Array.isArray(configurations)) {
            // Sort configurations alphabetically by name
            const sortedConfigs = [...configurations].sort((a, b) => a.name.localeCompare(b.name));
            
            for (const config of sortedConfigs) {
              if (config.name && config.type) {
                // Find position of this configuration in the document
                const position = findConfigPositions(config.name);
                
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
          
          // Get compound configurations as well
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
                const position = findConfigPositions(compound.name);
                
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
   * Get npm scripts from a package.json file
   */
  private async getPackageScripts(packageJsonPath: string, folder: vscode.WorkspaceFolder): Promise<LaunchTreeItem[]> {
    const items: LaunchTreeItem[] = [];
    
    try {
      if (fs.existsSync(packageJsonPath)) {
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
              folder
            ));
          }
        }
      }
    } catch (error) {
      console.error(`Error reading package.json scripts from ${packageJsonPath}:`, error);
    }
    
    return items;
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Launch Sidebar extension is now active!');

  // Create the tree data provider
  const launchConfigurationProvider = new LaunchConfigurationProvider();
  
  // Register the tree view with increased item height for better spacing
  const treeView = vscode.window.createTreeView('launchConfigurations', {
    treeDataProvider: launchConfigurationProvider,
    showCollapseAll: false
  });
  
  // Set tree view options for larger fonts and spacing
  treeView.title = "📦 LAUNCH SIDEBAR";
  
  // Apply custom CSS if possible - this is a workaround as direct CSS styling isn't fully supported
  const cssPath = vscode.Uri.file(path.join(context.extensionPath, 'resources', 'sidebar-style.css'));
  
  // Register the refresh command
  const refreshCommand = vscode.commands.registerCommand('launchConfigurations.refresh', () => {
    launchConfigurationProvider.refresh();
    vscode.window.showInformationMessage('Launch configurations refreshed');
  });
  
  // Register the launch command
  const launchCommand = vscode.commands.registerCommand('launchConfigurations.launch', async (item: LaunchConfigurationItem) => {
    try {
      if (item.workspaceFolder) {
        // Start debugging with the selected configuration
        await vscode.debug.startDebugging(item.workspaceFolder, item.configuration);
        
        // Show notification
        vscode.window.showInformationMessage(`Launched debug configuration: ${item.name}`);
      } else {
        vscode.window.showErrorMessage('Unable to launch configuration: No workspace folder found');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to launch configuration: ${error}`);
    }
  });
  
  // Register the edit command
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
  
  // Register the run script command
  const runScriptCommand = vscode.commands.registerCommand('launchConfigurations.runScript', async (item: ScriptItem) => {
    try {
      // Get the directory containing the package.json
      const packageDir = path.dirname(item.packageJsonPath);
      
      // Create a terminal for running the script
      const terminal = vscode.window.createTerminal({
        name: `npm: ${item.name}`,
        cwd: packageDir
      });
      
      // Run the script using npm
      terminal.sendText(`npm run ${item.name}`);
      terminal.show();
      
      // Show notification
      vscode.window.showInformationMessage(`Running npm script: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run script: ${error}`);
    }
  });
  
  // Register the edit script command
  const editScriptCommand = vscode.commands.registerCommand('launchConfigurations.editScript', async (item: ScriptItem) => {
    try {
      // Open the package.json file
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.packageJsonPath));
      const editor = await vscode.window.showTextDocument(document);
      
      // Find the position of the script in the file
      const content = document.getText();
      const scriptRegex = new RegExp(`["']${item.name}["']\\s*:\\s*["']`);
      const match = scriptRegex.exec(content);
      
      if (match) {
        // Find the position and set the cursor there
        const position = document.positionAt(match.index);
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

  // Add all disposables to the context subscriptions
  context.subscriptions.push(
    treeView,
    refreshCommand,
    launchCommand,
    editCommand,
    runScriptCommand,
    editScriptCommand
  );
  
  // Initial refresh to load configurations
  launchConfigurationProvider.refresh();
  
  // Listen for file changes in launch.json files
  const watcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
  
  watcher.onDidChange(() => launchConfigurationProvider.refresh());
  watcher.onDidCreate(() => launchConfigurationProvider.refresh());
  watcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  context.subscriptions.push(watcher);
}

export function deactivate() {
  // Clean up resources when the extension is deactivated
}
