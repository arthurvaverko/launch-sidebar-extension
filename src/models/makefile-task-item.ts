import * as vscode from 'vscode';
import { getScriptIcon } from '../utils/script-icons';

/**
 * Represents a Makefile task item in the tree view
 * Each item displays a Makefile target name and its recipe as a tooltip
 */
export class MakefileTaskItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly makefilePath: string,
    public readonly workspaceFolder: vscode.WorkspaceFolder,
    public readonly recipe?: string
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = recipe ? `make ${name}\n\n${recipe}` : `make ${name}`;
    this.description = recipe || '';
    this.contextValue = 'makefile-task';
    this.iconPath = getScriptIcon(name);
    this.accessibilityInformation = {
      label: `Makefile task ${name}`,
      role: 'button'
    };
  }

  /**
   * Execute this Makefile task
   */
  execute(): void {
    vscode.commands.executeCommand('launchConfigurations.runMakefileTask', this);
  }
} 