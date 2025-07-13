/**
 * jsEnvoy CLI - Main entry point (refactored)
 * 
 * This is the modularized version that orchestrates all the extracted components
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import ora from 'ora';

// Core modules
import { ArgumentParser } from './core/ArgumentParser.js';
import { ConfigManager } from './core/ConfigManager.js';
import { ModuleLoader } from './core/ModuleLoader.js';
import { GlobalToolRegistry } from './core/GlobalToolRegistry.js';

// Command modules
import { ExecuteCommand } from './commands/ExecuteCommand.js';
import { ListCommand } from './commands/ListCommand.js';
import { HelpCommand } from './commands/HelpCommand.js';
import { InteractiveCommand } from './commands/InteractiveCommand.js';

// Interactive mode modules
import { InteractiveMode } from './interactive/InteractiveMode.js';
import { TabCompleter } from './interactive/TabCompleter.js';
import { CommandHistory } from './interactive/CommandHistory.js';
import { MultiLineInput } from './interactive/MultiLineInput.js';

// Output modules
import { OutputFormatter } from './output/OutputFormatter.js';
import { TableFormatter } from './output/TableFormatter.js';
import { ErrorFormatter } from './output/ErrorFormatter.js';
import { ColorManager } from './output/ColorManager.js';

// Utility modules
import { StringUtils } from './utils/StringUtils.js';
import { ValidationUtils } from './utils/ValidationUtils.js';
import { FileUtils } from './utils/FileUtils.js';

// Error modules
import { ErrorHandler } from './errors/ErrorHandler.js';

class CLI {
  constructor() {
    // Initialize utilities
    this.stringUtils = new StringUtils();
    this.validationUtils = new ValidationUtils();
    this.fileUtils = new FileUtils();
    
    // Initialize core modules
    this.configManager = new ConfigManager();
    this.argumentParser = null; // Will be initialized after config is loaded
    this.moduleLoader = new ModuleLoader();
    this.toolRegistry = null; // Will be initialized after modules are loaded
    
    // Initialize output modules
    this.colorManager = null; // Will be initialized after config is loaded
    this.tableFormatter = new TableFormatter();
    this.errorFormatter = null; // Will be initialized after color manager
    this.outputFormatter = null; // Will be initialized after all output modules
    
    // Initialize error handler
    this.errorHandler = null; // Will be initialized after all dependencies
    
    // Initialize commands
    this.commands = {}; // Will be initialized after all dependencies
    
    // Initialize interactive mode components
    this.interactiveMode = null; // Will be initialized if needed
    
    // Resource management
    this.resourceManager = null;
    this.moduleFactory = null;
  }

  async run(argv) {
    try {
      // Parse initial arguments to get config options
      const initialParser = new ArgumentParser();
      const initialParsed = initialParser.parse(argv);
      
      // Load configuration
      const config = await this.configManager.load(initialParsed.options);
      
      // Initialize argument parser with config
      this.argumentParser = new ArgumentParser(config);
      
      // Re-parse with full config
      const parsed = this.argumentParser.parse(argv);
      
      // Apply preset if specified
      if (parsed.options?.preset) {
        this.configManager.applyPreset(parsed.options.preset, parsed.options);
      }
      
      // Initialize color manager with config
      this.colorManager = new ColorManager(config);
      this.errorFormatter = new ErrorFormatter(this.colorManager);
      this.outputFormatter = new OutputFormatter(this.tableFormatter, this.colorManager);
      
      // Initialize resource manager
      await this.initializeResourceManager(config);
      
      // Load modules
      await this.moduleLoader.loadModules({ verbose: parsed.options?.verbose });
      this.moduleLoader.setResourceManager(this.resourceManager);
      
      // Initialize tool registry
      this.toolRegistry = new GlobalToolRegistry(this.moduleLoader);
      
      // Initialize error handler
      this.errorHandler = new ErrorHandler(
        this.moduleLoader,
        this.toolRegistry,
        this.errorFormatter,
        this.stringUtils
      );
      
      // Initialize commands
      this.initializeCommands();
      
      // Handle batch file execution
      if (parsed.options?.batch) {
        await this.executeBatchFile(parsed.options.batch, config);
        return 0;
      }
      
      // Handle command chaining
      if (this.argumentParser.hasCommandChain(argv)) {
        await this.executeCommandChain(argv, config);
        return 0;
      }
      
      // Execute command
      await this.executeCommand(parsed, config);
      return 0;
    } catch (error) {
      this.handleError(error);
      process.exit(1);
    }
  }

  initializeCommands() {
    this.commands = {
      execute: new ExecuteCommand(this.toolRegistry, this.outputFormatter),
      list: new ListCommand(
        this.moduleLoader,
        this.toolRegistry,
        this.configManager,
        this.outputFormatter
      ),
      help: new HelpCommand(
        this.moduleLoader,
        this.toolRegistry,
        this.stringUtils
      ),
      interactive: new InteractiveCommand(this.getInteractiveMode())
    };
  }

  getInteractiveMode() {
    if (!this.interactiveMode) {
      const tabCompleter = new TabCompleter(this.moduleLoader, this.toolRegistry);
      const commandHistory = new CommandHistory();
      const multiLineInput = new MultiLineInput();
      
      this.interactiveMode = new InteractiveMode(
        this,
        tabCompleter,
        commandHistory,
        multiLineInput
      );
    }
    return this.interactiveMode;
  }

  async executeCommand(parsed, config) {
    const { command } = parsed;
    
    if (this.commands[command]) {
      await this.commands[command].execute(parsed, config);
    } else if (command === 'help' && !parsed.helpTopic) {
      await this.commands.help.execute(parsed, config);
    } else {
      console.error(`Unknown command: ${command}`);
      process.exit(1);
    }
  }

  async initializeResourceManager(config) {
    this.resourceManager = new ResourceManager();
    
    // Initialize ResourceManager (loads .env if needed)
    await this.resourceManager.initialize();
    
    // Register resources in order of precedence
    await this.registerDefaultResources();
    await this.registerConfigResources(config);
    await this.registerModuleResources(config);
    
    // Initialize module factory
    this.moduleFactory = new ModuleFactory(this.resourceManager);
  }

  async registerDefaultResources() {
    // Register common default resources
    this.resourceManager.register('basePath', process.cwd());
    this.resourceManager.register('encoding', 'utf8');
    this.resourceManager.register('createDirectories', true);
    this.resourceManager.register('permissions', 0o755);
  }

  async registerConfigResources(config) {
    // Register resources from config.resources
    if (config.resources) {
      for (const [key, value] of Object.entries(config.resources)) {
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

  async registerModuleResources(config) {
    // Register module-specific resources
    if (config.modules) {
      for (const [moduleName, moduleConfig] of Object.entries(config.modules)) {
        for (const [key, value] of Object.entries(moduleConfig)) {
          // Register with module prefix
          this.resourceManager.register(`${moduleName}.${key}`, value);
        }
      }
    }
  }

  async executeBatchFile(filePath, config) {
    try {
      const content = await this.fileUtils.readFile(filePath);
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Parse and execute each command
        const cmdArgs = this.stringUtils.splitCommandLine(trimmedLine);
        const args = ['node', 'jsenvoy', ...cmdArgs];
        
        try {
          const cli = new CLI();
          await cli.run(args);
        } catch (cmdError) {
          console.error(`Error executing command '${trimmedLine}': ${cmdError.message}`);
          if (config.verbose) {
            console.error(cmdError.stack);
          }
        }
      }
    } catch (error) {
      console.error(`Error reading batch file: ${error.message}`);
      throw error;
    }
  }

  async executeCommandChain(argv, config) {
    const commands = this.argumentParser.parseCommandChain(argv);
    
    // Execute commands in sequence
    for (let i = 0; i < commands.length; i++) {
      const { args: cmdArgs, operator } = commands[i];
      
      try {
        // Create a new CLI instance for each command
        const cli = new CLI();
        await cli.run(['node', 'jsenvoy', ...cmdArgs]);
      } catch (error) {
        // If this command's operator was && and it failed, stop execution
        if (operator === '&&') {
          throw error;
        }
        // If operator was ; or no operator, continue despite error
        if (config.verbose) {
          console.error('Command failed:', error.message);
        }
      }
    }
  }

  handleError(error) {
    if (this.errorHandler) {
      this.errorHandler.handle(error, this.configManager.getConfig());
    } else {
      // Fallback error handling
      console.error('Error:', error.message);
      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
      }
    }
  }

  showSpinner(message) {
    const config = this.configManager.getConfig();
    if (config.output === 'json') {
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
}

// Auto-run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new CLI();
  cli.run(process.argv).catch(error => {
    console.error('CLI Error:', error.message);
    process.exit(1);
  });
}

export default CLI;