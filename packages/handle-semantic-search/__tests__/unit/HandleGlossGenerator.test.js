/**
 * Unit tests for HandleGlossGenerator
 * Phase 2, Step 2.3: Gloss generator with prompt selection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HandleGlossGenerator } from '../../src/HandleGlossGenerator.js';

describe('HandleGlossGenerator', () => {
  let generator;
  let mockLlmClient;

  beforeEach(() => {
    // Create mock LLM client
    mockLlmClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        glosses: [
          {
            perspective: 'functional',
            description: 'A filesystem resource that provides access to files and directories for reading and writing data',
            keywords: ['file', 'directory', 'storage', 'data']
          },
          {
            perspective: 'contextual',
            description: 'Part of the file storage system used by applications to persist and retrieve information from disk',
            keywords: ['storage', 'persistence', 'filesystem']
          }
        ]
      }))
    };

    generator = new HandleGlossGenerator(mockLlmClient);
  });

  describe('Constructor', () => {
    it('should create an instance with LLM client', () => {
      expect(generator).toBeInstanceOf(HandleGlossGenerator);
      expect(generator.llmClient).toBe(mockLlmClient);
    });

    it('should throw error without LLM client', () => {
      expect(() => new HandleGlossGenerator()).toThrow('LLM client is required');
    });

    it('should initialize with empty prompt registry', () => {
      expect(generator.promptRegistry).toBeNull();
      expect(generator.prompts).toBeInstanceOf(Map);
      expect(generator.prompts.size).toBe(0);
    });
  });

  describe('Initialization', () => {
    it('should initialize and load prompts', async () => {
      await generator.initialize();

      expect(generator.promptRegistry).toBeDefined();
      expect(generator.prompts.size).toBeGreaterThan(0);
    });

    it('should load filesystem prompt', async () => {
      await generator.initialize();

      expect(generator.prompts.has('filesystem')).toBe(true);
      const filesystemPrompt = generator.prompts.get('filesystem');
      expect(filesystemPrompt).toBeDefined();
    });

    it('should load generic prompt', async () => {
      await generator.initialize();

      expect(generator.prompts.has('generic')).toBe(true);
      const genericPrompt = generator.prompts.get('generic');
      expect(genericPrompt).toBeDefined();
    });
  });

  describe('Prompt Selection', () => {
    beforeEach(async () => {
      await generator.initialize();
    });

    it('should select filesystem prompt for filesystem handles', () => {
      const prompt = generator.selectPrompt('filesystem');
      expect(prompt).toBeDefined();
      expect(prompt).toBe(generator.prompts.get('filesystem'));
    });

    it('should select generic prompt for unknown handle types', () => {
      const prompt = generator.selectPrompt('unknown-type');
      expect(prompt).toBeDefined();
      expect(prompt).toBe(generator.prompts.get('generic'));
    });

    it('should fall back to generic for unregistered types', () => {
      const prompt = generator.selectPrompt('custom-handle-type');
      expect(prompt).toBe(generator.prompts.get('generic'));
    });

    it('should throw error if generic prompt not found', () => {
      // Clear prompts to simulate missing generic
      generator.prompts.clear();

      expect(() => generator.selectPrompt('any-type')).toThrow('Generic prompt not found');
    });
  });
});