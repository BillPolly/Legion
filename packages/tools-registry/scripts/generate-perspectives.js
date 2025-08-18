#!/usr/bin/env node

/**
 * Generate Tool Perspectives Script
 * 
 * Generates and stores perspectives for tools using the ToolIndexer.
 * 
 * Usage:
 *   node scripts/generate-perspectives.js                    # Generate for all tools
 *   node scripts/generate-perspectives.js --module file      # Generate for specific module
 *   node scripts/generate-perspectives.js --tool file_read   # Generate for specific tool
 */

import { ToolIndexer } from '../src/search/ToolIndexer.js';
import { MongoDBToolRegistryProvider } from '../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = {
    module: null,
    tool: null,
    verbose: args.includes('--verbose') || args.includes('-v')
  };
  
  // Check for module filter
  const moduleIndex = args.indexOf('--module');
  if (moduleIndex !== -1 && args[moduleIndex + 1]) {
    options.module = args[moduleIndex + 1];
  }
  
  // Check for tool filter
  const toolIndex = args.indexOf('--tool');
  if (toolIndex !== -1 && args[toolIndex + 1]) {
    options.tool = args[toolIndex + 1];
  }
  
  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Tool Perspectives Generation Script

Usage:
  node scripts/generate-perspectives.js [options]

Options:
  --module <name>    Generate perspectives for specific module only
  --tool <name>      Generate perspectives for specific tool only
  --verbose, -v      Show detailed output
  --help, -h         Show this help message

Examples:
  node scripts/generate-perspectives.js
  node scripts/generate-perspectives.js --module file
  node scripts/generate-perspectives.js --tool file_read
  node scripts/generate-perspectives.js --module file --verbose
`);
    process.exit(0);
  }
  
  console.log('🔍 Tool Perspectives Generation Script');
  console.log('═'.repeat(50));
  
  if (options.tool) {
    console.log(`Target: Tool "${options.tool}"`);
  } else if (options.module) {
    console.log(`Target: Module "${options.module}"`);
  } else {
    console.log('Target: ALL tools in database');
  }
  console.log('');
  
  try {
    console.log('🔧 Initializing services...');
    const startTime = Date.now();
    
    // Initialize ResourceManager
    const resourceManager = ResourceManager.getInstance();
    if (!resourceManager.initialized) { await resourceManager.initialize(); }
    console.log('✅ ResourceManager initialized');
    
    // Create MongoDB provider
    const provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    console.log('✅ Database provider ready');
    
    // Create ToolIndexer with forced local Nomic embeddings
    console.log('🧠 Creating ToolIndexer with local Nomic embeddings...');
    const toolIndexer = await ToolIndexer.createForTools(resourceManager, { provider });
    console.log('✅ ToolIndexer ready\n');
    
    // Query tools from database
    console.log('📋 Querying tools from database...');
    let tools;
    
    if (options.tool) {
      // Get specific tool
      tools = await provider.listTools({ toolName: options.tool });
      if (tools.length === 0) {
        console.log(`❌ Tool "${options.tool}" not found in database`);
        process.exit(1);
      }
    } else if (options.module) {
      // Get tools from specific module
      tools = await provider.listTools({ moduleName: options.module });
      if (tools.length === 0) {
        console.log(`❌ No tools found for module "${options.module}"`);
        process.exit(1);
      }
    } else {
      // Get all tools
      tools = await provider.listTools();
    }
    
    console.log(`✅ Found ${tools.length} tools to process\n`);
    
    // Generate perspectives for each tool
    let totalPerspectives = 0;
    let processedTools = 0;
    
    for (const tool of tools) {
      console.log(`🔍 Processing: ${tool.name} (from ${tool.moduleName})`);
      
      try {
        const result = await toolIndexer.indexTool(tool, {}, tool._id);
        
        if (result.success) {
          const perspectiveCount = result.perspectives ? result.perspectives.length : 0;
          totalPerspectives += perspectiveCount;
          processedTools++;
          
          console.log(`   ✅ Generated ${perspectiveCount} perspectives`);
          
          if (options.verbose && result.perspectives) {
            console.log('   📝 Perspective types:');
            const types = result.perspectives.map(p => p.perspectiveType);
            const uniqueTypes = [...new Set(types)];
            for (const type of uniqueTypes) {
              const count = types.filter(t => t === type).length;
              console.log(`      - ${type}: ${count}`);
            }
          }
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    await provider.disconnect();
    
    const duration = Date.now() - startTime;
    
    console.log('═'.repeat(50));
    console.log('✅ Perspective generation completed!');
    console.log(`   Tools processed: ${processedTools}/${tools.length}`);
    console.log(`   Total perspectives: ${totalPerspectives}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   Average: ${(totalPerspectives / processedTools || 0).toFixed(1)} perspectives per tool`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Generation failed:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});