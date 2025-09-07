/**
 * Integration test for project setup
 * Verifies all infrastructure components work together
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { AgentConfigSchema, validateAgentConfig, getDefaultConfig } from '../../src/ConfigurationSchema.js';
import { 
  AgentError, 
  ConfigurationError, 
  isAgentError,
  formatErrorMessage 
} from '../../src/utils/ErrorHandling.js';
import { 
  getResourceManager, 
  getLLMClient,
  getEnvVar,
  initializeAgentResources 
} from '../../src/utils/ResourceAccess.js';
import { createAgentFromConfig } from '../../src/index.js';

describe('Project Setup Integration', () => {
  let resourceManager;
  let resources;

  beforeAll(async () => {
    // Initialize resources once for all tests
    resourceManager = await getResourceManager();
    resources = await initializeAgentResources();
  });

  describe('Configuration validation pipeline', () => {
    it('should validate and process a complete configuration', () => {
      // Create a configuration
      const config = getDefaultConfig('conversational');
      
      // Add some additional configuration
      config.agent.llm.temperature = 0.5;
      config.agent.capabilities = [
        {
          module: 'mock-calculator-module',
          tools: ['add', 'add', 'subtract'],
          permissions: {}
        }
      ];
      
      // Validate the configuration
      const validationResult = validateAgentConfig(config);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toEqual([]);
      
      // Configuration should be ready for agent creation
      expect(config.agent.id).toBeDefined();
      expect(config.agent.name).toBeDefined();
      expect(config.agent.type).toBe('conversational');
      expect(config.agent.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should properly handle invalid configuration with error context', () => {
      const invalidConfig = {
        agent: {
          name: 'Invalid Agent',
          // Missing required fields
        }
      };
      
      const validationResult = validateAgentConfig(invalidConfig);
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      
      // Create a ConfigurationError with validation errors
      const error = new ConfigurationError(
        'Invalid agent configuration',
        validationResult.errors
      );
      
      expect(isAgentError(error)).toBe(true);
      expect(error.context.validationErrors).toEqual(validationResult.errors);
      
      // Format error for logging
      const formatted = formatErrorMessage(error);
      expect(formatted).toContain('ConfigurationError');
      expect(formatted).toContain('CONFIG_ERROR');
      expect(formatted).toContain('Invalid agent configuration');
    });
  });

  describe('Resource access patterns', () => {
    it('should access ResourceManager consistently', async () => {
      const rm1 = await getResourceManager();
      const rm2 = await getResourceManager();
      
      expect(rm1).toBe(rm2);
      expect(rm1).toBe(resourceManager);
    });

    it('should access environment variables through ResourceManager', async () => {
      // Try to get MongoDB URL
      const mongoUrl = await getEnvVar('MONGODB_URL');
      
      // Should either be undefined or a string
      expect(mongoUrl === undefined || typeof mongoUrl === 'string').toBe(true);
      
      // Should match what ResourceManager returns
      const directValue = resourceManager.get('env.MONGODB_URL');
      expect(mongoUrl).toBe(directValue);
    });

    it('should handle resource initialization gracefully', async () => {
      const resources = await initializeAgentResources();
      
      expect(resources).toBeDefined();
      expect(resources.resourceManager).toBe(resourceManager);
      expect(resources.mongoUrl).toBeDefined();
      
      // LLM client and ToolRegistry may or may not be available
      // but should not throw errors
      if (resources.llmClient) {
        expect(resources.llmClient).toBeDefined();
      }
      
      if (resources.toolRegistry) {
        expect(resources.toolRegistry).toBeDefined();
      }
    });
  });

  describe('Error handling integration', () => {
    it('should chain errors with proper context', () => {
      // Simulate a validation error
      const validationError = new ConfigurationError(
        'Invalid LLM configuration',
        ['llm.provider: Invalid value']
      );
      
      // Wrap in a higher-level error
      const agentError = new AgentError(
        'Failed to create agent',
        'AGENT_CREATION_FAILED',
        { 
          originalError: validationError.message,
          agentId: 'test-agent'
        }
      );
      
      expect(isAgentError(validationError)).toBe(true);
      expect(isAgentError(agentError)).toBe(true);
      
      // Both errors should have proper context
      expect(validationError.context.validationErrors).toBeDefined();
      expect(agentError.context.originalError).toBeDefined();
      expect(agentError.context.agentId).toBe('test-agent');
    });

    it('should format different error types consistently', () => {
      const errors = [
        new ConfigurationError('Config error', ['field1: invalid']),
        new AgentError('Agent error', 'CUSTOM_CODE', { key: 'value' }),
        new Error('Standard error'),
        'String error'
      ];
      
      errors.forEach(error => {
        const formatted = formatErrorMessage(error);
        expect(formatted).toBeDefined();
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Module exports', () => {
    it('should export all required functions from index.js', async () => {
      // Dynamic import to test the module exports
      const moduleExports = await import('../../src/index.js');
      
      // Check main exports
      expect(typeof moduleExports.ConfigurableAgent).toBe('function');
      expect(typeof moduleExports.createAgentFromConfig).toBe('function');
      expect(typeof moduleExports.validateAgentConfig).toBe('function');
      
      // Check re-exported schemas
      expect(moduleExports.AgentConfigSchema).toBeDefined();
      
      // Check error classes
      expect(typeof moduleExports.AgentError).toBe('function');
      expect(typeof moduleExports.ConfigurationError).toBe('function');
    });
  });

  describe('Configuration schema completeness', () => {
    it('should define all required schema fields', () => {
      expect(AgentConfigSchema.type).toBe('object');
      expect(AgentConfigSchema.properties.agent).toBeDefined();
      
      const agentSchema = AgentConfigSchema.properties.agent;
      expect(agentSchema.properties.id).toBeDefined();
      expect(agentSchema.properties.name).toBeDefined();
      expect(agentSchema.properties.type).toBeDefined();
      expect(agentSchema.properties.version).toBeDefined();
      expect(agentSchema.properties.llm).toBeDefined();
      
      // Optional but defined schemas
      expect(agentSchema.properties.capabilities).toBeDefined();
      expect(agentSchema.properties.behaviorTree).toBeDefined();
      expect(agentSchema.properties.knowledge).toBeDefined();
      expect(agentSchema.properties.prompts).toBeDefined();
      expect(agentSchema.properties.state).toBeDefined();
    });

    it('should validate all agent types', () => {
      const agentTypes = ['conversational', 'task', 'analytical', 'creative'];
      
      agentTypes.forEach(type => {
        const config = getDefaultConfig(type);
        const result = validateAgentConfig(config);
        
        expect(result.valid).toBe(true);
        expect(config.agent.type).toBe(type);
      });
    });

    it('should validate all LLM providers', () => {
      const providers = ['anthropic', 'openai'];
      
      providers.forEach(provider => {
        const config = getDefaultConfig();
        config.agent.llm.provider = provider;
        config.agent.llm.model = provider === 'anthropic' 
          ? 'claude-3-5-sonnet-20241022' 
          : 'gpt-4';
        
        const result = validateAgentConfig(config);
        expect(result.valid).toBe(true);
      });
    });
  });
});