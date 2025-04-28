import * as vscode from 'vscode';

/**
 * Represents a JetBrains run configuration item in the tree view
 * Each item displays a JetBrains run configuration name and type
 */
export class JetBrainsRunConfigItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly xmlFilePath: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly packagePath?: string,
    public readonly cmdString?: string,
    public readonly workingDirectory?: string,
    public readonly scriptText?: string,
    public readonly interpreter?: string,
    public readonly executeInTerminal?: boolean,
    public readonly executeScriptFile?: boolean
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${name} (${type})`;
    this.description = type;
    this.contextValue = 'jetbrains-run-config';
    
    // Choose icon based on configuration type
    if (type.includes('Test')) {
      this.iconPath = new vscode.ThemeIcon('beaker', new vscode.ThemeColor('testing.iconPassed'));
    } else if (type.includes('Application')) {
      this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('debugIcon.startForeground'));
    } else if (type.includes('ShConfigurationType')) {
      this.iconPath = new vscode.ThemeIcon('terminal', new vscode.ThemeColor('terminal.ansiGreen'));
    } else {
      this.iconPath = new vscode.ThemeIcon('play', new vscode.ThemeColor('terminal.ansiGreen'));
    }
    
    // Add accessibility data for better screen reader support and to increase line height
    this.accessibilityInformation = {
      label: `JetBrains ${type} configuration: ${name}`,
      role: 'button'
    };
  }
}
