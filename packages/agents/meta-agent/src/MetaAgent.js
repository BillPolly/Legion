/**
 * MetaAgent - A conversational agent that creates other agents
 * 
 * This is a thin wrapper around AgentCreator that provides a 
 * conversational interface for agent creation and management.
 * 
 * Use this when you want to create agents through natural language commands.
 * Use AgentCreator directly for programmatic agent creation.
 */

import { ConfigurableAgent } from '../../configurable-agent/src/index.js';
import { AgentCreator } from './AgentCreator.js';

export class MetaAgent extends ConfigurableAgent {
  constructor(config, resourceManager) {
    // Configure the meta-agent itself as a conversational agent
    const metaConfig = {
      agent: {
        id: config?.agent?.id || 'meta-agent',
        name: config?.agent?.name || 'Meta Agent',
        type: 'conversational',
        description: 'An agent that creates and manages other agents through conversation',
        version: '2.0.0',
        llm: {
          provider: config?.agent?.llm?.provider || 'anthropic',
          model: config?.agent?.llm?.model || 'claude-3-5-sonnet-20241022',
          temperature: config?.agent?.llm?.temperature || 0.7,
          maxTokens: config?.agent?.llm?.maxTokens || 1000
        },
        prompts: {
          system: config?.agent?.prompts?.system || `You are a Meta Agent responsible for creating and managing other AI agents.

You can help users:
- Design new agents based on their requirements
- Create agents from templates
- Test and validate agent configurations  
- Analyze and optimize agent performance
- Export agent configurations in various formats
- Manage multiple agents

Available commands:
- /create-agent {requirements} - Create a new agent
- /list-agents - List all created agents
- /test-agent [agent-id] - Test an agent
- /analyze-agent [agent-id] - Analyze agent configuration
- /optimize-agent [agent-id] - Optimize agent prompts
- /export-agent [agent-id] [format] - Export agent config (json/yaml/typescript)
- /list-templates - Show available templates
- /use-template [template-name] {variables} - Create from template
- /batch-create [{requirements1}, {requirements2}, ...] - Create multiple agents
- /agent-report [agent-id] - Get comprehensive agent report
- /help - Show available commands

When users describe what kind of agent they need, help them formulate proper requirements and guide them through the creation process.`,
          ...config?.agent?.prompts
        }
      },
      behavior: {
        responseStyle: 'professional',
        creativity: 0.3,
        verbosity: 'balanced',
        ...config?.behavior
      }
    };

    super(metaConfig, resourceManager);
    
    // Initialize the AgentCreator that will do the actual work
    this.agentCreator = null;
    this.initializationPromise = null;
  }

  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  async _initialize() {
    await super.initialize();
    
    // Create and initialize AgentCreator
    this.agentCreator = new AgentCreator(this.resourceManager);
    await this.agentCreator.initialize();
    
    this.initialized = true;
  }

  async cleanup() {
    if (this.agentCreator) {
      await this.agentCreator.cleanup();
    }
    // ConfigurableAgent doesn't have a cleanup method
    // but it has a shutdown mechanism via receive({ type: 'shutdown' })
    if (this.initialized) {
      await this.receive({ type: 'shutdown', from: 'system' });
    }
  }

  /**
   * Process messages - handle both commands and natural language
   */
  async processMessage(message) {
    const content = message.content?.trim() || '';
    
    // Handle commands
    if (content.startsWith('/')) {
      return await this.handleCommand(message);
    }
    
    // Handle natural language requests
    return await this.handleNaturalLanguage(message);
  }

