import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';

const rm = ResourceManager.getInstance();
await rm.initialize();

const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });

// Get the module that is failing
const failedModule = await provider.databaseService.mongoProvider.findOne('module_registry', { 
  name: 'DynamicJson' 
});

console.log('DynamicJson module from registry:');
console.log(JSON.stringify(failedModule, null, 2));

// Check if it exists in modules collection
const existingModule = await provider.databaseService.mongoProvider.findOne('modules', {
  _id: failedModule._id
});

console.log('\nExisting in modules collection:', !!existingModule);

// Check what validation error we would get
if (!existingModule && failedModule) {
  console.log('\nTrying to create document with type:', failedModule.type);
  console.log('Module type mapping would be:', failedModule.type === 'json' ? 'module.json' : (failedModule.type || 'class'));
}

await provider.disconnect();