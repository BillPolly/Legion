#!/usr/bin/env node

/**
 * Test script to verify ToolResult implementation
 */

const { ToolResult } = require('@jsenvoy/module-loader');
const CalculatorModule = require('@jsenvoy/tools/src/calculator');
const FileModule = require('@jsenvoy/tools/src/file');

async function testToolResult() {
  console.log('Testing ToolResult implementation...\n');

  // Test ToolResult class
  console.log('1. Testing ToolResult class:');
  
  const successResult = ToolResult.success({ value: 42, message: 'Success!' });
  console.log('Success result:', successResult);
  
  const failureResult = ToolResult.failure('Something went wrong', { code: 'ERR_001' });
  console.log('Failure result:', failureResult);
  
  console.log('\n2. Testing Calculator tool with ToolResult:');
  
  const calculator = new CalculatorModule();
  const calcTool = calculator.getTools()[0];
  
  // Test successful calculation
  const calcCall = {
    id: 'test-1',
    type: 'function',
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: '2 + 2' })
    }
  };
  
  const calcResult = await calcTool.invoke(calcCall);
  console.log('Calculator result:', calcResult);
  console.log('Is ToolResult?', calcResult instanceof ToolResult);
  
  // Test calculation error
  const calcErrorCall = {
    id: 'test-2',
    type: 'function',
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: 'import fs' })
    }
  };
  
  const calcError = await calcTool.invoke(calcErrorCall);
  console.log('Calculator error:', calcError);
  
  console.log('\n3. Testing File tool with ToolResult:');
  
  const fileModule = new FileModule();
  const fileTool = fileModule.getTools()[0];
  
  // Test file read (should fail for non-existent file)
  const fileCall = {
    id: 'test-3',
    type: 'function',
    function: {
      name: 'file_read',
      arguments: JSON.stringify({ filepath: '/tmp/non-existent-file.txt' })
    }
  };
  
  const fileResult = await fileTool.invoke(fileCall);
  console.log('File read result:', fileResult);
  console.log('Is ToolResult?', fileResult instanceof ToolResult);
  
  console.log('\n4. Testing Tool base class execute method (CLI compatibility):');
  
  try {
    const execResult = await calcTool.execute({ expression: '10 * 5' });
    console.log('Execute success:', execResult);
  } catch (error) {
    console.log('Execute error:', error.message);
  }
  
  try {
    const execError = await calcTool.execute({ expression: 'require("fs")' });
    console.log('Should not reach here');
  } catch (error) {
    console.log('Execute error (expected):', error.message);
  }
  
  console.log('\nAll tests completed!');
}

// Run tests
testToolResult().catch(console.error);