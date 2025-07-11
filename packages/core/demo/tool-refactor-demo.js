/**
 * Demo script showing the refactored tool system
 */

const CalculatorOpenAI = require('../src/tools/calculator/CalculatorOpenAI');
const { calculatorTool } = require('../src/tools/calculator');
const ToolAdapter = require('../tools/ToolAdapter');

async function runDemo() {
  console.log('=== Tool Refactoring Demo ===\n');

  // 1. Using the new OpenAI-compatible tool directly
  console.log('1. New OpenAI-Compatible Tool:');
  const calcOpenAI = new CalculatorOpenAI();
  
  // Show tool description
  console.log('Tool Description:');
  console.log(JSON.stringify(calcOpenAI.getToolDescription(), null, 2));
  
  // Simulate an OpenAI tool call
  const openAICall = {
    id: 'call_123',
    type: 'function',
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: '784 * 566' })
    }
  };
  
  console.log('\nTool Call:');
  console.log(JSON.stringify(openAICall, null, 2));
  
  const result = await calcOpenAI.invoke(openAICall);
  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n' + '='.repeat(50) + '\n');

  // 2. Using the adapter with legacy tool
  console.log('2. Legacy Tool with Adapter:');
  const adapter = new ToolAdapter(calculatorTool);
  
  // Show adapted tool description
  console.log('Adapted Tool Description:');
  console.log(JSON.stringify(adapter.getToolDescription(), null, 2));
  
  // Convert legacy call to OpenAI format
  const legacyCall = {
    use_tool: {
      identifier: 'calculator_tool',
      function_name: 'evaluate',
      args: ['100 / 4']
    }
  };
  
  console.log('\nLegacy Call:');
  console.log(JSON.stringify(legacyCall, null, 2));
  
  const convertedCall = ToolAdapter.convertLegacyCallToOpenAI(legacyCall, calculatorTool);
  console.log('\nConverted to OpenAI format:');
  console.log(JSON.stringify(convertedCall, null, 2));
  
  const adapterResult = await adapter.invoke(convertedCall);
  console.log('\nAdapter Result:');
  console.log(JSON.stringify(adapterResult, null, 2));

  console.log('\n' + '='.repeat(50) + '\n');

  // 3. Error handling
  console.log('3. Error Handling:');
  const errorCall = {
    id: 'call_error',
    type: 'function',
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: 'invalid expression' })
    }
  };
  
  const errorResult = await calcOpenAI.invoke(errorCall);
  console.log('Error Result:');
  console.log(JSON.stringify(errorResult, null, 2));
}

// Run the demo
runDemo().catch(console.error);