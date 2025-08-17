/**
 * Unit tests for PromptManager
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { PromptManager } from '../../src/PromptManager.js';
import fs from 'fs/promises';
import path from 'path';

describe('PromptManager', () => {
  let promptManager;
  const testTemplatesDir = path.join(process.cwd(), '__tests__', 'test-templates');

  beforeEach(async () => {
    // Create test templates directory
    await fs.mkdir(testTemplatesDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test templates
    try {
      await fs.rm(testTemplatesDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize with default templates directory', () => {
      promptManager = new PromptManager();
      expect(promptManager.templatesDir).toBeDefined();
    });

    it('should initialize with custom templates directory', () => {
      const customDir = '/custom/templates';
      promptManager = new PromptManager(customDir);
      expect(promptManager.templatesDir).toBe(customDir);
    });

    it('should throw error if templates directory is invalid', () => {
      expect(() => new PromptManager('')).toThrow('Templates directory is required');
      expect(() => new PromptManager(null)).toThrow('Templates directory is required');
    });
  });

  describe('template loading', () => {
    it('should load a markdown template from file', async () => {
      const templateContent = `# Test Template

Task: {{task}}

Please complete the following:
- {{requirement1}}
- {{requirement2}}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'test-template.md'),
        templateContent
      );

      promptManager = new PromptManager(testTemplatesDir);
      const template = await promptManager.loadTemplate('test-template');
      
      expect(template).toBe(templateContent);
    });

    it('should cache loaded templates', async () => {
      const templateContent = 'Simple template: {{value}}';
      const templatePath = path.join(testTemplatesDir, 'cached.md');
      
      await fs.writeFile(templatePath, templateContent);

      promptManager = new PromptManager(testTemplatesDir);
      
      // Load twice
      const template1 = await promptManager.loadTemplate('cached');
      const template2 = await promptManager.loadTemplate('cached');
      
      expect(template1).toBe(template2);
      expect(promptManager.templateCache.has('cached')).toBe(true);
    });

    it('should throw error if template not found', async () => {
      promptManager = new PromptManager(testTemplatesDir);
      
      await expect(promptManager.loadTemplate('non-existent'))
        .rejects.toThrow('Template not found: non-existent');
    });

    it('should handle .md extension in template name', async () => {
      const templateContent = 'Template content';
      await fs.writeFile(
        path.join(testTemplatesDir, 'with-extension.md'),
        templateContent
      );

      promptManager = new PromptManager(testTemplatesDir);
      
      // Should work with and without extension
      const template1 = await promptManager.loadTemplate('with-extension');
      const template2 = await promptManager.loadTemplate('with-extension.md');
      
      expect(template1).toBe(templateContent);
      expect(template2).toBe(templateContent);
    });
  });

  describe('template rendering', () => {
    beforeEach(async () => {
      promptManager = new PromptManager(testTemplatesDir);
    });

    it('should render template with simple placeholders', async () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      await fs.writeFile(
        path.join(testTemplatesDir, 'simple.md'),
        template
      );

      const result = await promptManager.render('simple', {
        name: 'Alice',
        place: 'Wonderland'
      });

      expect(result).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should render template with missing placeholders as empty', async () => {
      const template = 'Name: {{name}}, Age: {{age}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'partial.md'),
        template
      );

      const result = await promptManager.render('partial', {
        name: 'Bob'
      });

      expect(result).toBe('Name: Bob, Age: ');
    });

    it('should handle complex multiline templates', async () => {
      const template = `# {{title}}

## Description
{{description}}

## Requirements
{{#requirements}}
- {{.}}
{{/requirements}}

## Context
Domain: {{context.domain}}
Parent: {{context.parent}}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'complex.md'),
        template
      );

      const result = await promptManager.render('complex', {
        title: 'Build API',
        description: 'Create a REST API for the application',
        requirements: ['Authentication', 'Database', 'Testing'],
        context: {
          domain: 'web-development',
          parent: 'Main Application'
        }
      });

      expect(result).toContain('# Build API');
      expect(result).toContain('Create a REST API');
      expect(result).toContain('- Authentication');
      expect(result).toContain('- Database');
      expect(result).toContain('- Testing');
      expect(result).toContain('Domain: web-development');
      expect(result).toContain('Parent: Main Application');
    });

    it('should handle array iteration with {{#array}}', async () => {
      const template = `Tasks:
{{#tasks}}
- ID: {{id}}, Description: {{description}}
{{/tasks}}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'array.md'),
        template
      );

      const result = await promptManager.render('array', {
        tasks: [
          { id: '1', description: 'First task' },
          { id: '2', description: 'Second task' }
        ]
      });

      expect(result).toContain('- ID: 1, Description: First task');
      expect(result).toContain('- ID: 2, Description: Second task');
    });

    it('should handle conditional sections with {{#condition}}', async () => {
      const template = `Status:
{{#hasError}}
Error: {{errorMessage}}
{{/hasError}}
{{#success}}
Success!
{{/success}}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'conditional.md'),
        template
      );

      // Test with error
      const result1 = await promptManager.render('conditional', {
        hasError: true,
        errorMessage: 'Something went wrong',
        success: false
      });

      expect(result1).toContain('Error: Something went wrong');
      expect(result1).not.toContain('Success!');

      // Test with success
      const result2 = await promptManager.render('conditional', {
        hasError: false,
        success: true
      });

      expect(result2).not.toContain('Error:');
      expect(result2).toContain('Success!');
    });

    it('should escape special characters when needed', async () => {
      const template = 'Code: {{code}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'escape.md'),
        template
      );

      const result = await promptManager.render('escape', {
        code: 'const obj = { key: "value" };'
      });

      expect(result).toBe('Code: const obj = { key: "value" };');
    });

    it('should support nested object access', async () => {
      const template = 'User: {{user.name}} ({{user.email}})';
      await fs.writeFile(
        path.join(testTemplatesDir, 'nested.md'),
        template
      );

      const result = await promptManager.render('nested', {
        user: {
          name: 'John Doe',
          email: 'john@example.com'
        }
      });

      expect(result).toBe('User: John Doe (john@example.com)');
    });
  });

  describe('template validation', () => {
    beforeEach(async () => {
      promptManager = new PromptManager(testTemplatesDir);
    });

    it('should validate template syntax', async () => {
      const validTemplate = 'Hello {{name}}!';
      const invalidTemplate = 'Hello {{name}!'; // Missing closing }}

      await fs.writeFile(
        path.join(testTemplatesDir, 'valid.md'),
        validTemplate
      );
      await fs.writeFile(
        path.join(testTemplatesDir, 'invalid.md'),
        invalidTemplate
      );

      // Valid template should work
      await expect(promptManager.validateTemplate('valid')).resolves.toBe(true);

      // Invalid template should throw
      await expect(promptManager.validateTemplate('invalid'))
        .rejects.toThrow('Invalid template syntax');
    });

    it('should extract placeholder names from template', async () => {
      const template = `Name: {{name}}
Age: {{age}}
Address: {{address.street}}, {{address.city}}
{{#items}}
- {{description}}
{{/items}}`;

      await fs.writeFile(
        path.join(testTemplatesDir, 'placeholders.md'),
        template
      );

      const placeholders = await promptManager.extractPlaceholders('placeholders');

      expect(placeholders).toContain('name');
      expect(placeholders).toContain('age');
      expect(placeholders).toContain('address.street');
      expect(placeholders).toContain('address.city');
      expect(placeholders).toContain('items');
      expect(placeholders).toContain('description');
    });
  });

  describe('built-in templates', () => {
    it('should register built-in templates', () => {
      promptManager = new PromptManager(testTemplatesDir);
      
      promptManager.registerBuiltInTemplate('greeting', 'Hello {{name}}!');
      
      expect(promptManager.builtInTemplates.has('greeting')).toBe(true);
    });

    it('should render built-in templates without file', async () => {
      promptManager = new PromptManager(testTemplatesDir);
      
      promptManager.registerBuiltInTemplate('test', 'Value: {{value}}');
      
      const result = await promptManager.render('test', { value: 42 });
      expect(result).toBe('Value: 42');
    });

    it('should prefer file templates over built-in', async () => {
      promptManager = new PromptManager(testTemplatesDir);
      
      // Register built-in
      promptManager.registerBuiltInTemplate('override', 'Built-in: {{value}}');
      
      // Create file with same name
      await fs.writeFile(
        path.join(testTemplatesDir, 'override.md'),
        'File: {{value}}'
      );
      
      const result = await promptManager.render('override', { value: 'test' });
      expect(result).toBe('File: test');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      promptManager = new PromptManager(testTemplatesDir);
    });

    it('should throw error for invalid parameters object', async () => {
      await fs.writeFile(
        path.join(testTemplatesDir, 'test.md'),
        'Hello {{name}}'
      );

      // null and undefined should work (default to empty object)
      await expect(promptManager.render('test', null)).resolves.toBe('Hello ');
      await expect(promptManager.render('test', undefined)).resolves.toBe('Hello ');
      
      // But non-object types should throw
      await expect(promptManager.render('test', 'invalid'))
        .rejects.toThrow('Parameters must be an object');
      
      await expect(promptManager.render('test', 123))
        .rejects.toThrow('Parameters must be an object');
      
      await expect(promptManager.render('test', []))
        .rejects.toThrow('Parameters must be an object');
    });

    it('should handle file read errors gracefully', async () => {
      // Create a directory instead of file to trigger read error
      await fs.mkdir(path.join(testTemplatesDir, 'not-a-file.md'));

      await expect(promptManager.loadTemplate('not-a-file'))
        .rejects.toThrow(/Failed to load template/);
    });
  });

  describe('template helpers', () => {
    beforeEach(async () => {
      promptManager = new PromptManager(testTemplatesDir);
    });

    it('should support JSON stringify helper', async () => {
      const template = 'Data: {{json data}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'json.md'),
        template
      );

      const result = await promptManager.render('json', {
        data: { key: 'value', number: 42 }
      });

      expect(result).toBe('Data: {"key":"value","number":42}');
    });

    it('should support uppercase helper', async () => {
      const template = 'Name: {{upper name}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'upper.md'),
        template
      );

      const result = await promptManager.render('upper', {
        name: 'john doe'
      });

      expect(result).toBe('Name: JOHN DOE');
    });

    it('should support lowercase helper', async () => {
      const template = 'Name: {{lower name}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'lower.md'),
        template
      );

      const result = await promptManager.render('lower', {
        name: 'JOHN DOE'
      });

      expect(result).toBe('Name: john doe');
    });

    it('should support join helper for arrays', async () => {
      const template = 'Items: {{join items ", "}}';
      await fs.writeFile(
        path.join(testTemplatesDir, 'join.md'),
        template
      );

      const result = await promptManager.render('join', {
        items: ['apple', 'banana', 'orange']
      });

      expect(result).toBe('Items: apple, banana, orange');
    });
  });
});