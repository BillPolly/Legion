/**
 * LiveLLMTestSetup - Utilities for setting up live LLM integration tests
 * Handles API key validation, LLM client setup, and common test scenarios
 */

import { ResourceManager } from '@legion/tools';
import { LLMClient } from '@legion/llm';

export class LiveLLMTestSetup {
  constructor() {
    this.resourceManager = null;
    this.llmClient = null;
    this.initialized = false;
  }

  /**
   * Initialize and validate environment for live LLM testing
   * @returns {Promise<boolean>} True if setup successful
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      // Create ResourceManager - automatically loads .env file
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();

      // Validate API key availability - FAIL if missing (don't skip!)
      const envVars = this.resourceManager.get('env');
      const apiKey = envVars?.ANTHROPIC_API_KEY;
      
      if (!apiKey || apiKey === 'test-key' || apiKey.startsWith('sk-test')) {
        throw new Error(`
❌ ANTHROPIC_API_KEY is missing or set to test value!
   
   Live integration tests require a real API key in .env file.
   
   To fix:
   1. Add ANTHROPIC_API_KEY=your_real_key to .env
   2. Ensure .env is in Legion project root
   3. Restart tests
   
   Current value: ${apiKey ? 'test/placeholder value' : 'not found'}
`);
      }

      // Create LLM client
      this.llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-5-sonnet-20241022'
      });

      this.initialized = true;
      console.log('✅ Live LLM testing enabled - API key validated');
      return true;

    } catch (error) {
      console.error('❌ Live LLM setup failed:', error.message);
      throw error;
    }
  }

  /**
   * Get configured ResourceManager instance
   * @returns {ResourceManager} Initialized ResourceManager
   */
  getResourceManager() {
    if (!this.initialized) {
      throw new Error('LiveLLMTestSetup not initialized - call initialize() first');
    }
    return this.resourceManager;
  }

  /**
   * Get configured LLM client
   * @returns {LLMClient} Initialized LLM client
   */
  getLLMClient() {
    if (!this.initialized) {
      throw new Error('LiveLLMTestSetup not initialized - call initialize() first');
    }
    return this.llmClient;
  }

  /**
   * Validate that a response contains a valid behavior tree structure
   * @param {Object} response - LLM response to validate
   * @returns {boolean} True if valid BT structure
   */
  validateBTResponse(response) {
    if (!response || typeof response !== 'object') {
      console.warn('Invalid response: not an object');
      return false;
    }

    // Check for BT root structure
    const requiredFields = ['id', 'type'];
    const hasRequiredFields = requiredFields.every(field => field in response);
    
    if (!hasRequiredFields) {
      console.warn('Invalid BT: missing required fields:', requiredFields.filter(f => !(f in response)));
      return false;
    }

    // Validate BT node types
    const validTypes = ['sequence', 'selector', 'action', 'condition', 'parallel'];
    if (!validTypes.includes(response.type)) {
      console.warn('Invalid BT: unknown node type:', response.type);
      return false;
    }

    // Validate children structure for composite nodes
    if (['sequence', 'selector', 'parallel'].includes(response.type)) {
      if (!response.children || !Array.isArray(response.children)) {
        console.warn('Invalid BT: composite node missing children array');
        return false;
      }
      
      // Recursively validate children
      return response.children.every(child => this.validateBTResponse(child));
    }

    // Validate action nodes have required properties
    if (response.type === 'action') {
      if (!response.action && !response.tool) {
        console.warn('Invalid BT: action node missing action/tool property');
        return false;
      }
    }

    return true;
  }

