#!/usr/bin/env node

/**
 * Check JSGeneratorModule tools in database and verify their schemas
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';
import { JSGeneratorModule } from '../../../code-gen/js-generator/src/JSGeneratorModule.js';

async function checkJSGenToolsInDB() {
    console.log('🔍 Checking JSGeneratorModule Tools in Database\n');
    console.log('=' + '='.repeat(60));

    try {
        // Initialize ResourceManager
        const resourceManager = await ResourceManager.getResourceManager();
        
        // Create provider
        const provider = await MongoDBToolRegistryProvider.create(
            resourceManager,
            { enableSemanticSearch: false }
        );
        
        // Load JSGeneratorModule to get the expected tools
        const jsGenModule = await JSGeneratorModule.create(resourceManager);
        const expectedTools = jsGenModule.getTools();
        
        console.log(`\n📋 Expected ${expectedTools.length} tools from JSGeneratorModule:\n`);
        
        // Check each tool
        for (const expectedTool of expectedTools) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🔧 Tool: ${expectedTool.name}`);
            console.log(`${'='.repeat(60)}`);
            
            // Look up in database
            const dbTools = await provider.listTools({ 
                toolName: expectedTool.name,
                limit: 1 
            });
            
            if (dbTools.length === 0) {
                console.log('❌ NOT FOUND IN DATABASE');
                continue;
            }
            
            const dbTool = dbTools[0];
            console.log('✅ Found in database');
            console.log(`   Module: ${dbTool.moduleName}`);
            
            // Compare descriptions
            console.log('\n📝 Description:');
            console.log('   Expected:', expectedTool.description);
            console.log('   Database:', dbTool.description);
            console.log('   Match:', expectedTool.description === dbTool.description ? '✅' : '❌');
            
            // Check input schema
            console.log('\n📥 Input Schema:');
            if (expectedTool.inputSchema) {
                console.log('   Expected schema properties:');
                const expectedProps = expectedTool.inputSchema.properties || {};
                for (const [key, value] of Object.entries(expectedProps)) {
                    console.log(`     - ${key}: ${value.type}${value.description ? ` (${value.description})` : ''}`);
                }
            } else {
                console.log('   Expected: No schema defined');
            }
            
            if (dbTool.inputSchema) {
                console.log('   Database schema properties:');
                const dbProps = dbTool.inputSchema.properties || {};
                for (const [key, value] of Object.entries(dbProps)) {
                    console.log(`     - ${key}: ${value.type}${value.description ? ` (${value.description})` : ''}`);
                }
                
                // Check if schemas match
                if (expectedTool.inputSchema) {
                    const expectedKeys = Object.keys(expectedTool.inputSchema.properties || {});
                    const dbKeys = Object.keys(dbProps);
                    const keysMatch = expectedKeys.length === dbKeys.length && 
                                     expectedKeys.every(k => dbKeys.includes(k));
                    console.log(`   Schema keys match: ${keysMatch ? '✅' : '❌'}`);
                }
            } else {
                console.log('   Database: No schema stored');
            }
            
            // Check output schema
            console.log('\n📤 Output Schema:');
            if (expectedTool.outputSchema) {
                console.log('   Expected:', JSON.stringify(expectedTool.outputSchema, null, 2).split('\n').join('\n   '));
            } else {
                console.log('   Expected: No output schema defined');
            }
            
            if (dbTool.outputSchema) {
                console.log('   Database:', JSON.stringify(dbTool.outputSchema, null, 2).split('\n').join('\n   '));
            } else {
                console.log('   Database: No output schema stored');
            }
            
            // Check examples
            console.log('\n📚 Examples:');
            if (expectedTool.examples && expectedTool.examples.length > 0) {
                console.log(`   Expected: ${expectedTool.examples.length} examples`);
                console.log('   First example:', JSON.stringify(expectedTool.examples[0], null, 2).split('\n').slice(0, 5).join('\n   '));
            } else {
                console.log('   Expected: No examples defined');
            }
            
            if (dbTool.examples && dbTool.examples.length > 0) {
                console.log(`   Database: ${dbTool.examples.length} examples`);
            } else {
                console.log('   Database: No examples stored');
            }
        }
        
        // Check if there are any extra JSGenerator tools in DB
        console.log(`\n${'='.repeat(60)}`);
        console.log('🔍 Checking for extra JSGenerator tools in database...\n');
        
        const allDbTools = await provider.listTools({ 
            moduleName: 'JSGenerator',
            limit: 20 
        });
        
        const expectedNames = expectedTools.map(t => t.name);
        const extraTools = allDbTools.filter(t => !expectedNames.includes(t.name));
        
        if (extraTools.length > 0) {
            console.log(`⚠️ Found ${extraTools.length} extra tools in database:`);
            for (const tool of extraTools) {
                console.log(`   - ${tool.name}`);
            }
        } else {
            console.log('✅ No extra tools found');
        }
        
        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Summary:');
        console.log(`   Expected tools: ${expectedTools.length}`);
        console.log(`   Found in database: ${allDbTools.length}`);
        console.log(`   Module name in DB: JSGenerator`);
        
        // Check schema completeness
        let schemasComplete = 0;
        let schemasMissing = 0;
        
        for (const tool of allDbTools) {
            if (tool.inputSchema && Object.keys(tool.inputSchema).length > 0) {
                schemasComplete++;
            } else {
                schemasMissing++;
                console.log(`   ⚠️ Missing schema: ${tool.name}`);
            }
        }
        
        console.log(`\n   Tools with input schemas: ${schemasComplete}`);
        console.log(`   Tools missing schemas: ${schemasMissing}`);
        
        await provider.disconnect();
        
    } catch (error) {
        console.error('\n❌ Check failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the check
checkJSGenToolsInDB()
    .then(() => {
        console.log('\n✅ Database check complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Check failed:', error);
        process.exit(1);
    });