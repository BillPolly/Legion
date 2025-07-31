/**
 * Example of creating tools with the new SimpleTool pattern
 */

import { SimpleTool, SimpleModule, OpenAIToolAdapter } from '../src/index.js';
import { z } from 'zod';

/**
 * Example 1: Basic SimpleTool
 */
class GreetingTool extends SimpleTool {
  constructor() {
    super({
      name: 'greeting',
      description: 'Generates a personalized greeting message',
      inputSchema: z.object({
        name: z.string().describe('The name of the person to greet'),
        style: z.enum(['formal', 'casual', 'friendly']).default('friendly').describe('The greeting style')
      })
    });
  }
  
  async execute(params) {
    // Emit progress event
    this.progress('Generating greeting', 25);
    
    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate greeting based on style
    let greeting;
    switch (params.style) {
      case 'formal':
        greeting = `Good day, ${params.name}. I hope this message finds you well.`;
        break;
      case 'casual':
        greeting = `Hey ${params.name}, what's up?`;
        break;
      case 'friendly':
      default:
        greeting = `Hello ${params.name}! Nice to meet you!`;
        break;
    }
    
    // Emit completion
    this.progress('Greeting generated', 100);
    this.info(`Generated ${params.style} greeting for ${params.name}`);
    
    return { greeting, timestamp: new Date().toISOString() };
  }
}

/**
 * Example 2: Tool with error handling and validation
 */
class MathTool extends SimpleTool {
  constructor() {
    super({
      name: 'math_calculator',
      description: 'Performs mathematical calculations with validation',
      inputSchema: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Math operation'),
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
      })
    });
  }
  
  async execute(params) {
    const { operation, a, b } = params;
    
    this.info(`Performing ${operation} on ${a} and ${b}`);
    
    let result;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          // Just throw the error - SimpleTool.run() will emit the error event
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
    }
    
    this.info(`Calculation complete: ${a} ${operation} ${b} = ${result}`);
    
    return { result, operation, inputs: { a, b } };
  }
}

/**
 * Example 3: Tool with async operations and detailed progress
 */
class DataProcessorTool extends SimpleTool {
  constructor() {
    super({
      name: 'data_processor',
      description: 'Processes data with detailed progress reporting',
      inputSchema: z.object({
        data: z.array(z.number()).describe('Array of numbers to process'),
        operations: z.array(z.enum(['sort', 'reverse', 'sum', 'average', 'min', 'max']))
          .default(['sort']).describe('Operations to perform')
      })
    });
  }
  
  async execute(params) {
    const { data, operations } = params;
    let result = [...data];
    const results = {};
    
    const totalSteps = operations.length;
    let currentStep = 0;
    
    for (const operation of operations) {
      currentStep++;
      const percentage = Math.round((currentStep / totalSteps) * 100);
      
      this.progress(`Performing ${operation}`, percentage, { 
        step: currentStep, 
        totalSteps,
        operation 
      });
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      switch (operation) {
        case 'sort':
          result = result.sort((a, b) => a - b);
          results.sorted = [...result];
          break;
        case 'reverse':
          result = result.reverse();
          results.reversed = [...result];
          break;
        case 'sum':
          results.sum = result.reduce((acc, val) => acc + val, 0);
          break;
        case 'average':
          results.average = result.reduce((acc, val) => acc + val, 0) / result.length;
          break;
        case 'min':
          results.min = Math.min(...result);
          break;
        case 'max':
          results.max = Math.max(...result);
          break;
      }
      
      this.info(`Completed ${operation}`, { result: results[operation] || result });
    }
    
    return {
      original: data,
      processed: result,
      results,
      operationsPerformed: operations
    };
  }
}

/**
 * Example Module using SimpleModule
 */
class ExampleModule extends SimpleModule {
  constructor() {
    super('ExampleModule');
  }
  
  async initialize() {
    // Register our tools
    this.registerTool(new GreetingTool());
    this.registerTool(new MathTool());
    this.registerTool(new DataProcessorTool());
    
    // Module is ready
    this.emit('ready', { toolCount: this.getTools().length });
  }
}

/**
 * Example usage
 */
async function demonstrateSimpleTool() {
  console.log('=== SimpleTool Example ===\n');
  
  // Create and initialize module
  const module = new ExampleModule();
  await module.initialize();
  
  // Listen to module events
  module.on('event', (event) => {
    console.log(`[${event.type.toUpperCase()}] ${event.tool}: ${event.message}`);
    if (event.data && Object.keys(event.data).length > 0) {
      console.log('  Data:', event.data);
    }
  });
  
  console.log('\n--- Example 1: Greeting Tool ---');
  const greetingTool = module.getTool('greeting');
  const greeting1 = await greetingTool.run({ name: 'Alice', style: 'formal' });
  console.log('Result:', greeting1);
  
  console.log('\n--- Example 2: Math Tool ---');
  const mathTool = module.getTool('math_calculator');
  const math1 = await mathTool.run({ operation: 'multiply', a: 7, b: 8 });
  console.log('Result:', math1);
  
  // Demonstrate error handling
  console.log('\n--- Example 3: Error Handling ---');
  try {
    await mathTool.run({ operation: 'divide', a: 10, b: 0 });
  } catch (error) {
    console.log('Caught error:', error.message);
  }
  
  console.log('\n--- Example 4: Data Processor ---');
  const processorTool = module.getTool('data_processor');
  const processed = await processorTool.run({
    data: [5, 2, 8, 1, 9, 3],
    operations: ['sort', 'sum', 'average', 'min', 'max']
  });
  console.log('Result:', processed);
  
  console.log('\n--- Example 5: OpenAI Adapter ---');
  // Get tools wrapped for OpenAI
  const openAITools = module.getOpenAITools();
  console.log('Available OpenAI tools:');
  for (const tool of openAITools) {
    const desc = tool.getToolDescription();
    console.log(`- ${desc.function.name}: ${desc.function.description}`);
  }
  
  // Clean up
  await module.cleanup();
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateSimpleTool().catch(console.error);
}