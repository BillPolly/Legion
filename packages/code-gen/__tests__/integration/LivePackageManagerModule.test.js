/**
 * Live integration tests for Package Manager Module
 * Tests actual module loading and tool execution
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/module-loader';
import { PackageManagerModule } from '../../package-manager/src/PackageManagerModule.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(spawn);

describe('Live Package Manager Module Tests', () => {
  let resourceManager;
  let moduleFactory;
  let packageManagerModule;
  let testProjectDir;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create module factory
    moduleFactory = new ModuleFactory(resourceManager);

    // Create test project directory
    testProjectDir = path.join(tmpdir(), `package-manager-test-${Date.now()}`);
    await fs.mkdir(testProjectDir, { recursive: true });

    // Create and initialize Package Manager Module
    packageManagerModule = await PackageManagerModule.create(resourceManager);
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }
  });

  describe('Module Loading', () => {
    test('should load PackageManagerModule with proper name and initialization', () => {
      expect(packageManagerModule).toBeDefined();
      expect(packageManagerModule.name).toBe('PackageManagerModule');
      expect(packageManagerModule.initialized).toBe(true);
      expect(packageManagerModule.description).toContain('Node.js package management');
    });

    test('should have all expected tools', () => {
      const tools = packageManagerModule.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('install_package');
      expect(toolNames).toContain('install_packages');
      expect(toolNames).toContain('create_package_json');
      expect(toolNames).toContain('run_npm_script');
    });
  });

  describe('CreatePackageJsonTool', () => {
    test('should create a basic package.json file', async () => {
      const tool = packageManagerModule.getTool('create_package_json');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        name: 'test-project',
        version: '1.0.0',
        description: 'A test project for Package Manager module',
        projectPath: testProjectDir,
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
          start: 'node index.js'
        }
      });

      expect(result).toBeDefined();
      expect(result.created).toBe(true);
      expect(result.path).toContain('package.json');
      expect(result.content.name).toBe('test-project');
      expect(result.content.scripts.start).toBe('node index.js');

      // Verify file was actually created
      const packageJsonPath = path.join(testProjectDir, 'package.json');
      const fileExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const content = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      expect(content.name).toBe('test-project');
    });

    test('should create package.json with dependencies', async () => {
      const tool = packageManagerModule.getTool('create_package_json');
      
      const projectDir = path.join(testProjectDir, 'with-deps');
      await fs.mkdir(projectDir, { recursive: true });

      const result = await tool.execute({
        name: 'project-with-deps',
        projectPath: projectDir,
        dependencies: {
          'lodash': '^4.17.21',
          'express': '^4.18.0'
        },
        devDependencies: {
          'jest': '^29.0.0',
          'nodemon': '^3.0.0'
        }
      });

      expect(result.created).toBe(true);
      expect(result.content.dependencies['lodash']).toBe('^4.17.21');
      expect(result.content.devDependencies['jest']).toBe('^29.0.0');
    });
  });

  describe('InstallPackageTool', () => {
    test('should install a single package', async () => {
      const createTool = packageManagerModule.getTool('create_package_json');
      const installTool = packageManagerModule.getTool('install_package');
      expect(installTool).toBeDefined();

      const projectDir = path.join(testProjectDir, 'single-install');
      await fs.mkdir(projectDir, { recursive: true });

      // First create package.json
      await createTool.execute({
        name: 'single-install-test',
        projectPath: projectDir
      });

      // Install a small, fast package
      const result = await installTool.execute({
        name: 'is-number',
        projectPath: projectDir
      });

      expect(result).toBeDefined();
      expect(result.packageName).toBe('is-number');
      expect(result.status).toBe('installed');
      expect(result.installationTime).toBeGreaterThan(0);

      // Verify package was installed
      const nodeModulesPath = path.join(projectDir, 'node_modules', 'is-number');
      const packageInstalled = await fs.access(nodeModulesPath).then(() => true).catch(() => false);
      expect(packageInstalled).toBe(true);
    }, 30000); // 30 second timeout for npm install
  });

  describe('InstallPackagesTool', () => {
    test('should install multiple packages in batch', async () => {
      const createTool = packageManagerModule.getTool('create_package_json');
      const installTool = packageManagerModule.getTool('install_packages');
      expect(installTool).toBeDefined();

      const projectDir = path.join(testProjectDir, 'batch-install');
      await fs.mkdir(projectDir, { recursive: true });

      // First create package.json
      await createTool.execute({
        name: 'batch-install-test',
        projectPath: projectDir
      });

      // Install multiple small packages
      const result = await installTool.execute({
        packages: [
          'is-number',
          'is-string',
          { name: 'is-array', isDev: true }
        ],
        projectPath: projectDir
      });

      expect(result).toBeDefined();
      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBeGreaterThan(0);
      expect(result.results).toHaveLength(3);

      // Check if packages were installed
      const packageJson = JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8'));
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.devDependencies).toBeDefined();
    }, 60000); // 60 second timeout for multiple installs
  });

  describe('RunNpmScriptTool', () => {
    test('should run an npm script', async () => {
      const createTool = packageManagerModule.getTool('create_package_json');
      const runTool = packageManagerModule.getTool('run_npm_script');
      expect(runTool).toBeDefined();

      const projectDir = path.join(testProjectDir, 'script-runner');
      await fs.mkdir(projectDir, { recursive: true });

      // Create package.json with a simple script
      await createTool.execute({
        name: 'script-runner-test',
        projectPath: projectDir,
        scripts: {
          hello: 'echo "Hello from npm script!"',
          'list-files': 'ls -la'
        }
      });

      // Run the hello script
      const result = await runTool.execute({
        scriptName: 'hello',
        projectPath: projectDir
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Hello from npm script!');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should handle script with arguments', async () => {
      const createTool = packageManagerModule.getTool('create_package_json');
      const runTool = packageManagerModule.getTool('run_npm_script');

      const projectDir = path.join(testProjectDir, 'script-with-args');
      await fs.mkdir(projectDir, { recursive: true });

      // Create a simple Node.js script
      const scriptContent = `
console.log('Arguments:', process.argv.slice(2).join(' '));
`;
      await fs.writeFile(path.join(projectDir, 'script.js'), scriptContent);

      // Create package.json
      await createTool.execute({
        name: 'script-args-test',
        projectPath: projectDir,
        scripts: {
          'run-script': 'node script.js'
        }
      });

      // Run script with arguments
      const result = await runTool.execute({
        scriptName: 'run-script',
        projectPath: projectDir,
        args: ['arg1', 'arg2', 'arg3']
      });

      expect(result.status).toBe('completed');
      expect(result.output).toContain('Arguments: arg1 arg2 arg3');
    });

    test('should handle non-existent script', async () => {
      const createTool = packageManagerModule.getTool('create_package_json');
      const runTool = packageManagerModule.getTool('run_npm_script');

      const projectDir = path.join(testProjectDir, 'no-script');
      await fs.mkdir(projectDir, { recursive: true });

      await createTool.execute({
        name: 'no-script-test',
        projectPath: projectDir
      });

      const result = await runTool.execute({
        scriptName: 'non-existent',
        projectPath: projectDir
      });

      expect(result.status).toBe('not-found');
      expect(result.error).toContain('Script "non-existent" not found');
    });
  });

  describe('End-to-End Project Setup', () => {
    test('should set up a complete Node.js project', async () => {
      const projectDir = path.join(testProjectDir, 'complete-project');
      await fs.mkdir(projectDir, { recursive: true });

      // 1. Create package.json
      const createTool = packageManagerModule.getTool('create_package_json');
      await createTool.execute({
        name: 'complete-test-project',
        version: '1.0.0',
        description: 'A complete test project',
        projectPath: projectDir,
        scripts: {
          start: 'node index.js',
          test: 'echo "Tests passed!"'
        }
      });

      // 2. Create a simple index.js file
      await fs.writeFile(
        path.join(projectDir, 'index.js'),
        'console.log("Hello from complete project!");\n'
      );

      // 3. Install dependencies
      const installTool = packageManagerModule.getTool('install_packages');
      await installTool.execute({
        packages: ['is-number', 'is-string'],
        projectPath: projectDir
      });

      // 4. Run the start script
      const runTool = packageManagerModule.getTool('run_npm_script');
      const runResult = await runTool.execute({
        scriptName: 'start',
        projectPath: projectDir
      });

      expect(runResult.status).toBe('completed');
      expect(runResult.output).toContain('Hello from complete project!');

      // 5. Run the test script
      const testResult = await runTool.execute({
        scriptName: 'test',
        projectPath: projectDir
      });

      expect(testResult.status).toBe('completed');
      expect(testResult.output).toContain('Tests passed!');
    }, 60000);
  });
});