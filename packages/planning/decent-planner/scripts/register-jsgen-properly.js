#!/usr/bin/env node

/**
 * Properly register JSGeneratorModule and all its tools in the database
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';
import { JSGeneratorModule } from '../../../code-gen/js-generator/src/JSGeneratorModule.js';

// Helper function to extract Zod type information
function extractZodTypeInfo(zodType) {
    if (!zodType || !zodType._def) {
        return { type: 'any' };
    }
    
    const def = zodType._def;
    const typeInfo = {};
    
    // Get the base type
    if (def.typeName === 'ZodString') {
        typeInfo.type = 'string';
    } else if (def.typeName === 'ZodNumber') {
        typeInfo.type = 'number';
    } else if (def.typeName === 'ZodBoolean') {
        typeInfo.type = 'boolean';
    } else if (def.typeName === 'ZodArray') {
        typeInfo.type = 'array';
        if (def.type) {
            typeInfo.items = extractZodTypeInfo(def.type);
        }
    } else if (def.typeName === 'ZodObject') {
        typeInfo.type = 'object';
        if (def.shape) {
            typeInfo.properties = {};
            for (const [key, value] of Object.entries(def.shape)) {
                typeInfo.properties[key] = extractZodTypeInfo(value);
            }
        }
    } else if (def.typeName === 'ZodOptional') {
        const innerType = extractZodTypeInfo(def.innerType);
        return { ...innerType, optional: true };
    } else if (def.typeName === 'ZodEnum') {
        typeInfo.type = 'string';
        typeInfo.enum = def.values;
    } else {
        typeInfo.type = 'any';
    }
    
    // Add description if available
    if (def.description) {
        typeInfo.description = def.description;
    }
    
    return typeInfo;
}

async function registerJSGeneratorModule() {
    console.log('📝 Registering JSGeneratorModule in Database\n');
    console.log('=' + '='.repeat(60));

    try {
        // Initialize ResourceManager
        const resourceManager = new ResourceManager();
        await resourceManager.initialize();
        
        // Create provider
        const provider = await MongoDBToolRegistryProvider.create(
            resourceManager,
            { enableSemanticSearch: false }
        );
        
        // Load JSGeneratorModule
        const jsGenModule = await JSGeneratorModule.create(resourceManager);
        const tools = jsGenModule.getTools();
        const metadata = jsGenModule.getMetadata();
        
        console.log(`\n📋 JSGeneratorModule loaded:`);
        console.log(`   Name: ${metadata.name}`);
        console.log(`   Version: ${metadata.version}`);
        console.log(`   Tools: ${tools.length}`);
        
        // Register the module
        console.log('\n📦 Registering module...');
        
        const moduleData = {
            name: 'JSGenerator',
            type: 'class',
            path: 'packages/code-gen/js-generator/src',
            className: 'JSGeneratorModule',
            version: metadata.version,
            description: metadata.description,
            author: metadata.author,
            created: new Date(),
            updated: new Date()
        };
        
        // Check if module exists
        const existingModules = await provider.listModules({ limit: 200 });
        const existingModule = existingModules.find(m => m.name === 'JSGenerator');
        
        if (existingModule) {
            console.log('   Module already exists, updating...');
            // Update module with $set operator
            await provider.databaseService.mongoProvider.update(
                'modules',
                { name: 'JSGenerator' },
                { $set: moduleData }
            );
        } else {
            console.log('   Creating new module...');
            // Insert module
            await provider.databaseService.mongoProvider.insert('modules', moduleData);
        }
        
        console.log('✅ Module registered');
        
        // Register each tool
        console.log('\n🔧 Registering tools...\n');
        
        for (const tool of tools) {
            console.log(`   Registering: ${tool.name}`);
            
            // Extract plain object schemas from Zod objects if present
            let inputSchema = {};
            let outputSchema = {};
            
            if (tool.inputSchema) {
                // If it's a Zod object, extract the _def.shape
                if (tool.inputSchema._def && tool.inputSchema._def.shape) {
                    // Convert Zod schema to plain object representation
                    const shape = tool.inputSchema._def.shape;
                    inputSchema = {
                        type: 'object',
                        properties: {}
                    };
                    for (const [key, zodType] of Object.entries(shape)) {
                        inputSchema.properties[key] = extractZodTypeInfo(zodType);
                    }
                } else if (typeof tool.inputSchema === 'object') {
                    // Already a plain object
                    inputSchema = tool.inputSchema;
                }
            }
            
            if (tool.outputSchema) {
                // If it's a Zod object, extract the _def.shape
                if (tool.outputSchema._def && tool.outputSchema._def.shape) {
                    // Convert Zod schema to plain object representation
                    const shape = tool.outputSchema._def.shape;
                    outputSchema = {
                        type: 'object',
                        properties: {}
                    };
                    for (const [key, zodType] of Object.entries(shape)) {
                        outputSchema.properties[key] = extractZodTypeInfo(zodType);
                    }
                } else if (typeof tool.outputSchema === 'object') {
                    // Already a plain object
                    outputSchema = tool.outputSchema;
                }
            }
            
            const toolData = {
                name: tool.name,
                moduleName: 'JSGenerator',
                moduleId: 'JSGenerator',
                description: tool.description || '',
                category: tool.category || 'code-generation',
                inputSchema: inputSchema,
                outputSchema: outputSchema,
                examples: tool.examples || [],
                tags: tool.tags || ['javascript', 'code-generation', 'development'],
                created: new Date(),
                updated: new Date()
            };
            
            // Check if tool exists using direct database query
            const existingTool = await provider.databaseService.mongoProvider.findOne(
                'tools',
                { name: tool.name }
            );
            
            if (existingTool) {
                console.log(`     Tool exists, updating...`);
                // Update tool with $set operator
                await provider.databaseService.mongoProvider.update(
                    'tools',
                    { name: tool.name },
                    { $set: toolData }
                );
            } else {
                console.log(`     Creating new tool...`);
                // Insert tool
                await provider.databaseService.mongoProvider.insert('tools', toolData);
            }
        }
        
        console.log('\n✅ All tools registered');
        
        // Verify registration
        console.log('\n📊 Verifying registration...\n');
        
        const verifyModule = await provider.listModules({ limit: 200 });
        const jsGen = verifyModule.find(m => m.name === 'JSGenerator');
        
        if (jsGen) {
            console.log('✅ Module verified in database');
        } else {
            console.log('❌ Module not found after registration');
        }
        
        const verifyTools = await provider.listTools({ moduleName: 'JSGenerator', limit: 20 });
        console.log(`✅ ${verifyTools.length} tools verified in database:`);
        
        for (const tool of verifyTools) {
            console.log(`   - ${tool.name}`);
        }
        
        // Show sample tool details
        if (verifyTools.length > 0) {
            console.log('\n📝 Sample tool details:');
            const sampleTool = verifyTools[0];
            console.log(`   Name: ${sampleTool.name}`);
            console.log(`   Module: ${sampleTool.moduleName}`);
            console.log(`   Description: ${sampleTool.description}`);
            console.log(`   Has input schema: ${Object.keys(sampleTool.inputSchema || {}).length > 0}`);
            console.log(`   Has output schema: ${Object.keys(sampleTool.outputSchema || {}).length > 0}`);
        }
        
        await provider.disconnect();
        
    } catch (error) {
        console.error('\n❌ Registration failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the registration
registerJSGeneratorModule()
    .then(() => {
        console.log('\n✅ JSGeneratorModule registration complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Registration failed:', error);
        process.exit(1);
    });