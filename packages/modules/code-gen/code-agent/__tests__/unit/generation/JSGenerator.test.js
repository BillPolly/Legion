/**
 * Tests for JSGenerator
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { JSGenerator } from '../../../src/generation/JSGenerator.js';

describe('JSGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new JSGenerator();
  });

  describe('Constructor', () => {
    test('should create generator with default config', () => {
      expect(generator.config.target).toBe('es2020');
      expect(generator.config.moduleSystem).toBe('esm');
      expect(generator.config.semicolons).toBe(true);
      expect(generator.config.quotes).toBe('single');
    });

    test('should create generator with custom config', () => {
      const customGenerator = new JSGenerator({
        target: 'es2022',
        semicolons: false,
        quotes: 'double'
      });
      
      expect(customGenerator.config.target).toBe('es2022');
      expect(customGenerator.config.semicolons).toBe(false);
      expect(customGenerator.config.quotes).toBe('double');
    });
  });

  describe('generateModule', () => {
    test('should generate simple module', async () => {
      const spec = {
        name: 'testModule',
        description: 'Test module',
        functions: [{
          name: 'hello',
          params: [],
          body: 'return "Hello World";'
        }]
      };

      const result = await generator.generateModule(spec);
      
      expect(result).toContain('function hello()');
      expect(result).toContain('return "Hello World";');
    });

    test('should generate module with imports and exports', async () => {
      const spec = {
        imports: [
          { default: 'express', from: 'express' },
          { named: ['readFile', 'writeFile'], from: 'fs' }
        ],
        functions: [{
          name: 'startServer',
          params: [],
          body: 'const app = express();\nreturn app;'
        }],
        exports: { named: ['startServer'] }
      };

      const result = await generator.generateModule(spec);
      
      expect(result).toContain("import express from 'express';");
      expect(result).toContain("import { readFile, writeFile } from 'fs';");
      expect(result).toContain('export { startServer };');
    });

    test('should generate module with constants', async () => {
      const spec = {
        constants: {
          API_URL: 'https://api.example.com',
          MAX_RETRIES: 3
        }
      };

      const result = await generator.generateModule(spec);
      
      expect(result).toContain("const API_URL = 'https://api.example.com';");
      expect(result).toContain('const MAX_RETRIES = 3;');
    });

    test('should include header when specified', async () => {
      const spec = {
        description: 'User service module',
        author: 'Test Author'
      };

      const result = await generator.generateModule(spec);
      
      expect(result).toContain('User service module');
      expect(result).toContain('@author Test Author');
    });

    test('should throw error for invalid spec', async () => {
      await expect(generator.generateModule(null)).rejects.toThrow('Invalid JS spec');
    });
  });

  describe('generateFunction', () => {
    test('should generate simple function', async () => {
      const functionSpec = {
        name: 'add',
        params: ['a', 'b'],
        body: 'return a + b;'
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain('function add(a, b)');
      expect(result).toContain('return a + b;');
    });

    test('should generate async function', async () => {
      const functionSpec = {
        name: 'fetchData',
        params: ['url'],
        isAsync: true,
        body: 'const response = await fetch(url);\nreturn response.json();'
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain('async function fetchData(url)');
      expect(result).toContain('await fetch(url)');
    });

    test('should generate arrow function', async () => {
      const functionSpec = {
        name: 'multiply',
        params: ['x', 'y'],
        isArrow: true,
        body: 'x * y'
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain('const multiply = (x, y) => x * y;');
    });

    test('should generate function with JSDoc', async () => {
      const functionSpec = {
        name: 'processUser',
        params: [{ name: 'user', type: 'Object' }],
        returnType: 'Promise<User>',
        jsdoc: {
          description: 'Process user data',
          returns: 'Processed user object'
        },
        body: 'return user;'
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain('/**');
      expect(result).toContain('Process user data');
      expect(result).toContain('@param {Object} user');
      expect(result).toContain('@returns {Promise<User>}');
    });

    test('should generate function with default parameters', async () => {
      const functionSpec = {
        name: 'greet',
        params: [
          { name: 'name', default: "'World'" }
        ],
        body: 'return `Hello ${name}!`;'
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain("function greet(name = 'World')");
    });
  });

  describe('generateClass', () => {
    test('should generate simple class', async () => {
      const classSpec = {
        name: 'User',
        constructor: {
          params: ['name', 'email'],
          body: 'this.name = name;\nthis.email = email;'
        }
      };

      const result = await generator.generateClass(classSpec);
      
      expect(result).toContain('class User {');
      expect(result).toContain('constructor(name, email)');
      expect(result).toContain('this.name = name;');
    });

    test('should generate class with inheritance', async () => {
      const classSpec = {
        name: 'AdminUser',
        extends: 'User',
        constructor: {
          params: ['name', 'email', 'role'],
          body: 'super(name, email);\nthis.role = role;'
        }
      };

      const result = await generator.generateClass(classSpec);
      
      expect(result).toContain('class AdminUser extends User');
      expect(result).toContain('super(name, email)');
    });

    test('should generate class with methods', async () => {
      const classSpec = {
        name: 'Calculator',
        methods: [
          {
            name: 'add',
            params: ['a', 'b'],
            body: 'return a + b;'
          },
          {
            name: 'multiply',
            params: ['a', 'b'],
            body: 'return a * b;'
          }
        ]
      };

      const result = await generator.generateClass(classSpec);
      
      expect(result).toContain('add(a, b)');
      expect(result).toContain('multiply(a, b)');
    });

    test('should generate class with static methods', async () => {
      const classSpec = {
        name: 'MathUtils',
        staticMethods: [
          {
            name: 'square',
            params: ['n'],
            body: 'return n * n;'
          }
        ]
      };

      const result = await generator.generateClass(classSpec);
      
      expect(result).toContain('static');
      expect(result).toContain('square(n)');
    });

    test('should generate class with properties', async () => {
      const classSpec = {
        name: 'Config',
        properties: [
          { name: 'version', value: '1.0.0' },
          { name: 'debug', value: false, static: true }
        ]
      };

      const result = await generator.generateClass(classSpec);
      
      expect(result).toContain("version = '1.0.0';");
      expect(result).toContain('static debug = false;');
    });
  });

  describe('generateAPIEndpoint', () => {
    test('should generate GET endpoint', async () => {
      const endpointSpec = {
        method: 'GET',
        path: '/users',
        handler: 'const users = await db.getUsers();',
        response: '{ users }'
      };

      const result = await generator.generateAPIEndpoint(endpointSpec);
      
      expect(result).toContain('async function handleGETUsers');
      expect(result).toContain('const users = await db.getUsers();');
      expect(result).toContain('res.json({ users });');
    });

    test('should generate POST endpoint with validation', async () => {
      const endpointSpec = {
        method: 'POST',
        path: '/users',
        validation: 'const { name, email } = req.body;',
        handler: 'const user = await db.createUser({ name, email });',
        response: '{ user }'
      };

      const result = await generator.generateAPIEndpoint(endpointSpec);
      
      expect(result).toContain('async function handlePOSTUsers');
      expect(result).toContain('// Request validation');
      expect(result).toContain('const { name, email } = req.body;');
    });

    test('should generate endpoint with error handling', async () => {
      const endpointSpec = {
        method: 'DELETE',
        path: '/users/:id'
      };

      const result = await generator.generateAPIEndpoint(endpointSpec);
      
      expect(result).toContain('try {');
      expect(result).toContain('} catch (error) {');
      expect(result).toContain('res.status(500).json({ error: error.message });');
    });
  });

  describe('generateEventHandler', () => {
    test('should generate click event handler', async () => {
      const handlerSpec = {
        element: 'button',
        event: 'click',
        action: 'console.log("Button clicked!");'
      };

      const result = await generator.generateEventHandler(handlerSpec);
      
      expect(result).toContain('function handleClick(event)');
      expect(result).toContain('console.log("Button clicked!");');
    });

    test('should generate handler with preventDefault', async () => {
      const handlerSpec = {
        element: 'form',
        event: 'submit',
        preventDefault: true,
        action: 'submitForm();'
      };

      const result = await generator.generateEventHandler(handlerSpec);
      
      expect(result).toContain('event.preventDefault();');
      expect(result).toContain('submitForm();');
    });

    test('should generate handler with stopPropagation', async () => {
      const handlerSpec = {
        element: 'div',
        event: 'click',
        stopPropagation: true,
        action: 'handleDivClick();'
      };

      const result = await generator.generateEventHandler(handlerSpec);
      
      expect(result).toContain('event.stopPropagation();');
    });
  });

  describe('validateSpec', () => {
    test('should validate valid spec', async () => {
      const spec = {
        functions: [{ name: 'test' }],
        classes: [{ name: 'TestClass' }]
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should invalidate spec with missing function names', async () => {
      const spec = {
        functions: [{ params: ['a'] }]
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Function at index 0 missing name');
    });

    test('should invalidate spec with invalid types', async () => {
      const spec = {
        imports: 'invalid',
        functions: 'not-array'
      };

      const result = await generator.validateSpec(spec);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Imports must be an array');
      expect(result.errors).toContain('Functions must be an array');
    });
  });

  describe('Edge cases', () => {
    test('should handle empty function body', async () => {
      const functionSpec = {
        name: 'noop',
        params: [],
        body: ''
      };

      const result = await generator.generateFunction(functionSpec);
      
      expect(result).toContain('function noop()');
      expect(result).toContain('// TODO: Implement function');
    });

    test('should handle complex nested structures', async () => {
      const spec = {
        classes: [{
          name: 'DataProcessor',
          methods: [{
            name: 'process',
            isAsync: true,
            params: ['data'],
            body: [
              'const results = [];',
              'for (const item of data) {',
              '  const processed = await this.processItem(item);',
              '  results.push(processed);',
              '}',
              'return results;'
            ].join('\n')
          }]
        }]
      };

      const result = await generator.generateModule(spec);
      
      expect(result).toContain('async');
      expect(result).toContain('process(data)');
      expect(result).toContain('for (const item of data)');
    });
  });
});