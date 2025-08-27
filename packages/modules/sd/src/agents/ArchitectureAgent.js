/**
 * ArchitectureAgent - BT Agent for Clean Architecture design
 * 
 * Extends SDAgentBase to design clean architecture with proper layering,
 * use cases, interfaces, and dependency inversion
 */

import { SDAgentBase } from './SDAgentBase.js';

export class ArchitectureAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'ArchitectureAgent',
      description: 'Designs clean architecture with proper layering and boundaries',
      methodologyRules: {
        layer: {
          mustHaveName: (artifact) => artifact.name && artifact.name.length > 0,
          mustHaveResponsibilities: (artifact) => artifact.responsibilities && Array.isArray(artifact.responsibilities),
          mustDefineAllowedDependencies: (artifact) => artifact.allowedDependencies && Array.isArray(artifact.allowedDependencies),
          mustFollowDependencyRule: (artifact) => {
            // Inner layers should not depend on outer layers
            const layerOrder = ['domain', 'application', 'infrastructure', 'presentation'];
            const layerIndex = layerOrder.indexOf(artifact.name.toLowerCase());
            if (layerIndex === -1) return true;
            
            return artifact.allowedDependencies.every(dep => {
              const depIndex = layerOrder.indexOf(dep.toLowerCase());
              return depIndex === -1 || depIndex <= layerIndex;
            });
          }
        },
        useCase: {
          mustHaveName: (artifact) => artifact.name && artifact.name.length > 0,
          mustHaveInput: (artifact) => artifact.input && typeof artifact.input === 'object',
          mustHaveOutput: (artifact) => artifact.output && typeof artifact.output === 'object',
          mustHaveSteps: (artifact) => artifact.steps && Array.isArray(artifact.steps) && artifact.steps.length > 0,
          mustBelongToApplicationLayer: (artifact) => artifact.layer === 'application'
        },
        interface: {
          mustHaveName: (artifact) => artifact.name && artifact.name.startsWith('I'),
          mustHaveMethods: (artifact) => artifact.methods && Array.isArray(artifact.methods) && artifact.methods.length > 0,
          mustDefineContracts: (artifact) => artifact.methods.every(m => m.input && m.output)
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  getCurrentPhase() {
    return 'architecture-design';
  }

  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'architecture-design-workflow',
      description: 'Design clean architecture with proper boundaries',
      children: [
        {
          type: 'action',
          id: 'retrieve-domain-model',
          tool: 'retrieve_context',
          description: 'Retrieve domain model from database',
          params: {
            query: {
              type: 'domain-model',
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'design-layers',
          tool: 'design_layers',
          description: 'Design clean architecture layers',
          params: {
            domainContext: '${results.retrieve-domain-model.context}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'generate-use-cases',
          tool: 'generate_use_cases',
          description: 'Generate use cases from domain model',
          params: {
            domainContext: '${results.retrieve-domain-model.context}',
            layers: '${results.design-layers.layers}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'design-boundaries',
          description: 'Design interfaces and adapters in parallel',
          children: [
            {
              type: 'action',
              id: 'design-interfaces',
              tool: 'design_interfaces',
              description: 'Design boundary interfaces',
              params: {
                useCases: '${results.generate-use-cases.useCases}',
                layers: '${results.design-layers.layers}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'design-adapters',
              tool: 'design_adapters',
              description: 'Design adapter patterns',
              params: {
                interfaces: '${results.design-interfaces.interfaces}',
                layers: '${results.design-layers.layers}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'validate-dependencies',
          tool: 'validate_dependencies',
          description: 'Validate dependency directions',
          params: {
            layers: '${results.design-layers.layers}',
            useCases: '${results.generate-use-cases.useCases}',
            interfaces: '${results.design-interfaces.interfaces}',
            adapters: '${results.design-adapters.adapters}'
          }
        },
        {
          type: 'action',
          id: 'create-architecture-diagram',
          tool: 'create_architecture_diagram',
          description: 'Create architecture visualization',
          params: {
            layers: '${results.design-layers.layers}',
            useCases: '${results.generate-use-cases.useCases}',
            interfaces: '${results.design-interfaces.interfaces}'
          }
        },
        {
          type: 'action',
          id: 'store-architecture',
          tool: 'store_artifact',
          description: 'Store architecture artifacts',
          params: {
            artifact: {
              type: 'clean-architecture',
              data: {
                layers: '${results.design-layers.layers}',
                useCases: '${results.generate-use-cases.useCases}',
                interfaces: '${results.design-interfaces.interfaces}',
                adapters: '${results.design-adapters.adapters}',
                validation: '${results.validate-dependencies}',
                diagram: '${results.create-architecture-diagram.diagram}'
              },
              metadata: {
                phase: 'architecture-design',
                agentId: '${agent.id}',
                timestamp: '${timestamp}'
              }
            },
            projectId: '${input.projectId}'
          }
        }
      ]
    };
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'design_architecture') {
      return {
        success: false,
        error: 'ArchitectureAgent only handles design_architecture messages'
      };
    }
    
    try {
      // Build context for architecture design
      const context = await this.buildContext('architecture', {
        projectId: payload.projectId
      });
      
      // Determine architecture strategy using LLM
      const architectureStrategy = await this.decideArchitectureStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          architectureStrategy
        },
        context,
        agent: {
          id: this.id,
          name: this.name
        },
        timestamp: new Date().toISOString()
      });
      
      // Execute BT workflow
      const result = await this.executeBTWorkflow(this.workflowConfig, executionContext);
      
      // Validate architecture
      const validation = this.validateArchitecture(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          architectureStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[ArchitectureAgent] Error designing architecture:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decideArchitectureStrategy(context) {
    const prompt = `Based on the domain model, determine the clean architecture strategy:

Domain Context:
${JSON.stringify(context.artifacts.domain, null, 2)}

Determine the architecture strategy including:
1. Layer structure (standard 4-layer or custom)
2. Use case granularity (fine-grained vs coarse-grained)
3. Interface design approach (repository pattern, ports & adapters)
4. External system integration patterns
5. Cross-cutting concerns handling

Return as JSON:
{
  "layerStructure": "standard|custom",
  "layers": ["domain", "application", "infrastructure", "presentation"],
  "useCaseGranularity": "fine|coarse",
  "interfacePattern": "repository|ports-adapters|mixed",
  "integrationPatterns": ["pattern1", "pattern2"],
  "crossCuttingConcerns": ["logging", "authentication", "validation"],
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  async executeBTWorkflow(workflow, context) {
    console.log(`[ArchitectureAgent] Executing workflow:`, workflow.id);
    
    // Placeholder implementation
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'design-layers': {
            layers: {
              domain: {
                name: 'Domain',
                responsibilities: ['Entities', 'Value Objects', 'Domain Services'],
                allowedDependencies: []
              },
              application: {
                name: 'Application',
                responsibilities: ['Use Cases', 'Application Services'],
                allowedDependencies: ['domain']
              },
              infrastructure: {
                name: 'Infrastructure',
                responsibilities: ['Database', 'External Services'],
                allowedDependencies: ['domain', 'application']
              },
              presentation: {
                name: 'Presentation',
                responsibilities: ['Controllers', 'Views'],
                allowedDependencies: ['application']
              }
            }
          },
          'generate-use-cases': {
            useCases: [
              {
                id: 'uc-create-entity',
                name: 'CreateEntity',
                layer: 'application',
                input: { data: 'object' },
                output: { entity: 'object' },
                steps: ['Validate input', 'Create entity', 'Save entity', 'Return entity']
              }
            ]
          },
          'design-interfaces': {
            interfaces: [
              {
                id: 'int-repository',
                name: 'IEntityRepository',
                methods: [
                  {
                    name: 'save',
                    input: { entity: 'Entity' },
                    output: { entity: 'Entity' }
                  }
                ]
              }
            ]
          }
        }
      }
    };
  }

  validateArchitecture(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate layers
    const layers = result.data?.results?.['design-layers']?.layers;
    if (layers) {
      Object.entries(layers).forEach(([name, layer]) => {
        const validation = this.validateMethodology({ ...layer, type: 'layer' });
        if (!validation.valid) {
          validationResults.valid = false;
          validationResults.violations.push({
            artifact: `layer-${name}`,
            violations: validation.violations
          });
        }
      });
    }
    
    // Validate use cases
    const useCases = result.data?.results?.['generate-use-cases']?.useCases || [];
    useCases.forEach(useCase => {
      const validation = this.validateMethodology({ ...useCase, type: 'useCase' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `useCase-${useCase.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Validate interfaces
    const interfaces = result.data?.results?.['design-interfaces']?.interfaces || [];
    interfaces.forEach(iface => {
      const validation = this.validateMethodology({ ...iface, type: 'interface' });
      if (!validation.valid) {
        validationResults.valid = false;
        validationResults.violations.push({
          artifact: `interface-${iface.id}`,
          violations: validation.violations
        });
      }
    });
    
    // Check for dependency violations
    const dependencyViolations = this.checkDependencyViolations(layers, useCases, interfaces);
    if (dependencyViolations.length > 0) {
      validationResults.valid = false;
      validationResults.violations.push(...dependencyViolations);
    }
    
    return validationResults;
  }

  checkDependencyViolations(layers, useCases, interfaces) {
    const violations = [];
    
    // Check that domain layer has no dependencies
    if (layers?.domain?.allowedDependencies?.length > 0) {
      violations.push({
        artifact: 'layer-domain',
        violation: 'Domain layer should have no dependencies'
      });
    }
    
    // Check that presentation doesn't depend on infrastructure
    if (layers?.presentation?.allowedDependencies?.includes('infrastructure')) {
      violations.push({
        artifact: 'layer-presentation',
        violation: 'Presentation should not depend on Infrastructure directly'
      });
    }
    
    return violations;
  }

  getMetadata() {
    return {
      type: 'architecture',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'design_layers',
        'generate_use_cases',
        'design_interfaces',
        'design_adapters',
        'validate_dependencies',
        'create_architecture_diagram'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      architecturePatterns: [
        'Clean Architecture',
        'Hexagonal Architecture',
        'Onion Architecture',
        'Dependency Inversion'
      ]
    };
  }
}