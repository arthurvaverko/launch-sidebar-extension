import * as vscode from 'vscode';

/**
 * Represents a section header in the tree view
 * Sections group items by type (launch configs, scripts, or JetBrains configs) and workspace folder
 */
export class SectionItem extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly sectionType: 'launch-configs' | 'scripts' | 'jetbrains-configs',
    public readonly workspaceFolder?: vscode.WorkspaceFolder,
    public readonly packageJsonPath?: string
  ) {
    // Use uppercase for section headers to make them stand out
    super(title.toUpperCase(), vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `section-${sectionType}`;
    
    // Add distinctive styling for section headers
    this.tooltip = `${sectionType} in ${workspaceFolder?.name || 'workspace'}`;
    
    // Use theme colors for better integration with VS Code themes
    this.iconPath = new vscode.ThemeIcon('list-tree');
    
    // Apply custom styling
    this.description = '';  // Clear description for cleaner headers
    
    // This property adds a highlight/border to the item
    this.resourceUri = workspaceFolder?.uri;  // This activates the decorationProvider capability
    
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
