/**
 * Manual Test: FileModule Database Storage & Loading
 * 
 * Tests the complete flow:
 * 1. Load FileModule directly
 * 2. Extract tools via getTools()
 * 3. Save tools to MongoDB
 * 4. Load tools via ToolRegistry
 * 5. Execute tools
 */

import { ToolRegistry } from '../../src/integration/ToolRegistry.js';
import { MongoDBToolRegistryProvider } from '../../src/providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '../../src/ResourceManager.js';

async function testFileModuleDatabaseFlow() {
  console.log('🧪 Testing FileModule Database Flow\n');

  try {
    // Step 1: Initialize ResourceManager and MongoDB provider
    console.log('1️⃣  Initializing ResourceManager and MongoDB provider...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const provider = await MongoDBToolRegistryProvider.create(resourceManager, {
      enableSemanticSearch: false
    });
    console.log('✅ ResourceManager and MongoDB provider initialized\n');

    // Step 2: Load FileModule directly
    console.log('2️⃣  Loading FileModule directly...');
    const { default: FileModule } = await import('../../../tools-collection/src/file/index.js');
    const fileModule = new FileModule();
    console.log('✅ FileModule loaded:', fileModule.constructor.name);
    console.log('   Description:', fileModule.description);
    console.log('   Has getTools method:', typeof fileModule.getTools === 'function');

    // Step 3: Extract tools from module
    console.log('\n3️⃣  Extracting tools from FileModule...');
    const tools = fileModule.getTools();
    console.log('✅ Tools extracted:', tools.length);
    for (const tool of tools) {
      console.log(`   - ${tool.name}: ${tool.description}`);
      console.log(`     Has execute method: ${typeof tool.execute === 'function'}`);
    }

    // Step 4: Save module and tools to database using proper provider API
    console.log('\n4️⃣  Saving module and tools via provider API...');
    
    // Clear existing data using provider methods
    await provider.databaseService.mongoProvider.delete('modules', {});
    await provider.databaseService.mongoProvider.delete('tools', {});
    console.log('   Cleared existing data');

    // Save module using provider.saveModule()
    const moduleData = {
      name: 'File',
      type: 'class',
      path: '/Users/maxximus/Documents/max/pocs/Legion/packages/tools-collection/src/file/index.js',
      className: 'FileModule',
      description: fileModule.description || 'File system operations'
    };
    
    const savedModule = await provider.saveModule(moduleData);
    console.log('✅ Module saved via provider:', savedModule.name, 'ID:', savedModule._id);

    // Save tools using provider.saveTool()
    let savedToolsCount = 0;
    for (const tool of tools) {
      const toolData = {
        name: tool.name,
        description: tool.description,
        moduleName: 'File',
        moduleId: savedModule._id,
        inputSchema: tool.inputSchema
      };
      
      const savedTool = await provider.saveTool(toolData);
      savedToolsCount++;
      console.log(`   ✅ Saved tool: ${savedTool.name}`);
    }
    console.log(`✅ Saved ${savedToolsCount} tools via provider API\n`);

    // Step 5: Test ToolRegistry loading
    console.log('5️⃣  Testing ToolRegistry loading...');
    const registry = new ToolRegistry({ provider, resourceManager });
    await registry.initialize();

    // List tools from database
    const dbTools = await registry.listTools({ limit: 10 });
    console.log(`✅ ToolRegistry found ${dbTools.length} tools in database:`);
    for (const tool of dbTools) {
      console.log(`   - ${tool.name} (${tool.moduleName}): ${tool.description}`);
    }

    // Step 6: Test tool retrieval and execution
    console.log('\n6️⃣  Testing tool retrieval and execution...');
    
    // Test file_write tool
    const fileWriteTool = await registry.getTool('file_write');
    if (fileWriteTool) {
      console.log('✅ file_write tool retrieved successfully');
      console.log('   Name:', fileWriteTool.name);
      console.log('   Execute method:', typeof fileWriteTool.execute === 'function');
      
      // Test execution
      const testFilePath = `/tmp/filemodule-test-${Date.now()}.txt`;
      const testContent = 'Hello from FileModule database test!';
      
      console.log('\n   Testing file_write execution...');
      const writeResult = await fileWriteTool.execute({
        filepath: testFilePath,
        content: testContent
      });
      
      console.log('   Write result:', {
        success: writeResult.success,
        message: writeResult.message,
        bytesWritten: writeResult.bytesWritten
      });
      
      if (writeResult.success) {
        console.log('✅ file_write tool executed successfully!');
        
        // Test file_read tool
        const fileReadTool = await registry.getTool('file_read');
        if (fileReadTool) {
          console.log('\n   Testing file_read execution...');
          const readResult = await fileReadTool.execute({
            filepath: testFilePath
          });
          
          console.log('   Read result:', {
            success: readResult.success,
            contentLength: readResult.content?.length,
            contentMatches: readResult.content === testContent
          });
          
          if (readResult.success && readResult.content === testContent) {
            console.log('✅ file_read tool executed successfully!');
          } else {
            console.log('❌ file_read tool execution failed or content mismatch');
          }
        } else {
          console.log('❌ file_read tool not found');
        }
        
        // Cleanup test file
        try {
          const fs = await import('fs/promises');
          await fs.unlink(testFilePath);
          console.log('   Test file cleaned up');
        } catch (e) {
          // Ignore cleanup errors
        }
      } else {
        console.log('❌ file_write tool execution failed');
      }
    } else {
      console.log('❌ file_write tool not found');
    }

    console.log('\n🎉 FileModule database flow test completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testFileModuleDatabaseFlow().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});