/**
 * AgentConfigBuilder - Fluent API for building agent configurations
 * Provides a clean, chainable interface for constructing agent configs
 */

export class AgentConfigBuilder {
  constructor() {
    this.reset();
  }

  reset() {
    this.config = {
      agent: {
        status: 'draft',
        version: '1.0.0'
      },
      prompts: {
        templates: [],
        variables: {}
      },
      capabilities: [],
      tools: [],
      knowledge: {
        sources: []
      },
      behavior: {
        rules: []
      },
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tags: []
      }
    };
    return this;
  }

  // Basic Configuration Methods
  withId(id) {
    this.config.agent.id = id;
    return this;
  }

  withName(name) {
    this.config.agent.name = name;
    return this;
  }

  withType(type) {
    const validTypes = ['conversational', 'task', 'analytical', 'creative'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid agent type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }
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

  withStatus(status) {
    this.config.agent.status = status;
    return this;
  }

  // LLM Configuration Methods
  withLLM(provider, model) {
    const validProviders = ['anthropic', 'openai'];
    if (!validProviders.includes(provider)) {
      throw new Error(`Invalid LLM provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
    }
    
    if (!this.config.agent.llm) {
      this.config.agent.llm = {};
    }
    
    this.config.agent.llm.provider = provider;
    this.config.agent.llm.model = model;
    return this;
  }

  withLLMParams(params) {
    if (!this.config.agent.llm) {
      this.config.agent.llm = {};
    }
    
    Object.assign(this.config.agent.llm, params);
    return this;
  }

  // Prompts Configuration Methods
  withSystemPrompt(prompt) {
    this.config.prompts.systemPrompt = prompt;
    return this;
  }

  addPromptTemplate(name, template) {
    this.config.prompts.templates.push({ name, template });
    return this;
  }

  withPromptVariables(variables) {
    this.config.prompts.variables = variables;
    return this;
  }

  withResponseFormat(format) {
    this.config.prompts.responseFormat = format;
    return this;
  }

  // Capabilities Configuration Methods
  addCapability(capability) {
    if (!this.config.capabilities.includes(capability)) {
      this.config.capabilities.push(capability);
    }
    return this;
  }

  withCapabilities(capabilities) {
    this.config.capabilities = [...new Set([...this.config.capabilities, ...capabilities])];
    return this;
  }

  // Tools Configuration Methods
  addTool(tool) {
    if (!this.config.tools.includes(tool)) {
      this.config.tools.push(tool);
    }
    return this;
  }

  withTools(tools) {
    this.config.tools = [...new Set([...this.config.tools, ...tools])];
    return this;
  }

  // Knowledge Configuration Methods
  addKnowledgeSource(source) {
    this.config.knowledge.sources.push(source);
    return this;
  }

  withKnowledgeUpdateStrategy(strategy, config) {
    this.config.knowledge.updateStrategy = strategy;
    this.config.knowledge.updateConfig = config;
    return this;
  }

  // Behavior Configuration Methods
  withBehaviorTree(tree) {
    this.config.behavior.tree = tree;
    return this;
  }

  addBehaviorRule(id, description) {
    this.config.behavior.rules.push({ id, description });
    return this;
  }

  // Metadata Configuration Methods
  withAuthor(author) {
    this.config.metadata.author = author;
    return this;
  }

  withTags(tags) {
    this.config.metadata.tags = tags;
    return this;
  }

  withCategory(category) {
    this.config.metadata.category = category;
    return this;
  }

  // Utility Methods
  clone() {
    const newBuilder = new AgentConfigBuilder();
    newBuilder.config = JSON.parse(JSON.stringify(this.config));
    return newBuilder;
  }

  static from(existingConfig) {
    const builder = new AgentConfigBuilder();
    builder.config = JSON.parse(JSON.stringify(existingConfig));
    
    // Ensure all required structures exist
    if (!builder.config.prompts) {
      builder.config.prompts = { templates: [], variables: {} };
    }
    if (!builder.config.prompts.templates) {
      builder.config.prompts.templates = [];
    }
    if (!builder.config.prompts.variables) {
      builder.config.prompts.variables = {};
    }
    if (!builder.config.capabilities) {
      builder.config.capabilities = [];
    }
    if (!builder.config.tools) {
      builder.config.tools = [];
    }
    if (!builder.config.knowledge) {
      builder.config.knowledge = { sources: [] };
    }
    if (!builder.config.behavior) {
      builder.config.behavior = { rules: [] };
    }
    if (!builder.config.metadata) {
      builder.config.metadata = {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        tags: []
      };
    }
    
    return builder;
  }

  // Build Method
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

    // Update modified timestamp
    this.config.metadata.modifiedAt = Date.now();

    // Return a deep copy to prevent external modifications
    return JSON.parse(JSON.stringify(this.config));
  }
}