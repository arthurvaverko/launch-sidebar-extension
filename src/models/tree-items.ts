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
  }
}

/**
 * Represents a section header in the tree view
 * Sections group items by type (launch configs or scripts) and workspace folder
 */
export class SectionItem extends vscode.TreeItem {
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
