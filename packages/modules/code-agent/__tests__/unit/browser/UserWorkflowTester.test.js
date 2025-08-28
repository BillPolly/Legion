/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { UserWorkflowTester } from '../../../src/browser/UserWorkflowTester.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('UserWorkflowTester', () => {
  let workflowTester;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      },
      playwright: {
        headless: true,
        timeout: 30000,
        browsers: ['chromium'],
        baseURL: 'http://localhost:3000'
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-workflow-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    workflowTester = new UserWorkflowTester(mockConfig);
  });

    afterEach(async () => {
    if (workflowTester) {
      try {
        await workflowTester.cleanup();
      } catch (error) {
        console.warn('Cleanup error (ignored):', error.message);
      }
      workflowTester = null;
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(workflowTester.config).toBeDefined();
      expect(workflowTester.isInitialized).toBe(false);
      expect(workflowTester.workflows).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await workflowTester.initialize();
      
      expect(workflowTester.isInitialized).toBe(true);
      expect(workflowTester.e2eRunner).toBeDefined();
      expect(workflowTester.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await workflowTester.initialize();
      
      await expect(workflowTester.initialize()).resolves.not.toThrow();
      expect(workflowTester.isInitialized).toBe(true);
    });
  });

  describe('Workflow Definition', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should define login workflow', async () => {
      const workflow = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successUrl: '/dashboard'
      });
      
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('Login Workflow');
      expect(workflow.steps).toBeDefined();
      expect(workflow.steps.length).toBeGreaterThan(0);
    });

    test('should define signup workflow', async () => {
      const workflow = await workflowTester.defineSignupWorkflow({
        emailSelector: '#email',
        passwordSelector: '#password',
        confirmPasswordSelector: '#confirmPassword',
        submitSelector: '#signup',
        successUrl: '/welcome'
      });
      
      expect(workflow.name).toBe('Signup Workflow');
      expect(workflow.steps).toContainEqual(expect.objectContaining({
        action: 'fill',
        selector: '#confirmPassword'
      }));
    });

    test('should define checkout workflow', async () => {
      const workflow = await workflowTester.defineCheckoutWorkflow({
        productSelector: '.product',
        addToCartSelector: '.add-to-cart',
        cartSelector: '.cart',
        checkoutSelector: '#checkout',
        paymentDetails: {
          cardNumber: '4111111111111111',
          expiryDate: '12/25',
          cvv: '123'
        }
      });
      
      expect(workflow.name).toBe('Checkout Workflow');
      expect(workflow.steps).toContainEqual(expect.objectContaining({
        action: 'click',
        selector: '.add-to-cart'
      }));
    });

    test('should define search workflow', async () => {
      const workflow = await workflowTester.defineSearchWorkflow({
        searchSelector: '#search',
        searchTerm: 'test product',
        resultsSelector: '.search-results',
        expectedResultCount: 10
      });
      
      expect(workflow.name).toBe('Search Workflow');
      expect(workflow.steps).toContainEqual(expect.objectContaining({
        action: 'fill',
        selector: '#search',
        value: 'test product'
      }));
    });

    test('should define custom workflow', async () => {
      const workflow = await workflowTester.defineCustomWorkflow('Custom Flow', [
        { action: 'navigate', url: '/home' },
        { action: 'click', selector: '.menu' },
        { action: 'wait', duration: 1000 },
        { action: 'screenshot', name: 'menu-open' }
      ]);
      
      expect(workflow.name).toBe('Custom Flow');
      expect(workflow.steps).toHaveLength(4);
    });
  });

  describe('Workflow Recording', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should start workflow recording', async () => {
      const result = await workflowTester.startRecording('test-recording');
      
      expect(result.recording).toBe(true);
      expect(result.sessionId).toBeDefined();
    });

    test('should stop workflow recording', async () => {
      await workflowTester.startRecording('test-recording');
      const workflow = await workflowTester.stopRecording();
      
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('test-recording');
      expect(workflow.steps).toBeDefined();
    });

    test('should convert recording to workflow', async () => {
      const recording = {
        name: 'recorded-flow',
        events: [
          { type: 'navigate', url: '/home', timestamp: 100 },
          { type: 'click', selector: 'button', timestamp: 200 },
          { type: 'input', selector: '#field', value: 'test', timestamp: 300 }
        ]
      };
      
      const workflow = await workflowTester.convertRecordingToWorkflow(recording);
      
      expect(workflow.name).toBe('recorded-flow');
      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].action).toBe('navigate');
      expect(workflow.steps[1].action).toBe('click');
      expect(workflow.steps[2].action).toBe('fill');
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should execute workflow', async () => {
      const workflow = await workflowTester.defineCustomWorkflow('Test Flow', [
        { action: 'navigate', url: '/test' },
        { action: 'click', selector: 'button' }
      ]);
      
      const result = await workflowTester.executeWorkflow(workflow);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
    });

    test('should execute workflow with retry', async () => {
      const workflow = await workflowTester.defineCustomWorkflow('Retry Flow', [
        { action: 'navigate', url: '/test' },
        { action: 'click', selector: '.sometimes-fails' }
      ]);
      
      const result = await workflowTester.executeWorkflowWithRetry(workflow, { maxRetries: 3 });
      
      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    test('should execute workflow in parallel', async () => {
      const workflow1 = await workflowTester.defineCustomWorkflow('Flow 1', [
        { action: 'navigate', url: '/page1' }
      ]);
      
      const workflow2 = await workflowTester.defineCustomWorkflow('Flow 2', [
        { action: 'navigate', url: '/page2' }
      ]);
      
      const results = await workflowTester.executeParallelWorkflows([workflow1, workflow2]);
      
      expect(results).toHaveLength(2);
      expect(results[0].workflow).toBe('Flow 1');
      expect(results[1].workflow).toBe('Flow 2');
    });
  });

  describe('Workflow Validation', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should validate workflow steps', async () => {
      const workflow = {
        name: 'Test',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'click', selector: 'button' },
          { action: 'invalid-action' } // Invalid
        ]
      };
      
      const validation = await workflowTester.validateWorkflow(workflow);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Invalid action');
    });

    test('should validate workflow dependencies', async () => {
      const workflow = {
        name: 'Test',
        steps: [
          { action: 'click', selector: '#submit' }, // Click before navigate
          { action: 'navigate', url: '/test' }
        ]
      };
      
      const validation = await workflowTester.validateWorkflowDependencies(workflow);
      
      expect(validation.valid).toBe(false);
      expect(validation.warnings).toContain('Click action before navigation may fail');
    });

    test('should suggest workflow improvements', async () => {
      const workflow = {
        name: 'Test',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'wait', duration: 5000 }, // Long wait
          { action: 'click', selector: 'button' }
        ]
      };
      
      const suggestions = await workflowTester.suggestWorkflowImprovements(workflow);
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toContain('wait for element');
    });
  });

  describe('Workflow Analytics', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should analyze workflow performance', async () => {
      const workflow = await workflowTester.defineCustomWorkflow('Perf Test', [
        { action: 'navigate', url: '/test' },
        { action: 'click', selector: 'button' }
      ]);
      
      await workflowTester.executeWorkflow(workflow);
      const analysis = await workflowTester.analyzeWorkflowPerformance(workflow.name);
      
      expect(analysis).toBeDefined();
      expect(analysis.averageDuration).toBeDefined();
      expect(analysis.successRate).toBeDefined();
      expect(analysis.bottlenecks).toBeDefined();
    });

    test('should compare workflow versions', async () => {
      const workflowV1 = await workflowTester.defineCustomWorkflow('Test v1', [
        { action: 'navigate', url: '/test' },
        { action: 'wait', duration: 2000 },
        { action: 'click', selector: 'button' }
      ]);
      
      const workflowV2 = await workflowTester.defineCustomWorkflow('Test v2', [
        { action: 'navigate', url: '/test' },
        { action: 'click', selector: 'button' }
      ]);
      
      const comparison = await workflowTester.compareWorkflowVersions(workflowV1, workflowV2);
      
      expect(comparison).toBeDefined();
      expect(comparison.stepsDifference).toBe(1);
      expect(comparison.performanceImprovement).toBeGreaterThan(0);
    });

    test('should identify workflow patterns', async () => {
      // Create multiple similar workflows
      await workflowTester.defineLoginWorkflow({
        usernameSelector: '#user1',
        passwordSelector: '#pass1',
        submitSelector: '#submit1',
        successUrl: '/dashboard'
      });
      
      // Create a second login workflow with different name
      const workflow2 = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#user2',
        passwordSelector: '#pass2',
        submitSelector: '#submit2',
        successUrl: '/home'
      });
      // Manually change the name to make it unique
      workflow2.name = 'Login Workflow 2';
      workflowTester.workflows.set(workflow2.name, workflow2);
      
      const patterns = await workflowTester.identifyWorkflowPatterns();
      
      expect(patterns).toBeDefined();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].type).toBe('login');
    });
  });

  describe('Test Generation', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should generate workflow tests', async () => {
      const workflow = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successUrl: '/dashboard'
      });
      
      const tests = await workflowTester.generateWorkflowTests(workflow, 'playwright');
      
      expect(tests).toBeDefined();
      expect(tests.length).toBeGreaterThan(0);
      expect(tests[0].code).toContain('test(');
      expect(tests[0].code).toContain('page.fill');
    });

    test('should generate data-driven tests', async () => {
      const workflow = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successUrl: '/dashboard'
      });
      
      const testData = [
        { username: 'user1', password: 'pass1', expected: 'success' },
        { username: 'invalid', password: 'wrong', expected: 'failure' }
      ];
      
      const tests = await workflowTester.generateDataDrivenTests(workflow, testData, 'playwright');
      
      expect(tests.length).toBe(2);
      expect(tests[0].code).toContain('user1');
      expect(tests[1].code).toContain('invalid');
    });

    test('should generate edge case tests', async () => {
      const workflow = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successUrl: '/dashboard'
      });
      
      const edgeCases = await workflowTester.generateEdgeCaseTests(workflow, 'playwright');
      
      expect(edgeCases.length).toBeGreaterThan(0);
      expect(edgeCases).toContainEqual(expect.objectContaining({
        name: expect.stringContaining('empty fields')
      }));
    });
  });

  describe('Workflow Optimization', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should optimize workflow steps', async () => {
      const workflow = {
        name: 'Unoptimized',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'wait', duration: 2000 },
          { action: 'wait', duration: 1000 },
          { action: 'click', selector: 'button' }
        ]
      };
      
      const optimized = await workflowTester.optimizeWorkflow(workflow);
      
      expect(optimized.steps.length).toBeLessThan(workflow.steps.length);
      expect(optimized.optimizations).toContain('Merged consecutive wait steps');
    });

    test('should remove redundant steps', async () => {
      const workflow = {
        name: 'Redundant',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'navigate', url: '/test' }, // Redundant
          { action: 'click', selector: 'button' }
        ]
      };
      
      const optimized = await workflowTester.removeRedundantSteps(workflow);
      
      expect(optimized.steps).toHaveLength(2);
      expect(optimized.removedSteps).toBe(1);
    });

    test('should add smart waits', async () => {
      const workflow = {
        name: 'No Waits',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'click', selector: '#dynamic-button' }
        ]
      };
      
      const enhanced = await workflowTester.addSmartWaits(workflow);
      
      expect(enhanced.steps.length).toBeGreaterThan(workflow.steps.length);
      expect(enhanced.steps[1].action).toBe('waitForSelector');
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should generate workflow report', async () => {
      const workflow = await workflowTester.defineCustomWorkflow('Report Test', [
        { action: 'navigate', url: '/test' }
      ]);
      
      const result = await workflowTester.executeWorkflow(workflow);
      const report = await workflowTester.generateWorkflowReport(workflow.name);
      
      expect(report).toBeDefined();
      expect(report.workflow).toBe('Report Test');
      expect(report.executions).toBeDefined();
      expect(report.metrics).toBeDefined();
    });

    test('should generate comparison report', async () => {
      const workflows = [
        await workflowTester.defineCustomWorkflow('Flow A', [
          { action: 'navigate', url: '/a' }
        ]),
        await workflowTester.defineCustomWorkflow('Flow B', [
          { action: 'navigate', url: '/b' }
        ])
      ];
      
      const report = await workflowTester.generateComparisonReport(workflows);
      
      expect(report).toBeDefined();
      expect(report.workflows).toHaveLength(2);
      expect(report.comparison).toBeDefined();
    });

    test('should export workflow documentation', async () => {
      const workflow = await workflowTester.defineLoginWorkflow({
        usernameSelector: '#username',
        passwordSelector: '#password',
        submitSelector: '#submit',
        successUrl: '/dashboard'
      });
      
      const documentation = await workflowTester.exportWorkflowDocumentation(workflow, 'markdown');
      
      expect(documentation).toContain('# Login Workflow');
      expect(documentation).toContain('## Steps');
      expect(documentation).toContain('navigate');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await workflowTester.initialize();
    });

    test('should handle workflow execution errors', async () => {
      const workflow = {
        name: 'Error Flow',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'click', selector: '#non-existent-element' }
        ]
      };
      
      const result = await workflowTester.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle recording errors', async () => {
      // Start recording without proper setup
      workflowTester.isRecording = true;
      
      const workflow = await workflowTester.stopRecording();
      
      expect(workflow).toBeDefined();
      expect(workflow.steps).toEqual([]);
    });

    test('should validate workflow before execution', async () => {
      const invalidWorkflow = {
        name: 'Invalid',
        steps: [
          { action: 'invalid-action' }
        ]
      };
      
      await expect(workflowTester.executeWorkflow(invalidWorkflow)).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await workflowTester.initialize();
      
      // Create some workflows
      await workflowTester.defineCustomWorkflow('Test 1', [
        { action: 'navigate', url: '/test' }
      ]);
      
      expect(workflowTester.workflows.size).toBeGreaterThan(0);
      
      await workflowTester.cleanup();
      
      expect(workflowTester.workflows.size).toBe(0);
      expect(workflowTester.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample pages for testing workflows
  await fs.writeFile(
    path.join(projectPath, 'src', 'login.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Login</title>
</head>
<body>
  <form id="login-form">
    <input type="text" id="username" placeholder="Username" />
    <input type="password" id="password" placeholder="Password" />
    <button type="submit" id="submit">Login</button>
  </form>
</body>
</html>
`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'signup.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Sign Up</title>
</head>
<body>
  <form id="signup-form">
    <input type="email" id="email" placeholder="Email" />
    <input type="password" id="password" placeholder="Password" />
    <input type="password" id="confirmPassword" placeholder="Confirm Password" />
    <button type="submit" id="signup">Sign Up</button>
  </form>
</body>
</html>
`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'shop.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Shop</title>
</head>
<body>
  <div class="products">
    <div class="product">
      <h3>Product 1</h3>
      <button class="add-to-cart">Add to Cart</button>
    </div>
  </div>
  
  <div class="cart">
    <span class="cart-count">0</span>
    <button id="checkout">Checkout</button>
  </div>
  
  <div id="search-container">
    <input type="text" id="search" placeholder="Search products..." />
    <div class="search-results"></div>
  </div>
</body>
</html>
`
  );
}