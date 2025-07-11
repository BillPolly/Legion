const ToolAdapter = require('./tools/ToolAdapter');
const fs = require('fs').promises;
const path = require('path');

// Import tools for edge case testing
const { fileWriterTool } = require('./src/tools/file-writer');
const { serverStarterTool } = require('./src/tools/server-starter');
const { googleSearchTool } = require('./src/tools/serper');
const { pageScreenshotTool } = require('./src/tools/page-screenshoter');

async function testEdgeCases() {
  console.log('Tool Adapter Edge Case Testing');
  console.log('==============================\n');

  const results = [];

  // Test 1: Multiple functions - only first is exposed
  console.log('Test 1: Multiple Functions Issue');
  console.log('---------------------------------');
  try {
    const fileWriterAdapter = new ToolAdapter(fileWriterTool);
    const description = fileWriterAdapter.getToolDescription();
    
    console.log('File Writer tool has functions:', fileWriterTool.functions.map(f => f.name));
    console.log('Adapter exposes:', description.function.name);
    
    // Try to call the second function (should fail)
    const createDirCall = {
      id: 'test_1',
      type: 'function',
      function: {
        name: 'file_reader_tool_createDirectory',
        arguments: JSON.stringify({ dirPath: './test-dir-edge' })
      }
    };
    
    const result = await fileWriterAdapter.invoke(createDirCall);
    console.log('Result:', result);
    
    results.push({
      test: 'Multiple functions - second function',
      status: result.content.includes('error') ? 'Expected failure' : 'Unexpected success',
      details: result.content
    });
  } catch (error) {
    results.push({
      test: 'Multiple functions',
      status: 'Error',
      error: error.message
    });
  }

  // Test 2: No arguments function
  console.log('\n\nTest 2: No Arguments Function');
  console.log('-----------------------------');
  try {
    const serverAdapter = new ToolAdapter(serverStarterTool);
    
    // readServerOutput has no arguments
    const noArgsCall = {
      id: 'test_2',
      type: 'function',
      function: {
        name: 'server-starter-tool_readServerOutput',
        arguments: '{}'  // Empty object
      }
    };
    
    const result = await serverAdapter.invoke(noArgsCall);
    console.log('Empty args object result:', result.content.substring(0, 100));
    
    // Try with null arguments
    const nullArgsCall = {
      id: 'test_3',
      type: 'function',
      function: {
        name: 'server-starter-tool_readServerOutput',
        arguments: null
      }
    };
    
    try {
      const nullResult = await serverAdapter.invoke(nullArgsCall);
      results.push({
        test: 'No arguments - null',
        status: 'Success',
        details: 'Handled null arguments'
      });
    } catch (error) {
      results.push({
        test: 'No arguments - null',
        status: 'Error',
        error: error.message
      });
    }
    
    results.push({
      test: 'No arguments - empty object',
      status: 'Success',
      details: 'Handled empty arguments object'
    });
  } catch (error) {
    results.push({
      test: 'No arguments',
      status: 'Error',
      error: error.message
    });
  }

  // Test 3: Tool requiring initialization
  console.log('\n\nTest 3: Tool Requiring Initialization');
  console.log('-------------------------------------');
  try {
    const searchAdapter = new ToolAdapter(googleSearchTool);
    
    // Try without initialization
    const searchCall = {
      id: 'test_4',
      type: 'function',
      function: {
        name: 'google-search-tool_search',
        arguments: JSON.stringify({ query: 'test', dateRange: 'week' })
      }
    };
    
    const result = await searchAdapter.invoke(searchCall);
    console.log('Without init:', result.content);
    
    results.push({
      test: 'Uninitialized tool',
      status: result.content.includes('not initialised') ? 'Expected behavior' : 'Unexpected',
      details: result.content
    });
    
    // Initialize and try again
    googleSearchTool.init({ serperApiKey: 'test-key' });
    const resultAfterInit = await searchAdapter.invoke(searchCall);
    console.log('After init (will fail with invalid key):', resultAfterInit.content.substring(0, 100));
    
    results.push({
      test: 'Initialized tool',
      status: 'Tested',
      details: 'Tool accepted initialization'
    });
  } catch (error) {
    results.push({
      test: 'Tool initialization',
      status: 'Error',
      error: error.message
    });
  }

  // Test 4: Special return types
  console.log('\n\nTest 4: Special Return Types');
  console.log('----------------------------');
  try {
    const screenshotAdapter = new ToolAdapter(pageScreenshotTool);
    
    // The screenshot tool returns an object with isImage flag
    console.log('Screenshot tool returns special object format');
    console.log('Expected: { isImage: true, image: "data:image/png;base64,..." }');
    
    results.push({
      test: 'Special return type',
      status: 'Noted',
      details: 'Screenshot tool returns object instead of string'
    });
  } catch (error) {
    results.push({
      test: 'Special return type',
      status: 'Error',
      error: error.message
    });
  }

  // Test 5: Invalid function names
  console.log('\n\nTest 5: Invalid Function Names');
  console.log('------------------------------');
  try {
    const adapter = new ToolAdapter(fileWriterTool);
    
    const invalidCall = {
      id: 'test_5',
      type: 'function',
      function: {
        name: 'file_reader_tool_nonexistent',
        arguments: '{}'
      }
    };
    
    const result = await adapter.invoke(invalidCall);
    console.log('Invalid function result:', result);
    
    results.push({
      test: 'Invalid function name',
      status: result.content.includes('not found') ? 'Proper error handling' : 'Unexpected',
      details: result.content
    });
  } catch (error) {
    results.push({
      test: 'Invalid function name',
      status: 'Error caught',
      error: error.message
    });
  }

  // Test 6: Malformed arguments
  console.log('\n\nTest 6: Malformed Arguments');
  console.log('---------------------------');
  try {
    const adapter = new ToolAdapter(fileWriterTool);
    
    // Invalid JSON
    const malformedCall = {
      id: 'test_6',
      type: 'function',
      function: {
        name: 'file_reader_tool_writeFile',
        arguments: '{ invalid json }'
      }
    };
    
    const result = await adapter.invoke(malformedCall);
    console.log('Malformed JSON result:', result);
    
    results.push({
      test: 'Malformed JSON arguments',
      status: result.content.includes('error') ? 'Proper error handling' : 'Unexpected',
      details: result.content
    });
  } catch (error) {
    results.push({
      test: 'Malformed arguments',
      status: 'Error caught',
      error: error.message
    });
  }

  // Print summary
  console.log('\n\nEDGE CASE TEST SUMMARY');
  console.log('======================');
  
  results.forEach(result => {
    console.log(`\n${result.test}:`);
    console.log(`  Status: ${result.status}`);
    if (result.details) console.log(`  Details: ${result.details}`);
    if (result.error) console.log(`  Error: ${result.error}`);
  });

  // Save results
  await fs.writeFile(
    path.join(__dirname, 'edge-case-test-results.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      results
    }, null, 2)
  );
  
  console.log('\n\nResults saved to: edge-case-test-results.json');
}

// Run tests
testEdgeCases().catch(console.error);