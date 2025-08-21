/**
 * Debug script to check database state for calculator module
 */

import { MongoClient } from 'mongodb';
import { ResourceManager } from '@legion/resource-manager';

async function checkDatabaseState() {
  console.log('🔍 CHECKING DATABASE STATE FOR CALCULATOR MODULE\n');
  
  const rm = ResourceManager.getInstance();
  await rm.initialize();

  const mongoUrl = rm.get('env.MONGODB_URL');
  const dbName = rm.get('env.TOOLS_DATABASE_NAME') || rm.get('env.MONGODB_DATABASE');

  console.log('📋 Database Configuration:');
  console.log('  MongoDB URL:', mongoUrl);
  console.log('  Database:', dbName);

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const db = client.db(dbName);

  console.log('\n📋 Checking calculator module in module_registry:');
  const calcModule = await db.collection('module_registry').findOne({ name: 'calculator' });
  if (calcModule) {
    console.log('  ✅ Calculator EXISTS in module_registry');
    console.log('  Path:', calcModule.path);
    console.log('  Type:', calcModule.type);
  } else {
    console.log('  ❌ Calculator NOT FOUND in module_registry');
  }

  console.log('\n📋 Checking calculator module in modules collection:');
  const calcModuleInModules = await db.collection('modules').findOne({ name: 'calculator' });
  if (calcModuleInModules) {
    console.log('  ✅ Calculator EXISTS in modules');
    console.log('  Path:', calcModuleInModules.path);
    console.log('  Type:', calcModuleInModules.type);
  } else {
    console.log('  ❌ Calculator NOT FOUND in modules');
  }

  if (!calcModule) {
    console.log('\n📋 Available modules in module_registry:');
    const allModules = await db.collection('module_registry').find({}).limit(10).toArray();
    console.log('  Found', allModules.length, 'modules:');
    allModules.forEach(m => console.log('   -', m.name));
  }

  console.log('\n📋 Checking calculator tools:');
  const calcTools = await db.collection('tools').find({ moduleName: 'calculator' }).toArray();
  console.log('  Calculator tools found:', calcTools.length);
  if (calcTools.length > 0) {
    calcTools.forEach(t => console.log('   -', t.name, ':', t.description?.substring(0, 50) + '...'));
  }

  await client.close();
  
  if (!calcModule) {
    console.log('\n⚠️  ISSUE IDENTIFIED: Calculator module is missing from module_registry');
    console.log('    This is why the integration tests are failing.');
    console.log('    The tests expect calculator module to be pre-populated in module_registry.');
    console.log('    Run module discovery to populate module_registry before running tests.');
  }
}

checkDatabaseState().catch(console.error);