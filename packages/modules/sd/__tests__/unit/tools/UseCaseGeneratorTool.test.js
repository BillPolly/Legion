/**
 * Unit tests for UseCaseGeneratorTool
 */

import { jest } from '@jest/globals';

describe('UseCaseGeneratorTool', () => {
  let UseCaseGeneratorTool;
  let tool;
  let mockDependencies;

  beforeEach(async () => {
    const module = await import('../../../src/tools/architecture/UseCaseGeneratorTool.js');
    UseCaseGeneratorTool = module.UseCaseGeneratorTool;

    mockDependencies = {
      llmClient: {
        complete: jest.fn().mockResolvedValue(JSON.stringify({
          useCases: [
            {
              id: 'uc-create-user',
              name: 'CreateUser',
              description: 'Create a new user in the system',
              actor: 'Administrator',
              goal: 'Register a new user with valid credentials',
              boundedContext: 'UserManagement',
              preconditions: ['Administrator is authenticated'],
              postconditions: ['User is created', 'Welcome email is sent'],
              mainFlow: [
                {
                  step: 1,
                  action: 'Administrator provides user details',
                  actor: 'Administrator',
                  system: 'Validates input data'
                },
                {
                  step: 2,
                  action: 'System creates user',
                  actor: 'System',
                  system: 'Stores user in database'
                }
              ],
              alternativeFlows: [],
              exceptionFlows: [
                {
                  exception: 'Invalid email format',
                  handling: 'Return validation error'
                }
              ],
              inputData: {
                parameters: [
                  {
                    name: 'email',
                    type: 'string',
                    required: true,
                    validation: 'Valid email format'
                  }
                ],
                dtoStructure: {
                  email: 'string',
                  name: 'string'
                }
              },
              outputData: {
                success: {
                  type: 'User',
                  description: 'Created user object'
                },
                failure: {
                  type: 'Error',
                  description: 'Validation or creation error'
                }
              },
              businessRules: ['Email must be unique'],
              involvedEntities: ['User'],
              involvedAggregates: ['UserAggregate'],
              triggeredEvents: ['UserRegistered'],
              interfaces: {
                repositories: ['IUserRepository'],
                services: ['IEmailService'],
                gateways: []
              },
              implementation: {
                layer: 'application',
                pattern: 'Use Case Pattern',
                dependencies: ['IUserRepository', 'IEmailService']
              },
              testingStrategy: {
                unitTests: 'Mock dependencies and test business logic',
                integrationTests: 'Test with real repository implementation',
                acceptanceTests: 'Test complete user creation workflow'
              }
            }
          ],
          reasoning: 'Use case generated from user registration story'
        }))
      }
    };

    tool = new UseCaseGeneratorTool(mockDependencies);
  });

  describe('constructor', () => {
    it('should create UseCaseGeneratorTool instance', () => {
      expect(tool).toBeDefined();
      expect(tool.name).toBe('generate_use_cases');
      expect(tool.llmClient).toBe(mockDependencies.llmClient);
    });
  });

  describe('execute', () => {
    it('should generate use cases from user stories', async () => {
      const userStories = [
        {
          id: 'US001',
          title: 'User Registration',
          description: 'As an administrator, I want to register new users so that they can access the system'
        }
      ];
      
      const entities = [
        {
          id: 'ENT001',
          name: 'User',
          boundedContext: 'UserManagement'
        }
      ];

      const result = await tool.execute({
        userStories,
        entities,
        aggregates: [],
        domainEvents: [],
        boundedContexts: [],
        projectId: 'test-project'
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('useCases');
      expect(result.data).toHaveProperty('artifactId');
      expect(result.data).toHaveProperty('summary');
      expect(Array.isArray(result.data.useCases)).toBe(true);
      expect(result.data.useCases).toHaveLength(1);
      expect(result.data.useCases[0]).toHaveProperty('name', 'CreateUser');
      expect(result.data.useCases[0]).toHaveProperty('actor', 'Administrator');
      expect(result.data.summary).toHaveProperty('totalUseCases', 1);
    });

    it('should fail without required parameters', async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input validation failed');
    });

    it('should handle missing LLM client', async () => {
      tool.llmClient = null;
      tool.resourceManager = null;

      const userStories = [
        {
          id: 'US001',
          title: 'User Registration'
        }
      ];
      
      const entities = [
        {
          id: 'ENT001',
          name: 'User'
        }
      ];

      const result = await tool.execute({
        userStories,
        entities
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM client not available');
    });
  });
});