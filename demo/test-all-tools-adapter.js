/**
 * Test script to verify ToolAdapter works with all existing tools
 */

const ToolAdapterEnhanced = require('../tools/ToolAdapterEnhanced');

// Import all tools
const { calculatorTool } = require('../src/tools/calculator');
const { fileReaderTool } = require('../src/tools/file-reader');
const { fileWriterTool } = require('../src/tools/file-writer');
const { serverStarterTool } = require('../src/tools/server-starter');
const { googleSearchTool } = require('../src/tools/serper');
const { bashExecutorTool } = require('../src/tools/command-executor');
const { crawlerTool } = require('../src/tools/crawler');
const { pageScreenshotTool } = require('../src/tools/page-screenshoter');
const { webPageToMarkdownTool } = require('../src/tools/webpage-to-markdown');
const { youtubeTranscriptTool } = require('../src/tools/youtube-transcript');

async function testTool(tool, testCalls) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${tool.name} (${tool.identifier})`);
  console.log(`Functions: ${tool.functions.map(f => f.name).join(', ')}`);
  console.log('='.repeat(60));

  const adapter = new ToolAdapterEnhanced(tool);
  
  // Show all available functions
  const allDescriptions = adapter.getAllToolDescriptions();
  console.log('\nAvailable functions:');
  allDescriptions.forEach(desc => {
    console.log(`- ${desc.function.name}: ${desc.function.description}`);
  });

  // Test each provided call
  for (const testCall of testCalls) {
    console.log(`\nTesting: ${testCall.description}`);
    console.log('Call:', JSON.stringify(testCall.call, null, 2));
    
    try {
      const result = await adapter.invoke(testCall.call);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
}

async function runTests() {
  console.log('Testing ToolAdapterEnhanced with all tools...\n');

  // Test Calculator Tool
  await testTool(calculatorTool, [{
    description: 'Simple calculation',
    call: {
      id: 'test_1',
      type: 'function',
      function: {
        name: 'calculator_tool_evaluate',
        arguments: JSON.stringify({ expression: '10 * 5' })
      }
    }
  }]);

  // Test File Reader Tool
  await testTool(fileReaderTool, [{
    description: 'Read package.json',
    call: {
      id: 'test_2',
      type: 'function',
      function: {
        name: 'file_reader_tool_readFile',
        arguments: JSON.stringify({ path: 'package.json' })
      }
    }
  }]);

  // Test File Writer Tool (multiple functions)
  await testTool(fileWriterTool, [
    {
      description: 'Write file function',
      call: {
        id: 'test_3a',
        type: 'function',
        function: {
          name: 'file_reader_tool_writeFile', // Note: incorrect identifier in original
          arguments: JSON.stringify({ 
            path: 'test-output.txt',
            content: 'Test content from adapter'
          })
        }
      }
    },
    {
      description: 'Create directory function',
      call: {
        id: 'test_3b',
        type: 'function',
        function: {
          name: 'file_reader_tool_createDirectory',
          arguments: JSON.stringify({ path: 'test-directory' })
        }
      }
    }
  ]);

  // Test Bash Executor
  await testTool(bashExecutorTool, [{
    description: 'List files',
    call: {
      id: 'test_4',
      type: 'function',
      function: {
        name: 'bash_executor_tool_execute',
        arguments: JSON.stringify({ command: 'ls -la | head -5' })
      }
    }
  }]);

  // Test Crawler Tool
  await testTool(crawlerTool, [{
    description: 'Crawl example.com',
    call: {
      id: 'test_5',
      type: 'function',
      function: {
        name: 'crawler_tool_crawl',
        arguments: JSON.stringify({ 
          url: 'https://example.com',
          limit: 1
        })
      }
    }
  }]);

  // Test Server Starter Tool (multiple functions)
  await testTool(serverStarterTool, [
    {
      description: 'Start server function',
      call: {
        id: 'test_6a',
        type: 'function',
        function: {
          name: 'server_starter_tool_start',
          arguments: JSON.stringify({ 
            command: 'echo "Mock server running"'
          })
        }
      }
    },
    {
      description: 'Read server output function',
      call: {
        id: 'test_6b',
        type: 'function',
        function: {
          name: 'server_starter_tool_readServerOutput',
          arguments: JSON.stringify({})
        }
      }
    }
  ]);

  // Test Google Search Tool (requires initialization)
  await testTool(googleSearchTool, [{
    description: 'Search without API key (should fail gracefully)',
    call: {
      id: 'test_7',
      type: 'function',
      function: {
        name: 'google_search_tool_search',
        arguments: JSON.stringify({ query: 'OpenAI tools' })
      }
    }
  }]);

  // Test Page Screenshot Tool
  await testTool(pageScreenshotTool, [{
    description: 'Screenshot example.com',
    call: {
      id: 'test_8',
      type: 'function',
      function: {
        name: 'page_screenshot_tool_screenshot',
        arguments: JSON.stringify({ url: 'https://example.com' })
      }
    }
  }]);

  // Test Web Page to Markdown Tool
  await testTool(webPageToMarkdownTool, [{
    description: 'Convert example.com to markdown',
    call: {
      id: 'test_9',
      type: 'function',
      function: {
        name: 'webpage_to_markdown_tool_convertToMarkdown',
        arguments: JSON.stringify({ 
          url: 'https://example.com',
          includeImages: true
        })
      }
    }
  }]);

  // Test YouTube Transcript Tool
  await testTool(youtubeTranscriptTool, [{
    description: 'Get transcript (mock video ID)',
    call: {
      id: 'test_10',
      type: 'function',
      function: {
        name: 'youtube_transcript_tool_getTranscript',
        arguments: JSON.stringify({ 
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        })
      }
    }
  }]);

  console.log('\n' + '='.repeat(60));
  console.log('Testing edge cases...');
  console.log('='.repeat(60));

  // Test invalid function name
  const adapter = new ToolAdapterEnhanced(calculatorTool);
  try {
    await adapter.invoke({
      id: 'edge_1',
      type: 'function',
      function: {
        name: 'calculator_tool_invalid',
        arguments: '{}'
      }
    });
  } catch (error) {
    console.log('\n✓ Invalid function name handled:', error.message);
  }

  // Test malformed JSON
  try {
    await adapter.invoke({
      id: 'edge_2',
      type: 'function',
      function: {
        name: 'calculator_tool_evaluate',
        arguments: 'invalid json'
      }
    });
  } catch (error) {
    console.log('✓ Malformed JSON handled:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('All tests completed!');
  
  // Clean up test files
  const fs = require('fs');
  try {
    fs.unlinkSync('test-output.txt');
    fs.rmdirSync('test-directory');
  } catch (e) {
    // Ignore cleanup errors
  }
}

// Run tests
runTests().catch(console.error);