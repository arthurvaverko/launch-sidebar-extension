import * as vscode from 'vscode';
import { ConfigPosition } from './config-position';

/**
 * Represents a debug launch configuration item in the tree view.
 * Each item displays a configuration's name, type, and provides actions
 * to launch or edit the configuration.
 */
export class LaunchConfigurationItem extends vscode.TreeItem {
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
 * Displayed when a launch.json file has syntax errors or can't be parsed
 */
export class LaunchConfigurationErrorItem extends vscode.TreeItem {
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
