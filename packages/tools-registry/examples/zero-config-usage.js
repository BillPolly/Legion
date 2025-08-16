#!/usr/bin/env node

/**
 * Example: Zero-Configuration ToolRegistry Usage
 * 
 * This example demonstrates how to use the ToolRegistry singleton
 * with absolutely zero configuration required.
 */

// Simple import - that's all you need!
import toolRegistry from '@legion/tools-registry';

async function main() {
  console.log('🚀 Zero-Configuration ToolRegistry Example\n');
  
  // Example 1: Get and execute a tool
  console.log('Example 1: Get and execute a tool');
  const calculator = await toolRegistry.getTool('calculator');
  if (calculator) {
    const result = await calculator.execute({ 
      expression: '2 + 2' 
    });
    console.log(`Calculator result: ${result.result}\n`);
  }
  
  // Example 2: List available tools
  console.log('Example 2: List available tools');
  const tools = await toolRegistry.listTools({ limit: 5 });
  console.log(`Found ${tools.length} tools:`);
  tools.forEach(tool => {
    console.log(`  - ${tool.name} (${tool.moduleName})`);
  });
  
  // Example 3: Search for tools
  console.log('\nExample 3: Search for file-related tools');
  const fileTools = await toolRegistry.searchTools('file');
  console.log(`Found ${fileTools.length} file-related tools:`);
  fileTools.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description?.substring(0, 50)}...`);
  });
  
  // Example 4: Use the loader for database management
  console.log('\nExample 4: Access the loader for database operations');
  const loader = await toolRegistry.getLoader();
  const state = loader.getPipelineState();
  console.log('Loader state:', {
    modulesLoaded: state.modulesLoaded,
    toolCount: state.toolCount,
    isComplete: state.isComplete
  });
  
  // Example 5: Semantic search (if available)
  console.log('\nExample 5: Semantic tool search');
  try {
    const semanticResults = await toolRegistry.semanticToolSearch(
      'I need to read files from disk',
      { limit: 3 }
    );
    console.log(`Found ${semanticResults.tools.length} semantically relevant tools:`);
    semanticResults.tools.forEach(tool => {
      console.log(`  - ${tool.name} (confidence: ${(tool.confidence * 100).toFixed(1)}%)`);
    });
  } catch (error) {
    console.log(`  Semantic search not available: ${error.message}`);
  }
}

// Run the example
main().catch(console.error);