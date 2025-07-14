/**
 * Tests for PromptBuilder utility
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PromptBuilder } from '../../src/utils/PromptBuilder.js';

describe('PromptBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new PromptBuilder();
  });

  describe('Basic Prompt Building', () => {
    test('should create simple prompt', () => {
      const prompt = builder
        .addSystemMessage('You are a helpful coding assistant.')
        .addUserMessage('Create a simple HTML page')
        .build();

      expect(prompt.system).toBe('You are a helpful coding assistant.');
      expect(prompt.user).toBe('Create a simple HTML page');
      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[1].role).toBe('user');
    });

    test('should support method chaining', () => {
      const result = builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .addAssistantMessage('Assistant');

      expect(result).toBe(builder);
    });

    test('should build messages array', () => {
      const prompt = builder
        .addSystemMessage('You are helpful')
        .addUserMessage('Hello')
        .addAssistantMessage('Hi there')
        .addUserMessage('How are you?')
        .build();

      expect(prompt.messages).toHaveLength(4);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[1].role).toBe('user');
      expect(prompt.messages[2].role).toBe('assistant');
      expect(prompt.messages[3].role).toBe('user');
    });

    test('should clear messages', () => {
      builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .clear();

      const prompt = builder.build();
      expect(prompt.messages).toHaveLength(0);
    });
  });

  describe('Template System', () => {
    test('should use predefined templates', () => {
      const prompt = builder
        .useTemplate('code-generation')
        .addContext({ language: 'javascript', type: 'function' })
        .addUserMessage('Create an add function')
        .build();

      expect(prompt.system).toContain('code generation');
      expect(prompt.system).toContain('javascript');
    });

    test('should register custom template', () => {
      builder.registerTemplate('custom', {
        system: 'Custom system message for {domain}',
        context: ['domain']
      });

      const prompt = builder
        .useTemplate('custom')
        .addContext({ domain: 'testing' })
        .build();

      expect(prompt.system).toBe('Custom system message for testing');
    });

    test('should throw error for unknown template', () => {
      expect(() => {
        builder.useTemplate('unknown-template');
      }).toThrow('Unknown template: unknown-template');
    });

    test('should handle missing template variables', () => {
      const prompt = builder
        .useTemplate('code-generation')
        .addContext({ language: 'javascript' })
        .build();

      expect(prompt.system).toContain('javascript');
      expect(prompt.system).toContain('{type}'); // Unfilled variable
    });
  });

  describe('Context Management', () => {
    test('should add context variables', () => {
      builder
        .addContext({ project: 'todo-app', technology: 'vanilla-js' })
        .addContext({ features: ['CRUD', 'localStorage'] });

      const context = builder.getContext();
      expect(context.project).toBe('todo-app');
      expect(context.technology).toBe('vanilla-js');
      expect(context.features).toEqual(['CRUD', 'localStorage']);
    });

    test('should interpolate context in messages', () => {
      const prompt = builder
        .addContext({ projectName: 'MyApp', tech: 'JavaScript' })
        .addSystemMessage('You are building {projectName} using {tech}')
        .addUserMessage('Create the main file for {projectName}')
        .build();

      expect(prompt.messages[0].content).toBe('You are building MyApp using JavaScript');
      expect(prompt.messages[1].content).toBe('Create the main file for MyApp');
    });

    test('should handle complex context objects', () => {
      const prompt = builder
        .addContext({
          requirements: {
            frontend: ['responsive', 'accessible'],
            backend: ['REST API', 'authentication']
          }
        })
        .addUserMessage('Build based on requirements: {requirements}')
        .build();

      expect(prompt.messages[0].content).toContain('frontend');
      expect(prompt.messages[0].content).toContain('backend');
    });
  });

  describe('Formatting Options', () => {
    test('should format as string', () => {
      const promptString = builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .format('string');

      expect(typeof promptString).toBe('string');
      expect(promptString).toContain('System:');
      expect(promptString).toContain('User:');
    });

    test('should format as messages array', () => {
      const messages = builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .format('messages');

      expect(Array.isArray(messages)).toBe(true);
      expect(messages).toHaveLength(2);
    });

    test('should format as OpenAI format', () => {
      const openaiFormat = builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .format('openai');

      expect(openaiFormat.model).toBeDefined();
      expect(openaiFormat.messages).toHaveLength(2);
      expect(openaiFormat.messages[0].role).toBe('system');
    });

    test('should include metadata in build', () => {
      const prompt = builder
        .addMetadata({ version: '1.0', timestamp: Date.now() })
        .addUserMessage('Test')
        .build();

      expect(prompt.metadata.version).toBe('1.0');
      expect(prompt.metadata.timestamp).toBeDefined();
    });
  });

  describe('Specialized Prompts', () => {
    test('should build code planning prompt', () => {
      const prompt = PromptBuilder.createCodePlanningPrompt({
        task: 'Create a todo application',
        requirements: {
          frontend: 'HTML, CSS, JavaScript',
          features: ['Add todos', 'Delete todos', 'Mark complete']
        },
        constraints: ['No frameworks', 'Accessible']
      });

      expect(prompt.messages[0].content).toContain('planning');
      expect(prompt.messages[1].content).toContain('todo application');
      expect(prompt.messages[1].content).toContain('No frameworks');
    });

    test('should build test generation prompt', () => {
      const prompt = PromptBuilder.createTestGenerationPrompt({
        code: 'function add(a, b) { return a + b; }',
        framework: 'jest',
        coverage: 'unit'
      });

      expect(prompt.messages[0].content).toContain('test');
      expect(prompt.messages[0].content).toContain('jest');
      expect(prompt.messages[1].content).toContain('add(a, b)');
    });

    test('should build error fixing prompt', () => {
      const prompt = PromptBuilder.createErrorFixingPrompt({
        code: 'const x = y + 1;',
        error: 'ReferenceError: y is not defined',
        context: 'Variable y should be initialized'
      });

      expect(prompt.messages[0].content).toContain('fix');
      expect(prompt.messages[1].content).toContain('ReferenceError');
      expect(prompt.messages[1].content).toContain('y is not defined');
    });

    test('should build architecture prompt', () => {
      const prompt = PromptBuilder.createArchitecturePrompt({
        projectType: 'fullstack',
        scale: 'small',
        requirements: ['User authentication', 'Data persistence']
      });

      expect(prompt.messages[0].content).toContain('architecture');
      expect(prompt.messages[1].content).toContain('fullstack');
      expect(prompt.messages[1].content).toContain('authentication');
    });
  });

  describe('Validation and Safety', () => {
    test('should validate message roles', () => {
      expect(() => {
        builder.addMessage('invalid-role', 'content');
      }).toThrow('Invalid role: invalid-role');
    });

    test('should limit prompt length', () => {
      const longContent = 'x'.repeat(10000);
      
      const prompt = builder
        .setMaxLength(100)
        .addUserMessage(longContent)
        .build();

      expect(prompt.messages[0].content.length).toBeLessThanOrEqual(100);
      expect(prompt.messages[0].content).toContain('...');
    });

    test('should sanitize inputs', () => {
      const prompt = builder
        .addContext({ userInput: '<script>alert("xss")</script>' })
        .addUserMessage('Process this: {userInput}')
        .build();

      expect(prompt.messages[0].content).not.toContain('<script>');
      expect(prompt.messages[0].content).toContain('&lt;script&gt;');
    });

    test('should handle circular references in context', () => {
      const circular = { name: 'test' };
      circular.self = circular;

      expect(() => {
        builder
          .addContext({ data: circular })
          .addUserMessage('Use {data}')
          .build();
      }).not.toThrow();
    });
  });

  describe('Advanced Features', () => {
    test('should support conditional messages', () => {
      const prompt = builder
        .addContext({ includeExamples: true })
        .addSystemMessage('Base system')
        .addConditionalMessage(
          (ctx) => ctx.includeExamples,
          'user',
          'Here are some examples...'
        )
        .build();

      expect(prompt.messages).toHaveLength(2);
      expect(prompt.messages[1].content).toContain('examples');
    });

    test('should support message transformers', () => {
      const prompt = builder
        .addTransformer((message) => ({
          ...message,
          content: message.content.toUpperCase()
        }))
        .addUserMessage('hello world')
        .build();

      expect(prompt.messages[0].content).toBe('HELLO WORLD');
    });

    test('should support prompt composition', () => {
      const base = new PromptBuilder()
        .addSystemMessage('Base system');

      const extended = builder
        .compose(base)
        .addUserMessage('Additional message')
        .build();

      expect(extended.messages).toHaveLength(2);
      expect(extended.messages[0].content).toBe('Base system');
    });

    test('should export and import prompts', () => {
      const original = builder
        .addSystemMessage('System')
        .addUserMessage('User')
        .addContext({ key: 'value' });

      const exported = original.export();
      const imported = new PromptBuilder().import(exported);
      const prompt = imported.build();

      expect(prompt.messages).toHaveLength(2);
      expect(imported.getContext().key).toBe('value');
    });
  });

  describe('Static Factory Methods', () => {
    test('should create from template with context', () => {
      const prompt = PromptBuilder.fromTemplate('code-generation', {
        language: 'javascript',
        type: 'class',
        task: 'Create a Calculator class'
      });

      expect(prompt.messages[0].content).toContain('javascript');
      expect(prompt.messages[0].content).toContain('class');
      expect(prompt.messages[1].content).toContain('Calculator');
    });

    test('should create empty builder', () => {
      const builder = PromptBuilder.create();
      expect(builder).toBeInstanceOf(PromptBuilder);
      expect(builder.build().messages).toHaveLength(0);
    });
  });
});