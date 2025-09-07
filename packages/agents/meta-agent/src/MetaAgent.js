/**
 * MetaAgent - An agent that can plan, design, test, and deploy other agents
 * Provides comprehensive agent lifecycle management
 */

import { ConfigurableAgent } from '@legion/configurable-agent';
import { AgentRegistry } from '@legion/agent-registry';
import { AgentDesigner, AgentConfigBuilder } from '@legion/agent-designer';
import { PromptTester, PromptEvaluator } from '@legion/prompt-engineering';
import { TestRunner, TestScenario, TestValidator } from '@legion/agent-testing';

export class MetaAgent extends ConfigurableAgent {
  constructor(config, resourceManager) {
    // Configure the meta-agent itself
    const metaConfig = {
      agent: {
        id: config?.agent?.id || 'meta-agent',
        name: config?.agent?.name || 'Meta Agent',
        type: 'task',  // Use 'task' type for meta-agent
        description: 'An agent that creates and manages other agents',
        version: '1.0.0',
        llm: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 500
        }
      },
      behavior: {
        responseStyle: 'professional',
        creativity: 0.7,
        verbosity: 'balanced',
        ...config?.behavior  // Custom values override defaults
      },
      prompts: {
        system: config?.prompts?.system || `You are a Meta Agent responsible for designing, testing, and deploying other AI agents. 
You have expertise in:
- Agent architecture and design patterns
- Prompt engineering and optimization
- Testing and validation strategies
- Performance optimization
- Agent lifecycle management

Your goal is to create high-quality, reliable agents that meet specific requirements.`,
        ...config?.prompts
      },
      capabilities: {
        ...config?.capabilities,
        tools: [
          'agent_design',
          'agent_testing',
          'prompt_engineering',
          'agent_deployment',
          'performance_analysis'
        ]
      }
    };

    super(metaConfig, resourceManager);
    
    // Store the full configuration for meta-agent operations
    this.fullConfig = metaConfig;
    
    // Initialize components
    this.agentRegistry = null;
    this.agentDesigner = null;
    this.promptTester = null;
    this.promptEvaluator = null;
    this.testRunner = null;
    this.testValidator = null;
    
