/**
 * Example demonstrating the adapter classes
 */

import { SimpleTool, LegacyToolAdapter, OpenAIToolAdapter } from '../src/index.js';
import { z } from 'zod';

// Example legacy tool (old style with properties)
const legacyCalculator = {
  name: 'legacy_calculator',
  description: 'A legacy calculator tool',
  inputSchema: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Math expression to evaluate'
      }
    },
    required: ['expression']
  },
  execute: async (params) => {
    // Simple expression evaluator (for demo purposes)
    const { expression } = params;
    
    // Very basic parsing (don't use eval in production!)
    const match = expression.match(/^(\d+)\s*([\+\-\*\/])\s*(\d+)$/);
    if (!match) {
      throw new Error('Invalid expression format. Use: "number operator number"');
    }
    
    const [, a, op, b] = match;
    const num1 = parseInt(a);
    const num2 = parseInt(b);
    
    let result;
    switch (op) {
      case '+': result = num1 + num2; break;
      case '-': result = num1 - num2; break;
      case '*': result = num1 * num2; break;
      case '/': 
        if (num2 === 0) throw new Error('Division by zero');
        result = num1 / num2; 
        break;
    }
    
    return { expression, result };
  }
};

// Create a SimpleTool for comparison
class ModernCalculator extends SimpleTool {
  constructor() {
    super({
      name: 'modern_calculator',
      description: 'A modern calculator using SimpleTool',
      inputSchema: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'), 
        operation: z.enum(['+', '-', '*', '/']).describe('Math operation')
      })
    });
  }
  
  async execute(params) {
    const { a, b, operation } = params;
    
    this.info(`Calculating ${a} ${operation} ${b}`);
    
    let result;
    switch (operation) {
      case '+': result = a + b; break;
      case '-': result = a - b; break;
      case '*': result = a * b; break;
      case '/':
        if (b === 0) throw new Error('Division by zero');
        result = a / b;
        break;
    }
    
    return { result, expression: `${a} ${operation} ${b}` };
  }
}

async function demonstrateAdapters() {
  console.log('=== Adapter Examples ===\n');
  
  // 1. Legacy Tool Adapter
  console.log('--- Legacy Tool Adapter ---');
  const adaptedLegacy = new LegacyToolAdapter(legacyCalculator);
  
  // Listen to events
  adaptedLegacy.on('event', (event) => {
    console.log(`[${event.type.toUpperCase()}] ${event.message}`);
  });
  
  // Use the adapted tool
  try {
    const result1 = await adaptedLegacy.run({ expression: '42 * 10' });
    console.log('Result:', result1);
    
    const result2 = await adaptedLegacy.run({ expression: '100 / 5' });
    console.log('Result:', result2);
    
    // Test error
    await adaptedLegacy.run({ expression: 'invalid' });
  } catch (error) {
    console.log('Caught error:', error.message);
  }
  
  // 2. OpenAI Tool Adapter
  console.log('\n--- OpenAI Tool Adapter ---');
  const modernTool = new ModernCalculator();
  const openAITool = new OpenAIToolAdapter(modernTool);
  
  // Get OpenAI function description
  const description = openAITool.getToolDescription();
  console.log('OpenAI Function Description:');
  console.log(JSON.stringify(description, null, 2));
  
  // Simulate OpenAI tool call
  const toolCall = {
    id: 'call_123',
    type: 'function',
    function: {
      name: 'modern_calculator',
      arguments: JSON.stringify({ a: 15, b: 3, operation: '/' })
    }
  };
  
  console.log('\nSimulating OpenAI tool call...');
  const result = await openAITool.invoke(toolCall);
  console.log('ToolResult:', {
    success: result.success,
    data: result.data
  });
  
  // Test validation error
  console.log('\n--- Testing Validation Error ---');
  const invalidCall = {
    id: 'call_456',
    type: 'function',
    function: {
      name: 'modern_calculator',
      arguments: JSON.stringify({ a: 'not a number', b: 5, operation: '+' })
    }
  };
  
  const errorResult = await openAITool.invoke(invalidCall);
  console.log('Error ToolResult:', {
    success: errorResult.success,
    error: errorResult.error,
    data: errorResult.data
  });
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateAdapters().catch(console.error);
}