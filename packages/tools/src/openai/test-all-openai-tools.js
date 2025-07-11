/**
 * Comprehensive test suite for all OpenAI-compatible tools
 */

const { openAITools, getAllToolDescriptions, invokeByFunctionName } = require('./index');
const fs = require('fs').promises;
const path = require('path');

// Color output helpers
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Test results tracking
let passedTests = 0;
let failedTests = 0;

async function testTool(toolName, tool, tests) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Testing: ${toolName}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  // Test tool description
  try {
    const desc = tool.getToolDescription();
    log.success(`Tool description is valid: ${desc.function.name}`);
    passedTests++;
  } catch (error) {
    log.error(`Failed to get tool description: ${error.message}`);
    failedTests++;
  }
  
  // Run specific tests
  for (const test of tests) {
    try {
      console.log(`\n${colors.yellow}Test: ${test.name}${colors.reset}`);
      const result = await tool.invoke(test.call);
      
      if (result.content.includes('error')) {
        const content = JSON.parse(result.content);
        if (test.expectError) {
          log.success(`Expected error received: ${content.error}`);
          passedTests++;
        } else {
          log.error(`Unexpected error: ${content.error}`);
          failedTests++;
        }
      } else {
        if (test.validate) {
          if (test.validate(result)) {
            log.success(`Test passed: ${test.name}`);
            passedTests++;
          } else {
            log.error(`Validation failed: ${test.name}`);
            failedTests++;
          }
        } else {
          log.success(`Test completed: ${test.name}`);
          passedTests++;
        }
      }
      
      if (test.showResult) {
        console.log('Result:', JSON.stringify(JSON.parse(result.content), null, 2));
      }
    } catch (error) {
      log.error(`Test failed with exception: ${error.message}`);
      failedTests++;
    }
  }
}

