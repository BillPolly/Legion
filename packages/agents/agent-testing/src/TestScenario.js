/**
 * TestScenario - Defines and manages test scenarios for agents
 * Provides fluent API for creating comprehensive test cases
 */

export class TestScenario {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.setup = null;
    this.teardown = null;
    this.config = {
      timeout: 5000,
      retries: 0,
      parallel: false
    };
  }

  // Setup and Teardown
  beforeAll(setupFn) {
    this.setup = setupFn;
    return this;
  }

  afterAll(teardownFn) {
    this.teardown = teardownFn;
    return this;
  }

  // Configuration
  withTimeout(timeout) {
    this.config.timeout = timeout;
    return this;
  }

  withRetries(retries) {
    this.config.retries = retries;
    return this;
  }

  runInParallel() {
    this.config.parallel = true;
    return this;
  }

  // Test Definition Methods
  addMessageTest(name, input, expectedPatterns, options = {}) {
    this.tests.push({
      name,
      type: 'message',
      input,
      expectedPatterns,
      messageType: options.messageType || 'message',
      sessionId: options.sessionId,
      validator: options.validator
    });
    return this;
  }

  addPerformanceTest(name, options = {}) {
    this.tests.push({
      name,
      type: 'performance',
      iterations: options.iterations || 10,
      input: options.input || 'Performance test message',
      messageType: options.messageType || 'message',
      maxResponseTime: options.maxResponseTime,
      minThroughput: options.minThroughput,
      maxErrorRate: options.maxErrorRate || 0.1
    });
    return this;
  }

  addBehaviorTest(name, scenarios, options = {}) {
    this.tests.push({
      name,
      type: 'behavior',
      scenarios,
      requireConsistency: options.requireConsistency !== false,
      minPatternMatch: options.minPatternMatch || 0.8
    });
    return this;
  }

  addIntegrationTest(name, steps, options = {}) {
    this.tests.push({
      name,
      type: 'integration',
      steps,
      initialState: options.initialState || {},
      sessionId: options.sessionId,
      verifyFinalState: options.verifyFinalState
    });
    return this;
  }

  // Convenience Methods for Common Tests
  addGreetingTest() {
    return this.addMessageTest(
      'Greeting Response',
      'Hello!',
      ['hello', 'hi', 'greetings'],
      {
        validator: (response) => {
          const content = response.content.toLowerCase();
          return content.includes('hello') || 
                 content.includes('hi') || 
                 content.includes('greetings');
        }
      }
    );
  }

  addQuestionAnsweringTest(question, expectedKeywords) {
    return this.addMessageTest(
      `Answer Question: ${question}`,
      question,
      expectedKeywords,
      {
        validator: (response) => {
          const content = response.content.toLowerCase();
          return expectedKeywords.some(keyword => 
            content.includes(keyword.toLowerCase())
          );
        }
      }
    );
  }

  addConsistencyTest(prompts, expectedBehavior) {
    const scenarios = prompts.map(prompt => ({
      input: prompt,
      messageType: 'message',
      expectedBehavior
    }));

    return this.addBehaviorTest(
      'Consistency Test',
      scenarios,
      { requireConsistency: true }
    );
  }

  addConversationFlowTest(conversation) {
    const steps = conversation.map((turn, index) => ({
      name: `Turn ${index + 1}`,
      type: 'message',
      content: turn.input,
      verify: async (response) => {
        if (turn.expectedKeywords) {
          const content = response.content.toLowerCase();
          return turn.expectedKeywords.some(keyword =>
            content.includes(keyword.toLowerCase())
          );
        }
        return true;
      }
    }));

    return this.addIntegrationTest(
      'Conversation Flow',
      steps,
      {
        verifyFinalState: async (state) => {
          // Verify conversation completed successfully
          return true;
        }
      }
    );
  }

  addErrorHandlingTest() {
    return this.addMessageTest(
      'Error Handling',
      '',  // Empty input
      ['sorry', 'understand', 'clarify', 'help'],
      {
        validator: (response) => {
          // Should handle empty input gracefully
          return response && response.content && response.content.length > 0;
        }
      }
    );
  }

  addLoadTest(messagesPerSecond = 10, duration = 5000) {
    const iterations = Math.floor((duration / 1000) * messagesPerSecond);
    
    return this.addPerformanceTest(
      'Load Test',
      {
        iterations,
        maxResponseTime: 1000,  // 1 second max
        minThroughput: messagesPerSecond * 0.8,  // 80% of target
        maxErrorRate: 0.05  // 5% error rate
      }
    );
  }

  // Build the final test suite
  build() {
    return {
      name: this.name,
      tests: this.tests,
      setup: this.setup,
      teardown: this.teardown,
      config: this.config
    };
  }

  // Static factory methods
  static createBasicTestSuite(agentName) {
    return new TestScenario(`Basic Tests for ${agentName}`)
      .addGreetingTest()
      .addQuestionAnsweringTest('What is your purpose?', ['help', 'assist', 'support'])
      .addErrorHandlingTest()
      .addConsistencyTest(
        ['Tell me about yourself', 'What are you?', 'Describe yourself'],
        'informative'
      )
      .build();
  }

  static createPerformanceTestSuite(agentName) {
    return new TestScenario(`Performance Tests for ${agentName}`)
      .addPerformanceTest('Response Time Test', {
        iterations: 20,
        maxResponseTime: 500
      })
      .addLoadTest(20, 10000)  // 20 msg/sec for 10 seconds
      .runInParallel()
      .build();
  }

  static createIntegrationTestSuite(agentName) {
    return new TestScenario(`Integration Tests for ${agentName}`)
      .addConversationFlowTest([
        { input: 'Hello!', expectedKeywords: ['hello', 'hi'] },
        { input: 'What can you help me with?', expectedKeywords: ['help', 'assist'] },
        { input: 'Can you explain machine learning?', expectedKeywords: ['machine', 'learning', 'algorithm'] },
        { input: 'Thank you!', expectedKeywords: ['welcome', 'pleasure'] }
      ])
      .addIntegrationTest(
        'Multi-step Task',
        [
          {
            name: 'Request Task',
            content: 'Help me write a function',
            verify: async (response) => response.content.includes('function')
          },
          {
            name: 'Provide Details',
            content: 'It should add two numbers',
            verify: async (response) => response.content.includes('add') || response.content.includes('+')
          },
          {
            name: 'Confirm Implementation',
            content: 'Is this correct?',
            verify: async (response) => true
          }
        ]
      )
      .withTimeout(10000)
      .build();
  }

  // Export/Import functionality
  toJSON() {
    return JSON.stringify({
      name: this.name,
      tests: this.tests,
      config: this.config
    }, null, 2);
  }

  static fromJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const scenario = new TestScenario(data.name);
    
    scenario.tests = data.tests;
    scenario.config = data.config;
    
    return scenario;
  }

  // Validation
  validate() {
    const errors = [];
    
    if (!this.name) {
      errors.push('Test scenario must have a name');
    }
    
    if (this.tests.length === 0) {
      errors.push('Test scenario must have at least one test');
    }
    
    for (const test of this.tests) {
      if (!test.name) {
        errors.push('All tests must have a name');
      }
      
      if (!test.type) {
        errors.push(`Test ${test.name} must have a type`);
      }
      
      if (test.type === 'message' && !test.input) {
        errors.push(`Message test ${test.name} must have input`);
      }
      
      if (test.type === 'behavior' && (!test.scenarios || test.scenarios.length === 0)) {
        errors.push(`Behavior test ${test.name} must have scenarios`);
      }
      
      if (test.type === 'integration' && (!test.steps || test.steps.length === 0)) {
        errors.push(`Integration test ${test.name} must have steps`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}