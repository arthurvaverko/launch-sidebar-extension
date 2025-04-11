/**
 * Test file to manually trigger JetBrains configuration search
 */
import * as vscode from 'vscode';
import { JetBrainsRunConfigParser } from './utils/jetbrains-parser';
import { log } from './extension';

/**
 * Function to test JetBrains configuration search
 */
export async function testJetBrainsSearch(): Promise<void> {
  log('Starting JetBrains configuration test search...');
  
  // Get all workspace folders
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  
  if (workspaceFolders.length === 0) {
    log('No workspace folders found. Cannot search for JetBrains configurations.');
    return;
  }
  
  // Attempt to search in each workspace folder
  for (const folder of workspaceFolders) {
    log(`Testing JetBrains search in workspace folder: ${folder.name}`);
    
    try {
      const configs = await JetBrainsRunConfigParser.findRunConfigurations(folder);
      log(`Found ${configs.length} JetBrains configurations in ${folder.name}`);
      
      // Log details of each configuration
      configs.forEach((config, index) => {
        log(`Configuration ${index + 1}:`);
        log(`  Name: ${config.name}`);
        log(`  Type: ${config.type}`);
        log(`  File: ${config.xmlFilePath}`);
        if (config.packagePath) {
          log(`  Package: ${config.packagePath}`);
        }
        if (config.workingDirectory) {
          log(`  Working Directory: ${config.workingDirectory}`);
        }
      });
    } catch (error) {
      log(`Error testing JetBrains search in ${folder.name}: ${error}`);
    }
  }
  
  log('JetBrains configuration test search completed.');
}
