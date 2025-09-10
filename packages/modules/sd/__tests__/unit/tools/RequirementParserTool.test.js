/**
 * Simplified unit tests for RequirementParserTool
 * Tests core functionality without complex mocking
 */

import { jest } from '@jest/globals';

describe('RequirementParserTool', () => {
  let RequirementParserTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    // Dynamically import to avoid module loading issues
    const module = await import('../../../src/tools/requirements/RequirementParserTool.js');
    RequirementParserTool = module.RequirementParserTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          functional: [
            { id: 'FR001', description: 'User can login', priority: 'high' },
            { id: 'FR002', description: 'User can logout', priority: 'medium' }
          ],
          nonFunctional: [
            { id: 'NFR001', description: 'System must be responsive', category: 'performance' }
          ],
          constraints: ['Must use OAuth2'],
          assumptions: ['Users have email addresses'],
          dependencies: ['Authentication service'],
          reasoning: 'Analyzed requirements text'
        }))
      },
      designDatabase: {
        storeArtifact: jest.fn().mockResolvedValue({ 
          id: 'artifact-123',
          timestamp: new Date().toISOString()
        })
      },
      resourceManager: { get: jest.fn(), set: jest.fn() }
    };

    tool = new RequirementParserTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create RequirementParserTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('parse_requirements');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
      expect(tool.designDatabase).toBe(mockDependencies.designDatabase);
    });
  });

  describe('execute', () => {
    it('should parse requirements successfully', async () => {
      const result = await tool.execute({
        requirementsText: 'As a user, I want to login to the system',
        projectId: 'proj-123'
      });

      expect(result).toHaveProperty('parsedRequirements');
      expect(result.parsedRequirements.functional).toHaveLength(2);
      expect(result).toHaveProperty('artifactId', 'artifact-123');
      expect(result.summary.functionalCount).toBe(2);
    });

    it('should handle LLM errors', async () => {
      mockDependencies.llmClient.complete.mockRejectedValue(new Error('LLM error'));

      await expect(tool.execute({
        requirementsText: 'Test requirements'
      })).rejects.toThrow('Failed to parse requirements: LLM error');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;

      await expect(tool.execute({
        requirementsText: 'Test requirements'
      })).rejects.toThrow('LLM client not available');
    });
  });

  describe('validateParsedRequirements', () => {
    it('should validate correct requirements', () => {
      const result = tool.validateParsedRequirements({
        functional: [
          { id: 'FR001', description: 'Test requirement' }
        ],
        nonFunctional: []
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing ID', () => {
      const result = tool.validateParsedRequirements({
        functional: [
          { description: 'Missing ID' }
        ]
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Functional requirement 0 missing ID');
    });

    it('should detect missing description', () => {
      const result = tool.validateParsedRequirements({
        functional: [
          { id: 'FR001' }
        ]
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Functional requirement 0 missing description');
    });
  });

  describe('buildParsingContext', () => {
    it('should build context with projectId', async () => {
      const context = await tool.buildParsingContext('proj-123');
      
      expect(context).toHaveProperty('projectId', 'proj-123');
      expect(context).toHaveProperty('existingRequirements');
      expect(Array.isArray(context.existingRequirements)).toBe(true);
    });

    it('should handle missing projectId', async () => {
      const context = await tool.buildParsingContext();
      
      expect(context).toHaveProperty('new', true);
    });
  });
});