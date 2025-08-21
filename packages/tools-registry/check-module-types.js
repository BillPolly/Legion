import { ResourceManager } from '@legion/resource-manager';
import { MongoDBToolRegistryProvider } from './src/providers/MongoDBToolRegistryProvider.js';

const rm = ResourceManager.getInstance();
await rm.initialize();

const provider = await MongoDBToolRegistryProvider.create(rm, { enableSemanticSearch: false });

// Check module_registry for all module types
const modules = await provider.databaseService.mongoProvider.find('module_registry', {});
const types = new Set();
modules.forEach(m => types.add(m.type));

console.log('Module types in module_registry:', Array.from(types));

// Check modules collection for any bad types
const modulesCol = await provider.databaseService.mongoProvider.find('modules', {});
const moduleTypes = new Set();
modulesCol.forEach(m => moduleTypes.add(m.type));

console.log('Module types in modules collection:', Array.from(moduleTypes));

// Find modules with unexpected types
const validTypes = ['class', 'json', 'function'];
const badModules = modulesCol.filter(m => !validTypes.includes(m.type));

if (badModules.length > 0) {
  console.log('\nModules with invalid types:');
  badModules.forEach(m => console.log('  -', m.name, ':', m.type));
}

await provider.disconnect();