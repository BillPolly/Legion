/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * UseCaseGeneratorTool - Generates use cases from requirements
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const useCaseGeneratorToolInputSchema = {
  type: 'object',
  properties: {
    userStories: {
      type: 'array',
      items: {},
      description: 'User stories'
    },
    entities: {
      type: 'array',
      items: {},
      description: 'Domain entities'
    },
    aggregates: {
      type: 'array',
      items: {},
      description: 'Domain aggregates'
    },
    domainEvents: {
      type: 'array',
      items: {},
      description: 'Domain events'
    },
    boundedContexts: {
      type: 'array',
      items: {},
      description: 'Bounded contexts'
    },
    projectId: {
      type: 'string',
      description: 'Project ID'
    }
  },
  required: ['userStories', 'entities']
};

// Output schema as plain JSON Schema
const useCaseGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    useCases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          actor: { type: 'string' },
          goal: { type: 'string' },
          boundedContext: { type: 'string' },
          preconditions: {
            type: 'array',
            items: { type: 'string' }
          },
          postconditions: {
            type: 'array',
            items: { type: 'string' }
          },
          mainFlow: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                step: { type: 'number' },
                action: { type: 'string' },
                actor: { type: 'string' },
                system: { type: 'string' }
              }
            }
          },
          alternativeFlows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                condition: { type: 'string' },
                steps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      step: { type: 'number' },
                      action: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          exceptionFlows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                exception: { type: 'string' },
                handling: { type: 'string' }
              }
            }
          },
          inputData: {
            type: 'object',
            properties: {
              parameters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    required: { type: 'boolean' },
                    validation: { type: 'string' }
                  }
                }
              },
              dtoStructure: { type: 'object' }
            }
          },
          outputData: {
            type: 'object',
            properties: {
              success: { type: 'object' },
              failure: { type: 'object' }
            }
          },
          businessRules: {
            type: 'array',
            items: { type: 'string' }
          },
          involvedEntities: {
            type: 'array',
            items: { type: 'string' }
          },
          involvedAggregates: {
            type: 'array',
            items: { type: 'string' }
          },
          triggeredEvents: {
            type: 'array',
            items: { type: 'string' }
          },
          interfaces: {
            type: 'object',
            properties: {
              repositories: {
                type: 'array',
                items: { type: 'string' }
              },
              services: {
                type: 'array',
                items: { type: 'string' }
              },
              gateways: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          implementation: {
            type: 'object',
            properties: {
              layer: { type: 'string' },
              pattern: { type: 'string' },
              dependencies: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          },
          testingStrategy: {
            type: 'object',
            properties: {
              unitTests: { type: 'string' },
              integrationTests: { type: 'string' },
              acceptanceTests: { type: 'string' }
            }
          }
        }
      },
      description: 'Generated use cases'
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalUseCases: { type: 'number' },
        byContext: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              context: { type: 'string' },
              useCaseCount: { type: 'number' }
            }
          }
        },
        complexity: { type: 'string' }
      },
      description: 'Use cases summary'
    }
  },
  required: ['useCases', 'artifactId', 'summary']
};

