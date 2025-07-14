/**
 * Tests for GenericLLMPlanner class
 * 
 * This test suite verifies the GenericLLMPlanner works correctly with
 * different configurations and can replace the specialized planners.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { GenericLLMPlanner } from '../../../../src/planning/llm/GenericLLMPlanner.js';
import { PlannerFactory } from '../../../../src/planning/llm/PlannerFactory.js';
import { RequirementAnalyzerConfig } from '../../../../src/planning/llm/configs/RequirementAnalyzerConfig.js';

describe('GenericLLMPlanner', () => {
  let mockLLMClient;
  let mockLLMPlanner;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn(),
      completeWithStructuredResponse: jest.fn()
    };
  });

  describe('Constructor', () => {
    test('should create GenericLLMPlanner with valid config', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      
      expect(planner).toBeDefined();
      expect(planner.getName()).toBe('RequirementAnalyzer');
      expect(planner.getConfig()).toBe(RequirementAnalyzerConfig);
    });

    test('should throw error without LLM client', () => {
      expect(() => {
        new GenericLLMPlanner(null, RequirementAnalyzerConfig);
      }).toThrow('LLM client is required');
    });

    test('should throw error without config', () => {
      expect(() => {
        new GenericLLMPlanner(mockLLMClient, null);
      }).toThrow('Planner configuration is required');
    });
  });

  describe('execute', () => {
    test('should execute RequirementAnalyzer planning', async () => {
      // Mock successful LLM response
      const mockResponse = {
        task: 'Create a todo list application',
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['form', 'list'],
            technologies: ['html', 'javascript', 'css']
          }
        },
        complexity: 'low',
        suggestedArchitecture: {
          pattern: 'simple',
          structure: {
            frontend: ['index.html', 'style.css', 'script.js']
          }
        },
        summary: 'Project Type: frontend\\nComplexity: low complexity\\nFrontend: form, list',
        timestamp: 1234567890
      };

      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockResponse);

      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const input = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      };

      const result = await planner.execute(input);

      expect(result).toBeDefined();
      expect(result.task).toBe(input.task);
      expect(result.projectType).toBe('frontend');
      expect(result.components.frontend.features).toContain('form');
      expect(result.components.frontend.features).toContain('list');
      expect(result.metadata.planner).toBe('RequirementAnalyzer');
      expect(result.metadata.plannedAt).toBeDefined();
    });

    test('should handle string response with JSON blocks', async () => {
      const mockStringResponse = `Here's the analysis:

\`\`\`json
{
  "task": "Create a todo list application",
  "projectType": "frontend",
  "components": {
    "frontend": {
      "features": ["form", "list"],
      "technologies": ["html", "javascript", "css"]
    }
  },
  "complexity": "low",
  "timestamp": 1234567890
}
\`\`\`

This is a simple frontend project.`;

      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockStringResponse);

      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const input = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos'
        }
      };

      const result = await planner.execute(input);

      expect(result.task).toBe(input.task);
      expect(result.projectType).toBe('frontend');
      expect(result.components.frontend.features).toContain('form');
    });

    test('should throw error for invalid response format', async () => {
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue('Invalid response');

      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const input = {
        task: 'Create a todo list application'
      };

      await expect(planner.execute(input)).rejects.toThrow('Response parsing failed');
    });

    test('should throw error for response validation failure', async () => {
      // Mock response missing required fields
      const invalidResponse = {
        task: 'Create a todo list application',
        // Missing required fields like projectType, components, etc.
      };

      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(invalidResponse);

      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const input = {
        task: 'Create a todo list application'
      };

      await expect(planner.execute(input)).rejects.toThrow('Invalid response format');
    });
  });

  describe('getMockResponse', () => {
    test('should return mock response for valid scenario', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const mockResponse = planner.getMockResponse('simple-frontend');

      expect(mockResponse).toBeDefined();
      expect(mockResponse.task).toBe('Create a todo list application');
      expect(mockResponse.projectType).toBe('frontend');
      expect(mockResponse.metadata.planner).toBe('RequirementAnalyzer');
      expect(mockResponse.metadata.mockScenario).toBe('simple-frontend');
    });

    test('should throw error for invalid scenario', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      
      expect(() => {
        planner.getMockResponse('invalid-scenario');
      }).toThrow('Mock response not found for scenario: invalid-scenario');
    });
  });

  describe('validateInput', () => {
    test('should validate RequirementAnalyzer input', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      
      const validInput = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos'
        }
      };

      const result = planner.validateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject input without task', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      
      const invalidInput = {
        requirements: {
          frontend: 'HTML form for adding todos'
        }
      };

      const result = planner.validateInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Task description is required');
    });

    test('should reject null input', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      
      const result = planner.validateInput(null);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Input is required');
    });
  });

  describe('getExamples', () => {
    test('should return examples from config', () => {
      const planner = new GenericLLMPlanner(mockLLMClient, RequirementAnalyzerConfig);
      const examples = planner.getExamples();

      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]).toHaveProperty('input');
      expect(examples[0]).toHaveProperty('expectedOutput');
    });
  });
});

describe('PlannerFactory', () => {
  let mockLLMClient;

  beforeEach(() => {
    mockLLMClient = {
      generateResponse: jest.fn(),
      completeWithStructuredResponse: jest.fn()
    };
  });

  describe('createRequirementAnalyzer', () => {
    test('should create RequirementAnalyzer planner', () => {
      const planner = PlannerFactory.createRequirementAnalyzer(mockLLMClient);
      
      expect(planner).toBeInstanceOf(GenericLLMPlanner);
      expect(planner.getName()).toBe('RequirementAnalyzer');
    });
  });

  describe('createPlannerByType', () => {
    test('should create RequirementAnalyzer by type', () => {
      const planner = PlannerFactory.createPlannerByType('requirement', mockLLMClient);
      
      expect(planner).toBeInstanceOf(GenericLLMPlanner);
      expect(planner.getName()).toBe('RequirementAnalyzer');
    });

    test('should throw error for unimplemented planner type', () => {
      expect(() => {
        PlannerFactory.createPlannerByType('directory', mockLLMClient);
      }).toThrow('DirectoryPlanner not yet implemented');
    });

    test('should throw error for unknown planner type', () => {
      expect(() => {
        PlannerFactory.createPlannerByType('unknown', mockLLMClient);
      }).toThrow('Unknown planner type: unknown');
    });
  });

  describe('getAvailablePlannerTypes', () => {
    test('should return list of available planner types', () => {
      const types = PlannerFactory.getAvailablePlannerTypes();
      
      expect(types).toContain('RequirementAnalyzer');
      expect(types).toContain('DirectoryPlanner');
      expect(types).toContain('DependencyPlanner');
      expect(types).toContain('FrontendArchitecturePlanner');
      expect(types).toContain('BackendArchitecturePlanner');
      expect(types).toContain('APIInterfacePlanner');
    });
  });

  describe('getImplementedPlannerTypes', () => {
    test('should return list of implemented planner types', () => {
      const types = PlannerFactory.getImplementedPlannerTypes();
      
      expect(types).toContain('RequirementAnalyzer');
      // Others should not be included until implemented
    });
  });

  describe('isImplemented', () => {
    test('should return true for implemented planner', () => {
      expect(PlannerFactory.isImplemented('RequirementAnalyzer')).toBe(true);
    });

    test('should return false for unimplemented planner', () => {
      expect(PlannerFactory.isImplemented('DirectoryPlanner')).toBe(false);
    });
  });
});