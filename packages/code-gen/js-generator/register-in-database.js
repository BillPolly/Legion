#!/usr/bin/env node

/**
 * Register JSGeneratorModule and its tools in the database
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';
import { JSGeneratorModule } from './src/JSGeneratorModule.js';

async function registerJSGeneratorModule() {
    console.log('🚀 Registering JSGeneratorModule in Database\n');
    console.log('=' + '='.repeat(60));

    try {
        // Initialize ResourceManager
        console.log('\n📋 Initializing ResourceManager...');
        const resourceManager = new ResourceManager();
        await resourceManager.initialize();
        
        // Create MongoDB provider
        console.log('📋 Connecting to MongoDB...');
        const provider = await MongoDBToolRegistryProvider.create(
            resourceManager,
            { enableSemanticSearch: false }
        );
        
        // Create and initialize the module
        console.log('📋 Creating JSGeneratorModule...');
        const module = await JSGeneratorModule.create(resourceManager);
        
        // Get all tools from the module
        const tools = module.getTools();
        console.log(`  Found ${tools.length} tools to register`);
        
        // Register the module in the database
        console.log('\n📋 Registering module...');
        const moduleData = {
            name: 'JSGenerator',
            type: 'class',
            path: 'packages/code-gen/js-generator/src/JSGeneratorModule.js',
            className: 'JSGeneratorModule',
            description: module.description,
            version: module.version || '1.0.0',
            category: 'code-generation',
            tags: ['javascript', 'code-generation', 'typescript', 'html']
        };
        
        // Check if module already exists
        const existingModule = await provider.getModule('JSGenerator');
        if (existingModule) {
            console.log('  Module already exists, skipping...');
        } else {
            console.log('  Creating new module entry...');
            await provider.saveModule(moduleData);
        }
        
        // Register each tool
        console.log('\n📋 Registering tools...');
        let registered = 0;
        let updated = 0;
        
        for (const tool of tools) {
            console.log(`  Processing: ${tool.name}`);
            
            const toolData = {
                name: tool.name,
                description: tool.description,
                moduleName: 'JSGenerator',
                moduleId: 'JSGenerator',
                category: 'code-generation',
                tags: ['javascript', 'code-generation'],
                inputSchema: tool.inputSchema || {},
                outputSchema: tool.outputSchema || {},
                hasExecute: true,
                executable: true
            };
            
            // Check if tool already exists
            const existingTools = await provider.listTools({ 
                toolName: tool.name, 
                limit: 1 
            });
            
            if (existingTools.length > 0) {
                console.log(`    Tool already exists, skipping: ${tool.name}`);
                updated++;
            } else {
                console.log(`    Registering new tool: ${tool.name}`);
                await provider.saveTool(toolData);
                registered++;
            }
        }
        
        console.log('\n📊 Registration Summary:');
        console.log(`  Module: JSGenerator`);
        console.log(`  New tools registered: ${registered}`);
        console.log(`  Tools updated: ${updated}`);
        console.log(`  Total tools: ${tools.length}`);
        
        // Verify registration
        console.log('\n📋 Verifying registration...');
        const verifyTools = await provider.listTools({ 
            moduleName: 'JSGenerator' 
        });
        console.log(`  Found ${verifyTools.length} tools in database for JSGenerator`);
        
        if (verifyTools.length === tools.length) {
            console.log('  ✅ All tools successfully registered');
        } else {
            console.log(`  ⚠️ Mismatch: Expected ${tools.length}, found ${verifyTools.length}`);
        }
        
        // List registered tools
        console.log('\n📋 Registered Tools:');
        for (const tool of verifyTools) {
            console.log(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
        }
        
        await provider.disconnect();
        
        console.log('\n' + '=' + '='.repeat(60));
        console.log('✅ JSGeneratorModule registration complete!');
        
    } catch (error) {
        console.error('\n❌ Registration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run registration
registerJSGeneratorModule()
    .then(() => {
        console.log('\n✅ Database registration successful');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Database registration failed:', error);
        process.exit(1);
    });