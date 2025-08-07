/**
 * BT-Based Testing System for Aiur Agents
 * 
 * A comprehensive testing framework that uses Behavior Trees to test other BT agents
 * through their Actor interface, providing realistic message flow testing instead
 * of traditional Jest unit tests.
 */

// Core testing infrastructure
import { TestingBTBase } from './TestingBTBase.js';
import { TestScenarioRunner } from './TestScenarioRunner.js';

export { TestingBTBase, TestScenarioRunner };

// Testing nodes
export { SendMessageNode } from './nodes/SendMessageNode.js';
export { WaitForResponseNode } from './nodes/WaitForResponseNode.js';
export { AssertResponseNode } from './nodes/AssertResponseNode.js';
export { MockEnvironmentNode } from './nodes/MockEnvironmentNode.js';

// Additional testing utilities
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Factory functions for creating testing components
 */

/**
 * Create a testing BT agent for running test scenarios
 */
export async function createTestingAgent(config = {}) {
  const testingAgent = new TestingBTBase(config);
  await testingAgent.initialize();
  return testingAgent;
}

/**
 * Create a test scenario runner
 */
export async function createTestRunner(config = {}) {
  const runner = new TestScenarioRunner(config);
  await runner.initialize();
  return runner;
}

/**
 * Set up a complete testing environment with agents and runner
 */
export async function setupTestingEnvironment(agents = {}, config = {}) {
  // Create test runner
  const runner = await createTestRunner(config);
  
  // Register test agents
  if (Object.keys(agents).length > 0) {
    runner.registerTestAgents(agents);
  }
  
  return {
    runner,
    testingAgent: runner.testingAgent,
    
    // Convenience methods
    runScenario: (scenario, options) => runner.runScenario(scenario, options),
    runSuite: (suite, options) => runner.runSuite(suite, options),
    runFromFile: (filePath, options) => runner.runFromFile(filePath, options),
    generateReport: (format) => runner.generateReport(format),
    cleanup: () => runner.cleanup()
  };
}

/**
 * Scenario and suite loading utilities
 */

/**
 * Load test scenario from file
 */
