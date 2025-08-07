/**
 * Unit tests for LLM integration components
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createLLMProvider } from '../../src/factories/AgentFactory.js';
import { config } from '../../src/runtime/config/index.js';

describe('LLM Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LLM Provider Creation', () => {
    test('should create LLM provider based on configuration', () => {
      // Mock config to return anthropic as available
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.provider') return 'anthropic';
        if (key === 'llm.anthropic') return { 
          apiKey: 'test-key',
          model: 'claude-3-haiku-20240307'
        };
        return {};
      });
      
      const provider = createLLMProvider();
      expect(provider).toBeDefined();
      expect(provider.provider).toBe('anthropic');
    });

    test('should return null if no API keys available', () => {
      // Mock config to return no available providers
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue([]);
      
      const provider = createLLMProvider();
      expect(provider).toBeNull();
    });

    test('should warn when selected provider is not available', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['openai']);
      jest.spyOn(config, 'get').mockReturnValue('anthropic');
      
      const provider = createLLMProvider();
      
      expect(provider).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("LLM provider 'anthropic' not available")
      );
      
      warnSpy.mockRestore();
    });
  });

  describe('Provider Selection', () => {
    test('should select anthropic when explicitly specified', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic', 'openai']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.anthropic') return { 
          apiKey: 'test-key',
          model: 'claude-3-haiku-20240307'
        };
        return {};
      });
      
      const provider = createLLMProvider('anthropic');
      expect(provider).toBeDefined();
      expect(provider.provider).toBe('anthropic');
    });

    test('should select openai when explicitly specified', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic', 'openai']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.openai') return { 
          apiKey: 'test-key',
          model: 'gpt-3.5-turbo'
        };
        return {};
      });
      
      const provider = createLLMProvider('openai');
      expect(provider).toBeDefined();
      expect(provider.provider).toBe('openai');
    });

    test('should fallback to available provider when preferred is not available', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['openai']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.provider') return 'anthropic';
        if (key === 'llm.openai') return { 
          apiKey: 'test-key',
          model: 'gpt-3.5-turbo'
        };
        return {};
      });
      
      const provider = createLLMProvider();
      expect(provider).toBeNull(); // Because anthropic is not available
    });
  });

  describe('Provider Methods', () => {
    test('should have required methods', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.provider') return 'anthropic';
        if (key === 'llm.anthropic') return { 
          apiKey: 'test-key',
          model: 'claude-3-haiku-20240307'
        };
        return {};
      });
      
      const provider = createLLMProvider();
      
      expect(provider).toHaveProperty('complete');
      expect(provider).toHaveProperty('getTokenUsage');
      expect(provider).toHaveProperty('resetTokenUsage');
      expect(provider).toHaveProperty('cleanup');
      expect(typeof provider.complete).toBe('function');
      expect(typeof provider.getTokenUsage).toBe('function');
      expect(typeof provider.resetTokenUsage).toBe('function');
      expect(typeof provider.cleanup).toBe('function');
    });

    test('should track token usage', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.provider') return 'anthropic';
        if (key === 'llm.anthropic') return { 
          apiKey: 'test-key',
          model: 'claude-3-haiku-20240307'
        };
        return {};
      });
      
      const provider = createLLMProvider();
      
      const initialUsage = provider.getTokenUsage();
      expect(initialUsage).toEqual({
        input: 0,
        output: 0,
        total: 0
      });
      
      // Reset should work
      provider.resetTokenUsage();
      const afterReset = provider.getTokenUsage();
      expect(afterReset).toEqual({
        input: 0,
        output: 0,
        total: 0
      });
    });

    test('should cleanup properly', () => {
      jest.spyOn(config, 'getAvailableLLMProviders').mockReturnValue(['anthropic']);
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'llm.provider') return 'anthropic';
        if (key === 'llm.anthropic') return { 
          apiKey: 'test-key',
          model: 'claude-3-haiku-20240307'
        };
        return {};
      });
      
      const provider = createLLMProvider();
      
      // Should not throw
      expect(() => provider.cleanup()).not.toThrow();
      
      // Token usage should be reset after cleanup
      const usage = provider.getTokenUsage();
      expect(usage.total).toBe(0);
    });
  });
});