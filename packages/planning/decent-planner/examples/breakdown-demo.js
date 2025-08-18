#!/usr/bin/env node

/**
 * Demo script showing the improvement from tool breakdown
 * 
 * Run with: NODE_OPTIONS='--experimental-vm-modules' node examples/breakdown-demo.js
 */

import { PlanSynthesizer } from '../src/core/PlanSynthesizer.js';
import { ToolDiscoveryAdapter } from '../src/core/ToolDiscoveryAdapter.js';
import { createSemanticToolDiscovery } from '@legion/tools-registry';
import { ResourceManager } from '@legion/resource-manager';

// Create a simple mock setup
const mockLLMClient = {
  generateResponse: async ({ messages }) => {
    const content = messages[0].content;
    
    // Handle breakdown requests
    if (content.includes('Break this task down')) {
      console.log('  [LLM] Breaking down task into elementary operations...');
      
      if (content.includes('Read a JSON file and extract')) {
        return {
          content: JSON.stringify({
            operations: [
              'read file from disk',
              'parse JSON content',
              'extract specific field'
            ]
          })
        };
      }
      
      if (content.includes('CSV')) {
        return {
          content: JSON.stringify({
            operations: [
              'read CSV file',
              'parse CSV data', 
              'calculate sum'
            ]
          })
        };
      }
    }
    
    // Handle tool sufficiency checks
    if (content.includes('Are these tools sufficient')) {
      return {
        content: JSON.stringify({
          sufficient: true,
          reason: 'Tools available for the task',
          missing: []
        })
      };
    }
    
    return { content: '{}' };
  },
  
  // Add complete method for Planner
  complete: async () => {
    return JSON.stringify({
      type: 'sequence',
      children: [
        { type: 'action', tool: 'file_read', params: {} },
        { type: 'action', tool: 'json_parse', params: {} }
      ]
    });
  }
};

// Mock context hints
const mockContextHints = {
  getHints: () => ({ suggestedInputs: [], suggestedOutputs: [] }),
  addHints: () => {},
  getSiblingOutputs: () => []
};

async function demonstrateImprovement() {
  console.log('='.repeat(60));
  console.log('TOOL DISCOVERY BREAKDOWN IMPROVEMENT DEMONSTRATION');
  console.log('='.repeat(60));
  
  // Initialize REAL components
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  // Get the tool registry provider
  const toolRegistryProvider = resourceManager.get('toolRegistryProvider');
  if (!toolRegistryProvider) {
    console.error('❌ Tool registry provider not found in ResourceManager');
    console.error('   Make sure MongoDB is running and tools are populated');
    process.exit(1);
  }
  
  // Create REAL semantic tool discovery
  const semanticDiscovery = await createSemanticToolDiscovery(resourceManager, {
    toolRegistry: toolRegistryProvider
  });
  
  // Wrap in adapter for interface compatibility
  const toolDiscovery = new ToolDiscoveryAdapter(semanticDiscovery, toolRegistryProvider);
  await toolDiscovery.initialize();
  
  const synthesizer = new PlanSynthesizer({
    llmClient: mockLLMClient,
    toolDiscovery: toolDiscovery,
    contextHints: mockContextHints
  });
  
  // Test case: JSON file processing
  const testCase = {
    description: 'Read a JSON file and extract the "config.database.host" field'
  };
  
  console.log('\n📋 Task:', testCase.description);
  console.log('-'.repeat(60));
  
  // Test WITHOUT breakdown
  console.log('\n1️⃣ WITHOUT Breakdown (Original Method):');
  console.log('  Searching for:', testCase.description);
  
  const toolsWithout = await synthesizer._discoverTools(
    { description: testCase.description },
    { debug: false }
  );
  
  console.log('  Tools found:', toolsWithout.map(t => t.name).join(', ') || 'NONE');
  
  // Test WITH breakdown
  console.log('\n2️⃣ WITH Breakdown (Improved Method):');
  
  const toolsWith = await synthesizer._discoverToolsWithBreakdown(
    { description: testCase.description },
    { debug: false }
  );
  
  console.log('  Tools found:', toolsWith.map(t => t.name).join(', '));
  
  // Show the improvement
  console.log('\n📊 Results Comparison:');
  console.log('  Without breakdown:', toolsWithout.length, 'tools');
  console.log('  With breakdown:   ', toolsWith.length, 'tools');
  
  if (toolsWith.length > toolsWithout.length) {
    console.log('\n✅ IMPROVEMENT: Breakdown found', 
      toolsWith.length - toolsWithout.length, 'more relevant tools!');
  }
  
  // Show which tools were missing without breakdown
  const toolsWithoutNames = new Set(toolsWithout.map(t => t.name));
  const additionalTools = toolsWith.filter(t => !toolsWithoutNames.has(t.name));
  
  if (additionalTools.length > 0) {
    console.log('\n🔍 Additional tools discovered with breakdown:');
    additionalTools.forEach(tool => {
      console.log('  -', tool.name, ':', tool.description);
    });
  }
  
  // Test another case
  console.log('\n' + '='.repeat(60));
  console.log('📋 Task: Calculate the sum of amounts from a CSV file');
  console.log('-'.repeat(60));
  
  const csvTask = { description: 'Calculate the sum of amounts from a CSV file' };
  
  const csvToolsWithout = await synthesizer._discoverTools(csvTask, {});
  console.log('Without breakdown:', csvToolsWithout.map(t => t.name).join(', ') || 'NONE');
  
  const csvToolsWith = await synthesizer._discoverToolsWithBreakdown(csvTask, {});
  console.log('With breakdown:   ', csvToolsWith.map(t => t.name).join(', '));
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Key Insight:');
  console.log('The breakdown method improves tool discovery by:');
  console.log('1. Breaking complex tasks into elementary operations');
  console.log('2. Searching for tools for each operation separately');
  console.log('3. Combining all discovered tools into a comprehensive set');
  console.log('This ensures the planner has ALL necessary tools to create a valid plan!');
  console.log('='.repeat(60));
}

// Run the demonstration
demonstrateImprovement().catch(console.error);