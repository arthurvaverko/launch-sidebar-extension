import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { XMLParser } from 'fast-xml-parser';
import { log } from '../extension';

/**
 * Interface for JetBrains run configuration
 */
export interface JetBrainsRunConfig {
  name: string;
  type: string;
  xmlFilePath: string;
  packagePath?: string;
  command?: string;
  workingDirectory?: string;
  scriptText?: string;
  interpreter?: string;
  executeInTerminal?: boolean;
  executeScriptFile?: boolean;
}

/**
 * Parses JetBrains run configuration XML files
 * These files are located in the .run directory and define run configurations
 * for JetBrains IDEs like IntelliJ, WebStorm, GoLand, etc.
 */
export class JetBrainsRunConfigParser {
  // XML parser instance
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    preserveOrder: true,
  });

  // Alternate parser with different settings in case the first one fails
  private static altParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    preserveOrder: false,
  });

  /**
   * Finds and parses all JetBrains run configuration files in a workspace folder
   * @param workspaceFolder The workspace folder to search in
   * @returns A promise that resolves to an array of parsed run configuration objects
   */
  public static async findRunConfigurations(workspaceFolder: vscode.WorkspaceFolder): Promise<JetBrainsRunConfig[]> {
    const runConfigs: JetBrainsRunConfig[] = [];
    
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
    runConfigs: JetBrainsRunConfig[]
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
        .filter(file => file.isFile() && 
          (path.extname(file.name).toLowerCase() === '.xml' || 
           file.name.toLowerCase().endsWith('.run.xml')))
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
    runConfigs: JetBrainsRunConfig[]
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
        .filter(file => file.isFile() && 
          (path.extname(file.name).toLowerCase() === '.xml' || 
           file.name.toLowerCase().endsWith('.run.xml')))
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
    runConfigs: JetBrainsRunConfig[],
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    // Parse each XML file to extract run configurations
    for (const xmlFile of xmlFiles) {
      try {
        log(`[JetBrains Parser] Parsing XML file: ${xmlFile}`);
        const content = fs.readFileSync(xmlFile, 'utf8');
        log(`[JetBrains Parser] File content length: ${content.length} bytes`);
        
        try {
          // Parse the XML content
          const parsedXml = this.parser.parse(content);
          
          // Add more debugging to understand the structure
          log(`[JetBrains Parser] Parsed XML structure: ${JSON.stringify(parsedXml).substring(0, 100)}...`);
          
          // Find the configuration element
          let configElement = null;
          
          // Search for the component and configuration elements
          if (Array.isArray(parsedXml)) {
            for (const item of parsedXml) {
              if (item?.component && Array.isArray(item.component)) {
                for (const comp of item.component) {
                  if (comp?.configuration && Array.isArray(comp.configuration)) {
                    configElement = comp.configuration[0];
                    break;
                  }
                }
              }
            }
          }
          
          if (!configElement) {
            log(`[JetBrains Parser] No configuration element found with primary parser, trying alternate approach...`);
            // Try alternate parsing approach
            const altParsedXml = this.altParser.parse(content);
            
            // Debugging for alternate parser
            log(`[JetBrains Parser] Alternate parsed structure: ${JSON.stringify(altParsedXml).substring(0, 100)}...`);
            
            // Look for configuration in alternate format
            if (altParsedXml?.component?.configuration) {
              configElement = altParsedXml.component.configuration;
              log(`[JetBrains Parser] Found configuration with alternate parser`);
            } else {
              log(`[JetBrains Parser] No configuration element found in ${xmlFile}`);
              continue;
            }
          }
          
          // Extract attributes from the configuration
          // JetBrains 2023+ format has _default='false' attribute
          const configAttrs = configElement?._default === 'false' || configElement?._name ? configElement : null;
          
          if (!configAttrs) {
            log(`[JetBrains Parser] No valid configuration attributes found in ${xmlFile}, attributes: ${JSON.stringify(configElement)}`);
            continue;
          }
          
          // Get basic properties
          const name = configAttrs._name;
          const type = configAttrs._type;
          
          if (!name || !type) {
            log(`[JetBrains Parser] Missing name or type in configuration from ${xmlFile}, attrs: ${JSON.stringify(configAttrs)}`);
            continue;
          }
          
          log(`[JetBrains Parser] Found configuration: ${name} (${type})`);
          
          // Create base configuration object
          const runConfig: JetBrainsRunConfig = {
            name,
            type,
            xmlFilePath: xmlFile
          };
          
          // Process configuration based on type
          if (type.includes('GoApplicationRunConfiguration')) {
            this.processGoConfiguration(configElement, runConfig, workspaceFolder);
          } else if (type.includes('ShConfigurationType')) {
            this.processShellConfiguration(configElement, runConfig, workspaceFolder);
          } else {
            // Process general configuration properties
            this.processGeneralConfiguration(configElement, runConfig, workspaceFolder);
          }
          
          // Add the configuration to the list
          runConfigs.push(runConfig);
          log(`[JetBrains Parser] Added configuration to list: ${name}`);
        } catch (parseErr) {
          log(`[JetBrains Parser] Error parsing XML: ${parseErr}`);
        }
      } catch (err) {
        log(`Error reading ${xmlFile}: ${err}`);
      }
    }
  }
  
  /**
   * Process a Go application configuration
   */
  private static processGoConfiguration(
    configElement: any, 
    runConfig: JetBrainsRunConfig, 
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    // Handle non-array format (from alternate parser)
    if (!Array.isArray(configElement)) {
      if (configElement.package && configElement.package._value) {
        runConfig.packagePath = configElement.package._value;
        log(`[JetBrains Parser] Found package path: ${runConfig.packagePath}`);
      }
      
      if (configElement.working_directory && configElement.working_directory._value) {
        runConfig.workingDirectory = configElement.working_directory._value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
        log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
      }
      
      if (configElement.go_parameters && configElement.go_parameters._value) {
        runConfig.command = configElement.go_parameters._value;
        log(`[JetBrains Parser] Found command: ${runConfig.command}`);
      }
      
      return;
    }
    
    // Handle array format (from primary parser)
    if (Array.isArray(configElement)) {
      // Look for package element
      for (const element of configElement) {
        if (element?.package && element.package[0]?._value) {
          runConfig.packagePath = element.package[0]._value;
          log(`[JetBrains Parser] Found package path: ${runConfig.packagePath}`);
        }
        
        // Look for working directory
        if (element?.working_directory && element.working_directory[0]?._value) {
          runConfig.workingDirectory = element.working_directory[0]._value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
          log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
        }
        
        // Look for command parameters
        if (element?.go_parameters && element.go_parameters[0]?._value) {
          runConfig.command = element.go_parameters[0]._value;
          log(`[JetBrains Parser] Found command: ${runConfig.command}`);
        }
      }
    }
  }
  
  /**
   * Process a shell script configuration
   */
  private static processShellConfiguration(
    configElement: any, 
    runConfig: JetBrainsRunConfig, 
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    // For direct element structure (from alternate parser)
    if (!Array.isArray(configElement) && configElement.option) {
      const options = Array.isArray(configElement.option) ? configElement.option : [configElement.option];
      
      for (const option of options) {
        this.processShellOption(option, runConfig, workspaceFolder);
      }
      return;
    }
    
    // For array structure (from primary parser)
    if (Array.isArray(configElement)) {
      // Process all option elements
      for (const element of configElement) {
        if (element?.option) {
          const options = Array.isArray(element.option) ? element.option : [element.option];
          
          for (const option of options) {
            this.processShellOption(option, runConfig, workspaceFolder);
          }
        }
      }
    }
  }
  
  /**
   * Process a shell script option
   */
  private static processShellOption(
    option: any,
    runConfig: JetBrainsRunConfig,
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    // Handle direct object with _name and _value
    const name = option?._name || '';
    const value = option?._value || '';
    
    // Extract script text (inline script)
    if (name === 'SCRIPT_TEXT' && value) {
      runConfig.scriptText = value;
      log(`[JetBrains Parser] Found script text: ${runConfig.scriptText?.substring(0, 50) || ''}...`);
    }
    
    // Extract script path (file script)
    if (name === 'SCRIPT_PATH' && value) {
      runConfig.packagePath = value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
      log(`[JetBrains Parser] Found script path: ${runConfig.packagePath}`);
    }
    
    // Extract working directory
    if (name === 'SCRIPT_WORKING_DIRECTORY' && value) {
      runConfig.workingDirectory = value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
      log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
    }
    
    // Extract interpreter path
    if (name === 'INTERPRETER_PATH' && value) {
      runConfig.interpreter = value;
      log(`[JetBrains Parser] Found interpreter: ${runConfig.interpreter}`);
    }
    
    // Extract execution flags
    if (name === 'EXECUTE_IN_TERMINAL' && value) {
      runConfig.executeInTerminal = value.toLowerCase() === 'true';
      log(`[JetBrains Parser] Execute in terminal: ${runConfig.executeInTerminal}`);
    }
    
    if (name === 'EXECUTE_SCRIPT_FILE' && value) {
      runConfig.executeScriptFile = value.toLowerCase() === 'true';
      log(`[JetBrains Parser] Execute script file: ${runConfig.executeScriptFile}`);
    }
    
    // Extract script options/arguments
    if (name === 'SCRIPT_OPTIONS' && value) {
      runConfig.command = value;
      log(`[JetBrains Parser] Found script options: ${runConfig.command}`);
    }
  }
  
  /**
   * Process general configuration properties
   */
  private static processGeneralConfiguration(
    configElement: any, 
    runConfig: JetBrainsRunConfig, 
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    // Handle non-array format (from alternate parser)
    if (!Array.isArray(configElement)) {
      if (configElement.working_directory && configElement.working_directory._value) {
        runConfig.workingDirectory = configElement.working_directory._value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
        log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
      }
      return;
    }
    
    // Handle array format (from primary parser)
    if (Array.isArray(configElement)) {
      // Look for working directory
      for (const element of configElement) {
        if (element?.working_directory && element.working_directory[0]?._value) {
          runConfig.workingDirectory = element.working_directory[0]._value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
          log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
        }
      }
    }
  }
}
