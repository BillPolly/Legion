/**
 * Unit tests for RequirementParserTool
 */

import { jest } from '@jest/globals';
import { RequirementParserTool } from '../../src/tools/requirements/RequirementParserTool.js';
import { ToolResult } from '@legion/tool-core';

// Mock @legion/tool-core
jest.mock('@legion/tool-core', () => {
  const mockSuccess = jest.fn((data) => ({ success: true, data }));
  const mockFailure = jest.fn((message) => ({ success: false, error: message }));
  
  return {
    Tool: class {
      constructor(config) {
        this.name = config.name;
        this.description = config.description;
        this.inputSchema = config.inputSchema;
      }
      emit(event, data) {
        // Mock emit
      }
    },
    ToolResult: {
      success: mockSuccess,
      failure: mockFailure
    }
  };
});

describe('RequirementParserTool', () => {
  let tool;
  let mockLLMClient;
  let mockDependencies;

  beforeEach(() => {
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
      designDatabase: {},
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
      
      const args = {
        requirementsText: 'The system should allow users to login and respond quickly',
        projectId: 'test-project',
        analysisDepth: 'detailed'
      };
      
      const result = await tool.execute(args);
      
      expect(ToolResult.success).toHaveBeenCalled();
      const successCall = ToolResult.success.mock.calls[0][0];
      
      expect(successCall).toHaveProperty('parsedRequirements');
      expect(successCall.parsedRequirements).toHaveProperty('functional');
      expect(successCall.parsedRequirements.functional).toHaveLength(1);
      expect(successCall).toHaveProperty('summary');
      expect(successCall.summary.functionalCount).toBe(1);
      expect(successCall.summary.nonFunctionalCount).toBe(1);
    });

    it('should handle LLM parsing errors gracefully', async () => {
      mockLLMClient.complete = jest.fn().mockResolvedValue('Invalid JSON response');
      
      tool = new RequirementParserTool(mockDependencies);
      
      const args = {
        requirementsText: 'Test requirements',
        analysisDepth: 'basic'
      };
      
      const result = await tool.execute(args);
      
      expect(ToolResult.success).toHaveBeenCalled();
      const successCall = ToolResult.success.mock.calls[0][0];
      
      // Should create basic structure from fallback
      expect(successCall.parsedRequirements).toHaveProperty('functional');
      expect(successCall.parsedRequirements.functional).toHaveLength(1);
      expect(successCall.parsedRequirements.reasoning).toContain('Failed to parse');
    });

    it('should handle missing LLM client', async () => {
      tool = new RequirementParserTool({ ...mockDependencies, llmClient: null });
      mockDependencies.resourceManager.get = jest.fn().mockReturnValue(null);
      
      const args = {
        requirementsText: 'Test requirements'
      };
      
      const result = await tool.execute(args);
      
      expect(ToolResult.failure).toHaveBeenCalled();
      expect(ToolResult.failure.mock.calls[0][0]).toContain('Failed to parse requirements');
    });

    it('should validate parsed requirements', async () => {
      mockLLMClient.complete = jest.fn().mockResolvedValue(JSON.stringify({
        // Invalid structure - missing functional array
        nonFunctional: []
      }));
      
      tool = new RequirementParserTool(mockDependencies);
      
      const args = {
        requirementsText: 'Test requirements'
      };
      
      const result = await tool.execute(args);
      
      expect(ToolResult.failure).toHaveBeenCalled();
      expect(ToolResult.failure.mock.calls[0][0]).toContain('Invalid parsed requirements');
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

    it('should handle malformed JSON with fallback', () => {
      tool = new RequirementParserTool(mockDependencies);
      
      const badResponse = 'This is not JSON at all';
      const parsed = tool.parseLLMResponse(badResponse);
      
      expect(parsed).toHaveProperty('functional');
      expect(parsed.functional).toHaveLength(1);
      expect(parsed.reasoning).toContain('Failed to parse');
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