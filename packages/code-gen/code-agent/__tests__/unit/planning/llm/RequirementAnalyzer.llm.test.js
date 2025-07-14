/**
 * Tests for LLM-based RequirementAnalyzer replacement
 * 
 * This test suite verifies that the GenericLLMPlanner configured as RequirementAnalyzer
 * produces the same outputs as the original RequirementAnalyzer class.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { PlannerFactory } from '../../../../src/planning/llm/PlannerFactory.js';

describe('RequirementAnalyzer LLM Implementation', () => {
  let analyzer;
  let mockLLMClient;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generateResponse: jest.fn(),
      completeWithStructuredResponse: jest.fn()
    };

    // Create LLM-based analyzer
    analyzer = PlannerFactory.createRequirementAnalyzer(mockLLMClient);
  });

  describe('Constructor', () => {
    test('should create RequirementAnalyzer with LLM backend', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.getName()).toBe('RequirementAnalyzer');
    });
  });

  describe('analyzeRequirements (execute)', () => {
    test('should analyze simple frontend requirements', async () => {
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
        summary: 'Project Type: frontend\nComplexity: low complexity\nFrontend: form, list',
        timestamp: Date.now()
      };

      // Mock the LLM response
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockResponse);

      const requirements = {
        task: 'Create a todo list application',
        requirements: {
          frontend: 'HTML form for adding todos, display list with delete functionality'
        }
      };

      const analysis = await analyzer.execute(requirements);

      expect(analysis).toBeDefined();
      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components).toBeDefined();
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.frontend.features).toContain('list');
      expect(analysis.components.frontend.technologies).toContain('html');
      expect(analysis.components.frontend.technologies).toContain('javascript');
      expect(analysis.complexity).toBe('low');
      expect(analysis.metadata.planner).toBe('RequirementAnalyzer');
    });

    test('should analyze simple backend requirements', async () => {
      const mockResponse = {
        task: 'Create a REST API',
        projectType: 'backend',
        components: {
          backend: {
            features: ['rest-api', 'crud'],
            technologies: ['nodejs', 'express'],
            storage: 'file-based',
            operations: ['create', 'read', 'update', 'delete']
          }
        },
        complexity: 'medium',
        suggestedArchitecture: {
          pattern: 'modular',
          structure: {
            backend: ['server.js', 'routes/', 'models/', 'utils/', 'package.json']
          }
        },
        summary: 'Project Type: backend\nComplexity: medium complexity\nBackend: rest-api, crud',
        timestamp: Date.now()
      };

      // Mock the LLM response
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockResponse);

      const requirements = {
        task: 'Create a REST API',
        requirements: {
          backend: 'REST API with CRUD operations for users, file-based storage'
        }
      };

      const analysis = await analyzer.execute(requirements);

      expect(analysis.projectType).toBe('backend');
      expect(analysis.components.backend).toBeDefined();
      expect(analysis.components.backend.features).toContain('rest-api');
      expect(analysis.components.backend.features).toContain('crud');
      expect(analysis.components.backend.operations).toContain('create');
      expect(analysis.components.backend.operations).toContain('read');
      expect(analysis.components.backend.operations).toContain('update');
      expect(analysis.components.backend.operations).toContain('delete');
      expect(analysis.components.backend.storage).toBe('file-based');
    });

    test('should analyze fullstack requirements', async () => {
      const mockResponse = {
        task: 'Create a blog application',
        projectType: 'fullstack',
        components: {
          frontend: {
            features: ['listing', 'view', 'form'],
            technologies: ['html', 'javascript', 'css']
          },
          backend: {
            features: ['rest-api', 'authentication'],
            technologies: ['nodejs', 'express']
          }
        },
        apiInterface: {
          endpoints: ['/articles', '/comments']
        },
        security: {
          authentication: true
        },
        complexity: 'medium',
        suggestedArchitecture: {
          pattern: 'modular',
          structure: {
            frontend: ['index.html', 'css/', 'js/', 'components/', 'services/'],
            backend: ['server.js', 'routes/', 'models/', 'utils/', 'package.json']
          }
        },
        summary: 'Project Type: fullstack\nComplexity: medium complexity\nFrontend: listing, view, form\nBackend: rest-api, authentication\nSecurity: authentication required',
        timestamp: Date.now()
      };

      // Mock the LLM response
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockResponse);

      const requirements = {
        task: 'Create a blog application',
        requirements: {
          frontend: 'Article listing, article view, comment form',
          backend: 'REST API for articles and comments, authentication'
        }
      };

      const analysis = await analyzer.execute(requirements);

      expect(analysis.projectType).toBe('fullstack');
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.components.backend).toBeDefined();
      expect(analysis.components.frontend.features).toContain('listing');
      expect(analysis.components.frontend.features).toContain('view');
      expect(analysis.components.frontend.features).toContain('form');
      expect(analysis.components.backend.features).toContain('rest-api');
      expect(analysis.components.backend.features).toContain('authentication');
      expect(analysis.apiInterface).toBeDefined();
      expect(analysis.apiInterface.endpoints).toContain('/articles');
      expect(analysis.apiInterface.endpoints).toContain('/comments');
      expect(analysis.security.authentication).toBe(true);
    });

    test('should handle minimal requirements', async () => {
      const mockResponse = {
        task: 'Simple webpage',
        projectType: 'frontend',
        components: {
          frontend: {
            features: ['webpage'],
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
        summary: 'Project Type: frontend\nComplexity: low complexity\nFrontend: webpage',
        timestamp: Date.now()
      };

      // Mock the LLM response
      mockLLMClient.completeWithStructuredResponse.mockResolvedValue(mockResponse);

      const requirements = {
        task: 'Simple webpage'
      };

      const analysis = await analyzer.execute(requirements);

      expect(analysis.projectType).toBe('frontend');
      expect(analysis.components.frontend).toBeDefined();
      expect(analysis.complexity).toBe('low');
    });

    test('should throw error for invalid requirements', async () => {
      const validationResult = analyzer.validateInput(null);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.errors).toContain('Input is required');

      const validationResult2 = analyzer.validateInput({});
      expect(validationResult2.isValid).toBe(false);
      expect(validationResult2.errors).toContain('Task description is required');
    });
  });

  describe('Mock responses', () => {
    test('should provide mock response for simple frontend', () => {
      const mockResponse = analyzer.getMockResponse('simple-frontend');

      expect(mockResponse).toBeDefined();
      expect(mockResponse.task).toBe('Create a todo list application');
      expect(mockResponse.projectType).toBe('frontend');
      expect(mockResponse.components.frontend.features).toContain('form');
      expect(mockResponse.components.frontend.features).toContain('list');
      expect(mockResponse.complexity).toBe('low');
      expect(mockResponse.metadata.planner).toBe('RequirementAnalyzer');
      expect(mockResponse.metadata.mockScenario).toBe('simple-frontend');
    });

    test('should provide mock response for fullstack blog', () => {
      const mockResponse = analyzer.getMockResponse('fullstack-blog');

      expect(mockResponse).toBeDefined();
      expect(mockResponse.task).toBe('Create a blog application');
      expect(mockResponse.projectType).toBe('fullstack');
      expect(mockResponse.components.frontend.features).toContain('listing');
      expect(mockResponse.components.frontend.features).toContain('view');
      expect(mockResponse.components.frontend.features).toContain('form');
      expect(mockResponse.components.backend.features).toContain('rest-api');
      expect(mockResponse.components.backend.features).toContain('authentication');
      expect(mockResponse.apiInterface.endpoints).toContain('/articles');
      expect(mockResponse.apiInterface.endpoints).toContain('/comments');
      expect(mockResponse.security.authentication).toBe(true);
      expect(mockResponse.complexity).toBe('medium');
    });
  });

  describe('Configuration', () => {
    test('should have proper configuration', () => {
      const config = analyzer.getConfig();

      expect(config.name).toBe('RequirementAnalyzer');
      expect(config.description).toBeDefined();
      expect(config.promptTemplate).toBeDefined();
      expect(config.responseSchema).toBeDefined();
      expect(config.examples).toBeDefined();
      expect(config.mockResponses).toBeDefined();
    });

    test('should have examples for testing', () => {
      const examples = analyzer.getExamples();

      expect(examples).toBeDefined();
      expect(examples.length).toBeGreaterThan(0);
      
      const firstExample = examples[0];
      expect(firstExample.input).toBeDefined();
      expect(firstExample.expectedOutput).toBeDefined();
      expect(firstExample.input.task).toBeDefined();
      expect(firstExample.expectedOutput.projectType).toBeDefined();
    });
  });
});