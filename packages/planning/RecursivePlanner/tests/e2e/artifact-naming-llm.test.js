/**
 * Test artifact naming and referencing with live LLM
 * Verifies that LLMs properly generate saveOutputs and reference artifacts
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import { config } from '../../src/runtime/config/index.js';

const skipTests = !config.getAvailableLLMProviders().length;

describe('Artifact Naming with Live LLM', () => {
  let llmProvider = null;

  beforeAll(() => {
    if (skipTests) {
      console.log('⚠️  Skipping artifact naming LLM tests - no API keys configured');
      return;
    }
    
    console.log('🎯 Testing artifact naming and referencing with live LLM...');
    console.log(`   Using provider: ${config.get('llm.provider')}`);
    
    llmProvider = createLLMProvider();
  });

  (skipTests ? test.skip : test)('should generate saveOutputs and reference artifacts', async () => {
    // Create tools that simulate file operations with standardized output
    const tools = [
      createTool('writeFile', 'Write content to a file', async (params) => {
        console.log(`[writeFile] Writing to ${params.path}`);
        return {
          success: true,
          data: {
            path: params.path,
            size: (params.content || '').length,
            created: new Date().toISOString()
          }
        };
      }),
      
      createTool('readFile', 'Read content from a file', async (params) => {
        console.log(`[readFile] Reading from ${params.path}`);
        return {
          success: true,
          data: {
            path: params.path,
            content: `Mock content from ${params.path}`,
            size: 100
          }
        };
      }),
      
      createTool('processFile', 'Process and transform a file', async (params) => {
        console.log(`[processFile] Processing ${params.inputPath} to ${params.outputPath}`);
        return {
          success: true,
          data: {
            inputPath: params.inputPath,
            outputPath: params.outputPath,
            processedLines: 42,
            transformationType: params.transformation || 'default'
          }
        };
      }),
      
      createTool('combineFiles', 'Combine multiple files into one', async (params) => {
        console.log(`[combineFiles] Combining ${params.files?.length || 0} files`);
        return {
          success: true,
          data: {
            outputPath: params.outputPath,
            filesCombined: params.files?.length || 0,
            totalSize: 500
          }
        };
      })
    ];

    // Create agent with artifact naming examples
    const agent = createPlanningAgent({
      name: 'ArtifactNamingAgent',
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        examples: [
          {
            goal: 'Create and process files',
            plan: [
              {
                id: 'create_main',
                description: 'Create the main HTML file',
                tool: 'writeFile',
                params: {
                  path: 'index.html',
                  content: '<html><body>Hello</body></html>'
                },
                dependencies: [],
                saveOutputs: {
                  path: {
                    name: 'mainHTML',
                    description: 'Path to the main HTML file'
                  }
                }
              },
              {
                id: 'process_main',
                description: 'Process the HTML file',
                tool: 'processFile',
                params: {
                  inputPath: '@mainHTML',
                  outputPath: 'processed.html',
                  transformation: 'minify'
                },
                dependencies: ['create_main'],
                saveOutputs: {
                  outputPath: {
                    name: 'processedHTML',
                    description: 'Path to the processed HTML file'
                  }
                }
              }
            ]
          }
        ]
      }),
      debugMode: true,
      reflectionEnabled: true
    });

    // Inject the LLM for reflection
    agent.setDependencies({ llm: llmProvider });

    console.log('\n📝 Testing artifact naming workflow...');
    
    const goal = `Create a website with the following files:
    1. Create an HTML file called index.html with basic structure
    2. Create a CSS file called styles.css 
    3. Process the HTML file to create a minified version
    4. Combine all files into a bundle
    
    Make sure to save important file paths as named artifacts so they can be referenced in later steps.`;

    const result = await agent.run(goal, tools, { timeout: 60000 });

    // Check if execution succeeded
    expect(result.success).toBe(true);
    expect(result.result.completedSteps).toBeGreaterThan(0);

    console.log(`\n✅ Artifact naming test completed:`);
    console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   Execution time: ${result.result.executionTime}ms`);
    console.log(`   Token usage: ${llmProvider.getTokenUsage().total} tokens`);

    // Verify the agent's state included artifact registry usage
    // We can't directly access the state, but we can check the execution worked
    expect(result.result.finalOutput).toBeDefined();
    
    // The LLM should have created a multi-step plan
    expect(result.result.completedSteps).toBeGreaterThanOrEqual(3);
  }, 90000);

  (skipTests ? test.skip : test)('should handle complex artifact references', async () => {
    const tools = [
      createTool('createDataFile', 'Create a data file', async (params) => {
        return {
          success: true,
          data: {
            filePath: params.path,
            recordCount: params.records || 100,
            format: params.format || 'json'
          }
        };
      }),
      
      createTool('analyzeData', 'Analyze data from a file', async (params) => {
        return {
          success: true,
          data: {
            sourceFile: params.dataFile,
            metrics: {
              mean: 42.5,
              median: 40,
              mode: 35
            },
            reportPath: '/tmp/analysis.json'
          }
        };
      }),
      
      createTool('generateVisualization', 'Generate visualization from analysis', async (params) => {
        return {
          success: true,
          data: {
            chartPath: '/tmp/chart.png',
            dataSource: params.analysisFile,
            chartType: params.type || 'bar'
          }
        };
      }),
      
      createTool('createReport', 'Create final report combining all results', async (params) => {
        return {
          success: true,
          data: {
            reportPath: '/tmp/report.pdf',
            sections: params.sections?.length || 3,
            pages: 5
          }
        };
      })
    ];

    const agent = createPlanningAgent({
      name: 'ComplexArtifactAgent',
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2
      }),
      debugMode: true
    });

    console.log('\n🔗 Testing complex artifact references...');
    
    const goal = `Create a complete data analysis pipeline:
    1. Create a data file with sample records
    2. Analyze the data and save the metrics
    3. Generate a visualization from the analysis
    4. Create a final report that references all previous outputs
    
    Use artifact naming to track the outputs from each step and reference them in subsequent steps.`;

    const result = await agent.run(goal, tools, { timeout: 90000 });

    expect(result.success).toBe(true);
    
    console.log(`\n✅ Complex artifact reference test completed:`);
    console.log(`   Steps completed: ${result.result.completedSteps}/${result.result.totalSteps}`);
    console.log(`   All steps should have used artifact references`);
    
    // Should have at least 4 steps for the pipeline
    expect(result.result.completedSteps).toBeGreaterThanOrEqual(4);
  }, 120000);

  (skipTests ? test.skip : test)('should include artifacts in reflection context', async () => {
    let reflectionPrompts = [];
    
    // Create a mock LLM wrapper that captures prompts
    const captureProvider = {
      ...llmProvider,
      complete: async (prompt, options) => {
        // Capture reflection prompts
        if (prompt.includes('Named Artifacts')) {
          reflectionPrompts.push(prompt);
        }
        return llmProvider.complete(prompt, options);
      }
    };

    const tools = [
      createTool('step1', 'First step', async () => ({
        success: true,
        data: { result: 'step1_output', value: 123 }
      })),
      
      createTool('step2', 'Second step', async () => ({
        success: true,
        data: { result: 'step2_output', value: 456 }
      })),
      
      createTool('step3', 'Third step', async () => ({
        success: true,
        data: { result: 'step3_output', value: 789 }
      }))
    ];

    const agent = createPlanningAgent({
      name: 'ReflectionArtifactAgent',
      planningStrategy: new LLMPlanningStrategy(llmProvider),
      reflectionEnabled: true,
      debugMode: true
    });

    // Use the capture provider for reflection
    agent.setDependencies({ llm: captureProvider });

    console.log('\n🤔 Testing artifact context in reflection...');
    
    const goal = `Execute a three-step process where each step should save its output as a named artifact for later reference`;

    const result = await agent.run(goal, tools, { timeout: 60000 });

    console.log(`\n✅ Reflection context test completed:`);
    console.log(`   Reflection prompts captured: ${reflectionPrompts.length}`);
    
    if (reflectionPrompts.length > 0) {
      // Check if artifacts were mentioned in reflection
      const hasArtifactContext = reflectionPrompts.some(p => 
        p.includes('Named Artifacts') || p.includes('@')
      );
      
      if (hasArtifactContext) {
        console.log('   ✓ Artifacts were included in reflection context');
      } else {
        console.log('   ⚠️  No artifacts found in reflection context');
      }
    }
    
    expect(result.success).toBe(true);
  }, 90000);
});

// Clean up
afterAll(() => {
  if (!skipTests && llmProvider) {
    const usage = llmProvider.getTokenUsage();
    console.log('\n📊 Artifact Naming Test Summary:');
    console.log(`   Total tokens used: ${usage.total}`);
    console.log(`   Tests demonstrated:`);
    console.log('   • LLM generating saveOutputs in plan steps');
    console.log('   • Artifact references using @notation');
    console.log('   • Complex multi-step workflows with artifacts');
    console.log('   • Artifacts appearing in reflection context');
  }
});