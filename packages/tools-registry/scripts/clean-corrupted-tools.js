/**
 * Database cleanup script - Remove tools with invalid moduleId
 * This script removes all tools that have moduleId: "NO_MODULE_ID" 
 * which should never have been written to the database
 */

import { MongoClient } from 'mongodb';

async function cleanCorruptedTools() {
  console.log('🧹 Starting database cleanup - removing corrupted tools...');
  
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('legion-tools');
    const toolsCollection = db.collection('tools');
    
    // Find all tools with NO_MODULE_ID
    const corruptedTools = await toolsCollection.find({ 
      $or: [
        { moduleId: "NO_MODULE_ID" },
        { moduleId: null },
        { moduleId: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`📊 Found ${corruptedTools.length} corrupted tools with invalid moduleId`);
    
    if (corruptedTools.length > 0) {
      // Show what will be deleted
      console.log('\n🗑️ Tools to be deleted:');
      corruptedTools.forEach(tool => {
        console.log(`- ${tool.name} (module: ${tool.moduleName}, moduleId: ${tool.moduleId})`);
      });
      
      // Delete the corrupted tools
      const deleteResult = await toolsCollection.deleteMany({ 
        $or: [
          { moduleId: "NO_MODULE_ID" },
          { moduleId: null },
          { moduleId: { $exists: false } }
        ]
      });
      
      console.log(`\n✅ Deleted ${deleteResult.deletedCount} corrupted tools`);
    } else {
      console.log('✅ No corrupted tools found - database is clean');
    }
    
    // Verify the cleanup
    const remainingCorrupted = await toolsCollection.countDocuments({ 
      $or: [
        { moduleId: "NO_MODULE_ID" },
        { moduleId: null },
        { moduleId: { $exists: false } }
      ]
    });
    
    if (remainingCorrupted > 0) {
      throw new Error(`Cleanup failed - ${remainingCorrupted} corrupted tools still exist`);
    }
    
    console.log('🎉 Database cleanup completed successfully');
    
    // Show remaining tools count
    const totalTools = await toolsCollection.countDocuments({});
    console.log(`📊 Total tools remaining: ${totalTools}`);
    
    await client.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    await client.close();
    process.exit(1);
  }
}

cleanCorruptedTools();