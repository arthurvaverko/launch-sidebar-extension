import * as vscode from 'vscode';

/**
 * Gets an appropriate icon based on a script name with color coding
 * Maps common script naming patterns to meaningful, color-coded icons
 * 
 * @param scriptName The name of the npm script
 * @returns A ThemeIcon with appropriate icon and color for the script type
 */
export function getScriptIcon(scriptName: string): vscode.ThemeIcon {
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
