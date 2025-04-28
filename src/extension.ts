/**
 * Launch Sidebar Extension
 * 
 * Adds a sidebar view to display and quickly launch debug configurations and npm scripts
 * from a workspace with just a single click.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import { LaunchConfigurationItem } from './models/launch-items';
import { ScriptItem } from './models/script-item';
import { JetBrainsRunConfigItem } from './models/jetbrains-items';
import { LaunchConfigurationProvider } from './providers/launch-configuration-provider';

// Create a dedicated output channel for logging
export const outputChannel = vscode.window.createOutputChannel('Launch Sidebar');

/**
 * Helper function for logging to the output channel and console
 */
export function log(message: string): void {
  outputChannel.appendLine(message);
}

// Override console.log to redirect all output to our output channel
const originalConsoleLog = console.log;
console.log = function(...args: any[]) {
  // Convert all arguments to strings and join them
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  // Log to our output channel
  outputChannel.appendLine(message);
  
  // Also log to the original console.log for development purposes
  originalConsoleLog.apply(console, args);
};

/**
 * Activates the extension
 * Sets up the sidebar view, tree data provider, and command handlers
 */
export function activate(context: vscode.ExtensionContext) {
  // Show the output channel
  outputChannel.show();
  log('Launch Sidebar extension is now active!');

  // Import and run the JetBrains test
  import('./test-jetbrains.js').then(module => {
    log('Running JetBrains configuration test...');
    module.testJetBrainsSearch().catch(err => {
      log(`Error running JetBrains test: ${err}`);
    });
  }).catch(err => {
    log(`Error importing test module: ${err}`);
  });

  // Create the tree data provider
  const launchConfigurationProvider = new LaunchConfigurationProvider();
  
  // Register the tree view with increased item height for better spacing
  const treeView = vscode.window.createTreeView('launchConfigurations', {
    treeDataProvider: launchConfigurationProvider,
    showCollapseAll: false
  });
  
  // Set tree view options for larger fonts and spacing
  treeView.title = "📦 LAUNCH SIDEBAR";

  // Add tree view to disposables to avoid memory leaks
  context.subscriptions.push(treeView);
  
  // Register all commands with descriptive comments
  registerCommands(context, launchConfigurationProvider);
  
  // Set up file watchers for automatic refresh
  setupFileWatchers(context, launchConfigurationProvider);
  
  // Initial refresh to load configurations
  launchConfigurationProvider.refresh();
}

/**
 * Registers all commands used by the extension
 */
