/**
 * Unit tests for PromptRegistry class
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import PromptRegistry from '../../src/PromptRegistry.js';
import TemplatedPrompt from '../../src/TemplatedPrompt.js';

describe('PromptRegistry', () => {
  let registry;
  let tempDir;

  beforeEach(async () => {
    registry = new PromptRegistry();
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `prompt-registry-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    it('should create an empty registry', () => {
      expect(registry.prompts).toBeInstanceOf(Map);
      expect(registry.prompts.size).toBe(0);
      expect(registry.directories).toEqual([]);
    });
  });

  describe('addDirectory', () => {
    it('should add a directory to the list', () => {
      registry.addDirectory('/path/to/prompts');
      expect(registry.directories).toContain('/path/to/prompts');
    });

    it('should add multiple directories', () => {
      registry.addDirectory('/path/one');
      registry.addDirectory('/path/two');
      expect(registry.directories).toEqual(['/path/one', '/path/two']);
    });

    it('should throw error for invalid directory', () => {
      expect(() => registry.addDirectory()).toThrow('Directory must be a non-empty string');
      expect(() => registry.addDirectory('')).toThrow('Directory must be a non-empty string');
      expect(() => registry.addDirectory(null)).toThrow('Directory must be a non-empty string');
    });
  });

  describe('register', () => {
    it('should register a prompt from string template', () => {
      const prompt = registry.register('greeting', 'Hello {{name}}!');
      
      expect(prompt).toBeInstanceOf(TemplatedPrompt);
      expect(prompt.template).toBe('Hello {{name}}!');
      expect(prompt.name).toBe('greeting');
      expect(registry.has('greeting')).toBe(true);
    });

    it('should register an existing TemplatedPrompt instance', () => {
      const existingPrompt = new TemplatedPrompt('Test {{var}}', { name: 'test' });
      const registered = registry.register('myPrompt', existingPrompt);
      
      expect(registered).toBe(existingPrompt);
      expect(registry.get('myPrompt')).toBe(existingPrompt);
    });

    it('should pass options when creating prompt', () => {
      const prompt = registry.register('custom', 'Template', {
        maxRetries: 5,
        temperature: 0.5
      });
      
      expect(prompt.maxRetries).toBe(5);
      expect(prompt.temperature).toBe(0.5);
    });

    it('should throw error for invalid name', () => {
      expect(() => registry.register()).toThrow('Name must be a non-empty string');
      expect(() => registry.register('')).toThrow('Name must be a non-empty string');
      expect(() => registry.register(null, 'template')).toThrow('Name must be a non-empty string');
    });
  });

  describe('get, has, remove', () => {
    beforeEach(() => {
      registry.register('prompt1', 'Template 1');
      registry.register('prompt2', 'Template 2');
    });

    it('should get a registered prompt', () => {
      const prompt = registry.get('prompt1');
      expect(prompt).toBeInstanceOf(TemplatedPrompt);
      expect(prompt.template).toBe('Template 1');
    });

    it('should return undefined for non-existent prompt', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should check if prompt exists', () => {
      expect(registry.has('prompt1')).toBe(true);
      expect(registry.has('prompt2')).toBe(true);
      expect(registry.has('prompt3')).toBe(false);
    });

    it('should remove a prompt', () => {
      expect(registry.remove('prompt1')).toBe(true);
      expect(registry.has('prompt1')).toBe(false);
      expect(registry.remove('prompt1')).toBe(false); // Already removed
    });
  });

  describe('clear', () => {
    it('should clear all prompts and directories', () => {
      registry.register('prompt1', 'Template 1');
      registry.register('prompt2', 'Template 2');
      registry.addDirectory('/path/to/prompts');
      
      registry.clear();
      
      expect(registry.prompts.size).toBe(0);
      expect(registry.directories).toEqual([]);
    });
  });

  describe('getNames and getAll', () => {
    beforeEach(() => {
      registry.register('alpha', 'Template A');
      registry.register('beta', 'Template B');
      registry.register('gamma', 'Template C');
    });

    it('should get all prompt names', () => {
      const names = registry.getNames();
      expect(names).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('should get all prompts', () => {
      const prompts = registry.getAll();
      expect(prompts).toHaveLength(3);
      expect(prompts.every(p => p instanceof TemplatedPrompt)).toBe(true);
    });
  });

  describe('loadFile', () => {
    it('should load a single prompt file', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, 'Hello {{world}}!');
      
      const prompt = await registry.loadFile(filePath);
      
      expect(prompt).toBeInstanceOf(TemplatedPrompt);
      expect(prompt.template).toBe('Hello {{world}}!');
      expect(prompt.name).toBe('test');
      expect(registry.has('test')).toBe(true);
    });

    it('should use custom name if provided', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, 'Content');
      
      const prompt = await registry.loadFile(filePath, { name: 'custom-name' });
      
      expect(prompt.name).toBe('custom-name');
      expect(registry.has('custom-name')).toBe(true);
    });

    it('should pass options to prompt', async () => {
      const filePath = path.join(tempDir, 'test.md');
      await fs.writeFile(filePath, 'Content');
      
      const prompt = await registry.loadFile(filePath, {
        maxRetries: 10,
        temperature: 0.3
      });
      
      expect(prompt.maxRetries).toBe(10);
      expect(prompt.temperature).toBe(0.3);
    });
  });

  describe('loadPrompts', () => {
    beforeEach(async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'prompt1.md'), 'Template {{one}}');
      await fs.writeFile(path.join(tempDir, 'prompt2.txt'), 'Template {{two}}');
      await fs.writeFile(path.join(tempDir, 'prompt3.prompt'), 'Template {{three}}');
      await fs.writeFile(path.join(tempDir, 'ignored.json'), '{"ignored": true}');
    });

    it('should load all prompts from directory', async () => {
      registry.addDirectory(tempDir);
      
      const loaded = await registry.loadPrompts();
      
      expect(loaded).toHaveLength(3);
      expect(registry.has('prompt1')).toBe(true);
      expect(registry.has('prompt2')).toBe(true);
      expect(registry.has('prompt3')).toBe(true);
      expect(registry.has('ignored')).toBe(false);
    });

    it('should filter by extensions', async () => {
      registry.addDirectory(tempDir);
      
      const loaded = await registry.loadPrompts({
        extensions: ['.md']
      });
      
      expect(loaded).toHaveLength(1);
      expect(registry.has('prompt1')).toBe(true);
      expect(registry.has('prompt2')).toBe(false);
    });

    it('should apply default options to all prompts', async () => {
      registry.addDirectory(tempDir);
      
      await registry.loadPrompts({
        defaultOptions: {
          maxRetries: 7,
          temperature: 0.2
        }
      });
      
      const prompt1 = registry.get('prompt1');
      expect(prompt1.maxRetries).toBe(7);
      expect(prompt1.temperature).toBe(0.2);
    });

    it('should handle non-existent directory gracefully', async () => {
      registry.addDirectory('/non/existent/path');
      
      const loaded = await registry.loadPrompts();
      
      expect(loaded).toEqual([]);
    });

    it('should load from multiple directories', async () => {
      const tempDir2 = path.join(os.tmpdir(), `prompt-registry-test2-${Date.now()}`);
      await fs.mkdir(tempDir2, { recursive: true });
      await fs.writeFile(path.join(tempDir2, 'prompt4.md'), 'Template {{four}}');
      
      registry.addDirectory(tempDir);
      registry.addDirectory(tempDir2);
      
      const loaded = await registry.loadPrompts();
      
      expect(loaded).toHaveLength(4);
      expect(registry.has('prompt1')).toBe(true);
      expect(registry.has('prompt4')).toBe(true);
      
      // Cleanup
      await fs.rm(tempDir2, { recursive: true, force: true });
    });
  });

  describe('create', () => {
    it('should create and register a prompt', async () => {
      const result = await registry.create('newPrompt', 'Template {{var}}');
      
      expect(result.prompt).toBeInstanceOf(TemplatedPrompt);
      expect(result.prompt.template).toBe('Template {{var}}');
      expect(registry.has('newPrompt')).toBe(true);
      expect(result.filePath).toBeUndefined();
    });

    it('should save to file if requested', async () => {
      registry.addDirectory(tempDir);
      
      const result = await registry.create('saved', 'Saved template', {
        saveToFile: true
      });
      
      expect(result.filePath).toBe(path.join(tempDir, 'saved.md'));
      
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toBe('Saved template');
    });

    it('should use custom extension', async () => {
      registry.addDirectory(tempDir);
      
      const result = await registry.create('custom', 'Content', {
        saveToFile: true,
        extension: '.prompt'
      });
      
      expect(result.filePath).toBe(path.join(tempDir, 'custom.prompt'));
    });

    it('should use specific directory if provided', async () => {
      const altDir = path.join(tempDir, 'alt');
      await fs.mkdir(altDir, { recursive: true });
      
      registry.addDirectory(tempDir);
      
      const result = await registry.create('specific', 'Content', {
        saveToFile: true,
        directory: altDir
      });
      
      expect(result.filePath).toBe(path.join(altDir, 'specific.md'));
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the registry', () => {
      registry.register('prompt1', 'Template 1');
      registry.register('prompt2', 'Template 2');
      registry.addDirectory('/path/one');
      registry.addDirectory('/path/two');
      
      const cloned = registry.clone();
      
      expect(cloned).not.toBe(registry);
      expect(cloned.getNames()).toEqual(['prompt1', 'prompt2']);
      expect(cloned.directories).toEqual(['/path/one', '/path/two']);
      
      // Verify prompts are cloned, not shared
      const original = registry.get('prompt1');
      const clonedPrompt = cloned.get('prompt1');
      expect(clonedPrompt).not.toBe(original);
      expect(clonedPrompt.template).toBe(original.template);
    });
  });

  describe('exportToDirectory', () => {
    beforeEach(() => {
      registry.register('export1', 'Content 1');
      registry.register('export2', 'Content 2');
      registry.register('export3', 'Content 3');
    });

    it('should export all prompts to directory', async () => {
      const exportDir = path.join(tempDir, 'export');
      
      const exported = await registry.exportToDirectory(exportDir);
      
      expect(exported).toHaveLength(3);
      expect(exported[0]).toEqual({
        name: 'export1',
        path: path.join(exportDir, 'export1.md')
      });
      
      // Verify files were created
      const content1 = await fs.readFile(path.join(exportDir, 'export1.md'), 'utf-8');
      expect(content1).toBe('Content 1');
    });

    it('should use custom extension', async () => {
      const exportDir = path.join(tempDir, 'export-custom');
      
      const exported = await registry.exportToDirectory(exportDir, {
        extension: '.txt'
      });
      
      expect(exported[0].path).toBe(path.join(exportDir, 'export1.txt'));
    });

    it('should create directory if it doesn\'t exist', async () => {
      const nonExistentDir = path.join(tempDir, 'new', 'nested', 'dir');
      
      await registry.exportToDirectory(nonExistentDir);
      
      const stats = await fs.stat(nonExistentDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });
});