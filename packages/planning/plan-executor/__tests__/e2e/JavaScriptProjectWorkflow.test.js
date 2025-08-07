/**
 * End-to-end test for complete JavaScript project creation workflow
 * This test demonstrates the full new input/output system capabilities
 */

import { PlanExecutor } from '../../src/core/PlanExecutor.js';
import { ResourceManager } from '@legion/tool-core';
import { FileModule } from '../../../../general-tools/src/file/FileModule.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('JavaScript Project Creation E2E Workflow', () => {
  let executor;
  let resourceManager;
  let tempDir;

  beforeAll(async () => {
    // Set up test environment
    tempDir = await global.createTempDir('js-project-e2e-');
    
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    executor = await PlanExecutor.create(resourceManager);
    
    // Load required modules
    await executor.moduleLoader.loadModuleByName('file', FileModule);
  }, 60000);

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should create a complete Node.js project with the new input/output system', async () => {
    const projectPlan = {
      id: 'js-project-e2e',
      name: 'JavaScript Project E2E Test',
      description: 'Complete JavaScript project creation using new inputs/outputs system',
      status: 'validated',
      steps: [
        {
          id: 'project-setup',
          name: 'Project Setup',
          description: 'Create project directory structure',
          actions: [
            {
              id: 'create-root',
              type: 'directory_create',
              inputs: {
                dirpath: path.join(tempDir, 'my-awesome-project'),
                operation: 'create'
              },
              outputs: {
                dirpath: 'projectRoot',
                created: 'rootCreated'
              }
            },
            {
              id: 'create-src',
              type: 'directory_create', 
              inputs: {
                dirpath: '@projectRoot/src',
                operation: 'create'
              },
              outputs: {
                dirpath: 'srcDir',
                created: 'srcCreated'
              }
            },
            {
              id: 'create-tests',
              type: 'directory_create',
              inputs: {
                dirpath: '@projectRoot/tests',
                operation: 'create'
              },
              outputs: {
                dirpath: 'testsDir',
                created: 'testsCreated'
              }
            }
          ]
        },
        {
          id: 'package-files',
          name: 'Package Configuration',
          description: 'Create package.json and related files',
          dependencies: ['project-setup'],
          actions: [
            {
              id: 'create-package-json',
              type: 'file_write',
              inputs: {
                filepath: '@projectRoot/package.json',
                content: {
                  name: 'my-awesome-project',
                  version: '1.0.0',
                  description: 'An awesome Node.js project created by Legion Plan Executor',
                  main: 'src/index.js',
                  scripts: {
                    start: 'node src/index.js',
                    test: 'jest tests/',
                    dev: 'nodemon src/index.js'
                  },
                  keywords: ['nodejs', 'javascript', 'legion'],
                  author: 'Legion Plan Executor',
                  license: 'MIT',
                  dependencies: {
                    express: '^4.18.0',
                    dotenv: '^16.0.0'
                  },
                  devDependencies: {
                    jest: '^29.0.0',
                    nodemon: '^2.0.0'
                  }
                }
              },
              outputs: {
                filepath: 'packageJsonPath',
                bytesWritten: 'packageJsonSize',
                created: 'packageJsonCreated'
              }
            },
            {
              id: 'create-gitignore',
              type: 'file_write',
              inputs: {
                filepath: '@projectRoot/.gitignore',
                content: 'node_modules/\n.env\n.DS_Store\ncoverage/\n*.log\n'
              },
              outputs: {
                filepath: 'gitignorePath',
                created: 'gitignoreCreated'
              }
            },
            {
              id: 'create-readme',
              type: 'file_write',
              inputs: {
                filepath: '@projectRoot/README.md',
                content: '# My Awesome Project\n\n> Created with Legion Plan Executor\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n```bash\nnpm start\n```\n\n## Testing\n\n```bash\nnpm test\n```\n\n## Development\n\n```bash\nnpm run dev\n```\n'
              },
              outputs: {
                filepath: 'readmePath',
                created: 'readmeCreated'
              }
            }
          ]
        },
        {
          id: 'source-code',
          name: 'Source Code Creation',
          description: 'Create main application and utility files',
          dependencies: ['package-files'],
          actions: [
            {
              id: 'create-main-app',
              type: 'file_write',
              inputs: {
                filepath: '@srcDir/index.js',
                content: '// Main application entry point\\nrequire(\\'dotenv\\').config();\\nconst express = require(\\'express\\');\\nconst { createServer } = require(\\'./server\\');\\nconst { logger } = require(\\'./utils/logger\\');\\n\\nconst PORT = process.env.PORT || 3000;\\n\\nasync function main() {\\n  try {\\n    const app = createServer();\\n    \\n    app.listen(PORT, () => {\\n      logger.info(`🚀 Server running on port ${PORT}`);\\n    });\\n  } catch (error) {\\n    logger.error(\\'Failed to start server:\\', error);\\n    process.exit(1);\\n  }\\n}\\n\\nif (require.main === module) {\\n  main();\\n}\\n\\nmodule.exports = { main };\\n'
              },
              outputs: {
                filepath: 'mainAppPath',
                created: 'mainAppCreated'
              }
            },
            {
              id: 'create-server',
              type: 'file_write',
              inputs: {
                filepath: '@srcDir/server.js',
                content: 'const express = require(\\'express\\');\\nconst { logger } = require(\\'./utils/logger\\');\\n\\nfunction createServer() {\\n  const app = express();\\n  \\n  // Middleware\\n  app.use(express.json());\\n  app.use(express.urlencoded({ extended: true }));\\n  \\n  // Health check endpoint\\n  app.get(\\'/health\\', (req, res) => {\\n    res.json({ \\n      status: \\'healthy\\',\\n      timestamp: new Date().toISOString(),\\n      uptime: process.uptime()\\n    });\\n  });\\n  \\n  // API routes\\n  app.get(\\'/api/hello\\', (req, res) => {\\n    const { name = \\'World\\' } = req.query;\\n    logger.info(`Hello endpoint called with name: ${name}`);\\n    res.json({ message: `Hello, ${name}!` });\\n  });\\n  \\n  // Error handling middleware\\n  app.use((error, req, res, next) => {\\n    logger.error(\\'Unhandled error:\\', error);\\n    res.status(500).json({ error: \\'Internal server error\\' });\\n  });\\n  \\n  return app;\\n}\\n\\nmodule.exports = { createServer };\\n'
              },
              outputs: {
                filepath: 'serverPath',
                created: 'serverCreated'
              }
            },
            {
              id: 'create-utils-dir',
              type: 'directory_create',
              inputs: {
                dirpath: '@srcDir/utils',
                operation: 'create'
              },
              outputs: {
                dirpath: 'utilsDir'
              }
            },
            {
              id: 'create-logger',
              type: 'file_write',
              inputs: {
                filepath: '@utilsDir/logger.js',
                content: 'class Logger {\\n  info(message, ...args) {\\n    console.log(`[INFO] ${new Date().toISOString()} -`, message, ...args);\\n  }\\n  \\n  error(message, ...args) {\\n    console.error(`[ERROR] ${new Date().toISOString()} -`, message, ...args);\\n  }\\n  \\n  warn(message, ...args) {\\n    console.warn(`[WARN] ${new Date().toISOString()} -`, message, ...args);\\n  }\\n}\\n\\nconst logger = new Logger();\\n\\nmodule.exports = { logger };\\n'
              },
              outputs: {
                filepath: 'loggerPath',
                created: 'loggerCreated'
              }
            }
          ]
        },
        {
          id: 'test-files',
          name: 'Test Suite Creation',
          description: 'Create comprehensive test suite',
          dependencies: ['source-code'],
          actions: [
            {
              id: 'create-server-test',
              type: 'file_write',
              inputs: {
                filepath: '@testsDir/server.test.js',
                content: 'const request = require(\\'supertest\\');\\nconst { createServer } = require(\\'../src/server\\');\\n\\ndescribe(\\'Server\\', () => {\\n  let app;\\n  \\n  beforeEach(() => {\\n    app = createServer();\\n  });\\n  \\n  describe(\\'GET /health\\', () => {\\n    it(\\'should return healthy status\\', async () => {\\n      const response = await request(app)\\n        .get(\\'/health\\')\\n        .expect(200);\\n      \\n      expect(response.body.status).toBe(\\'healthy\\');\\n      expect(response.body.timestamp).toBeDefined();\\n      expect(response.body.uptime).toBeGreaterThan(0);\\n    });\\n  });\\n  \\n  describe(\\'GET /api/hello\\', () => {\\n    it(\\'should return hello message with default name\\', async () => {\\n      const response = await request(app)\\n        .get(\\'/api/hello\\')\\n        .expect(200);\\n      \\n      expect(response.body.message).toBe(\\'Hello, World!\\');\\n    });\\n    \\n    it(\\'should return hello message with custom name\\', async () => {\\n      const response = await request(app)\\n        .get(\\'/api/hello?name=Legion\\')\\n        .expect(200);\\n      \\n      expect(response.body.message).toBe(\\'Hello, Legion!\\');\\n    });\\n  });\\n});\\n'
              },
              outputs: {
                filepath: 'serverTestPath',
                created: 'serverTestCreated'
              }
            },
            {
              id: 'create-jest-config',
              type: 'file_write',
              inputs: {
                filepath: '@projectRoot/jest.config.js',
                content: 'module.exports = {\\n  testEnvironment: \\'node\\',\\n  collectCoverageFrom: [\\n    \\'src/**/*.js\\',\\n    \\'!src/index.js\\'\\n  ],\\n  coverageDirectory: \\'coverage\\',\\n  coverageReporters: [\\'text\\', \\'lcov\\', \\'html\\'],\\n  testMatch: [\\'**/tests/**/*.test.js\\'],\\n  verbose: true\\n};\\n'
              },
              outputs: {
                filepath: 'jestConfigPath',
                created: 'jestConfigCreated'
              }
            }
          ]
        }
      ]
    };

    // Execute the complete project creation plan
    const result = await executor.executePlan(projectPlan);

    // Verify plan execution succeeded
    expect(result.success).toBe(true);
    expect(result.completedSteps).toHaveLength(4);
    expect(result.failedSteps).toHaveLength(0);
    
    // Verify complete project structure was created
    const projectRoot = path.join(tempDir, 'my-awesome-project');
    
    // Check directories
    expect(await fs.access(projectRoot).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'src')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'tests')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'src', 'utils')).then(() => true, () => false)).toBe(true);

    // Check configuration files
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    expect(packageJson.name).toBe('my-awesome-project');
    expect(packageJson.dependencies.express).toBeDefined();
    expect(packageJson.devDependencies.jest).toBeDefined();

    expect(await fs.access(path.join(projectRoot, '.gitignore')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'README.md')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'jest.config.js')).then(() => true, () => false)).toBe(true);

    // Check source files
    expect(await fs.access(path.join(projectRoot, 'src', 'index.js')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'src', 'server.js')).then(() => true, () => false)).toBe(true);
    expect(await fs.access(path.join(projectRoot, 'src', 'utils', 'logger.js')).then(() => true, () => false)).toBe(true);

    // Check test files
    expect(await fs.access(path.join(projectRoot, 'tests', 'server.test.js')).then(() => true, () => false)).toBe(true);

    // Verify file contents contain expected code patterns
    const mainAppContent = await fs.readFile(path.join(projectRoot, 'src', 'index.js'), 'utf8');
    expect(mainAppContent).toContain('require(\\'dotenv\\').config()');
    expect(mainAppContent).toContain('express');
    expect(mainAppContent).toContain('PORT');

    const serverContent = await fs.readFile(path.join(projectRoot, 'src', 'server.js'), 'utf8');
    expect(serverContent).toContain('createServer');
    expect(serverContent).toContain('/health');
    expect(serverContent).toContain('/api/hello');

    const testContent = await fs.readFile(path.join(projectRoot, 'tests', 'server.test.js'), 'utf8');
    expect(testContent).toContain('describe');
    expect(testContent).toContain('supertest');
    expect(testContent).toContain('should return healthy status');

    console.log(`✅ Complete Node.js project created successfully at: ${projectRoot}`);
    console.log(`📁 Project structure:`);
    console.log(`   ${projectRoot}/`);
    console.log(`   ├── package.json`);
    console.log(`   ├── .gitignore`);
    console.log(`   ├── README.md`);
    console.log(`   ├── jest.config.js`);
    console.log(`   ├── src/`);
    console.log(`   │   ├── index.js`);
    console.log(`   │   ├── server.js`);
    console.log(`   │   └── utils/`);
    console.log(`   │       └── logger.js`);
    console.log(`   └── tests/`);
    console.log(`       └── server.test.js`);
    
  }, 60000); // Extended timeout for complex workflow

  test('should handle variable dependencies across multiple steps', async () => {
    // This test focuses specifically on variable chaining capabilities
    const variableTestPlan = {
      id: 'variable-chain-test',
      name: 'Variable Chaining Test',
      status: 'validated',
      steps: [
        {
          id: 'setup-base',
          name: 'Setup Base Environment',
          actions: [
            {
              id: 'create-workspace',
              type: 'directory_create',
              inputs: {
                dirpath: path.join(tempDir, 'variable-chain-test'),
                operation: 'create'
              },
              outputs: {
                dirpath: 'workspace'
              }
            },
            {
              id: 'create-config',
              type: 'file_write',
              inputs: {
                filepath: '@workspace/config.json',
                content: { 
                  projectName: 'variable-test',
                  version: '1.0.0',
                  buildDir: 'dist'
                }
              },
              outputs: {
                filepath: 'configFile'
              }
            }
          ]
        },
        {
          id: 'use-config',
          name: 'Use Configuration',
          dependencies: ['setup-base'],
          actions: [
            {
              id: 'read-config',
              type: 'file_read',
              inputs: {
                filepath: '@configFile'
              },
              outputs: {
                content: 'configData'
              }
            },
            {
              id: 'create-build-dir',
              type: 'directory_create',
              inputs: {
                dirpath: '@workspace/dist',
                operation: 'create'
              },
              outputs: {
                dirpath: 'buildDir'
              }
            },
            {
              id: 'create-output',
              type: 'file_write',
              inputs: {
                filepath: '@buildDir/output.txt',
                content: 'Build completed successfully!'
              },
              outputs: {
                filepath: 'outputFile'
              }
            }
          ]
        }
      ]
    };

    const result = await executor.executePlan(variableTestPlan);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toEqual(['setup-base', 'use-config']);

    // Verify the entire chain worked
    const workspace = path.join(tempDir, 'variable-chain-test');
    const configFile = path.join(workspace, 'config.json');
    const buildDir = path.join(workspace, 'dist');
    const outputFile = path.join(buildDir, 'output.txt');

    expect(await fs.access(workspace).then(() => true, () => false)).toBe(true);
    expect(await fs.access(configFile).then(() => true, () => false)).toBe(true);
    expect(await fs.access(buildDir).then(() => true, () => false)).toBe(true);
    expect(await fs.access(outputFile).then(() => true, () => false)).toBe(true);

    const outputContent = await fs.readFile(outputFile, 'utf8');
    expect(outputContent).toBe('Build completed successfully!');
  });
});