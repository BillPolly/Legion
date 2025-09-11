/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

/**
 * LayerGeneratorTool - Generates clean architecture layers
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const layerGeneratorToolInputSchema = {
  type: 'object',
  properties: {
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
    valueObjects: {
      type: 'array',
      items: {},
      description: 'Value objects'
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
  required: ['boundedContexts']
};

// Output schema as plain JSON Schema
const layerGeneratorToolOutputSchema = {
  type: 'object',
  properties: {
    architecture: {
      type: 'object',
      properties: {
        style: { type: 'string' },
        description: { type: 'string' },
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              responsibility: { type: 'string' },
              level: { type: 'number' },
              components: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    sourceEntity: { type: 'string' }
                  }
                }
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' }
              },
              dependents: {
                type: 'array',
                items: { type: 'string' }
              },
              interfaces: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' }
                  }
                }
              },
              patterns: {
                type: 'array',
                items: { type: 'string' }
              },
              testingStrategy: { type: 'string' }
            }
          }
        },
        dependencyRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rule: { type: 'string' },
              description: { type: 'string' },
              enforcement: { type: 'string' }
            }
          }
        }
      }
    },
    artifactId: {
      type: 'string',
      description: 'Stored artifact ID'
    },
    summary: {
      type: 'object',
      properties: {
        totalLayers: { type: 'number' },
        totalComponents: { type: 'number' },
        architectureComplexity: { type: 'string' },
        dependencyViolations: { type: 'number' }
      },
      description: 'Architecture summary'
    }
  },
  required: ['architecture', 'artifactId', 'summary']
};

export class LayerGeneratorTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'design_layers',
      description: 'Design clean architecture layers based on domain model using LLM analysis',
      inputSchema: layerGeneratorToolInputSchema,
      outputSchema: layerGeneratorToolOutputSchema
    });
    
    this.llmClient = dependencies.llmClient;
    this.designDatabase = dependencies.designDatabase;
    this.resourceManager = dependencies.resourceManager;
  }

  async _execute(args) {
    const { 
      entities = [], 
      aggregates = [], 
      valueObjects = [], 
      domainEvents = [], 
      boundedContexts, 
      projectId 
    } = args;
    
    try {
      this.emit('progress', { percentage: 0, status: 'Starting clean architecture design...' });
      
      // Get LLM client
      const llmClient = await this.getLLMClient();
      
      this.emit('progress', { percentage: 20, status: 'Analyzing domain model...' });
      
      // Create architecture design prompt
      const prompt = this.createArchitectureDesignPrompt({
        entities,
        aggregates,
        valueObjects,
        domainEvents,
        boundedContexts
      });
      
      this.emit('progress', { percentage: 40, status: 'Generating clean architecture layers...' });
      
      // Call LLM for architecture design
      const llmResponse = await llmClient.complete(prompt, {
        temperature: 0.2,
        maxTokens: 4000,
        system: 'You are a software architect expert in Clean Architecture, DDD, and SOLID principles. Design a comprehensive layered architecture.'
      });
      
      this.emit('progress', { percentage: 70, status: 'Parsing architecture design...' });
      
      // Parse architecture from response
      const architecture = this.parseLLMResponse(llmResponse);
      
      this.emit('progress', { percentage: 85, status: 'Validating architecture design...' });
      
      // Validate architecture
      const validation = this.validateArchitecture(architecture);
      if (!validation.valid) {
        throw new Error(`Invalid architecture design: ${validation.errors.join(', ', {
        cause: {
          errorType: 'operation_error'
        }
      })}`)
      }
      
      // Store architecture
      const storedArtifact = await this.storeArchitecture(architecture, projectId);
      
      this.emit('progress', { percentage: 100, status: 'Clean architecture design completed' });
      
      return {
        architecture,
        artifactId: storedArtifact.id,
        summary: {
          totalLayers: architecture.layers.length,
          totalComponents: architecture.layers.reduce((sum, layer) => sum + layer.components.length, 0),
          architectureComplexity: this.assessComplexity(architecture),
          dependencyViolations: this.detectDependencyViolations(architecture)
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to design clean architecture: ${error.message}`, {
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

  createArchitectureDesignPrompt(domainModel) {
    const { entities, aggregates, valueObjects, domainEvents, boundedContexts } = domainModel;
    
    return `Design a Clean Architecture for the domain model following Uncle Bob's principles.

Domain Model Summary:
- Bounded Contexts: ${boundedContexts.length}
- Entities: ${entities.length}
- Aggregates: ${aggregates.length}
- Value Objects: ${valueObjects.length}
- Domain Events: ${domainEvents.length}

Domain Details:
Bounded Contexts:
${JSON.stringify(boundedContexts, null, 2)}

Entities:
${JSON.stringify(entities.slice(0, 3), null, 2)}${entities.length > 3 ? '\n... and ' + (entities.length - 3) + ' more entities' : ''}

Aggregates:
${JSON.stringify(aggregates.slice(0, 2), null, 2)}${aggregates.length > 2 ? '\n... and ' + (aggregates.length - 2) + ' more aggregates' : ''}

Value Objects:
${JSON.stringify(valueObjects.slice(0, 2), null, 2)}${valueObjects.length > 2 ? '\n... and ' + (valueObjects.length - 2) + ' more value objects' : ''}

Domain Events:
${JSON.stringify(domainEvents.slice(0, 3), null, 2)}${domainEvents.length > 3 ? '\n... and ' + (domainEvents.length - 3) + ' more events' : ''}

Design a Clean Architecture following these principles:

1. **Dependency Rule**: Dependencies point inward. Inner layers know nothing about outer layers.
2. **Layer Separation**: Each layer has distinct responsibilities
3. **Interface Segregation**: Define clean interfaces between layers
4. **Dependency Inversion**: Depend on abstractions, not concretions

Core Clean Architecture Layers:
1. **Domain Layer (Level 1 - Innermost)**:
   - Entities with business logic
   - Value Objects for data integrity
   - Domain Events for state changes
   - Domain Services for complex business rules
   - Repository interfaces (abstractions only)

2. **Application Layer (Level 2)**:
   - Use Cases (Application Services)
   - Command/Query handlers
   - Application Events
   - DTOs and mappers
   - Port interfaces for external dependencies

3. **Infrastructure Layer (Level 3)**:
   - Repository implementations
   - Database adapters
   - External service clients
   - Framework-specific code
   - Configuration

4. **Presentation Layer (Level 4 - Outermost)**:
   - Controllers/Endpoints
   - View Models
   - Input validation
   - Response formatters
   - API documentation

Return a JSON structure with this format:
{
  "architecture": {
    "style": "Clean Architecture",
    "description": "Layered architecture following Clean Architecture principles with DDD",
    "layers": [
      {
        "id": "domain",
        "name": "Domain Layer",
        "description": "Core business logic and domain model",
        "responsibility": "Encapsulates enterprise business rules and entities",
        "level": 1,
        "components": [
          {
            "type": "entity",
            "name": "EntityName",
            "description": "Business entity with behavior",
            "sourceEntity": "entity-id-from-domain-model"
          },
          {
            "type": "value_object",
            "name": "ValueObjectName", 
            "description": "Immutable value object",
            "sourceEntity": "value-object-id"
          },
          {
            "type": "domain_service",
            "name": "ServiceName",
            "description": "Complex business logic service",
            "sourceEntity": "aggregate-id"
          },
          {
            "type": "repository_interface",
            "name": "IRepositoryName",
            "description": "Data access abstraction",
            "sourceEntity": "aggregate-id"
          }
        ],
        "dependencies": [],
        "dependents": ["application"],
        "interfaces": [
          {
            "name": "IRepository",
            "type": "port",
            "description": "Repository abstraction for data access"
          }
        ],
        "patterns": ["Entity", "Value Object", "Domain Service", "Repository Pattern"],
        "testingStrategy": "Unit tests for business logic, no external dependencies"
      },
      {
        "id": "application",
        "name": "Application Layer",
        "description": "Application business rules and use cases",
        "responsibility": "Orchestrates domain objects to fulfill use cases",
        "level": 2,
        "components": [
          {
            "type": "use_case",
            "name": "UseCaseName",
            "description": "Application service implementing use case",
            "sourceEntity": "aggregate-id"
          },
          {
            "type": "command_handler",
            "name": "CommandHandlerName",
            "description": "Handles command execution",
            "sourceEntity": "aggregate-id"
          },
          {
            "type": "query_handler", 
            "name": "QueryHandlerName",
            "description": "Handles query execution",
            "sourceEntity": "entity-id"
          },
          {
            "type": "dto",
            "name": "DTOName",
            "description": "Data transfer object",
            "sourceEntity": "entity-id"
          }
        ],
        "dependencies": ["domain"],
        "dependents": ["infrastructure", "presentation"],
        "interfaces": [
          {
            "name": "IUseCase",
            "type": "interface",
            "description": "Use case contract"
          },
          {
            "name": "ICommandHandler",
            "type": "interface", 
            "description": "Command handling contract"
          }
        ],
        "patterns": ["Use Case", "Command/Query", "DTO", "Mapper"],
        "testingStrategy": "Integration tests with mocked infrastructure"
      },
      {
        "id": "infrastructure",
        "name": "Infrastructure Layer",
        "description": "External concerns and framework details",
        "responsibility": "Implements interfaces defined by inner layers",
        "level": 3,
        "components": [
          {
            "type": "repository_impl",
            "name": "RepositoryImpl",
            "description": "Concrete repository implementation",
            "sourceEntity": "aggregate-id"
          },
          {
            "type": "database_adapter",
            "name": "DatabaseAdapter",
            "description": "Database connection and queries",
            "sourceEntity": "bounded-context-id"
          },
          {
            "type": "external_service",
            "name": "ExternalServiceClient",
            "description": "External API client",
            "sourceEntity": "bounded-context-id"
          }
        ],
        "dependencies": ["application", "domain"],
        "dependents": [],
        "interfaces": [
          {
            "name": "IDatabase",
            "type": "adapter",
            "description": "Database abstraction"
          }
        ],
        "patterns": ["Adapter", "Repository Implementation", "Gateway"],
        "testingStrategy": "Integration tests with real external dependencies"
      },
      {
        "id": "presentation",
        "name": "Presentation Layer", 
        "description": "User interface and external interfaces",
        "responsibility": "Handles external communication and user interaction",
        "level": 4,
        "components": [
          {
            "type": "controller",
            "name": "ControllerName",
            "description": "HTTP API controller",
            "sourceEntity": "use-case"
          },
          {
            "type": "view_model",
            "name": "ViewModelName",
            "description": "UI data representation",
            "sourceEntity": "entity-id"
          }
        ],
        "dependencies": ["application"],
        "dependents": [],
        "interfaces": [
          {
            "name": "IController",
            "type": "interface",
            "description": "Controller contract"
          }
        ],
        "patterns": ["MVC", "ViewModel", "Controller"],
        "testingStrategy": "End-to-end tests and UI tests"
      }
    ],
    "dependencyRules": [
      {
        "rule": "Domain layer has no external dependencies",
        "description": "Domain layer cannot depend on any outer layers",
        "enforcement": "Architecture tests and dependency analysis"
      },
      {
        "rule": "Application layer only depends on Domain layer",
        "description": "Application layer can only import from Domain layer",
        "enforcement": "Module boundaries and import restrictions"
      },
      {
        "rule": "Infrastructure implements Domain/Application interfaces",
        "description": "Infrastructure provides concrete implementations of abstractions",
        "enforcement": "Interface compliance testing"
      },
      {
        "rule": "Presentation only depends on Application layer",
        "description": "UI layer accesses business logic only through Application layer",
        "enforcement": "Import analysis and architectural constraints"
      }
    ]
  },
  "reasoning": "Explanation of architectural decisions and component mappings"
}

Map the existing domain model components to appropriate architectural layers:
- Entities → Domain Layer entities and domain services
- Aggregates → Domain Layer aggregates and Application Layer use cases
- Value Objects → Domain Layer value objects
- Domain Events → Domain Layer events and Application Layer handlers
- Repository needs → Domain Layer interfaces and Infrastructure Layer implementations

Focus on creating a clean separation of concerns with proper dependency management.
Return ONLY valid JSON.`;
  }

  parseLLMResponse(response) {
    try {
      const cleanedResponse = response.trim();
      const jsonStart = cleanedResponse.indexOf('{');
      const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(jsonStr);
        
        return parsed.architecture || parsed;
      }
      
      return JSON.parse(cleanedResponse).architecture || JSON.parse(cleanedResponse);
      
    } catch (error) {
      // FAIL FAST - no fallbacks allowed
      throw new Error(`Failed to parse LLM response as JSON: ${error.message}. Response was: ${response.substring(0, 200)}...`);
    }
  }

  validateArchitecture(architecture) {
    const errors = [];
    
    if (!architecture.layers || !Array.isArray(architecture.layers)) {
      errors.push('Architecture must have layers array');
      return { valid: false, errors };
    }
    
    // Validate required layers exist
    const requiredLayers = ['domain', 'application', 'infrastructure', 'presentation'];
    const existingLayerIds = architecture.layers.map(l => l.id);
    
    requiredLayers.forEach(layerId => {
      if (!existingLayerIds.includes(layerId)) {
        errors.push(`Missing required layer: ${layerId}`);
      }
    });
    
    // Validate layer structure
    architecture.layers.forEach((layer, index) => {
      if (!layer.id) errors.push(`Layer ${index} missing ID`);
      if (!layer.name) errors.push(`Layer ${index} missing name`);
      if (!layer.description) errors.push(`Layer ${layer.name || index} missing description`);
      if (typeof layer.level !== 'number') errors.push(`Layer ${layer.name} missing level`);
      if (!Array.isArray(layer.components)) errors.push(`Layer ${layer.name} missing components array`);
      if (!Array.isArray(layer.dependencies)) errors.push(`Layer ${layer.name} missing dependencies array`);
      
      // Validate components
      layer.components?.forEach((component, compIndex) => {
        if (!component.type) errors.push(`Layer ${layer.name} component ${compIndex} missing type`);
        if (!component.name) errors.push(`Layer ${layer.name} component ${compIndex} missing name`);
      });
    });
    
    // Validate dependency rule compliance
    if (!this.validateDependencyRules(architecture)) {
      errors.push('Architecture violates Clean Architecture dependency rules');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateDependencyRules(architecture) {
    const layers = architecture.layers.sort((a, b) => a.level - b.level);
    
    for (const layer of layers) {
      for (const depId of layer.dependencies) {
        const depLayer = layers.find(l => l.id === depId);
        if (!depLayer) continue;
        
        // Check if dependency is inward (lower level)
        if (depLayer.level >= layer.level) {
          return false; // Dependency rule violation
        }
      }
    }
    
    return true;
  }

  assessComplexity(architecture) {
    const totalComponents = architecture.layers.reduce((sum, layer) => sum + layer.components.length, 0);
    const totalInterfaces = architecture.layers.reduce((sum, layer) => sum + (layer.interfaces?.length || 0), 0);
    
    if (totalComponents < 20 && totalInterfaces < 10) return 'Low';
    if (totalComponents < 50 && totalInterfaces < 25) return 'Medium';
    return 'High';
  }

  detectDependencyViolations(architecture) {
    return this.validateDependencyRules(architecture) ? 0 : 1;
  }

  async storeArchitecture(architecture, projectId) {
    const artifact = {
      type: 'clean_architecture',
      projectId: projectId || `project_${Date.now()}`,
      data: architecture,
      metadata: {
        toolName: this.name,
        timestamp: new Date().toISOString(),
        layerCount: architecture.layers.length,
        componentCount: architecture.layers.reduce((sum, layer) => sum + layer.components.length, 0),
        architectureStyle: architecture.style,
        complexity: this.assessComplexity(architecture)
      }
    };
    
    console.log('[LayerGeneratorTool] Storing clean architecture:', artifact.metadata.layerCount, 'layers');
    
    return {
      ...artifact,
      id: `artifact_${Date.now()}`
    };
  }
}