export async function loadScenario(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load test scenario from ${filePath}: ${error.message}`);
  }
}

/**
 * Load all test scenarios from directory
 */
export async function loadScenariosFromDirectory(directoryPath) {
  try {
    const files = await fs.readdir(directoryPath);
    const testFiles = files.filter(file => 
      file.endsWith('.json') && (file.includes('test') || file.includes('spec'))
    );
    
    const scenarios = [];
    for (const file of testFiles) {
      const filePath = path.join(directoryPath, file);
      const scenario = await loadScenario(filePath);
      scenarios.push({ file, scenario });
    }
    
    return scenarios;
  } catch (error) {
    throw new Error(`Failed to load scenarios from directory ${directoryPath}: ${error.message}`);
  }
}

/**
 * Get built-in test scenarios
 */
export async function getBuiltInScenarios() {
  const scenariosDir = path.join(__dirname, 'scenarios');
  return await loadScenariosFromDirectory(scenariosDir);
}

/**
 * Quick testing utilities
 */

/**
 * Run a quick test of all BT agents with built-in scenarios
 */
export async function quickTestAllAgents(agents, options = {}) {
  const environment = await setupTestingEnvironment(agents, {
    debugMode: options.debugMode || false,
    ...options
  });
  
  try {
    // Load and run the complete test suite
    const suiteFile = path.join(__dirname, 'scenarios', 'complete-agent-test-suite.json');
    const results = await environment.runFromFile(suiteFile, options);
    
    // Generate report
    const report = environment.generateReport(options.reportFormat || 'console');
    
    return {
      results,
      report,
      summary: environment.runner.generateSummary()
    };
  } finally {
    await environment.cleanup();
  }
}

/**
 * Run individual agent tests
 */
export async function testChatAgent(chatAgent, options = {}) {
  const environment = await setupTestingEnvironment({ chatAgent }, options);
  
  try {
    const scenarioFile = path.join(__dirname, 'scenarios', 'chat-agent-test.json');
    const results = await environment.runFromFile(scenarioFile, options);
    return { results, report: environment.generateReport('console') };
  } finally {
    await environment.cleanup();
  }
}

export async function testTerminalAgent(terminalAgent, options = {}) {
  const environment = await setupTestingEnvironment({ terminalAgent }, options);
  
  try {
    const scenarioFile = path.join(__dirname, 'scenarios', 'terminal-agent-test.json');
    const results = await environment.runFromFile(scenarioFile, options);
    return { results, report: environment.generateReport('console') };
  } finally {
    await environment.cleanup();
  }
}

export async function testArtifactAgent(artifactAgent, options = {}) {
  const environment = await setupTestingEnvironment({ artifactAgent }, options);
  
  try {
    const scenarioFile = path.join(__dirname, 'scenarios', 'artifact-agent-test.json');
    const results = await environment.runFromFile(scenarioFile, options);
    return { results, report: environment.generateReport('console') };
  } finally {
    await environment.cleanup();
  }
}

/**
 * Testing validation utilities
 */

/**
 * Validate that an agent implements the Actor interface correctly
 */
export function validateActorInterface(agent, agentName = 'Agent') {
  const errors = [];
  
  if (!agent) {
    errors.push(`${agentName} is null or undefined`);
    return { valid: false, errors };
  }
  
  if (typeof agent.receive !== 'function') {
    errors.push(`${agentName} must implement receive(payload, envelope) method`);
  }
  
  // Check for common Agent methods (optional but recommended)
  const recommendedMethods = ['initialize', 'getMetadata', 'cleanup'];
  for (const method of recommendedMethods) {
    if (typeof agent[method] !== 'function') {
      console.warn(`${agentName} is missing recommended method: ${method}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: errors.length === 0 ? [] : [`Agent may be missing recommended methods`]
  };
}

/**
 * Validate test scenario configuration
 */
export function validateScenarioConfig(scenario) {
  const errors = [];
  
  if (!scenario) {
    errors.push('Scenario configuration is required');
    return { valid: false, errors };
  }
  
  if (!scenario.name) {
    errors.push('Scenario must have a name');
  }
  
  if (!scenario.tests && !scenario.type) {
    errors.push('Scenario must have either tests configuration or type');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    scenario
  };
}

/**
 * Constants and metadata
 */
export const BT_TESTING_VERSION = '1.0.0';

export const BT_TESTING_CAPABILITIES = [
  'actor_interface_testing',
  'message_flow_testing',
  'behavior_tree_scenarios',
  'mock_environment_creation',
  'assertion_validation',
  'cross_agent_testing',
  'performance_monitoring',
  'comprehensive_reporting'
];

export const BT_TESTING_METADATA = {
  version: BT_TESTING_VERSION,
  framework: 'Legion Behavior Tree Testing',
  author: 'Legion BT System',
  description: 'BT-based testing system for testing other BT agents through Actor interface',
  capabilities: BT_TESTING_CAPABILITIES,
  builtInScenarios: [
    'chat-agent-test',
    'terminal-agent-test',
    'artifact-agent-test',
    'complete-agent-test-suite'
  ]
};

/**
 * Default export: main testing utilities
 */
export default {
  // Core classes
  TestingBTBase,
  TestScenarioRunner,
  
  // Factory functions
  createTestingAgent,
  createTestRunner,
  setupTestingEnvironment,
  
  // Quick testing
  quickTestAllAgents,
  testChatAgent,
  testTerminalAgent,
  testArtifactAgent,
  
  // Loading utilities
  loadScenario,
  loadScenariosFromDirectory,
  getBuiltInScenarios,
  
  // Validation
  validateActorInterface,
  validateScenarioConfig,
  
  // Metadata
  version: BT_TESTING_VERSION,
  capabilities: BT_TESTING_CAPABILITIES,
  metadata: BT_TESTING_METADATA
};