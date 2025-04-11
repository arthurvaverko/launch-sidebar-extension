import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../extension';

/**
 * Parses JetBrains run configuration XML files
 * These files are located in the .run directory and define run configurations
 * for JetBrains IDEs like IntelliJ, WebStorm, GoLand, etc.
 */
export class JetBrainsRunConfigParser {
  /**
   * Finds and parses all JetBrains run configuration files in a workspace folder
   * @param workspaceFolder The workspace folder to search in
   * @returns A promise that resolves to an array of parsed run configuration objects
   */
  public static async findRunConfigurations(workspaceFolder: vscode.WorkspaceFolder): Promise<Array<{
    name: string;
    type: string;
    xmlFilePath: string;
    packagePath?: string;
    command?: string;
    workingDirectory?: string;
  }>> {
    const runConfigs: Array<{
      name: string;
      type: string;
      xmlFilePath: string;
      packagePath?: string;
      command?: string;
      workingDirectory?: string;
    }> = [];
    
    try {
      log(`[JetBrains Parser] Searching for configurations in workspace: ${workspaceFolder.uri.fsPath}`);
      // Look for configurations in both possible locations
      await this.findConfigurationsInRunFolder(workspaceFolder, runConfigs);
      await this.findConfigurationsInIdeaFolder(workspaceFolder, runConfigs);
      log(`[JetBrains Parser] Found ${runConfigs.length} configurations in total`);
    } catch (err) {
      log(`Error reading JetBrains run configurations in ${workspaceFolder.name}: ${err}`);
    }
    
    return runConfigs;
  }

  /**
   * Finds JetBrains run configurations in the .run directory
   * @param workspaceFolder The workspace folder to search in
   * @param runConfigs Array to populate with found configurations
   */
  private static async findConfigurationsInRunFolder(
    workspaceFolder: vscode.WorkspaceFolder,
    runConfigs: Array<{
      name: string;
      type: string;
      xmlFilePath: string;
      packagePath?: string;
      command?: string;
      workingDirectory?: string;
    }>
  ): Promise<void> {
    try {
      log(`[JetBrains Parser] Searching for .run directory in: ${workspaceFolder.uri.fsPath}`);
      // Look for .run directory (case insensitive)
      const items = fs.readdirSync(workspaceFolder.uri.fsPath, { withFileTypes: true });
      
      // Find the .run directory (may be .Run, .RUN, etc.)
      const runDirEntry = items.find(item => 
        item.isDirectory() && item.name.toLowerCase() === '.run'
      );
      
      if (!runDirEntry) {
        log(`[JetBrains Parser] No .run directory found in: ${workspaceFolder.uri.fsPath}`);
        return;
      }
      
      log(`[JetBrains Parser] Found .run directory: ${runDirEntry.name}`);
      const runDirPath = path.join(workspaceFolder.uri.fsPath, runDirEntry.name);
      
      // Get all XML files in the .run directory
      const xmlFiles = fs.readdirSync(runDirPath, { withFileTypes: true })
        .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.xml')
        .map(file => path.join(runDirPath, file.name));
      
      log(`[JetBrains Parser] Found ${xmlFiles.length} XML files in .run directory`);
      
      // Parse each XML file
      await this.parseXmlConfigurationFiles(xmlFiles, runConfigs, workspaceFolder);
    } catch (err) {
      log(`Error reading .run directory in ${workspaceFolder.name}: ${err}`);
    }
  }

