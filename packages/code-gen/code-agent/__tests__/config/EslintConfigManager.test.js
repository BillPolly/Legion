/**
 * Tests for EslintConfigManager - Dynamic ESLint configuration management
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { EslintConfigManager } from '../../src/config/EslintConfigManager.js';

describe('EslintConfigManager', () => {
  let manager;

  beforeEach(() => {
    manager = new EslintConfigManager();
  });

  describe('Constructor', () => {
    test('should create EslintConfigManager with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.baseRules).toBeDefined();
      expect(manager.projectTypeRules).toBeDefined();
      expect(manager.currentConfig).toBeNull();
      expect(manager.initialized).toBe(false);
    });

    test('should create with custom base rules', () => {
      const customRules = {
        'no-console': 'error',
        'semi': ['error', 'always']
      };

      const customManager = new EslintConfigManager({ baseRules: customRules });
      
      expect(customManager.baseRules).toEqual(customRules);
    });
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      await manager.initialize();
      
      expect(manager.initialized).toBe(true);
      expect(manager.currentConfig).toBeDefined();
      expect(manager.currentConfig.rules).toBeDefined();
    });

    test('should initialize with custom project type', async () => {
      await manager.initialize({ projectType: 'frontend' });
      
      expect(manager.initialized).toBe(true);
      expect(manager.currentConfig.projectType).toBe('frontend');
    });

    test('should handle reinitialization', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);

      // Should not throw on reinitialization
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Rule Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should get base ESLint rules', () => {
      const baseRules = manager.getBaseRules();
      
      expect(baseRules).toBeDefined();
      expect(baseRules).toHaveProperty('no-unused-vars');
      expect(baseRules).toHaveProperty('no-console');
      expect(baseRules).toHaveProperty('semi');
      expect(baseRules).toHaveProperty('quotes');
    });

    test('should get project-specific rules', () => {
      const frontendRules = manager.getProjectTypeRules('frontend');
      const backendRules = manager.getProjectTypeRules('backend');
      const fullstackRules = manager.getProjectTypeRules('fullstack');
      
      expect(frontendRules).toBeDefined();
      expect(backendRules).toBeDefined();
      expect(fullstackRules).toBeDefined();
      
      // Frontend should have browser-specific rules
      expect(frontendRules).toHaveProperty('no-undef');
      
      // Backend should have Node.js-specific rules
      expect(backendRules).toHaveProperty('no-process-exit');
    });

    test('should merge base and project rules correctly', () => {
      const mergedConfig = manager.buildConfiguration('frontend');
      
      expect(mergedConfig.rules).toBeDefined();
      expect(mergedConfig.env).toBeDefined();
      expect(mergedConfig.parserOptions).toBeDefined();
      
      // Should include base rules
      expect(mergedConfig.rules).toHaveProperty('no-unused-vars');
      
      // Should include frontend-specific rules
      expect(mergedConfig.rules).toHaveProperty('no-undef');
      
      // Should have browser environment
      expect(mergedConfig.env.browser).toBe(true);
    });

    test('should add custom rules', () => {
      const customRules = {
        'custom-rule-1': 'error',
        'custom-rule-2': ['warn', { option: true }]
      };

      manager.addCustomRules(customRules);
      const config = manager.getCurrentConfiguration();
      
      expect(config.rules).toHaveProperty('custom-rule-1', 'error');
      expect(config.rules).toHaveProperty('custom-rule-2');
    });

    test('should override existing rules', () => {
      // Override a base rule
      manager.addCustomRules({ 'no-console': 'off' });
      const config = manager.getCurrentConfiguration();
      
      expect(config.rules['no-console']).toBe('off');
    });

    test('should remove rules', () => {
      manager.removeRules(['no-console', 'semi']);
      const config = manager.getCurrentConfiguration();
      
      expect(config.rules).not.toHaveProperty('no-console');
      expect(config.rules).not.toHaveProperty('semi');
    });
  });

  describe('Configuration Building', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should build frontend configuration', () => {
      const config = manager.buildConfiguration('frontend');
      
      expect(config.env.browser).toBe(true);
      expect(config.env.es6).toBe(true);
      expect(config.parserOptions.ecmaVersion).toBeGreaterThanOrEqual(2020);
      expect(config.parserOptions.sourceType).toBe('module');
      expect(config.rules).toHaveProperty('no-undef');
    });

    test('should build backend configuration', () => {
      const config = manager.buildConfiguration('backend');
      
      expect(config.env.node).toBe(true);
      expect(config.env.es6).toBe(true);
      expect(config.rules).toHaveProperty('no-process-exit');
      expect(config.rules).toHaveProperty('handle-callback-err');
    });

    test('should build fullstack configuration', () => {
      const config = manager.buildConfiguration('fullstack');
      
      expect(config.env.browser).toBe(true);
      expect(config.env.node).toBe(true);
      expect(config.env.es6).toBe(true);
      
      // Should include both frontend and backend rules
      expect(config.rules).toHaveProperty('no-undef');
      expect(config.rules).toHaveProperty('no-process-exit');
    });

    test('should include proper parser options', () => {
      const config = manager.buildConfiguration('frontend');
      
      expect(config.parserOptions).toBeDefined();
      expect(config.parserOptions.ecmaVersion).toBeDefined();
      expect(config.parserOptions.sourceType).toBe('module');
      expect(config.parserOptions.ecmaFeatures).toBeDefined();
    });

    test('should include extends configuration', () => {
      const config = manager.buildConfiguration('frontend');
      
      expect(config.extends).toBeDefined();
      expect(Array.isArray(config.extends)).toBe(true);
      expect(config.extends).toContain('eslint:recommended');
    });
  });

  describe('Rule Severity Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should set rule severity levels', () => {
      const rules = {
        'no-console': 'warn',
        'no-unused-vars': 'error',
        'semi': 'off'
      };

      manager.setRuleSeverity(rules);
      const config = manager.getCurrentConfiguration();
      
      expect(config.rules['no-console']).toBe('warn');
      expect(config.rules['no-unused-vars']).toBe('error');
      expect(config.rules['semi']).toBe('off');
    });

    test('should convert severity strings to numbers', () => {
      const converted = manager.convertSeverityToNumber('error');
      expect(converted).toBe(2);
      
      expect(manager.convertSeverityToNumber('warn')).toBe(1);
      expect(manager.convertSeverityToNumber('off')).toBe(0);
    });

    test('should convert severity numbers to strings', () => {
      expect(manager.convertSeverityToString(2)).toBe('error');
      expect(manager.convertSeverityToString(1)).toBe('warn');
      expect(manager.convertSeverityToString(0)).toBe('off');
    });

    test('should get rules by severity level', () => {
      const errorRules = manager.getRulesBySeverity('error');
      const warnRules = manager.getRulesBySeverity('warn');
      
      expect(Array.isArray(errorRules)).toBe(true);
      expect(Array.isArray(warnRules)).toBe(true);
      expect(errorRules.length).toBeGreaterThan(0);
    });
  });

  describe('Validation and Analysis', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should validate configuration structure', () => {
      const validConfig = manager.buildConfiguration('frontend');
      const isValid = manager.validateConfiguration(validConfig);
      
      expect(isValid).toBe(true);
    });

    test('should detect invalid configuration', () => {
      const invalidConfig = {
        rules: null,
        env: 'invalid'
      };
      
      const isValid = manager.validateConfiguration(invalidConfig);
      expect(isValid).toBe(false);
    });

    test('should get configuration validation errors', () => {
      const invalidConfig = {
        rules: null,
        env: 'invalid'
      };
      
      const errors = manager.getValidationErrors(invalidConfig);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should analyze rule conflicts', () => {
      const conflicts = manager.analyzeRuleConflicts();
      
      expect(Array.isArray(conflicts)).toBe(true);
      // Should not have conflicts in well-designed configuration
      expect(conflicts.length).toBe(0);
    });

    test('should get rule documentation', () => {
      const docs = manager.getRuleDocumentation('no-unused-vars');
      
      expect(docs).toBeDefined();
      expect(docs).toHaveProperty('description');
      expect(docs).toHaveProperty('category');
      expect(docs).toHaveProperty('recommended');
    });
  });

  describe('Dynamic Configuration Updates', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should update configuration at runtime', () => {
      const originalConfig = manager.getCurrentConfiguration();
      const originalRuleCount = Object.keys(originalConfig.rules).length;

      manager.updateConfiguration({
        rules: {
          'new-rule': 'error'
        }
      });

      const updatedConfig = manager.getCurrentConfiguration();
      expect(Object.keys(updatedConfig.rules).length).toBe(originalRuleCount + 1);
      expect(updatedConfig.rules['new-rule']).toBe('error');
    });

    test('should switch project types dynamically', () => {
      manager.setProjectType('frontend');
      let config = manager.getCurrentConfiguration();
      expect(config.env.browser).toBe(true);

      manager.setProjectType('backend');
      config = manager.getCurrentConfiguration();
      expect(config.env.node).toBe(true);
      expect(config.env.browser).toBeFalsy();
    });

    test('should enable/disable rule categories', () => {
      manager.enableRuleCategory('stylistic');
      let config = manager.getCurrentConfiguration();
      
      // Should include stylistic rules
      expect(config.rules).toHaveProperty('indent');
      expect(config.rules).toHaveProperty('quotes');

      manager.disableRuleCategory('stylistic');
      config = manager.getCurrentConfiguration();
      
      // Stylistic rules should be disabled
      expect(config.rules['indent']).toBe('off');
      expect(config.rules['quotes']).toBe('off');
    });
  });

  describe('Export and Import', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should export configuration as JSON', () => {
      const exported = manager.exportConfiguration();
      
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('rules');
      expect(parsed).toHaveProperty('env');
    });

    test('should export configuration as ESLint config file', () => {
      const configFile = manager.exportAsConfigFile();
      
      expect(typeof configFile).toBe('string');
      expect(configFile).toContain('module.exports');
      expect(configFile).toContain('"rules":');
    });

    test('should import configuration from JSON', () => {
      const originalConfig = manager.getCurrentConfiguration();
      const exported = manager.exportConfiguration();

      // Create new manager and import
      const newManager = new EslintConfigManager();
      newManager.importConfiguration(exported);

      const importedConfig = newManager.getCurrentConfiguration();
      expect(importedConfig.rules).toEqual(originalConfig.rules);
    });

    test('should handle import errors gracefully', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => {
        manager.importConfiguration(invalidJson);
      }).toThrow();
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should cache configuration builds', () => {
      // Clear cache first to ensure fair timing
      manager._invalidateCache();
      
      const start1 = performance.now();
      const config1 = manager.buildConfiguration('frontend');
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      const config2 = manager.buildConfiguration('frontend');
      const time2 = performance.now() - start2;

      expect(config1).toEqual(config2);
      // Second call should be faster or at least not significantly slower
      expect(time2).toBeLessThanOrEqual(time1 + 0.1); // Allow small tolerance
    });

    test('should invalidate cache on configuration changes', () => {
      const config1 = manager.buildConfiguration('frontend');
      
      manager.addCustomRules({ 'new-rule': 'error' });
      
      const config2 = manager.buildConfiguration('frontend');
      expect(config1).not.toEqual(config2);
    });

    test('should optimize rule merging', () => {
      const start = Date.now();
      
      // Build multiple configurations
      for (let i = 0; i < 100; i++) {
        manager.buildConfiguration('frontend');
        manager.buildConfiguration('backend');
        manager.buildConfiguration('fullstack');
      }
      
      const time = Date.now() - start;
      expect(time).toBeLessThan(1000); // Should complete in reasonable time
    });
  });
});