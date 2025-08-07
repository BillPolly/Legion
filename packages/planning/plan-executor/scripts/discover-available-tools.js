#!/usr/bin/env node

/**
 * Script to discover all available Legion modules and tools
 * This generates a comprehensive inventory that shows what tools are available for plan execution
 */

import { ResourceManager, ModuleLoader } from '@legion/tool-core';
import FileModule from '../../general-tools/src/file/FileModule.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function discoverTools() {
  console.log('🔍 Discovering available Legion modules and tools...\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    // Load essential modules
    console.log('📦 Loading essential modules...');
    
    // Load FileModule from general-tools
    await moduleLoader.loadModuleByName('file', FileModule);
    console.log('✅ Loaded FileModule');

    // Try to load other modules if available
    const modulesToTry = [
      { name: 'command-executor', path: '../../general-tools/src/command/Module.js' },
      { name: 'playwright', path: '../../playwright/src/Module.js' },
      { name: 'node-runner', path: '../../node-runner/src/Module.js' }
    ];

    for (const moduleInfo of modulesToTry) {
      try {
        const modulePath = path.resolve(__dirname, moduleInfo.path);
        await moduleLoader.loadModule(modulePath);
        console.log(`✅ Loaded ${moduleInfo.name}`);
      } catch (error) {
        console.log(`⚠️  Could not load ${moduleInfo.name}: ${error.message}`);
      }
    }

    // Generate inventory
    console.log('\n📊 Generating module and tool inventory...');
    const inventory = moduleLoader.getModuleAndToolInventory();

    // Display summary
    console.log(`\n📈 Summary:`);
    console.log(`   Modules loaded: ${inventory.moduleCount}`);
    console.log(`   Tools available: ${inventory.toolCount}`);

    // Display modules
    console.log(`\n📦 Loaded Modules:`);
    for (const [moduleName, moduleInfo] of Object.entries(inventory.modules)) {
      console.log(`\n   ${moduleName}:`);
      console.log(`      Description: ${moduleInfo.description}`);
      console.log(`      Tools: ${moduleInfo.toolCount}`);
      if (moduleInfo.tools.length > 0) {
        console.log(`      Tool names: ${moduleInfo.tools.join(', ')}`);
      }
    }

    // Display tools
    console.log(`\n🔧 Available Tools:`);
    for (const [toolName, toolInfo] of Object.entries(inventory.tools)) {
      console.log(`\n   ${toolName}:`);
      console.log(`      Description: ${toolInfo.description}`);
      console.log(`      Has execute(): ${toolInfo.hasExecute}`);
      console.log(`      Has invoke(): ${toolInfo.hasInvoke}`);
      console.log(`      Input schema: ${toolInfo.inputSchema}`);
    }

    // Save inventory to file
    const inventoryPath = path.join(__dirname, '..', 'tool-inventory.json');
    await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
    console.log(`\n💾 Tool inventory saved to: ${inventoryPath}`);

    // Create a simple markdown documentation
    const mdContent = generateMarkdown(inventory);
    const mdPath = path.join(__dirname, '..', 'AVAILABLE-TOOLS.md');
    await fs.writeFile(mdPath, mdContent);
    console.log(`📄 Documentation saved to: ${mdPath}`);

  } catch (error) {
    console.error('❌ Error discovering tools:', error);
    process.exit(1);
  }
}

function generateMarkdown(inventory) {
  let md = `# Available Legion Tools for Plan Execution

Generated: ${inventory.generatedAt}

## Summary

- **Total Modules**: ${inventory.moduleCount}
- **Total Tools**: ${inventory.toolCount}

## Modules

`;

  for (const [moduleName, moduleInfo] of Object.entries(inventory.modules)) {
    md += `### ${moduleName}\n\n`;
    md += `- **Description**: ${moduleInfo.description}\n`;
    md += `- **Tools**: ${moduleInfo.toolCount}\n`;
    if (moduleInfo.tools.length > 0) {
      md += `- **Tool Names**: \`${moduleInfo.tools.join('`, `')}\`\n`;
    }
    md += '\n';
  }

  md += `## Tools Reference\n\n`;
  md += `| Tool Name | Description | Has Execute | Has Invoke |\n`;
  md += `|-----------|-------------|-------------|------------|\n`;

  for (const [toolName, toolInfo] of Object.entries(inventory.tools)) {
    md += `| \`${toolName}\` | ${toolInfo.description} | ${toolInfo.hasExecute ? '✅' : '❌'} | ${toolInfo.hasInvoke ? '✅' : '❌'} |\n`;
  }

  md += `\n## Using Tools in Plans\n\n`;
  md += `When creating plans for the PlanExecutor, use the tool names listed above in your action types:\n\n`;
  md += `\`\`\`json
{
  "id": "example-plan",
  "status": "validated",
  "steps": [
    {
      "id": "write-file",
      "actions": [
        {
          "type": "file_operations",
          "parameters": {
            "filepath": "/tmp/output.txt",
            "content": "Hello from PlanExecutor!"
          }
        }
      ]
    }
  ]
}
\`\`\`\n`;

  return md;
}

// Run the discovery
discoverTools().catch(console.error);