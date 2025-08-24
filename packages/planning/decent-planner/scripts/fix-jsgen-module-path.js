#!/usr/bin/env node

/**
 * Fix JSGenerator module path in database to enable proper loading
 */

import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from '@legion/tools-registry/src/providers/MongoDBToolRegistryProvider.js';

async function fixJSGeneratorModulePath() {
    console.log('🔧 Fixing JSGenerator module path in database\n');
    console.log('=' + '='.repeat(60));

    try {
        // Initialize ResourceManager
        const resourceManager = await ResourceManager.getResourceManager();
        
        // Create provider
        const provider = await MongoDBToolRegistryProvider.create(
            resourceManager,
            { enableSemanticSearch: false }
        );
        
        // Check current module state
        console.log('\n📋 Current JSGenerator module state:');
        const currentModule = await provider.databaseService.mongoProvider.findOne(
            'modules',
            { name: 'JSGenerator' }
        );
        
        if (!currentModule) {
            console.log('❌ JSGenerator module not found in database');
            await provider.disconnect();
            return;
        }
        
        console.log(`   Name: ${currentModule.name}`);
        console.log(`   Current path: ${currentModule.path}`);
        console.log(`   Type: ${currentModule.type}`);
        console.log(`   ClassName: ${currentModule.className}`);
        
        // Update with correct path - use relative path that works with ModuleLoader
        const correctPath = 'packages/code-gen/js-generator';
        
        console.log('\n🔧 Updating module path...');
        console.log(`   New path: ${correctPath}`);
        
        const updateResult = await provider.databaseService.mongoProvider.update(
            'modules',
            { name: 'JSGenerator' },
            { 
                $set: { 
                    path: correctPath,
                    updated: new Date()
                } 
            }
        );
        
        console.log('✅ Module path updated');
        console.log(`   Modified count: ${updateResult.modifiedCount}`);
        
        // Verify the update
        console.log('\n📋 Verifying updated module state:');
        const updatedModule = await provider.databaseService.mongoProvider.findOne(
            'modules',
            { name: 'JSGenerator' }
        );
        
        console.log(`   Name: ${updatedModule.name}`);
        console.log(`   Updated path: ${updatedModule.path}`);
        console.log(`   Last updated: ${updatedModule.updated}`);
        
        await provider.disconnect();
        
        console.log('\n✅ JSGenerator module path fix complete!');
        
    } catch (error) {
        console.error('\n❌ Fix failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the fix
fixJSGeneratorModulePath()
    .then(() => {
        console.log('\n✅ Module path fix successful!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fix failed:', error);
        process.exit(1);
    });