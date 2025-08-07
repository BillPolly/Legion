/**
 * Basic usage example of the Recursive Planning Agent Framework
 */

import RecursivePlanner from '../src/index.js';

// Create instance of RecursivePlanner
const planner = new RecursivePlanner();

const {
  factories: { createPlanningAgent, createTool, createTemplatePlanner },
  strategies: { SequentialPlanningStrategy },
  PlanStep,
  utils: { IdGenerator }
} = planner;

/**
 * Example: Simple task automation agent
 */
async function basicExample() {
  console.log('🚀 Basic Planning Agent Example\n');

  // Create some simple tools
  const analyzeTask = createTool(
    'analyzeTask',
    'Analyze a task and break it down',
    async (input) => {
      console.log(`📊 Analyzing task: ${input.task}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
      return {
        analysis: `Analyzed: ${input.task}`,
        complexity: 'medium',
        estimatedTime: '10 minutes'
      };
    },
    { debugMode: true }
  );

  const executeWork = createTool(
    'executeWork',
    'Execute work based on analysis',
    async (input) => {
      console.log(`⚡ Executing work: ${input.work}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
      return {
        result: `Completed: ${input.work}`,
        success: true,
        output: `Generated output for ${input.work}`
      };
    },
    { debugMode: true }
  );

  const validateResult = createTool(
    'validateResult',
    'Validate the work result',
    async (input) => {
      console.log(`✅ Validating result: ${input.result}`);
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate work
      return {
        valid: true,
        quality: 'high',
        feedback: 'Work completed successfully'
      };
    },
    { debugMode: true }
  );

  // Create a template-based planning strategy
  const templates = {
    'complete task': [
      {
        id: IdGenerator.generateStepId('analyze'),
        description: 'Analyze the task requirements',
        tool: 'analyzeTask',
        params: { task: '{{goal}}' },
        dependencies: []
      },
      {
        id: IdGenerator.generateStepId('execute'),
        description: 'Execute the work',
        tool: 'executeWork',
        params: { work: '{{goal}}' },
        dependencies: []
      },
      {
        id: IdGenerator.generateStepId('validate'),
        description: 'Validate the results',
        tool: 'validateResult',
        params: { result: 'work_output' },
        dependencies: []
      }
    ]
  };

  const planner = createTemplatePlanner(templates);

  // Create the planning agent
  const agent = createPlanningAgent({
    name: 'TaskAgent',
    description: 'Agent that completes tasks systematically',
    planningStrategy: planner,
    debugMode: true
  });

  // Define available tools
  const tools = [analyzeTask, executeWork, validateResult];

  // Execute the agent
  try {
    const goal = 'complete task: Build a user registration form';
    console.log(`🎯 Goal: ${goal}\n`);

    const result = await agent.run(goal, tools, {
      userPreferences: { quality: 'high' },
      deadline: Date.now() + 60000 // 1 minute from now
    });

    console.log('\n📋 Execution Results:');
    console.log('Success:', result.success);
    console.log('Completed Steps:', result.result?.completedSteps || 0);
    console.log('Total Steps:', result.result?.totalSteps || 0);
    console.log('Execution Time:', `${result.result?.executionTime || 0}ms`);
    
    if (result.success) {
      console.log('Final Output:', result.result?.finalOutput);
    } else {
      console.log('Error:', result.error?.message);
      console.log('Partial Result:', result.partialResult);
    }

    // Show tool metrics
    console.log('\n📊 Tool Metrics:');
    tools.forEach(tool => {
      const metrics = tool.getMetrics();
      console.log(`${tool.name}: ${metrics.getTotalExecutions()} executions, ${(metrics.getSuccessRate() * 100).toFixed(1)}% success rate`);
    });

  } catch (error) {
    console.error('❌ Execution failed:', error.message);
  }
}

/**
 * Example: Sequential planning with simple tools
 */
async function sequentialExample() {
  console.log('\n🔄 Sequential Planning Example\n');

  // Create a simple calculation tool
  const calculator = createTool(
    'calculator',
    'Perform mathematical calculations',
    async (input) => {
      console.log(`🧮 Calculating: ${input.expression}`);
      
      // Simple evaluation (in real use, use a safe math parser)
      let result;
      try {
        // This is just for demo - don't use eval in production!
        result = eval(input.expression);
      } catch (error) {
        throw new Error(`Invalid expression: ${input.expression}`);
      }
      
      return {
        expression: input.expression,
        result: result,
        type: 'calculation'
      };
    }
  );

  // Create agent with sequential planning
  const agent = createPlanningAgent({
    name: 'CalculatorAgent',
    description: 'Agent that performs calculations',
    planningStrategy: new SequentialPlanningStrategy('calculator'),
    debugMode: true
  });

  try {
    const goal = 'Calculate the area of a circle with radius 5';
    console.log(`🎯 Goal: ${goal}\n`);

    const result = await agent.run(goal, [calculator], {
      context: { formula: 'π × r²', radius: 5 }
    });

    console.log('\n📋 Calculation Results:');
    console.log('Success:', result.success);
    console.log('Result:', result.result);

  } catch (error) {
    console.error('❌ Calculation failed:', error.message);
  }
}

// Run examples
async function runExamples() {
  try {
    await basicExample();
    await sequentialExample();
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export for use in other files
export { basicExample, sequentialExample };

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}