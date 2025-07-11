/**
 * jsEnvoy CLI - Main entry point
 * 
 * This will be implemented following the TDD plan in docs/CLI_IMPLEMENTATION_PLAN.md
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// ResourceManager will automatically load .env file

// Import core classes
const { ResourceManager, ModuleFactory } = require('@jsenvoy/modules');

class CLI {
  constructor() {
    this.args = undefined;
    this.options = undefined;
    this.resourceManager = undefined;
    this.moduleFactory = undefined;
    this.modules = new Map();
    this.tools = new Map();
    this.moduleClasses = new Map();
    this.moduleInstances = new Map();
    this.toolRegistry = null;
    this.config = {};
    this.configSearchPath = process.cwd();
    this.interactiveContext = {};
    this.commandHistory = [];
    this.multiLineMode = null;
    this.multiLineBuffer = [];
    this.aliasExpansionDepth = 0;
    this.maxAliasExpansionDepth = 10;
  }

  async run(argv) {
    try {
      this.parseArgs(argv);
      await this.loadConfiguration();
      
      // Apply preset if specified
      if (this.options?.preset) {
        this.applyPreset(this.options.preset);
      }
      
      // Handle batch file execution
      if (this.options?.batch) {
        await this.executeBatchFile(this.options.batch);
        return 0;
      }
      
      await this.initializeResourceManager();
      await this.loadModules();
      this.initializeModuleFactory();
      
      // Handle command chaining
      if (argv && (argv.includes('&&') || argv.includes(';'))) {
        await this.executeCommandChain(argv);
        return 0;
      }
      
      await this.executeCommand();
      return 0;
    } catch (error) {
      this.handleError(error);
      process.exit(1);
    }
  }

  parseArgs(argv) {
    // Initialize default values
    this.args = {};
    this.options = {
      verbose: false,
      output: 'text',
      color: true,
      config: null,
      preset: null,
      batch: null
    };
    
    // Skip node and script name
    const args = argv.slice(2);
    
    if (args.length === 0) {
      this.command = 'help';
      return;
    }
    
    let currentIndex = 0;
    
    // Parse global options first
    while (currentIndex < args.length && args[currentIndex].startsWith('--')) {
      const option = args[currentIndex];
      
      if (option === '--verbose') {
        this.options.verbose = true;
        currentIndex++;
      } else if (option === '--output') {
        currentIndex++;
        if (currentIndex < args.length) {
          this.options.output = args[currentIndex];
          currentIndex++;
        }
      } else if (option === '--no-color') {
        this.options.color = false;
        currentIndex++;
      } else if (option === '--config') {
        currentIndex++;
        if (currentIndex < args.length) {
          this.options.config = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--config requires a value');
        }
      } else if (option === '--preset') {
        currentIndex++;
        if (currentIndex < args.length) {
          this.options.preset = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--preset requires a value');
        }
      } else if (option === '--batch') {
        currentIndex++;
        if (currentIndex < args.length) {
          this.options.batch = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--batch requires a value');
        }
      } else {
        break; // Not a global option, stop parsing
      }
    }
    
    // Check for help flags
    if (args.includes('--help') || args.includes('-h')) {
      this.command = 'help';
      // If there's a command before --help, use it as help topic
      const helpIndex = Math.max(args.indexOf('--help'), args.indexOf('-h'));
      if (helpIndex > 0 && !args[0].startsWith('-')) {
        this.helpTopic = args[0];
      }
      return;
    }
    
    // Check for -i flag
    if (args[currentIndex] === '-i') {
      this.command = 'interactive';
      return;
    }
    
    // Get the main command
    const mainArg = args[currentIndex];
    currentIndex++;
    
    // Check for alias expansion (including built-in aliases)
    if (mainArg) {
      const expandedCommand = this.expandAlias(mainArg);
      if (expandedCommand && expandedCommand !== mainArg) {
        // Replace the alias with expanded command
        // Need to handle quoted strings properly
        const expandedParts = this.splitCommandLine(expandedCommand);
        const remainingArgs = args.slice(currentIndex);
        const newArgs = [...args.slice(0, currentIndex - 1), ...expandedParts, ...remainingArgs];
        // Re-parse with expanded args
        return this.parseArgs(['node', 'jsenvoy', ...newArgs]);
      }
    }
    
    // Check for special commands
    if (mainArg === 'help') {
      this.command = 'help';
      if (currentIndex < args.length) {
        this.helpTopic = args[currentIndex];
      }
      return;
    }
    
    if (mainArg === 'list') {
      this.command = 'list';
      this.listType = currentIndex < args.length ? args[currentIndex] : 'all';
      return;
    }
    
    if (mainArg === 'interactive') {
      this.command = 'interactive';
      return;
    }
    
    // Check for module.tool syntax
    if (mainArg.includes('.')) {
      const [moduleName, toolName] = mainArg.split('.');
      if (moduleName && toolName) {
        this.command = 'execute';
        this.moduleName = moduleName;
        this.toolName = toolName;
        
        // Parse remaining arguments
        while (currentIndex < args.length) {
          const arg = args[currentIndex];
          
          if (arg === '--json') {
            currentIndex++;
            if (currentIndex < args.length) {
              try {
                const jsonArgs = JSON.parse(args[currentIndex]);
                Object.assign(this.args, jsonArgs);
              } catch (e) {
                throw new Error(`Invalid JSON argument: ${e.message}`);
              }
              currentIndex++;
            }
          } else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            currentIndex++;
            
            if (currentIndex < args.length && !args[currentIndex].startsWith('--')) {
              // Named argument with value
              let value = args[currentIndex];
              // Remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) || 
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              this.args[key] = value;
              currentIndex++;
            } else {
              // Boolean flag
              this.args[key] = true;
            }
          } else {
            currentIndex++;
          }
        }
        
        return;
      }
    }
    
    // If we get here, it's an invalid command
    throw new Error(`Invalid command: ${mainArg}`);
  }

  async loadModules() {
    // Clear existing modules
    this.modules.clear();
    this.tools.clear();
    this.moduleClasses.clear();
    
    // Discover all module files
    const moduleFiles = await this.discoverModules();
    
    // Load each module
    for (const moduleFile of moduleFiles) {
      try {
        // Import the module class
        const ModuleClass = require(moduleFile);
        
        // Extract module name from class name (e.g., CalculatorModule -> calculator)
        const moduleName = ModuleClass.name
          .replace(/Module$/, '')
          .toLowerCase();
        
        // Store the module class for later instantiation
        this.moduleClasses.set(moduleName, ModuleClass);
        
        // Create a temporary instance to extract metadata
        // For modules with dependencies, we'll pass mock values
        const mockDependencies = {};
        if (ModuleClass.dependencies) {
          for (const dep of ModuleClass.dependencies) {
            // Provide mock values based on common dependency types
            if (dep.includes('Path') || dep === 'basePath') {
              mockDependencies[dep] = '/tmp';
            } else if (dep === 'encoding') {
              mockDependencies[dep] = 'utf8';
            } else if (dep.includes('create') || dep.includes('boolean')) {
              mockDependencies[dep] = false;
            } else if (dep === 'permissions') {
              mockDependencies[dep] = 0o755;
            } else {
              mockDependencies[dep] = 'mock-value';
            }
          }
        }
        
        const tempInstance = new ModuleClass(mockDependencies);
        
        // Store module metadata
        const tools = tempInstance.getTools ? tempInstance.getTools() : [];
        
        // Count the actual number of functions
        let functionCount = 0;
        for (const tool of tools) {
          if (typeof tool.getAllToolDescriptions === 'function') {
            functionCount += tool.getAllToolDescriptions().length;
          } else {
            functionCount += 1;
          }
        }
        
        const moduleInfo = {
          name: moduleName,
          className: ModuleClass.name,
          dependencies: ModuleClass.dependencies || [],
          tools: tools,
          functionCount: functionCount
        };
        
        this.modules.set(moduleName, moduleInfo);
        
        // Map tools for quick lookup
        for (const tool of moduleInfo.tools) {
          const toolKey = `${moduleName}.${tool.name}`;
          this.tools.set(toolKey, tool);
        }
      } catch (error) {
        // Skip modules that fail to load
        if (this.options?.verbose) {
          console.error(`Failed to load module from ${moduleFile}:`, error.message);
        }
      }
    }
  }
  
  getModulePath() {
    // Resolve path to @jsenvoy/tools src directory where modules are located
    const toolsPath = path.resolve(__dirname, '../../tools/src');
    return toolsPath;
  }
  
  async discoverModules() {
    const modulesPath = this.getModulePath();
    const moduleFiles = [];
    
    try {
      const entries = await fs.readdir(modulesPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Look for Module.js files in subdirectories
          const subPath = path.join(modulesPath, entry.name);
          const subFiles = await fs.readdir(subPath);
          
          for (const file of subFiles) {
            if (file.endsWith('Module.js')) {
              const fullPath = path.join(subPath, file);
              moduleFiles.push(fullPath);
            }
          }
        }
      }
    } catch (error) {
      if (this.options?.verbose) {
        console.error('Error discovering modules:', error.message);
      }
    }
    
    return moduleFiles;
  }

  async executeCommand() {
    if (this.command === 'execute') {
      await this.executeToolCommand();
    } else if (this.command === 'list') {
      await this.executeListCommand();
    } else if (this.command === 'help') {
      await this.executeHelpCommand();
    } else if (this.command === 'interactive') {
      await this.executeInteractiveCommand();
    } else {
      console.error(`Unknown command: ${this.command}`);
      process.exit(1);
    }
  }

  async executeToolCommand() {
    const toolName = `${this.moduleName}.${this.toolName}`;
    
    // Check if module exists
    if (!this.modules.has(this.moduleName)) {
      throw new Error(`Module not found: ${this.moduleName}`);
    }
    
    // Check if tool exists
    const tool = this.getToolByName(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Validate arguments
    const validation = this.validateToolArguments(toolName, this.args);
    if (!validation.valid) {
      // Find the first missing required parameter
      const missingParam = validation.errors.find(e => e.includes('Missing required'));
      if (missingParam) {
        throw new Error(missingParam);
      }
      // Handle other validation errors
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Invalid arguments provided');
    }
    
    // Check for unknown parameters and suggest corrections
    const knownParams = Object.keys(tool.parameters?.properties || {});
    for (const argKey of Object.keys(this.args)) {
      if (!knownParams.includes(argKey)) {
        const suggestion = this.findBestMatch(argKey, knownParams);
        if (suggestion) {
          console.log(`\nDid you mean: --${suggestion}?`);
        } else {
          console.log('\nAvailable parameters:');
          knownParams.forEach(param => console.log(`  --${param}`));
        }
        throw new Error(`Unknown parameter: --${argKey}`);
      }
    }
    
    // Convert arguments to correct types
    const convertedArgs = this.convertArguments(toolName, this.args);
    
    try {
      // Execute the tool
      const result = await this.executeTool(toolName, convertedArgs);
      
      // Format and display output
      this.formatOutput(result);
    } catch (error) {
      throw error;
    }
  }

  async executeListCommand() {
    if (this.listType === 'modules') {
      await this.listModules();
    } else if (this.listType === 'tools') {
      await this.listTools();
    } else if (this.listType === 'aliases') {
      await this.listAliases();
    } else if (this.listType === 'presets') {
      await this.listPresets();
    } else {
      // Default to 'all'
      await this.listAll();
    }
  }

  async listModules() {
    const modules = Array.from(this.modules.values());
    
    if (this.options?.output === 'json') {
      console.log(JSON.stringify(modules, null, 2));
      return;
    }
    
    console.log(chalk.bold('\nAvailable Modules\n'));
    
    if (modules.length === 0) {
      console.log('No modules found');
      return;
    }
    
    // Prepare table data
    const tableData = modules.map(module => {
      const toolCount = module.functionCount || module.tools.length;
      const deps = module.dependencies.length;
      
      return {
        name: module.name,
        tools: `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`,
        dependencies: deps > 0 ? deps : 'none'
      };
    });
    
    this.formatTable(tableData);
    
    // Show detailed dependencies in verbose mode
    if (this.options?.verbose) {
      console.log('\nModule Details:');
      modules.forEach(module => {
        if (module.dependencies.length > 0) {
          console.log(`\n${chalk.bold(module.name)}:`);
          console.log('  Dependencies:');
          module.dependencies.forEach(dep => {
            console.log(`    - ${dep}`);
          });
        }
      });
    }
    
    console.log(`\nTotal: ${modules.length} modules`);
  }

  async listTools() {
    const moduleFilter = this.args?.module;
    const tools = this.discoverTools();
    
    let toolList = Array.from(tools.entries());
    
    // Apply module filter if provided
    if (moduleFilter) {
      toolList = toolList.filter(([key, tool]) => tool.module === moduleFilter);
    }
    
    if (this.options?.output === 'json') {
      const jsonData = toolList.map(([key, tool]) => ({
        name: key,
        module: tool.module,
        description: tool.description
      }));
      console.log(JSON.stringify(jsonData, null, 2));
      return;
    }
    
    console.log(chalk.bold('\nAvailable Tools\n'));
    
    if (toolList.length === 0) {
      console.log('No tools found');
      return;
    }
    
    // Group tools by module
    const toolsByModule = {};
    toolList.forEach(([key, tool]) => {
      if (!toolsByModule[tool.module]) {
        toolsByModule[tool.module] = [];
      }
      toolsByModule[tool.module].push({ key, ...tool });
    });
    
    // Display tools grouped by module
    Object.entries(toolsByModule).forEach(([moduleName, moduleTools]) => {
      console.log(chalk.bold(`${moduleName}:`));
      
      moduleTools.forEach(tool => {
        console.log(`  ${chalk.cyan(tool.key)}`);
        console.log(`    ${tool.description}`);
      });
      
      console.log(); // Empty line between modules
    });
    
    console.log(`Total: ${toolList.length} tools`);
  }

  async listAll() {
    if (this.options?.output === 'json') {
      const modules = Array.from(this.modules.values());
      const tools = Array.from(this.discoverTools().entries()).map(([key, tool]) => ({
        name: key,
        module: tool.module,
        description: tool.description
      }));
      
      console.log(JSON.stringify({ modules, tools }, null, 2));
      return;
    }
    
    console.log(chalk.bold('\n=== jsEnvoy CLI ===\n'));
    
    // List modules
    console.log(chalk.bold('Modules:'));
    const modules = Array.from(this.modules.values());
    
    if (modules.length === 0) {
      console.log('  No modules found');
    } else {
      modules.forEach(module => {
        const toolCount = module.functionCount || module.tools.length;
        console.log(`  ${chalk.green(module.name)} (${toolCount} ${toolCount === 1 ? 'tool' : 'tools'})`);
      });
    }
    
    console.log(); // Empty line
    
    // List tools
    console.log(chalk.bold('Tools:'));
    const tools = this.discoverTools();
    
    if (tools.size === 0) {
      console.log('  No tools found');
    } else {
      // Group by module for better display
      const toolsByModule = {};
      tools.forEach((tool, key) => {
        if (!toolsByModule[tool.module]) {
          toolsByModule[tool.module] = [];
        }
        toolsByModule[tool.module].push(key);
      });
      
      Object.entries(toolsByModule).forEach(([moduleName, toolKeys]) => {
        console.log(`  ${moduleName}:`);
        toolKeys.forEach(key => {
          console.log(`    - ${chalk.cyan(key)}`);
        });
      });
    }
    
    console.log(`\nTotal: ${modules.length} modules, ${tools.size} tools`);
  }

  async listAliases() {
    const builtInAliases = {
      'ls': 'list',
      'i': 'interactive'
    };
    
    const customAliases = this.config?.aliases || {};
    const allAliases = { ...builtInAliases, ...customAliases };
    
    if (this.options?.output === 'json') {
      console.log(JSON.stringify(allAliases, null, 2));
      return;
    }
    
    console.log(chalk.bold('\nAvailable Aliases\n'));
    
    if (Object.keys(allAliases).length === 0) {
      console.log('No aliases defined');
      return;
    }
    
    // Prepare table data
    const tableData = Object.entries(allAliases).map(([alias, command]) => ({
      alias,
      command,
      type: builtInAliases[alias] ? 'built-in' : 'custom'
    }));
    
    this.formatTable(tableData);
  }

  async listPresets() {
    const presets = this.config?.presets || {};
    
    if (this.options?.output === 'json') {
      console.log(JSON.stringify(presets, null, 2));
      return;
    }
    
    console.log(chalk.bold('\nAvailable Presets\n'));
    
    if (Object.keys(presets).length === 0) {
      console.log('No presets defined');
      return;
    }
    
    // Show preset names and their configurations
    Object.entries(presets).forEach(([name, config]) => {
      console.log(chalk.green(name) + ':');
      Object.entries(config).forEach(([key, value]) => {
        if (key === 'resources' && typeof value === 'object') {
          console.log(`  ${key}:`);
          Object.entries(value).forEach(([rKey, rValue]) => {
            console.log(`    ${rKey}: ${rValue}`);
          });
        } else {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      });
      console.log();
    });
  }

  async executeHelpCommand() {
    if (this.helpTopic) {
      await this.showTopicHelp(this.helpTopic);
    } else {
      await this.showGeneralHelp();
    }
  }

  async showGeneralHelp() {
    const useColor = this.config?.color !== false;
    
    console.log();
    console.log(useColor ? chalk.bold.cyan('jsEnvoy CLI') : 'jsEnvoy CLI');
    console.log('A command-line interface for executing modular AI agent tools');
    console.log();
    
    console.log(useColor ? chalk.bold('Usage:') : 'Usage:');
    console.log('  jsenvoy [options] <command> [arguments]');
    console.log();
    
    console.log(useColor ? chalk.bold('Commands:') : 'Commands:');
    console.log('  <module>.<tool>     Execute a specific tool');
    console.log('  list [type]         List available modules or tools');
    console.log('  help [topic]        Show help information');
    console.log('  interactive         Start interactive mode (REPL)');
    console.log();
    
    console.log(useColor ? chalk.bold('Options:') : 'Options:');
    console.log('  --verbose, -v       Show detailed output');
    console.log('  --output <format>   Output format (text, json)');
    console.log('  --no-color          Disable colored output');
    console.log('  --config <file>     Use specific config file');
    console.log('  --help, -h          Show help');
    console.log();
    
    console.log(useColor ? chalk.bold('Examples:') : 'Examples:');
    console.log('  jsenvoy calculator.calculator_evaluate --expression "2+2"');
    console.log('  jsenvoy list modules');
    console.log('  jsenvoy list tools --module file');
    console.log('  jsenvoy help calculator.calculator_evaluate');
    console.log('  jsenvoy --output json list all');
    console.log();
    
    console.log('For more information on a specific command or tool, use:');
    console.log('  jsenvoy help <command>');
    console.log('  jsenvoy help <module>.<tool>');
  }

  async showTopicHelp(topic) {
    // Check if it's a command
    if (['list', 'help', 'interactive'].includes(topic)) {
      await this.showCommandHelp(topic);
      return;
    }
    
    // Check if it's a module.tool
    if (topic.includes('.')) {
      const tool = this.getToolByName(topic);
      if (tool) {
        await this.showToolHelp(topic, tool);
        return;
      }
    }
    
    // Check if it's a module name
    const module = this.modules.get(topic);
    if (module) {
      await this.showModuleHelp(topic, module);
      return;
    }
    
    // Unknown topic
    await this.showUnknownTopicHelp(topic);
  }

  async showCommandHelp(command) {
    const useColor = this.config?.color !== false;
    
    console.log();
    console.log(useColor ? chalk.bold(`Help: ${command} command`) : `Help: ${command} command`);
    console.log();
    
    switch (command) {
      case 'list':
        console.log('List available modules and tools');
        console.log();
        console.log(useColor ? chalk.bold('Usage:') : 'Usage:');
        console.log('  jsenvoy list [type] [options]');
        console.log();
        console.log(useColor ? chalk.bold('Types:') : 'Types:');
        console.log('  modules    List all available modules');
        console.log('  tools      List all available tools');
        console.log('  all        List both modules and tools (default)');
        console.log();
        console.log(useColor ? chalk.bold('Options:') : 'Options:');
        console.log('  --module <name>    Filter tools by module');
        console.log('  --output json      Output in JSON format');
        console.log('  --verbose          Show detailed information');
        console.log();
        console.log(useColor ? chalk.bold('Examples:') : 'Examples:');
        console.log('  jsenvoy list modules');
        console.log('  jsenvoy list tools --module file');
        console.log('  jsenvoy list all --output json');
        break;
        
      case 'help':
        console.log('Show help information');
        console.log();
        console.log(useColor ? chalk.bold('Usage:') : 'Usage:');
        console.log('  jsenvoy help [topic]');
        console.log();
        console.log(useColor ? chalk.bold('Topics:') : 'Topics:');
        console.log('  <module>        Show help for a module');
        console.log('  <module>.<tool> Show help for a specific tool');
        console.log('  list            Show help for list command');
        console.log('  interactive     Show help for interactive mode');
        console.log();
        console.log(useColor ? chalk.bold('Examples:') : 'Examples:');
        console.log('  jsenvoy help');
        console.log('  jsenvoy help calculator');
        console.log('  jsenvoy help file.file_reader');
        break;
        
      case 'interactive':
        console.log('Start interactive mode (REPL)');
        console.log();
        console.log(useColor ? chalk.bold('Usage:') : 'Usage:');
        console.log('  jsenvoy interactive');
        console.log('  jsenvoy -i');
        console.log();
        console.log('Interactive mode provides a REPL interface where you can:');
        console.log('  - Execute tools without typing "jsenvoy" each time');
        console.log('  - Use tab completion for modules and tools');
        console.log('  - Access command history');
        console.log('  - Maintain context between commands');
        console.log();
        console.log('Note: Interactive mode is not yet implemented');
        break;
    }
  }

  async showToolHelp(toolName, tool) {
    const useColor = this.config?.color !== false;
    
    // If tool is not provided, try to get it
    if (!tool) {
      tool = this.getToolByName(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
    }
    
    console.log();
    console.log(useColor ? chalk.bold.cyan(`Tool: ${toolName}`) : `Tool: ${toolName}`);
    console.log();
    console.log(tool.description || 'No description available');
    console.log();
    
    if (tool.parameters && tool.parameters.properties) {
      console.log(useColor ? chalk.bold('Parameters:') : 'Parameters:');
      
      const required = tool.parameters.required || [];
      
      Object.entries(tool.parameters.properties).forEach(([name, schema]) => {
        const isRequired = required.includes(name);
        const requiredText = isRequired ? ' (required)' : ' (optional)';
        
        console.log(`  ${useColor ? chalk.cyan(name) : name}${requiredText}`);
        console.log(`    Type: ${schema.type}`);
        if (schema.description) {
          console.log(`    Description: ${schema.description}`);
        }
        if (schema.enum) {
          console.log(`    Allowed values: ${schema.enum.join(', ')}`);
        }
        if (schema.default !== undefined) {
          console.log(`    Default: ${schema.default}`);
        }
        console.log();
      });
    }
    
    // Generate examples
    const metadata = this.getToolMetadata(toolName);
    if (metadata && metadata.examples) {
      console.log(useColor ? chalk.bold('Examples:') : 'Examples:');
      metadata.examples.forEach(example => {
        console.log(`  ${example}`);
      });
      console.log();
    }
  }

  async showModuleHelp(moduleName, module) {
    const useColor = this.config?.color !== false;
    
    // If module is not provided, try to get it
    if (!module) {
      module = this.modules.get(moduleName);
      if (!module) {
        throw new Error(`Module not found: ${moduleName}`);
      }
    }
    
    console.log();
    console.log(useColor ? chalk.bold.cyan(`Module: ${moduleName}`) : `Module: ${moduleName}`);
    console.log();
    
    // Check if module has a class with dependencies
    const moduleClass = this.moduleClasses.get(moduleName);
    if (moduleClass && moduleClass.dependencies && moduleClass.dependencies.length > 0) {
      console.log(useColor ? chalk.bold('Dependencies:') : 'Dependencies:');
      moduleClass.dependencies.forEach(dep => {
        console.log(`  - ${dep}`);
      });
      console.log();
    }
    
    console.log(useColor ? chalk.bold('Tools:') : 'Tools:');
    
    // Get the actual function names from the tool registry
    const tools = this.discoverTools();
    const moduleTools = [];
    
    for (const [key, tool] of tools) {
      if (tool.module === moduleName) {
        moduleTools.push({
          key: key,
          name: tool.name,
          description: tool.description
        });
      }
    }
    
    if (moduleTools.length > 0) {
      moduleTools.forEach(tool => {
        console.log(`  - ${tool.name}${tool.description ? `: ${tool.description}` : ''}`);
      });
    } else {
      console.log('  No tools available');
    }
    
    console.log();
    console.log('For detailed help on a specific tool, use:');
    console.log(`  jsenvoy help ${moduleName}.<tool_name>`);
  }

  async showUnknownTopicHelp(topic) {
    const useColor = this.config?.color !== false;
    
    console.log();
    console.log(useColor ? chalk.red(`Unknown help topic: ${topic}`) : `Unknown help topic: ${topic}`);
    console.log();
    
    // Try to find similar topics
    const suggestions = this.findSimilarTopics(topic);
    if (suggestions.length > 0) {
      console.log('Did you mean:');
      suggestions.forEach(suggestion => {
        console.log(`  - ${suggestion}`);
      });
      console.log();
    }
    
    console.log('Available topics:');
    console.log('  - Commands: list, help, interactive');
    console.log('  - Modules: ' + Array.from(this.modules.keys()).join(', '));
    console.log('  - Tools: Use "jsenvoy list tools" to see all available tools');
  }

  findSimilarTopics(topic) {
    const allTopics = [
      'list', 'help', 'interactive',
      ...Array.from(this.modules.keys()),
      ...Array.from(this.discoverTools().keys())
    ];
    
    // Simple similarity check - could be improved with Levenshtein distance
    return allTopics.filter(t => {
      return t.toLowerCase().includes(topic.toLowerCase()) ||
             topic.toLowerCase().includes(t.toLowerCase()) ||
             this.calculateSimilarity(t, topic) > 0.6;
    }).slice(0, 3);
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async executeInteractiveCommand() {
    const useColor = this.config?.color !== false;
    
    // Show welcome message
    console.log();
    console.log(useColor ? chalk.bold.cyan('jsEnvoy Interactive Mode') : 'jsEnvoy Interactive Mode');
    console.log('Type "help" for commands, "exit" to quit');
    console.log();
    
    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'jsenvoy> ',
      completer: this.getCompleter()
    });
    
    // Set prompt
    rl.setPrompt('jsenvoy> ');
    rl.prompt();
    
    // Return a promise that resolves when the REPL exits
    return new Promise((resolve) => {
      // Handle line input
      rl.on('line', async (line) => {
        const trimmed = line.trim();
        
        // Handle multi-line mode
        if (this.multiLineMode) {
          // Check for cancel command
          if (trimmed === '.cancel') {
            this.multiLineMode = null;
            this.multiLineBuffer = [];
            console.log('Multi-line input cancelled');
            rl.setPrompt('jsenvoy> ');
            rl.prompt();
            return;
          }
          
          // Check for end of multi-line
          if (this.multiLineMode === 'json') {
            this.multiLineBuffer.push(line); // Keep original line for JSON
            const combined = this.multiLineBuffer.join('\n');
            
            // Simple bracket/brace counting
            const openBraces = (combined.match(/{/g) || []).length;
            const closeBraces = (combined.match(/}/g) || []).length;
            const openBrackets = (combined.match(/\[/g) || []).length;
            const closeBrackets = (combined.match(/\]/g) || []).length;
            
            if (openBraces === closeBraces && openBrackets === closeBrackets && 
                (openBraces > 0 || openBrackets > 0)) {
              // JSON complete, process it
              this.multiLineMode = null;
              
              // Extract the JSON part and merge it back
              const firstLine = this.multiLineBuffer[0];
              const jsonStart = firstLine.indexOf('--json ') + 7;
              const beforeJson = firstLine.substring(0, jsonStart);
              const jsonContent = this.multiLineBuffer.join('\n').substring(jsonStart);
              
              // Create the complete command with properly formatted JSON
              const fullCommand = beforeJson + jsonContent;
              this.multiLineBuffer = [];
              rl.setPrompt('jsenvoy> ');
              
              // Process the complete command
              await this.processInteractiveCommand(fullCommand, rl);
              return;
            }
          } else if (this.multiLineMode === 'string') {
            if (trimmed === '"""') {
              // End of multi-line string
              this.multiLineMode = null;
              const content = this.multiLineBuffer.slice(1).join('\n');
              const fullCommand = this.multiLineBuffer[0].replace('"""', `"${content}"`);
              this.multiLineBuffer = [];
              rl.setPrompt('jsenvoy> ');
              
              // Process the complete command
              await this.processInteractiveCommand(fullCommand, rl);
              return;
            } else {
              this.multiLineBuffer.push(line); // Keep original line with formatting
            }
          }
          
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        
        // Skip empty lines
        if (!trimmed) {
          rl.prompt();
          return;
        }
        
        // Add to history
        this.commandHistory.push(trimmed);
        // Keep only the last 100 commands
        while (this.commandHistory.length > 100) {
          this.commandHistory.shift(); // Remove oldest
        }
        
        // Check for multi-line start
        if (trimmed.includes('--json {') || trimmed.includes('--json [')) {
          this.multiLineMode = 'json';
          this.multiLineBuffer = [trimmed];
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        
        if (trimmed.includes('"""')) {
          this.multiLineMode = 'string';
          this.multiLineBuffer = [trimmed];
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        
        // Handle special commands
        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '.exit') {
          console.log('Goodbye!');
          rl.close();
          return;
        }
        
        if (trimmed === 'clear' || trimmed === 'cls') {
          process.stdout.write('\x1Bc');
          rl.prompt();
          return;
        }
        
        if (trimmed.startsWith('set ')) {
          const parts = trimmed.substring(4).split(' ');
          if (parts.length >= 2) {
            const key = parts[0];
            const value = parts.slice(1).join(' ');
            // Convert string values to appropriate types
            if (value === 'true') {
              this.interactiveContext[key] = true;
            } else if (value === 'false') {
              this.interactiveContext[key] = false;
            } else if (!isNaN(value)) {
              this.interactiveContext[key] = Number(value);
            } else {
              this.interactiveContext[key] = value;
            }
            console.log(`Set ${key} = ${value}`);
          }
          rl.prompt();
          return;
        }
        
        if (trimmed === 'show') {
          console.log('Context:');
          Object.entries(this.interactiveContext).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
          if (Object.keys(this.interactiveContext).length === 0) {
            console.log('  (empty)');
          }
          rl.prompt();
          return;
        }
        
        // Process the command
        await this.processInteractiveCommand(trimmed, rl);
      });
      
      // Handle SIGINT (Ctrl+C)
      rl.on('SIGINT', () => {
        console.log('\nGoodbye!');
        rl.close();
      });
      
      // Handle close event
      rl.on('close', () => {
        resolve();
      });
    });
  }
  
  parseInteractiveLine(line) {
    // Simple argument parsing for interactive mode
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else {
        if (char === '"' || char === "'") {
          inQuotes = true;
          quoteChar = char;
        } else if (char === ' ') {
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
    }
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }

  async processInteractiveCommand(command, rl) {
    try {
      const trimmed = command.trim();
      
      // Expand aliases
      const firstWord = trimmed.split(' ')[0];
      const expanded = this.expandAlias(firstWord);
      let processedCommand = trimmed;
      if (expanded && expanded !== firstWord) {
        processedCommand = trimmed.replace(firstWord, expanded);
      }
      
      // Parse the command line
      const args = this.parseInteractiveLine(processedCommand);
      
      // Execute based on command type
      if (processedCommand === 'help') {
        await this.showGeneralHelp();
      } else if (processedCommand.startsWith('help ')) {
        const topic = processedCommand.substring(5).trim();
        await this.showTopicHelp(topic);
      } else if (processedCommand === 'list' || processedCommand === 'list all') {
        await this.listAll();
      } else if (processedCommand === 'list modules') {
        await this.listModules();
      } else if (processedCommand === 'list tools') {
        await this.listTools();
      } else if (processedCommand === 'list aliases') {
        await this.listAliases();
      } else if (processedCommand === 'list presets') {
        await this.listPresets();
      } else if (processedCommand.includes('.')) {
        // Tool command
        const parts = processedCommand.split(' ');
        const [moduleName, toolName] = parts[0].split('.');
        
        // Parse remaining arguments
        const toolArgs = {};
        const parsedArgs = this.parseInteractiveLine(trimmed);
        let i = 1;
        while (i < parsedArgs.length) {
          if (parsedArgs[i].startsWith('--')) {
            const key = parsedArgs[i].substring(2);
            if (i + 1 < parsedArgs.length && !parsedArgs[i + 1].startsWith('--')) {
              let value = parsedArgs[i + 1];
              
              // Handle JSON arguments
              if (key === 'json' && (value.startsWith('{') || value.startsWith('['))) {
                // Find where JSON starts in the original command
                const jsonIndex = processedCommand.indexOf(value);
                const jsonString = processedCommand.substring(jsonIndex);
                try {
                  const parsed = JSON.parse(jsonString);
                  // Merge parsed JSON into toolArgs
                  Object.assign(toolArgs, parsed);
                  break; // JSON consumes rest of args
                } catch (e) {
                  console.error(`Invalid JSON: ${e.message}`);
                  rl.prompt();
                  return;
                }
              } else {
                toolArgs[key] = value;
              }
              i += 2;
            } else {
              toolArgs[key] = true;
              i++;
            }
          } else {
            i++;
          }
        }
        
        // Execute tool
        const toolFullName = `${moduleName}.${toolName}`;
        const result = await this.executeTool(toolFullName, toolArgs);
        this.formatOutput(result);
      } else {
        console.log(`Unknown command: ${processedCommand}`);
        console.log('Type "help" for available commands');
      }
    } catch (error) {
      this.handleError(error);
    }
    
    // Show prompt again
    rl.prompt();
  }

  getCompleter() {
    return async (line) => {
      const completions = [];
      
      // Check if we're inside quotes
      const quoteCount = (line.match(/"/g) || []).length;
      const singleQuoteCount = (line.match(/'/g) || []).length;
      if (quoteCount % 2 !== 0 || singleQuoteCount % 2 !== 0) {
        // Inside quotes, no completion
        return [[], line];
      }
      
      // Parse with awareness of trailing spaces
      const hasTrailingSpace = line.endsWith(' ');
      const trimmed = line.trim();
      const parts = trimmed.split(' ').filter(p => p !== '');
      
      // Determine what we're completing
      let lastPart = '';
      if (hasTrailingSpace) {
        // Completing a new word
        lastPart = '';
      } else if (parts.length > 0) {
        // Completing the last word
        lastPart = parts[parts.length - 1];
      }
      
      // Special commands
      const specialCommands = ['exit', 'quit', '.exit', 'clear', 'cls', 'help', 'list', 'set', 'show'];
      
      // If no input or first word, complete commands and modules
      if (parts.length === 0 || (parts.length === 1 && !hasTrailingSpace && !lastPart.includes('.'))) {
        // Add special commands
        specialCommands.forEach(cmd => {
          if (cmd.startsWith(lastPart)) {
            completions.push(cmd);
          }
        });
        
        // Add module names
        this.modules.forEach((_, moduleName) => {
          if (moduleName.startsWith(lastPart)) {
            completions.push(moduleName);
          }
        });
        
        // If exact module match, add dot for tool completion
        if (this.modules.has(lastPart)) {
          completions.push(lastPart + '.');
        }
      }
      // Handle list subcommands
      else if (parts[0] === 'list' && (parts.length === 1 && hasTrailingSpace || parts.length === 2)) {
        const listTypes = ['modules', 'tools', 'all'];
        listTypes.forEach(type => {
          if (type.startsWith(lastPart)) {
            completions.push(type);
          }
        });
      }
      // Handle module.tool completion
      else if (lastPart.includes('.') || (parts.length > 0 && parts[parts.length - 1].includes('.'))) {
        const targetPart = lastPart || parts[parts.length - 1];
        const dotIndex = targetPart.indexOf('.');
        const moduleName = targetPart.substring(0, dotIndex);
        const partialTool = targetPart.substring(dotIndex + 1);
        const module = this.modules.get(moduleName);
        
        if (module) {
          module.tools.forEach(tool => {
            const fullToolName = `${moduleName}.${tool.name}`;
            if (tool.name.startsWith(partialTool)) {
              completions.push(fullToolName);
            }
          });
        }
      }
      // Handle parameter completion
      else if (lastPart.startsWith('--')) {
        // Find the tool being used
        const toolPart = parts.find(p => p.includes('.'));
        if (toolPart && toolPart.includes('.')) {
          const tool = this.getToolByName(toolPart);
          if (tool && tool.parameters && tool.parameters.properties) {
            // Get already used parameters
            const usedParams = new Set();
            parts.forEach((part, idx) => {
              if (part.startsWith('--') && idx < parts.length - 1) {
                usedParams.add(part.substring(2));
              }
            });
            
            // Add unused parameters
            Object.keys(tool.parameters.properties).forEach(param => {
              if (!usedParams.has(param)) {
                const fullParam = '--' + param;
                if (fullParam.startsWith(lastPart)) {
                  completions.push(fullParam);
                }
              }
            });
          }
        }
      }
      // Handle help completion
      else if (parts[0] === 'help' && parts.length === 2) {
        // Complete with module names and tool names
        this.modules.forEach((_, moduleName) => {
          if (moduleName.startsWith(lastPart)) {
            completions.push(moduleName);
          }
        });
        
        this.tools.forEach((_, toolName) => {
          if (toolName.startsWith(lastPart)) {
            completions.push(toolName);
          }
        });
      }
      
      return [completions, line];
    };
  }

  formatOutput(result) {
    if (this.options?.output === 'json') {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    
    // Handle different types of output
    if (result === null) {
      console.log('null');
    } else if (result === undefined) {
      console.log('undefined');
    } else if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
      console.log(result.toString());
    } else if (Array.isArray(result)) {
      this.formatArray(result);
    } else if (typeof result === 'object') {
      this.formatObject(result);
    } else {
      console.log(result);
    }
  }

  formatArray(arr) {
    if (arr.length === 0) {
      console.log('[]');
      return;
    }
    
    // Check if it's an array of objects with consistent structure
    if (arr.every(item => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      this.formatTable(arr);
    } else {
      // Simple array - format as a list
      const formatted = arr.map(item => {
        if (typeof item === 'string') return item;
        return JSON.stringify(item);
      }).join('\n');
      console.log(formatted);
    }
  }

  formatObject(obj) {
    const formatted = this.prettyPrint(obj);
    console.log(formatted);
  }

  prettyPrint(obj, indent = 0) {
    const spaces = '  '.repeat(indent);
    const entries = Object.entries(obj);
    
    if (entries.length === 0) {
      return '{}';
    }
    
    let result = '{\n';
    entries.forEach(([key, value], index) => {
      result += `${spaces}  ${key}: `;
      
      if (value === null) {
        result += 'null';
      } else if (value === undefined) {
        result += 'undefined';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        result += this.prettyPrint(value, indent + 1);
      } else if (Array.isArray(value)) {
        result += JSON.stringify(value);
      } else if (typeof value === 'string') {
        result += `"${value}"`;
      } else {
        result += value;
      }
      
      if (index < entries.length - 1) {
        result += ',';
      }
      result += '\n';
    });
    result += spaces + '}';
    
    return result;
  }

  mergeConfigurations(base, override) {
    const merged = { ...base };
    
    // Simple properties
    for (const key of ['verbose', 'output', 'color']) {
      if (override[key] !== undefined) {
        merged[key] = override[key];
      }
    }
    
    // Merge resources
    if (override.resources) {
      merged.resources = { ...base.resources, ...override.resources };
    }
    
    // Merge modules config
    if (override.modules) {
      merged.modules = { ...base.modules };
      for (const [moduleName, moduleConfig] of Object.entries(override.modules)) {
        merged.modules[moduleName] = {
          ...merged.modules[moduleName],
          ...moduleConfig
        };
      }
    }
    
    // Merge other properties
    for (const key of Object.keys(override)) {
      if (!['verbose', 'output', 'color', 'resources', 'modules'].includes(key)) {
        merged[key] = override[key];
      }
    }
    
    return merged;
  }

  async loadConfiguration() {
    // Start with default configuration
    this.config = {
      verbose: false,
      output: 'text',
      color: true,
      modules: {}
    };

    // Load configurations in order of precedence (lowest to highest)
    // 1. Home directory config
    const homeConfigPath = this.getHomeConfigPath();
    if (homeConfigPath) {
      await this.loadConfigFile(homeConfigPath);
    }

    // 2. Project configs (search up from current directory)
    const searchPaths = await this.getConfigSearchPaths();
    for (const searchPath of searchPaths) {
      await this.loadConfigFromDirectory(searchPath);
    }

    // 3. Environment variables
    this.loadEnvironmentConfig();

    // 4. Command line options (highest priority)
    if (this.options) {
      this.config = this.deepMerge(this.config, this.options);
    }
  }

  getHomeConfigPath() {
    // Allow override for testing
    if (this.getHomeConfigPath.override) {
      return this.getHomeConfigPath.override.call(this);
    }
    return path.join(os.homedir(), '.jsenvoyrc');
  }

  async getConfigSearchPaths() {
    const paths = [];
    let currentPath = this.configSearchPath;
    
    // Search up the directory tree
    while (currentPath !== path.dirname(currentPath)) {
      paths.push(currentPath);
      currentPath = path.dirname(currentPath);
    }
    
    return paths;
  }

  async loadConfigFromDirectory(dirPath) {
    // Load all config files in order of preference
    const configFiles = ['.jsenvoyrc', 'jsenvoy.json'];
    let loaded = false;
    
    for (const filename of configFiles) {
      const configPath = path.join(dirPath, filename);
      if (await this.loadConfigFile(configPath)) {
        loaded = true;
      }
    }
    
    return loaded;
  }

  async loadConfigFile(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      this.config = this.deepMerge(this.config, config);
      return true;
    } catch (error) {
      // File doesn't exist or invalid JSON - ignore
      return false;
    }
  }

  loadEnvironmentConfig() {
    const envConfig = {};
    
    // Parse boolean environment variables
    if (process.env.JSENVOY_VERBOSE) {
      envConfig.verbose = process.env.JSENVOY_VERBOSE === 'true';
    }
    
    if (process.env.JSENVOY_COLOR) {
      envConfig.color = process.env.JSENVOY_COLOR === 'true';
    }
    
    // Parse string environment variables
    if (process.env.JSENVOY_OUTPUT) {
      envConfig.output = process.env.JSENVOY_OUTPUT;
    }
    
    // TODO: Add more environment variables as needed
    
    this.config = this.deepMerge(this.config, envConfig);
  }

  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && source[key] !== null) {
          if (!output[key] || typeof output[key] !== 'object' || Array.isArray(output[key])) {
            output[key] = {};
          }
          output[key] = this.deepMerge(output[key], source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }

  getModuleConfig(moduleName) {
    return this.config.modules?.[moduleName] || {};
  }

  async initializeResourceManager() {
    this.resourceManager = new ResourceManager();
    
    // Register resources in order of precedence
    await this.registerDefaultResources();
    await this.registerConfigResources();
    await this.registerModuleResources();
  }

  async registerDefaultResources() {
    // Register common default resources
    this.resourceManager.register('basePath', process.cwd());
    this.resourceManager.register('encoding', 'utf8');
    this.resourceManager.register('createDirectories', true);
    this.resourceManager.register('permissions', 0o755);
  }

  async registerConfigResources() {
    // Register resources from config.resources
    if (this.config.resources) {
      for (const [key, value] of Object.entries(this.config.resources)) {
        if (typeof value === 'object' && value.env) {
          // Handle environment variable resources
          const envValue = process.env[value.env];
          const resourceValue = envValue !== undefined ? envValue : value.default;
          if (resourceValue !== undefined) {
            this.resourceManager.register(key, resourceValue);
          }
        } else {
          // Direct value
          this.resourceManager.register(key, value);
        }
      }
    }
  }

  async registerModuleResources() {
    // Register module-specific resources
    if (this.config.modules) {
      for (const [moduleName, moduleConfig] of Object.entries(this.config.modules)) {
        for (const [key, value] of Object.entries(moduleConfig)) {
          // Register with module prefix
          this.resourceManager.register(`${moduleName}.${key}`, value);
        }
      }
    }
  }

  initializeModuleFactory() {
    if (!this.resourceManager) {
      throw new Error('ResourceManager must be initialized before ModuleFactory');
    }
    
    this.moduleFactory = new ModuleFactory(this.resourceManager);
  }

  createModuleInstance(moduleName) {
    if (!this.moduleFactory) {
      throw new Error('ModuleFactory not initialized');
    }
    
    // Check cache first
    if (this.moduleInstances.has(moduleName)) {
      return this.moduleInstances.get(moduleName);
    }
    
    // Get module class
    const ModuleClass = this.moduleClasses.get(moduleName);
    if (!ModuleClass) {
      throw new Error(`Module '${moduleName}' not found`);
    }
    
    try {
      // Create module instance via factory
      const moduleInstance = this.moduleFactory.createModule(ModuleClass);
      
      // Cache the instance
      this.moduleInstances.set(moduleName, moduleInstance);
      
      return moduleInstance;
    } catch (error) {
      throw new Error(`Failed to create module '${moduleName}': ${error.message}`);
    }
  }

  getOrCreateModuleInstance(moduleName) {
    // Check cache first
    if (this.moduleInstances.has(moduleName)) {
      return this.moduleInstances.get(moduleName);
    }
    
    // Create new instance
    const moduleClass = this.moduleClasses.get(moduleName);
    if (!moduleClass) {
      throw new Error(`Module not found: ${moduleName}`);
    }
    
    const instance = this.moduleFactory.createModule(moduleClass);
    this.moduleInstances.set(moduleName, instance);
    return instance;
  }

  getAllModuleInstances() {
    const instances = [];
    
    for (const [moduleName] of this.moduleClasses) {
      try {
        const instance = this.createModuleInstance(moduleName);
        instances.push(instance);
      } catch (error) {
        // Skip modules that fail to instantiate
        if (this.options?.verbose) {
          console.error(`Failed to create module '${moduleName}':`, error.message);
        }
      }
    }
    
    return instances;
  }

  resolveModuleDependencies(moduleName) {
    const ModuleClass = this.moduleClasses.get(moduleName);
    if (!ModuleClass || !ModuleClass.dependencies) {
      return {};
    }
    
    const dependencies = {};
    
    for (const dep of ModuleClass.dependencies) {
      // First check for module-specific resource
      const moduleSpecificKey = `${moduleName}.${dep}`;
      if (this.resourceManager.has(moduleSpecificKey)) {
        dependencies[dep] = this.resourceManager.get(moduleSpecificKey);
      } else if (this.resourceManager.has(dep)) {
        // Fall back to global resource
        dependencies[dep] = this.resourceManager.get(dep);
      }
    }
    
    return dependencies;
  }

  discoverTools() {
    // Return cached registry if available
    if (this.toolRegistry) {
      return this.toolRegistry;
    }
    
    const registry = new Map();
    
    // Get all module instances
    const moduleInstances = this.getAllModuleInstances();
    
    for (const moduleInstance of moduleInstances) {
      const moduleName = moduleInstance.name;
      const tools = moduleInstance.getTools ? moduleInstance.getTools() : [];
      
      for (const tool of tools) {
        // Check if tool has multiple functions
        if (typeof tool.getAllToolDescriptions === 'function') {
          // Tool has multiple functions, register each one
          const allDescriptions = tool.getAllToolDescriptions();
          for (const desc of allDescriptions) {
            const functionName = desc.function.name;
            const toolKey = `${moduleName}.${functionName}`;
            const toolMetadata = {
              name: functionName,
              module: moduleName,
              description: desc.function.description,
              parameters: desc.function.parameters,
              instance: tool
            };
            registry.set(toolKey, toolMetadata);
          }
        } else {
          // Tool has single function
          const toolDesc = tool.getToolDescription();
          const functionName = toolDesc.function.name;
          const toolKey = `${moduleName}.${functionName}`;
          const toolMetadata = {
            name: functionName,
            module: moduleName,
            description: toolDesc.function.description,
            parameters: toolDesc.function.parameters,
            instance: tool
          };
          registry.set(toolKey, toolMetadata);
        }
      }
    }
    
    // Cache the registry
    this.toolRegistry = registry;
    return registry;
  }

  getToolByName(fullName) {
    const tools = this.discoverTools();
    return tools.get(fullName) || null;
  }

  getToolsByModule(moduleName) {
    const tools = this.discoverTools();
    const moduleTools = [];
    
    for (const [key, tool] of tools) {
      if (tool.module === moduleName) {
        moduleTools.push(tool);
      }
    }
    
    return moduleTools;
  }

  validateToolName(fullName) {
    if (!fullName || typeof fullName !== 'string') {
      return false;
    }
    
    const parts = fullName.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }
    
    const tools = this.discoverTools();
    return tools.has(fullName);
  }

  getToolMetadata(fullName) {
    const tool = this.getToolByName(fullName);
    if (!tool) {
      return null;
    }
    
    // Extract required parameters
    const required = tool.parameters?.required || [];
    
    // Generate examples
    const examples = this.generateToolExamples(fullName, tool);
    
    return {
      name: tool.name,
      module: tool.module,
      description: tool.description,
      parameters: tool.parameters,
      required,
      examples
    };
  }

  generateToolExamples(fullName, tool) {
    const examples = [];
    
    // Basic example with required parameters
    if (tool.parameters?.required?.length > 0) {
      const args = tool.parameters.required.map(param => {
        const propDef = tool.parameters.properties?.[param];
        if (propDef?.type === 'string') {
          return `--${param} "example value"`;
        } else if (propDef?.type === 'number') {
          return `--${param} 42`;
        } else if (propDef?.type === 'boolean') {
          return `--${param}`;
        } else {
          return `--${param} value`;
        }
      }).join(' ');
      
      examples.push(`jsenvoy ${fullName} ${args}`);
    } else {
      // No required parameters
      examples.push(`jsenvoy ${fullName}`);
    }
    
    // Example with JSON input
    if (tool.parameters?.properties) {
      const jsonExample = {};
      for (const [key, prop] of Object.entries(tool.parameters.properties)) {
        if (prop.type === 'string') {
          jsonExample[key] = 'example';
        } else if (prop.type === 'number') {
          jsonExample[key] = 123;
        } else if (prop.type === 'boolean') {
          jsonExample[key] = true;
        }
      }
      examples.push(`jsenvoy ${fullName} --json '${JSON.stringify(jsonExample)}'`);
    }
    
    return examples;
  }

  getAllToolNames() {
    const tools = this.discoverTools();
    return Array.from(tools.keys()).sort();
  }

  invalidateToolCache() {
    this.toolRegistry = null;
  }

  async executeTool(toolName, args) {
    const tool = this.getToolByName(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }
    
    // Pass the function name from the tool metadata
    const functionName = tool.name;
    
    // Handle timeout if configured
    const timeout = this.config.toolTimeout;
    if (timeout && timeout > 0) {
      return await this.executeWithTimeout(tool.instance.execute(args, functionName), timeout);
    }
    
    // Execute without timeout
    return await tool.instance.execute(args, functionName);
  }

  async executeWithTimeout(promise, timeoutMs) {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Tool execution timeout'));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  validateToolArguments(toolName, args) {
    const tool = this.getToolByName(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool not found: ${toolName}`] };
    }
    
    const errors = [];
    const schema = tool.parameters;
    
    if (!schema || schema.type !== 'object') {
      return { valid: true, errors: [] };
    }
    
    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in args)) {
          errors.push(`Missing required parameter: '${required}'`);
        }
      }
    }
    
    // Validate parameter types
    if (schema.properties) {
      for (const [key, value] of Object.entries(args)) {
        const propSchema = schema.properties[key];
        if (!propSchema) continue;
        
        // Check type
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (propSchema.type && actualType !== propSchema.type) {
          errors.push(`Parameter '${key}' must be of type ${propSchema.type}, got ${actualType}`);
        }
        
        // Check enum values
        if (propSchema.enum && !propSchema.enum.includes(value)) {
          errors.push(`Parameter '${key}' must be one of: ${propSchema.enum.join(', ')}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  convertArguments(toolName, args) {
    const tool = this.getToolByName(toolName);
    if (!tool || !tool.parameters?.properties) {
      return args;
    }
    
    const converted = { ...args };
    
    for (const [key, value] of Object.entries(args)) {
      const propSchema = tool.parameters.properties[key];
      if (!propSchema) continue;
      
      // Convert based on expected type
      if (propSchema.type === 'number' && typeof value === 'string') {
        const num = Number(value);
        if (!isNaN(num)) {
          converted[key] = num;
        }
      } else if (propSchema.type === 'boolean' && typeof value === 'string') {
        converted[key] = value === 'true' || value === '1' || value === 'yes';
      } else if (propSchema.type === 'object' && typeof value === 'string') {
        try {
          converted[key] = JSON.parse(value);
        } catch (e) {
          // Keep as string if JSON parse fails
        }
      } else if (propSchema.type === 'array' && typeof value === 'string') {
        try {
          converted[key] = JSON.parse(value);
        } catch (e) {
          // Try comma-separated
          converted[key] = value.split(',').map(v => v.trim());
        }
      }
    }
    
    return converted;
  }

  formatError(error) {
    const useColor = this.config?.color !== false;
    const errorPrefix = useColor ? chalk.red('Error:') : 'Error:';
    
    if (error instanceof Error) {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.message) : error.message);
      
      if (this.options?.verbose && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(errorPrefix);
      console.error(useColor ? chalk.red(error.toString()) : error.toString());
    }
  }

  formatSuccess(message) {
    const useColor = this.config?.color !== false;
    const prefix = useColor ? chalk.green('✓') : '✓';
    console.log(`${prefix} ${message}`);
  }

  formatTable(data) {
    if (!data || data.length === 0) {
      console.log('No data to display');
      return;
    }
    
    // Get all unique keys
    const keys = [...new Set(data.flatMap(item => Object.keys(item)))];
    
    // Calculate column widths
    const widths = {};
    keys.forEach(key => {
      widths[key] = Math.max(
        key.length,
        ...data.map(item => String(item[key] || '').length)
      );
    });
    
    // Print header
    const header = keys.map(key => key.padEnd(widths[key])).join(' | ');
    console.log(header);
    console.log(keys.map(key => '-'.repeat(widths[key])).join('-+-'));
    
    // Print rows
    data.forEach(item => {
      const row = keys.map(key => String(item[key] || '').padEnd(widths[key])).join(' | ');
      console.log(row);
    });
  }

  formatList(items) {
    if (!items || items.length === 0) {
      console.log('  (empty)');
      return;
    }
    
    items.forEach(item => {
      console.log(`  • ${item}`);
    });
  }

  formatToolResult(toolName, result) {
    const useColor = this.config?.color !== false;
    
    console.log(useColor ? chalk.bold(`\nTool: ${toolName}`) : `\nTool: ${toolName}`);
    console.log('-'.repeat(40));
    
    if (result.error) {
      this.formatError(result.error);
      if (result.code) {
        console.log(`Error code: ${result.code}`);
      }
    } else {
      console.log(useColor ? chalk.bold('Result:') : 'Result:');
      this.formatOutput(result);
    }
  }

  showSpinner(message) {
    if (this.options?.output === 'json') {
      // Don't show spinner in JSON mode
      return {
        stop: () => {},
        succeed: () => {},
        fail: () => {}
      };
    }
    
    const spinner = ora({
      text: message,
      color: 'cyan'
    }).start();
    
    return spinner;
  }

  handleError(error) {
    const useColor = this.config?.color !== false;
    
    // Check for specific error types
    if (error.message.includes('Module not found:')) {
      this.handleModuleNotFoundError(error);
    } else if (error.message.includes('Tool not found:')) {
      this.handleToolNotFoundError(error);
    } else if (error.message.includes('Missing required parameter:')) {
      this.handleParameterError(error);
    } else if (error.message.includes('Invalid JSON')) {
      this.handleJSONError(error);
    } else if (error.message.includes('ECONNREFUSED')) {
      this.handleNetworkError(error);
    } else if (error.message.includes('timeout')) {
      this.handleTimeoutError(error);
    } else {
      // Generic error handling
      console.error(useColor ? chalk.red('Error:') : 'Error:', error.message);
      if (this.options?.verbose) {
        console.error(error.stack);
      } else {
        console.log('\nUse --verbose for more details');
      }
    }
  }

  handleModuleNotFoundError(error) {
    const useColor = this.config?.color !== false;
    const moduleName = error.message.match(/Module not found: (\w+)/)?.[1];
    
    console.error(useColor ? chalk.red(error.message) : error.message);
    
    if (moduleName) {
      const suggestion = this.findBestMatch(moduleName, Array.from(this.modules.keys()));
      if (suggestion) {
        console.log(`\nDid you mean: ${useColor ? chalk.green(suggestion) : suggestion}?`);
      } else {
        console.log('\nAvailable modules:');
        this.modules.forEach((_, name) => {
          console.log(`  - ${name}`);
        });
      }
    }
    
    console.log('\nRun `jsenvoy help` for usage information');
  }

  handleToolNotFoundError(error) {
    const useColor = this.config?.color !== false;
    const match = error.message.match(/Tool not found: ([\w-]+)\.([\w-]+)/);
    
    console.error(useColor ? chalk.red(error.message) : error.message);
    
    if (match) {
      const [, moduleName, toolName] = match;
      
      // Get all tools for this module from the registry
      const tools = this.discoverTools();
      const moduleTools = [];
      const toolNames = [];
      
      for (const [key, tool] of tools) {
        if (tool.module === moduleName) {
          moduleTools.push(key);
          toolNames.push(tool.name);
        }
      }
      
      if (moduleTools.length > 0) {
        console.log(`\nAvailable tools in ${moduleName}:`);
        moduleTools.forEach(toolKey => {
          console.log(`  - ${toolKey}`);
        });
        
        // Try to find a close match
        const suggestion = this.findBestMatch(toolName, toolNames);
        if (suggestion) {
          console.log(`\nDid you mean: ${useColor ? chalk.green(`${moduleName}.${suggestion}`) : `${moduleName}.${suggestion}`}?`);
        }
      }
    }
  }

  handleParameterError(error) {
    const useColor = this.config?.color !== false;
    console.error(useColor ? chalk.red(error.message) : error.message);
    
    // Extract tool name from the current command
    if (this.moduleName && this.toolName) {
      const toolName = `${this.moduleName}.${this.toolName}`;
      const tool = this.getToolByName(toolName);
      
      if (tool && tool.parameters && tool.parameters.properties) {
        console.log('\nUsage:');
        console.log(`  jsenvoy ${toolName} [options]`);
        console.log('\nRequired parameters:');
        
        const required = tool.parameters.required || [];
        Object.entries(tool.parameters.properties).forEach(([name, prop]) => {
          const isRequired = required.includes(name);
          const marker = isRequired ? '*' : ' ';
          console.log(`  ${marker} --${name} <${prop.type}> - ${prop.description || 'No description'}`);
        });
        
        console.log('\nExample:');
        console.log(`  jsenvoy ${toolName} --expression "2+2"`);
        console.log(`\nRun \`jsenvoy help ${toolName}\` for more information`);
      }
    }
  }

  handleJSONError(error) {
    const useColor = this.config?.color !== false;
    console.error(useColor ? chalk.red(error.message) : error.message);
    
    console.log('\nExample of valid JSON:');
    console.log('  {"key": "value", "number": 123}');
    console.log('\nFor multi-line JSON in interactive mode, use:');
    console.log('  tool.name --json {');
    console.log('    "key": "value"');
    console.log('  }');
  }

  handleNetworkError(error) {
    const useColor = this.config?.color !== false;
    console.error(useColor ? chalk.red('Network error:') : 'Network error:', error.message);
    console.log('\nCheck your network connection and try again');
  }

  handleTimeoutError(error) {
    const useColor = this.config?.color !== false;
    console.error(useColor ? chalk.red('Operation timed out') : 'Operation timed out');
    console.log('\nThe operation took too long to complete');
    if (this.config.toolTimeout) {
      console.log(`Current timeout: ${this.config.toolTimeout}ms`);
    }
  }

  findBestMatch(input, candidates) {
    if (!input || !candidates || candidates.length === 0) return null;
    
    const lowerInput = input.toLowerCase();
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(lowerInput, candidate.toLowerCase());
      
      // Accept matches with distance <= 3
      if (distance <= 3 && distance < bestDistance) {
        bestDistance = distance;
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  splitCommandLine(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  findCloseMatches(input, candidates) {
    if (!input || !candidates || candidates.length === 0) return [];
    
    const lowerInput = input.toLowerCase();
    const matches = [];
    
    for (const candidate of candidates) {
      const distance = this.levenshteinDistance(lowerInput, candidate.toLowerCase());
      
      // Include if starts with input or has small edit distance
      if (candidate.toLowerCase().startsWith(lowerInput) || distance <= 2) {
        matches.push(candidate);
      }
    }
    
    return matches;
  }

  expandAlias(command) {
    // Prevent infinite recursion
    if (this.aliasExpansionDepth >= this.maxAliasExpansionDepth) {
      throw new Error('Circular alias detected');
    }
    
    // Built-in aliases
    const builtInAliases = {
      'ls': 'list',
      'i': 'interactive'
    };
    
    // Check built-in aliases first
    if (builtInAliases[command]) {
      return builtInAliases[command];
    }
    
    // Check user-defined aliases
    if (this.config?.aliases && this.config.aliases[command]) {
      this.aliasExpansionDepth++;
      try {
        const expanded = this.config.aliases[command];
        // Check if the expansion itself is an alias
        const firstWord = expanded.split(' ')[0];
        const furtherExpanded = this.expandAlias(firstWord);
        if (furtherExpanded && furtherExpanded !== firstWord) {
          return expanded.replace(firstWord, furtherExpanded);
        }
        return expanded;
      } finally {
        this.aliasExpansionDepth--;
      }
    }
    
    return command;
  }

  applyPreset(presetName) {
    if (!this.config?.presets || !this.config.presets[presetName]) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    
    const preset = this.config.presets[presetName];
    
    // Apply preset options (but don't override CLI args)
    if (preset.verbose !== undefined && this.options.verbose === false) {
      this.options.verbose = preset.verbose;
    }
    if (preset.output && !this.options.output) {
      this.options.output = preset.output;
    }
    if (preset.color !== undefined && this.options.color === true) {
      this.options.color = preset.color;
    }
    
    // Apply preset resources
    if (preset.resources) {
      if (!this.config.resources) {
        this.config.resources = {};
      }
      Object.assign(this.config.resources, preset.resources);
    }
  }

  async executeBatchFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Parse and execute each command
        // Use proper command line parsing
        const cmdArgs = this.splitCommandLine(trimmedLine);
        const args = ['node', 'jsenvoy', ...cmdArgs];
        
        try {
          const cli = new CLI();
          await cli.run(args);
        } catch (cmdError) {
          console.error(`Error executing command '${trimmedLine}': ${cmdError.message}`);
          if (this.options?.verbose) {
            console.error(cmdError.stack);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading batch file: ${error.message}`);
      throw error;
    }
  }

  async executeCommandChain(argv) {
    const args = argv.slice(2);
    const commands = [];
    let currentCommand = [];
    
    // Parse commands and operators
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '&&' || args[i] === ';') {
        if (currentCommand.length > 0) {
          commands.push({ args: currentCommand, operator: args[i] });
          currentCommand = [];
        }
      } else {
        currentCommand.push(args[i]);
      }
    }
    
    // Add the last command
    if (currentCommand.length > 0) {
      commands.push({ args: currentCommand, operator: null });
    }
    
    // Execute commands in sequence
    for (let i = 0; i < commands.length; i++) {
      const { args: cmdArgs, operator } = commands[i];
      
      try {
        // Create a new CLI instance for each command
        const cli = new CLI();
        // Copy over necessary properties
        cli.modules = this.modules;
        cli.tools = this.tools;
        cli.moduleClasses = this.moduleClasses;
        cli.resourceManager = this.resourceManager;
        cli.moduleFactory = this.moduleFactory;
        cli.config = this.config;
        
        // Parse and execute the command
        cli.parseArgs(['node', 'jsenvoy', ...cmdArgs]);
        await cli.executeCommand();
      } catch (error) {
        // If this command's operator was && and it failed, stop execution
        if (operator === '&&') {
          throw error;
        }
        // If operator was ; or no operator, continue despite error
        if (this.options?.verbose) {
          console.error('Command failed:', error.message);
        }
      }
    }
  }
}

export default CLI;