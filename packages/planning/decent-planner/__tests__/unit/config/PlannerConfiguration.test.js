/**
 * Unit tests for PlannerConfiguration
 * Pure configuration tests with no external dependencies
 * Following Clean Architecture and TDD principles
 */

// Test functions are provided by the test runner as globals
import { PlannerConfiguration } from '../../../src/config/PlannerConfiguration.js';

describe('PlannerConfiguration', () => {
  describe('default configuration', () => {
    it('should create configuration with defaults', () => {
      const config = new PlannerConfiguration();
      
      expect(config.decomposition.maxDepth).toBe(5);
      expect(config.decomposition.minSubtasks).toBe(2);
      expect(config.decomposition.maxSubtasks).toBe(10);
      
      expect(config.toolDiscovery.confidenceThreshold).toBe(0.7);
      expect(config.toolDiscovery.maxToolsPerTask).toBe(10);
      expect(config.toolDiscovery.semanticSearchEnabled).toBe(true);
      
      expect(config.formalPlanning.enabled).toBe(true);
      expect(config.formalPlanning.validateBehaviorTrees).toBe(true);
      
      expect(config.logging.level).toBe('info');
      expect(config.logging.prefix).toBe('[DecentPlanner]');
      expect(config.logging.enableTimestamp).toBe(true);
      
      expect(config.validation.strictMode).toBe(true);
      expect(config.validation.maxWarnings).toBe(10);
      
      expect(config.performance.timeout).toBe(300000);
      expect(config.performance.parallelExecution).toBe(true);
      expect(config.performance.cacheEnabled).toBe(true);
    });
  });
  
  describe('custom configuration', () => {
    it('should accept custom values', () => {
      const config = new PlannerConfiguration({
        maxDepth: 3,
        confidenceThreshold: 0.9,
        enableFormalPlanning: false,
        logLevel: 'debug',
        timeout: 60000
      });
      
      expect(config.decomposition.maxDepth).toBe(3);
      expect(config.toolDiscovery.confidenceThreshold).toBe(0.9);
      expect(config.formalPlanning.enabled).toBe(false);
      expect(config.logging.level).toBe('debug');
      expect(config.performance.timeout).toBe(60000);
    });
    
    it('should merge nested configuration objects', () => {
      const config = new PlannerConfiguration({
        decomposition: {
          maxDepth: 7,
          minSubtasks: 3
        },
        logging: {
          level: 'warn'
        }
      });
      
      expect(config.decomposition.maxDepth).toBe(7);
      expect(config.decomposition.minSubtasks).toBe(3);
      expect(config.decomposition.maxSubtasks).toBe(10); // Default preserved
      expect(config.logging.level).toBe('warn');
      expect(config.logging.enableTimestamp).toBe(true); // Default preserved
    });
  });
  
  describe('validation', () => {
    it('should validate maxDepth range', () => {
      expect(() => new PlannerConfiguration({ maxDepth: 0 }))
        .toThrow('maxDepth must be between 1 and 20');
      
      expect(() => new PlannerConfiguration({ maxDepth: 21 }))
        .toThrow('maxDepth must be between 1 and 20');
      
      // Valid values should not throw
      expect(() => new PlannerConfiguration({ maxDepth: 1 })).not.toThrow();
      expect(() => new PlannerConfiguration({ maxDepth: 20 })).not.toThrow();
    });
    
    it('should validate minSubtasks', () => {
      expect(() => new PlannerConfiguration({ minSubtasks: 0 }))
        .toThrow('minSubtasks must be at least 1');
      
      expect(() => new PlannerConfiguration({ minSubtasks: -1 }))
        .toThrow('minSubtasks must be at least 1');
    });
    
    it('should validate maxSubtasks >= minSubtasks', () => {
      expect(() => new PlannerConfiguration({ 
        minSubtasks: 5,
        maxSubtasks: 3
      })).toThrow('maxSubtasks must be >= minSubtasks');
    });
    
    it('should validate confidenceThreshold range', () => {
      expect(() => new PlannerConfiguration({ confidenceThreshold: -0.1 }))
        .toThrow('confidenceThreshold must be between 0 and 1');
      
      expect(() => new PlannerConfiguration({ confidenceThreshold: 1.1 }))
        .toThrow('confidenceThreshold must be between 0 and 1');
      
      // Valid values
      expect(() => new PlannerConfiguration({ confidenceThreshold: 0 })).not.toThrow();
      expect(() => new PlannerConfiguration({ confidenceThreshold: 1 })).not.toThrow();
    });
    
    it('should validate maxToolsPerTask', () => {
      expect(() => new PlannerConfiguration({
        toolDiscovery: { maxToolsPerTask: 0 }
      })).toThrow('maxToolsPerTask must be at least 1');
    });
    
    it('should validate log level', () => {
      expect(() => new PlannerConfiguration({ logLevel: 'invalid' }))
        .toThrow('Invalid log level: invalid');
      
      // Valid levels
      ['debug', 'info', 'warn', 'error'].forEach(level => {
        expect(() => new PlannerConfiguration({ logLevel: level })).not.toThrow();
      });
    });
    
    it('should validate timeout', () => {
      expect(() => new PlannerConfiguration({ timeout: 999 }))
        .toThrow('timeout must be at least 1000ms');
      
      expect(() => new PlannerConfiguration({ timeout: 1000 })).not.toThrow();
    });
  });
  
  describe('serialization', () => {
    it('should convert to JSON', () => {
      const config = new PlannerConfiguration({
        maxDepth: 4,
        confidenceThreshold: 0.8
      });
      
      const json = config.toJSON();
      
      expect(json.decomposition.maxDepth).toBe(4);
      expect(json.toolDiscovery.confidenceThreshold).toBe(0.8);
      expect(json.logging).toBeDefined();
      expect(json.performance).toBeDefined();
    });
    
    it('should restore from JSON', () => {
      const json = {
        decomposition: { maxDepth: 6 },
        toolDiscovery: { confidenceThreshold: 0.85 },
        logging: { level: 'error' }
      };
      
      const config = PlannerConfiguration.fromJSON(json);
      
      expect(config.decomposition.maxDepth).toBe(6);
      expect(config.toolDiscovery.confidenceThreshold).toBe(0.85);
      expect(config.logging.level).toBe('error');
    });
  });
  
  describe('factory methods', () => {
    it('should create default configuration', () => {
      const config = PlannerConfiguration.defaults();
      
      expect(config).toBeInstanceOf(PlannerConfiguration);
      expect(config.decomposition.maxDepth).toBe(5);
    });
  });
  
  describe('edge cases', () => {
    it('should handle undefined options gracefully', () => {
      const config = new PlannerConfiguration(undefined);
      expect(config.decomposition.maxDepth).toBe(5);
    });
    
    it('should handle null options gracefully', () => {
      const config = new PlannerConfiguration(null);
      expect(config.decomposition.maxDepth).toBe(5);
    });
    
    it('should handle empty options object', () => {
      const config = new PlannerConfiguration({});
      expect(config.decomposition.maxDepth).toBe(5);
    });
  });
});