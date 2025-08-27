/**
 * Unit tests for RequirementParserTool
 */

import { jest } from '@jest/globals';

// Create mock functions at module level - BEFORE any imports
const mockSuccess = jest.fn((data) => ({ success: true, data }));
const mockFailure = jest.fn((message) => ({ success: false, error: message }));

// Mock @legion/tools-registry BEFORE importing
jest.mock('@legion/tools-registry', () => {
  return {
    Tool: class {
      constructor(config) {
        this.name = config.name;
        this.description = config.description;
        this.inputSchema = config.inputSchema;
        // Ensure emit is properly bound
        this.emit = jest.fn();
      }
    },
    ToolResult: {
      success: mockSuccess,
      failure: mockFailure
    }
  };
});

// Import AFTER mocking
import { RequirementParserTool } from '../../src/tools/requirements/RequirementParserTool.js';

describe('RequirementParserTool', () => {
  let tool;
  let mockLLMClient;
  let mockDependencies;

  beforeEach(() => {
    // Reset mocks
    mockSuccess.mockClear();
    mockFailure.mockClear();
    
    mockLLMClient = {
      complete: jest.fn().mockResolvedValue(JSON.stringify({
        functional: [
          {
            id: 'FR-001',
            description: 'User should be able to login',
            priority: 'high',
            category: 'authentication',
            acceptanceCriteria: ['User can enter credentials', 'System validates credentials']
          }
        ],
        nonFunctional: [
          {
            id: 'NFR-001',
            description: 'System should respond within 2 seconds',
            type: 'performance',
            priority: 'medium',
            metric: '2 seconds response time'
          }
        ],
        constraints: [],
        assumptions: [],
        dependencies: [],
        reasoning: 'Clear requirements for authentication system'
      }))
    };

    mockDependencies = {
      llmClient: mockLLMClient,
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ id: 'test-artifact-id' })
      },
      resourceManager: {
        get: jest.fn().mockReturnValue(mockLLMClient)
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create RequirementParserTool instance', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      expect(tool).toBeDefined();
      expect(tool.name).toBe('parse_requirements');
      expect(tool.llmClient).toBe(mockLLMClient);
    });
  });

  describe('execute', () => {
    it('should parse requirements successfully', async () => {
      tool = new RequirementParserTool(mockDependencies);
      
      // Manually add emit method to fix mock issue
      tool.emit = jest.fn();
      
      const args = {
        requirementsText: 'The system should allow users to login and respond quickly',
        projectId: 'test-project',
        analysisDepth: 'detailed'
      };
      
      const result = await tool.execute(args);
      
      // Debug: log result if test fails
      if (result.success !== true) {
        console.log('Test failed with result:', result);
      }
      
      // Test the actual result instead of mocked function calls
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('parsedRequirements');
      expect(result.data.parsedRequirements).toHaveProperty('functional');
      expect(Array.isArray(result.data.parsedRequirements.functional)).toBe(true);
      expect(result.data.parsedRequirements.functional.length).toBeGreaterThan(0);
      expect(result.data).toHaveProperty('summary');
      expect(result.data.summary.functionalCount).toBeGreaterThanOrEqual(0);
      expect(result.data.summary.nonFunctionalCount).toBeGreaterThanOrEqual(0);
    });

    it('should fail fast on LLM parsing errors (no fallbacks)', async () => {
      mockLLMClient.complete = jest.fn().mockResolvedValue('Invalid JSON response');
      
      tool = new RequirementParserTool(mockDependencies);
      
      const args = {
        requirementsText: 'Test requirements',
        analysisDepth: 'basic'
      };
      
      const result = await tool.execute(args);
      
      // Should fail fast - no fallback parsing
      expect(result).toHaveProperty('success', false);
      expect(result.error).toContain('Failed to parse requirements');
    });

    it('should handle missing LLM client', async () => {
      tool = new RequirementParserTool({ ...mockDependencies, llmClient: null });
      mockDependencies.resourceManager.get = jest.fn().mockReturnValue(null);
      
      const args = {
        requirementsText: 'Test requirements'
      };
      
      const result = await tool.execute(args);
      
      // Should fail when no LLM client available
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Failed to parse requirements');
    });

    it('should validate parsed requirements', async () => {
      mockLLMClient.complete = jest.fn().mockResolvedValue(JSON.stringify({
        // Invalid structure - missing functional array
        nonFunctional: []
      }));
      
      tool = new RequirementParserTool(mockDependencies);
      
      // Manually add emit method to fix mock issue
      tool.emit = jest.fn();
      
      const args = {
        requirementsText: 'Test requirements'
      };
      
      const result = await tool.execute(args);
      
      // Should fail validation and return error
      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Invalid parsed requirements');
    });
  });

  describe('createParsingPrompt', () => {
    it('should create comprehensive prompt for analysis', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const prompt = tool.createParsingPrompt(
        'User requirements text',
        'comprehensive',
        { existingRequirements: [] }
      );
      
      expect(prompt).toContain('User requirements text');
      expect(prompt).toContain('comprehensive');
      expect(prompt).toContain('Extract all requirements, constraints, assumptions');
      expect(prompt).toContain('Return ONLY the JSON object');
    });

    it('should include existing context if available', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const prompt = tool.createParsingPrompt(
        'New requirements',
        'detailed',
        { existingRequirements: [{ id: 'FR-000', description: 'Existing' }] }
      );
      
      expect(prompt).toContain('Existing Requirements Context');
      expect(prompt).toContain('FR-000');
    });
  });

  describe('parseLLMResponse', () => {
    it('should parse clean JSON response', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const jsonResponse = '{"functional": [], "nonFunctional": []}';
      const parsed = tool.parseLLMResponse(jsonResponse);
      
      expect(parsed).toHaveProperty('functional');
      expect(parsed).toHaveProperty('nonFunctional');
    });

    it('should extract JSON from markdown code blocks', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const markdownResponse = '```json\n{"functional": [], "nonFunctional": []}\n```';
      const parsed = tool.parseLLMResponse(markdownResponse);
      
      expect(parsed).toHaveProperty('functional');
      expect(parsed).toHaveProperty('nonFunctional');
    });

    it('should throw error on malformed JSON (fail-fast behavior)', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const badResponse = 'This is not JSON at all';
      
      expect(() => tool.parseLLMResponse(badResponse)).toThrow('Failed to parse LLM response as JSON');
    });
  });

  describe('validateParsedRequirements', () => {
    it('should validate correct structure', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const valid = {
        functional: [
          { id: 'FR-001', description: 'Test requirement' }
        ],
        nonFunctional: []
      };
      
      const result = tool.validateParsedRequirements(valid);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing functional array', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const invalid = { nonFunctional: [] };
      const result = tool.validateParsedRequirements(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Functional requirements must be an array');
    });

    it('should detect missing requirement fields', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const invalid = {
        functional: [
          { description: 'Missing ID' },
          { id: 'FR-002' } // Missing description
        ]
      };
      
      const result = tool.validateParsedRequirements(invalid);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });
});