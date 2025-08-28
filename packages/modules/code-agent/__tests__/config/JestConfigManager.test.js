/**
 * Tests for JestConfigManager - Dynamic Jest configuration management
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JestConfigManager } from '../../src/config/JestConfigManager.js';

describe('JestConfigManager', () => {
  let manager;

  beforeEach(() => {
    manager = new JestConfigManager();
  });

  describe('Constructor', () => {
    test('should create JestConfigManager with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.baseConfig).toBeDefined();
      expect(manager.projectTypeConfigs).toBeDefined();
      expect(manager.currentConfig).toBeNull();
      expect(manager.initialized).toBe(false);
    });

    test('should create with custom base configuration', () => {
      const customConfig = {
        testEnvironment: 'jsdom',
        verbose: true
      };

      const customManager = new JestConfigManager({ baseConfig: customConfig });
      
      expect(customManager.baseConfig.testEnvironment).toBe('jsdom');
      expect(customManager.baseConfig.verbose).toBe(true);
    });
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      await manager.initialize();
      
      expect(manager.initialized).toBe(true);
      expect(manager.currentConfig).toBeDefined();
      expect(manager.currentConfig.testEnvironment).toBe('node');
    });

    test('should initialize with custom project type', async () => {
      await manager.initialize({ projectType: 'frontend' });
      
      expect(manager.initialized).toBe(true);
      expect(manager.currentConfig.projectType).toBe('frontend');
    });

    test('should handle reinitialization gracefully', async () => {
      await manager.initialize();
      expect(manager.initialized).toBe(true);

      // Should not throw on reinitialization
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('Configuration Building', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should build frontend configuration', () => {
      const config = manager.buildConfiguration('frontend');
      
      expect(config.testEnvironment).toBe('jsdom');
      expect(config.setupFilesAfterEnv).toContain('@testing-library/jest-dom');
      expect(config.moduleNameMapper).toBeDefined();
      expect(config.transform).toBeDefined();
    });

    test('should build backend configuration', () => {
      const config = manager.buildConfiguration('backend');
      
      expect(config.testEnvironment).toBe('node');
      expect(config.collectCoverageFrom).toContain('src/**/*.js');
      expect(config.testMatch).toContain('**/__tests__/**/*.test.js');
    });

    test('should build fullstack configuration', () => {
      const config = manager.buildConfiguration('fullstack');
      
      expect(config.projects).toBeDefined();
      expect(config.projects.length).toBe(2); // frontend and backend
      expect(config.collectCoverageFrom).toBeDefined();
    });

    test('should include proper test patterns', () => {
      const config = manager.buildConfiguration('backend');
      
      expect(config.testMatch).toContain('**/__tests__/**/*.test.js');
      expect(config.testMatch).toContain('**/?(*.)+(spec|test).js');
    });

    test('should configure coverage settings', () => {
      const config = manager.buildConfiguration('backend');
      
      expect(config.collectCoverageFrom).toBeDefined();
      expect(config.coverageDirectory).toBe('coverage');
      expect(config.coverageReporters).toContain('text');
      expect(config.coverageReporters).toContain('lcov');
      expect(config.coverageThreshold).toBeDefined();
    });
  });

  describe('Test Environment Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should set test environment', () => {
      manager.setTestEnvironment('jsdom');
      const config = manager.getCurrentConfiguration();
      
      expect(config.testEnvironment).toBe('jsdom');
    });

    test('should configure setup files', () => {
      const setupFiles = ['./setup/global.js', './setup/mocks.js'];
      manager.addSetupFiles(setupFiles);
      const config = manager.getCurrentConfiguration();
      
      expect(config.setupFiles).toContain('./setup/global.js');
      expect(config.setupFiles).toContain('./setup/mocks.js');
    });

    test('should configure setup files after env', () => {
      const setupFilesAfterEnv = ['@testing-library/jest-dom', './setup/custom.js'];
      manager.addSetupFilesAfterEnv(setupFilesAfterEnv);
      const config = manager.getCurrentConfiguration();
      
      expect(config.setupFilesAfterEnv).toContain('@testing-library/jest-dom');
      expect(config.setupFilesAfterEnv).toContain('./setup/custom.js');
    });

    test('should handle custom test environments', () => {
      const customEnv = './custom-environment.js';
      manager.setTestEnvironment(customEnv);
      const config = manager.getCurrentConfiguration();
      
      expect(config.testEnvironment).toBe(customEnv);
    });
  });

  describe('Module and Transform Configuration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should configure module name mapping', () => {
      const moduleNameMapper = {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^~/(.*)$': '<rootDir>/$1'
      };

      manager.addModuleNameMapper(moduleNameMapper);
      const config = manager.getCurrentConfiguration();
      
      expect(config.moduleNameMapper['^@/(.*)$']).toBe('<rootDir>/src/$1');
      expect(config.moduleNameMapper['^~/(.*)$']).toBe('<rootDir>/$1');
    });

    test('should configure transforms', () => {
      const transforms = {
        '\\.tsx?$': 'ts-jest',
        '\\.jsx?$': 'babel-jest'
      };

      manager.addTransforms(transforms);
      const config = manager.getCurrentConfiguration();
      
      expect(config.transform['\\.tsx?$']).toBe('ts-jest');
      expect(config.transform['\\.jsx?$']).toBe('babel-jest');
    });

    test('should handle ES modules configuration', () => {
      manager.enableESModules();
      const config = manager.getCurrentConfiguration();
      
      expect(config.preset).toBe(undefined);
      expect(config.transform).toBeDefined();
      expect(config.extensionsToTreatAsEsm).toContain('.js');
    });

    test('should configure module file extensions', () => {
      const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
      manager.setModuleFileExtensions(extensions);
      const config = manager.getCurrentConfiguration();
      
      expect(config.moduleFileExtensions).toEqual(extensions);
    });
  });

  describe('Coverage Configuration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should set coverage threshold', () => {
      const threshold = {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      };

      manager.setCoverageThreshold(threshold);
      const config = manager.getCurrentConfiguration();
      
      expect(config.coverageThreshold).toEqual(threshold);
    });

    test('should configure coverage collection patterns', () => {
      const patterns = ['src/**/*.js', '!src/**/*.test.js'];
      manager.setCoverageCollectionFrom(patterns);
      const config = manager.getCurrentConfiguration();
      
      expect(config.collectCoverageFrom).toEqual(patterns);
    });

    test('should set coverage reporters', () => {
      const reporters = ['text', 'html', 'json'];
      manager.setCoverageReporters(reporters);
      const config = manager.getCurrentConfiguration();
      
      expect(config.coverageReporters).toEqual(reporters);
    });

    test('should configure coverage directory', () => {
      const directory = './test-coverage';
      manager.setCoverageDirectory(directory);
      const config = manager.getCurrentConfiguration();
      
      expect(config.coverageDirectory).toBe(directory);
    });

    test('should add coverage path ignore patterns', () => {
      const patterns = ['node_modules/', 'build/', 'dist/'];
      manager.addCoveragePathIgnorePatterns(patterns);
      const config = manager.getCurrentConfiguration();
      
      expect(config.coveragePathIgnorePatterns).toContain('node_modules/');
      expect(config.coveragePathIgnorePatterns).toContain('build/');
      expect(config.coveragePathIgnorePatterns).toContain('dist/');
    });
  });

  describe('Test Execution Configuration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should set test timeout', () => {
      const timeout = 30000; // 30 seconds
      manager.setTestTimeout(timeout);
      const config = manager.getCurrentConfiguration();
      
      expect(config.testTimeout).toBe(timeout);
    });

    test('should configure test patterns', () => {
      const patterns = ['**/*.spec.js', '**/*.test.ts'];
      manager.setTestMatch(patterns);
      const config = manager.getCurrentConfiguration();
      
      expect(config.testMatch).toEqual(patterns);
    });

    test('should set test ignore patterns', () => {
      const patterns = ['**/node_modules/**', '**/build/**'];
      manager.addTestPathIgnorePatterns(patterns);
      const config = manager.getCurrentConfiguration();
      
      expect(config.testPathIgnorePatterns).toContain('**/node_modules/**');
      expect(config.testPathIgnorePatterns).toContain('**/build/**');
    });

    test('should configure watch mode settings', () => {
      const watchOptions = {
        watchAll: false,
        watchman: true,
        watchPathIgnorePatterns: ['node_modules/']
      };

      manager.setWatchOptions(watchOptions);
      const config = manager.getCurrentConfiguration();
      
      expect(config.watchAll).toBe(false);
      expect(config.watchman).toBe(true);
      expect(config.watchPathIgnorePatterns).toContain('node_modules/');
    });

    test('should enable verbose output', () => {
      manager.setVerbose(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.verbose).toBe(true);
    });
  });

  describe('Mock Configuration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should clear mocks between tests', () => {
      manager.setClearMocks(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.clearMocks).toBe(true);
    });

    test('should restore mocks after tests', () => {
      manager.setRestoreMocks(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.restoreMocks).toBe(true);
    });

    test('should configure automatic mocking', () => {
      manager.setAutomock(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.automock).toBe(true);
    });

    test('should set mock directories', () => {
      const mockPaths = ['<rootDir>/__mocks__', '<rootDir>/src/__mocks__'];
      manager.addMockDirectories(mockPaths);
      const config = manager.getCurrentConfiguration();
      
      expect(config.roots).toContain('<rootDir>/__mocks__');
      expect(config.roots).toContain('<rootDir>/src/__mocks__');
    });
  });

  describe('Multi-Project Configuration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should create multi-project configuration', () => {
      const projects = [
        { displayName: 'Frontend', testEnvironment: 'jsdom' },
        { displayName: 'Backend', testEnvironment: 'node' }
      ];

      manager.configureMultiProject(projects);
      const config = manager.getCurrentConfiguration();
      
      expect(config.projects).toBeDefined();
      expect(config.projects.length).toBe(2);
      expect(config.projects[0].displayName).toBe('Frontend');
      expect(config.projects[1].displayName).toBe('Backend');
    });

    test('should add project to multi-project setup', () => {
      manager.configureMultiProject([]);
      
      const projectConfig = {
        displayName: 'API Tests',
        testEnvironment: 'node',
        testMatch: ['**/api/**/*.test.js']
      };

      manager.addProject(projectConfig);
      const config = manager.getCurrentConfiguration();
      
      expect(config.projects.length).toBe(1);
      expect(config.projects[0].displayName).toBe('API Tests');
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should configure parallel execution', () => {
      manager.setMaxWorkers('50%');
      const config = manager.getCurrentConfiguration();
      
      expect(config.maxWorkers).toBe('50%');
    });

    test('should set cache directory', () => {
      const cacheDirectory = './jest-cache';
      manager.setCacheDirectory(cacheDirectory);
      const config = manager.getCurrentConfiguration();
      
      expect(config.cacheDirectory).toBe(cacheDirectory);
    });

    test('should configure error handling', () => {
      manager.setBail(3); // Stop after 3 failures
      const config = manager.getCurrentConfiguration();
      
      expect(config.bail).toBe(3);
    });

    test('should detect open handles', () => {
      manager.setDetectOpenHandles(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.detectOpenHandles).toBe(true);
    });

    test('should force exit after tests', () => {
      manager.setForceExit(true);
      const config = manager.getCurrentConfiguration();
      
      expect(config.forceExit).toBe(true);
    });
  });

  describe('Validation and Analysis', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should validate configuration structure', () => {
      const validConfig = manager.buildConfiguration('backend');
      const isValid = manager.validateConfiguration(validConfig);
      
      expect(isValid).toBe(true);
    });

    test('should detect invalid configuration', () => {
      const invalidConfig = {
        testEnvironment: null,
        testMatch: 'invalid'
      };
      
      const isValid = manager.validateConfiguration(invalidConfig);
      expect(isValid).toBe(false);
    });

    test('should get validation errors', () => {
      const invalidConfig = {
        testEnvironment: null,
        coverageThreshold: 'invalid'
      };
      
      const errors = manager.getValidationErrors(invalidConfig);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
    });

    test('should analyze configuration performance impact', () => {
      const analysis = manager.analyzePerformanceImpact();
      
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('score');
      expect(analysis).toHaveProperty('recommendations');
      expect(Array.isArray(analysis.recommendations)).toBe(true);
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
      expect(parsed).toHaveProperty('testEnvironment');
      expect(parsed).toHaveProperty('testMatch');
    });

    test('should export as Jest config file', () => {
      const configFile = manager.exportAsConfigFile();
      
      expect(typeof configFile).toBe('string');
      expect(configFile).toContain('module.exports');
      expect(configFile).toContain('testEnvironment');
    });

    test('should import configuration from JSON', () => {
      const originalConfig = manager.getCurrentConfiguration();
      const exported = manager.exportConfiguration();

      const newManager = new JestConfigManager();
      newManager.importConfiguration(exported);

      const importedConfig = newManager.getCurrentConfiguration();
      expect(importedConfig.testEnvironment).toBe(originalConfig.testEnvironment);
    });

    test('should handle import errors gracefully', () => {
      const invalidJson = '{ invalid json }';
      
      expect(() => {
        manager.importConfiguration(invalidJson);
      }).toThrow();
    });
  });

  describe('Dynamic Updates', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should update configuration at runtime', () => {
      const updates = {
        testTimeout: 15000,
        verbose: true
      };

      manager.updateConfiguration(updates);
      const config = manager.getCurrentConfiguration();
      
      expect(config.testTimeout).toBe(15000);
      expect(config.verbose).toBe(true);
    });

    test('should merge configuration updates', () => {
      const originalTestMatch = manager.getCurrentConfiguration().testMatch;
      
      manager.updateConfiguration({
        testMatch: [...originalTestMatch, '**/*.integration.js']
      });

      const config = manager.getCurrentConfiguration();
      expect(config.testMatch).toContain('**/*.integration.js');
    });

    test('should reset to default configuration', () => {
      manager.updateConfiguration({ verbose: true, testTimeout: 30000 });
      
      manager.resetToDefaults();
      const config = manager.getCurrentConfiguration();
      
      expect(config.verbose).toBe(false); // Default value from baseConfig
      expect(config.testTimeout).toBe(5000); // Default timeout
    });
  });

  describe('Reporter Management', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    test('should add custom reporters', () => {
      const reporters = ['jest-junit', ['./custom-reporter.js', { option: true }]];
      manager.addReporters(reporters);
      const config = manager.getCurrentConfiguration();
      
      expect(config.reporters).toBeDefined();
      expect(config.reporters).toContain('jest-junit');
      expect(config.reporters).toContainEqual(['./custom-reporter.js', { option: true }]);
    });

    test('should handle invalid reporter format', () => {
      expect(() => {
        manager.addReporters([123]); // Invalid - not string or array
      }).toThrow('Reporter must be a string or array [path, options]');
    });

    test('should set reporters (replace all)', () => {
      // First add some reporters
      manager.addReporters(['default', 'jest-junit']);
      
      // Then set new reporters (should replace)
      manager.setReporters(['html', 'json']);
      const config = manager.getCurrentConfiguration();
      
      expect(config.reporters).toEqual(['html', 'json']);
      expect(config.reporters).not.toContain('default');
      expect(config.reporters).not.toContain('jest-junit');
    });

    test('should add Jester reporter with default configuration', () => {
      manager.addJesterReporter();
      const config = manager.getCurrentConfiguration();
      
      expect(config.reporters).toBeDefined();
      expect(config.reporters).toHaveLength(1);
      
      const jesterReporter = config.reporters[0];
      expect(jesterReporter).toBeInstanceOf(Array);
      expect(jesterReporter[0]).toBe('@legion/jester/reporter');
      expect(jesterReporter[1]).toEqual({
        dbPath: './test-results.db',
        collectConsole: true,
        collectCoverage: true,
        realTimeEvents: true
      });
    });

    test('should add Jester reporter with custom configuration', () => {
      const jesterConfig = {
        dbPath: '/custom/path/test-results.db',
        collectConsole: false,
        collectCoverage: true,
        realTimeEvents: false,
        customOption: 'value'
      };
      
      manager.addJesterReporter(jesterConfig);
      const config = manager.getCurrentConfiguration();
      
      const jesterReporter = config.reporters[0];
      expect(jesterReporter[1]).toEqual({
        dbPath: '/custom/path/test-results.db',
        collectConsole: false,
        collectCoverage: true,
        realTimeEvents: false,
        customOption: 'value'
      });
    });

    test('should add Jester reporter alongside other reporters', () => {
      // Add other reporters first
      manager.addReporters(['default', 'jest-junit']);
      
      // Add Jester reporter
      manager.addJesterReporter({ dbPath: './jester.db' });
      
      const config = manager.getCurrentConfiguration();
      
      expect(config.reporters).toHaveLength(3);
      expect(config.reporters[0]).toBe('default');
      expect(config.reporters[1]).toBe('jest-junit');
      expect(config.reporters[2][0]).toBe('@legion/jester/reporter');
    });

    test('should preserve Jester reporter when adding more reporters', () => {
      // Add Jester reporter first
      manager.addJesterReporter();
      
      // Add more reporters
      manager.addReporters(['jest-html-reporter']);
      
      const config = manager.getCurrentConfiguration();
      
      expect(config.reporters).toHaveLength(2);
      expect(config.reporters[0][0]).toBe('@legion/jester/reporter');
      expect(config.reporters[1]).toBe('jest-html-reporter');
    });
  });
});