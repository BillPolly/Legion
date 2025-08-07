#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateToolsList() {
  console.log('🔧 Generating complete tools list for Plan Executor\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading all available modules...\n');
    
    // Load all the modules that plan executor typically uses
    
    // 1. File Module
    const fileModulePath = path.resolve(__dirname, '../../general-tools/src/file/FileModule.js');
    const { default: FileModule } = await import(fileModulePath);
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // 2. Playwright Module
    const playwrightModulePath = path.resolve(__dirname, '../../playwright/module.json');
    await moduleLoader.loadModuleFromJson(playwrightModulePath);
    console.log('✅ Loaded Playwright module');

    // 3. Node Runner Module
    try {
      const nodeRunnerModulePath = path.resolve(__dirname, '../../node-runner/module.json');
      await moduleLoader.loadModuleFromJson(nodeRunnerModulePath);
      console.log('✅ Loaded Node Runner module');
    } catch (error) {
      console.log('⚠️  Node Runner module failed to load:', error.message);
    }

    // 4. Command Executor (if exists)
    try {
      const commandExecutorPath = path.resolve(__dirname, '../../command-executor/module.json');
      await moduleLoader.loadModuleFromJson(commandExecutorPath);
      console.log('✅ Loaded Command Executor module');
    } catch (error) {
      // Try alternative location
      try {
        const commandExecutorPath = path.resolve(__dirname, '../../general-tools/src/command-executor/module.json');
        await moduleLoader.loadModuleFromJson(commandExecutorPath);
        console.log('✅ Loaded Command Executor module');
      } catch (error2) {
        console.log('⚠️  Command Executor module not found');
      }
    }

    // 5. HTML Generator (if exists)
    try {
      const htmlGenPath = path.resolve(__dirname, '../../html-generator/module.json');
      await moduleLoader.loadModuleFromJson(htmlGenPath);
      console.log('✅ Loaded HTML Generator module');
    } catch (error) {
      // Try alternative location
      try {
        const htmlGenPath = path.resolve(__dirname, '../../general-tools/src/html-generator/module.json');
        await moduleLoader.loadModuleFromJson(htmlGenPath);
        console.log('✅ Loaded HTML Generator module');
      } catch (error2) {
        console.log('⚠️  HTML Generator module not found');
      }
    }

    // Get all loaded tools
    const tools = await moduleLoader.getAllTools();
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Tools available: ${tools.length}`);

    // Generate markdown content
    let markdown = '# Available Tools for Plan Executor\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += '## Summary\n\n';
    markdown += `- **Total Tools**: ${tools.length}\n\n`;
    
    markdown += '## Available Tools\n\n';
    
    // List all tools with details
    for (const tool of tools) {
      markdown += `### \`${tool.name}\`\n\n`;
      markdown += `- **Description**: ${tool.description || 'No description'}\n`;
      
      // Show input schema if available
      if (tool.inputSchema) {
        markdown += `- **Input Schema**:\n`;
        markdown += '  ```json\n';
        
        try {
          // Extract schema details
          const schemaObj = tool.inputSchema._def || tool.inputSchema;
          const shape = schemaObj.shape || schemaObj.schema || {};
          
          const schemaDetails = {};
          for (const [key, value] of Object.entries(shape)) {
            if (value && value._def) {
              schemaDetails[key] = {
                type: value._def.typeName || 'unknown',
                optional: value.isOptional ? value.isOptional() : false,
                description: value._def.description || undefined
              };
            }
          }
          
          markdown += '  ' + JSON.stringify(schemaDetails, null, 2).split('\n').join('\n  ') + '\n';
        } catch (e) {
          markdown += '  // Schema parsing failed\n';
        }
        
        markdown += '  ```\n';
      }
      
      markdown += '\n';
    }
    
    // Add usage examples
    markdown += '## Usage in Plans\n\n';
    markdown += 'Use these tools in your plan JSON files:\n\n';
    markdown += '```json\n';
    markdown += `{
  "id": "example-plan",
  "name": "Example Plan",
  "status": "validated",
  "steps": [
    {
      "id": "step-1",
      "name": "Example Step",
      "actions": [
        {
          "id": "action-1",
          "type": "<tool-name>",
          "parameters": {
            // Tool-specific parameters
          }
        }
      ]
    }
  ]
}\n`;
    markdown += '```\n\n';
    
    // List all tool names for quick reference
    markdown += '## Quick Reference - All Tool Names\n\n';
    for (const tool of tools) {
      markdown += `- \`${tool.name}\`${tool.description ? ` - ${tool.description}` : ''}\n`;
    }
    
    // Write to file
    const outputPath = path.join(__dirname, '..', 'AVAILABLE-TOOLS.md');
    await fs.writeFile(outputPath, markdown, 'utf8');
    
    console.log(`\n✅ Tools list generated successfully!`);
    console.log(`📁 Saved to: ${outputPath}`);
    
    // Also log tool names for immediate reference
    console.log('\n🔧 Available tools for plans:');
    for (const tool of tools) {
      console.log(`   - ${tool.name}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the generator
generateToolsList().catch(console.error);