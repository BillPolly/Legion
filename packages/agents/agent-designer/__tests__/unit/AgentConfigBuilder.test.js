/**
 * Unit tests for AgentConfigBuilder
 * Fluent API for building agent configurations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentConfigBuilder } from '../../src/AgentConfigBuilder.js';

describe('AgentConfigBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new AgentConfigBuilder();
  });

  describe('Basic Configuration', () => {
    it('should build a minimal agent configuration', () => {
      const config = builder
        .withId('test-agent')
        .withName('TestAgent')
        .withType('conversational')
        .withVersion('1.0.0')
        .build();

      expect(config.agent.id).toBe('test-agent');
      expect(config.agent.name).toBe('TestAgent');
      expect(config.agent.type).toBe('conversational');
      expect(config.agent.version).toBe('1.0.0');
    });

    it('should support method chaining', () => {
      const result = builder
        .withId('chain-test')
        .withName('ChainTest')
        .withType('task')
        .withVersion('2.0.0')
        .withDescription('Test chaining');

      expect(result).toBe(builder);
    });

    it('should set default values for optional fields', () => {
      const config = builder
        .withId('minimal')
        .withName('MinimalAgent')
        .withType('conversational')
        .build();

      expect(config.agent.version).toBe('1.0.0');
      expect(config.agent.status).toBe('draft');
    });
  });

  describe('LLM Configuration', () => {
    it('should configure LLM provider and model', () => {
      const config = builder
        .withId('llm-test')
        .withName('LLMTest')
        .withType('conversational')
        .withLLM('anthropic', 'claude-3-5-sonnet-20241022')
        .build();

      expect(config.agent.llm.provider).toBe('anthropic');
      expect(config.agent.llm.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should configure LLM parameters', () => {
      const config = builder
        .withId('llm-params')
        .withName('LLMParams')
        .withType('analytical')
        .withLLM('openai', 'gpt-4')
        .withLLMParams({
          temperature: 0.5,
          maxTokens: 2000,
          topP: 0.9
        })
        .build();

      expect(config.agent.llm.temperature).toBe(0.5);
      expect(config.agent.llm.maxTokens).toBe(2000);
      expect(config.agent.llm.topP).toBe(0.9);
    });
  });

  describe('Prompts Configuration', () => {
    it('should set system prompt', () => {
      const config = builder
        .withId('prompt-test')
        .withName('PromptTest')
        .withType('conversational')
        .withSystemPrompt('You are a helpful assistant.')
        .build();

      expect(config.prompts.systemPrompt).toBe('You are a helpful assistant.');
    });

    it('should add prompt templates', () => {
      const config = builder
        .withId('template-test')
        .withName('TemplateTest')
        .withType('conversational')
        .addPromptTemplate('greeting', 'Hello! How can I help you?')
        .addPromptTemplate('farewell', 'Goodbye! Have a great day!')
        .build();

      expect(config.prompts.templates).toHaveLength(2);
      expect(config.prompts.templates[0].name).toBe('greeting');
      expect(config.prompts.templates[1].name).toBe('farewell');
    });

    it('should set prompt variables', () => {
      const config = builder
        .withId('var-test')
        .withName('VarTest')
        .withType('conversational')
        .withPromptVariables({
          userName: 'User',
          assistantName: 'Assistant'
        })
        .build();

      expect(config.prompts.variables.userName).toBe('User');
      expect(config.prompts.variables.assistantName).toBe('Assistant');
    });

    it('should configure response format', () => {
      const config = builder
        .withId('format-test')
        .withName('FormatTest')
        .withType('analytical')
        .withResponseFormat('json')
        .build();

      expect(config.prompts.responseFormat).toBe('json');
    });
  });

  describe('Capabilities Configuration', () => {
    it('should add individual capabilities', () => {
      const config = builder
        .withId('cap-test')
        .withName('CapTest')
        .withType('task')
        .addCapability('code_review')
        .addCapability('bug_detection')
        .addCapability('performance_analysis')
        .build();

      expect(config.capabilities).toHaveLength(3);
      expect(config.capabilities).toContain('code_review');
      expect(config.capabilities).toContain('bug_detection');
      expect(config.capabilities).toContain('performance_analysis');
    });

    it('should add multiple capabilities at once', () => {
      const config = builder
        .withId('multi-cap')
        .withName('MultiCap')
        .withType('task')
        .withCapabilities(['data_analysis', 'visualization', 'reporting'])
        .build();

      expect(config.capabilities).toHaveLength(3);
      expect(config.capabilities).toContain('data_analysis');
    });
  });

  describe('Tools Configuration', () => {
    it('should add individual tools', () => {
      const config = builder
        .withId('tool-test')
        .withName('ToolTest')
        .withType('task')
        .addTool('file_read')
        .addTool('file_write')
        .addTool('web_search')
        .build();

      expect(config.tools).toHaveLength(3);
      expect(config.tools).toContain('file_read');
      expect(config.tools).toContain('file_write');
      expect(config.tools).toContain('web_search');
    });

    it('should add multiple tools at once', () => {
      const config = builder
        .withId('multi-tool')
        .withName('MultiTool')
        .withType('task')
        .withTools(['calculator', 'code_executor', 'data_transformer'])
        .build();

      expect(config.tools).toHaveLength(3);
      expect(config.tools).toContain('calculator');
    });

    it('should prevent duplicate tools', () => {
      const config = builder
        .withId('dup-tool')
        .withName('DupTool')
        .withType('task')
        .addTool('file_read')
        .addTool('file_read')
        .addTool('file_write')
        .build();

      expect(config.tools).toHaveLength(2);
      expect(config.tools).toContain('file_read');
      expect(config.tools).toContain('file_write');
    });
  });

  describe('Knowledge Configuration', () => {
    it('should configure knowledge sources', () => {
      const config = builder
        .withId('knowledge-test')
        .withName('KnowledgeTest')
        .withType('analytical')
        .addKnowledgeSource({
          type: 'document',
          path: '/docs/manual.pdf',
          description: 'User manual'
        })
        .addKnowledgeSource({
          type: 'api',
          url: 'https://api.example.com',
          description: 'External API'
        })
        .build();

      expect(config.knowledge.sources).toHaveLength(2);
      expect(config.knowledge.sources[0].type).toBe('document');
      expect(config.knowledge.sources[1].type).toBe('api');
    });

    it('should set knowledge update strategy', () => {
      const config = builder
        .withId('update-test')
        .withName('UpdateTest')
        .withType('analytical')
        .withKnowledgeUpdateStrategy('periodic', { interval: 3600 })
        .build();

      expect(config.knowledge.updateStrategy).toBe('periodic');
      expect(config.knowledge.updateConfig.interval).toBe(3600);
    });
  });

  describe('Behavior Configuration', () => {
    it('should configure behavior tree', () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', name: 'greet' },
          { type: 'action', name: 'process' },
          { type: 'action', name: 'respond' }
        ]
      };

      const config = builder
        .withId('behavior-test')
        .withName('BehaviorTest')
        .withType('task')
        .withBehaviorTree(behaviorTree)
        .build();

      expect(config.behavior.tree).toEqual(behaviorTree);
    });

    it('should add behavior rules', () => {
      const config = builder
        .withId('rules-test')
        .withName('RulesTest')
        .withType('conversational')
        .addBehaviorRule('no_personal_info', 'Never share personal information')
        .addBehaviorRule('be_respectful', 'Always maintain respectful tone')
        .build();

      expect(config.behavior.rules).toHaveLength(2);
      expect(config.behavior.rules[0].id).toBe('no_personal_info');
    });
  });

  describe('Metadata Configuration', () => {
    it('should set metadata fields', () => {
      const config = builder
        .withId('meta-test')
        .withName('MetaTest')
        .withType('conversational')
        .withAuthor('John Doe')
        .withTags(['customer-service', 'chatbot', 'support'])
        .withCategory('support')
        .build();

      expect(config.metadata.author).toBe('John Doe');
      expect(config.metadata.tags).toContain('customer-service');
      expect(config.metadata.category).toBe('support');
    });

    it('should set creation and modification timestamps', () => {
      const before = Date.now();
      
      const config = builder
        .withId('time-test')
        .withName('TimeTest')
        .withType('conversational')
        .build();

      const after = Date.now();

      expect(config.metadata.createdAt).toBeGreaterThanOrEqual(before);
      expect(config.metadata.createdAt).toBeLessThanOrEqual(after);
      expect(config.metadata.modifiedAt).toEqual(config.metadata.createdAt);
    });
  });

  describe('Validation', () => {
    it('should validate required fields before building', () => {
      expect(() => {
        builder.build();
      }).toThrow('Agent ID is required');

      expect(() => {
        builder.withId('test').build();
      }).toThrow('Agent name is required');

      expect(() => {
        builder.withId('test').withName('Test').build();
      }).toThrow('Agent type is required');
    });

    it('should validate agent type', () => {
      expect(() => {
        builder
          .withId('invalid-type')
          .withName('InvalidType')
          .withType('invalid')
          .build();
      }).toThrow('Invalid agent type');
    });

    it('should validate LLM provider', () => {
      expect(() => {
        builder
          .withId('invalid-llm')
          .withName('InvalidLLM')
          .withType('conversational')
          .withLLM('invalid-provider', 'model')
          .build();
      }).toThrow('Invalid LLM provider');
    });
  });

  describe('Reset and Clone', () => {
    it('should reset builder to initial state', () => {
      builder
        .withId('test')
        .withName('Test')
        .withType('conversational')
        .reset();

      expect(() => builder.build()).toThrow('Agent ID is required');
    });

    it('should clone current configuration', () => {
      const original = builder
        .withId('original')
        .withName('Original')
        .withType('conversational')
        .withDescription('Original agent');

      const cloned = original.clone()
        .withId('cloned')
        .withName('Cloned');

      const originalConfig = original.build();
      const clonedConfig = cloned.build();

      expect(originalConfig.agent.id).toBe('original');
      expect(clonedConfig.agent.id).toBe('cloned');
      expect(clonedConfig.agent.description).toBe('Original agent');
    });
  });

  describe('From Existing Configuration', () => {
    it('should create builder from existing configuration', () => {
      const existing = {
        agent: {
          id: 'existing',
          name: 'ExistingAgent',
          type: 'conversational',
          version: '2.0.0',
          description: 'An existing agent'
        },
        prompts: {
          systemPrompt: 'You are helpful.'
        }
      };

      const config = AgentConfigBuilder.from(existing)
        .withName('ModifiedAgent')
        .build();

      expect(config.agent.id).toBe('existing');
      expect(config.agent.name).toBe('ModifiedAgent');
      expect(config.agent.version).toBe('2.0.0');
      expect(config.prompts.systemPrompt).toBe('You are helpful.');
    });
  });
});