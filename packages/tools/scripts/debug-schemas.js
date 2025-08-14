#!/usr/bin/env node

/**
 * Debug script to understand Zod schema structure
 */

import { ResourceManager } from '../src/ResourceManager.js';
import chalk from 'chalk';

async function main() {
  const rm = new ResourceManager();
  await rm.initialize();
  
  console.log(chalk.blue('🔍 Debugging Zod schemas...'));
  
  try {
    // Import and instantiate Json module
    const JsonModule = (await import('../../tools-collection/src/json/JsonModule.js')).default;
    const jsonModule = new JsonModule();
    
    const tools = jsonModule.getTools ? jsonModule.getTools() : Object.values(jsonModule.tools);
    
    for (const tool of tools) {
      console.log(chalk.green(`\n🔧 Tool: ${tool.name}`));
      console.log(`Description: ${tool.description}`);
      
      // Check all properties
      console.log(chalk.yellow('All tool properties:'));
      console.log(`  ${Object.keys(tool)}`);
      
      console.log(chalk.yellow('Input Schema:'));
      console.log(`  tool.inputSchema: ${typeof tool.inputSchema}`);
      console.log(`  tool.schema: ${typeof tool.schema}`);
      console.log(`  tool.validator: ${typeof tool.validator}`);
      
      // Check validator properties
      if (tool.validator) {
        console.log(`  validator properties: ${Object.keys(tool.validator)}`);
        if (tool.validator.jsonSchema) {
          console.log(`  validator.jsonSchema: ${JSON.stringify(tool.validator.jsonSchema, null, 2)}`);
        }
        if (tool.validator.zodSchema) {
          console.log(`  validator.zodSchema type: ${typeof tool.validator.zodSchema}`);
          console.log(`  validator.zodSchema._def: ${!!tool.validator.zodSchema._def}`);
          if (tool.validator.zodSchema._def) {
            console.log(`  zodSchema._def.typeName: ${tool.validator.zodSchema._def.typeName}`);
            console.log(`  zodSchema._def.shape: ${typeof tool.validator.zodSchema._def.shape}`);
            if (typeof tool.validator.zodSchema._def.shape === 'function') {
              try {
                const shape = tool.validator.zodSchema._def.shape();
                console.log(`  Shape keys: ${Object.keys(shape)}`);
                for (const [key, field] of Object.entries(shape).slice(0, 2)) {
                  console.log(`    ${key}: ${field._def.typeName} - ${field._def.description || 'no desc'}`);
                }
              } catch (e) {
                console.log(`  Error getting shape: ${e.message}`);
              }
            }
          }
        }
      }
      
      // Check the original source code by recreating the tool
      console.log(chalk.yellow('Recreating tool to check original schema:'));
      try {
        const toolClass = tool.constructor;
        const newTool = new toolClass();
        console.log(`  New tool inputSchema: ${typeof newTool.inputSchema}`);
        console.log(`  New tool schema: ${typeof newTool.schema}`);
        console.log(`  New tool properties: ${Object.keys(newTool)}`);
      } catch (e) {
        console.log(`  Could not recreate tool: ${e.message}`);
      }
      
      if (tool.inputSchema?._def) {
        console.log(`  _def.typeName: ${tool.inputSchema._def.typeName}`);
        console.log(`  _def.shape: ${typeof tool.inputSchema._def.shape}`);
        
        if (typeof tool.inputSchema._def.shape === 'function') {
          try {
            const shape = tool.inputSchema._def.shape();
            console.log(`  Shape keys: ${Object.keys(shape)}`);
            
            for (const [key, fieldSchema] of Object.entries(shape)) {
              console.log(`    ${key}:`);
              console.log(`      type: ${fieldSchema._def?.typeName}`);
              console.log(`      description: ${fieldSchema._def?.description}`);
            }
          } catch (e) {
            console.log(`  Error getting shape: ${e.message}`);
          }
        }
      }
      
      // Try alternative method: zodToJsonSchema conversion
      try {
        // Check if we can use zod-to-json-schema
        const zodToJsonSchema = await import('zod-to-json-schema').catch(() => null);
        if (zodToJsonSchema && tool.inputSchema) {
          const jsonSchema = zodToJsonSchema.zodToJsonSchema(tool.inputSchema);
          console.log(`  JSON Schema: ${JSON.stringify(jsonSchema, null, 2)}`);
        }
      } catch (e) {
        console.log(`  Could not convert to JSON schema: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

main().catch(error => {
  console.error(chalk.red('❌ Fatal error:'), error);
  process.exit(1);
});