    // Track created agents
    this.createdAgents = new Map();
    this.testResults = new Map();
  }

  async initialize() {
    await super.initialize();
    
    // Initialize all components
    this.agentRegistry = new AgentRegistry(this.resourceManager);
    await this.agentRegistry.initialize();
    
    this.agentDesigner = new AgentDesigner(this.resourceManager);
    await this.agentDesigner.initialize();
    
    this.promptTester = new PromptTester(this.resourceManager);
    await this.promptTester.initialize();
    
    this.promptEvaluator = new PromptEvaluator(this.resourceManager);
    await this.promptEvaluator.initialize();
    
    this.testRunner = new TestRunner(this.resourceManager);
    await this.testRunner.initialize();
    
    this.testValidator = new TestValidator(this.resourceManager);
  }

  async cleanup() {
    // Cleanup all components
    if (this.promptTester) await this.promptTester.cleanup();
    if (this.promptEvaluator) await this.promptEvaluator.cleanup();
    if (this.testRunner) await this.testRunner.cleanup();
    if (this.agentRegistry) await this.agentRegistry.cleanup();
    if (this.agentDesigner) await this.agentDesigner.cleanup();
    
    await super.cleanup();
  }

  // Main agent creation workflow
  async createAgent(requirements) {
    const workflow = {
      id: `workflow-${Date.now()}`,
      requirements,
      startTime: Date.now(),
      steps: [],
      result: null
    };

    try {
      // Step 1: Design the agent
      workflow.steps.push({ step: 'design', startTime: Date.now() });
      const designResult = await this.designAgent(requirements);
      workflow.steps[0].result = designResult;
      workflow.steps[0].endTime = Date.now();

      if (!designResult.success) {
        throw new Error(`Design failed: ${designResult.error}`);
      }

      // Step 2: Optimize prompts
      workflow.steps.push({ step: 'optimize', startTime: Date.now() });
      const optimizedConfig = await this.optimizePrompts(designResult.config);
      workflow.steps[1].result = { config: optimizedConfig };
      workflow.steps[1].endTime = Date.now();

      // Step 3: Create the agent
      workflow.steps.push({ step: 'create', startTime: Date.now() });
      const agent = await this.instantiateAgent(optimizedConfig);
      workflow.steps[2].result = { agentId: agent.id };
      workflow.steps[2].endTime = Date.now();

      // Step 4: Test the agent
      workflow.steps.push({ step: 'test', startTime: Date.now() });
      const testResults = await this.testAgent(agent, requirements);
      workflow.steps[3].result = testResults;
      workflow.steps[3].endTime = Date.now();

      // Step 5: Validate and refine if needed
      workflow.steps.push({ step: 'validate', startTime: Date.now() });
      const validation = await this.validateAgent(agent, testResults, requirements);
      workflow.steps[4].result = validation;
      workflow.steps[4].endTime = Date.now();

      if (!validation.passed) {
        // Refine the agent
        const refinedConfig = await this.refineAgent(optimizedConfig, validation.issues);
        agent.updateConfiguration(refinedConfig);
      }

      // Step 6: Register the agent
      workflow.steps.push({ step: 'register', startTime: Date.now() });
      const registration = await this.registerAgent(agent, optimizedConfig);
      workflow.steps[5].result = registration;
      workflow.steps[5].endTime = Date.now();

      workflow.endTime = Date.now();
      workflow.result = {
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        testsPassed: validation.passed,
        registrationId: registration.id
      };

      // Store the created agent
      this.createdAgents.set(agent.id, {
        agent,
        config: optimizedConfig,
        testResults,
        workflow
      });

      return workflow.result;

    } catch (error) {
      workflow.endTime = Date.now();
      workflow.result = {
        success: false,
        error: error.message
      };
      return workflow.result;
    }
  }

  // Design phase
  async designAgent(requirements) {
    // Use AgentDesigner to create initial configuration
    const designResult = await this.agentDesigner.designAgent(requirements);
    
    if (!designResult.success) {
      return designResult;
    }

    // Enhance the design based on meta-agent's expertise
    const enhancedConfig = await this.enhanceDesign(designResult.config, requirements);
    
    return {
      success: true,
      config: enhancedConfig,
      designMetadata: {
        originalDesign: designResult.config,
        enhancements: this.getEnhancements(designResult.config, enhancedConfig)
      }
    };
  }

  async enhanceDesign(config, requirements) {
    // Analyze requirements for special needs
    const analysis = await this.analyzeRequirements(requirements);
    
    // Add appropriate tools based on analysis
    if (analysis.needsDataProcessing) {
      config.capabilities.tools.push('data_processing', 'json_manipulation');
    }
    
    if (analysis.needsWebAccess) {
      config.capabilities.tools.push('web_search', 'web_fetch');
    }
    
    if (analysis.needsFileOperations) {
      config.capabilities.tools.push('file_read', 'file_write');
    }

    // Enhance prompts based on domain
    if (analysis.domain) {
      config.prompts.system = this.enhanceSystemPrompt(
        config.prompts.system,
        analysis.domain
      );
    }

    // Add appropriate behaviors
    if (analysis.requiresPrecision) {
      config.behavior.creativity = 0.2;
      config.behavior.temperature = 0.3;
    }

    if (analysis.requiresCreativity) {
      config.behavior.creativity = 0.8;
      config.behavior.temperature = 0.7;
    }

    return config;
  }

  async analyzeRequirements(requirements) {
    const prompt = `Analyze these agent requirements and identify key characteristics:
Requirements: ${JSON.stringify(requirements)}

Provide analysis in JSON format with these fields:
- domain: the primary domain (e.g., "technical", "creative", "analytical")
- needsDataProcessing: boolean
- needsWebAccess: boolean
- needsFileOperations: boolean
- requiresPrecision: boolean
- requiresCreativity: boolean
- suggestedTools: array of tool names`;

    const response = await this.llmClient.complete(prompt, 500);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Fallback to basic analysis
    }

    return {
      domain: 'general',
      needsDataProcessing: requirements.purpose?.includes('data'),
      needsWebAccess: requirements.purpose?.includes('web') || requirements.purpose?.includes('search'),
      needsFileOperations: requirements.purpose?.includes('file'),
      requiresPrecision: requirements.purpose?.includes('precise') || requirements.purpose?.includes('accurate'),
      requiresCreativity: requirements.purpose?.includes('creative') || requirements.purpose?.includes('generate')
    };
  }

  enhanceSystemPrompt(basePrompt, domain) {
    const domainEnhancements = {
      technical: '\n\nYou have deep technical expertise and should provide accurate, detailed technical information.',
      creative: '\n\nYou are creative and innovative, thinking outside the box to provide unique solutions.',
      analytical: '\n\nYou excel at analysis, breaking down complex problems and providing data-driven insights.',
      educational: '\n\nYou are an excellent teacher, explaining concepts clearly and adapting to the learner\'s level.',
      supportive: '\n\nYou are empathetic and supportive, providing help with patience and understanding.'
    };

    return basePrompt + (domainEnhancements[domain] || '');
  }

  getEnhancements(original, enhanced) {
    const enhancements = [];
    
    // Compare tools
    const originalTools = new Set(original.capabilities?.tools || []);
    const enhancedTools = new Set(enhanced.capabilities?.tools || []);
    const addedTools = [...enhancedTools].filter(t => !originalTools.has(t));
    
    if (addedTools.length > 0) {
      enhancements.push({ type: 'tools', added: addedTools });
    }

    // Compare prompts
    if (enhanced.prompts?.system !== original.prompts?.system) {
      enhancements.push({ type: 'prompt', enhanced: true });
    }

    // Compare behaviors
    if (JSON.stringify(enhanced.behavior) !== JSON.stringify(original.behavior)) {
      enhancements.push({ type: 'behavior', modified: true });
    }

    return enhancements;
  }

  // Prompt optimization phase
  async optimizePrompts(config) {
    const optimizedConfig = { ...config };
    
    // Test and optimize system prompt
    const systemPromptTests = await this.promptTester.batchTest(
      config.prompts.system,
      this.generatePromptTestCases(config)
    );

    if (systemPromptTests.successRate < 0.8) {
      // Optimize the prompt
      const optimizationResult = await this.promptTester.autoOptimize(
        config.prompts.system,
        {
          clarity: 0.8,
          specificity: 0.7,
          helpfulness: 0.9
        }
      );
      
      optimizedConfig.prompts.system = optimizationResult.prompt;
    }

    // Evaluate prompt quality
    const evaluation = await this.promptEvaluator.evaluateClarity(optimizedConfig.prompts.system);
    
    if (evaluation.suggestions && evaluation.suggestions.length > 0) {
      // Apply suggestions
      const feedback = await this.promptEvaluator.generateFeedback(optimizedConfig.prompts.system);
      optimizedConfig.prompts.system = feedback.improvedVersion;
    }

    return optimizedConfig;
  }

  generatePromptTestCases(config) {
    const testCases = [
      {
        input: 'Hello!',
        expectedPatterns: ['hello', 'hi', 'greetings']
      },
      {
        input: 'What can you help me with?',
        expectedPatterns: ['help', 'assist', 'support']
      },
      {
        input: 'Explain your capabilities',
        expectedPatterns: config.capabilities.tools.slice(0, 3)
      }
    ];

    // Add domain-specific test cases
    if (config.agent.type === 'task') {
      testCases.push({
        input: 'Can you complete a task for me?',
        expectedPatterns: ['yes', 'sure', 'help', 'task']
      });
    }

    if (config.agent.type === 'conversational') {
      testCases.push({
        input: 'Let\'s have a conversation',
        expectedPatterns: ['talk', 'discuss', 'conversation', 'chat']
      });
    }

    return testCases;
  }

  // Agent instantiation
  async instantiateAgent(config) {
    const agent = new ConfigurableAgent(config);
    await agent.initialize();
    return agent;
  }

  // Testing phase
  async testAgent(agent, requirements) {
    // Create test scenarios based on requirements
    const testScenarios = this.createTestScenarios(agent, requirements);
    
    // Run all test scenarios
    const allResults = await this.testRunner.runAllTests(agent, testScenarios);
    
    // Store test results
    this.testResults.set(agent.id, allResults);
    
    return allResults;
  }

  createTestScenarios(agent, requirements) {
    const scenarios = [];
    
    // Always include basic tests
    scenarios.push(TestScenario.createBasicTestSuite(agent.name));
    
    // Add performance tests if required
    if (requirements.performance) {
      scenarios.push(TestScenario.createPerformanceTestSuite(agent.name));
    }
    
    // Add integration tests for complex agents
    if (agent.fullConfig && agent.fullConfig.capabilities && agent.fullConfig.capabilities.tools.length > 3) {
      scenarios.push(TestScenario.createIntegrationTestSuite(agent.name));
    }
    
    // Add custom tests based on requirements
    if (requirements.testCases) {
      const customScenario = new TestScenario(`Custom Tests for ${agent.name}`);
      
      for (const testCase of requirements.testCases) {
        customScenario.addMessageTest(
          testCase.name,
          testCase.input,
          testCase.expectedPatterns
        );
      }
      
      scenarios.push(customScenario.build());
    }
    
    return scenarios;
  }

  // Validation phase
  async validateAgent(agent, testResults, requirements) {
    const validation = {
      passed: true,
      issues: [],
      recommendations: []
    };

    // Check test pass rate
    const passRate = testResults.overallSummary.overallPassRate;
    const requiredPassRate = requirements.minPassRate || 0.8;
    
    if (passRate < requiredPassRate) {
      validation.passed = false;
      validation.issues.push({
        type: 'low_pass_rate',
        actual: passRate,
        required: requiredPassRate
      });
    }

    // Validate behavior consistency
    const behaviorTests = testResults.suites.find(s => s.suiteName.includes('Basic'));
    if (behaviorTests && behaviorTests.summary.passRate < 0.9) {
      validation.issues.push({
        type: 'inconsistent_behavior',
        details: 'Basic behavior tests have low pass rate'
      });
    }

    // Check performance if required
    if (requirements.performance) {
      const perfTests = testResults.suites.find(s => s.suiteName.includes('Performance'));
      if (perfTests) {
        const perfMetrics = this.testRunner.getPerformanceMetrics(agent.id);
        const perfValidation = this.testValidator.validatePerformance(
          perfMetrics,
          requirements.performance
        );
        
        if (!perfValidation.valid) {
          validation.passed = false;
          validation.issues.push({
            type: 'performance_issues',
            failed: perfValidation.failed
          });
        }
      }
    }

    // Generate recommendations
    if (!validation.passed) {
      validation.recommendations = await this.generateRecommendations(
        agent,
        validation.issues
      );
    }

    return validation;
  }

  async generateRecommendations(agent, issues) {
    const recommendations = [];
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'low_pass_rate':
          recommendations.push({
            action: 'improve_prompts',
            description: 'Refine system prompts for better response quality'
          });
          recommendations.push({
            action: 'adjust_temperature',
            description: 'Lower temperature for more consistent responses'
          });
          break;
        
        case 'inconsistent_behavior':
          recommendations.push({
            action: 'add_examples',
            description: 'Add few-shot examples to prompts'
          });
          recommendations.push({
            action: 'clarify_instructions',
            description: 'Make prompt instructions more explicit'
          });
          break;
        
        case 'performance_issues':
          recommendations.push({
            action: 'optimize_tools',
            description: 'Remove unnecessary tools to improve performance'
          });
          recommendations.push({
            action: 'reduce_max_tokens',
            description: 'Limit response length for faster processing'
          });
          break;
      }
    }
    
    return recommendations;
  }

  // Refinement phase
  async refineAgent(config, issues) {
    const refinedConfig = { ...config };
    
    for (const issue of issues) {
      switch (issue.type) {
        case 'low_pass_rate':
          // Improve prompts
          refinedConfig.prompts.system = await this.improvePrompt(
            refinedConfig.prompts.system
          );
          // Adjust temperature
          refinedConfig.behavior.temperature = Math.max(
            0.3,
            refinedConfig.behavior.temperature - 0.2
          );
          break;
        
        case 'inconsistent_behavior':
          // Add examples
          refinedConfig.prompts.examples = await this.generateExamples(config);
          // Reduce creativity for consistency
          refinedConfig.behavior.creativity = Math.max(
            0.2,
            refinedConfig.behavior.creativity - 0.2
          );
          break;
        
        case 'performance_issues':
          // Optimize configuration
          refinedConfig.performance = {
            maxTokens: 150,
            timeout: 5000,
            cacheResponses: true
          };
          break;
      }
    }
    
    return refinedConfig;
  }

  async improvePrompt(prompt) {
    const improvementPrompt = `Improve this system prompt for better clarity and effectiveness:
Current prompt: "${prompt}"

Provide an improved version that is:
1. Clear and unambiguous
2. Specific about expected behavior
3. Comprehensive but concise`;

    const response = await this.llmClient.complete(improvementPrompt, 300);
    return response || prompt;
  }

  async generateExamples(config) {
    // Generate few-shot examples based on agent type
    const examples = [];
    
    const agentType = config.agent?.type || 'conversational';
    
    if (agentType === 'conversational') {
      examples.push({
        input: 'Hello!',
        output: 'Hello! How can I assist you today?'
      });
    }
    
    if (agentType === 'task') {
      examples.push({
        input: 'Can you help me with a task?',
        output: 'Of course! Please describe the task you need help with, and I\'ll do my best to assist you.'
      });
    }
    
    return examples;
  }

  // Registration phase
  async registerAgent(agent, config) {
    const registration = await this.agentRegistry.registerAgent(config);
    return registration;
  }

  // Message handling
  async processMessage(message) {
    // Handle meta-agent specific commands
    if (message.content.startsWith('/create-agent')) {
      return await this.handleCreateAgent(message);
    }
    
    if (message.content.startsWith('/test-agent')) {
      return await this.handleTestAgent(message);
    }
    
    if (message.content.startsWith('/list-agents')) {
      return await this.handleListAgents(message);
    }
    
    if (message.content.startsWith('/agent-report')) {
      return await this.handleAgentReport(message);
    }
    
    // Default message handling
    return await super.processMessage(message);
  }

  async handleCreateAgent(message) {
    // Parse requirements from message
    const requirementsText = message.content.replace('/create-agent', '').trim();
    
    try {
      const requirements = JSON.parse(requirementsText);
      const result = await this.createAgent(requirements);
      
      return {
        type: 'agent_created',
        content: `Agent created successfully!\nID: ${result.agentId}\nName: ${result.agentName}\nTests Passed: ${result.testsPassed}`,
        data: result
      };
    } catch (error) {
      return {
        type: 'error',
        content: `Failed to create agent: ${error.message}`
      };
    }
  }

  async handleTestAgent(message) {
    const parts = message.content.split(' ');
    const agentId = parts[1];
    
    const agentData = this.createdAgents.get(agentId);
    if (!agentData) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    const testResults = await this.testAgent(agentData.agent, {});
    const report = await this.testRunner.generateReport(testResults, 'markdown');
    
    return {
      type: 'test_report',
      content: report,
      data: testResults
    };
  }

  async handleListAgents(message) {
    const agents = await this.agentRegistry.listAgents();
    
    let content = 'Registered Agents:\n\n';
    for (const agent of agents) {
      content += `- ${agent.name} (${agent.id})\n`;
      content += `  Type: ${agent.type}\n`;
      content += `  Description: ${agent.description}\n\n`;
    }
    
    return {
      type: 'agent_list',
      content,
      data: agents
    };
  }

  async handleAgentReport(message) {
    const parts = message.content.split(' ');
    const agentId = parts[1];
    
    const agentData = this.createdAgents.get(agentId);
    if (!agentData) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    const testResults = this.testResults.get(agentId);
    const report = await this.generateComprehensiveReport(agentData, testResults);
    
    return {
      type: 'comprehensive_report',
      content: report,
      data: { agentData, testResults }
    };
  }

  async generateComprehensiveReport(agentData, testResults) {
    let report = `# Comprehensive Agent Report\n\n`;
    report += `## Agent: ${agentData.agent.name} (${agentData.agent.id})\n\n`;
    
    report += `### Configuration\n`;
    report += `- Type: ${agentData.config.agent.type}\n`;
    report += `- Tools: ${agentData.config.capabilities.tools.join(', ')}\n`;
    report += `- Behavior: Temperature=${agentData.config.behavior.temperature}, Creativity=${agentData.config.behavior.creativity}\n\n`;
    
    report += `### Test Results\n`;
    if (testResults) {
      report += `- Total Tests: ${testResults.overallSummary.totalTests}\n`;
      report += `- Pass Rate: ${(testResults.overallSummary.overallPassRate * 100).toFixed(1)}%\n`;
      report += `- Duration: ${testResults.duration}ms\n\n`;
    }
    
    report += `### Workflow\n`;
    for (const step of agentData.workflow.steps) {
      const duration = step.endTime - step.startTime;
      report += `- ${step.step}: ${duration}ms\n`;
    }
    
    return report;
  }
}