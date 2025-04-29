import * as vscode from 'vscode';
import * as path from 'path';
import { logDebug, logInfo } from '../extension';

export enum SectionType {
    LAUNCH_CONFIGURATIONS = 'launch-configs',
    SCRIPTS = 'scripts',
    RECENT = 'recent',
    JETBRAINS_CONFIGS = 'jetbrains-configs',
    MAKEFILE_TASKS = 'makefile-tasks',
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
     * Makefile path (for Makefile tasks sections)
     */
    public readonly makefilePath?: string;

    /**
     * Constructor
     */
    constructor(title: string, sectionType: SectionType, workspaceFolder?: vscode.WorkspaceFolder, packageJsonPath?: string, makefilePath?: string) {
        super(title, vscode.TreeItemCollapsibleState.Expanded);
        logInfo(`Creating section: ${title} (${sectionType}${workspaceFolder ? ` in ${workspaceFolder.name}` : ''})`);
        
        this.sectionType = sectionType;
        this.workspaceFolder = workspaceFolder;
        this.packageJsonPath = packageJsonPath;
        this.makefilePath = makefilePath;

        // Set context value to apply distinctive styling for section headers
        this.contextValue = 'section';
        
        // Special context value for recent items section
        if (sectionType === SectionType.RECENT) {
            this.contextValue = 'section-recent-items';
        }
        
        // Set theme colors and icons for the section
        switch (sectionType) {
            case SectionType.SCRIPTS:
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__dirname, '../../resources/config-npm.svg')),
                    dark: vscode.Uri.file(path.join(__dirname, '../../resources/config-npm.svg'))
                };
                break;
            case SectionType.JETBRAINS_CONFIGS:
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__dirname, '../../resources/config-jetbrains.svg')),
                    dark: vscode.Uri.file(path.join(__dirname, '../../resources/config-jetbrains.svg'))
                };
                break;
            case SectionType.MAKEFILE_TASKS:
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__dirname, '../../resources/config-makefile.svg')),
                    dark: vscode.Uri.file(path.join(__dirname, '../../resources/config-makefile.svg'))
                };
                break;
            case SectionType.LAUNCH_CONFIGURATIONS:
                this.iconPath = {
                    light: vscode.Uri.file(path.join(__dirname, '../../resources/config-vscode.svg')),
                    dark: vscode.Uri.file(path.join(__dirname, '../../resources/config-vscode.svg'))
                };
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('folder', new vscode.ThemeColor('launch-sidebar.sectionIcon'));
        }
        
        // Apply tooltip with more information
        this.tooltip = workspaceFolder 
            ? `${title} in ${workspaceFolder.name} (${workspaceFolder.uri.fsPath})`
            : title;
            
        logDebug(`Section created with contextValue: ${this.contextValue}`);
    }
}
