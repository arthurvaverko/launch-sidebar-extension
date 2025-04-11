import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

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
  }>> {
    const runConfigs: Array<{
      name: string;
      type: string;
      xmlFilePath: string;
      packagePath?: string;
      command?: string;
    }> = [];
    
    try {
      // Look for .run directory (case insensitive)
      const items = fs.readdirSync(workspaceFolder.uri.fsPath, { withFileTypes: true });
      
      // Find the .run directory (may be .Run, .RUN, etc.)
      const runDirEntry = items.find(item => 
        item.isDirectory() && item.name.toLowerCase() === '.run'
      );
      
      if (!runDirEntry) {
        return runConfigs;
      }
      
      const runDirPath = path.join(workspaceFolder.uri.fsPath, runDirEntry.name);
      
      // Get all XML files in the .run directory
      const xmlFiles = fs.readdirSync(runDirPath, { withFileTypes: true })
        .filter(file => file.isFile() && path.extname(file.name).toLowerCase() === '.xml')
        .map(file => path.join(runDirPath, file.name));
      
      // Parse each XML file to extract run configurations
      for (const xmlFile of xmlFiles) {
        try {
          const content = fs.readFileSync(xmlFile, 'utf8');
          
          // Use regex to extract configuration name and type
          const nameMatch = /<configuration default="false" name="([^"]+)"/i.exec(content);
          const typeMatch = /type="([^"]+)"/i.exec(content);
          
          if (nameMatch && typeMatch) {
            const name = nameMatch[1];
            const type = typeMatch[1];
            
            // Extract package path for Go applications
            let packagePath;
            const packageMatch = /<package value="([^"]+)"/i.exec(content);
            if (packageMatch) {
              packagePath = packageMatch[1];
            }
            
            // Extract command for some configurations
            let command;
            const commandMatch = /<go_parameters value="([^"]+)"/i.exec(content);
            if (commandMatch) {
              command = commandMatch[1];
            }
            
            runConfigs.push({
              name,
              type,
              xmlFilePath: xmlFile,
              packagePath,
              command
            });
          }
        } catch (err) {
          console.error(`Error parsing ${xmlFile}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error reading .run directory in ${workspaceFolder.name}:`, err);
    }
    
    return runConfigs;
  }
}
