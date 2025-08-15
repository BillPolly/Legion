/**
 * Live integration tests for JS Generator Module
 * Tests actual module loading and tool execution
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager, ModuleFactory } from '@legion/tools-registry';
import { JSGeneratorModule } from '../../js-generator/src/JSGeneratorModule.js';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live JS Generator Module Tests', () => {
  let resourceManager;
  let moduleFactory;
  let jsGeneratorModule;
  let testDir;

  beforeAll(async () => {
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Create module factory
    moduleFactory = new ModuleFactory(resourceManager);

    // Create test directory
    testDir = path.join(tmpdir(), `js-generator-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create and initialize JS Generator Module
    jsGeneratorModule = await JSGeneratorModule.create(resourceManager);
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error.message);
    }
  });

  describe('Module Loading', () => {
    test('should load JSGeneratorModule with proper name and initialization', () => {
      expect(jsGeneratorModule).toBeDefined();
      expect(jsGeneratorModule.name).toBe('JSGeneratorModule');
      expect(jsGeneratorModule.initialized).toBe(true);
      expect(jsGeneratorModule.description).toContain('JavaScript code generation');
    });

    test('should have all expected tools', () => {
      const tools = jsGeneratorModule.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('generate_javascript_module');
      expect(toolNames).toContain('generate_javascript_function');
      expect(toolNames).toContain('generate_javascript_class');
      expect(toolNames).toContain('generate_api_endpoint');
      expect(toolNames).toContain('generate_event_handler');
      expect(toolNames).toContain('generate_unit_tests');
      expect(toolNames).toContain('validate_javascript_syntax');
    });
  });

  describe('GenerateJavaScriptFunctionTool', () => {
    test('should generate a simple function', async () => {
      const tool = jsGeneratorModule.getTool('generate_javascript_function');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        name: 'addNumbers',
        params: ['a', 'b'],
        body: 'return a + b;',
        jsdoc: {
          description: 'Adds two numbers together',
          returns: 'The sum of a and b'
        }
      });

      expect(result).toBeDefined();
      expect(result.code).toContain('function addNumbers(a, b)');
      expect(result.code).toContain('return a + b;');
      expect(result.code).toContain('* Adds two numbers together');
      expect(result.hasJSDoc).toBe(true);
    });

    test('should generate an async arrow function', async () => {
      const tool = jsGeneratorModule.getTool('generate_javascript_function');
      
      const result = await tool.execute({
        name: 'fetchData',
        params: [{ name: 'url', type: 'string' }],
        body: 'const response = await fetch(url);\n  return response.json();',
        isAsync: true,
        isArrow: true,
        returnType: 'Promise<any>'
      });

      expect(result.code).toContain('const fetchData = async (url) =>');
      expect(result.code).toContain('await fetch(url)');
      expect(result.code).toContain('@returns {Promise<any>}');
    });
  });

  describe('GenerateJavaScriptModuleTool', () => {
    test('should generate a complete module', async () => {
      const tool = jsGeneratorModule.getTool('generate_javascript_module');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        name: 'utils',
        description: 'Utility functions for the application',
        imports: [
          { from: 'fs', named: ['readFile', 'writeFile'] },
          { from: './config.js', default: 'config' }
        ],
        functions: [
          {
            name: 'formatDate',
            params: ['date'],
            body: 'return new Date(date).toISOString();',
            isExport: true
          }
        ],
        exports: {
          named: ['formatDate']
        }
      });

      expect(result).toBeDefined();
      expect(result.code).toContain("import { readFile, writeFile } from 'fs'");
      expect(result.code).toContain("import config from './config.js'");
      expect(result.code).toContain('function formatDate(date)');
      expect(result.code).toContain('export { formatDate }');
      expect(result.filename).toBe('utils.js');
    });
  });

  describe('GenerateJavaScriptClassTool', () => {
    test('should generate a class with methods and properties', async () => {
      const tool = jsGeneratorModule.getTool('generate_javascript_class');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        name: 'UserService',
        constructor: {
          params: ['apiClient'],
          body: 'this.apiClient = apiClient;\n    this.cache = new Map();'
        },
        methods: [
          {
            name: 'getUser',
            params: ['id'],
            body: 'return this.apiClient.get(`/users/${id}`);',
            isAsync: true,
            jsdoc: {
              description: 'Fetch a user by ID',
              returns: 'User object'
            }
          }
        ],
        properties: [
          { name: 'apiClient', visibility: 'private' },
          { name: 'cache', visibility: 'private' }
        ],
        isExport: true,
        jsdoc: {
          description: 'Service for managing user operations'
        }
      });

      expect(result).toBeDefined();
      expect(result.code).toContain('export class UserService');
      expect(result.code).toContain('constructor(apiClient)');
      expect(result.code).toContain('async getUser(id)');
      expect(result.code).toContain('* Service for managing user operations');
      expect(result.components.methods).toBe(1);
      expect(result.components.hasConstructor).toBe(true);
    });
  });

  describe('GenerateApiEndpointTool', () => {
    test('should generate an Express API endpoint', async () => {
      const tool = jsGeneratorModule.getTool('generate_api_endpoint');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        method: 'POST',
        path: '/api/users',
        description: 'Create a new user',
        parameters: [
          { name: 'name', type: 'body', dataType: 'string', required: true },
          { name: 'email', type: 'body', dataType: 'string', required: true }
        ],
        handler: 'const { name, email } = req.body;\nconst user = await userService.create({ name, email });\nres.status(201).json(user);',
        authentication: true,
        logging: true
      });

      expect(result).toBeDefined();
      expect(result.code).toContain('const postApiUsers = async (req, res, next)');
      expect(result.code).toContain('if (!req.user)');
      expect(result.code).toContain('console.log(`[${new Date().toISOString()}]');
      expect(result.code).toContain('res.status(201).json(user)');
      expect(result.route).toContain("router.post('/api/users'");
    });
  });

  describe('GenerateEventHandlerTool', () => {
    test('should generate a DOM event handler', async () => {
      const tool = jsGeneratorModule.getTool('generate_event_handler');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        element: '#submit-button',
        event: 'click',
        action: 'const formData = new FormData(event.target.form);\nawait submitForm(formData);',
        preventDefault: true,
        validation: 'if (!event.target.form.checkValidity()) {\n  return;\n}'
      });

      expect(result).toBeDefined();
      expect(result.code).toContain('function handleClickSubmitButton(event)');
      expect(result.code).toContain('event.preventDefault()');
      expect(result.code).toContain('if (!event.target.form.checkValidity())');
      expect(result.attachmentCode).toContain("document.querySelector('#submit-button')");
    });
  });

  describe('GenerateUnitTestsTool', () => {
    test('should generate Jest unit tests', async () => {
      const tool = jsGeneratorModule.getTool('generate_unit_tests');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        target_file: '../src/calculator.js',
        module_name: 'Calculator',
        test_cases: [
          {
            function: 'add',
            description: 'should add two numbers correctly',
            args: [2, 3],
            expectations: [
              { type: 'toBe', expected: 5 }
            ]
          },
          {
            function: 'divide',
            description: 'should throw error when dividing by zero',
            args: [10, 0],
            expectations: [
              { type: 'toThrow', expected: 'Division by zero' }
            ]
          }
        ]
      });

      expect(result).toBeDefined();
      expect(result.test_content).toContain("import calculator from '../src/calculator.js'");
      expect(result.test_content).toContain("describe('Calculator', () => {");
      expect(result.test_content).toContain("test('should add two numbers correctly'");
      expect(result.test_content).toContain('expect(result).toBe(5)');
      expect(result.test_content).toContain('expect(() => divide(10, 0)).toThrow');
      expect(result.test_path).toBe('__tests__/calculator.test.js');
    });
  });

  describe('ValidateJavaScriptSyntaxTool', () => {
    test('should validate correct JavaScript syntax', async () => {
      const tool = jsGeneratorModule.getTool('validate_javascript_syntax');
      expect(tool).toBeDefined();

      const result = await tool.execute({
        code: 'const x = 42;\nfunction test() { return x * 2; }'
      });

      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should detect syntax errors', async () => {
      const tool = jsGeneratorModule.getTool('validate_javascript_syntax');

      const result = await tool.execute({
        code: 'const x = 42\nfunction test() { return x * 2'
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unexpected token');
    });
  });

  describe('End-to-End Module Generation', () => {
    test('should generate and save a complete module file', async () => {
      const moduleTool = jsGeneratorModule.getTool('generate_javascript_module');
      const validateTool = jsGeneratorModule.getTool('validate_javascript_syntax');

      // Generate a module (without ES module exports for validation compatibility)
      const moduleResult = await moduleTool.execute({
        name: 'testModule',
        description: 'A test module generated by JS Generator',
        functions: [
          {
            name: 'hello',
            params: ['name'],
            body: "return `Hello, ${name}!`;",
            isExport: false  // Don't use ES module exports for validation
          },
          {
            name: 'goodbye',
            params: ['name'],
            body: "return `Goodbye, ${name}!`;",
            isExport: false  // Don't use ES module exports for validation
          }
        ]
        // Remove exports to avoid ES module syntax that Function constructor can't validate
      });

      // Validate the generated code
      const validationResult = await validateTool.execute({
        code: moduleResult.code
      });

      expect(validationResult.valid).toBe(true);

      // Save to file
      const filePath = path.join(testDir, moduleResult.filename);
      await fs.writeFile(filePath, moduleResult.code);

      // Verify file exists and can be read
      const savedContent = await fs.readFile(filePath, 'utf8');
      expect(savedContent).toBe(moduleResult.code);
    });
  });
});