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
  goParameters?: string;
  envVars?: Record<string, string>;
}

/**
 * Parses JetBrains run configuration XML files
 * These files are located in the .run directory and define run configurations
 * for JetBrains IDEs like IntelliJ, WebStorm, GoLand, etc.
 */
export class JetBrainsRunConfigParser {
  // XML parser instance with different options to better handle JetBrains 2023+ format
  private static parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    isArray: (name, jpath, isLeafNode, isAttribute) => {
      if (name === 'component' || name === 'configuration' || name === 'option') return true;
      return false;
    },
    parseAttributeValue: true
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
          // Parse the XML content with our configured parser
          const parsedXml = this.parser.parse(content);
          
          // Debug output of the parsed structure
          log(`[JetBrains Parser] Parsed XML structure: ${JSON.stringify(parsedXml).substring(0, 200)}...`);
          
          // The structure for JetBrains 2023+ files should be:
          // { component: [{ configuration: [{ name, type, ... }] }] }
          if (parsedXml.component && parsedXml.component.length > 0) {
            for (const component of parsedXml.component) {
              if (component.configuration && component.configuration.length > 0) {
                for (const config of component.configuration) {
                  // Get the required attributes
                  const name = config.name;
                  const type = config.type;
                  
                  if (!name || !type) {
                    log(`[JetBrains Parser] Missing name or type in configuration`);
                    continue;
                  }
                  
                  log(`[JetBrains Parser] Found configuration: ${name} (${type})`);
                  
                  // Create base configuration
                  const runConfig: JetBrainsRunConfig = {
                    name,
                    type,
                    xmlFilePath: xmlFile
                  };
                  
                  // Process configuration based on type
                  if (type === 'ShConfigurationType') {
                    this.processShellConfiguration(config, runConfig, workspaceFolder);
                  } else if (type === 'GoApplicationRunConfiguration' || type.includes('GoApplication')) {
                    this.processGoConfiguration(config, runConfig, workspaceFolder);
                  } else if (type === 'GoTestRunConfiguration' || type.includes('GoTest')) {
                    this.processGoTestConfiguration(config, runConfig, workspaceFolder);
                  } else {
                    // Process general configuration
                    this.processGeneralConfiguration(config, runConfig, workspaceFolder);
                  }
                  
                  // Add to the list of configs
                  runConfigs.push(runConfig);
                  log(`[JetBrains Parser] Added configuration to list: ${name}`);
                }
              } else {
                log(`[JetBrains Parser] No configuration element found in component`);
              }
            }
          } else {
            log(`[JetBrains Parser] No component element found in ${xmlFile}`);
          }
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
    log(`[JetBrains Parser] Processing Go configuration: ${JSON.stringify(configElement).substring(0, 200)}...`);
    
    // Extract package path
    if (configElement.package && configElement.package.value) {
      runConfig.packagePath = configElement.package.value;
      log(`[JetBrains Parser] Found package path: ${runConfig.packagePath}`);
    }
    
    // Extract working directory
    if (configElement.working_directory && configElement.working_directory.value) {
      runConfig.workingDirectory = configElement.working_directory.value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
      log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
    }
    
    // Extract go parameters
    if (configElement.go_parameters && configElement.go_parameters.value) {
      runConfig.goParameters = configElement.go_parameters.value;
      log(`[JetBrains Parser] Found go parameters: ${runConfig.goParameters}`);
    }
    
    // Extract environment variables
    if (configElement.envs && configElement.envs.env) {
      runConfig.envVars = {};
      
      // Handle both array and single env var
      const envVars = Array.isArray(configElement.envs.env) 
        ? configElement.envs.env 
        : [configElement.envs.env];
        
      for (const env of envVars) {
        if (env.name && env.value !== undefined) {
          runConfig.envVars[env.name] = env.value;
          log(`[JetBrains Parser] Found env var: ${env.name}=${env.value}`);
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
    log(`[JetBrains Parser] Processing shell configuration: ${JSON.stringify(configElement).substring(0, 200)}...`);
    
    // Set default interpreter
    runConfig.interpreter = '/bin/bash';
    
    // Process all option elements
    if (configElement.option && configElement.option.length > 0) {
      for (const option of configElement.option) {
        const name = option.name;
        const value = option.value;
        
        if (!name || value === undefined) continue;
        
        // Extract script text (inline script)
        if (name === 'SCRIPT_TEXT') {
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
        if (name === 'EXECUTE_IN_TERMINAL') {
          runConfig.executeInTerminal = value === 'true';
          log(`[JetBrains Parser] Execute in terminal: ${runConfig.executeInTerminal}`);
        }
        
        if (name === 'EXECUTE_SCRIPT_FILE') {
          runConfig.executeScriptFile = value === 'true';
          log(`[JetBrains Parser] Execute script file: ${runConfig.executeScriptFile}`);
        }
        
        // Extract script options/arguments
        if (name === 'SCRIPT_OPTIONS' && value) {
          runConfig.command = value;
          log(`[JetBrains Parser] Found script options: ${runConfig.command}`);
        }
      }
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
    log(`[JetBrains Parser] Processing general configuration: ${JSON.stringify(configElement).substring(0, 200)}...`);
    
    // Extract working directory
    if (configElement.working_directory && configElement.working_directory.value) {
      runConfig.workingDirectory = configElement.working_directory.value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
      log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
    }
    
    // Extract module-specific data
    if (configElement.module) {
      log(`[JetBrains Parser] Found module: ${JSON.stringify(configElement.module)}`);
    }
    
    // For compound configurations
    if (configElement.toRun) {
      log(`[JetBrains Parser] Found compound configuration: ${JSON.stringify(configElement.toRun)}`);
    }
  }

  /**
   * Process a Go test configuration
   */
  private static processGoTestConfiguration(
    configElement: any, 
    runConfig: JetBrainsRunConfig, 
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    log(`[JetBrains Parser] Processing Go test configuration: ${JSON.stringify(configElement).substring(0, 200)}...`);
    
    // Extract package path
    if (configElement.package && configElement.package.value) {
      runConfig.packagePath = configElement.package.value;
      log(`[JetBrains Parser] Found package path: ${runConfig.packagePath}`);
    }
    
    // Extract working directory
    if (configElement.working_directory && configElement.working_directory.value) {
      runConfig.workingDirectory = configElement.working_directory.value.replace(/\$PROJECT_DIR\$/g, workspaceFolder.uri.fsPath);
      log(`[JetBrains Parser] Found working directory: ${runConfig.workingDirectory}`);
    }
    
    // Extract go parameters (command line arguments)
    if (configElement.go_parameters && configElement.go_parameters.value) {
      runConfig.command = configElement.go_parameters.value;
      log(`[JetBrains Parser] Found go parameters: ${runConfig.command}`);
    }
    
    // Extract test kind (package, directory, file)
    if (configElement.kind && configElement.kind.value) {
      log(`[JetBrains Parser] Found test kind: ${configElement.kind.value}`);
    }
    
    // Extract test framework (gotest, etc.)
    if (configElement.framework && configElement.framework.value) {
      log(`[JetBrains Parser] Found test framework: ${configElement.framework.value}`);
    }
  }
}
