/**
 * Step-by-step integration tests for CodeAgent
 * Building up to a complete Node.js server
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { CodeAgent } from '../../src/index.js';
import { ResourceManager } from '@legion/module-loader';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CodeAgent Step-by-Step Integration Tests', () => {
  let agent;
  let testDir;
  let apiKey;
  
  beforeAll(async () => {
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in ResourceManager');
    }
  });

  beforeEach(async () => {
    testDir = path.join(__dirname, 'temp-test-' + Date.now());
    await fs.mkdir(testDir, { recursive: true });
    
    agent = new CodeAgent({
      projectType: 'backend'
    });
  });

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
  });

  describe('Step 1: Basic File Operations', () => {
    test('should initialize and create directories', async () => {
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'anthropic',
          apiKey: apiKey,
          model: 'claude-3-sonnet-20240229'
        }
      });

      expect(agent.initialized).toBe(true);

      // Test directory creation
      await agent.fileOps.createDirectory(path.join(testDir, 'src'));
      await agent.fileOps.createDirectory(path.join(testDir, 'tests'));

      const dirs = await fs.readdir(testDir);
      expect(dirs).toContain('src');
      expect(dirs).toContain('tests');
    });

    test('should write a simple file', async () => {
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'anthropic',
          apiKey: apiKey,
          model: 'claude-3-sonnet-20240229'
        }
      });

      const content = 'console.log("Hello World");';
      const filePath = path.join(testDir, 'src', 'index.js');
      
      await agent.fileOps.createDirectory(path.join(testDir, 'src'));
      await agent.fileOps.writeFile(filePath, content);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content);
    });
  });

  describe('Step 2: Backend Code Generation', () => {
    test('should generate Express server setup code', async () => {
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'anthropic',
          apiKey: apiKey,
          model: 'claude-3-sonnet-20240229'
        }
      });

      // Use the proper JSGenerator spec format
      const serverSpec = {
        name: 'server',
        description: 'Basic Express server setup with JSON parsing',
        imports: [
          { default: 'express', from: 'express' }
        ],
        constants: {
          PORT: 'process.env.PORT || 3000'
        },
        functions: [
          {
            name: 'createApp',
            params: [],
            body: [
              'const app = express();',
              'app.use(express.json());',
              'app.use(express.urlencoded({ extended: true }));',
              'return app;'
            ].join('\n'),
            jsdoc: { description: 'Create and configure Express app' }
          },
          {
            name: 'startServer',
            params: [],
            isAsync: true,
            body: [
              'const app = createApp();',
              'app.listen(PORT, () => {',
              '  console.log(`Server running on port ${PORT}`);',
              '});'
            ].join('\n'),
            jsdoc: { description: 'Start the server' }
          }
        ],
        main: 'startServer().catch(console.error);'
      };

      const serverCode = await agent.jsGenerator.generateModule(serverSpec);
      
      expect(serverCode).toContain('express');
      expect(serverCode).toContain('app.listen');
      expect(serverCode).toContain('3000');
      expect(serverCode).toContain('express.json()');
      expect(serverCode).toContain('express.urlencoded');
      
      console.log('Generated server code preview:', serverCode.substring(0, 500) + '...');
    });

    test('should generate API endpoint for adding numbers', async () => {
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'anthropic',
          apiKey: apiKey,
          model: 'claude-3-sonnet-20240229'
        }
      });

      // Generate the endpoint as a function that can be added to Express
      const endpointSpec = {
        method: 'POST',
        path: '/add',
        validation: [
          'const { a, b } = req.body;',
          'if (typeof a !== "number" || typeof b !== "number") {',
          '  return res.status(400).json({ error: "Both a and b must be numbers" });',
          '}'
        ].join('\n'),
        handler: [
          'const { a, b } = req.body;',
          'const result = a + b;'
        ].join('\n'),
        response: '{ result }'
      };

      const endpointFunction = await agent.jsGenerator.generateAPIEndpoint(endpointSpec);
      
      expect(endpointFunction).toContain('async');
      expect(endpointFunction).toContain('req');
      expect(endpointFunction).toContain('res');
      expect(endpointFunction).toContain('req.body');
      expect(endpointFunction).toContain('res.json');
      expect(endpointFunction).toContain('result');
      
      console.log('Generated endpoint code:', endpointFunction);
    });
  });

  describe('Step 3: Complete Workflow', () => {
    test('should generate complete Node.js server', async () => {
      await agent.initialize(testDir, {
        llmConfig: {
          provider: 'anthropic',
          apiKey: apiKey,
          model: 'claude-3-sonnet-20240229'
        }
      });

      // Create a simple server spec
      const serverSpec = {
        name: 'add-server',
        description: 'Simple Node.js Express server that adds two numbers',
        imports: [
          { default: 'express', from: 'express' }
        ],
        constants: {
          PORT: 'process.env.PORT || 3000'
        },
        functions: [
          {
            name: 'createApp',
            params: [],
            body: [
              'const app = express();',
              'app.use(express.json());',
              '',
              '// POST /add endpoint',
              'app.post("/add", (req, res) => {',
              '  const { a, b } = req.body;',
              '  ',
              '  // Validate inputs',
              '  if (typeof a !== "number" || typeof b !== "number") {',
              '    return res.status(400).json({ error: "Both a and b must be numbers" });',
              '  }',
              '  ',
              '  const result = a + b;',
              '  res.json({ result });',
              '});',
              '',
              'return app;'
            ].join('\n'),
            jsdoc: { description: 'Create Express app with /add endpoint' }
          },
          {
            name: 'startServer',
            params: [],
            isAsync: true,
            body: [
              'const app = createApp();',
              '',
              'app.listen(PORT, () => {',
              '  console.log(`Server running on port ${PORT}`);',
              '  console.log(`POST /add endpoint ready`);',
              '});'
            ].join('\n'),
            jsdoc: { description: 'Start the server' }
          }
        ],
        main: 'startServer().catch(console.error);'
      };

      // Generate the server code
      const serverCode = await agent.jsGenerator.generateModule(serverSpec);
      
      // Write to file
      const serverPath = path.join(testDir, 'server.js');
      await agent.fileOps.writeFile(serverPath, serverCode);
      
      // Also create a simple package.json
      const packageJson = {
        name: 'add-server',
        version: '1.0.0',
        description: 'Simple server that adds two numbers',
        main: 'server.js',
        type: 'module',
        scripts: {
          start: 'node server.js',
          test: 'jest'
        },
        dependencies: {
          express: '^4.18.2'
        },
        devDependencies: {
          jest: '^29.0.0'
        }
      };
      
      const packagePath = path.join(testDir, 'package.json');
      await agent.fileOps.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
      
      // Verify files were created
      const files = await fs.readdir(testDir);
      expect(files).toContain('server.js');
      expect(files).toContain('package.json');
      
      // Verify server code content
      const savedServerCode = await fs.readFile(serverPath, 'utf-8');
      expect(savedServerCode).toContain('express');
      expect(savedServerCode).toContain('app.post("/add"');
      expect(savedServerCode).toContain('const result = a + b;');
      expect(savedServerCode).toContain('res.json({ result });');
      
      console.log('✅ Complete Node.js server generated successfully!');
      console.log('Generated files:', files);
      console.log('Server code preview:', savedServerCode.substring(0, 500) + '...');
    });
  });
});