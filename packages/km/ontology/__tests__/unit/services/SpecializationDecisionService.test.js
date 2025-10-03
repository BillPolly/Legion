/**
 * SpecializationDecisionService Unit Tests
 *
 * Tests specialization decision logic with mocked dependencies
 */

import { jest } from '@jest/globals';
import { SpecializationDecisionService } from '../../../src/services/SpecializationDecisionService.js';

describe('SpecializationDecisionService', () => {
  let service;
  let mockLLMClient;

  beforeEach(() => {
    mockLLMClient = {
      request: jest.fn(),
      complete: jest.fn(),
    };

    service = new SpecializationDecisionService(mockLLMClient);
  });

  describe('constructor', () => {
    test('should initialize with llmClient', () => {
      expect(service.llmClient).toBe(mockLLMClient);
    });

    test('should throw error if llmClient is missing', () => {
      expect(() => new SpecializationDecisionService(null))
        .toThrow('LLM client is required');
    });
  });

  describe('decide', () => {
    // Note: decide() uses TemplatedPrompt which requires file I/O and real LLM
    // Full functionality tested in integration tests

    test('should be a function', () => {
      expect(typeof service.decide).toBe('function');
    });

    test('should be async', () => {
      const candidate = {
        sentence: 'test',
        type: 'property',
        implied: { name: 'test' },
        existing: { label: 'test', definedIn: 'test', inheritanceDistance: 1 }
      };
      const result = service.decide(candidate);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