  /**
   * Get common test scenarios for planning tasks
   * @returns {Array} Array of test scenario objects
   */
  getTestScenarios() {
    return [
      {
        name: 'Simple File Creation',
        task: 'Create a JavaScript function that calculates the factorial of a number',
        expectedFiles: ['factorial.js'],
        expectedActions: ['file_write'],
        complexity: 'simple',
        timeout: 30000
      },
      {
        name: 'Project Structure',
        task: 'Create a basic Node.js project with package.json and a simple HTTP server',
        expectedFiles: ['package.json', 'server.js'],
        expectedActions: ['file_write', 'directory_create'],
        complexity: 'medium',
        timeout: 45000
      },
      {
        name: 'Full Development Task',
        task: 'Build a REST API endpoint for user authentication with JWT tokens, including tests',
        expectedFiles: ['package.json', 'auth.js', 'auth.test.js'],
        expectedActions: ['file_write', 'directory_create', 'install_dependencies'],
        complexity: 'complex',
        timeout: 60000
      },
      {
        name: 'Error Handling Test',
        task: 'Create a utility with proper error handling and logging',
        expectedFiles: ['utility.js'],
        expectedActions: ['file_write'],
        complexity: 'simple',
        timeout: 30000,
        testErrorHandling: true
      },
      {
        name: 'Vague Task',
        task: 'do something with files',
        expectedFiles: [], // Don't expect specific files for vague tasks
        expectedActions: ['file_write'], // But should still generate some actions
        complexity: 'simple',
        timeout: 30000,
        expectVague: true
      }
    ];
  }

  /**
   * Create a planning context for testing
   * @param {string} task - Task description
   * @param {string} profile - Profile name (default: 'javascript-development')
   * @returns {Object} Planning context
   */
  createPlanningContext(task, profile = 'javascript-development') {
    return {
      task,
      profile,
      timestamp: new Date().toISOString(),
      testId: Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    };
  }

  /**
   * Validate planning results against expected outcomes
   * @param {Object} result - Planning result to validate
   * @param {Object} scenario - Test scenario expectations
   * @returns {Object} Validation results
   */
  validatePlanningResult(result, scenario) {
    const validation = {
      success: true,
      errors: [],
      warnings: [],
      details: {}
    };

    // Basic structure validation
    if (!result.success) {
      validation.success = false;
      validation.errors.push('Planning failed: ' + (result.error || 'Unknown error'));
      return validation;
    }

    if (!result.behaviorTree) {
      validation.success = false;
      validation.errors.push('Missing behavior tree in planning result');
      return validation;
    }

    // BT structure validation
    if (!this.validateBTResponse(result.behaviorTree)) {
      validation.success = false;
      validation.errors.push('Invalid behavior tree structure');
    }

    // Expected files validation (if specified)
    if (scenario.expectedFiles && scenario.expectedFiles.length > 0) {
      // This would need to be checked after execution
      validation.details.expectedFiles = scenario.expectedFiles;
    }

    // Expected actions validation
    if (scenario.expectedActions && scenario.expectedActions.length > 0) {
      const btActions = this.extractActionsFromBT(result.behaviorTree);
      const missingActions = scenario.expectedActions.filter(
        expected => !btActions.includes(expected)
      );
      
      if (missingActions.length > 0) {
        validation.warnings.push(`Missing expected actions: ${missingActions.join(', ')}`);
      }
      
      validation.details.extractedActions = btActions;
      validation.details.expectedActions = scenario.expectedActions;
    }

    // Profile validation
    if (result.profile !== scenario.profile) {
      validation.warnings.push(`Profile mismatch: expected ${scenario.profile}, got ${result.profile}`);
    }

    return validation;
  }

  /**
   * Extract action names from a behavior tree
   * @param {Object} bt - Behavior tree object
   * @returns {Array<string>} Array of action names
   */
  extractActionsFromBT(bt) {
    const actions = [];
    
    const traverse = (node) => {
      if (!node) return;
      
      if (node.type === 'action') {
        if (node.action) actions.push(node.action);
        if (node.tool) actions.push(node.tool);
      }
      
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    
    traverse(bt);
    return actions;
  }

  /**
   * Track test metrics for reporting
   * @param {string} testName - Name of the test
   * @param {Object} metrics - Test metrics
   */
  trackTestMetrics(testName, metrics) {
    if (global.trackLLMCall) global.trackLLMCall();
    
    if (!global.testMetrics) {
      global.testMetrics = {};
    }
    
    global.testMetrics[testName] = {
      ...metrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    this.llmClient = null;
    this.resourceManager = null;
    this.initialized = false;
  }
}