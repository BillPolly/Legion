#!/usr/bin/env node

import { ResourceManager, ModuleLoader } from '@legion/module-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCompleteToolsDocumentation() {
  console.log('🔧 Generating Complete Tools Documentation\n');

  try {
    // Create ResourceManager and ModuleLoader
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const moduleLoader = new ModuleLoader(resourceManager);
    await moduleLoader.initialize();

    console.log('📦 Loading Module Registry...\n');
    
    // Load the module registry
    const registryPath = path.resolve(__dirname, '../../module-loader/src/ModuleRegistry.json');
    const registryContent = await fs.readFile(registryPath, 'utf8');
    const registry = JSON.parse(registryContent);
    
    // Track loaded modules and their tools
    const moduleTools = new Map();
    const failedModules = [];
    
    console.log(`Found ${Object.keys(registry.modules).length} modules in registry\n`);
    
    // Load each module from the registry
    for (const [moduleName, moduleInfo] of Object.entries(registry.modules)) {
      try {
        console.log(`Loading ${moduleName}...`);
        
        const modulePath = path.resolve(__dirname, '../../../', moduleInfo.path);
        
        if (moduleInfo.type === 'json') {
          await moduleLoader.loadModuleFromJson(modulePath);
        } else if (moduleInfo.type === 'class') {
          const { [moduleInfo.className]: ModuleClass } = await import(modulePath);
          await moduleLoader.loadModuleByName(moduleName, ModuleClass);
        }
        
        // Get module instance and its tools
        const moduleInstance = moduleLoader.getModule(moduleName);
        const tools = moduleInstance ? moduleInstance.getTools() : [];
        moduleTools.set(moduleName, {
          info: moduleInfo,
          tools: tools
        });
        
        console.log(`  ✅ Loaded ${moduleName} (${tools.length} tools)`);
      } catch (error) {
        console.log(`  ❌ Failed to load ${moduleName}: ${error.message}`);
        failedModules.push({ name: moduleName, error: error.message });
      }
    }
    
    // Generate comprehensive markdown documentation
    let markdown = '# Complete Legion Tools Documentation\n\n';
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Summary section
    markdown += '## Summary\n\n';
    const totalTools = Array.from(moduleTools.values()).reduce((sum, m) => sum + m.tools.length, 0);
    markdown += `- **Total Modules**: ${moduleTools.size}\n`;
    markdown += `- **Total Tools**: ${totalTools}\n`;
    markdown += `- **Failed Modules**: ${failedModules.length}\n\n`;
    
    if (failedModules.length > 0) {
      markdown += '### Failed Modules\n\n';
      failedModules.forEach(({ name, error }) => {
        markdown += `- **${name}**: ${error}\n`;
      });
      markdown += '\n';
    }
    
    // Module documentation
    markdown += '## Modules and Tools\n\n';
    
    // Sort modules alphabetically
    const sortedModules = Array.from(moduleTools.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [moduleName, moduleData] of sortedModules) {
      markdown += `### 📦 Module: \`${moduleName}\`\n\n`;
      
      // Add module path info
      markdown += `- **Type**: ${moduleData.info.type}\n`;
      markdown += `- **Path**: \`${moduleData.info.path}\`\n`;
      if (moduleData.info.className) {
        markdown += `- **Class**: \`${moduleData.info.className}\`\n`;
      }
      markdown += `- **Tools Count**: ${moduleData.tools.length}\n\n`;
      
      if (moduleData.tools.length === 0) {
        markdown += '_No tools in this module_\n\n';
        continue;
      }
      
      // Document each tool in the module
      for (const tool of moduleData.tools) {
        markdown += `#### 🔧 Tool: \`${tool.name}\`\n\n`;
        markdown += `**Description**: ${tool.description || '_No description provided_'}\n\n`;
        
        // Input parameters
        if (tool.inputSchema) {
          markdown += '**Input Parameters**:\n\n';
          
          try {
            const schemaObj = tool.inputSchema._def || tool.inputSchema;
            const shape = schemaObj.shape || schemaObj.schema || {};
            
            if (Object.keys(shape).length === 0) {
              markdown += '_No input parameters required_\n\n';
            } else {
              markdown += '| Parameter | Type | Required | Description |\n';
              markdown += '|-----------|------|----------|-------------|\n';
              
              for (const [key, value] of Object.entries(shape)) {
                if (value && value._def) {
                  const type = value._def.typeName?.replace('Zod', '') || 'unknown';
                  const required = !value.isOptional || (value.isOptional && !value.isOptional());
                  const description = value._def.description || '_No description_';
                  
                  markdown += `| \`${key}\` | ${type} | ${required ? 'Yes' : 'No'} | ${description} |\n`;
                }
              }
              markdown += '\n';
            }
          } catch (e) {
            markdown += '_Unable to parse input schema_\n\n';
          }
        } else {
          markdown += '**Input Parameters**: _None specified_\n\n';
        }
        
        // Output schema (if available)
        if (tool.outputSchema) {
          markdown += '**Output Schema**:\n\n';
          
          try {
            const schemaObj = tool.outputSchema._def || tool.outputSchema;
            const shape = schemaObj.shape || schemaObj.schema || {};
            
            if (Object.keys(shape).length === 0) {
              markdown += '_No structured output_\n\n';
            } else {
              markdown += '| Field | Type | Description |\n';
              markdown += '|-------|------|-------------|\n';
              
              for (const [key, value] of Object.entries(shape)) {
                if (value && value._def) {
                  const type = value._def.typeName?.replace('Zod', '') || 'unknown';
                  const description = value._def.description || '_No description_';
                  
                  markdown += `| \`${key}\` | ${type} | ${description} |\n`;
                }
              }
              markdown += '\n';
            }
          } catch (e) {
            markdown += '_Unable to parse output schema_\n\n';
          }
        }
        
        // Example usage
        markdown += '**Example Usage in Plan**:\n\n';
        markdown += '```json\n';
        markdown += `{
  "id": "action-1",
  "type": "${tool.name}",
  "parameters": {
    // Add parameters based on the input schema above
  }
}\n`;
        markdown += '```\n\n';
        
        markdown += '---\n\n';
      }
    }
    
    // Quick reference section
    markdown += '## Quick Reference - All Tools\n\n';
    markdown += '| Tool Name | Module | Description |\n';
    markdown += '|-----------|--------|-------------|\n';
    
    for (const [moduleName, moduleData] of sortedModules) {
      for (const tool of moduleData.tools) {
        markdown += `| \`${tool.name}\` | ${moduleName} | ${tool.description || '_No description_'} |\n`;
      }
    }
    
    // Write to file
    const outputPath = path.join(__dirname, '..', 'COMPLETE-TOOLS-DOCUMENTATION.md');
    await fs.writeFile(outputPath, markdown, 'utf8');
    
    console.log(`\n✅ Documentation generated successfully!`);
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`\n📊 Stats:`);
    console.log(`   - Modules documented: ${moduleTools.size}`);
    console.log(`   - Total tools: ${totalTools}`);
    console.log(`   - Failed modules: ${failedModules.length}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the generator
generateCompleteToolsDocumentation().catch(console.error);