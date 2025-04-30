import * as vscode from 'vscode';
import { getScriptIcon } from '../utils/script-icons';
import { PackageManager } from '../utils/package-manager';

/**
 * Represents a package.json script item in the tree view
 * Each item displays an npm script name and command with appropriate icons based on script type
 */
export class ScriptItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly script: string,
    public readonly packageJsonPath: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly packageManager: PackageManager = 'npm'
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = `${this.packageManager} run ${name}\n\n${script}`;
    this.description = script;
    this.contextValue = 'script';
    
    // Assign appropriate colored icon based on script name
    this.iconPath = getScriptIcon(name);
    
    // Add accessibility data for better screen reader support and to increase line height
    this.accessibilityInformation = {
      label: `Script ${name}: ${script}`,
      role: 'button'
    };
  }

  /**
   * Execute this script
   */
  execute(): void {
    vscode.commands.executeCommand('launchConfigurations.runScript', this);
  }

  /**
   * Edit this script
   */
  edit(): void {
    vscode.commands.executeCommand('launchConfigurations.editScript', this);
  }
}