  /**
   * Finds JetBrains run configurations in the .idea/runConfigurations directory
   * @param workspaceFolder The workspace folder to search in
   * @param runConfigs Array to populate with found configurations
   */
  private static async findConfigurationsInIdeaFolder(
    workspaceFolder: vscode.WorkspaceFolder,
    runConfigs: Array<{
      name: string;
      type: string;
      xmlFilePath: string;
      packagePath?: string;
      command?: string;
      workingDirectory?: string;
    }>
  ): Promise<void> {
    try {
      log(`[JetBrains Parser] Searching for .idea directory in: ${workspaceFolder.uri.fsPath}`);
      // Look for .idea directory
      const ideaDirPath = path.join(workspaceFolder.uri.fsPath, '.idea');
      if (!fs.existsSync(ideaDirPath)) {
        log(`[JetBrains Parser] No .idea directory found in: ${workspaceFolder.uri.fsPath}`);
        return;
      }
      
      log(`[JetBrains Parser] Found .idea directory, checking for runConfigurations folder`);
      // Look for runConfigurations directory
      const runConfigsDirPath = path.join(ideaDirPath, 'runConfigurations');
      if (!fs.existsSync(runConfigsDirPath)) {
        log(`[JetBrains Parser] No runConfigurations directory found in: ${ideaDirPath}`);
        return;
      }
      
      log(`[JetBrains Parser] Found runConfigurations directory`);
      // Get all XML files in the .idea/runConfigurations directory
      const xmlFiles = fs.readdirSync(runConfigsDirPath, { withFileTypes: true })
        .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.xml')
        .map(file => path.join(runConfigsDirPath, file.name));
      
      log(`[JetBrains Parser] Found ${xmlFiles.length} XML files in .idea/runConfigurations directory`);
      
      // Parse each XML file
      await this.parseXmlConfigurationFiles(xmlFiles, runConfigs, workspaceFolder);
    } catch (err) {
      log(`Error reading .idea/runConfigurations directory in ${workspaceFolder.name}: ${err}`);
    }
  }

  /**
   * Parses XML configuration files and extracts run configurations
   * @param xmlFiles Array of XML file paths
   * @param runConfigs Array to populate with found configurations
   * @param workspaceFolder The workspace folder for resolving relative paths
   */
  private static async parseXmlConfigurationFiles(
    xmlFiles: string[],
    runConfigs: Array<{
      name: string;
      type: string;
      xmlFilePath: string;
      packagePath?: string;
      command?: string;
      workingDirectory?: string;
    }>,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    // Parse each XML file to extract run configurations
    for (const xmlFile of xmlFiles) {
      try {
        log(`[JetBrains Parser] Parsing XML file: ${xmlFile}`);
        const content = fs.readFileSync(xmlFile, 'utf8');
        log(`[JetBrains Parser] File content length: ${content.length} bytes`);
        
        // Log first 200 characters for debugging
        log(`[JetBrains Parser] File content preview: ${content.substring(0, 200)}...`);
        
        // Use regex to extract configuration name and type
        const nameMatch = /<configuration default="false" name="([^"]+)"/i.exec(content);
        const typeMatch = /type="([^"]+)"/i.exec(content);
        
        if (nameMatch && typeMatch) {
          const name = nameMatch[1];
          const type = typeMatch[1];
          log(`[JetBrains Parser] Found configuration: ${name} (${type})`);
          
          // Extract package path for Go applications
          let packagePath;
          const packageMatch = /<package value="([^"]+)"/i.exec(content);
          if (packageMatch) {
            packagePath = packageMatch[1];
            log(`[JetBrains Parser] Found package path: ${packagePath}`);
          }
          
          // Extract command for some configurations
          let command;
          const commandMatch = /<go_parameters value="([^"]+)"/i.exec(content);
          if (commandMatch) {
            command = commandMatch[1];
            log(`[JetBrains Parser] Found command: ${command}`);
          }
          
          // Extract working directory
          let workingDirectory;
          const workingDirMatch = /<working_directory value="([^"]+)"/i.exec(content);
          if (workingDirMatch) {
            workingDirectory = workingDirMatch[1].replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
            log(`[JetBrains Parser] Found working directory: ${workingDirectory}`);
          }
          
          runConfigs.push({
            name,
            type,
            xmlFilePath: xmlFile,
            packagePath,
            command,
            workingDirectory
          });
          log(`[JetBrains Parser] Added configuration to list: ${name}`);
        } else {
          log(`[JetBrains Parser] No matching configuration found in file. nameMatch: ${!!nameMatch}, typeMatch: ${!!typeMatch}`);
          // Try a more general regex to see if there's any configuration data
          const configCheck = /<configuration/i.exec(content);
          if (configCheck) {
            log(`[JetBrains Parser] File contains <configuration> tag but doesn't match expected format`);
          } else {
            log(`[JetBrains Parser] File doesn't contain any <configuration> tags`);
          }
        }
      } catch (err) {
        log(`Error parsing ${xmlFile}: ${err}`);
      }
    }
  }
}
