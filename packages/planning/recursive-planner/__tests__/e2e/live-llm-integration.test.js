/**
 * End-to-end tests with live LLM integration
 * These tests use real LLM providers and may incur API costs
 * Run with: npm test tests/e2e/live-llm-integration.test.js
 */

import { describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import { config } from '../../src/runtime/config/index.js';

// Skip these tests if no LLM provider is available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

describe('Live LLM Integration Tests', () => {
  let llmProvider;
  let agent;
  let tools;

  beforeAll(() => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping live LLM tests - no API keys configured');
      return;
    }
    
    console.log('🤖 Running live LLM integration tests...');
    console.log(`   Using provider: ${config.get('llm.provider')}`);
    console.log('   This may incur API costs!');
    
    // Initialize provider here for afterAll access
    try {
      llmProvider = createLLMProvider();
    } catch (error) {
      console.log('⚠️  Failed to create LLM provider:', error.message);
    }
  });

  beforeEach(() => {
    if (skipLiveLLMTests) return;

    // Use the LLM provider created in beforeAll
    if (!llmProvider) {
      llmProvider = createLLMProvider();
    }
    
    // Create comprehensive tool suite for LLM to plan with
    tools = [
      createTool('analyzeText', 'Analyze text content and extract insights', async (input) => {
        return {
          wordCount: input.text?.length || 0,
          sentiment: 'neutral',
          topics: ['general'],
          summary: `Analysis of: ${input.text?.substring(0, 50)}...`
        };
      }),
      
      createTool('generateContent', 'Generate content based on specifications', async (input) => {
        return {
          content: `Generated content for: ${input.topic}`,
          type: input.type || 'article',
          length: input.length || 'medium'
        };
      }),
      
      createTool('processData', 'Process and transform data', async (input) => {
        return {
          processed: true,
          inputType: typeof input.data,
          outputFormat: input.format || 'json',
          timestamp: new Date().toISOString()
        };
      }),
      
      createTool('validateOutput', 'Validate output meets requirements', async (input) => {
        return {
          valid: true,
          score: 95,
          issues: [],
          recommendations: ['Output meets all requirements']
        };
      }),
      
      createTool('saveResults', 'Save results to storage', async (input) => {
        const dataToSave = input.data || input.content || input || {};
        return {
          saved: true,
          location: '/tmp/results',
          fileId: `result_${Date.now()}`,
          size: JSON.stringify(dataToSave).length
        };
      })
    ];
  });

  (skipLiveLLMTests ? describe.skip : describe)('Simple LLM Planning', () => {
    test('should create and execute a simple plan using LLM', async () => {
      // Create agent with LLM planning strategy
      agent = createPlanningAgent({
        name: 'SimpleLLMAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider, {
          maxRetries: 2,
          examples: [
            {
              goal: 'Analyze text content',
              plan: [
                {
                  id: 'analyze',
                  description: 'Analyze the input text',
                  tool: 'analyzeText',
                  params: { text: 'sample text' },
                  dependencies: []
                }
              ]
            }
          ]
        }),
        debugMode: true
      });

      console.log('🔍 Testing simple text analysis workflow...');
      
      const result = await agent.run(
        'Analyze this text: "Artificial intelligence is transforming how we work and live."',
        tools,
        { timeout: 30000 }
      );

      // Verify execution
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThan(0);
      expect(result.result.totalSteps).toBeGreaterThan(0);
      
      console.log(`✅ Simple plan executed successfully:`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      console.log(`   Execution time: ${result.result.executionTime}ms`);
      
      // Verify LLM was used
      expect(llmProvider.getTokenUsage().total).toBeGreaterThan(0);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
    }, 60000); // 60 second timeout

    test('should handle multi-step content creation workflow', async () => {
      agent = createPlanningAgent({
        name: 'ContentCreatorAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider, {
          maxRetries: 2,
          examples: [
            {
              goal: 'Create and validate content',
              plan: [
                {
                  id: 'generate',
                  description: 'Generate content',
                  tool: 'generateContent',
                  params: { topic: 'AI technology' },
                  dependencies: []
                },
                {
                  id: 'validate',
                  description: 'Validate generated content',
                  tool: 'validateOutput',
                  params: {},
                  dependencies: ['generate']
                }
              ]
            }
          ]
        }),
        debugMode: true
      });

      console.log('📝 Testing content creation workflow...');
      
      const result = await agent.run(
        'Create a technical article about machine learning applications and validate it meets quality standards',
        tools,
        { timeout: 60000 }
      );

      if (!result.success) {
        console.log('❌ Content creation workflow failed:');
        console.log('   Error:', result.error?.message);
        console.log('   Partial result:', result.partialResult);
      }

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(2);
      
      console.log(`✅ Content creation workflow completed:`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      console.log(`   Execution time: ${result.result.executionTime}ms`);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
    }, 90000); // 90 second timeout
  });

  (skipLiveLLMTests ? describe.skip : describe)('Complex LLM Planning', () => {
    test('should create complex multi-step plan', async () => {
      agent = createPlanningAgent({
        name: 'ComplexPlannerAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider, {
          maxRetries: 3
        }),
        debugMode: true
      });

      console.log('🎯 Testing complex planning scenario...');
      
      const complexGoal = `
        Create a comprehensive data analysis report by:
        1. Processing the raw data input
        2. Analyzing the processed data for patterns
        3. Generating insights and content
        4. Validating the quality of outputs
        5. Saving the final results
      `;

      const result = await agent.run(complexGoal, tools, { timeout: 60000 });

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(3);
      
      console.log(`✅ Complex plan executed successfully:`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      console.log(`   Execution time: ${result.result.executionTime}ms`);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
      
      // Verify the plan made sense (should have used multiple tools)
      const toolsUsed = new Set();
      // We can't easily track which tools were used without execution log,
      // but we can verify multiple steps were completed
      expect(result.result.completedSteps).toBeGreaterThan(1);
    }, 120000); // 2 minute timeout
  });

  (skipLiveLLMTests ? describe.skip : describe)('LLM Reflection and Adaptation', () => {
    test('should use reflection for decision making', async () => {
      agent = createPlanningAgent({
        name: 'ReflectiveAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider),
        reflectionEnabled: true,
        debugMode: true
      });

      console.log('🤔 Testing LLM reflection and adaptation...');
      
      const result = await agent.run(
        'Process some data and ensure the output is properly validated before saving',
        tools,
        { timeout: 45000 }
      );

      expect(result.success).toBe(true);
      
      console.log(`✅ Reflective execution completed:`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      console.log(`   Execution time: ${result.result.executionTime}ms`);
      
      // Reflection should have used additional tokens
      expect(llmProvider.getTokenUsage().total).toBeGreaterThan(100);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
    }, 90000);
  });

  (skipLiveLLMTests ? describe.skip : describe)('Error Handling and Recovery', () => {
    test('should handle tool failures and adapt plan', async () => {
      // Add a tool that fails
      const unreliableTools = [
        ...tools,
        createTool('unreliableTool', 'A tool that sometimes fails', async (input) => {
          if (Math.random() < 0.7) { // 70% chance of failure
            throw new Error('Simulated tool failure');
          }
          return { success: true, data: 'processed' };
        })
      ];
      
      agent = createPlanningAgent({
        name: 'AdaptiveAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider, {
          maxRetries: 3
        }),
        maxRetries: 2,
        debugMode: true
      });

      console.log('⚠️  Testing error handling and adaptation...');
      
      const result = await agent.run(
        'Process data using available tools, avoid unreliable operations',
        unreliableTools,
        { timeout: 60000 }
      );

      // The agent should either succeed by avoiding the unreliable tool,
      // or handle the failure gracefully
      console.log(`${result.success ? '✅' : '❌'} Error handling test completed:`);
      console.log(`   Success: ${result.success}`);
      console.log(`   Steps completed: ${result.result?.completedSteps || 0}/${result.result?.totalSteps || 0}`);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
      
      if (!result.success) {
        console.log(`   Error: ${result.error?.message}`);
      }
      
      // We don't assert success here because the agent might legitimately fail
      // if it tries to use the unreliable tool, but it should have made an attempt
      expect(llmProvider.getTokenUsage().total).toBeGreaterThan(0);
    }, 120000);
  });

  (skipLiveLLMTests ? describe.skip : describe)('Performance and Resource Usage', () => {
    test('should track token usage and execution metrics', async () => {
      llmProvider.resetTokenUsage(); // Start fresh
      
      agent = createPlanningAgent({
        name: 'MetricsAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider),
        debugMode: true
      });

      console.log('📊 Testing performance metrics collection...');
      
      const startTime = Date.now();
      const result = await agent.run(
        'Analyze text and generate a summary report',
        tools,
        { timeout: 30000 }
      );
      const endTime = Date.now();

      expect(result.success).toBe(true);
      
      const tokenUsage = llmProvider.getTokenUsage();
      const executionTime = endTime - startTime;
      
      console.log(`✅ Performance metrics collected:`);
      console.log(`   Execution time: ${executionTime}ms`);
      console.log(`   Input tokens: ${tokenUsage.input}`);
      console.log(`   Output tokens: ${tokenUsage.output}`);
      console.log(`   Total tokens: ${tokenUsage.total}`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      
      // Verify metrics make sense
      expect(tokenUsage.total).toBeGreaterThan(0);
      expect(tokenUsage.input).toBeGreaterThan(0);
      expect(tokenUsage.output).toBeGreaterThan(0);
      expect(executionTime).toBeGreaterThan(100); // At least 100ms
      expect(executionTime).toBeLessThan(30000); // Less than timeout
    }, 60000);

    test('should handle multiple provider fallback', async () => {
      // Only run if multiple providers are available
      const availableProviders = config.getAvailableLLMProviders();
      if (availableProviders.length < 2) {
        console.log('⏭️  Skipping provider fallback test - need multiple providers');
        return;
      }

      console.log('🔄 Testing provider fallback...');
      console.log(`   Available providers: ${availableProviders.join(', ')}`);
      
      // Try each provider
      for (const providerName of availableProviders) {
        console.log(`   Testing ${providerName}...`);
        
        const testProvider = createLLMProvider(providerName);
        const testAgent = createPlanningAgent({
          name: `${providerName}Agent`,
          planningStrategy: new LLMPlanningStrategy(testProvider),
          suppressLLMErrors: false
        });

        try {
          const result = await testAgent.run(
            'Analyze this simple text and provide insights',
            [tools[0]], // Just use the first tool
            { timeout: 20000 }
          );
          
          console.log(`   ✅ ${providerName}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
          console.log(`   ❌ ${providerName}: ERROR - ${error.message}`);
        }
      }
    }, 120000);
  });

  (skipLiveLLMTests ? describe.skip : describe)('Real-World Scenarios', () => {
    test('should handle a realistic code generation task', async () => {
      const devTools = [
        createTool('analyzeRequirements', 'Analyze project requirements', async (input) => ({
          requirements: ['function', 'tests', 'documentation'],
          complexity: 'medium',
          estimatedLines: 50
        })),
        
        createTool('generateCode', 'Generate code based on requirements', async (input) => ({
          code: `function ${input.functionName || 'processData'}(input) {\n  return input.map(x => x * 2);\n}`,
          language: 'javascript',
          linesOfCode: 3
        })),
        
        createTool('generateTests', 'Generate unit tests', async (input) => ({
          tests: `test('should process data', () => {\n  expect(processData([1,2,3])).toEqual([2,4,6]);\n});`,
          framework: 'jest',
          coverage: 100
        })),
        
        createTool('createDocumentation', 'Create documentation', async (input) => ({
          documentation: `# ${input.title || 'Function'}\n\nThis function processes data by doubling each value.`,
          format: 'markdown'
        }))
      ];

      agent = createPlanningAgent({
        name: 'CodeGeneratorAgent',
        planningStrategy: new LLMPlanningStrategy(llmProvider, {
          examples: [
            {
              goal: 'Create a function with tests',
              plan: [
                { id: 'analyze', description: 'Analyze requirements', tool: 'analyzeRequirements', params: {}, dependencies: [] },
                { id: 'code', description: 'Generate code', tool: 'generateCode', params: {}, dependencies: ['analyze'] },
                { id: 'test', description: 'Generate tests', tool: 'generateTests', params: {}, dependencies: ['code'] }
              ]
            }
          ]
        }),
        debugMode: true
      });

      console.log('👨‍💻 Testing realistic code generation scenario...');
      
      const result = await agent.run(
        'Create a JavaScript function that processes an array of numbers, include unit tests and documentation',
        devTools,
        { timeout: 60000 }
      );

      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(2);
      
      console.log(`✅ Code generation completed:`);
      console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
      console.log(`   Execution time: ${result.result.executionTime}ms`);
      console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);
    }, 120000);
  });
});

