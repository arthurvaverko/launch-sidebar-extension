import * as vscode from 'vscode';
import { logDebug, logInfo } from '../extension';

export enum SectionType {
    LAUNCH_CONFIGURATIONS = 'launch-configs',
    SCRIPTS = 'scripts',
    RECENT = 'recent',
    JETBRAINS_CONFIGS = 'jetbrains-configs',
}

/**
 * Represents a section header in the tree view
 * Used to group items by type and workspace folder
 */
export class SectionItem extends vscode.TreeItem {
    /**
     * Type of section
     */
    public readonly sectionType: SectionType;

    /**
     * Workspace folder for this section
     */
    public readonly workspaceFolder?: vscode.WorkspaceFolder;

    /**
     * Package JSON path (for script sections)
     */
    public readonly packageJsonPath?: string;

    /**
     * Constructor
     */
    constructor(title: string, sectionType: SectionType, workspaceFolder?: vscode.WorkspaceFolder, packageJsonPath?: string) {
        super(title, vscode.TreeItemCollapsibleState.Expanded);
        logInfo(`Creating section: ${title} (${sectionType}${workspaceFolder ? ` in ${workspaceFolder.name}` : ''})`);
        
        this.sectionType = sectionType;
        this.workspaceFolder = workspaceFolder;
        this.packageJsonPath = packageJsonPath;

        // Set context value to apply distinctive styling for section headers
        this.contextValue = 'section';
        
        // Special context value for recent items section
        if (sectionType === SectionType.RECENT) {
            this.contextValue = 'section-recent-items';
        }
        
        // Set theme colors and icons for the section
        this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('launch-sidebar.sectionIcon'));
        
        // Apply tooltip with more information
        this.tooltip = workspaceFolder 
            ? `${title} in ${workspaceFolder.name} (${workspaceFolder.uri.fsPath})`
            : title;
            
        logDebug(`Section created with contextValue: ${this.contextValue}`);
    }
}
