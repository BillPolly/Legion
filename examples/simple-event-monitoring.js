#!/usr/bin/env node

/**
 * Simple Event Monitoring Example
 * 
 * This example shows the basics of monitoring events from jsEnvoy modules.
 */

import { Module } from '@jsenvoy/module-loader';
import CalculatorModule from '@jsenvoy/general-tools/src/calculator/CalculatorModule.js';
import { JsonModule } from '@jsenvoy/general-tools/src/json/JsonModule.js';

// Create a custom event handler
function createEventLogger(moduleName) {
  return (event) => {
    const timestamp = new Date().toISOString();
    const emoji = {
      progress: '⏳',
      info: 'ℹ️ ',
      warning: '⚠️ ',
      error: '❌'
    }[event.type] || '📌';
    
    console.log(`[${timestamp}] ${emoji} ${moduleName}: ${event.message}`);
    
    if (event.data) {
      console.log(`   └─ Data:`, JSON.stringify(event.data));
    }
  };
}

async function main() {
  console.log('Simple Event Monitoring Example');
  console.log('==============================\n');

  // Create modules
  const calculator = new CalculatorModule();
  const json = new JsonModule();

  // Add event listeners
  calculator.on('event', createEventLogger('Calculator'));
  json.on('event', createEventLogger('JSON'));

  // Example 1: Calculator with events
  console.log('Example 1: Calculator Operations');
  console.log('--------------------------------');
  
  const calcTool = calculator.tools[0];
  
  // Successful calculation
  await calcTool.invoke({
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: 'Math.sqrt(144) + 8' })
    }
  });

  // Error case - forbidden keyword
  await calcTool.invoke({
    function: {
      name: 'calculator_evaluate',
      arguments: JSON.stringify({ expression: 'require("fs")' })
    }
  });

  console.log('\nExample 2: JSON Operations');
  console.log('--------------------------');

  // Parse JSON
  const parseTool = json.tools.find(t => t.name === 'json_parse');
  await parseTool.invoke({
    function: {
      name: 'json_parse',
      arguments: JSON.stringify({
        json_string: '{"users": [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]}'
      })
    }
  });

  // Stringify with sorting
  const stringifyTool = json.tools.find(t => t.name === 'json_stringify');
  await stringifyTool.invoke({
    function: {
      name: 'json_stringify',
      arguments: JSON.stringify({
        object: { z: 1, a: 2, m: 3 },
        indent: 2,
        sort_keys: true
      })
    }
  });

  // Validate JSON
  const validateTool = json.tools.find(t => t.name === 'json_validate');
  
  console.log('\nValidating good JSON:');
  await validateTool.invoke({
    function: {
      name: 'json_validate',
      arguments: JSON.stringify({
        json_string: '{"valid": true, "count": 42}'
      })
    }
  });

  console.log('\nValidating bad JSON:');
  await validateTool.invoke({
    function: {
      name: 'json_validate',
      arguments: JSON.stringify({
        json_string: '{"invalid": json, no quotes}'
      })
    }
  });

  // Extract value
  const extractTool = json.tools.find(t => t.name === 'json_extract');
  await extractTool.invoke({
    function: {
      name: 'json_extract',
      arguments: JSON.stringify({
        json_object: { 
          company: { 
            name: 'TechCorp', 
            employees: [
              { name: 'Alice', role: 'CEO' },
              { name: 'Bob', role: 'CTO' }
            ]
          } 
        },
        path: 'company.employees[1].role'
      })
    }
  });

  console.log('\n✅ Event monitoring example complete!');
}

main().catch(console.error);