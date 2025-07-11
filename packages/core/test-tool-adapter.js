const ToolAdapter = require('./tools/ToolAdapter');
const fs = require('fs').promises;
const path = require('path');

// Import all tools
const { calculatorTool } = require('./src/tools/calculator');
const { bashExecutorTool } = require('./src/tools/command-executor');
const { crawlerTool } = require('./src/tools/crawler');
const { fileReaderTool } = require('./src/tools/file-reader');
const { fileWriterTool } = require('./src/tools/file-writer');
const { pageScreenshotTool } = require('./src/tools/page-screenshoter');
const { googleSearchTool } = require('./src/tools/serper');
const { serverStarterTool } = require('./src/tools/server-starter');
const { webPageToMarkdownTool } = require('./src/tools/webpage-to-markdown');
const { youtubeTranscriptTool } = require('./src/tools/youtube-transcript');

// Test data structure
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper to test a tool
async function testTool(toolName, tool, testCases) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${toolName}`);
  console.log('='.repeat(60));

  try {
    // Create adapter
    const adapter = new ToolAdapter(tool);
    
    // Test tool description
    console.log('\n1. Tool Description Generation:');
    const description = adapter.getToolDescription();
    console.log(JSON.stringify(description, null, 2));
    
    // Check for multiple functions
    if (tool.functions.length > 1) {
      testResults.warnings.push({
        tool: toolName,
        issue: 'Multiple functions detected',
        functions: tool.functions.map(f => f.name),
        note: 'Current adapter returns only the first function'
      });
    }

    // Test each test case
    for (const testCase of testCases) {
      console.log(`\n2. Testing function: ${testCase.functionName}`);
      
      try {
        // Create OpenAI-style call
        const toolCall = {
          id: `test_${Date.now()}`,
          type: 'function',
          function: {
            name: `${tool.identifier}_${testCase.functionName}`,
            arguments: JSON.stringify(testCase.args)
          }
        };
        
        console.log('Tool Call:', JSON.stringify(toolCall, null, 2));
        
        // Invoke through adapter
        const result = await adapter.invoke(toolCall);
        console.log('Result:', JSON.stringify(result, null, 2));
        
        // Check if successful
        if (result.content && !result.content.includes('error')) {
          testResults.passed.push({
            tool: toolName,
            function: testCase.functionName,
            test: testCase.description
          });
        } else {
          testResults.failed.push({
            tool: toolName,
            function: testCase.functionName,
            test: testCase.description,
            error: result.content
          });
        }
      } catch (error) {
        testResults.failed.push({
          tool: toolName,
          function: testCase.functionName,
          test: testCase.description,
          error: error.message
        });
        console.error('Error:', error.message);
      }
    }

    // Check for special cases
    checkSpecialCases(toolName, tool);
    
  } catch (error) {
    testResults.failed.push({
      tool: toolName,
      error: `Adapter creation failed: ${error.message}`
    });
    console.error('Fatal error:', error);
  }
}

// Check for special cases and edge cases
function checkSpecialCases(toolName, tool) {
  // Check for complex argument types
  tool.functions.forEach(func => {
    func.arguments.forEach(arg => {
      if (arg.dataType === 'array' || arg.dataType === 'object') {
        testResults.warnings.push({
          tool: toolName,
          function: func.name,
          issue: 'Complex argument type',
          argName: arg.name,
          argType: arg.dataType
        });
      }
    });
  });

  // Check for optional arguments (those without explicit required flag)
  tool.functions.forEach(func => {
    if (func.arguments.some(arg => arg.optional || arg.description.includes('optional'))) {
      testResults.warnings.push({
        tool: toolName,
        function: func.name,
        issue: 'Optional arguments detected',
        note: 'Current adapter marks all arguments as required'
      });
    }
  });

  // Check for special return types
  if (toolName === 'page-screenshoter') {
    testResults.warnings.push({
      tool: toolName,
      issue: 'Special return type',
      note: 'Returns object with isImage flag and base64 data'
    });
  }

  // Check for tools requiring initialization
  if (tool.init) {
    testResults.warnings.push({
      tool: toolName,
      issue: 'Requires initialization',
      note: 'Tool has init() method that needs to be called'
    });
  }
}

// Main test runner
async function runTests() {
  console.log('Tool Adapter Comprehensive Test Suite');
  console.log('=====================================\n');

  // Create test file for file operations
  const testFilePath = path.join(__dirname, 'test-file.txt');
  await fs.writeFile(testFilePath, 'Test content for file operations');

  // Define test cases for each tool
  const toolTests = [
    {
      name: 'Calculator',
      tool: calculatorTool,
      tests: [
        {
          functionName: 'evaluate',
          args: { expression: '42 * 10' },
          description: 'Simple arithmetic'
        }
      ]
    },
    {
      name: 'Bash Executor',
      tool: bashExecutorTool,
      tests: [
        {
          functionName: 'execute',
          args: { command: 'echo "Hello from bash"' },
          description: 'Simple echo command'
        }
      ]
    },
    {
      name: 'File Reader',
      tool: fileReaderTool,
      tests: [
        {
          functionName: 'read',
          args: { filePath: testFilePath },
          description: 'Read test file'
        }
      ]
    },
    {
      name: 'File Writer',
      tool: fileWriterTool,
      tests: [
        {
          functionName: 'writeFile',
          args: { 
            fileName: path.join(__dirname, 'test-output.txt'),
            content: 'Test output from adapter'
          },
          description: 'Write to file'
        },
        {
          functionName: 'createDirectory',
          args: { dirPath: path.join(__dirname, 'test-dir') },
          description: 'Create directory'
        }
      ]
    },
    {
      name: 'Crawler',
      tool: crawlerTool,
      tests: [
        {
          functionName: 'crawl',
          args: { 
            url: 'https://example.com',
            maxChars: 500
          },
          description: 'Crawl with maxChars parameter'
        }
      ]
    },
    {
      name: 'Web Page to Markdown',
      tool: webPageToMarkdownTool,
      tests: [
        {
          functionName: 'convertToMarkdown',
          args: { 
            url: 'https://example.com',
            maxChars: 1000
          },
          description: 'Convert page to markdown'
        }
      ]
    },
    {
      name: 'YouTube Transcript',
      tool: youtubeTranscriptTool,
      tests: [
        {
          functionName: 'fetchTranscript',
          args: { videoId: 'dQw4w9WgXcQ' },
          description: 'Fetch transcript (may fail without valid video)'
        }
      ]
    },
    {
      name: 'Page Screenshot',
      tool: pageScreenshotTool,
      tests: [
        {
          functionName: 'screenshot',
          args: { 
            url: 'https://example.com',
            path: path.join(__dirname, 'test-screenshot.png')
          },
          description: 'Take screenshot of page'
        }
      ]
    },
    {
      name: 'Google Search (Serper)',
      tool: googleSearchTool,
      tests: [
        {
          functionName: 'search',
          args: { 
            query: 'test query',
            dateRange: 'week'
          },
          description: 'Search with date range (requires API key)'
        }
      ]
    },
    {
      name: 'Server Starter',
      tool: serverStarterTool,
      tests: [
        {
          functionName: 'readServerOutput',
          args: {},
          description: 'Read server output (no args)'
        }
      ]
    }
  ];

  // Run tests for each tool
  for (const toolTest of toolTests) {
    await testTool(toolTest.name, toolTest.tool, toolTest.tests);
  }

  // Clean up test files
  try {
    await fs.unlink(testFilePath);
    await fs.unlink(path.join(__dirname, 'test-output.txt'));
    await fs.rmdir(path.join(__dirname, 'test-dir'));
    await fs.unlink(path.join(__dirname, 'test-screenshot.png'));
  } catch (e) {
    // Ignore cleanup errors
  }

  // Print summary
  console.log('\n\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`\nPassed: ${testResults.passed.length}`);
  testResults.passed.forEach(t => {
    console.log(`  ✓ ${t.tool} - ${t.function}: ${t.test}`);
  });
  
  console.log(`\nFailed: ${testResults.failed.length}`);
  testResults.failed.forEach(t => {
    console.log(`  ✗ ${t.tool} - ${t.function || 'N/A'}: ${t.test || t.error}`);
  });
  
  console.log(`\nWarnings: ${testResults.warnings.length}`);
  testResults.warnings.forEach(w => {
    console.log(`  ⚠ ${w.tool} - ${w.issue}: ${w.note || ''}`);
    if (w.functions) console.log(`    Functions: ${w.functions.join(', ')}`);
    if (w.argName) console.log(`    Argument: ${w.argName} (${w.argType})`);
  });

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: toolTests.length,
      passed: testResults.passed.length,
      failed: testResults.failed.length,
      warnings: testResults.warnings.length
    },
    details: testResults
  };

  await fs.writeFile(
    path.join(__dirname, 'tool-adapter-test-report.json'),
    JSON.stringify(report, null, 2)
  );
  console.log('\nDetailed report saved to: tool-adapter-test-report.json');
}

// Run the tests
runTests().catch(console.error);