function registerCommands(
  context: vscode.ExtensionContext,
  launchConfigurationProvider: LaunchConfigurationProvider
): void {
  // Command: Refresh configuration list
  const refreshCommand = vscode.commands.registerCommand('launchConfigurations.refresh', () => {
    launchConfigurationProvider.refresh();
    vscode.window.showInformationMessage('Launch configurations refreshed');
  });
  
  // Command: Launch a debug configuration
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
  
  // Command: Edit a debug configuration
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
  
  // Command: Run a script with the appropriate package manager (npm, yarn, or pnpm)
  const runScriptCommand = vscode.commands.registerCommand('launchConfigurations.runScript', async (item: ScriptItem) => {
    try {
      // Get the directory containing the package.json
      const packageDir = path.dirname(item.packageJsonPath);
      
      // Use the detected package manager for this script
      const packageManager = item.packageManager;
      
      // Create a terminal for running the script
      const terminal = vscode.window.createTerminal({
        name: `${packageManager}: ${item.name}`,
        cwd: packageDir
      });
      
      // Run the script using the appropriate package manager
      terminal.sendText(`${packageManager} run ${item.name}`);
      terminal.show();
      
      // Show notification
      vscode.window.showInformationMessage(`Running ${packageManager} script: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run script: ${error}`);
    }
  });
  
  // Command: Edit an npm script
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

  // Command: Run a JetBrains configuration
  const runJetBrainsConfigCommand = vscode.commands.registerCommand('launchConfigurations.runJetBrainsConfig', async (item: JetBrainsRunConfigItem) => {
    try {
      // Determine the working directory to use
      // Use the working directory from the configuration if available, otherwise use the workspace folder
      const workingDir = item.workingDirectory || item.workspaceFolder.uri.fsPath;
      
      log(`Running JetBrains configuration: ${item.name} in working directory: ${workingDir}`);
      
      // Create a terminal for running the configuration
      const terminal = vscode.window.createTerminal({
        name: `JetBrains: ${item.name}`,
        cwd: workingDir
      });
      
      // Determine the command to run based on the configuration type
      let command = '';
      
      if (item.type.includes('GoApplicationRunConfiguration')) {
        if (item.packagePath) {
          command = `go run ${item.packagePath}`;
          if (item.cmdString) {
            command += ` ${item.cmdString}`;
          }
        } else {
          command = `go run .`;
        }
      } else if (item.type.includes('GoTestRunConfiguration')) {
        if (item.packagePath) {
          command = `go test ${item.packagePath}`;
          if (item.cmdString) {
            command += ` ${item.cmdString}`;
          }
        } else {
          command = `go test ./...`;
        }
      } else if (item.type.includes('NodeJSConfigurationType')) {
        command = `node ${item.packagePath || ''}`;
      } else if (item.type.includes('JavaScriptTestRunnerJest')) {
        command = `npx jest ${item.packagePath || ''}`;
      } else if (item.type.includes('ReactNative')) {
        command = `npx react-native start`;
      } else if (item.type.includes('ShConfigurationType')) {
        // Shell script configuration - handle both inline scripts and script files
        
        if (item.scriptText) {
          // For inline script, create a temporary script file
          log(`Running JetBrains inline shell script: ${item.name}`);
          
          // Create a temporary directory for the script if it doesn't exist
          const tempDir = path.join(workingDir, '.vscode-temp');
          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
          }
          
          // Create a temp script file with the script text
          const scriptFileName = `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.sh`;
          const scriptFilePath = path.join(tempDir, scriptFileName);
          
          // Write the script to the file
          fs.writeFileSync(scriptFilePath, item.scriptText);
          
          // Ensure script has execute permissions and run it
          command = `chmod +x "${scriptFilePath}" && "${scriptFilePath}" ${item.cmdString || ''}`;
          
          // Add cleanup command to remove the temporary script file after execution
          command += ` ; rm "${scriptFilePath}"`;
        } else if (item.packagePath) {
          // Execute an existing script file
          log(`Running JetBrains shell script file: ${item.packagePath}`);
          
          // Use the specified interpreter or default to bash
          const interpreter = item.interpreter || '/bin/bash';
          
          // Ensure script has execute permissions
          if (item.executeScriptFile) {
            // Run the script file directly (making it executable first)
            command = `chmod +x "${item.packagePath}" && "${item.packagePath}" ${item.cmdString || ''}`;
          } else {
            // Run through interpreter
            command = `"${interpreter}" "${item.packagePath}" ${item.cmdString || ''}`;
          }
        } else {
          // Default to running generic shell
          command = `sh`;
        }
      } else {
        // For unknown configuration types, just open the XML file
        vscode.window.showInformationMessage(`Unknown configuration type: ${item.type}. Opening configuration file instead.`);
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.xmlFilePath));
        await vscode.window.showTextDocument(document);
        return;
      }
      
      // Run the command
      terminal.sendText(command);
      terminal.show();
      
      // Show notification
      vscode.window.showInformationMessage(`Running JetBrains configuration: ${item.name}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to run JetBrains configuration: ${error}`);
    }
  });
  
  // Command: Edit a JetBrains configuration
  const editJetBrainsConfigCommand = vscode.commands.registerCommand('launchConfigurations.editJetBrainsConfig', async (item: JetBrainsRunConfigItem) => {
    try {
      // Open the XML file
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(item.xmlFilePath));
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open JetBrains configuration for editing: ${error}`);
    }
  });

  // Add all disposables to the context subscriptions
  context.subscriptions.push(
    refreshCommand,
    launchCommand,
    editCommand,
    runScriptCommand,
    editScriptCommand,
    runJetBrainsConfigCommand,
    editJetBrainsConfigCommand
  );
}

/**
 * Sets up file watchers to automatically refresh the view when related files change
 */
function setupFileWatchers(
  context: vscode.ExtensionContext,
  launchConfigurationProvider: LaunchConfigurationProvider
): void {
  // Watch for changes to launch.json files
  const launchJsonWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
  launchJsonWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  launchJsonWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  launchJsonWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Watch for changes to package.json files (for npm scripts)
  const packageJsonWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
  packageJsonWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  packageJsonWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  packageJsonWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Watch for changes to JetBrains run configuration files
  const jetBrainsConfigWatcher = vscode.workspace.createFileSystemWatcher('**/.run/**/*.xml');
  jetBrainsConfigWatcher.onDidChange(() => launchConfigurationProvider.refresh());
  jetBrainsConfigWatcher.onDidCreate(() => launchConfigurationProvider.refresh());
  jetBrainsConfigWatcher.onDidDelete(() => launchConfigurationProvider.refresh());
  
  // Register the watchers for disposal when the extension is deactivated
  context.subscriptions.push(
    launchJsonWatcher,
    packageJsonWatcher,
    jetBrainsConfigWatcher
  );
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
  // Clean up resources when the extension is deactivated
}
