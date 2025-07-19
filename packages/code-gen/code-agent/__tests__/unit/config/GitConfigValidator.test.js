/**
 * Test Git Configuration Schema and Validation
 * Phase 1.1.2: Git configuration validation and defaults
 */

import { describe, test, expect } from '@jest/globals';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';

describe('Git Configuration Schema Validation', () => {
  test('should validate complete git config object structure', () => {
    const validConfig = {
      enabled: true,
      repositoryStrategy: 'new',
      branchStrategy: 'feature',
      commitStrategy: 'phase',
      pushStrategy: 'validation',
      organization: 'AgentResults',
      repositoryUrl: 'https://github.com/AgentResults/test-repo.git',
      commitMessage: {
        prefix: '[CodeAgent]',
        includePhase: true,
        includeTimestamp: false,
        includeSummary: true
      }
    };
    
    const result = GitConfigValidator.validateConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('should validate config with required fields only', () => {
    const minimalConfig = {
      enabled: true
    };
    
    const result = GitConfigValidator.validateConfig(minimalConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  
  test('should detect invalid repositoryStrategy', () => {
    const invalidConfig = {
      enabled: true,
      repositoryStrategy: 'invalid'
    };
    
    const result = GitConfigValidator.validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('repositoryStrategy must be one of: new, existing, auto');
  });
  
  test('should detect invalid branchStrategy', () => {
    const invalidConfig = {
      enabled: true,
      branchStrategy: 'invalid'
    };
    
    const result = GitConfigValidator.validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('branchStrategy must be one of: main, feature, timestamp');
  });
  
  test('should detect invalid commitStrategy', () => {
    const invalidConfig = {
      enabled: true,
      commitStrategy: 'invalid'
    };
    
    const result = GitConfigValidator.validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('commitStrategy must be one of: manual, phase, auto');
  });
  
  test('should detect invalid pushStrategy', () => {
    const invalidConfig = {
      enabled: true,
      pushStrategy: 'invalid'
    };
    
    const result = GitConfigValidator.validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('pushStrategy must be one of: never, validation, always');
  });
  
  test('should detect invalid types', () => {
    const invalidConfig = {
      enabled: 'true', // should be boolean
      repositoryUrl: 123, // should be string
      organization: true // should be string
    };
    
    const result = GitConfigValidator.validateConfig(invalidConfig);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('enabled must be a boolean');
    expect(result.errors).toContain('repositoryUrl must be a string');
    expect(result.errors).toContain('organization must be a string');
  });
  
  test('should provide sensible defaults', () => {
    const defaults = GitConfigValidator.getDefaultConfig();
    
    expect(defaults.enabled).toBe(false);
    expect(defaults.repositoryStrategy).toBe('auto');
    expect(defaults.branchStrategy).toBe('feature');
    expect(defaults.commitStrategy).toBe('phase');
    expect(defaults.pushStrategy).toBe('validation');
    expect(defaults.organization).toBe('AgentResults');
    expect(defaults.repositoryUrl).toBe(null);
    expect(defaults.commitMessage).toBeDefined();
    expect(defaults.commitMessage.prefix).toBe('[CodeAgent]');
    expect(defaults.commitMessage.includePhase).toBe(true);
  });
  
  test('should merge config with defaults correctly', () => {
    const userConfig = {
      enabled: true,
      branchStrategy: 'main',
      commitMessage: {
        prefix: '[MyAgent]'
      }
    };
    
    const merged = GitConfigValidator.mergeWithDefaults(userConfig);
    
    expect(merged.enabled).toBe(true); // user value
    expect(merged.branchStrategy).toBe('main'); // user value
    expect(merged.repositoryStrategy).toBe('auto'); // default value
    expect(merged.commitMessage.prefix).toBe('[MyAgent]'); // user value
    expect(merged.commitMessage.includePhase).toBe(true); // default value
  });
  
  test('should handle empty config object', () => {
    const emptyConfig = {};
    const merged = GitConfigValidator.mergeWithDefaults(emptyConfig);
    
    expect(merged).toEqual(GitConfigValidator.getDefaultConfig());
  });
  
  test('should validate merged config', () => {
    const userConfig = {
      enabled: true,
      repositoryStrategy: 'new',
      organization: 'AgentResults'
    };
    
    const merged = GitConfigValidator.mergeWithDefaults(userConfig);
    const validation = GitConfigValidator.validateConfig(merged);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});