export class UseCaseGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'generate_use_cases',
      description: 'Generate comprehensive use cases from user stories with Clean Architecture integration',
      inputSchema: useCaseGeneratorToolInputSchema,
      outputSchema: useCaseGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async _execute(args) {
    const { 
      userStories, 
      entities, 
      aggregates = [], 
      domainEvents = [], 
      boundedContexts = [], 
      projectId 
    } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting use case generation...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      this.emit('progress', { percentage: 20, status: 'Analyzing user stories and domain model...' });
      
      // Generate use cases for each user story
      const allUseCases = [];
      
      for (const userStory of userStories) {
        this.emit('progress', { 
          percentage: 20 + Math.floor((userStories.indexOf(userStory) / userStories.length) * 60),
          status: `Generating use cases for: ${userStory.title || userStory.name}...`
        });
        
        // Create use case generation prompt
        const prompt = this.createUseCaseGenerationPrompt({
          userStory,
          entities,
          aggregates,
          domainEvents,
          boundedContexts
        });
        
        // Call LLM for use case generation
        const llmResponse = await llmClient.complete(prompt, {
          temperature: 0.3,
          maxTokens: 4000,
          system: 'You are a software architect expert in Use Case modeling, Clean Architecture, and DDD. Generate comprehensive use cases that bridge user requirements to implementation.'
        });
        
        // Parse use cases from response
        const storyUseCases = this.parseLLMResponse(llmResponse, userStory);
        
        allUseCases.push(...storyUseCases);
      }
      
      this.emit('progress', { percentage: 85, status: 'Validating use cases...' });
      
      // Validate all use cases
      const validation = this.validateUseCases(allUseCases);
      if (!validation.valid) {
        throw new Error(`Invalid use cases: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`)
      }
      
      // Store use cases
      const storedArtifact = await this.storeUseCases(allUseCases, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Use case generation completed' });
      
      return {
        useCases: allUseCases,
        artifactId: storedArtifact.id,
        summary: {
          totalUseCases: allUseCases.length,
          byContext: this.groupByContext(allUseCases, boundedContexts),
          complexity: this.assessComplexity(allUseCases)
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to generate use cases: ${error.message}`, {
        cause: {
          errorType: 'operation_error'
        }
      })
    }
  }

  async getLLMClient() {
    if (this.llmClient) return this.llmClient;
    
    if (this.resourceManager) {
      this.llmClient = this.resourceManager.get('llmClient');
      if (this.llmClient) return this.llmClient;
    }
    
    throw new Error('LLM client not available');
  }

  createUseCaseGenerationPrompt({ userStory, entities, aggregates, domainEvents, boundedContexts }) {
    return `Generate comprehensive use cases from the user story using Clean Architecture principles.

User Story:
${JSON.stringify(userStory, null, 2)}

Domain Model Context:
Entities: ${entities.map(e => e.name).join(', ')}
Aggregates: ${aggregates.map(a => a.name).join(', ')}
Domain Events: ${domainEvents.map(e => e.name).join(', ')}
Bounded Contexts: ${boundedContexts.map(c => c.name).join(', ')}

Generate detailed use cases following these principles:

1. **Use Case Structure**:
   - Clear actor identification
   - Specific goal and success criteria
   - Comprehensive flow descriptions
   - Exception handling
   - Business rule enforcement

2. **Clean Architecture Integration**:
   - Map to Application Layer use cases
   - Define required interfaces (repositories, services, gateways)
   - Specify dependency injection requirements
   - Consider SOLID principles

3. **DDD Alignment**:
   - Connect to relevant aggregates and entities
   - Identify triggered domain events
   - Respect bounded context boundaries
   - Maintain business logic in domain layer

4. **Implementation Readiness**:
   - Define input/output DTOs
   - Specify validation requirements
   - Plan testing strategies
   - Consider error scenarios

Return a JSON structure with this format:
{
  "useCases": [
    {
      "id": "uc-[name]",
      "name": "UseCaseName",
      "description": "Detailed description of what this use case accomplishes",
      "actor": "Primary actor who initiates this use case",
      "goal": "What the actor wants to achieve",
      "boundedContext": "Which bounded context this belongs to",
      "preconditions": [
        "Conditions that must be true before this use case can execute"
      ],
      "postconditions": [
        "Conditions that will be true after successful execution"
      ],
      "mainFlow": [
        {
          "step": 1,
          "action": "Actor action or system response",
          "actor": "Who performs this step",
          "system": "System behavior description"
        }
      ],
      "alternativeFlows": [
        {
          "name": "Alternative flow name",
          "condition": "When this alternative occurs",
          "steps": [
            {
              "step": 1,
              "action": "Alternative action description"
            }
          ]
        }
      ],
      "exceptionFlows": [
        {
          "exception": "Exception condition",
          "handling": "How the system handles this exception"
        }
      ],
      "inputData": {
        "parameters": [
          {
            "name": "parameterName",
            "type": "string|number|object|array",
            "required": true,
            "validation": "Validation rules"
          }
        ],
        "dtoStructure": {
          "example": "DTO structure for input data"
        }
      },
      "outputData": {
        "success": {
          "type": "Success response structure",
          "description": "What is returned on success"
        },
        "failure": {
          "type": "Error response structure", 
          "description": "What is returned on failure"
        }
      },
      "businessRules": [
        "Business rules that must be enforced during execution"
      ],
      "involvedEntities": [
        "Entity names that are involved in this use case"
      ],
      "involvedAggregates": [
        "Aggregate names that are involved"
      ],
      "triggeredEvents": [
        "Domain events that are triggered during execution"
      ],
      "interfaces": {
        "repositories": [
          "IRepositoryName - Description of repository interface needed"
        ],
        "services": [
          "IServiceName - Description of service interface needed"
        ],
        "gateways": [
          "IGatewayName - Description of external gateway interface needed"
        ]
      },
      "implementation": {
        "layer": "application",
        "pattern": "Use Case Pattern / Command Handler / Query Handler",
        "dependencies": [
          "List of dependencies this use case will need"
        ]
      },
      "testingStrategy": {
        "unitTests": "How to unit test this use case",
        "integrationTests": "How to integration test with dependencies",
        "acceptanceTests": "How to create acceptance tests from user story"
      }
    }
  ],
  "reasoning": "Explanation of use case design decisions and mappings"
}

Guidelines:
- Extract multiple use cases if the user story contains multiple distinct actions
- Ensure each use case has a single responsibility
- Map user story acceptance criteria to postconditions
- Consider both happy path and error scenarios
- Design for testability and maintainability
- Respect architectural boundaries and dependency rules

Return ONLY valid JSON.`;
  }

  parseLLMResponse(response, userStory) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        // Add user story reference to each use case
        const useCases = (parsed.useCases || []).map(useCase => ({
          ...useCase,
          sourceUserStory: userStory.id || userStory.title
        }));
        
        return useCases;
      }
      
      return JSON.parse(cleanedResponse).useCases || [];
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateUseCases(useCases) {
    const errors = [];
    
    useCases.forEach((useCase, index) => {
      if (!useCase.id) errors.push(`Use case ${index} missing ID`);
      if (!useCase.name) errors.push(`Use case ${index} missing name`);
      if (!useCase.description) errors.push(`Use case ${useCase.name || index} missing description`);
      if (!useCase.actor) errors.push(`Use case ${useCase.name} missing actor`);
      if (!useCase.goal) errors.push(`Use case ${useCase.name} missing goal`);
      
      // Validate flows
      if (!useCase.mainFlow || !Array.isArray(useCase.mainFlow)) {
        errors.push(`Use case ${useCase.name} must have mainFlow array`);
      }
      
      // Validate main flow steps
      useCase.mainFlow?.forEach((step, stepIndex) => {
        if (typeof step.step !== 'number') {
          errors.push(`Use case ${useCase.name} main flow step ${stepIndex} missing step number`);
        }
        if (!step.action) {
          errors.push(`Use case ${useCase.name} main flow step ${stepIndex} missing action`);
        }
      });
      
      // Validate preconditions and postconditions
      if (!Array.isArray(useCase.preconditions)) {
        errors.push(`Use case ${useCase.name} must have preconditions array`);
      }
      if (!Array.isArray(useCase.postconditions)) {
        errors.push(`Use case ${useCase.name} must have postconditions array`);
      }
      
      // Validate business rules
      if (!Array.isArray(useCase.businessRules)) {
        errors.push(`Use case ${useCase.name} must have businessRules array`);
      }
      
      // Validate implementation details
      if (!useCase.implementation) {
        errors.push(`Use case ${useCase.name} missing implementation details`);
      } else {
        if (!useCase.implementation.layer) {
          errors.push(`Use case ${useCase.name} missing implementation layer`);
        }
        if (!useCase.implementation.pattern) {
          errors.push(`Use case ${useCase.name} missing implementation pattern`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  groupByContext(useCases, boundedContexts) {
    const contextGroups = {};
    
    // Initialize with bounded contexts
    boundedContexts.forEach(context => {
      contextGroups[context.name] = 0;
    });
    
    // Count use cases by context
    useCases.forEach(useCase => {
      const contextName = useCase.boundedContext || 'Unassigned';
      if (!contextGroups[contextName]) {
        contextGroups[contextName] = 0;
      }
      contextGroups[contextName]++;
    });
    
    return Object.entries(contextGroups).map(([context, useCaseCount]) => ({
      context,
      useCaseCount
    }));
  }

  assessComplexity(useCases) {
    const totalSteps = useCases.reduce((sum, uc) => sum + (uc.mainFlow?.length || 0), 0);
    const avgStepsPerUseCase = totalSteps / useCases.length;
    const totalAlternativeFlows = useCases.reduce((sum, uc) => sum + (uc.alternativeFlows?.length || 0), 0);
    
    if (useCases.length <= 5 && avgStepsPerUseCase <= 5 && totalAlternativeFlows <= 3) return 'Low';
    if (useCases.length <= 15 && avgStepsPerUseCase <= 10 && totalAlternativeFlows <= 10) return 'Medium';
    return 'High';
  }

  async storeUseCases(useCases, projectId) {
    const artifact = {
      type: 'use_cases',
      projectId: projectId || `project_${Date.now()}`,
      data: useCases,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        useCaseCount: useCases.length,
        totalSteps: useCases.reduce((sum, uc) => sum + (uc.mainFlow?.length || 0), 0),
        complexity: this.assessComplexity(useCases),
        contexts: [...new Set(useCases.map(uc => uc.boundedContext).filter(Boolean))]
      }
    };
    
    console.log('[UseCaseGeneratorTool] Storing use cases:', artifact.metadata.useCaseCount);
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}