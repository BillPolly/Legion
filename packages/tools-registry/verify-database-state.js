import { ResourceManager } from '@legion/resource-manager';
import { StorageProvider } from '@legion/storage';

async function verifyDatabaseState() {
  console.log('🔍 Verifying current database state...\n');
  
  const resourceManager = ResourceManager.getInstance();
  await resourceManager.initialize();
  
  const storageProvider = await StorageProvider.create(resourceManager);
  const mongoProvider = storageProvider.getProvider('mongodb');
  const db = mongoProvider.db;
  
  // Check all relevant collections
  const collections = ['modules', 'module_registry', 'tools', 'tool_perspectives', 'pipeline_state'];
  
  console.log('📊 Current database counts:');
  for (const collection of collections) {
    const count = await db.collection(collection).countDocuments();
    console.log(`  - ${collection}: ${count}`);
  }
  
  // Check for duplicate modules specifically
  console.log('\n🔍 Checking for duplicate modules...');
  const modules = await db.collection('modules').find({}).toArray();
  const moduleNames = {};
  
  for (const module of modules) {
    const key = `${module.name}-${module.className}-${module.path}`;
    if (!moduleNames[key]) {
      moduleNames[key] = [];
    }
    moduleNames[key].push(module._id);
  }
  
  let hasDuplicates = false;
  for (const [key, ids] of Object.entries(moduleNames)) {
    if (ids.length > 1) {
      console.log(`  ⚠️ DUPLICATE: ${key} has ${ids.length} entries`);
      hasDuplicates = true;
    }
  }
  
  if (!hasDuplicates) {
    console.log('  ✅ No duplicates found');
  }
  
  // Check unique module names
  const uniqueModules = await db.collection('modules').distinct('name');
  console.log(`\n📦 Unique module names in database: ${uniqueModules.length}`);
  if (uniqueModules.length > 0 && uniqueModules.length <= 10) {
    console.log('  Names:', uniqueModules.join(', '));
  }
  
  await mongoProvider.disconnect();
  
  // Final assessment
  console.log('\n🎯 Database State Assessment:');
  if (modules.length === 0) {
    console.log('  ✅ Database is clean (empty)');
  } else if (modules.length <= 10 && !hasDuplicates) {
    console.log('  ✅ Database appears healthy (no corruption)');
  } else if (modules.length > 100) {
    console.log('  ❌ DATABASE CORRUPTED - Too many modules:', modules.length);
    console.log('  ⚠️  Need to clean the database!');
  } else if (hasDuplicates) {
    console.log('  ⚠️ Database has duplicates - needs cleaning');
  }
  
  return {
    healthy: modules.length <= 10 && !hasDuplicates,
    moduleCount: modules.length,
    hasDuplicates
  };
}

verifyDatabaseState().catch(console.error);