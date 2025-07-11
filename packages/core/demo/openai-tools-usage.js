/**
 * Demonstration of how to use the new OpenAI-compatible tools
 */

const { 
  openAITools, 
  getAllOpenAIToolDescriptions, 
  invokeOpenAIToolByFunctionName 
} = require('../src/tools');

async function demonstrateOpenAITools() {
  console.log('=== OpenAI Tools Usage Demonstration ===\n');

  // 1. Show all available tools
  console.log('1. Available OpenAI Tool Functions:');
  console.log('=' .repeat(50));
  const allTools = getAllOpenAIToolDescriptions();
  allTools.forEach(tool => {
    console.log(`\nFunction: ${tool.function.name}`);
    console.log(`Description: ${tool.function.description}`);
    console.log('Parameters:', JSON.stringify(tool.function.parameters, null, 2));
  });

  console.log('\n' + '='.repeat(50) + '\n');

  // 2. Example: Using the calculator
  console.log('2. Calculator Example:');
  const calcCall = {
    id: 'demo_calc_1',
    type: 'function',
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: '(100 + 50) * 2' })
    }
  };
  
  const calcResult = await invokeOpenAIToolByFunctionName('calculator_evaluate', calcCall);
  console.log('Result:', JSON.parse(calcResult.content));

  console.log('\n' + '='.repeat(50) + '\n');

  // 3. Example: File operations
  console.log('3. File Operations Example:');
  
  // Write a file
  const writeCall = {
    id: 'demo_write_1',
    type: 'function',
    function: {
      name: 'file_writer_write_file',
      arguments: JSON.stringify({
        filepath: 'demo-output.txt',
        content: 'This is a demo file created by OpenAI tools!'
      })
    }
  };
  
  const writeResult = await openAITools.fileWriter.invoke(writeCall);
  console.log('Write result:', JSON.parse(writeResult.content));

  // Read the file back
  const readCall = {
    id: 'demo_read_1',
    type: 'function',
    function: {
      name: 'file_reader_read',
      arguments: JSON.stringify({ filepath: 'demo-output.txt' })
    }
  };
  
  const readResult = await openAITools.fileReader.invoke(readCall);
  console.log('Read result:', JSON.parse(readResult.content));

  console.log('\n' + '='.repeat(50) + '\n');

  // 4. Example: Command execution
  console.log('4. Command Execution Example:');
  const cmdCall = {
    id: 'demo_cmd_1',
    type: 'function',
    function: {
      name: 'command_executor_execute',
      arguments: JSON.stringify({ command: 'date' })
    }
  };
  
  const cmdResult = await openAITools.commandExecutor.invoke(cmdCall);
  console.log('Command result:', JSON.parse(cmdResult.content));

  console.log('\n' + '='.repeat(50) + '\n');

  // 5. Example: Error handling
  console.log('5. Error Handling Example:');
  const errorCall = {
    id: 'demo_error_1',
    type: 'function',
    function: {
      name: 'file_reader_read',
      arguments: JSON.stringify({ filepath: 'non-existent-file.xyz' })
    }
  };
  
  const errorResult = await openAITools.fileReader.invoke(errorCall);
  console.log('Error result:', JSON.parse(errorResult.content));

  console.log('\n' + '='.repeat(50) + '\n');

  // 6. Example: Tool with multiple functions
  console.log('6. Multiple Functions Example (File Writer):');
  const functions = openAITools.fileWriter.getAllToolDescriptions();
  console.log(`File Writer has ${functions.length} functions:`);
  functions.forEach(func => {
    console.log(`- ${func.function.name}: ${func.function.description}`);
  });

  // Clean up
  const fs = require('fs').promises;
  await fs.unlink('demo-output.txt').catch(() => {});

  console.log('\n✅ Demo completed successfully!\n');
}

// Integration example with OpenAI SDK (pseudo-code)
function showOpenAIIntegration() {
  console.log('\n=== OpenAI SDK Integration Example ===\n');
  console.log(`
// Example integration with OpenAI SDK:

const OpenAI = require('openai');
const { getAllOpenAIToolDescriptions, invokeOpenAIToolByFunctionName } = require('./src/tools');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get all tool descriptions for OpenAI
const tools = getAllOpenAIToolDescriptions();

// Make a request with tools
const completion = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Calculate 123 * 456" }],
  tools: tools,
  tool_choice: "auto"
});

// Handle tool calls
if (completion.choices[0].message.tool_calls) {
  for (const toolCall of completion.choices[0].message.tool_calls) {
    const result = await invokeOpenAIToolByFunctionName(
      toolCall.function.name,
      toolCall
    );
    
    // Send result back to OpenAI...
  }
}
`);
}

// Run the demonstration
if (require.main === module) {
  demonstrateOpenAITools()
    .then(() => showOpenAIIntegration())
    .catch(console.error);
}

module.exports = { demonstrateOpenAITools };