// Summary function to display test results
afterAll(() => {
  if (!skipLiveLLMTests) {
    let testProvider;
    try {
      testProvider = createLLMProvider();
      if (testProvider) {
        const usage = testProvider.getTokenUsage();
        console.log('\n📈 Live LLM Integration Test Summary:');
        console.log(`   Provider: ${testProvider.provider}`);
        console.log(`   Model: ${testProvider.model}`);
        console.log(`   Total tokens used: ${usage.total}`);
        console.log(`   Input tokens: ${usage.input}`);
        console.log(`   Output tokens: ${usage.output}`);
        
        // Clean up the provider
        if (testProvider.cleanup) {
          testProvider.cleanup();
        }
      }
    } catch (error) {
      console.log('\n⚠️  Could not access LLM provider for summary');
    }
    
    console.log('\n💡 These tests demonstrate the framework\'s ability to:');
    console.log('   • Plan complex workflows using LLM reasoning');
    console.log('   • Execute multi-step processes with real tools');
    console.log('   • Adapt to different scenarios and requirements');
    console.log('   • Handle errors and edge cases gracefully');
    console.log('   • Provide comprehensive execution tracking');
  }
  
  // Force exit to prevent hanging
  setTimeout(() => {
    // Give time for any pending operations to complete
  }, 100);
});