  /**
   * Handle slash commands
   */
  async handleCommand(message) {
    const content = message.content.trim();
    const [command, ...args] = content.split(' ');
    const argString = args.join(' ');

    try {
      switch (command) {
        case '/create-agent':
          return await this.handleCreateAgent(argString);
        
        case '/list-agents':
          return await this.handleListAgents();
        
        case '/test-agent':
          return await this.handleTestAgent(args[0]);
        
        case '/analyze-agent':
          return await this.handleAnalyzeAgent(args[0]);
        
        case '/optimize-agent':
          return await this.handleOptimizeAgent(args[0]);
        
        case '/export-agent':
          return await this.handleExportAgent(args[0], args[1] || 'json');
        
        case '/list-templates':
          return await this.handleListTemplates();
        
        case '/use-template':
          return await this.handleUseTemplate(args[0], args.slice(1).join(' '));
        
        case '/batch-create':
          return await this.handleBatchCreate(argString);
        
        case '/agent-report':
          return await this.handleAgentReport(args[0]);
        
        case '/help':
          return await this.handleHelp();
        
        default:
          return {
            type: 'error',
            content: `Unknown command: ${command}. Type /help for available commands.`
          };
      }
    } catch (error) {
      return {
        type: 'error',
        content: `Command failed: ${error.message}`
      };
    }
  }

  /**
   * Handle natural language requests
   */
  async handleNaturalLanguage(message) {
    // Analyze the user's intent
    const intent = await this.analyzeIntent(message.content);
    
    if (intent.action === 'create') {
      return await this.guidedAgentCreation(intent.requirements);
    } else if (intent.action === 'help') {
      return await this.handleHelp();
    } else {
      // Default conversational response
      return await super.processMessage(message);
    }
  }

  /**
   * Analyze user intent from natural language
   */
  async analyzeIntent(content) {
    const lowerContent = content.toLowerCase();
    
    // Simple intent detection (could be enhanced with LLM)
    if (lowerContent.includes('create') || lowerContent.includes('build') || lowerContent.includes('make')) {
      // Extract requirements from natural language
      const requirements = {
        purpose: content,
        taskType: this.detectTaskType(content)
      };
      
      return { action: 'create', requirements };
    }
    
    if (lowerContent.includes('help') || lowerContent.includes('what can you')) {
      return { action: 'help' };
    }
    
    return { action: 'chat' };
  }

  /**
   * Detect task type from content
   */
  detectTaskType(content) {
    const lower = content.toLowerCase();
    if (lower.includes('chat') || lower.includes('convers') || lower.includes('support')) {
      return 'conversational';
    }
    if (lower.includes('analy') || lower.includes('review') || lower.includes('audit')) {
      return 'analytical';
    }
    if (lower.includes('creat') || lower.includes('writ') || lower.includes('generat')) {
      return 'creative';
    }
    return 'task';
  }

  /**
   * Guide user through agent creation
   */
  async guidedAgentCreation(initialRequirements) {
    const response = `I'll help you create an agent. Based on your request, I understand you want an agent to: ${initialRequirements.purpose}

Let me create this as a ${initialRequirements.taskType} agent.

Creating agent now...`;

    // Create the agent using AgentCreator
    try {
      const result = await this.agentCreator.createAgent(initialRequirements);
      
      return {
        type: 'agent_created',
        content: `${response}

✅ Agent created successfully!
- Name: ${result.agentName}
- ID: ${result.agentId}
- Type: ${initialRequirements.taskType}
- Tests Passed: ${result.testsPassed ? 'Yes' : 'No'}
- Registration ID: ${result.registrationId}

You can now:
- Test the agent: /test-agent ${result.agentId}
- Analyze it: /analyze-agent ${result.agentId}
- Export config: /export-agent ${result.agentId} json
- Get full report: /agent-report ${result.agentId}`,
        data: result
      };
    } catch (error) {
      return {
        type: 'error',
        content: `${response}\n\n❌ Failed to create agent: ${error.message}`
      };
    }
  }

  /**
   * Command Handlers - All delegate to AgentCreator
   */
  
