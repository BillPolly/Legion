/**
 * Real LLM Integration Test
 * 
 * This test uses an actual LLM to plan and execute a simple Node.js program,
 * verifying each step along the way.
 */

import { jest } from '@jest/globals';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

// This test requires a real LLM API key
const ENABLE_REAL_LLM_TEST = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

// Skip if no API key available
const describeIfLLM = ENABLE_REAL_LLM_TEST ? describe : describe.skip;

// Increase timeout for LLM operations
jest.setTimeout(600000); // 10 minutes

describeIfLLM('Real LLM Workflow - Step by Step', () => {
  let agent;
  let testDir;
  let stepResults = {};

  beforeEach(async () => {
    // Create a unique test directory
    testDir = path.join(os.tmpdir(), `real-llm-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    console.log(`Test directory: ${testDir}`);
  });

  afterEach(async () => {
    // Cleanup
    if (agent) {
      await agent.cleanup();
    }
    
    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1: Initialize Enhanced Code Agent with real LLM', async () => {
    console.log('\n=== Step 1: Initializing Code Agent ===');
    
    // Determine which LLM to use
    const llmProvider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    console.log(`Using LLM provider: ${llmProvider}`);
    
    agent = new EnhancedCodeAgent({
      projectType: 'backend',
      enableConsoleOutput: true,
      enhancedConfig: {
        enableRuntimeTesting: true,
        enableBrowserTesting: false, // Backend only
        enableLogAnalysis: true,
        runtimeTimeout: 120000 // 2 minutes
      }
    });
    
    // Initialize with real LLM
    await agent.initialize(testDir, {
      llmConfig: {
        provider: llmProvider,
        apiKey: apiKey,
        model: llmProvider === 'openai' ? 'gpt-4' : 'claude-3-sonnet-20240229',
        temperature: 0.3, // Lower for more consistent results
        maxTokens: 4000
      }
    });
    
    // Verify initialization
    expect(agent.initialized).toBe(true);
    expect(agent.llmClient).toBeDefined();
    expect(agent.config.workingDirectory).toBe(testDir);
    
    stepResults.initialization = true;
    console.log('✅ Agent initialized successfully');
  });

  test('Step 2: Plan a simple Node.js program', async () => {
    console.log('\n=== Step 2: Planning Simple Node.js Program ===');
    
    // Initialize agent first
    await initializeAgent();
    
    // Simple, specific requirements to ensure consistent results
    const requirements = {
      projectName: 'Simple Calculator',
      description: 'A command-line calculator that adds two numbers',
      features: [
        'Read two numbers from command line arguments',
        'Add the numbers together',
        'Print the result',
        'Handle invalid inputs with error messages'
      ]
    };
    
    console.log('Planning project with requirements:', requirements);
    
    // Plan the project
    const plan = await agent.planProject(requirements);
    
    // Verify plan was created
    expect(plan).toBeDefined();
    expect(plan.name).toBe('Simple Calculator');
    expect(plan.fileStructure).toBeDefined();
    expect(plan.dependencies).toBeDefined();
    
    console.log('Generated file structure:', plan.fileStructure);
    console.log('Dependencies:', plan.dependencies);
    
    // Store plan for next steps
    stepResults.plan = plan;
    stepResults.planning = true;
    console.log('✅ Project planned successfully');
  });

  test('Step 3: Generate the calculator code', async () => {
    console.log('\n=== Step 3: Generating Calculator Code ===');
    
    // Initialize and plan first
    await initializeAgent();
    await planProject();
    
    // Generate code based on the plan
    console.log('Generating code...');
    await agent.generateCode();
    
    // Verify main file was created
    const mainFile = path.join(testDir, 'calculator.js');
    const mainFileExists = await fs.access(mainFile).then(() => true).catch(() => false);
    
    if (!mainFileExists) {
      // Try alternative names
      const files = await fs.readdir(testDir);
      console.log('Files in directory:', files);
      
      // Look for any .js file
      const jsFile = files.find(f => f.endsWith('.js') && f !== 'calculator.test.js');
      if (jsFile) {
        stepResults.mainFile = path.join(testDir, jsFile);
      }
    } else {
      stepResults.mainFile = mainFile;
    }
    
    expect(stepResults.mainFile).toBeDefined();
    
    // Read and verify the generated code
    const code = await fs.readFile(stepResults.mainFile, 'utf8');
    console.log('\nGenerated code:\n', code);
    
    // Basic validation
    expect(code).toContain('process.argv'); // Should read command line args
    expect(code).toMatch(/console\.log|process\.stdout\.write/); // Should output result
    
    stepResults.codeGeneration = true;
    console.log('✅ Code generated successfully');
  });

  test('Step 4: Generate tests for the calculator', async () => {
    console.log('\n=== Step 4: Generating Tests ===');
    
    // Initialize, plan, and generate code first
    await initializeAgent();
    await planProject();
    await generateCode();
    
    // Generate tests
    console.log('Generating tests...');
    await agent.generateTests();
    
    // Find test files
    const files = await fs.readdir(testDir, { recursive: true });
    const testFiles = files.filter(f => 
      f.includes('.test.js') || f.includes('.spec.js') || f.includes('test')
    );
    
    console.log('Test files found:', testFiles);
    expect(testFiles.length).toBeGreaterThan(0);
    
    // Read and verify test content
    if (testFiles.length > 0) {
      const testPath = path.join(testDir, testFiles[0]);
      const testCode = await fs.readFile(testPath, 'utf8');
      console.log('\nGenerated test code:\n', testCode);
      
      // Basic test validation
      expect(testCode).toMatch(/describe|test|it/); // Should have test structure
      expect(testCode).toContain('expect'); // Should have assertions
    }
    
    stepResults.testGeneration = true;
    console.log('✅ Tests generated successfully');
  });

  test('Step 5: Run the calculator with test inputs', async () => {
    console.log('\n=== Step 5: Running Calculator ===');
    
    // Complete all previous steps
    await initializeAgent();
    await planProject();
    await generateCode();
    
    // Test the calculator with actual inputs
    const testCases = [
      { args: ['5', '3'], expected: '8' },
      { args: ['10', '20'], expected: '30' },
      { args: ['invalid', '5'], shouldError: true }
    ];
    
    for (const testCase of testCases) {
      console.log(`\nTesting with args: ${testCase.args.join(', ')}`);
      
      try {
        const result = await runNodeProgram(stepResults.mainFile, testCase.args);
        console.log(`Output: ${result}`);
        
        if (testCase.shouldError) {
          // Should have handled the error gracefully
          expect(result.toLowerCase()).toMatch(/error|invalid|nan/i);
        } else {
          // Should contain the expected result
          expect(result).toContain(testCase.expected);
        }
      } catch (error) {
        if (!testCase.shouldError) {
          throw error;
        }
        console.log(`Expected error: ${error.message}`);
      }
    }
    
    stepResults.execution = true;
    console.log('✅ Calculator executed successfully');
  });

  test('Step 6: Run quality checks with real ESLint', async () => {
    console.log('\n=== Step 6: Running Quality Checks ===');
    
    // Complete all previous steps
    await initializeAgent();
    await planProject();
    await generateCode();
    await agent.generateTests();
    
    // Create package.json if it doesn't exist
    const packageJsonPath = path.join(testDir, 'package.json');
    const hasPackageJson = await fs.access(packageJsonPath).then(() => true).catch(() => false);
    
    if (!hasPackageJson) {
      const packageJson = {
        name: 'simple-calculator',
        version: '1.0.0',
        type: 'module',
        scripts: {
          test: 'jest',
          lint: 'eslint .'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'eslint': '^8.0.0'
        }
      };
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
    
    // Run enhanced quality checks
    console.log('Running quality checks...');
    const qualityResults = await agent.runEnhancedQualityChecks();
    
    console.log('Quality check results:', {
      eslint: {
        errors: qualityResults.eslint?.errorCount || 0,
        warnings: qualityResults.eslint?.warningCount || 0
      },
      tests: {
        total: qualityResults.jest?.totalTests || 0,
        passed: qualityResults.jest?.passed || 0,
        failed: qualityResults.jest?.failed || 0
      }
    });
    
    // Quality checks should pass or have minor issues
    expect(qualityResults).toBeDefined();
    
    stepResults.qualityChecks = true;
    console.log('✅ Quality checks completed');
  });

  test('Step 7: Apply fixes if needed', async () => {
    console.log('\n=== Step 7: Applying Fixes ===');
    
    // Complete all previous steps
    await initializeAgent();
    await planProject();
    await generateCode();
    await agent.generateTests();
    const qualityResults = await agent.runEnhancedQualityChecks();
    
    // Check if fixes are needed
    const needsFixes = 
      (qualityResults.eslint?.errorCount > 0) ||
      (qualityResults.jest?.failed > 0);
    
    if (needsFixes) {
      console.log('Issues found, applying fixes...');
      
      const fixResult = await agent.runEnhancedFixing();
      
      console.log('Fix results:', {
        success: fixResult.success,
        iterations: fixResult.iterations,
        totalFixes: fixResult.totalFixes
      });
      
      // Run quality checks again
      const afterFixQuality = await agent.runEnhancedQualityChecks();
      
      console.log('Quality after fixes:', {
        eslint: {
          errors: afterFixQuality.eslint?.errorCount || 0,
          warnings: afterFixQuality.eslint?.warningCount || 0
        }
      });
      
      // Should have fewer issues after fixes
      expect(afterFixQuality.eslint?.errorCount).toBeLessThanOrEqual(
        qualityResults.eslint?.errorCount || 0
      );
    } else {
      console.log('No fixes needed!');
    }
    
    stepResults.fixes = true;
    console.log('✅ Fix phase completed');
  });

  test('Step 8: Final validation', async () => {
    console.log('\n=== Step 8: Final Validation ===');
    
    // Complete full workflow
    await initializeAgent();
    await planProject();
    await generateCode();
    await agent.generateTests();
    await agent.runEnhancedQualityChecks();
    
    // Final summary
    const summary = await agent.generateEnhancedSummary();
    
    console.log('\nFinal Summary:');
    console.log('- Files generated:', summary.filesGenerated);
    console.log('- Tests created:', summary.testsCreated);
    console.log('- Quality passed:', summary.qualityPassed);
    
    // Verify we have a working calculator
    const finalResult = await runNodeProgram(stepResults.mainFile, ['100', '200']);
    console.log('\nFinal test: 100 + 200 =', finalResult);
    expect(finalResult).toContain('300');
    
    stepResults.validation = true;
    console.log('✅ Complete workflow validated successfully!');
    
    // Summary of all steps
    console.log('\n=== All Steps Summary ===');
    Object.entries(stepResults).forEach(([step, result]) => {
      console.log(`${step}: ${result ? '✅' : '❌'}`);
    });
  });

  // Helper functions
  async function initializeAgent() {
    if (!agent) {
      const llmProvider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
      const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
      
      agent = new EnhancedCodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false,
        enhancedConfig: {
          enableRuntimeTesting: true,
          enableBrowserTesting: false,
          enableLogAnalysis: true
        }
      });
      
      await agent.initialize(testDir, {
        llmConfig: {
          provider: llmProvider,
          apiKey: apiKey,
          model: llmProvider === 'openai' ? 'gpt-4' : 'claude-3-sonnet-20240229',
          temperature: 0.3
        }
      });
    }
  }

  async function planProject() {
    if (!stepResults.plan) {
      const requirements = {
        projectName: 'Simple Calculator',
        description: 'A command-line calculator that adds two numbers',
        features: [
          'Read two numbers from command line arguments',
          'Add the numbers together',
          'Print the result'
        ]
      };
      
      stepResults.plan = await agent.planProject(requirements);
    }
  }

  async function generateCode() {
    if (!stepResults.codeGeneration) {
      await agent.generateCode();
      
      // Find the main file
      const files = await fs.readdir(testDir);
      const jsFile = files.find(f => f.endsWith('.js') && !f.includes('test'));
      stepResults.mainFile = path.join(testDir, jsFile);
    }
  }

  async function runNodeProgram(filePath, args) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [filePath, ...args], {
        cwd: path.dirname(filePath)
      });
      
      let output = '';
      let error = '';
      
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      child.on('close', (code) => {
        if (code !== 0 && error) {
          reject(new Error(error));
        } else {
          resolve(output.trim());
        }
      });
      
      child.on('error', (err) => {
        reject(err);
      });
    });
  }
});

// Simpler test for quick validation
describe('Quick LLM Test', () => {
  test('Can initialize with mock LLM', async () => {
    const testDir = path.join(os.tmpdir(), `quick-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    try {
      const agent = new EnhancedCodeAgent({
        projectType: 'backend',
        enableConsoleOutput: false
      });
      
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'mock'
        }
      });
      
      expect(agent.initialized).toBe(true);
      
      await agent.cleanup();
    } finally {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });
});