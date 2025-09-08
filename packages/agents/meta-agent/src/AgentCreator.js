/**
 * AgentCreator - Single entry point for creating, testing, and deploying configurable agents
 * Combines agent design, testing, validation, and registration into one workflow
 */

import { ConfigurableAgent } from '../../configurable-agent/src/index.js';
import { AgentRegistry } from '../../agent-registry/src/index.js';
import { TestRunner } from '../../agent-testing/src/index.js';
import { PromptTester } from '../../prompt-engineering/src/index.js';

/**
 * AgentConfigBuilder - Builder pattern for creating agent configurations
 */
class AgentConfigBuilder {
  constructor() {
    this.config = {
      agent: {},
      behavior: {},
      capabilities: {}
    };
  }

  withId(id) {
    this.config.agent.id = id;
    return this;
  }

  withName(name) {
    this.config.agent.name = name;
    return this;
  }

  withType(type) {
    this.config.agent.type = type;
    return this;
  }

  withVersion(version) {
    this.config.agent.version = version;
    return this;
  }

  withDescription(description) {
    this.config.agent.description = description;
    return this;
  }

  withLLM(provider, model) {
    this.config.agent.llm = {
      provider,
      model,
      temperature: 0.7,
      maxTokens: 500
    };
    return this;
  }

  withLLMParams(params) {
    this.config.agent.llm = {
      ...this.config.agent.llm,
      ...params
    };
    return this;
  }

  withSystemPrompt(prompt) {
    if (!this.config.agent.prompts) {
      this.config.agent.prompts = {};
    }
    this.config.agent.prompts.system = prompt;
    return this;
  }

  withCapabilities(capabilities) {
    if (Array.isArray(capabilities)) {
      this.config.capabilities.skills = capabilities;
    } else {
      this.config.capabilities = {
        ...this.config.capabilities,
        ...capabilities
      };
    }
    return this;
  }

  withTools(tools) {
    this.config.capabilities.tools = tools;
    return this;
  }

  build() {
    // Validate required fields
    if (!this.config.agent.id) {
      throw new Error('Agent ID is required');
    }
    if (!this.config.agent.name) {
      throw new Error('Agent name is required');
    }
    if (!this.config.agent.type) {
      throw new Error('Agent type is required');
    }
    if (!this.config.agent.version) {
      this.config.agent.version = '1.0.0';
    }

    return this.config;
  }
}

export class AgentCreator {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.llmClient = null;
    
    // Components
    this.agentRegistry = null;
    this.testRunner = null;
    this.promptTester = null;
    
    // Track created agents
    this.createdAgents = new Map();
    this.testResults = new Map();
    
