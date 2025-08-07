/**
 * Unit tests for agent configuration
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AgentConfig } from '../../src/core/agents/base/AgentConfig.js';
import { ValidationError } from '../../src/foundation/types/errors/errors.js';

describe('AgentConfig', () => {
  describe('Construction', () => {
    test('should create config with default values', () => {
      const config = new AgentConfig();
      
      expect(config.name).toBe('DefaultAgent');
      expect(config.description).toBe('A planning agent');
      expect(config.maxRetries).toBe(3);
      expect(config.reflectionEnabled).toBe(true);
      expect(config.debugMode).toBe(false);
      expect(config.planningTimeout).toBe(30000);
      expect(config.parallelExecution).toBe(false);
    });

    test('should create config with custom values', () => {
      const options = {
        name: 'CustomAgent',
        description: 'Custom agent description',
        maxRetries: 5,
        reflectionEnabled: false,
        debugMode: true,
        planningTimeout: 60000,
        parallelExecution: true
      };
      
      const config = new AgentConfig(options);
      
      expect(config.name).toBe('CustomAgent');
      expect(config.description).toBe('Custom agent description');
      expect(config.maxRetries).toBe(5);
      expect(config.reflectionEnabled).toBe(false);
      expect(config.debugMode).toBe(true);
      expect(config.planningTimeout).toBe(60000);
      expect(config.parallelExecution).toBe(true);
    });

    test('should handle partial configuration', () => {
      const config = new AgentConfig({
        name: 'PartialAgent',
        maxRetries: 10
      });
      
      expect(config.name).toBe('PartialAgent');
      expect(config.maxRetries).toBe(10);
      expect(config.description).toBe('A planning agent'); // Default
      expect(config.reflectionEnabled).toBe(true); // Default
    });

    test('should handle null/undefined options', () => {
      expect(() => new AgentConfig(null)).not.toThrow();
      expect(() => new AgentConfig(undefined)).not.toThrow();
      
      const config = new AgentConfig(null);
      expect(config.name).toBe('DefaultAgent');
    });
  });

  describe('Validation', () => {
    test('should validate required string fields', () => {
      expect(() => new AgentConfig({ name: '' }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ name: '   ' }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ description: '' }).validate())
        .toThrow(ValidationError);
    });

    test('should validate maxRetries is positive', () => {
      expect(() => new AgentConfig({ maxRetries: 0 }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ maxRetries: -1 }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ maxRetries: 1 }).validate())
        .not.toThrow();
    });

    test('should validate planningTimeout is positive', () => {
      expect(() => new AgentConfig({ planningTimeout: 0 }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ planningTimeout: -1000 }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ planningTimeout: 1000 }).validate())
        .not.toThrow();
    });

    test('should validate boolean fields', () => {
      expect(() => new AgentConfig({ reflectionEnabled: 'true' }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ debugMode: 1 }).validate())
        .toThrow(ValidationError);
      
      expect(() => new AgentConfig({ parallelExecution: 'false' }).validate())
        .toThrow(ValidationError);
    });

    test('should accept valid configurations', () => {
      const validConfigs = [
        new AgentConfig(),
        new AgentConfig({ name: 'ValidAgent' }),
        new AgentConfig({ 
          name: 'ComplexAgent',
          maxRetries: 5,
          planningTimeout: 120000,
          reflectionEnabled: false,
          debugMode: true,
          parallelExecution: true
        })
      ];
      
      validConfigs.forEach(config => {
        expect(() => config.validate()).not.toThrow();
      });
    });

    test('should provide detailed error messages', () => {
      expect(() => new AgentConfig({ name: '' }).validate())
        .toThrow('Agent name must be a non-empty string');
      
      expect(() => new AgentConfig({ maxRetries: -1 }).validate())
        .toThrow('maxRetries must be a positive number');
      
      expect(() => new AgentConfig({ reflectionEnabled: 'yes' }).validate())
        .toThrow('reflectionEnabled must be a boolean');
    });
  });

  describe('Configuration Merging', () => {
    test('should merge configurations correctly', () => {
      const baseConfig = new AgentConfig({
        name: 'BaseAgent',
        maxRetries: 3,
        debugMode: false
      });
      
      const overrides = {
        maxRetries: 5,
        debugMode: true,
        planningTimeout: 45000
      };
      
      const merged = baseConfig.merge(overrides);
      
      expect(merged.name).toBe('BaseAgent'); // Unchanged
      expect(merged.maxRetries).toBe(5); // Overridden
      expect(merged.debugMode).toBe(true); // Overridden
      expect(merged.planningTimeout).toBe(45000); // Overridden
      expect(merged.reflectionEnabled).toBe(true); // Default preserved
    });

    test('should not modify original config during merge', () => {
      const original = new AgentConfig({ name: 'Original', maxRetries: 3 });
      const merged = original.merge({ maxRetries: 10 });
      
      expect(original.maxRetries).toBe(3);
      expect(merged.maxRetries).toBe(10);
      expect(merged).not.toBe(original);
    });

    test('should validate merged configuration', () => {
      const config = new AgentConfig({ name: 'ValidAgent' });
      
      expect(() => config.merge({ maxRetries: -1 }))
        .toThrow(ValidationError);
    });

    test('should handle null/undefined merge values', () => {
      const config = new AgentConfig({ name: 'TestAgent' });
      
      const merged1 = config.merge(null);
      const merged2 = config.merge(undefined);
      const merged3 = config.merge({});
      
      expect(merged1.name).toBe('TestAgent');
      expect(merged2.name).toBe('TestAgent');
      expect(merged3.name).toBe('TestAgent');
    });
  });

  describe('Configuration Clone', () => {
    test('should create deep copy of configuration', () => {
      const original = new AgentConfig({
        name: 'Original',
        maxRetries: 5,
        debugMode: true
      });
      
      const cloned = original.clone();
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      
      // Modify clone to ensure independence
      cloned.name = 'Modified';
      expect(original.name).toBe('Original');
    });

    test('should clone with overrides', () => {
      const original = new AgentConfig({
        name: 'Original',
        maxRetries: 3,
        debugMode: false
      });
      
      const cloned = original.clone({
        name: 'Cloned',
        debugMode: true
      });
      
      expect(cloned.name).toBe('Cloned');
      expect(cloned.maxRetries).toBe(3); // From original
      expect(cloned.debugMode).toBe(true); // Overridden
    });
  });

  describe('JSON Serialization', () => {
    test('should serialize to JSON correctly', () => {
      const config = new AgentConfig({
        name: 'SerializeTest',
        maxRetries: 7,
        reflectionEnabled: false
      });
      
      const json = config.toJSON();
      
      expect(json.name).toBe('SerializeTest');
      expect(json.maxRetries).toBe(7);
      expect(json.reflectionEnabled).toBe(false);
      expect(typeof json).toBe('object');
    });

    test('should create config from JSON', () => {
      const jsonData = {
        name: 'FromJSON',
        description: 'Created from JSON',
        maxRetries: 8,
        debugMode: true,
        planningTimeout: 90000,
        parallelExecution: true,
        reflectionEnabled: false
      };
      
      const config = AgentConfig.fromJSON(jsonData);
      
      expect(config).toBeInstanceOf(AgentConfig);
      expect(config.name).toBe('FromJSON');
      expect(config.maxRetries).toBe(8);
      expect(config.debugMode).toBe(true);
    });

    test('should handle incomplete JSON data', () => {
      const incompleteJson = {
        name: 'Incomplete',
        maxRetries: 5
        // Missing other fields
      };
      
      const config = AgentConfig.fromJSON(incompleteJson);
      
      expect(config.name).toBe('Incomplete');
      expect(config.maxRetries).toBe(5);
      expect(config.description).toBe('A planning agent'); // Default
      expect(config.reflectionEnabled).toBe(true); // Default
    });

    test('should validate JSON-created config', () => {
      const invalidJson = {
        name: '',
        maxRetries: -1
      };
      
      expect(() => AgentConfig.fromJSON(invalidJson))
        .toThrow(ValidationError);
    });
  });

  describe('Configuration Templates', () => {
    test('should provide performance-optimized template', () => {
      const perfConfig = AgentConfig.performanceOptimized('PerfAgent');
      
      expect(perfConfig.name).toBe('PerfAgent');
      expect(perfConfig.reflectionEnabled).toBe(false);
      expect(perfConfig.parallelExecution).toBe(true);
      expect(perfConfig.planningTimeout).toBeLessThan(30000);
    });

    test('should provide debugging template', () => {
      const debugConfig = AgentConfig.debugging('DebugAgent');
      
      expect(debugConfig.name).toBe('DebugAgent');
      expect(debugConfig.debugMode).toBe(true);
      expect(debugConfig.maxRetries).toBeGreaterThan(3);
      expect(debugConfig.reflectionEnabled).toBe(true);
    });

    test('should provide production template', () => {
      const prodConfig = AgentConfig.production('ProdAgent');
      
      expect(prodConfig.name).toBe('ProdAgent');
      expect(prodConfig.debugMode).toBe(false);
      expect(prodConfig.reflectionEnabled).toBe(true);
      expect(prodConfig.maxRetries).toBeGreaterThanOrEqual(3);
    });

    test('should allow template customization', () => {
      const customPerfConfig = AgentConfig.performanceOptimized('CustomPerf', {
        maxRetries: 10,
        debugMode: true
      });
      
      expect(customPerfConfig.name).toBe('CustomPerf');
      expect(customPerfConfig.maxRetries).toBe(10);
      expect(customPerfConfig.debugMode).toBe(true);
      expect(customPerfConfig.parallelExecution).toBe(true); // From template
    });
  });

  describe('Configuration Validation Rules', () => {
    test('should enforce reasonable timeout limits', () => {
      expect(() => new AgentConfig({ planningTimeout: 1 }).validate())
        .toThrow('planningTimeout must be at least 1000ms');
      
      expect(() => new AgentConfig({ planningTimeout: 600001 }).validate())
        .toThrow('planningTimeout must not exceed 600000ms (10 minutes)');
    });

    test('should enforce retry limits', () => {
      expect(() => new AgentConfig({ maxRetries: 100 }).validate())
        .toThrow('maxRetries must not exceed 20');
    });

    test('should validate agent name format', () => {
      expect(() => new AgentConfig({ name: 'invalid name with spaces' }).validate())
        .toThrow('Agent name must be a valid identifier');
      
      expect(() => new AgentConfig({ name: 'invalid-name' }).validate())
        .toThrow('Agent name must be a valid identifier');
      
      expect(() => new AgentConfig({ name: 'ValidAgentName123' }).validate())
        .not.toThrow();
    });

    test('should allow reasonable configuration values', () => {
      const validConfigs = [
        { planningTimeout: 1000 },
        { planningTimeout: 600000 },
        { maxRetries: 1 },
        { maxRetries: 20 },
        { name: 'Agent1' },
        { name: 'MyAgentName' },
        { name: 'TestAgent123' }
      ];
      
      validConfigs.forEach(configOptions => {
        expect(() => new AgentConfig(configOptions).validate())
          .not.toThrow();
      });
    });
  });

  describe('Configuration Summary', () => {
    test('should provide human-readable summary', () => {
      const config = new AgentConfig({
        name: 'SummaryTest',
        maxRetries: 5,
        reflectionEnabled: true,
        debugMode: false,
        planningTimeout: 45000,
        parallelExecution: true
      });
      
      const summary = config.getSummary();
      
      expect(summary).toContain('SummaryTest');
      expect(summary).toContain('5 retries');
      expect(summary).toContain('45s timeout');
      expect(summary).toContain('reflection enabled');
      expect(summary).toContain('parallel execution');
    });

    test('should indicate debug mode in summary', () => {
      const debugConfig = new AgentConfig({ debugMode: true });
      const prodConfig = new AgentConfig({ debugMode: false });
      
      expect(debugConfig.getSummary()).toContain('debug mode');
      expect(prodConfig.getSummary()).not.toContain('debug mode');
    });
  });
});