  async handleCreateAgent(requirementsString) {
    try {
      const requirements = JSON.parse(requirementsString);
      const result = await this.agentCreator.createAgent(requirements);
      
      return {
        type: 'agent_created',
        content: `✅ Agent created successfully!
- Name: ${result.agentName}
- ID: ${result.agentId}
- Tests Passed: ${result.testsPassed ? 'Yes' : 'No'}
- Registration ID: ${result.registrationId}`,
        data: result
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          type: 'error',
          content: 'Invalid JSON format. Usage: /create-agent {"purpose": "...", "taskType": "..."}'
        };
      }
      return {
        type: 'error',
        content: `Failed to create agent: ${error.message}`
      };
    }
  }

  async handleListAgents() {
    const agents = this.agentCreator.listCreatedAgents();
    
    if (agents.length === 0) {
      return {
        type: 'agent_list',
        content: 'No agents have been created yet.',
        data: []
      };
    }
    
    let content = 'Created Agents:\n\n';
    agents.forEach((agent, index) => {
      content += `${index + 1}. ${agent.name} (${agent.id})\n`;
      content += `   Tests: ${agent.testsPassed ? '✅ Passed' : '❌ Failed'}\n`;
      content += `   Registration: ${agent.registrationId}\n\n`;
    });
    
    return {
      type: 'agent_list',
      content,
      data: agents
    };
  }

  async handleTestAgent(agentId) {
    if (!agentId) {
      return {
        type: 'error',
        content: 'Usage: /test-agent [agent-id]'
      };
    }
    
    const agent = this.agentCreator.getAgent(agentId);
    if (!agent) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    const testResults = this.agentCreator.getTestResults(agentId);
    
    return {
      type: 'test_results',
      content: `Test Results for ${agent.agent.name}:
- Total Tests: ${testResults.totalTests}
- Passed: ${testResults.passedTests}
- Failed: ${testResults.failedTests}
- Pass Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(1)}%`,
      data: testResults
    };
  }

  async handleAnalyzeAgent(agentId) {
    if (!agentId) {
      return {
        type: 'error',
        content: 'Usage: /analyze-agent [agent-id]'
      };
    }
    
    const agent = this.agentCreator.getAgent(agentId);
    if (!agent) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    const analysis = await this.agentCreator.analyzeAgent(agent.config);
    
    return {
      type: 'analysis',
      content: `Analysis for ${agent.agent.name}:
- Score: ${analysis.score}/100
- Issues: ${analysis.issues.length}
- Recommendations: ${analysis.recommendations.join(', ')}
- Suggestions: ${analysis.suggestions.slice(0, 3).join('; ')}`,
      data: analysis
    };
  }

  async handleOptimizeAgent(agentId) {
    if (!agentId) {
      return {
        type: 'error',
        content: 'Usage: /optimize-agent [agent-id]'
      };
    }
    
    const agent = this.agentCreator.getAgent(agentId);
    if (!agent) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    const result = await this.agentCreator.optimizePrompts(agent.config);
    
    return {
      type: 'optimization',
      content: `Optimization complete for ${agent.agent.name}:
- Optimizations applied: ${result.optimizations.length}
${result.optimizations.map(opt => `  - ${opt.type}: reduced by ${opt.reduction} characters`).join('\n')}`,
      data: result
    };
  }

  async handleExportAgent(agentId, format = 'json') {
    if (!agentId) {
      return {
        type: 'error',
        content: 'Usage: /export-agent [agent-id] [format]'
      };
    }
    
    const agent = this.agentCreator.getAgent(agentId);
    if (!agent) {
      return {
        type: 'error',
        content: `Agent ${agentId} not found`
      };
    }
    
    try {
      const exported = this.agentCreator.exportConfig(agent.config, format);
      
      return {
        type: 'export',
        content: `Agent configuration exported as ${format}:\n\n\`\`\`${format}\n${exported}\n\`\`\``,
        data: exported
      };
    } catch (error) {
      return {
        type: 'error',
        content: `Export failed: ${error.message}`
      };
    }
  }

  async handleListTemplates() {
    const templates = this.agentCreator.listTemplates();
    
    let content = 'Available Templates:\n\n';
    templates.forEach((template, index) => {
      content += `${index + 1}. ${template.name} (${template.type})\n`;
      content += `   ${template.description}\n`;
      content += `   Capabilities: ${template.capabilities.join(', ')}\n`;
      content += `   Tools: ${template.tools.join(', ')}\n\n`;
    });
    
    return {
      type: 'template_list',
      content,
      data: templates
    };
  }

  async handleUseTemplate(templateName, variablesString) {
    if (!templateName) {
      return {
        type: 'error',
        content: 'Usage: /use-template [template-name] {variables}'
      };
    }
    
    try {
      const variables = variablesString ? JSON.parse(variablesString) : {};
      const config = await this.agentCreator.generateFromTemplate(templateName, variables);
      
      // Create the agent
      const result = await this.agentCreator.createAgent({
        purpose: config.agent.description || `Agent from ${templateName} template`,
        taskType: config.agent.type
      });
      
      return {
        type: 'agent_created',
        content: `✅ Agent created from template '${templateName}':
- Name: ${result.agentName}
- ID: ${result.agentId}
- Registration ID: ${result.registrationId}`,
        data: result
      };
    } catch (error) {
      return {
        type: 'error',
        content: `Failed to create from template: ${error.message}`
      };
    }
  }

  async handleBatchCreate(requirementsArrayString) {
    try {
      const requirementsArray = JSON.parse(requirementsArrayString);
      const results = await this.agentCreator.designBatch(requirementsArray);
      
      return {
        type: 'batch_results',
        content: `Batch Creation Complete:
- Total: ${results.totalProcessed}
- Success: ${results.successCount}
- Errors: ${results.errorCount}

${results.results.map((r, i) => `${i + 1}. ✅ ${r.config.agent.name}`).join('\n')}
${results.errors.map((e, i) => `${i + 1}. ❌ Error: ${e.error}`).join('\n')}`,
        data: results
      };
    } catch (error) {
      return {
        type: 'error',
        content: `Batch creation failed: ${error.message}`
      };
    }
  }

  async handleAgentReport(agentId) {
    if (!agentId) {
      return {
        type: 'error',
        content: 'Usage: /agent-report [agent-id]'
      };
    }
    
    try {
      const report = await this.agentCreator.generateAgentReport(agentId);
      
      return {
        type: 'report',
        content: `# Agent Report: ${report.agent.name}

## Configuration
- ID: ${report.agent.id}
- Type: ${report.agent.type}
- Version: ${report.agent.version}
- Registration: ${report.agent.registrationId}

## LLM Settings
- Provider: ${report.configuration.llm.provider}
- Model: ${report.configuration.llm.model}
- Temperature: ${report.configuration.llm.temperature}

## Testing
- Status: ${report.testing.passed ? '✅ Passed' : '❌ Failed'}

## Analysis
- Score: ${report.analysis.score}/100
- Issues: ${report.analysis.issues.length}
- Recommendations: ${report.analysis.recommendations.join(', ')}`,
        data: report
      };
    } catch (error) {
      return {
        type: 'error',
        content: `Failed to generate report: ${error.message}`
      };
    }
  }

  async handleHelp() {
    return {
      type: 'help',
      content: `Meta Agent - Agent Creation and Management

**Available Commands:**

📝 **Creation**
- /create-agent {requirements} - Create a new agent
- /use-template [name] {vars} - Create from template
- /batch-create [{req1}, {req2}] - Create multiple agents

📋 **Management**
- /list-agents - List all created agents
- /list-templates - Show available templates

🧪 **Testing & Analysis**
- /test-agent [id] - Test an agent
- /analyze-agent [id] - Analyze configuration
- /optimize-agent [id] - Optimize prompts
- /agent-report [id] - Get full report

💾 **Export**
- /export-agent [id] [format] - Export config (json/yaml/typescript)

**Natural Language**
You can also describe what kind of agent you need in plain English, and I'll help you create it.

Examples:
- "Create a customer support agent"
- "I need an agent that can review code"
- "Build me a creative writing assistant"`
    };
  }
}