    // Pre-defined templates for common agent types
    this.templates = new Map();
    this.initializeTemplates();
  }

  initializeTemplates() {
    // Pre-defined templates from AgentDesigner
    this.templates.set('customer-support', {
      type: 'conversational',
      basePrompt: 'You are a helpful customer support agent for {companyName}. You assist customers with {productName}.',
      capabilities: ['answer questions', 'provide support', 'resolve issues'],
      tools: ['knowledge_search', 'ticket_create']
    });

    this.templates.set('code-reviewer', {
      type: 'analytical',
      basePrompt: 'You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.',
      capabilities: ['code analysis', 'bug detection', 'suggest improvements'],
      tools: ['code_analyzer', 'file_read']
    });

    this.templates.set('content-writer', {
      type: 'creative',
      basePrompt: 'You are a creative content writer who generates engaging and informative content.',
      capabilities: ['write articles', 'create stories', 'generate content'],
      tools: ['web_search', 'file_write']
    });

    this.templates.set('data-analyst', {
      type: 'analytical',
      basePrompt: 'You are a data analyst who processes and analyzes data to provide insights.',
      capabilities: ['data analysis', 'statistical analysis', 'report generation'],
      tools: ['data_transformer', 'file_read', 'file_write']
    });
  }

  async initialize() {
    if (this.initialized) return;
    
    // Get LLM client
    this.llmClient = await this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new Error('LLM client not available from ResourceManager');
    }
    
    // Initialize components
    this.agentRegistry = new AgentRegistry(this.resourceManager);
    await this.agentRegistry.initialize();
    
    this.testRunner = new TestRunner(this.resourceManager);
    await this.testRunner.initialize();
    
    this.promptTester = new PromptTester(this.resourceManager);
    await this.promptTester.initialize();
    
    this.initialized = true;
  }

  async cleanup() {
    if (this.promptTester) await this.promptTester.cleanup();
    if (this.testRunner) await this.testRunner.cleanup();
    if (this.agentRegistry) await this.agentRegistry.cleanup();
    
    this.initialized = false;
    this.llmClient = null;
    this.createdAgents.clear();
    this.testResults.clear();
  }

  /**
   * Main method: Create and test an agent from requirements
   */
  async createAgent(requirements) {
    if (!this.initialized) {
      await this.initialize();
    }

    const workflow = {
      id: `workflow-${Date.now()}`,
      requirements,
      startTime: Date.now(),
      steps: [],
      result: null
    };

    try {
      console.log('🎨 Step 1: Designing agent from requirements...');
      const agentConfig = await this.designAgent(requirements);
      workflow.steps.push({ 
        step: 'design', 
        success: true,
        config: agentConfig 
      });

      console.log('🤖 Step 2: Creating agent instance...');
      const agent = new ConfigurableAgent(agentConfig, this.resourceManager);
      await agent.initialize();
      workflow.steps.push({ 
        step: 'create', 
        success: true,
        agentId: agent.id 
      });

      // Only test if test cases are provided
      let testsPassed = true;
      if (requirements.testCases || requirements.autoTest !== false) {
        console.log('🧪 Step 3: Testing agent...');
        const testResults = await this.testAgent(agent, requirements);
        workflow.steps.push({ 
          step: 'test', 
          success: testResults.passed,
          results: testResults 
        });
        testsPassed = testResults.passed;

        // Refine if tests failed and refinement is enabled
        if (!testsPassed && requirements.autoRefine !== false) {
          console.log('🔧 Step 4: Refining agent based on test results...');
          const refinedConfig = await this.refineAgent(agentConfig, testResults);
          agent.updateConfiguration?.(refinedConfig);
          
          // Retest after refinement
          const retestResults = await this.testAgent(agent, requirements);
          workflow.steps.push({ 
            step: 'refine', 
            success: retestResults.passed,
            results: retestResults 
          });
          testsPassed = retestResults.passed;
        }
      }

      console.log('📝 Step 5: Registering agent...');
      const registration = await this.agentRegistry.registerAgent(agentConfig);
      workflow.steps.push({ 
        step: 'register', 
        success: true,
        registrationId: registration.id 
      });

      // Store the created agent
      this.createdAgents.set(agent.id, {
        agent,
        config: agentConfig,
        testsPassed,
        registrationId: registration.id
      });

      workflow.result = {
        success: true,
        agent,
        agentId: agent.id,
        agentName: agent.name,
        testsPassed,
        registrationId: registration.id
      };

      console.log(`✅ Agent "${agent.name}" created successfully!`);
      return workflow.result;

    } catch (error) {
      workflow.result = {
        success: false,
        error: error.message
      };
      console.error('❌ Agent creation failed:', error.message);
      return workflow.result;
    }
  }

  /**
   * Design an agent configuration from requirements
   */
  async designAgent(requirements) {
    if (!requirements.purpose) {
      throw new Error('Agent purpose is required');
    }

    // Determine agent type
    const agentType = this.determineAgentType(requirements);
    
    // Generate agent metadata
    const agentName = this.generateAgentName(requirements.purpose);
    const agentId = `${agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Build configuration
    const builder = new AgentConfigBuilder()
      .withId(agentId)
      .withName(agentName)
      .withType(agentType)
      .withVersion('1.0.0')
      .withDescription(requirements.purpose);

    // Configure LLM
    const llmProvider = requirements.llmProvider || 'anthropic';
    const llmModel = requirements.llmModel || 'claude-3-5-sonnet-20241022';
    builder.withLLM(llmProvider, llmModel);

    // Set LLM parameters
    if (requirements.constraints) {
      builder.withLLMParams(requirements.constraints);
    }

    // Generate and set prompts
    const systemPrompt = this.generateSystemPrompt(requirements, agentType);
    builder.withSystemPrompt(systemPrompt);

    // Add capabilities
    if (requirements.capabilities) {
      builder.withCapabilities(requirements.capabilities);
    }

    // Add tools if specified
    const tools = this.determineTools(requirements);
    if (tools.length > 0) {
      builder.withTools(tools);
    }

    return builder.build();
  }

  /**
   * Test an agent with provided test cases
   */
  async testAgent(agent, requirements) {
    const testResults = {
      passed: true,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      results: []
    };

    // Use provided test cases or generate default ones
    const testCases = requirements.testCases || this.generateDefaultTestCases(requirements);
    
    for (const testCase of testCases) {
      testResults.totalTests++;
      
      try {
        const response = await agent.receive({
          type: 'chat',
          content: testCase.input,
          sessionId: `test-${Date.now()}`
        });

        const responseText = typeof response.content === 'string' 
          ? response.content 
          : response.content?.content || JSON.stringify(response.content);

        // Check if response matches expected patterns
        let passed = false;
        if (testCase.expectedPatterns) {
          for (const pattern of testCase.expectedPatterns) {
            if (responseText.toLowerCase().includes(pattern.toLowerCase())) {
              passed = true;
              break;
            }
          }
        } else {
          // If no patterns specified, just check for non-empty response
          passed = responseText && responseText.length > 0;
        }

        if (passed) {
          testResults.passedTests++;
        } else {
          testResults.failedTests++;
          testResults.passed = false;
        }

        testResults.results.push({
          testCase: testCase.name,
          input: testCase.input,
          response: responseText.substring(0, 200) + '...',
          passed,
          expectedPatterns: testCase.expectedPatterns
        });

      } catch (error) {
        testResults.failedTests++;
        testResults.passed = false;
        testResults.results.push({
          testCase: testCase.name,
          input: testCase.input,
          error: error.message,
          passed: false
        });
      }
    }

    // Store test results
    this.testResults.set(agent.id, testResults);
    
    return testResults;
  }

  /**
   * Refine an agent configuration based on test results
   */
  async refineAgent(config, testResults) {
    const refinedConfig = { ...config };
    
    // Analyze failures
    const failures = testResults.results.filter(r => !r.passed);
    
    if (failures.length > 0) {
      // Make the system prompt more explicit
      const currentPrompt = refinedConfig.agent.prompts?.system || '';
      refinedConfig.agent.prompts = {
        ...refinedConfig.agent.prompts,
        system: currentPrompt + '\n\nIMPORTANT: Be clear, specific, and always respond appropriately to user queries.'
      };
      
      // Lower temperature for more consistent responses
      if (refinedConfig.agent.llm) {
        refinedConfig.agent.llm.temperature = Math.max(0.3, (refinedConfig.agent.llm.temperature || 0.7) - 0.2);
      }
      
      // Add examples if many failures
      if (failures.length > testResults.totalTests / 2) {
        refinedConfig.agent.prompts.examples = failures.slice(0, 3).map(f => ({
          input: f.input,
          expectedPatterns: f.expectedPatterns
        }));
      }
    }
    
    return refinedConfig;
  }

  /**
   * Helper methods
   */
  determineAgentType(requirements) {
    const purpose = requirements.purpose.toLowerCase();
    const taskType = requirements.taskType;

    if (taskType) return taskType;

    if (purpose.includes('chat') || purpose.includes('support') || purpose.includes('convers')) {
      return 'conversational';
    }
    if (purpose.includes('analy') || purpose.includes('review') || purpose.includes('data')) {
      return 'analytical';
    }
    if (purpose.includes('creat') || purpose.includes('writ') || purpose.includes('generat')) {
      return 'creative';
    }
    return 'task';
  }

  generateAgentName(purpose) {
    const words = purpose.split(' ')
      .filter(w => w.length > 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1));
    
    const name = words.slice(0, 2).join('') + 'Agent';
    return name;
  }

  generateSystemPrompt(requirements, agentType) {
    let prompt = `You are a ${agentType} AI agent. Your purpose is to ${requirements.purpose}.`;
    
    if (requirements.capabilities && requirements.capabilities.length > 0) {
      prompt += ` You have the following capabilities: ${requirements.capabilities.join(', ')}.`;
    }

    // Add personality based on type
    switch (agentType) {
      case 'conversational':
        prompt += ' Be friendly, helpful, and engaging in your responses.';
        break;
      case 'analytical':
        prompt += ' Be thorough, precise, and data-driven in your analysis.';
        break;
      case 'creative':
        prompt += ' Be creative, innovative, and think outside the box.';
        break;
      case 'task':
        prompt += ' Be efficient, focused, and action-oriented.';
        break;
    }

    return prompt;
  }

  determineTools(requirements) {
    const tools = [];
    const purpose = requirements.purpose.toLowerCase();
    
    // Add tools based on capabilities
    if (requirements.capabilities) {
      for (const capability of requirements.capabilities) {
        const cap = capability.toLowerCase();
        if (cap.includes('file')) tools.push('file_operations');
        if (cap.includes('search')) tools.push('web_search');
        if (cap.includes('data')) tools.push('data_analysis');
        if (cap.includes('code')) tools.push('code_execution');
      }
    }
    
    // Add tools based on purpose
    if (purpose.includes('file') || purpose.includes('document')) {
      tools.push('file_operations');
    }
    if (purpose.includes('search') || purpose.includes('research')) {
      tools.push('web_search');
    }
    
    // Remove duplicates
    return [...new Set(tools)];
  }

  generateDefaultTestCases(requirements) {
    const agentType = this.determineAgentType(requirements);
    const testCases = [];
    
    // Add type-specific test cases
    switch (agentType) {
      case 'conversational':
        testCases.push({
          name: 'Greeting Test',
          input: 'Hello',
          expectedPatterns: ['hello', 'hi', 'greetings']
        });
        testCases.push({
          name: 'Help Request',
          input: 'Can you help me?',
          expectedPatterns: ['help', 'assist', 'support']
        });
        break;
        
      case 'analytical':
        testCases.push({
          name: 'Analysis Request',
          input: 'Analyze this data: 10, 20, 30, 40',
          expectedPatterns: ['average', 'mean', 'analysis', 'data']
        });
        break;
        
      case 'creative':
        testCases.push({
          name: 'Creative Request',
          input: 'Write a short poem',
          expectedPatterns: ['poem', 'verse', 'rhyme']
        });
        break;
        
      default:
        testCases.push({
          name: 'Basic Functionality',
          input: 'What can you do?',
          expectedPatterns: ['help', 'assist', 'can']
        });
    }
    
    return testCases;
  }

  /**
   * Get a created agent by ID
   */
  getAgent(agentId) {
    return this.createdAgents.get(agentId);
  }

  /**
   * List all created agents
   */
  listCreatedAgents() {
    return Array.from(this.createdAgents.values()).map(entry => ({
      id: entry.agent.id,
      name: entry.agent.name,
      testsPassed: entry.testsPassed,
      registrationId: entry.registrationId
    }));
  }

  /**
   * Get test results for an agent
   */
  getTestResults(agentId) {
    return this.testResults.get(agentId);
  }

  /**
   * Analyze an agent configuration for issues and improvements
   * From AgentDesigner
   */
  async analyzeAgent(config) {
    const issues = [];
    const suggestions = [];
    const recommendations = [];

    // Check prompts
    if (!config.agent?.prompts?.system || config.agent.prompts.system.length < 20) {
      issues.push({
        type: 'prompt',
        severity: 'high',
        message: 'System prompt is too vague or missing'
      });
      recommendations.push('Add a more detailed system prompt');
    }

    // Check capabilities
    if (!config.agent?.capabilities || Object.keys(config.agent.capabilities).length === 0) {
      issues.push({
        type: 'capability',
        severity: 'high',
        message: 'No capabilities defined'
      });
      recommendations.push('Define agent capabilities');
    }

    // Check tools
    if (config.agent?.capabilities?.tools) {
      const invalidTools = config.agent.capabilities.tools.filter(tool => 
        !this.isValidTool(tool)
      );
      if (invalidTools.length > 0) {
        issues.push({
          type: 'tool',
          severity: 'high',
          message: `Invalid tools: ${invalidTools.join(', ')}`
        });
        recommendations.push('Remove or replace invalid tools');
      }
    }

    // Calculate score (0-100)
    let score = 100;
    issues.forEach(issue => {
      if (issue.severity === 'high') score -= 20;
      if (issue.severity === 'medium') score -= 10;
      if (issue.severity === 'low') score -= 5;
    });
    score = Math.max(0, score);

    // Generate suggestions
    suggestions.push('Consider adding more specific capabilities');
    suggestions.push('Enhance prompts with examples');
    suggestions.push('Add behavior rules for edge cases');

    return {
      issues,
      suggestions,
      recommendations,
      score
    };
  }

  /**
   * Optimize prompts for better performance
   * From AgentDesigner
   */
  async optimizePrompts(config) {
    const optimizedConfig = { ...config };
    const optimizations = [];

    // Optimize system prompt
    if (config.agent?.prompts?.system) {
      const original = config.agent.prompts.system;
      const optimized = this.optimizePromptText(original);
      
      if (!optimizedConfig.agent.prompts) {
        optimizedConfig.agent.prompts = {};
      }
      optimizedConfig.agent.prompts.system = optimized;
      
      if (optimized !== original) {
        optimizations.push({
          type: 'system_prompt',
          original: original.length,
          optimized: optimized.length,
          reduction: original.length - optimized.length
        });
      }
    }

    return {
      config: optimizedConfig,
      optimizations
    };
  }

  /**
   * Helper method to optimize prompt text
   * From AgentDesigner
   */
  optimizePromptText(text) {
    // Simple optimization: remove redundant words and phrases
    let optimized = text
      .replace(/various tasks and/g, '')
      .replace(/detailed explanations for everything/g, 'clear explanations')
      .replace(/assist you today with your request/g, 'assist you')
      .trim();

    // Remove duplicate spaces
    optimized = optimized.replace(/\s+/g, ' ');

    return optimized;
  }

  /**
   * Generate agent from template
   * From AgentDesigner
   */
  async generateFromTemplate(templateName, variables = {}) {
    if (!this.templates.has(templateName)) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const template = this.templates.get(templateName);
    
    // Generate agent name based on template and variables
    const agentName = (variables.companyName || 'Generic') + ' ' + templateName.split('-').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ') + ' Agent';
    const agentId = `${agentName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Build configuration from template
    const builder = new AgentConfigBuilder()
      .withId(agentId)
      .withName(agentName)
      .withType(template.type)
      .withVersion('1.0.0')
      .withLLM('anthropic', 'claude-3-5-sonnet-20241022');

    // Process system prompt with variables
    let systemPrompt = template.basePrompt;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      systemPrompt = systemPrompt.replace(regex, variables[key]);
    });
    builder.withSystemPrompt(systemPrompt);

    // Add template capabilities and tools
    if (template.capabilities) {
      builder.withCapabilities(template.capabilities);
    }
    if (template.tools) {
      builder.withTools(template.tools);
    }

    return builder.build();
  }

  /**
   * Design multiple agents in batch
   * From AgentDesigner
   */
  async designBatch(batchRequirements) {
    const results = [];
    const errors = [];

    for (let i = 0; i < batchRequirements.length; i++) {
      const requirements = batchRequirements[i];
      try {
        const config = await this.designAgent(requirements);
        results.push({
          index: i,
          success: true,
          config,
          requirements
        });
      } catch (error) {
        errors.push({
          index: i,
          success: false,
          error: error.message,
          requirements
        });
      }
    }

    return {
      results,
      errors,
      totalProcessed: batchRequirements.length,
      successCount: results.length,
      errorCount: errors.length
    };
  }

  /**
   * Export agent configuration to different formats
   * From AgentDesigner
   */
  exportConfig(config, format = 'json') {
    if (format === 'json') {
      return JSON.stringify(config, null, 2);
    } else if (format === 'yaml') {
      // Simple YAML conversion
      let yaml = '';
      const addToYaml = (obj, indent = '') => {
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            yaml += `${indent}${key}:\n`;
            addToYaml(value, indent + '  ');
          } else if (Array.isArray(value)) {
            yaml += `${indent}${key}:\n`;
            value.forEach(item => {
              if (typeof item === 'object') {
                yaml += `${indent}  -\n`;
                addToYaml(item, indent + '    ');
              } else {
                yaml += `${indent}  - ${item}\n`;
              }
            });
          } else {
            yaml += `${indent}${key}: ${value}\n`;
          }
        });
      };
      addToYaml(config);
      return yaml;
    } else if (format === 'typescript') {
      // Export as TypeScript interface
      return `export interface AgentConfig {
  agent: {
    id: '${config.agent.id}';
    name: '${config.agent.name}';
    type: '${config.agent.type}';
    version: '${config.agent.version}';
    description: '${config.agent.description || ''}';
    llm: {
      provider: '${config.agent.llm?.provider || 'anthropic'}';
      model: '${config.agent.llm?.model || 'claude-3-5-sonnet-20241022'}';
      temperature: ${config.agent.llm?.temperature || 0.7};
      maxTokens: ${config.agent.llm?.maxTokens || 500};
    };
    prompts: {
      system: \`${config.agent.prompts?.system || ''}\`;
    };
    capabilities?: {
      tools?: string[];
    };
  };
}`;
    }
    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Validate agent configuration
   * From AgentDesigner
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!config.agent) {
      errors.push('Missing agent configuration');
      return { valid: false, errors, warnings };
    }

    // Check required agent fields
    if (!config.agent.id) errors.push('Agent id is required');
    if (!config.agent.name) errors.push('Agent name is required');
    if (!config.agent.type) errors.push('Agent type is required');
    if (!config.agent.version) errors.push('Agent version is required');
    
    // Validate agent type
    const validTypes = ['conversational', 'task', 'analytical', 'creative'];
    if (config.agent.type && !validTypes.includes(config.agent.type)) {
      errors.push(`Invalid agent type: ${config.agent.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate LLM configuration
    if (!config.agent.llm) {
      errors.push('LLM configuration is required');
    } else {
      const validProviders = ['anthropic', 'openai'];
      if (!validProviders.includes(config.agent.llm.provider)) {
        errors.push(`Invalid LLM provider: ${config.agent.llm.provider}. Must be one of: ${validProviders.join(', ')}`);
      }
      if (!config.agent.llm.model) {
        errors.push('LLM model is required');
      }
      
      // Validate temperature
      if (config.agent.llm.temperature !== undefined) {
        if (config.agent.llm.temperature < 0 || config.agent.llm.temperature > 2) {
          warnings.push('Temperature should be between 0 and 2');
        }
      }
    }

    // Validate prompts
    if (!config.agent.prompts?.system) {
      warnings.push('System prompt is recommended for better agent behavior');
    }

    // Validate tools if present
    if (config.agent.capabilities?.tools) {
      const invalidTools = config.agent.capabilities.tools.filter(tool => 
        !this.isValidTool(tool)
      );
      if (invalidTools.length > 0) {
        warnings.push(`Unknown tools detected: ${invalidTools.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a tool name is valid
   * From AgentDesigner
   */
  isValidTool(toolName) {
    const validTools = [
      'file_read', 'file_write', 'file_operations',
      'web_search', 'web_fetch',
      'calculator', 'code_analyzer', 'code_execution',
      'data_transformer', 'data_analysis',
      'directory_manager', 'knowledge_search',
      'ticket_create', 'ticket_creation',
      'escalation', 'json_manipulation'
    ];
    return validTools.includes(toolName);
  }

  /**
   * List available templates
   * From AgentDesigner
   */
  listTemplates() {
    return Array.from(this.templates.entries()).map(([name, template]) => ({
      name,
      type: template.type,
      description: template.basePrompt.substring(0, 100) + '...',
      capabilities: template.capabilities,
      tools: template.tools
    }));
  }

  /**
   * Add a custom template
   */
  addTemplate(name, template) {
    if (!template.type || !template.basePrompt) {
      throw new Error('Template must have type and basePrompt');
    }
    this.templates.set(name, template);
  }

  /**
   * Get comprehensive agent report
   */
  async generateAgentReport(agentId) {
    const agentData = this.createdAgents.get(agentId);
    if (!agentData) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const testResults = this.testResults.get(agentId);
    const analysis = await this.analyzeAgent(agentData.config);

    return {
      agent: {
        id: agentData.agent.id,
        name: agentData.agent.name,
        type: agentData.config.agent.type,
        version: agentData.config.agent.version,
        registrationId: agentData.registrationId
      },
      configuration: {
        llm: agentData.config.agent.llm,
        capabilities: agentData.config.agent.capabilities,
        prompts: {
          system: agentData.config.agent.prompts?.system?.substring(0, 200) + '...'
        }
      },
      testing: {
        passed: agentData.testsPassed,
        results: testResults
      },
      analysis: {
        score: analysis.score,
        issues: analysis.issues,
        recommendations: analysis.recommendations
      }
    };
  }
}