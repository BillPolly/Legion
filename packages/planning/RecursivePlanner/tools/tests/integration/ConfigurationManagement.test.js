/**
 * Integration tests for Configuration Management
 * Tests configuration loading, validation, and environment integration
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigurationManager } from '../../src/integration/ConfigurationManager.js';
import { ToolRegistry, ModuleProvider } from '../../src/integration/ToolRegistry.js';
import { FileSystemModuleDefinition } from '../../src/modules/FileSystemModule.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Configuration Management Integration', () => {
  let configManager;
  let testDir;
  let configFile;
  let originalEnv;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-test-'));
    configFile = path.join(testDir, 'tools-config.json');
    
    configManager = new ConfigurationManager();
  });

  afterEach(async () => {
    // Stop any watchers to prevent errors during cleanup
    configManager.stopWatching();
    
    // Restore original environment
    process.env = originalEnv;
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Configuration Loading', () => {
    test('should load configuration from JSON file', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/tmp/test',
            allowWrite: true,
            maxFileSize: 1024000
          },
          http: {
            baseURL: 'https://api.test.com',
            timeout: 5000
          }
        },
        registry: {
          lazy: true,
          cacheMetadata: true
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.modules.filesystem.basePath).toBe('/tmp/test');
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(true);
      expect(loadedConfig.modules.http.baseURL).toBe('https://api.test.com');
      expect(loadedConfig.registry.lazy).toBe(true);
    });

    test('should load configuration from YAML file', async () => {
      const yamlContent = `
modules:
  filesystem:
    basePath: /tmp/yaml-test
    allowWrite: false
    maxFileSize: 512000
  http:
    baseURL: https://yaml.api.com
    timeout: 3000
registry:
  lazy: false
  cacheMetadata: true
      `.trim();

      const yamlFile = path.join(testDir, 'config.yaml');
      await fs.writeFile(yamlFile, yamlContent);
      
      const loadedConfig = await configManager.loadFromFile(yamlFile);
      
      expect(loadedConfig.modules.filesystem.basePath).toBe('/tmp/yaml-test');
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(false);
      expect(loadedConfig.modules.http.baseURL).toBe('https://yaml.api.com');
      expect(loadedConfig.registry.lazy).toBe(false);
    });

    test('should handle missing configuration file gracefully', async () => {
      const nonexistentFile = path.join(testDir, 'missing.json');
      
      await expect(configManager.loadFromFile(nonexistentFile))
        .rejects.toThrow('Configuration file not found');
    });

    test('should validate configuration structure', async () => {
      const invalidConfig = {
        modules: {
          filesystem: {
            // Missing required basePath
            allowWrite: true
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(invalidConfig, null, 2));
      
      await expect(configManager.loadFromFile(configFile))
        .rejects.toThrow('Configuration validation failed');
    });
  });

  describe('Environment Variable Integration', () => {
    test('should override config values with environment variables', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/default/path',
            allowWrite: false
          },
          http: {
            baseURL: 'https://default.api.com',
            timeout: 5000
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      // Set environment variables
      process.env.TOOLS_FILESYSTEM_BASE_PATH = '/env/override/path';
      process.env.TOOLS_FILESYSTEM_ALLOW_WRITE = 'true';
      process.env.TOOLS_HTTP_BASE_URL = 'https://env.api.com';
      process.env.TOOLS_HTTP_TIMEOUT = '8000';
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      expect(loadedConfig.modules.filesystem.basePath).toBe('/env/override/path');
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(true);
      expect(loadedConfig.modules.http.baseURL).toBe('https://env.api.com');
      expect(loadedConfig.modules.http.timeout).toBe(8000);
    });

    test('should handle different data types in environment variables', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/default/path' // Required field
          },
          test: {
            stringValue: 'default',
            numberValue: 100,
            booleanValue: false,
            arrayValue: ['a', 'b']
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      // Set environment variables with different types
      process.env.TOOLS_TEST_STRING_VALUE = 'env_string';
      process.env.TOOLS_TEST_NUMBER_VALUE = '999';
      process.env.TOOLS_TEST_BOOLEAN_VALUE = 'true';
      process.env.TOOLS_TEST_ARRAY_VALUE = '["x", "y", "z"]';
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      expect(loadedConfig.modules.test.stringValue).toBe('env_string');
      expect(loadedConfig.modules.test.numberValue).toBe(999);
      expect(loadedConfig.modules.test.booleanValue).toBe(true);
      expect(loadedConfig.modules.test.arrayValue).toEqual(['x', 'y', 'z']);
    });

    test('should support custom environment variable prefix', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/default'
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      process.env.MYAPP_FILESYSTEM_BASE_PATH = '/custom/prefix/path';
      
      const customManager = new ConfigurationManager({ envPrefix: 'MYAPP' });
      const loadedConfig = await customManager.loadFromFile(configFile);
      
      expect(loadedConfig.modules.filesystem.basePath).toBe('/custom/prefix/path');
    });
  });

  describe('Default Value Management', () => {
    test('should apply default values for missing config sections', async () => {
      const minimalConfig = {
        modules: {
          filesystem: {
            basePath: '/test/only'
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(minimalConfig, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      // Should have default values applied
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(false); // default
      expect(loadedConfig.modules.filesystem.maxFileSize).toBe(10 * 1024 * 1024); // default 10MB
      expect(loadedConfig.registry).toBeDefined();
      expect(loadedConfig.registry.lazy).toBe(true); // default
      expect(loadedConfig.registry.cacheMetadata).toBe(true); // default
    });

    test('should allow custom default values', async () => {
      const customDefaults = {
        modules: {
          filesystem: {
            basePath: '/custom/default',
            allowWrite: true,
            maxFileSize: 5 * 1024 * 1024
          }
        },
        registry: {
          lazy: false,
          cacheMetadata: false
        }
      };

      const customManager = new ConfigurationManager({ defaults: customDefaults });
      
      const emptyConfig = { modules: {} };
      await fs.writeFile(configFile, JSON.stringify(emptyConfig, null, 2));
      
      const loadedConfig = await customManager.loadFromFile(configFile);
      
      expect(loadedConfig.modules.filesystem.basePath).toBe('/custom/default');
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(true);
      expect(loadedConfig.modules.filesystem.maxFileSize).toBe(5 * 1024 * 1024);
      expect(loadedConfig.registry.lazy).toBe(false);
    });

    test('should support deep merge of nested defaults', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: '/override/path'
            // Missing other filesystem settings
          },
          http: {
            baseURL: 'https://override.com'
            // Missing timeout and other settings
          }
        }
        // Missing registry section entirely
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      // Should preserve overrides and add defaults
      expect(loadedConfig.modules.filesystem.basePath).toBe('/override/path'); // overridden
      expect(loadedConfig.modules.filesystem.allowWrite).toBe(false); // default
      expect(loadedConfig.modules.http.baseURL).toBe('https://override.com'); // overridden
      expect(loadedConfig.modules.http.timeout).toBe(5000); // default
      expect(loadedConfig.registry.lazy).toBe(true); // default
    });
  });

  describe('Configuration Validation', () => {
    test('should validate required fields', async () => {
      const configWithMissingRequired = {
        modules: {
          filesystem: {
            // Missing required basePath
            allowWrite: true
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(configWithMissingRequired, null, 2));
      
      await expect(configManager.loadFromFile(configFile))
        .rejects.toThrow('Required field missing: modules.filesystem.basePath');
    });

    test('should validate field types', async () => {
      const configWithWrongTypes = {
        modules: {
          filesystem: {
            basePath: '/valid/path',
            allowWrite: 'not_boolean', // should be boolean
            maxFileSize: 'not_number' // should be number
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(configWithWrongTypes, null, 2));
      
      await expect(configManager.loadFromFile(configFile))
        .rejects.toThrow('Invalid type for field: modules.filesystem.allowWrite');
    });

    test('should validate field constraints', async () => {
      const configWithInvalidValues = {
        modules: {
          filesystem: {
            basePath: '/valid/path',
            allowWrite: true,
            maxFileSize: -1000 // negative file size invalid
          },
          http: {
            baseURL: 'invalid-url', // invalid URL format
            timeout: -500 // negative timeout invalid
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(configWithInvalidValues, null, 2));
      
      await expect(configManager.loadFromFile(configFile))
        .rejects.toThrow('Invalid value for field');
    });

    test('should support custom validation rules', async () => {
      const customValidationRules = {
        'modules.filesystem.basePath': (value) => {
          if (!value.startsWith('/secure/')) {
            throw new Error('basePath must start with /secure/');
          }
        },
        'modules.http.timeout': (value) => {
          if (value < 1000 || value > 30000) {
            throw new Error('timeout must be between 1000 and 30000');
          }
        }
      };

      const customManager = new ConfigurationManager({ 
        validationRules: customValidationRules 
      });

      const config = {
        modules: {
          filesystem: {
            basePath: '/invalid/path', // fails custom validation
            allowWrite: true
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      await expect(customManager.loadFromFile(configFile))
        .rejects.toThrow('basePath must start with /secure/');
    });
  });

  describe('Integration with Tool Registry', () => {
    test('should create registry from configuration', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true,
            maxFileSize: 1024000
          }
        },
        registry: {
          lazy: true,
          cacheMetadata: true
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      const registry = await configManager.createRegistry(loadedConfig);
      
      expect(registry).toBeInstanceOf(ToolRegistry);
      expect(registry.hasProvider('filesystem')).toBe(true);
      
      // Test that the filesystem module was configured correctly
      const fsInstance = await registry.getInstance('filesystem');
      expect(fsInstance.config.basePath).toBe(testDir);
      expect(fsInstance.config.allowWrite).toBe(true);
    });

    test('should support multiple module configurations', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true
          },
          http: {
            baseURL: 'https://test.api.com',
            timeout: 3000
          }
        },
        registry: {
          lazy: false
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      const registry = await configManager.createRegistry(loadedConfig);
      
      expect(registry.hasProvider('filesystem')).toBe(true);
      expect(registry.hasProvider('http')).toBe(true);
      expect(registry.hasInstance('filesystem')).toBe(true); // not lazy
      expect(registry.hasInstance('http')).toBe(true); // not lazy
    });

    test('should handle module creation failures gracefully', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir // Required field  
          },
          nonexistent: {
            someConfig: 'value'
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      
      await expect(configManager.createRegistry(loadedConfig))
        .rejects.toThrow('Unknown module type: nonexistent');
    });
  });

  describe('Configuration Hot Reload', () => {
    test('should support configuration hot reload', async () => {
      const initialConfig = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: false
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(initialConfig, null, 2));
      
      const loadedConfig = await configManager.loadFromFile(configFile);
      let reloadCount = 0;
      
      configManager.onConfigChange((newConfig) => {
        reloadCount++;
        expect(newConfig.modules.filesystem.allowWrite).toBe(true);
      });

      configManager.watchConfiguration(configFile);
      
      // Wait a moment for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update configuration
      const updatedConfig = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: true // changed
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(updatedConfig, null, 2));
      
      // Wait for file watcher to trigger with longer timeout
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(reloadCount).toBe(1);
      
      configManager.stopWatching();
    });

    test('should debounce rapid configuration changes', async () => {
      const config = {
        modules: {
          filesystem: {
            basePath: testDir,
            allowWrite: false
          }
        }
      };

      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      let reloadCount = 0;
      configManager.onConfigChange(() => {
        reloadCount++;
      });

      configManager.watchConfiguration(configFile, { debounceMs: 100 });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Make multiple rapid changes
      for (let i = 0; i < 5; i++) {
        const updatedConfig = { ...config };
        updatedConfig.modules.filesystem.allowWrite = i % 2 === 0;
        await fs.writeFile(configFile, JSON.stringify(updatedConfig, null, 2));
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should only reload once due to debouncing
      expect(reloadCount).toBe(1);
      
      configManager.stopWatching();
    });
  });
});