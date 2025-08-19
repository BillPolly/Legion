#!/usr/bin/env node

/**
 * Tool Registry Tools Script
 * 
 * Tool operations and execution script for the tool registry system.
 * Replaces multiple tool execution test scripts with a single, capable interface.
 * 
 * ARCHITECTURE: Only uses ToolRegistry - NO direct database operations
 * 
 * Usage:
 *   node tools.js execute <tool> [--args <json>] [--verbose]    # Execute a specific tool
 *   node tools.js validate [--module <name>] [--verbose]       # Validate tool definitions
 *   node tools.js list [--module <name>] [--category <cat>]    # List available tools
 *   node tools.js info <tool> [--verbose]                      # Get tool information
 */

import { ToolRegistry } from '../src/integration/ToolRegistry.js';
import chalk from 'chalk';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const target = args[1] || null; // tool name for execute/info commands
  
  const options = {
    command,
    target,
    verbose: args.includes('--verbose') || args.includes('-v'),
    module: null,
    category: null,
    args: null,
    format: 'table', // table, json, detail
    limit: 50
  };
  
  // Extract module name
  const moduleIndex = args.indexOf('--module');
  if (moduleIndex !== -1 && args[moduleIndex + 1]) {
    options.module = args[moduleIndex + 1];
  }
  
  // Extract category
  const categoryIndex = args.indexOf('--category');
  if (categoryIndex !== -1 && args[categoryIndex + 1]) {
    options.category = args[categoryIndex + 1];
  }
  
  // Extract args (JSON string)
  const argsIndex = args.indexOf('--args');
  if (argsIndex !== -1 && args[argsIndex + 1]) {
    try {
      options.args = JSON.parse(args[argsIndex + 1]);
    } catch (error) {
      console.error(chalk.red('❌ Invalid JSON in --args parameter:'), error.message);
      process.exit(1);
    }
  }
  
  // Extract format
  const formatIndex = args.indexOf('--format');
  if (formatIndex !== -1 && args[formatIndex + 1]) {
    const format = args[formatIndex + 1].toLowerCase();
    if (['table', 'json', 'detail'].includes(format)) {
      options.format = format;
    }
  }
  
  // Extract limit
  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    options.limit = parseInt(args[limitIndex + 1], 10) || 50;
  }
  
  return options;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(chalk.blue.bold('\nTool Registry Tools\n'));
  console.log(chalk.gray('Tool operations and execution script for the tool registry.'));
  console.log(chalk.gray('Only uses ToolRegistry - enforces proper architecture.\n'));
  
  console.log(chalk.cyan('Commands:'));
  console.log(chalk.white('  execute <tool>               Execute a specific tool'));
  console.log(chalk.white('  validate                     Validate tool definitions'));
  console.log(chalk.white('  list                         List available tools'));
  console.log(chalk.white('  info <tool>                  Get detailed tool information'));
  console.log(chalk.white('  help                         Show this help message\n'));
  
  console.log(chalk.cyan('Options:'));
  console.log(chalk.white('  --args <json>                JSON arguments for tool execution'));
  console.log(chalk.white('  --module <name>              Filter by module name'));
  console.log(chalk.white('  --category <name>            Filter by category'));
  console.log(chalk.white('  --format <type>              Output format: table, json, detail'));
  console.log(chalk.white('  --limit <num>                Maximum results (default: 50)'));
  console.log(chalk.white('  --verbose, -v                Show detailed output\n'));
  
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  node tools.js list --module file'));
  console.log(chalk.gray('  node tools.js execute calculator --args \'{"expression": "10 + 5"}\''));
  console.log(chalk.gray('  node tools.js validate --verbose'));
  console.log(chalk.gray('  node tools.js info file_read --verbose'));
  console.log(chalk.gray('  node tools.js list --format json --limit 10\n'));
}

/**
 * Initialize ToolRegistry
 */