async function runAllTests() {
  console.log(`${colors.blue}OpenAI Tools Comprehensive Test Suite${colors.reset}\n`);
  
  // Test 1: Calculator
  await testTool('Calculator', openAITools.calculator, [
    {
      name: 'Simple calculation',
      call: {
        id: 'calc_1',
        type: 'function',
        function: {
          name: 'calculator_evaluate',
          arguments: JSON.stringify({ expression: '2 + 2' })
        }
      },
      validate: (result) => JSON.parse(result.content).result === 4,
      showResult: true
    },
    {
      name: 'Complex calculation',
      call: {
        id: 'calc_2',
        type: 'function',
        function: {
          name: 'calculator_evaluate',
          arguments: JSON.stringify({ expression: 'Math.sqrt(16) * Math.pow(2, 3)' })
        }
      },
      validate: (result) => JSON.parse(result.content).result === 32
    },
    {
      name: 'Invalid expression',
      call: {
        id: 'calc_3',
        type: 'function',
        function: {
          name: 'calculator_evaluate',
          arguments: JSON.stringify({ expression: 'invalid math' })
        }
      },
      expectError: true
    }
  ]);
  
  // Test 2: File Reader
  await testTool('File Reader', openAITools.fileReader, [
    {
      name: 'Read package.json',
      call: {
        id: 'read_1',
        type: 'function',
        function: {
          name: 'file_reader_read',
          arguments: JSON.stringify({ filepath: 'package.json' })
        }
      },
      validate: (result) => {
        const content = JSON.parse(result.content).content;
        return content.includes('"name"') && content.includes('"version"');
      }
    },
    {
      name: 'Read non-existent file',
      call: {
        id: 'read_2',
        type: 'function',
        function: {
          name: 'file_reader_read',
          arguments: JSON.stringify({ filepath: 'non-existent-file.txt' })
        }
      },
      expectError: true
    }
  ]);
  
  // Test 3: File Writer
  const testFilePath = path.join(__dirname, 'test-output.txt');
  const testDirPath = path.join(__dirname, 'test-directory');
  
  await testTool('File Writer', openAITools.fileWriter, [
    {
      name: 'Write file',
      call: {
        id: 'write_1',
        type: 'function',
        function: {
          name: 'file_writer_write_file',
          arguments: JSON.stringify({ 
            filepath: testFilePath,
            content: 'Test content from OpenAI tool test'
          })
        }
      },
      validate: async (result) => {
        const exists = await fs.access(testFilePath).then(() => true).catch(() => false);
        return exists;
      },
      showResult: true
    },
    {
      name: 'Create directory',
      call: {
        id: 'write_2',
        type: 'function',
        function: {
          name: 'file_writer_create_directory',
          arguments: JSON.stringify({ dirpath: testDirPath })
        }
      },
      validate: async (result) => {
        const exists = await fs.access(testDirPath).then(() => true).catch(() => false);
        return exists;
      }
    }
  ]);
  
  // Test 4: Command Executor
  await testTool('Command Executor', openAITools.commandExecutor, [
    {
      name: 'Execute echo command',
      call: {
        id: 'cmd_1',
        type: 'function',
        function: {
          name: 'command_executor_execute',
          arguments: JSON.stringify({ command: 'echo "Hello from OpenAI tool"' })
        }
      },
      validate: (result) => {
        const output = JSON.parse(result.content);
        return output.stdout.includes('Hello from OpenAI tool');
      },
      showResult: true
    },
    {
      name: 'Execute with timeout',
      call: {
        id: 'cmd_2',
        type: 'function',
        function: {
          name: 'command_executor_execute',
          arguments: JSON.stringify({ 
            command: 'sleep 0.1 && echo "Done"',
            timeout: 5000
          })
        }
      },
      validate: (result) => {
        const output = JSON.parse(result.content);
        return output.stdout.includes('Done');
      }
    }
  ]);
  
  // Test 5: Server Starter (basic test only)
  await testTool('Server Starter', openAITools.serverStarter, [
    {
      name: 'Tool description check',
      call: {
        id: 'server_1',
        type: 'function',
        function: {
          name: 'server_starter_read_output',
          arguments: JSON.stringify({})
        }
      },
      expectError: true // No server running
    }
  ]);
  
  // Test 6: Google Search (Serper)
  await testTool('Google Search (Serper)', openAITools.googleSearch, [
    {
      name: 'Search without API key',
      call: {
        id: 'search_1',
        type: 'function',
        function: {
          name: 'google_search_search',
          arguments: JSON.stringify({ query: 'OpenAI tools' })
        }
      },
      expectError: true
    }
  ]);
  
  // Test remaining tools with basic checks
  const basicTools = [
    { name: 'Crawler', tool: openAITools.crawler },
    { name: 'Page Screenshot', tool: openAITools.pageScreenshot },
    { name: 'Webpage to Markdown', tool: openAITools.webpageToMarkdown },
    { name: 'YouTube Transcript', tool: openAITools.youtubeTranscript }
  ];
  
  for (const { name, tool } of basicTools) {
    await testTool(name, tool, [
      {
        name: 'Tool description validation',
        call: {
          id: `${name}_desc`,
          type: 'function',
          function: {
            name: 'dummy',
            arguments: '{}'
          }
        },
        validate: () => {
          try {
            const desc = tool.getToolDescription();
            return desc && desc.function && desc.function.name;
          } catch {
            return false;
          }
        }
      }
    ]);
  }
  
  // Test getAllToolDescriptions
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Testing: Global Functions${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  try {
    const allDescriptions = getAllToolDescriptions();
    log.success(`getAllToolDescriptions returned ${allDescriptions.length} tool functions`);
    passedTests++;
    
    // List all available functions
    console.log('\nAvailable OpenAI tool functions:');
    allDescriptions.forEach(desc => {
      console.log(`  - ${desc.function.name}: ${desc.function.description}`);
    });
  } catch (error) {
    log.error(`getAllToolDescriptions failed: ${error.message}`);
    failedTests++;
  }
  
  // Test invokeByFunctionName
  try {
    const testCall = {
      id: 'invoke_test',
      type: 'function',
      function: {
        name: 'calculator_evaluate',
        arguments: JSON.stringify({ expression: '10 * 10' })
      }
    };
    
    const result = await invokeByFunctionName('calculator_evaluate', testCall);
    const content = JSON.parse(result.content);
    
    if (content.result === 100) {
      log.success('invokeByFunctionName works correctly');
      passedTests++;
    } else {
      log.error('invokeByFunctionName returned incorrect result');
      failedTests++;
    }
  } catch (error) {
    log.error(`invokeByFunctionName failed: ${error.message}`);
    failedTests++;
  }
  
  // Cleanup test files
  try {
    await fs.unlink(testFilePath).catch(() => {});
    await fs.rmdir(testDirPath).catch(() => {});
  } catch (e) {
    // Ignore cleanup errors
  }
  
  // Summary
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  const total = passedTests + failedTests;
  const percentage = ((passedTests / total) * 100).toFixed(1);
  
  console.log(`Total tests: ${total}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`Success rate: ${percentage}%`);
  
  if (failedTests === 0) {
    console.log(`\n${colors.green}All tests passed! 🎉${colors.reset}`);
  } else {
    console.log(`\n${colors.red}Some tests failed. Please review the errors above.${colors.reset}`);
  }
}

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };