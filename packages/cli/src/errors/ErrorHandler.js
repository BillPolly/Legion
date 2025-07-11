/**
 * ErrorHandler - Main error handling and routing
 */

import { ModuleNotFoundError } from './ModuleNotFoundError.js';
import { ToolNotFoundError } from './ToolNotFoundError.js';
import { ParameterError } from './ParameterError.js';

export class ErrorHandler {
  constructor(moduleLoader, toolRegistry, errorFormatter, stringUtils) {
    this.moduleLoader = moduleLoader;
    this.toolRegistry = toolRegistry;
    this.errorFormatter = errorFormatter;
    this.stringUtils = stringUtils;
  }

  /**
   * Handle an error
   * @param {Error} error - Error to handle
   * @param {object} config - Configuration
   */
  handle(error, config) {
    // Check for specific error types
    if (error.message.includes('Module not found:')) {
      this.handleModuleNotFoundError(error, config);
    } else if (error.message.includes('Tool not found:')) {
      this.handleToolNotFoundError(error, config);
    } else if (error.message.includes('Missing required parameter:')) {
      this.handleParameterError(error, config);
    } else if (error.message.includes('Invalid JSON')) {
      this.handleJSONError(error, config);
    } else if (error.message.includes('ECONNREFUSED')) {
      this.handleNetworkError(error, config);
    } else if (error.message.includes('timeout')) {
      this.handleTimeoutError(error, config);
    } else {
      // Generic error handling
      this.errorFormatter.format(error, config);
      if (!config?.verbose) {
        console.log('\nUse --verbose for more details');
      }
    }
  }

  /**
   * Handle module not found error
   */
  handleModuleNotFoundError(error, config) {
    const moduleName = error.message.match(/Module not found: (\w+)/)?.[1];
    
    this.errorFormatter.format(error, config);
    
    if (moduleName) {
      const modules = Array.from(this.moduleLoader.getModules().keys());
      const suggestion = this.stringUtils.findBestMatch(moduleName, modules);
      
      if (suggestion) {
        const chalk = this.errorFormatter.colorManager.getChalk();
        const useColor = config?.color !== false;
        console.log(`\nDid you mean: ${useColor ? chalk.green(suggestion) : suggestion}?`);
      } else {
        console.log('\nAvailable modules:');
        modules.forEach(name => {
          console.log(`  - ${name}`);
        });
      }
    }
    
    console.log('\nRun `jsenvoy help` for usage information');
  }

  /**
   * Handle tool not found error
   */
  handleToolNotFoundError(error, config) {
    const match = error.message.match(/Tool not found: ([\w-]+)\.([\w-]+)/);
    
    this.errorFormatter.format(error, config);
    
    if (match) {
      const [, moduleName, toolName] = match;
      
      // Get all tools for this module from the registry
      const tools = this.toolRegistry.discoverTools();
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
        const suggestion = this.stringUtils.findBestMatch(toolName, toolNames);
        if (suggestion) {
          const chalk = this.errorFormatter.colorManager.getChalk();
          const useColor = config?.color !== false;
          console.log(`\nDid you mean: ${useColor ? chalk.green(`${moduleName}.${suggestion}`) : `${moduleName}.${suggestion}`}?`);
        }
      }
    }
  }

  /**
   * Handle parameter error
   */
  handleParameterError(error, config) {
    this.errorFormatter.format(error, config);
    
    // Try to provide helpful usage information
    if (error instanceof ParameterError && error.toolName) {
      const tool = this.toolRegistry.getToolByName(error.toolName);
      
      if (tool && tool.parameters && tool.parameters.properties) {
        console.log('\nUsage:');
        console.log(`  jsenvoy ${error.toolName} [options]`);
        console.log('\nRequired parameters:');
        
        const required = tool.parameters.required || [];
        Object.entries(tool.parameters.properties).forEach(([name, prop]) => {
          const isRequired = required.includes(name);
          const marker = isRequired ? '*' : ' ';
          console.log(`  ${marker} --${name} <${prop.type}> - ${prop.description || 'No description'}`);
        });
        
        console.log('\nExample:');
        console.log(`  jsenvoy ${error.toolName} --expression "2+2"`);
        console.log(`\nRun \`jsenvoy help ${error.toolName}\` for more information`);
      }
    }
  }

  /**
   * Handle JSON error
   */
  handleJSONError(error, config) {
    this.errorFormatter.format(error, config);
    
    console.log('\nExample of valid JSON:');
    console.log('  {"key": "value", "number": 123}');
    console.log('\nFor multi-line JSON in interactive mode, use:');
    console.log('  tool.name --json {');
    console.log('    "key": "value"');
    console.log('  }');
  }

  /**
   * Handle network error
   */
  handleNetworkError(error, config) {
    this.errorFormatter.format(new Error('Network error: ' + error.message), config);
    console.log('\nCheck your network connection and try again');
  }

  /**
   * Handle timeout error
   */
  handleTimeoutError(error, config) {
    this.errorFormatter.format(new Error('Operation timed out'), config);
    console.log('\nThe operation took too long to complete');
    if (config.toolTimeout) {
      console.log(`Current timeout: ${config.toolTimeout}ms`);
    }
  }
}

export default ErrorHandler;