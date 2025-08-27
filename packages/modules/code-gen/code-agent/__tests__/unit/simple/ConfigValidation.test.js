/**
 * Configuration Validation Tests - Simple validation logic
 */

import { describe, test, expect } from '@jest/globals';

// Simple config validation functions
function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }
  
  const errors = [];
  
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Name must be a string');
  }
  
  if (config.version && !/^\d+\.\d+\.\d+$/.test(config.version)) {
    errors.push('Version must follow semver format');
  }
  
  if (config.timeout && (typeof config.timeout !== 'number' || config.timeout < 0)) {
    errors.push('Timeout must be a positive number');
  }
  
  return { valid: errors.length === 0, errors };
}

function mergeConfigs(base, override) {
  return { ...base, ...override };
}

function getDefaultConfig() {
  return {
    name: 'code-agent',
    version: '1.0.0',
    timeout: 30000,
    debug: false
  };
}

describe('Configuration Validation', () => {
  test('should validate valid config', () => {
    const config = {
      name: 'test-agent',
      version: '1.2.3',
      timeout: 5000
    };
    
    const result = validateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should reject invalid config', () => {
    const config = {
      name: 123,
      version: 'invalid',
      timeout: -1
    };
    
    const result = validateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should reject null/undefined config', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig(undefined).valid).toBe(false);
    expect(validateConfig('string').valid).toBe(false);
  });

  test('should merge configs correctly', () => {
    const base = { name: 'base', timeout: 1000, debug: false };
    const override = { timeout: 2000, extra: 'value' };
    
    const merged = mergeConfigs(base, override);
    
    expect(merged.name).toBe('base');
    expect(merged.timeout).toBe(2000);
    expect(merged.debug).toBe(false);
    expect(merged.extra).toBe('value');
  });

  test('should provide default config', () => {
    const defaults = getDefaultConfig();
    
    expect(defaults.name).toBe('code-agent');
    expect(defaults.version).toBe('1.0.0');
    expect(defaults.timeout).toBe(30000);
    expect(defaults.debug).toBe(false);
  });

  test('should validate version format', () => {
    const validVersions = ['1.0.0', '10.20.30', '0.0.1'];
    const invalidVersions = ['1.0', '1.0.0.0', 'v1.0.0', '1.0.0-beta'];
    
    validVersions.forEach(version => {
      const result = validateConfig({ name: 'test', version });
      expect(result.valid).toBe(true);
    });
    
    invalidVersions.forEach(version => {
      const result = validateConfig({ name: 'test', version });
      expect(result.valid).toBe(false);
    });
  });
});