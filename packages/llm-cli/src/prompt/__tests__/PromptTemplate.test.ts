import { PromptTemplate, PromptTemplateManager } from '../types';
import { DefaultPromptTemplateManager } from '../templates/DefaultPromptTemplateManager';
import { SessionState } from '../../runtime/session/types';

describe('PromptTemplate', () => {
  let manager: PromptTemplateManager;
  let session: SessionState;

  beforeEach(() => {
    manager = new DefaultPromptTemplateManager();
    session = {
      sessionId: 'test',
      state: new Map([['user', 'test']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('template merging', () => {
    it('should merge templates correctly', () => {
      const base: PromptTemplate = {
        systemTemplate: 'Base system: {{basePrompt}}',
        commandTemplate: 'Base command: {{name}}'
      };

      const override: PromptTemplate = {
        systemTemplate: 'Override system: {{basePrompt}}',
        contextTemplate: 'Override context: {{context}}'
      };

      const merged = manager.mergeTemplates(base, override);
      expect(merged.systemTemplate).toBe('Override system: {{basePrompt}}');
      expect(merged.commandTemplate).toBe('Base command: {{name}}');
      expect(merged.contextTemplate).toBe('Override context: {{context}}');
    });

    it('should handle null/undefined templates', () => {
      const base: PromptTemplate = {
        systemTemplate: 'Base: {{basePrompt}}'
      };

      const merged1 = manager.mergeTemplates(base, undefined);
      expect(merged1).toEqual(base);

      const merged2 = manager.mergeTemplates(undefined, base);
      expect(merged2).toEqual(base);

      const merged3 = manager.mergeTemplates(undefined, undefined);
      expect(merged3).toEqual({});
    });
  });

  describe('template rendering', () => {
    it('should render simple template', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: 'World' };
      
      const rendered = manager.renderTemplate(template, variables);
      expect(rendered).toBe('Hello World!');
    });

    it('should render multiple variables', () => {
      const template = '{{greeting}} {{name}}, today is {{day}}';
      const variables = { greeting: 'Hello', name: 'John', day: 'Monday' };
      
      const rendered = manager.renderTemplate(template, variables);
      expect(rendered).toBe('Hello John, today is Monday');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{name}}, age {{age}}';
      const variables = { name: 'John' };
      
      const rendered = manager.renderTemplate(template, variables);
      expect(rendered).toBe('Hello John, age {{age}}');
    });

    it('should handle nested objects', () => {
      const template = 'User: {{user.name}} ({{user.role}})';
      const variables = { user: { name: 'John', role: 'admin' } };
      
      const rendered = manager.renderTemplate(template, variables);
      expect(rendered).toBe('User: John (admin)');
    });
  });

  describe('custom sections', () => {
    it('should process custom sections', () => {
      const template: PromptTemplate = {
        customSections: [
          {
            name: 'warning',
            generator: (session) => 'Warning: Test mode active',
            priority: 10
          },
          {
            name: 'info',
            generator: (session) => 'Info: Current user is test',
            priority: 5
          }
        ]
      };

      const sections = manager.processCustomSections(template, session);
      expect(sections).toHaveLength(2);
      expect(sections[0]).toBe('Warning: Test mode active');
      expect(sections[1]).toBe('Info: Current user is test');
    });

    it('should sort sections by priority', () => {
      const template: PromptTemplate = {
        customSections: [
          {
            name: 'low',
            generator: () => 'Low priority',
            priority: 1
          },
          {
            name: 'high',
            generator: () => 'High priority',
            priority: 10
          },
          {
            name: 'medium',
            generator: () => 'Medium priority',
            priority: 5
          }
        ]
      };

      const sections = manager.processCustomSections(template, session);
      expect(sections).toEqual([
        'High priority',
        'Medium priority',
        'Low priority'
      ]);
    });

    it('should handle sections without priority', () => {
      const template: PromptTemplate = {
        customSections: [
          {
            name: 'no-priority',
            generator: () => 'No priority'
          },
          {
            name: 'with-priority',
            generator: () => 'With priority',
            priority: 5
          }
        ]
      };

      const sections = manager.processCustomSections(template, session);
      expect(sections).toEqual([
        'With priority',
        'No priority'
      ]);
    });
  });

  describe('template validation', () => {
    it('should validate correct template', () => {
      const template: PromptTemplate = {
        systemTemplate: 'System: {{basePrompt}}',
        commandTemplate: 'Command: {{name}} - {{description}}',
        contextTemplate: 'Context: {{context}}',
        historyTemplate: 'History: {{entry}}'
      };

      const result = manager.validateTemplate(template);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid template syntax', () => {
      const template: PromptTemplate = {
        systemTemplate: 'System: {{basePrompt',  // Missing closing brace
        commandTemplate: 'Command: {{name}} - {{description}}'
      };

      const result = manager.validateTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid template syntax in systemTemplate');
    });

    it('should detect required variables', () => {
      const template: PromptTemplate = {
        systemTemplate: 'System prompt without basePrompt variable'
      };

      const result = manager.validateTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('systemTemplate must contain {{basePrompt}} variable');
    });

    it('should validate custom sections', () => {
      const template: PromptTemplate = {
        customSections: [
          {
            name: '',  // Empty name
            generator: () => 'test'
          }
        ]
      };

      const result = manager.validateTemplate(template);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Custom section must have a name');
    });
  });

  describe('template overrides', () => {
    it('should apply overrides correctly', () => {
      const base: PromptTemplate = {
        systemTemplate: 'Base: {{basePrompt}}',
        commandTemplate: 'Base command: {{name}}'
      };

      const overrides: Partial<PromptTemplate> = {
        systemTemplate: 'Override: {{basePrompt}}',
        contextTemplate: 'New context: {{context}}'
      };

      const result = manager.applyOverrides(base, overrides);
      expect(result.systemTemplate).toBe('Override: {{basePrompt}}');
      expect(result.commandTemplate).toBe('Base command: {{name}}');
      expect(result.contextTemplate).toBe('New context: {{context}}');
    });

    it('should handle array overrides', () => {
      const base: PromptTemplate = {
        customSections: [
          { name: 'base', generator: () => 'base' }
        ]
      };

      const overrides: Partial<PromptTemplate> = {
        customSections: [
          { name: 'override', generator: () => 'override' }
        ]
      };

      const result = manager.applyOverrides(base, overrides);
      expect(result.customSections).toHaveLength(1);
      expect(result.customSections![0].name).toBe('override');
    });
  });

  describe('built-in variables', () => {
    it('should provide built-in variables', () => {
      const variables = manager.getBuiltInVariables(session);
      
      expect(variables).toHaveProperty('sessionId');
      expect(variables).toHaveProperty('timestamp');
      expect(variables).toHaveProperty('stateSize');
      expect(variables).toHaveProperty('historyLength');
      
      expect(variables.sessionId).toBe('test');
      expect(variables.stateSize).toBe(1);
      expect(variables.historyLength).toBe(0);
    });

    it('should format timestamp correctly', () => {
      const variables = manager.getBuiltInVariables(session);
      expect(variables.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});