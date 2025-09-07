/**
 * AgentDesigner - Designs and configures agents based on requirements
 * Uses LLM to generate optimal agent configurations
 */

import { AgentConfigBuilder } from './AgentConfigBuilder.js';

export class AgentDesigner {
  constructor(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    this.resourceManager = resourceManager;
    this.initialized = false;
    this.llmClient = null;
    this.templates = new Map();
    this.initializeTemplates();
  }

  async initialize() {
    this.llmClient = await this.resourceManager.get('llmClient');
    if (!this.llmClient) {
      throw new Error('LLM client not available from ResourceManager');
    }
    this.initialized = true;
  }

  async cleanup() {
    this.initialized = false;
    this.llmClient = null;
  }

  initializeTemplates() {
    // Pre-defined templates for common agent types
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
  }

  async designAgent(requirements) {
    if (!requirements.purpose) {
      return {
        success: false,
        error: 'Agent purpose is required'
      };
    }

    try {
      // Determine agent type based on requirements
      const agentType = this.determineAgentType(requirements);
      
      // Generate agent name from purpose
      const agentName = this.generateAgentName(requirements.purpose);
      
      // Generate unique ID
      const agentId = this.generateAgentId(agentName);

      // Build base configuration
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

      // Set constraints if provided
      if (requirements.constraints) {
        builder.withLLMParams(requirements.constraints);
      }

      // Generate prompts
      const prompts = await this.generatePrompts(requirements, agentType);
      builder.withSystemPrompt(prompts.systemPrompt);
      
      if (prompts.templates) {
        prompts.templates.forEach(template => {
          builder.addPromptTemplate(template.name, template.template);
        });
      }

      // Add capabilities
      if (requirements.capabilities) {
        builder.withCapabilities(requirements.capabilities);
      }

      // Determine and add tools
      const tools = this.determineTools(requirements);
      if (tools.length > 0) {
        builder.withTools(tools);
      }

      const agentConfig = builder.build();

      return {
        success: true,
        agentConfig
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  determineAgentType(requirements) {
    const purpose = requirements.purpose.toLowerCase();
    const taskType = requirements.taskType;

    if (taskType) {
      return taskType;
    }

    if (purpose.includes('chat') || purpose.includes('support') || purpose.includes('convers')) {
      return 'conversational';
    }
    if (purpose.includes('analy') || purpose.includes('review') || purpose.includes('audit')) {
      return 'analytical';
    }
    if (purpose.includes('creat') || purpose.includes('writ') || purpose.includes('generat')) {
      return 'creative';
    }
    return 'task';
  }

  generateAgentName(purpose) {
    // Extract key words from purpose
    const words = purpose.split(' ')
      .filter(w => w.length > 3)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1));
    
    const name = words.slice(0, 2).join('') + 'Agent';
    return name.includes('Agent') ? name : name + 'Agent';
  }

  generateAgentId(name) {
    const timestamp = Date.now();
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${cleanName}-${timestamp}`;
  }

  async generatePrompts(requirements, agentType) {
    const purpose = requirements.purpose;
    const capabilities = requirements.capabilities || [];

    // Generate system prompt based on purpose and capabilities
    let systemPrompt = `You are a ${agentType} AI agent. Your purpose is to ${purpose}.`;
    
    if (capabilities.length > 0) {
      systemPrompt += ` You have the following capabilities: ${capabilities.join(', ')}.`;
    }

    // Add personality traits based on type
    if (agentType === 'conversational') {
      systemPrompt += ' Be friendly, helpful, and engaging in your responses.';
    } else if (agentType === 'analytical') {
      systemPrompt += ' Be thorough, precise, and data-driven in your analysis.';
    } else if (agentType === 'creative') {
      systemPrompt += ' Be creative, innovative, and think outside the box.';
    }

    // Generate templates for common interactions
    const templates = [];
    
    if (agentType === 'conversational') {
      templates.push({
        name: 'greeting',
        template: 'Hello! I\'m here to help with ' + purpose + '. How can I assist you today?'
      });
      templates.push({
        name: 'clarification',
        template: 'I\'d be happy to help with that. Could you provide more details about {topic}?'
      });
    } else if (agentType === 'creative') {
      templates.push({
        name: 'brainstorm',
        template: 'Let me help you brainstorm creative ideas for ' + purpose + '.'
      });
      templates.push({
        name: 'generate',
        template: 'I\'ll generate creative content based on your requirements.'
      });
    } else if (agentType === 'analytical') {
      templates.push({
        name: 'analyze',
        template: 'I\'ll analyze the data and provide insights.'
      });
    } else {
      // Default template for task agents
      templates.push({
        name: 'execute',
        template: 'I\'ll help you with ' + purpose + '.'
      });
    }

    return {
      systemPrompt,
      templates
    };
  }

  determineTools(requirements) {
    const tools = [];
    const purpose = requirements.purpose.toLowerCase();
    const capabilities = (requirements.capabilities || []).join(' ').toLowerCase();
    const combined = purpose + ' ' + capabilities;

    // Map keywords to tools
    if (combined.includes('file') || combined.includes('read') || combined.includes('write')) {
      tools.push('file_read', 'file_write');
    }
    if (combined.includes('code') || combined.includes('analyz')) {
      tools.push('code_analyzer');
    }
    if (combined.includes('search') || combined.includes('web')) {
      tools.push('web_search');
    }
    if (combined.includes('data') || combined.includes('transform')) {
      tools.push('data_transformer');
    }
    if (combined.includes('directory') || combined.includes('organiz')) {
      tools.push('directory_manager');
    }

    return [...new Set(tools)]; // Remove duplicates
  }

  async refineAgent(existingConfig, refinements) {
    try {
      const builder = AgentConfigBuilder.from(existingConfig);

      // Add new capabilities
      if (refinements.addCapabilities) {
        refinements.addCapabilities.forEach(cap => {
          if (!existingConfig.capabilities || !existingConfig.capabilities.includes(cap)) {
            builder.addCapability(cap);
          }
        });
      }

      // Adjust personality in prompts
      if (refinements.adjustPersonality) {
        const currentPrompt = existingConfig.prompts?.systemPrompt || '';
        const refinedPrompt = currentPrompt + ' ' + 
          `Adjust your communication style to be ${refinements.adjustPersonality}.`;
        builder.withSystemPrompt(refinedPrompt);
      }

      // Add new tools
      if (refinements.addTools) {
        refinements.addTools.forEach(tool => {
          builder.addTool(tool);
        });
      }

      const agentConfig = builder.build();

      return {
        success: true,
        agentConfig
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async optimizePrompts(config) {
    try {
      const optimizations = [];
      const builder = AgentConfigBuilder.from(config);

      // Optimize system prompt
      if (config.prompts?.systemPrompt) {
        const original = config.prompts.systemPrompt;
        const optimized = this.optimizePromptText(original);
        builder.withSystemPrompt(optimized);
        
        if (optimized !== original) {
          optimizations.push({
            type: 'system_prompt',
            original: original.length,
            optimized: optimized.length,
            reduction: original.length - optimized.length
          });
        }
      }

      // Optimize templates
      if (config.prompts?.templates) {
        config.prompts.templates.forEach(template => {
          const optimized = this.optimizePromptText(template.template);
          if (optimized !== template.template) {
            optimizations.push({
              type: 'template',
              name: template.name,
              original: template.template.length,
              optimized: optimized.length
            });
          }
        });
      }

      const agentConfig = builder.build();

      return {
        success: true,
        agentConfig,
        optimizations
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

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

  async analyzeAgent(config) {
    const issues = [];
    const suggestions = [];
    const recommendations = [];

    // Check prompts
    if (!config.prompts?.systemPrompt || config.prompts.systemPrompt.length < 20) {
      issues.push({
        type: 'prompt',
        severity: 'high',
        message: 'System prompt is too vague or missing'
      });
      recommendations.push('Add a more detailed system prompt');
    }

    if (!config.prompts?.templates || config.prompts.templates.length === 0) {
      issues.push({
        type: 'prompt',
        severity: 'medium',
        message: 'No prompt templates defined'
      });
      suggestions.push('Add prompt templates for common interactions');
    }

    // Check capabilities
    if (!config.capabilities || config.capabilities.length === 0) {
      issues.push({
        type: 'capability',
        severity: 'high',
        message: 'No capabilities defined'
      });
      recommendations.push('Define agent capabilities');
    }

    // Check tools
    if (config.tools) {
      const invalidTools = config.tools.filter(tool => 
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

  isValidTool(toolName) {
    const validTools = [
      'file_read', 'file_write', 'web_search', 'calculator',
      'code_analyzer', 'data_transformer', 'directory_manager',
      'knowledge_search', 'ticket_create', 'code_executor'
    ];
    return validTools.includes(toolName);
  }

  async generateFromTemplate(templateName, variables) {
    if (!this.templates.has(templateName)) {
      return {
        success: false,
        error: `template '${templateName}' not found`
      };
    }

    try {
      const template = this.templates.get(templateName);
      
      // Generate agent name based on template and variables
      const agentName = (variables.companyName || 'Generic') + 'SupportAgent';
      const agentId = this.generateAgentId(agentName);

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
        systemPrompt = systemPrompt.replace(`{${key}}`, variables[key]);
      });
      builder.withSystemPrompt(systemPrompt);

      // Add template capabilities and tools
      if (template.capabilities) {
        builder.withCapabilities(template.capabilities);
      }
      if (template.tools) {
        builder.withTools(template.tools);
      }

      const agentConfig = builder.build();

      return {
        success: true,
        agentConfig
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async listTemplates() {
    return Array.from(this.templates.keys());
  }

  async designBatch(batchRequirements) {
    const results = [];

    for (const requirements of batchRequirements) {
      const result = await this.designAgent(requirements);
      results.push(result);
    }

    return results;
  }

  async exportConfig(config, format) {
    if (format === 'json') {
      return JSON.stringify(config, null, 2);
    } else if (format === 'yaml') {
      // Simple YAML conversion (real implementation would use a YAML library)
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
    }
    throw new Error(`Unsupported format: ${format}`);
  }

  async validateConfig(config) {
    const errors = [];

    // Validate required fields
    if (!config.agent) {
      errors.push('Missing agent configuration');
    } else {
      if (!config.agent.id) errors.push('Agent id is required');
      if (!config.agent.name) errors.push('Agent name is required');
      if (!config.agent.type) errors.push('Agent type is required');
      if (!config.agent.version) errors.push('Agent version is required');
      
      // Validate agent type
      const validTypes = ['conversational', 'task', 'analytical', 'creative'];
      if (config.agent.type && !validTypes.includes(config.agent.type)) {
        errors.push(`Invalid agent type: ${config.agent.type}`);
      }

      // Validate LLM configuration
      if (config.agent.llm) {
        const validProviders = ['anthropic', 'openai'];
        if (!validProviders.includes(config.agent.llm.provider)) {
          errors.push(`Invalid LLM provider: ${config.agent.llm.provider}`);
        }
        if (!config.agent.llm.model) {
          errors.push('LLM model is required');
        }
      } else {
        errors.push('LLM configuration is required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}