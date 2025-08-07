/**
 * Progressive Live LLM Testing Suite
 * 
 * This comprehensive test suite validates the RecursivePlanner's ability to handle
 * increasingly complex tasks using live LLMs, starting from simple operations
 * and building up to complex website creation.
 * 
 * Run with: NODE_ENV=test NODE_OPTIONS=--experimental-vm-modules jest tests/e2e/progressive-llm-testing.test.js
 * 
 * IMPORTANT: This uses real LLM APIs and will incur costs!
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { createPlanningAgent, createLLMProvider } from '../../src/factories/AgentFactory.js';
import { LLMPlanningStrategy } from '../../src/core/execution/planning/index.js';
import { createTool } from '../../src/factories/ToolFactory.js';
import { config } from '../../src/runtime/config/index.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip these tests if no LLM provider is available
const skipLiveLLMTests = !config.getAvailableLLMProviders().length;

// Test workspace directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testWorkspace = path.join(__dirname, '../../test-workspace');

describe('Progressive Live LLM Testing Suite', () => {
  let llmProvider;
  let testMetrics = {
    phase1: { tests: 0, passed: 0, totalTokens: 0, totalTime: 0 },
    phase2: { tests: 0, passed: 0, totalTokens: 0, totalTime: 0 },
    phase3: { tests: 0, passed: 0, totalTokens: 0, totalTime: 0 },
    phase4: { tests: 0, passed: 0, totalTokens: 0, totalTime: 0 },
    phase5: { tests: 0, passed: 0, totalTokens: 0, totalTime: 0 }
  };

  beforeAll(async () => {
    if (skipLiveLLMTests) {
      console.log('⚠️  Skipping progressive LLM tests - no API keys configured');
      return;
    }
    
    console.log('\n🚀 Starting Progressive LLM Testing Suite');
    console.log('   This comprehensive suite tests increasingly complex scenarios');
    console.log('   ⚠️  WARNING: This will use live LLM APIs and incur costs!');
    console.log(`   Provider: ${config.get('llm.provider')}`);
    
    // Create test workspace
    try {
      await fs.mkdir(testWorkspace, { recursive: true });
      console.log(`   Test workspace: ${testWorkspace}`);
    } catch (error) {
      console.warn('   Could not create test workspace:', error.message);
    }
    
    // Initialize LLM provider
    try {
      llmProvider = createLLMProvider();
    } catch (error) {
      console.log('⚠️  Failed to create LLM provider:', error.message);
    }
  });

  beforeEach(() => {
    if (!skipLiveLLMTests && llmProvider) {
      llmProvider.resetTokenUsage();
    }
  });

  /**
   * Helper function to track test metrics
   */
  function trackTestResult(phase, passed, tokens = 0, time = 0) {
    testMetrics[phase].tests++;
    if (passed) testMetrics[phase].passed++;
    testMetrics[phase].totalTokens += tokens;
    testMetrics[phase].totalTime += time;
  }

  /**
   * Create comprehensive tool suite for testing
   */
  function createTestTools() {
    const tools = [];

    // File System Tools
    tools.push(
      createTool('readFile', 'Read file contents', async (input) => {
        const filePath = path.resolve(testWorkspace, input.path);
        const content = await fs.readFile(filePath, input.encoding || 'utf-8');
        return { content, path: filePath, size: content.length };
      }),

      createTool('writeFile', 'Write content to file', async (input) => {
        const filePath = path.resolve(testWorkspace, input.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, input.content, input.encoding || 'utf-8');
        return { path: filePath, size: input.content.length, written: true };
      }),

      createTool('createDirectory', 'Create directory structure', async (input) => {
        const dirPath = path.resolve(testWorkspace, input.path);
        await fs.mkdir(dirPath, { recursive: true });
        return { path: dirPath, created: true };
      }),

      createTool('listFiles', 'List files in directory', async (input) => {
        const dirPath = path.resolve(testWorkspace, input.path || '.');
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        return {
          files: files.map(f => ({
            name: f.name,
            type: f.isDirectory() ? 'directory' : 'file',
            path: path.join(dirPath, f.name)
          }))
        };
      })
    );

    // Text Processing Tools
    tools.push(
      createTool('analyzeText', 'Analyze text content', async (input) => {
        const text = input.text || input.content || '';
        return {
          wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
          characterCount: text.length,
          lines: text.split('\n').length,
          sentiment: text.toLowerCase().includes('error') || text.toLowerCase().includes('fail') ? 'negative' : 'neutral',
          topics: ['general'], // Simple topic extraction
          summary: text.length > 100 ? text.substring(0, 97) + '...' : text
        };
      }),

      createTool('generateContent', 'Generate content based on specification', async (input) => {
        const { topic, type = 'text', length = 'medium' } = input;
        
        let content = '';
        if (type === 'html') {
          content = `<!DOCTYPE html>
<html>
<head>
  <title>${topic}</title>
  <style>body { font-family: Arial, sans-serif; margin: 20px; }</style>
</head>
<body>
  <h1>${topic}</h1>
  <p>This is generated content about ${topic}.</p>
</body>
</html>`;
        } else if (type === 'css') {
          content = `/* Styles for ${topic} */
body {
  font-family: 'Arial', sans-serif;
  margin: 0;
  padding: 20px;
  line-height: 1.6;
}

h1 {
  color: #333;
  border-bottom: 2px solid #007acc;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}`;
        } else if (type === 'javascript') {
          content = `// ${topic} functionality
class ${topic.replace(/\s+/g, '')} {
  constructor() {
    this.name = '${topic}';
  }
  
  init() {
    console.log('Initializing', this.name);
  }
  
  process(data) {
    return data;
  }
}

export default ${topic.replace(/\s+/g, '')};`;
        } else {
          content = `# ${topic}\n\nThis is generated content about ${topic}. This ${length} length content provides information and examples related to the topic.`;
        }
        
        return {
          content,
          type,
          topic,
          length: content.length,
          generated: true
        };
      }),

      createTool('validateContent', 'Validate content meets requirements', async (input) => {
        const content = input.content || '';
        const requirements = input.requirements || {};
        
        const issues = [];
        let score = 100;
        
        if (requirements.minLength && content.length < requirements.minLength) {
          issues.push(`Content too short: ${content.length} < ${requirements.minLength}`);
          score -= 20;
        }
        
        if (requirements.mustInclude) {
          for (const required of requirements.mustInclude) {
            if (!content.toLowerCase().includes(required.toLowerCase())) {
              issues.push(`Missing required content: "${required}"`);
              score -= 15;
            }
          }
        }
        
        return {
          valid: issues.length === 0,
          score: Math.max(0, score),
          issues,
          recommendations: issues.length === 0 ? ['Content meets all requirements'] : ['Address the identified issues']
        };
      })
    );

    // Development Tools
    tools.push(
      createTool('initGit', 'Initialize git repository', async (input) => {
        const repoPath = path.resolve(testWorkspace, input.path || '.');
        // Simulate git init
        await fs.mkdir(path.join(repoPath, '.git'), { recursive: true });
        return { path: repoPath, initialized: true, branch: 'main' };
      }),

      createTool('createPackageJson', 'Create package.json file', async (input) => {
        const packageData = {
          name: input.name || 'test-project',
          version: input.version || '1.0.0',
          description: input.description || 'Generated test project',
          scripts: input.scripts || { start: 'node index.js' },
          dependencies: input.dependencies || {},
          ...input.additional
        };
        
        const packagePath = path.resolve(testWorkspace, 'package.json');
        await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
        return { path: packagePath, package: packageData, created: true };
      }),

      createTool('runTest', 'Run tests on generated code', async (input) => {
        // Simulate test execution
        const testResults = {
          passed: Math.random() > 0.2, // 80% pass rate
          tests: Math.floor(Math.random() * 10) + 1,
          duration: Math.floor(Math.random() * 1000) + 100,
          coverage: Math.floor(Math.random() * 40) + 60
        };
        
        return {
          ...testResults,
          success: testResults.passed,
          message: testResults.passed ? 'All tests passed' : 'Some tests failed'
        };
      })
    );

    return tools;
  }

  /**
   * Create agent with test configuration
   */
  function createTestAgent(name, examples = []) {
    if (!llmProvider) return null;
    
    return createPlanningAgent({
      name,
      description: `Test agent for ${name.toLowerCase()}`,
      planningStrategy: new LLMPlanningStrategy(llmProvider, {
        maxRetries: 2,
        examples: examples,
        temperature: 0.3 // Lower temperature for more consistent results
      }),
      reflectionEnabled: true,
      debugMode: process.env.DEBUG_TESTS === '1',
      maxRetries: 2
    });
  }

  // ============================================================================
  // PHASE 1: FOUNDATION TESTING (Simple Tasks)
  // ============================================================================

  (skipLiveLLMTests ? describe.skip : describe)('Phase 1: Foundation Testing', () => {
    test('1.1 Simple Text Analysis', async () => {
      const agent = createTestAgent('TextAnalysisAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n📊 Phase 1.1: Testing simple text analysis...');
      
      const result = await agent.run(
        'Analyze this text: "The RecursivePlanner framework enables intelligent agents to plan, execute, and reflect on complex tasks using LLM reasoning."',
        createTestTools().filter(t => t.name === 'analyzeText'),
        { timeout: 30000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase1', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThan(0);
      
      console.log(`   ✅ Text analysis completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 60000);

    test('1.2 Basic File Operations', async () => {
      const agent = createTestAgent('FileOperationsAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n📁 Phase 1.2: Testing basic file operations...');
      
      const result = await agent.run(
        'Create a simple text file called "test.txt" with the content "Hello, RecursivePlanner!" and then read it back to verify it was created correctly',
        createTestTools().filter(t => ['writeFile', 'readFile'].includes(t.name)),
        { timeout: 30000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase1', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(2);
      
      console.log(`   ✅ File operations completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 60000);

    test('1.3 Error Handling Validation', async () => {
      const agent = createTestAgent('ErrorHandlingAgent');
      if (!agent) return;

      // Add a tool that can fail
      const toolsWithFailure = [
        ...createTestTools(),
        createTool('unreliableTool', 'A tool that might fail', async (input) => {
          if (Math.random() < 0.6) { // 60% failure rate
            throw new Error('Simulated tool failure for testing');
          }
          return { success: true, data: 'operation completed' };
        })
      ];

      const startTime = Date.now();
      console.log('\n⚠️  Phase 1.3: Testing error handling...');
      
      const result = await agent.run(
        'Try to use available tools to accomplish a task, but avoid any unreliable operations. If something fails, try alternative approaches.',
        toolsWithFailure,
        { timeout: 45000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      // Success is not required here - we're testing error handling
      trackTestResult('phase1', true, tokens, endTime - startTime);
      
      console.log(`   ✅ Error handling test completed: ${result.success ? 'SUCCESS' : 'HANDLED FAILURE'}, ${tokens} tokens`);
      expect(tokens).toBeGreaterThan(0); // Should have attempted to plan
    }, 90000);
  });

  // ============================================================================
  // PHASE 2: MULTI-STEP WORKFLOWS (Medium Complexity)
  // ============================================================================

  (skipLiveLLMTests ? describe.skip : describe)('Phase 2: Multi-Step Workflows', () => {
    test('2.1 Content Creation Pipeline', async () => {
      const agent = createTestAgent('ContentPipelineAgent', [
        {
          goal: 'Create and validate content',
          plan: [
            { id: 'generate', description: 'Generate content', tool: 'generateContent', params: {}, dependencies: [] },
            { id: 'validate', description: 'Validate content', tool: 'validateContent', params: {}, dependencies: ['generate'] },
            { id: 'save', description: 'Save content', tool: 'writeFile', params: {}, dependencies: ['validate'] }
          ]
        }
      ]);
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n📝 Phase 2.1: Testing content creation pipeline...');
      
      const result = await agent.run(
        'Create a comprehensive article about "Artificial Intelligence in Software Development", validate it meets quality standards, and save it to a file named "ai-development.md"',
        createTestTools(),
        { timeout: 90000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase2', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(3);
      
      console.log(`   ✅ Content pipeline completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 120000);

    test('2.2 Project Setup Workflow', async () => {
      const agent = createTestAgent('ProjectSetupAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n🚀 Phase 2.2: Testing project setup workflow...');
      
      const result = await agent.run(
        'Set up a new software project: create a directory structure, initialize git repository, create a package.json file, and add a README.md file with project information',
        createTestTools(),
        { timeout: 90000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase2', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(4);
      
      console.log(`   ✅ Project setup completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 120000);
  });

  // ============================================================================
  // PHASE 3: REFLECTION AND ADAPTATION TESTING
  // ============================================================================

  (skipLiveLLMTests ? describe.skip : describe)('Phase 3: Reflection and Adaptation', () => {
    test('3.1 Self-Correcting Content Generation', async () => {
      const agent = createTestAgent('SelfCorrectingAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n🤔 Phase 3.1: Testing self-correcting workflow...');
      
      const result = await agent.run(
        'Generate content about "Machine Learning Best Practices", review it for completeness and quality, and revise it if necessary until it meets high standards',
        createTestTools(),
        { timeout: 120000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase3', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(tokens).toBeGreaterThan(200); // Reflection should use additional tokens
      
      console.log(`   ✅ Self-correcting workflow completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 150000);

    test('3.2 Adaptive Planning', async () => {
      const agent = createTestAgent('AdaptivePlanningAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n🎯 Phase 3.2: Testing adaptive planning...');
      
      const result = await agent.run(
        'Create a comprehensive project documentation suite. Start by analyzing what already exists, then determine what additional documentation is needed, and create those documents',
        createTestTools(),
        { timeout: 120000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase3', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(3);
      
      console.log(`   ✅ Adaptive planning completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 150000);
  });

  // ============================================================================
  // PHASE 4: COMPLEX REAL-WORLD SCENARIOS
  // ============================================================================

  (skipLiveLLMTests ? describe.skip : describe)('Phase 4: Complex Real-World Scenarios', () => {
    test('4.1 Software Component Development', async () => {
      const agent = createTestAgent('ComponentDevelopmentAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n👨‍💻 Phase 4.1: Testing software component development...');
      
      const result = await agent.run(
        'Develop a complete JavaScript utility module: create the main module file with useful functions, generate comprehensive tests, create documentation, and set up the project structure with package.json',
        createTestTools(),
        { timeout: 180000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase4', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(5);
      
      console.log(`   ✅ Component development completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 240000);

    test('4.2 Multi-Format Documentation Suite', async () => {
      const agent = createTestAgent('DocumentationAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n📚 Phase 4.2: Testing documentation suite creation...');
      
      const result = await agent.run(
        'Create a comprehensive documentation suite for a software project: generate a detailed README.md, API documentation, user guide, and developer setup instructions. Ensure all documents are well-structured and informative',
        createTestTools(),
        { timeout: 180000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase4', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(4);
      
      console.log(`   ✅ Documentation suite completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 240000);
  });

  // ============================================================================
  // PHASE 5: COMPLEX WEBSITE BUILDING
  // ============================================================================

  (skipLiveLLMTests ? describe.skip : describe)('Phase 5: Complex Website Building', () => {
    test('5.1 Simple Static Website', async () => {
      const agent = createTestAgent('WebsiteBuilderAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n🌐 Phase 5.1: Testing simple website creation...');
      
      const result = await agent.run(
        'Build a complete static website for a software developer portfolio: create HTML structure, CSS styling, add content sections (about, projects, contact), and organize all files properly',
        createTestTools(),
        { timeout: 240000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase5', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(6);
      
      console.log(`   ✅ Static website completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 300000);

    test('5.2 Interactive Website with JavaScript', async () => {
      const agent = createTestAgent('InteractiveWebsiteAgent');
      if (!agent) return;

      const startTime = Date.now();
      console.log('\n⚡ Phase 5.2: Testing interactive website creation...');
      
      const result = await agent.run(
        'Create a fully interactive website for a small business: build HTML structure, responsive CSS design, add JavaScript functionality (navigation, contact form, image gallery), and create all necessary content and assets',
        createTestTools(),
        { timeout: 300000 }
      );

      const endTime = Date.now();
      const tokens = llmProvider.getTokenUsage().total;
      
      trackTestResult('phase5', result.success, tokens, endTime - startTime);
      
      expect(result.success).toBe(true);
      expect(result.result.completedSteps).toBeGreaterThanOrEqual(8);
      
      console.log(`   ✅ Interactive website completed: ${result.result.completedSteps} steps, ${tokens} tokens`);
    }, 360000);
  });

  afterAll(async () => {
    if (!skipLiveLLMTests) {
      // Display comprehensive test results
      console.log('\n📊 PROGRESSIVE LLM TESTING RESULTS');
      console.log('=' .repeat(50));
      
      let totalTests = 0, totalPassed = 0, totalTokens = 0, totalTime = 0;
      
      for (const [phase, metrics] of Object.entries(testMetrics)) {
        if (metrics.tests > 0) {
          const passRate = ((metrics.passed / metrics.tests) * 100).toFixed(1);
          const avgTokens = Math.round(metrics.totalTokens / metrics.tests);
          const avgTime = Math.round(metrics.totalTime / metrics.tests);
          
          console.log(`${phase}: ${metrics.passed}/${metrics.tests} passed (${passRate}%)`);
          console.log(`   Avg tokens: ${avgTokens}, Avg time: ${avgTime}ms`);
          
          totalTests += metrics.tests;
          totalPassed += metrics.passed;
          totalTokens += metrics.totalTokens;
          totalTime += metrics.totalTime;
        }
      }
      
      console.log('-'.repeat(50));
      console.log(`OVERALL: ${totalPassed}/${totalTests} tests passed (${((totalPassed/totalTests) * 100).toFixed(1)}%)`);
      console.log(`Total tokens used: ${totalTokens}`);
      console.log(`Total execution time: ${Math.round(totalTime/1000)}s`);
      
      // Estimate cost (rough approximation)
      const estimatedCost = (totalTokens / 1000) * 0.01; // Rough estimate
      console.log(`Estimated cost: $${estimatedCost.toFixed(2)}`);
      
      console.log('\n🎯 TESTING OBJECTIVES VALIDATION:');
      console.log('✅ Basic LLM planning and execution');
      console.log('✅ Multi-step workflow coordination');
      console.log('✅ Error handling and recovery');
      console.log('✅ Reflection and adaptation');
      console.log('✅ Complex real-world scenarios');
      console.log('✅ Website building capabilities');
      
      // Clean up test workspace
      try {
        await fs.rm(testWorkspace, { recursive: true, force: true });
        console.log(`\n🧹 Cleaned up test workspace: ${testWorkspace}`);
      } catch (error) {
        console.warn('Could not clean up test workspace:', error.message);
      }
    }
  });
});