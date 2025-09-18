#!/usr/bin/env node

/**
 * Tool Registry - List All Available Tools Script
 * 
 * This is the STANDARD way for anyone wanting to know what tools are available
 * in the Legion framework. Use this script to discover available tools and their metadata.
 * 
 * This script uses the ToolRegistry singleton to get a comprehensive list of all 
 * available tools with their descriptions, input schemas, and module information.
 * 
 * Usage:
 *   npm run list                    # List all tools with basic info
 *   npm run list:verbose            # List tools with detailed schemas
 *   node scripts/list-tools.js      # Direct execution
 *   node scripts/list-tools.js --verbose   # Detailed output
 *   node scripts/list-tools.js --json      # Machine-readable JSON output
 *   node scripts/list-tools.js --help      # Show this help
 * 
 * Output Formats:
 *   - Default: Organized by module with tool names and descriptions
 *   - Verbose: Includes input/output schemas and detailed metadata
 *   - JSON: Machine-readable format for integration with other tools
 * 
 * Examples:
 *   # Quick overview of available tools
 *   npm run list
 * 
 *   # Detailed tool information for development
 *   npm run list:verbose
 * 
 *   # Export tool list for external processing
 *   npm run list -- --json > tools.json
 * 
 * NOTE: This script accesses the ToolRegistry singleton which automatically
 * initializes and discovers all available tools in the Legion ecosystem.
 */

import { getToolRegistry } from '../src/index.js';

async function main() {
  const args = process.argv.slice(2);
  
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const verbose = args.includes('--verbose') || args.includes('-v');
  const jsonOutput = args.includes('--json');
  const showSchemas = args.includes('--schemas');
  
  try {
    // Get ToolRegistry singleton - this is the standard way to access tools
    console.error('🔧 Getting ToolRegistry singleton...');
    const toolRegistry = await getToolRegistry();
    
    // Get all available tools
    console.error('📋 Retrieving all available tools...');
    const tools = await toolRegistry.listTools();
    
    if (!tools || tools.length === 0) {
      console.error('⚠️  No tools found in registry');
      console.error('💡 Try running: npm run pipeline');
      process.exit(1);
    }
    
    if (jsonOutput) {
      // Machine-readable JSON output
      const jsonData = {
        timestamp: new Date().toISOString(),
        totalTools: tools.length,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description || 'No description available',
          moduleName: tool.moduleName,
          inputSchema: tool.inputSchema || null,
          outputSchema: tool.outputSchema || null,
          hasExecute: typeof tool.execute === 'function'
        }))
      };
      
      console.log(JSON.stringify(jsonData, null, 2));
    } else {
      // Human-readable output
      await displayHumanReadableTools(tools, verbose, showSchemas);
    }
    
  } catch (error) {
    console.error(`❌ Error listing tools: ${error.message}`);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

async function displayHumanReadableTools(tools, verbose, showSchemas) {
  // Group tools by module
  const toolsByModule = new Map();
  
  tools.forEach(tool => {
    const moduleName = tool.moduleName || 'Unknown Module';
    if (!toolsByModule.has(moduleName)) {
      toolsByModule.set(moduleName, []);
    }
    toolsByModule.get(moduleName).push(tool);
  });
  
  // Display header
  console.log('\n🔧 Legion Framework - Available Tools');
  console.log('=' .repeat(60));
  console.log(`📊 Total Tools: ${tools.length}`);
  console.log(`📦 Modules: ${toolsByModule.size}`);
  console.log();
  
  // Display tools organized by module
  const sortedModules = Array.from(toolsByModule.keys()).sort();
  
  for (const moduleName of sortedModules) {
    const moduleTools = toolsByModule.get(moduleName);
    
    console.log(`📦 ${moduleName} (${moduleTools.length} tools)`);
    console.log('-'.repeat(40));
    
    // Sort tools within module
    const sortedTools = moduleTools.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const tool of sortedTools) {
      console.log(`  🔧 ${tool.name}`);
      
      if (tool.description) {
        const desc = tool.description.length > 80 
          ? tool.description.substring(0, 77) + '...'
          : tool.description;
        console.log(`     ${desc}`);
      } else {
        console.log(`     No description available`);
      }
      
      if (verbose) {
        console.log(`     Module: ${tool.moduleName}`);
        console.log(`     Executable: ${typeof tool.execute === 'function' ? '✅' : '❌'}`);
        
        if (tool.inputSchema && (showSchemas || verbose)) {
          console.log(`     Input Schema: ${JSON.stringify(tool.inputSchema, null, 6).replace(/\n/g, '\n     ')}`);
        } else if (tool.inputSchema) {
          console.log(`     Has Input Schema: ✅`);
        }
        
        if (tool.outputSchema && (showSchemas || verbose)) {
          console.log(`     Output Schema: ${JSON.stringify(tool.outputSchema, null, 6).replace(/\n/g, '\n     ')}`);
        } else if (tool.outputSchema) {
          console.log(`     Has Output Schema: ✅`);
        }
      }
      
      console.log();
    }
  }
  
  // Display summary footer
  console.log('=' .repeat(60));
  console.log('💡 Usage Tips:');
  console.log('  • Use tool names exactly as shown above');
  console.log('  • Tools are accessed via ToolRegistry.getInstance()');
  console.log('  • Run with --verbose for detailed schemas');
  console.log('  • Run with --json for machine-readable output');
  console.log();
  console.log('📚 Documentation:');
  console.log('  • Tool Registry: packages/tools-registry/README.md');
  console.log('  • Individual modules: packages/modules/*/README.md');
  console.log();
}

function showHelp() {
  console.log(`
Legion Framework - Tool Listing Script

This is the STANDARD way to discover what tools are available in Legion.

Usage:
  npm run list                      # Basic tool listing
  npm run list:verbose              # Detailed tool information  
  node scripts/list-tools.js [options]

Options:
  --verbose, -v     Show detailed tool information including schemas
  --json            Output in machine-readable JSON format
  --schemas         Show full input/output schemas (implies --verbose)
  --help, -h        Show this help message

Examples:
  # Quick overview
  npm run list

  # Detailed information for development
  npm run list:verbose
  
  # Export for external tools
  npm run list -- --json > available-tools.json
  
  # Show full schemas for API integration
  node scripts/list-tools.js --schemas

Output:
  Tools are organized by module and include:
  - Tool name (exact name to use in code)
  - Description
  - Module name
  - Input/output schema availability
  - Execution capability

Notes:
  - This script uses ToolRegistry singleton (the correct approach)
  - Tools are auto-discovered from the Legion ecosystem
  - Run 'npm run pipeline' if no tools are found
  `);
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error.message);
  process.exit(1);
});

// Run the script
main().catch(console.error);