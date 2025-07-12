/**
 * ListCommand - Handles listing modules, tools, aliases, and presets
 */

import chalk from 'chalk';

export class ListCommand {
  constructor(moduleLoader, toolRegistry, configManager, outputFormatter) {
    this.moduleLoader = moduleLoader;
    this.toolRegistry = toolRegistry;
    this.configManager = configManager;
    this.outputFormatter = outputFormatter;
  }

  /**
   * Execute list command
   * @param {object} parsedArgs - Parsed command arguments
   * @param {object} config - Configuration
   */
  async execute(parsedArgs, config) {
    const { listType, options } = parsedArgs;
    
    switch (listType) {
      case 'modules':
        await this.listModules(options, config);
        break;
      case 'tools':
        await this.listTools(parsedArgs.args, options, config);
        break;
      case 'aliases':
        await this.listAliases(options, config);
        break;
      case 'presets':
        await this.listPresets(options, config);
        break;
      case 'all':
      default:
        await this.listAll(options, config);
        break;
    }
  }

  /**
   * List all available modules
   */
  async listModules(options, config) {
    const modules = Array.from(this.moduleLoader.getModules().values());
    
    if (options?.output === 'json') {
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
    
    this.outputFormatter.formatTable(tableData);
    
    // Show detailed dependencies in verbose mode
    if (options?.verbose) {
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

  /**
   * List all available tools
   */
  async listTools(args, options, config) {
    const moduleFilter = args?.module;
    const tools = this.toolRegistry.discoverTools();
    
    let toolList = Array.from(tools.entries());
    
    // Apply module filter if provided
    if (moduleFilter) {
      toolList = toolList.filter(([key, tool]) => tool.module === moduleFilter);
    }
    
    if (options?.output === 'json') {
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

  /**
   * List all aliases
   */
  async listAliases(options, config) {
    const builtInAliases = {
      'ls': 'list',
      'i': 'interactive'
    };
    
    const customAliases = config?.aliases || {};
    const allAliases = { ...builtInAliases, ...customAliases };
    
    if (options?.output === 'json') {
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
    
    this.outputFormatter.formatTable(tableData);
  }

  /**
   * List all presets
   */
  async listPresets(options, config) {
    const presets = config?.presets || {};
    
    if (options?.output === 'json') {
      console.log(JSON.stringify(presets, null, 2));
      return;
    }
    
    console.log(chalk.bold('\nAvailable Presets\n'));
    
    if (Object.keys(presets).length === 0) {
      console.log('No presets defined');
      return;
    }
    
    // Show preset names and their configurations
    Object.entries(presets).forEach(([name, presetConfig]) => {
      console.log(chalk.green(name) + ':');
      Object.entries(presetConfig).forEach(([key, value]) => {
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

  /**
   * List all modules and tools
   */
  async listAll(options, config) {
    if (options?.output === 'json') {
      const modules = Array.from(this.moduleLoader.getModules().values());
      const tools = Array.from(this.toolRegistry.discoverTools().entries()).map(([key, tool]) => ({
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
    const modules = Array.from(this.moduleLoader.getModules().values());
    
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
    const tools = this.toolRegistry.discoverTools();
    
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
}

export default ListCommand;