async function createToolRegistry(options) {
  const registry = ToolRegistry.getInstance();
  
  if (!registry.initialized) {
    await registry.initialize();
  }
  
  return registry;
}

/**
 * Execute command - Execute a specific tool
 */
async function executeCommand(options) {
  if (!options.target) {
    console.log(chalk.red('❌ Tool name required for execute command'));
    console.log(chalk.gray('Usage: node tools.js execute <tool> [--args <json>]'));
    return;
  }
  
  console.log(chalk.blue.bold(`\n⚡ Executing Tool: ${options.target}\n`));
  
  const registry = await createToolRegistry(options);
  
  try {
    // Get the tool
    console.log(chalk.cyan('📦 Retrieving tool...'));
    const tool = await registry.getTool(options.target);
    
    if (!tool) {
      console.log(chalk.red(`❌ Tool '${options.target}' not found`));
      console.log(chalk.gray('Use "node tools.js list" to see available tools'));
      return;
    }
    
    console.log(chalk.green(`✅ Found tool: ${options.target}`));
    
    // Check if tool is executable
    if (typeof tool.execute !== 'function') {
      console.log(chalk.red('❌ Tool is not executable (no execute method)'));
      return;
    }
    
    // Show tool info
    if (options.verbose) {
      console.log(chalk.gray(`   Description: ${tool.description || 'No description'}`));
      console.log(chalk.gray(`   Type: ${typeof tool}`));
      
      if (tool.parameters) {
        console.log(chalk.gray('   Parameters:'));
        for (const [name, param] of Object.entries(tool.parameters)) {
          console.log(chalk.gray(`      ${name}: ${param.type || 'any'} ${param.required ? '(required)' : '(optional)'}`));
        }
      }
    }
    
    // Prepare arguments
    const args = options.args || {};
    console.log(chalk.cyan(`\n🚀 Executing with arguments:`));
    console.log(chalk.white(JSON.stringify(args, null, 2)));
    
    // Execute the tool
    const startTime = Date.now();
    
    try {
      const result = await tool.execute(args);
      const executionTime = Date.now() - startTime;
      
      console.log(chalk.green(`\n✅ Execution completed (${executionTime}ms)`));
      console.log(chalk.blue.bold('\n📋 Result:'));
      
      // Format result output
      if (typeof result === 'object') {
        console.log(chalk.white(JSON.stringify(result, null, 2)));
      } else {
        console.log(chalk.white(result));
      }
      
      // Show execution stats
      if (options.verbose) {
        console.log(chalk.blue.bold('\n📊 Execution Stats:'));
        console.log(chalk.gray(`   Execution time: ${executionTime}ms`));
        console.log(chalk.gray(`   Result type: ${typeof result}`));
        console.log(chalk.gray(`   Result size: ${JSON.stringify(result).length} characters`));
      }
      
    } catch (executionError) {
      const executionTime = Date.now() - startTime;
      console.log(chalk.red(`\n❌ Execution failed (${executionTime}ms)`));
      console.log(chalk.red(`Error: ${executionError.message}`));
      
      if (options.verbose) {
        console.log(chalk.gray('\nStack trace:'));
        console.log(chalk.gray(executionError.stack));
      }
      
      // Show error analysis
      console.log(chalk.blue.bold('\n🔍 Error Analysis:'));
      if (executionError.message.includes('required') && executionError.message.includes('missing')) {
        console.log(chalk.yellow('   Likely cause: Missing required parameters'));
        console.log(chalk.gray('   Try adding the required parameters with --args'));
      } else if (executionError.message.includes('invalid') || executionError.message.includes('type')) {
        console.log(chalk.yellow('   Likely cause: Invalid parameter types or values'));
        console.log(chalk.gray('   Check parameter types and formats'));
      } else {
        console.log(chalk.yellow('   This appears to be a tool-specific error'));
        console.log(chalk.gray('   Check tool documentation for valid inputs'));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Tool execution setup failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Validate command - Validate tool definitions
 */
async function validateCommand(options) {
  console.log(chalk.blue.bold('\n🔍 Tool Validation\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    // Get tools to validate
    const listOptions = {};
    if (options.module) {
      listOptions.module = options.module;
      console.log(chalk.cyan(`Validating tools in module: ${options.module}`));
    } else {
      console.log(chalk.cyan('Validating all tools'));
    }
    
    const tools = await registry.listTools(listOptions);
    console.log(chalk.green(`Found ${tools.length} tools to validate\n`));
    
    let validTools = 0;
    let invalidTools = 0;
    let executableTools = 0;
    const issues = [];
    
    // Validate each tool
    for (const toolMeta of tools) {
      const toolName = toolMeta.name;
      
      try {
        // Try to get the executable tool
        const tool = await registry.getTool(toolName);
        
        if (!tool) {
          issues.push({
            tool: toolName,
            type: 'not_loadable',
            message: 'Tool metadata exists but tool cannot be loaded'
          });
          invalidTools++;
          continue;
        }
        
        // Check if tool is executable
        const isExecutable = typeof tool.execute === 'function';
        if (isExecutable) {
          executableTools++;
        }
        
        // Validate tool structure
        const validationIssues = validateToolStructure(tool, toolMeta);
        
        if (validationIssues.length === 0) {
          validTools++;
          if (options.verbose) {
            console.log(chalk.green(`   ✅ ${toolName} ${isExecutable ? '(executable)' : '(metadata only)'}`));
          }
        } else {
          invalidTools++;
          issues.push({
            tool: toolName,
            type: 'validation_failed',
            issues: validationIssues
          });
          
          if (options.verbose) {
            console.log(chalk.red(`   ❌ ${toolName}`));
            for (const issue of validationIssues) {
              console.log(chalk.gray(`      - ${issue}`));
            }
          }
        }
        
      } catch (error) {
        invalidTools++;
        issues.push({
          tool: toolName,
          type: 'load_error',
          message: error.message
        });
        
        if (options.verbose) {
          console.log(chalk.red(`   ❌ ${toolName}: ${error.message}`));
        }
      }
    }
    
    // Show summary
    console.log(chalk.blue.bold('\n📊 Validation Summary'));
    console.log('═'.repeat(60));
    console.log(chalk.green(`✅ Valid tools: ${validTools}`));
    console.log(chalk.red(`❌ Invalid tools: ${invalidTools}`));
    console.log(chalk.white(`⚡ Executable tools: ${executableTools}`));
    console.log(chalk.white(`📋 Metadata-only tools: ${validTools - executableTools}`));
    
    const successRate = tools.length > 0 ? ((validTools / tools.length) * 100).toFixed(1) : 0;
    console.log(chalk.white(`📈 Success rate: ${successRate}%`));
    
    // Show issues if any
    if (issues.length > 0 && !options.verbose) {
      console.log(chalk.yellow('\n⚠️ Issues found (use --verbose for details):'));
      
      const issueTypes = {};
      for (const issue of issues) {
        issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
      }
      
      for (const [type, count] of Object.entries(issueTypes)) {
        console.log(chalk.gray(`   ${type.replace('_', ' ')}: ${count} tools`));
      }
    }
    
    // Overall assessment
    if (invalidTools === 0) {
      console.log(chalk.green.bold('\n✅ All tools passed validation!'));
    } else {
      console.log(chalk.yellow.bold(`\n⚠️ ${invalidTools} tools have validation issues`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Validation failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Validate tool structure
 */
function validateToolStructure(tool, toolMeta) {
  const issues = [];
  
  // Check basic properties
  if (!tool.name) {
    issues.push('Missing name property');
  } else if (tool.name !== toolMeta.name) {
    issues.push(`Name mismatch: tool.name='${tool.name}' vs metadata.name='${toolMeta.name}'`);
  }
  
  if (!tool.description) {
    issues.push('Missing description property');
  }
  
  // Check execute method if present
  if (tool.execute) {
    if (typeof tool.execute !== 'function') {
      issues.push('execute property exists but is not a function');
    }
  }
  
  // Check parameters if present
  if (tool.parameters) {
    if (typeof tool.parameters !== 'object') {
      issues.push('parameters property is not an object');
    } else {
      for (const [paramName, param] of Object.entries(tool.parameters)) {
        if (!param.type) {
          issues.push(`Parameter '${paramName}' missing type`);
        }
        if (param.required !== undefined && typeof param.required !== 'boolean') {
          issues.push(`Parameter '${paramName}' required field must be boolean`);
        }
      }
    }
  }
  
  return issues;
}

/**
 * List command - List available tools
 */
async function listCommand(options) {
  console.log(chalk.blue.bold('\n📋 Available Tools\n'));
  
  const registry = await createToolRegistry(options);
  
  try {
    // Build filter options
    const listOptions = {};
    if (options.module) {
      listOptions.module = options.module;
    }
    if (options.category) {
      listOptions.category = options.category;
    }
    
    // Show what we're filtering by
    const filters = [];
    if (options.module) filters.push(`module: ${options.module}`);
    if (options.category) filters.push(`category: ${options.category}`);
    
    if (filters.length > 0) {
      console.log(chalk.cyan(`Filters: ${filters.join(', ')}`));
    } else {
      console.log(chalk.cyan('Showing all available tools'));
    }
    
    const tools = await registry.listTools(listOptions);
    
    if (tools.length === 0) {
      console.log(chalk.yellow('No tools found matching criteria'));
      return;
    }
    
    // Apply limit
    const displayTools = tools.slice(0, options.limit);
    if (displayTools.length < tools.length) {
      console.log(chalk.gray(`Showing first ${displayTools.length} of ${tools.length} tools (use --limit to adjust)\n`));
    } else {
      console.log(chalk.green(`Found ${tools.length} tools\n`));
    }
    
    // Format output
    if (options.format === 'json') {
      console.log(JSON.stringify(displayTools, null, 2));
    } else if (options.format === 'detail') {
      await showDetailedToolList(registry, displayTools, options);
    } else {
      await showTableToolList(registry, displayTools, options);
    }
    
    // Show summary
    if (options.format !== 'json') {
      console.log(chalk.blue.bold('\n📊 Summary'));
      console.log('═'.repeat(60));
      
      // Group by module
      const moduleGroups = {};
      for (const tool of tools) {
        const moduleName = tool.moduleName || tool.module || 'unknown';
        moduleGroups[moduleName] = (moduleGroups[moduleName] || 0) + 1;
      }
      
      console.log(chalk.white(`Total tools: ${tools.length}`));
      console.log(chalk.white(`Modules represented: ${Object.keys(moduleGroups).length}`));
      
      if (options.verbose) {
        console.log(chalk.gray('\nTools per module:'));
        const sortedModules = Object.entries(moduleGroups)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        
        for (const [module, count] of sortedModules) {
          console.log(chalk.gray(`   ${module}: ${count}`));
        }
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ List failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Show tools in table format
 */
async function showTableToolList(registry, tools, options) {
  console.log(chalk.cyan('Name'.padEnd(25) + 'Module'.padEnd(20) + 'Category'.padEnd(15) + 'Description'));
  console.log('─'.repeat(80));
  
  for (const tool of tools) {
    const name = (tool.name || '').substring(0, 24);
    const module = (tool.moduleName || tool.module || '').substring(0, 19);
    const category = (tool.category || '').substring(0, 14);
    const description = (tool.description || '').substring(0, 40);
    
    console.log(chalk.white(
      name.padEnd(25) + 
      module.padEnd(20) + 
      category.padEnd(15) + 
      description + (description.length === 40 ? '...' : '')
    ));
  }
}

/**
 * Show tools in detailed format
 */
async function showDetailedToolList(registry, tools, options) {
  for (const [index, tool] of tools.entries()) {
    console.log(chalk.cyan(`${index + 1}. ${tool.name}`));
    console.log(chalk.gray(`   Module: ${tool.moduleName || tool.module || 'unknown'}`));
    
    if (tool.category) {
      console.log(chalk.gray(`   Category: ${tool.category}`));
    }
    
    if (tool.description) {
      console.log(chalk.gray(`   Description: ${tool.description}`));
    }
    
    // Try to get executable info
    if (options.verbose) {
      try {
        const executableTool = await registry.getTool(tool.name);
        if (executableTool) {
          const isExecutable = typeof executableTool.execute === 'function';
          console.log(chalk.gray(`   Executable: ${isExecutable ? '✅' : '❌'}`));
          
          if (executableTool.parameters) {
            const paramCount = Object.keys(executableTool.parameters).length;
            console.log(chalk.gray(`   Parameters: ${paramCount}`));
          }
        }
      } catch (error) {
        console.log(chalk.gray(`   Status: ❌ (${error.message})`));
      }
    }
    
    console.log('');
  }
}

/**
 * Info command - Get detailed tool information
 */
async function infoCommand(options) {
  if (!options.target) {
    console.log(chalk.red('❌ Tool name required for info command'));
    console.log(chalk.gray('Usage: node tools.js info <tool>'));
    return;
  }
  
  console.log(chalk.blue.bold(`\n📖 Tool Information: ${options.target}\n`));
  
  const registry = await createToolRegistry(options);
  
  try {
    // Get tool metadata
    const tools = await registry.listTools();
    const toolMeta = tools.find(t => t.name === options.target);
    
    if (!toolMeta) {
      console.log(chalk.red(`❌ Tool '${options.target}' not found in registry`));
      return;
    }
    
    console.log(chalk.cyan('📋 Metadata:'));
    console.log(chalk.white(`   Name: ${toolMeta.name}`));
    console.log(chalk.white(`   Module: ${toolMeta.moduleName || toolMeta.module}`));
    console.log(chalk.white(`   Category: ${toolMeta.category || 'uncategorized'}`));
    console.log(chalk.white(`   Description: ${toolMeta.description || 'No description'}`));
    
    if (toolMeta.tags && toolMeta.tags.length > 0) {
      console.log(chalk.white(`   Tags: ${toolMeta.tags.join(', ')}`));
    }
    
    console.log('');
    
    // Try to get executable tool
    console.log(chalk.cyan('⚡ Executable Information:'));
    
    try {
      const tool = await registry.getTool(options.target);
      
      if (!tool) {
        console.log(chalk.red('   ❌ Tool cannot be loaded as executable'));
        return;
      }
      
      console.log(chalk.green('   ✅ Tool is loadable'));
      
      const isExecutable = typeof tool.execute === 'function';
      console.log(chalk.white(`   Executable: ${isExecutable ? '✅ Yes' : '❌ No'}`));
      console.log(chalk.white(`   Type: ${typeof tool}`));
      console.log(chalk.white(`   Constructor: ${tool.constructor?.name || 'unknown'}`));
      
      // Show parameters from new descriptive schema format
      if (tool.schema?.input?.properties) {
        console.log(chalk.cyan('\n📝 Input Parameters:'));
        
        const required = tool.schema.input.required || [];
        for (const [paramName, param] of Object.entries(tool.schema.input.properties)) {
          const isRequired = required.includes(paramName) ? 'required' : 'optional';
          const type = param.type || 'any';
          
          console.log(chalk.white(`   ${paramName}:`));
          console.log(chalk.gray(`      Type: ${type}`));
          console.log(chalk.gray(`      Required: ${isRequired}`));
          
          if (param.description) {
            console.log(chalk.gray(`      Description: ${param.description}`));
          }
          
          if (param.minLength !== undefined) {
            console.log(chalk.gray(`      Min Length: ${param.minLength}`));
          }
          if (param.minimum !== undefined) {
            console.log(chalk.gray(`      Minimum: ${param.minimum}`));
          }
          if (param.enum) {
            console.log(chalk.gray(`      Valid Values: ${param.enum.join(', ')}`));
          }
        }
      } else if (tool.parameters) {
        // Fallback for legacy parameter format
        console.log(chalk.cyan('\n📝 Parameters (Legacy):'));
        
        for (const [paramName, param] of Object.entries(tool.parameters)) {
          const required = param.required ? 'required' : 'optional';
          const type = param.type || 'any';
          
          console.log(chalk.white(`   ${paramName}:`));
          console.log(chalk.gray(`      Type: ${type}`));
          console.log(chalk.gray(`      Required: ${required}`));
          
          if (param.description) {
            console.log(chalk.gray(`      Description: ${param.description}`));
          }
        }
      } else {
        console.log(chalk.gray('\n   No parameter definitions found'));
      }

      // Show output schema from new descriptive format
      if (tool.schema?.output?.properties) {
        console.log(chalk.cyan('\n📤 Output Properties:'));
        
        const required = tool.schema.output.required || [];
        for (const [propName, prop] of Object.entries(tool.schema.output.properties)) {
          const isRequired = required.includes(propName) ? 'required' : 'optional';
          const type = prop.type || 'any';
          
          console.log(chalk.white(`   ${propName}:`));
          console.log(chalk.gray(`      Type: ${type}`));
          console.log(chalk.gray(`      Required: ${isRequired}`));
          
          if (prop.description) {
            console.log(chalk.gray(`      Description: ${prop.description}`));
          }
          
          if (prop.enum) {
            console.log(chalk.gray(`      Valid Values: ${prop.enum.join(', ')}`));
          }
        }
      }
      
      // Show methods and properties
      if (options.verbose) {
        console.log(chalk.cyan('\n🔧 Tool Structure:'));
        
        const properties = Object.getOwnPropertyNames(tool);
        const methods = properties.filter(prop => typeof tool[prop] === 'function');
        const otherProps = properties.filter(prop => typeof tool[prop] !== 'function');
        
        if (methods.length > 0) {
          console.log(chalk.white('   Methods:'));
          for (const method of methods) {
            console.log(chalk.gray(`      ${method}()`));
          }
        }
        
        if (otherProps.length > 0) {
          console.log(chalk.white('   Properties:'));
          for (const prop of otherProps) {
            const value = tool[prop];
            const type = typeof value;
            console.log(chalk.gray(`      ${prop}: ${type}`));
          }
        }
      }
      
      // Test execution (dry run)
      if (isExecutable && options.verbose) {
        console.log(chalk.cyan('\n🧪 Execution Test:'));
        
        try {
          // Try to call with empty args to see what happens
          const result = await tool.execute({});
          console.log(chalk.green('   ✅ Tool accepts empty arguments'));
          console.log(chalk.gray(`      Result type: ${typeof result}`));
        } catch (error) {
          if (error.message.includes('required') || error.message.includes('missing')) {
            console.log(chalk.yellow('   ⚠️ Tool requires specific arguments'));
            console.log(chalk.gray(`      Error: ${error.message}`));
          } else {
            console.log(chalk.red('   ❌ Tool execution failed'));
            console.log(chalk.gray(`      Error: ${error.message}`));
          }
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`   ❌ Failed to load executable: ${error.message}`));
      
      if (options.verbose) {
        console.log(chalk.gray('\nError details:'));
        console.log(chalk.gray(error.stack));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Info retrieval failed:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const options = parseArgs();
    
    switch (options.command) {
      case 'execute':
        await executeCommand(options);
        break;
        
      case 'validate':
        await validateCommand(options);
        break;
        
      case 'list':
        await listCommand(options);
        break;
        
      case 'info':
        await infoCommand(options);
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
        
      default:
        console.log(chalk.red(`Unknown command: ${options.command}`));
        console.log(chalk.gray('Use "node tools.js help" for available commands.'));
        process.exit(1);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Tool operation failed:'), error.message);
    if (process.argv.includes('--verbose')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});