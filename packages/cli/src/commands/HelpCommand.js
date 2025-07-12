/**
 * HelpCommand - Handles help display for commands, modules, and tools
 */

import chalk from 'chalk';

export class HelpCommand {
  constructor(moduleLoader, toolRegistry, stringUtils) {
    this.moduleLoader = moduleLoader;
    this.toolRegistry = toolRegistry;
    this.stringUtils = stringUtils;
  }

  /**
   * Execute help command
   * @param {object} parsedArgs - Parsed command arguments
   * @param {object} config - Configuration
   */
  async execute(parsedArgs, config) {
    const { helpTopic } = parsedArgs;
    
    if (helpTopic) {
      await this.showTopicHelp(helpTopic, config);
    } else {
      await this.showGeneralHelp(config);
    }
  }

  /**
   * Show general help
   */
  async showGeneralHelp(config) {
    const useColor = config?.color !== false;
    
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

  /**
   * Show help for a specific topic
   */
  async showTopicHelp(topic, config) {
    // Check if it's a command
    if (['list', 'help', 'interactive'].includes(topic)) {
      await this.showCommandHelp(topic, config);
      return;
    }
    
    // Check if it's a module.tool
    if (topic.includes('.')) {
      const tool = this.toolRegistry.getToolByName(topic);
      if (tool) {
        await this.showToolHelp(topic, tool, config);
        return;
      }
    }
    
    // Check if it's a module name
    const module = this.moduleLoader.getModuleInfo(topic);
    if (module) {
      await this.showModuleHelp(topic, module, config);
      return;
    }
    
    // Unknown topic
    await this.showUnknownTopicHelp(topic, config);
  }

  /**
   * Show help for a command
   */
  async showCommandHelp(command, config) {
    const useColor = config?.color !== false;
    
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
        console.log('  aliases    List all command aliases');
        console.log('  presets    List all configuration presets');
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
        console.log('Commands available in interactive mode:');
        console.log('  exit, quit      Exit interactive mode');
        console.log('  clear, cls      Clear the screen');
        console.log('  help            Show help');
        console.log('  list            List modules/tools');
        console.log('  set <key> <val> Set context variable');
        console.log('  show            Show context variables');
        break;
    }
  }

  /**
   * Show help for a tool
   */
  async showToolHelp(toolName, tool, config) {
    const useColor = config?.color !== false;
    
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
    const metadata = this.toolRegistry.getToolMetadata(toolName);
    if (metadata && metadata.examples) {
      console.log(useColor ? chalk.bold('Examples:') : 'Examples:');
      metadata.examples.forEach(example => {
        console.log(`  ${example}`);
      });
      console.log();
    }
  }

  /**
   * Show help for a module
   */
  async showModuleHelp(moduleName, module, config) {
    const useColor = config?.color !== false;
    
    console.log();
    console.log(useColor ? chalk.bold.cyan(`Module: ${moduleName}`) : `Module: ${moduleName}`);
    console.log();
    
    // Check if module has dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      console.log(useColor ? chalk.bold('Dependencies:') : 'Dependencies:');
      module.dependencies.forEach(dep => {
        console.log(`  - ${dep}`);
      });
      console.log();
    }
    
    console.log(useColor ? chalk.bold('Tools:') : 'Tools:');
    
    // Get the actual function names from the tool registry
    const tools = this.toolRegistry.discoverTools();
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

  /**
   * Show help for unknown topic
   */
  async showUnknownTopicHelp(topic, config) {
    const useColor = config?.color !== false;
    
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
    const modules = this.moduleLoader.getModules();
    if (modules.size > 0) {
      console.log('  - Modules: ' + Array.from(modules.keys()).join(', '));
    }
    console.log('  - Tools: Use "jsenvoy list tools" to see all available tools');
  }

  /**
   * Find similar topics
   */
  findSimilarTopics(topic) {
    const allTopics = [
      'list', 'help', 'interactive',
      ...Array.from(this.moduleLoader.getModules().keys()),
      ...Array.from(this.toolRegistry.discoverTools().keys())
    ];
    
    // Simple similarity check
    return allTopics.filter(t => {
      return t.toLowerCase().includes(topic.toLowerCase()) ||
             topic.toLowerCase().includes(t.toLowerCase()) ||
             this.stringUtils.calculateSimilarity(t, topic) > 0.6;
    }).slice(0, 3);
  }
}

export default HelpCommand;