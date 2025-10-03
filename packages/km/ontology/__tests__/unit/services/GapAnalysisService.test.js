/**
 * GapAnalysisService Unit Tests
 *
 * Tests gap analysis logic with mocked dependencies
 */

import { jest } from '@jest/globals';
import { GapAnalysisService } from '../../../src/services/GapAnalysisService.js';

describe('GapAnalysisService', () => {
  let service;
  let mockSubsumptionChecker;
  let mockLLMClient;

  beforeEach(() => {
    mockSubsumptionChecker = {
      checkPropertySubsumption: jest.fn(),
      checkRelationshipSubsumption: jest.fn(),
    };

    mockLLMClient = {
      request: jest.fn(),
      complete: jest.fn(),
    };

    service = new GapAnalysisService(mockSubsumptionChecker, mockLLMClient);
  });

  describe('constructor', () => {
    test('should initialize with required dependencies', () => {
      expect(service.subsumptionChecker).toBe(mockSubsumptionChecker);
      expect(service.llmClient).toBe(mockLLMClient);
    });

    test('should throw error if subsumptionChecker is missing', () => {
      expect(() => new GapAnalysisService(null, mockLLMClient))
        .toThrow('SubsumptionChecker is required');
    });

    test('should throw error if llmClient is missing', () => {
      expect(() => new GapAnalysisService(mockSubsumptionChecker, null))
        .toThrow('LLM client is required');
    });
  });

  describe('extractImpliedTypes', () => {
    // Note: Uses TemplatedPrompt which requires file I/O and real LLM
    // Full functionality tested in integration tests

    test('should be a function', () => {
      expect(typeof service.extractImpliedTypes).toBe('function');
    });
  });

  describe('analyzeGaps', () => {
    // Note: analyzeGaps calls extractImpliedTypes which uses TemplatedPrompt
    // These tests would require complex mocking, so we focus on integration tests
    // Unit tests focus on verifying the method exists and has correct signature

    test('should be a function', () => {
      expect(typeof service.analyzeGaps).toBe('function');
    });

    test('should be async', () => {
      const result = service.analyzeGaps('test', []);
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
