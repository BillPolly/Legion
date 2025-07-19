/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { PackageManager } from '../../../src/execution/PackageManager.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PackageManager', () => {
  let packageManager;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-package-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    packageManager = new PackageManager(mockConfig);
  });

  afterEach(async () => {
    if (packageManager) {
      await packageManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(packageManager.config).toBeDefined();
      expect(packageManager.isInitialized).toBe(false);
      expect(packageManager.installedPackages).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await packageManager.initialize();
      
      expect(packageManager.isInitialized).toBe(true);
      expect(packageManager.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await packageManager.initialize();
      
      await expect(packageManager.initialize()).resolves.not.toThrow();
      expect(packageManager.isInitialized).toBe(true);
    });
  });

  describe('Package Installation', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should install single package', async () => {
      const packageConfig = {
        name: 'lodash',
        version: '^4.17.21',
        projectPath: testProjectPath
      };

      const result = await packageManager.installPackage(packageConfig);
      
      expect(result).toBeDefined();
      expect(result.packageName).toBe('lodash');
      expect(result.status).toBe('installed');
      expect(result.version).toBeDefined();
      expect(result.installationTime).toBeDefined();
    });

    test('should install multiple packages', async () => {
      const packages = [
        { name: 'lodash', version: '^4.17.21' },
        { name: 'moment', version: '^2.29.4' }
      ];

      const results = await packageManager.installPackages(packages, testProjectPath);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      
      for (const result of results) {
        expect(result.status).toBe('installed');
        expect(result.packageName).toBeDefined();
        expect(result.version).toBeDefined();
      }
    });

    test('should install dev dependencies', async () => {
      const packageConfig = {
        name: 'jest',
        version: '^29.7.0',
        projectPath: testProjectPath,
        isDev: true
      };

      const result = await packageManager.installPackage(packageConfig);
      
      expect(result.status).toBe('installed');
      expect(result.isDev).toBe(true);
    });

    test('should handle package installation errors', async () => {
      const invalidPackage = {
        name: 'non-existent-package-xyz-123',
        version: '^1.0.0',
        projectPath: testProjectPath
      };

      const result = await packageManager.installPackage(invalidPackage);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    test('should track installed packages', async () => {
      const packageConfig = {
        name: 'axios',
        version: '^1.6.0',
        projectPath: testProjectPath
      };

      await packageManager.installPackage(packageConfig);
      
      const installed = packageManager.getInstalledPackages();
      expect(installed.size).toBeGreaterThan(0);
      
      const axiosInfo = installed.get('axios');
      expect(axiosInfo).toBeDefined();
      expect(axiosInfo.name).toBe('axios');
      expect(axiosInfo.version).toBeDefined();
    });

    test('should check if package is installed', async () => {
      const packageConfig = {
        name: 'chalk',
        version: '^5.3.0',
        projectPath: testProjectPath
      };

      const beforeInstall = await packageManager.isPackageInstalled('chalk', testProjectPath);
      expect(beforeInstall).toBe(false);

      await packageManager.installPackage(packageConfig);
      
      const afterInstall = await packageManager.isPackageInstalled('chalk', testProjectPath);
      expect(afterInstall).toBe(true);
    });
  });

  describe('Package.json Management', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should create package.json if not exists', async () => {
      const newProjectPath = path.join(testProjectPath, 'new-project');
      await fs.mkdir(newProjectPath, { recursive: true });

      const projectConfig = {
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
        projectPath: newProjectPath
      };

      const result = await packageManager.createPackageJson(projectConfig);
      
      expect(result.created).toBe(true);
      expect(result.path).toBeDefined();
      
      const packageJsonExists = await fs.access(path.join(newProjectPath, 'package.json'))
        .then(() => true).catch(() => false);
      expect(packageJsonExists).toBe(true);
    });

    test('should read existing package.json', async () => {
      const packageJson = await packageManager.readPackageJson(testProjectPath);
      
      expect(packageJson).toBeDefined();
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
    });

    test('should update package.json with new dependencies', async () => {
      const newDependencies = {
        'express': '^4.18.2',
        'cors': '^2.8.5'
      };

      const result = await packageManager.updatePackageJson(testProjectPath, {
        dependencies: newDependencies
      });
      
      expect(result.updated).toBe(true);
      
      const updatedPackageJson = await packageManager.readPackageJson(testProjectPath);
      expect(updatedPackageJson.dependencies).toMatchObject(newDependencies);
    });

    test('should validate package.json format', async () => {
      const validPackageJson = {
        name: 'valid-package',
        version: '1.0.0',
        description: 'A valid package'
      };

      const validation = await packageManager.validatePackageJson(validPackageJson);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('should detect package.json validation errors', async () => {
      const invalidPackageJson = {
        name: 'invalid name with spaces',
        version: 'not-a-semver',
        dependencies: 'not-an-object'
      };

      const validation = await packageManager.validatePackageJson(invalidPackageJson);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency Resolution', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should resolve dependency tree', async () => {
      const dependencies = {
        'lodash': '^4.17.21',
        'moment': '^2.29.4'
      };

      const resolved = await packageManager.resolveDependencies(dependencies, testProjectPath);
      
      expect(resolved).toBeDefined();
      expect(resolved.tree).toBeDefined();
      expect(resolved.conflicts).toBeDefined();
      expect(Array.isArray(resolved.conflicts)).toBe(true);
    });

    test('should detect version conflicts', async () => {
      const conflictingDeps = {
        'react': '^18.2.0',
        'react-dom': '^17.0.2' // Incompatible with React 18
      };

      const resolved = await packageManager.resolveDependencies(conflictingDeps, testProjectPath);
      
      expect(resolved.conflicts.length).toBeGreaterThan(0);
      expect(resolved.hasConflicts).toBe(true);
    });

    test('should suggest dependency updates', async () => {
      const suggestions = await packageManager.suggestDependencyUpdates(testProjectPath);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      for (const suggestion of suggestions) {
        expect(suggestion.package).toBeDefined();
        expect(suggestion.currentVersion).toBeDefined();
        expect(suggestion.latestVersion).toBeDefined();
        expect(suggestion.updateType).toBeDefined();
      }
    });

    test('should analyze security vulnerabilities', async () => {
      const analysis = await packageManager.analyzeSecurityVulnerabilities(testProjectPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.vulnerabilities).toBeDefined();
      expect(Array.isArray(analysis.vulnerabilities)).toBe(true);
      expect(analysis.summary).toBeDefined();
      expect(analysis.riskLevel).toBeDefined();
    });
  });

  describe('Package Operations', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should uninstall package', async () => {
      // First install a package
      await packageManager.installPackage({
        name: 'uuid',
        version: '^9.0.0',
        projectPath: testProjectPath
      });

      // Then uninstall it
      const result = await packageManager.uninstallPackage('uuid', testProjectPath);
      
      expect(result.status).toBe('uninstalled');
      expect(result.packageName).toBe('uuid');
    });

    test('should update package version', async () => {
      // Install initial version
      await packageManager.installPackage({
        name: 'semver',
        version: '^7.5.0',
        projectPath: testProjectPath
      });

      // Update to newer version
      const result = await packageManager.updatePackage({
        name: 'semver',
        version: '^7.6.0',
        projectPath: testProjectPath
      });
      
      expect(result.status).toBe('updated');
      expect(result.oldVersion).toBeDefined();
      expect(result.newVersion).toBeDefined();
    });

    test('should list all installed packages', async () => {
      const packages = await packageManager.listInstalledPackages(testProjectPath);
      
      expect(packages).toBeDefined();
      expect(Array.isArray(packages)).toBe(true);
      
      for (const pkg of packages) {
        expect(pkg.name).toBeDefined();
        expect(pkg.version).toBeDefined();
        expect(pkg.isDev).toBeDefined();
      }
    });

    test('should clean package cache', async () => {
      const result = await packageManager.cleanPackageCache(testProjectPath);
      
      expect(result).toBeDefined();
      expect(result.cleaned).toBe(true);
      expect(result.cacheSize).toBeDefined();
    });
  });

  describe('Package Scripts', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should add npm script', async () => {
      const script = {
        name: 'test:unit',
        command: 'jest --testPathPattern=unit',
        description: 'Run unit tests'
      };

      const result = await packageManager.addScript(script, testProjectPath);
      
      expect(result.added).toBe(true);
      expect(result.scriptName).toBe('test:unit');
    });

    test('should run npm script', async () => {
      // Add a simple script first
      await packageManager.addScript({
        name: 'hello',
        command: 'echo "Hello World"'
      }, testProjectPath);

      const result = await packageManager.runScript('hello', testProjectPath);
      
      expect(result.status).toBe('completed');
      expect(result.output).toContain('Hello World');
    });

    test('should list available scripts', async () => {
      const scripts = await packageManager.listScripts(testProjectPath);
      
      expect(scripts).toBeDefined();
      expect(Array.isArray(scripts)).toBe(true);
      
      for (const script of scripts) {
        expect(script.name).toBeDefined();
        expect(script.command).toBeDefined();
      }
    });
  });

  describe('Package Validation', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should validate package integrity', async () => {
      const validation = await packageManager.validatePackageIntegrity(testProjectPath);
      
      expect(validation).toBeDefined();
      expect(validation.valid).toBeDefined();
      expect(validation.issues).toBeDefined();
      expect(Array.isArray(validation.issues)).toBe(true);
    });

    test('should check for missing dependencies', async () => {
      const missing = await packageManager.checkMissingDependencies(testProjectPath);
      
      expect(missing).toBeDefined();
      expect(Array.isArray(missing)).toBe(true);
    });

    test('should detect unused dependencies', async () => {
      const unused = await packageManager.detectUnusedDependencies(testProjectPath);
      
      expect(unused).toBeDefined();
      expect(Array.isArray(unused)).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should analyze package size', async () => {
      const analysis = await packageManager.analyzePackageSize(testProjectPath);
      
      expect(analysis).toBeDefined();
      expect(analysis.totalSize).toBeDefined();
      expect(analysis.largestPackages).toBeDefined();
      expect(Array.isArray(analysis.largestPackages)).toBe(true);
    });

    test('should suggest performance optimizations', async () => {
      const suggestions = await packageManager.suggestOptimizations(testProjectPath);
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      for (const suggestion of suggestions) {
        expect(suggestion.type).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(suggestion.impact).toBeDefined();
      }
    });

    test('should benchmark installation performance', async () => {
      const benchmark = await packageManager.benchmarkInstallation(testProjectPath, {
        packages: ['lodash', 'moment'],
        iterations: 1
      });
      
      expect(benchmark).toBeDefined();
      expect(benchmark.averageTime).toBeDefined();
      expect(benchmark.results).toBeDefined();
      expect(Array.isArray(benchmark.results)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await packageManager.initialize();
    });

    test('should handle network errors', async () => {
      // Mock network error by trying to install non-existent package
      const result = await packageManager.installPackage({
        name: 'non-existent-package-xyz-12345678',
        version: '^1.0.0',
        projectPath: testProjectPath
      });
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    }, 15000);

    test('should handle permission errors', async () => {
      // Try to install to a read-only directory
      const readOnlyPath = path.join(testProjectPath, 'readonly');
      await fs.mkdir(readOnlyPath, { recursive: true });
      
      try {
        await fs.chmod(readOnlyPath, 0o444); // Read-only
        
        const result = await packageManager.installPackage({
          name: 'test-package',
          version: '^1.0.0',
          projectPath: readOnlyPath
        });
        
        expect(result.status).toBe('error');
        expect(result.error).toBeDefined();
      } finally {
        await fs.chmod(readOnlyPath, 0o755); // Restore permissions
      }
    });

    test('should handle corrupted package.json', async () => {
      const corruptedPath = path.join(testProjectPath, 'corrupted');
      await fs.mkdir(corruptedPath, { recursive: true });
      await fs.writeFile(path.join(corruptedPath, 'package.json'), 'invalid json{');
      
      const result = await packageManager.readPackageJson(corruptedPath);
      
      expect(result).toBeNull();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await packageManager.initialize();
      
      // Install a package to create some state
      const result = await packageManager.installPackage({
        name: 'lodash',
        version: '^4.17.21',
        projectPath: testProjectPath
      });
      
      // Verify package was tracked (either installed or already-installed)
      expect(['installed', 'already-installed']).toContain(result.status);
      
      // Manually add to tracking if it wasn't added (for already-installed case)
      if (result.status === 'already-installed') {
        packageManager.installedPackages.set('lodash', {
          name: 'lodash',
          version: '^4.17.21',
          isDev: false,
          installTime: 100,
          installedAt: Date.now()
        });
      }
      
      expect(packageManager.installedPackages.size).toBeGreaterThan(0);
      
      await packageManager.cleanup();
      
      expect(packageManager.installedPackages.size).toBe(0);
      expect(packageManager.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: 'test-package-project',
    version: '1.0.0',
    description: 'Test project for package management',
    main: 'index.js',
    scripts: {
      test: 'jest',
      start: 'node index.js'
    },
    dependencies: {},
    devDependencies: {}
  };
  
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create index.js
  await fs.writeFile(
    path.join(projectPath, 'index.js'),
    `
console.log('Test project');
module.exports = {
  test: true
};
`
  );
  
  // Create src directory
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create a simple module
  await fs.writeFile(
    path.join(projectPath, 'src', 'utils.js'),
    `
const _ = require('lodash');
const moment = require('moment');

module.exports = {
  format: (data) => _.pick(data, ['name', 'version']),
  timestamp: () => moment().format()
};
`
  );
}