/**
 * Unit tests for AgentDesigner
 * Following TDD methodology - tests first, then implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { AgentDesigner } from '../../src/AgentDesigner.js';
import { ResourceManager } from '@legion/resource-manager';

describe('AgentDesigner', () => {
  let designer;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = await ResourceManager.getInstance();
    designer = new AgentDesigner(resourceManager);
    await designer.initialize();
  });

  afterEach(async () => {
    if (designer) {
      await designer.cleanup();
    }
  });

  describe('Initialization', () => {
    it('should require ResourceManager', () => {
      expect(() => new AgentDesigner()).toThrow('ResourceManager is required');
    });

    it('should initialize successfully', async () => {
      const newDesigner = new AgentDesigner(resourceManager);
      await newDesigner.initialize();
      expect(newDesigner.initialized).toBe(true);
      await newDesigner.cleanup();
    });

    it('should provide access to LLM client after initialization', async () => {
      expect(designer.llmClient).toBeDefined();
    });
  });

  describe('Agent Design', () => {
    it('should design a conversational agent from requirements', async () => {
      const requirements = {
        purpose: 'Customer support chatbot',
        capabilities: ['answer questions', 'provide information', 'be helpful'],
        constraints: {
          maxTokens: 2000,
          temperature: 0.7
        }
      };

      const result = await designer.designAgent(requirements);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig).toBeDefined();
      expect(result.agentConfig.agent).toBeDefined();
      expect(result.agentConfig.agent.type).toBe('conversational');
      expect(result.agentConfig.agent.name).toContain('Support');
      expect(result.agentConfig.prompts).toBeDefined();
    });

    it('should design a task agent from requirements', async () => {
      const requirements = {
        purpose: 'Code review automation',
        capabilities: ['analyze code', 'suggest improvements', 'find bugs'],
        taskType: 'analytical'
      };

      const result = await designer.designAgent(requirements);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.agent.type).toBe('analytical');
      expect(result.agentConfig.capabilities).toBeDefined();
      expect(result.agentConfig.capabilities.some(c => c.includes('code'))).toBe(true);
    });

    it('should generate appropriate prompts for agent purpose', async () => {
      const requirements = {
        purpose: 'Creative writing assistant',
        capabilities: ['generate stories', 'suggest plot ideas', 'develop characters']
      };

      const result = await designer.designAgent(requirements);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.prompts).toBeDefined();
      expect(result.agentConfig.prompts.systemPrompt).toContain('creative');
      expect(result.agentConfig.prompts.templates).toBeDefined();
      expect(result.agentConfig.prompts.templates.length).toBeGreaterThan(0);
    });

    it('should include appropriate tools based on capabilities', async () => {
      const requirements = {
        purpose: 'File management assistant',
        capabilities: ['read files', 'write files', 'organize directories']
      };

      const result = await designer.designAgent(requirements);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.tools).toBeDefined();
      expect(result.agentConfig.tools).toContain('file_read');
      expect(result.agentConfig.tools).toContain('file_write');
    });

    it('should handle invalid requirements gracefully', async () => {
      const requirements = {
        // Missing purpose
        capabilities: ['do something']
      };

      const result = await designer.designAgent(requirements);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('purpose');
    });
  });

  describe('Agent Refinement', () => {
    it('should refine an existing agent configuration', async () => {
      const existingConfig = {
        agent: {
          id: 'test-agent',
          name: 'TestAgent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        },
        prompts: {
          systemPrompt: 'You are a helpful assistant.'
        }
      };

      const refinements = {
        addCapabilities: ['code analysis'],
        adjustPersonality: 'more technical and precise',
        addTools: ['code_analyzer']
      };

      const result = await designer.refineAgent(existingConfig, refinements);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.capabilities).toContain('code analysis');
      expect(result.agentConfig.prompts.systemPrompt).toContain('technical');
      expect(result.agentConfig.tools).toContain('code_analyzer');
    });

    it('should optimize prompts for better performance', async () => {
      const config = {
        agent: {
          id: 'verbose-agent',
          name: 'VerboseAgent',
          type: 'conversational',
          version: '1.0.0'
        },
        prompts: {
          systemPrompt: 'You are an assistant that helps with various tasks and provides detailed explanations for everything you do.',
          templates: [
            {
              name: 'greeting',
              template: 'Hello! How can I assist you today with your request?'
            }
          ]
        }
      };

      const result = await designer.optimizePrompts(config);
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.prompts.systemPrompt.length).toBeLessThan(
        config.prompts.systemPrompt.length
      );
      expect(result.optimizations).toBeDefined();
      expect(result.optimizations.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Analysis', () => {
    it('should analyze agent configuration for issues', async () => {
      const config = {
        agent: {
          id: 'problematic-agent',
          name: 'ProblematicAgent',
          type: 'conversational',
          version: '1.0.0'
        },
        prompts: {
          systemPrompt: 'Be helpful.',  // Too vague
          templates: []  // No templates
        },
        capabilities: [],  // No capabilities
        tools: ['non_existent_tool']  // Invalid tool
      };

      const analysis = await designer.analyzeAgent(config);
      
      expect(analysis.issues).toBeDefined();
      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.issues.some(i => i.type === 'prompt')).toBe(true);
      expect(analysis.issues.some(i => i.type === 'capability')).toBe(true);
      expect(analysis.issues.some(i => i.type === 'tool')).toBe(true);
      expect(analysis.recommendations).toBeDefined();
    });

    it('should provide improvement suggestions', async () => {
      const config = {
        agent: {
          id: 'basic-agent',
          name: 'BasicAgent',
          type: 'conversational',
          version: '1.0.0'
        },
        prompts: {
          systemPrompt: 'You are a helpful assistant.'
        }
      };

      const analysis = await designer.analyzeAgent(config);
      
      expect(analysis.suggestions).toBeDefined();
      expect(analysis.suggestions.length).toBeGreaterThan(0);
      expect(analysis.score).toBeDefined();
      expect(analysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Template Generation', () => {
    it('should generate agent from template', async () => {
      const result = await designer.generateFromTemplate('customer-support', {
        companyName: 'TechCorp',
        productName: 'CloudService'
      });
      
      expect(result.success).toBe(true);
      expect(result.agentConfig.agent.name).toContain('Support');
      expect(result.agentConfig.prompts.systemPrompt).toContain('TechCorp');
      expect(result.agentConfig.prompts.systemPrompt).toContain('CloudService');
    });

    it('should list available templates', async () => {
      const templates = await designer.listTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContain('customer-support');
      expect(templates).toContain('code-reviewer');
      expect(templates).toContain('content-writer');
    });

    it('should handle unknown template gracefully', async () => {
      const result = await designer.generateFromTemplate('non-existent', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('template');
    });
  });

  describe('Batch Operations', () => {
    it('should design multiple agents from batch requirements', async () => {
      const batchRequirements = [
        {
          purpose: 'Email responder',
          capabilities: ['compose emails', 'professional tone']
        },
        {
          purpose: 'Data analyzer',
          capabilities: ['analyze data', 'generate reports']
        }
      ];

      const results = await designer.designBatch(batchRequirements);
      
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].agentConfig.agent.name).toContain('Email');
      expect(results[1].agentConfig.agent.name).toContain('Data');
    });

    it('should handle partial batch failures', async () => {
      const batchRequirements = [
        {
          purpose: 'Valid agent',
          capabilities: ['do something']
        },
        {
          // Invalid - missing purpose
          capabilities: ['do something else']
        }
      ];

      const results = await designer.designBatch(batchRequirements);
      
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Export and Validation', () => {
    it('should export agent configuration in different formats', async () => {
      const config = {
        agent: {
          id: 'export-test',
          name: 'ExportTest',
          type: 'conversational',
          version: '1.0.0'
        }
      };

      const jsonExport = await designer.exportConfig(config, 'json');
      expect(typeof jsonExport).toBe('string');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      const yamlExport = await designer.exportConfig(config, 'yaml');
      expect(typeof yamlExport).toBe('string');
      expect(yamlExport).toContain('agent:');
    });

    it('should validate agent configuration', async () => {
      const validConfig = {
        agent: {
          id: 'valid-agent',
          name: 'ValidAgent',
          type: 'conversational',
          version: '1.0.0',
          llm: {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022'
          }
        }
      };

      const validation = await designer.validateConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should identify validation errors', async () => {
      const invalidConfig = {
        agent: {
          // Missing required fields
          name: 'InvalidAgent'
        }
      };

      const validation = await designer.validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('id'))).toBe(true);
    });
  });
});