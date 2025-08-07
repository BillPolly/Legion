/**
 * SDPlanningProfile - Software Development planning profile for Legion
 * 
 * Extends ProfilePlanner to provide SD-specific BT generation for autonomous
 * software development using all six methodologies
 */

export class SDPlanningProfile {
  constructor() {
    this.profiles = this.initializeProfiles();
  }

  initializeProfiles() {
    return {
      'sd-full': this.createFullSDProfile(),
      'sd-requirements': this.createRequirementsProfile(),
      'sd-domain': this.createDomainProfile(),
      'sd-architecture': this.createArchitectureProfile(),
      'sd-implementation': this.createImplementationProfile(),
      'sd-testing': this.createTestingProfile()
    };
  }

  createFullSDProfile() {
    return {
      name: 'sd-full',
      description: 'Complete software development lifecycle using all six methodologies',
      requiredModules: ['sd', 'file', 'ai-generation'],
      maxSteps: 100,
      
      // Allowable actions for BT generation - maps to SD tools
      allowableActions: [
        // Requirements Analysis
        {
          type: 'parse_requirements',
          description: 'Parse and analyze requirements text',
          inputs: ['requirementsText'],
          outputs: ['parsedRequirements']
        },
        {
          type: 'generate_user_stories',
          description: 'Generate user stories from requirements',
          inputs: ['parsedRequirements'],
          outputs: ['userStories']
        },
        {
          type: 'generate_acceptance_criteria',
          description: 'Generate acceptance criteria for user stories',
          inputs: ['userStories'],
          outputs: ['acceptanceCriteria']
        },
        
        // Domain Modeling (DDD)
        {
          type: 'identify_bounded_contexts',
          description: 'Identify bounded contexts from requirements',
          inputs: ['parsedRequirements'],
          outputs: ['boundedContexts']
        },
        {
          type: 'model_entities',
          description: 'Model domain entities with invariants',
          inputs: ['boundedContexts', 'parsedRequirements'],
          outputs: ['entities']
        },
        {
          type: 'identify_aggregates',
          description: 'Identify aggregate roots and boundaries',
          inputs: ['entities'],
          outputs: ['aggregates']
        },
        {
          type: 'extract_domain_events',
          description: 'Extract domain events from entities',
          inputs: ['entities', 'aggregates'],
          outputs: ['domainEvents']
        },
        
        // Clean Architecture
        {
          type: 'design_layers',
          description: 'Design clean architecture layers',
          inputs: ['boundedContexts'],
          outputs: ['layers']
        },
        {
          type: 'generate_use_cases',
          description: 'Generate use cases from requirements',
          inputs: ['userStories', 'entities'],
          outputs: ['useCases']
        },
        {
          type: 'design_interfaces',
          description: 'Design interfaces for boundaries',
          inputs: ['useCases', 'layers'],
          outputs: ['interfaces']
        },
        
        // State Design (Immutable + Flux)
        {
          type: 'design_state_structure',
          description: 'Design immutable state structure',
          inputs: ['entities', 'aggregates'],
          outputs: ['stateStructure']
        },
        {
          type: 'design_actions',
          description: 'Design Flux actions',
          inputs: ['useCases', 'domainEvents'],
          outputs: ['actions']
        },
        {
          type: 'design_reducers',
          description: 'Design pure reducers',
          inputs: ['stateStructure', 'actions'],
          outputs: ['reducers']
        },
        
        // Test Generation (TDD)
        {
          type: 'generate_test_specs',
          description: 'Generate test specifications',
          inputs: ['useCases', 'acceptanceCriteria'],
          outputs: ['testSpecs']
        },
        {
          type: 'generate_unit_tests',
          description: 'Generate unit tests',
          inputs: ['entities', 'useCases', 'testSpecs'],
          outputs: ['unitTests']
        },
        {
          type: 'generate_integration_tests',
          description: 'Generate integration tests',
          inputs: ['useCases', 'interfaces', 'testSpecs'],
          outputs: ['integrationTests']
        },
        
        // Code Generation (Clean Code)
        {
          type: 'generate_entity_code',
          description: 'Generate entity implementation code',
          inputs: ['entities', 'unitTests'],
          outputs: ['entityCode']
        },
        {
          type: 'generate_use_case_code',
          description: 'Generate use case implementation',
          inputs: ['useCases', 'interfaces', 'unitTests'],
          outputs: ['useCaseCode']
        },
        {
          type: 'generate_adapter_code',
          description: 'Generate adapter implementations',
          inputs: ['interfaces', 'integrationTests'],
          outputs: ['adapterCode']
        },
        {
          type: 'generate_documentation',
          description: 'Generate comprehensive documentation',
          inputs: ['parsedRequirements', 'entities', 'useCases'],
          outputs: ['documentation']
        },
        
        // Quality Assurance
        {
          type: 'validate_architecture',
          description: 'Validate clean architecture compliance',
          inputs: ['entityCode', 'useCaseCode', 'adapterCode'],
          outputs: ['architectureValidation']
        },
        {
          type: 'validate_immutability',
          description: 'Validate immutability constraints',
          inputs: ['stateStructure', 'reducers'],
          outputs: ['immutabilityValidation']
        },
        {
          type: 'run_tests',
          description: 'Execute all generated tests',
          inputs: ['unitTests', 'integrationTests'],
          outputs: ['testResults']
        },
        {
          type: 'analyze_code_quality',
          description: 'Analyze code quality metrics',
          inputs: ['entityCode', 'useCaseCode', 'adapterCode'],
          outputs: ['qualityMetrics']
        },
        
        // Database Operations
        {
          type: 'store_artifact',
          description: 'Store artifact in design database',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        },
        {
          type: 'retrieve_context',
          description: 'Retrieve context from database',
          inputs: ['query'],
          outputs: ['context']
        }
      ],
      
      // Context prompts for LLM
      contextPrompts: [
        'You are building a software system using six integrated methodologies:',
        '1. Domain-Driven Design (DDD) for domain modeling',
        '2. Clean Architecture for system structure',
        '3. Immutable Design for state management',
        '4. Flux Architecture for unidirectional data flow',
        '5. Test-Driven Development (TDD) for quality',
        '6. Clean Code principles for maintainability',
        '',
        'Follow this top-down workflow:',
        '1. Analyze requirements and generate user stories',
        '2. Model the domain using DDD principles',
        '3. Design clean architecture with proper layers',
        '4. Design immutable state with Flux patterns',
        '5. Generate comprehensive tests first (TDD)',
        '6. Generate clean, maintainable code',
        '7. Validate everything meets quality standards'
      ].join('\n'),
      
      defaultInputs: ['requirementsText'],
      defaultOutputs: ['deployableProject']
    };
  }

  createRequirementsProfile() {
    return {
      name: 'sd-requirements',
      description: 'Requirements analysis and user story generation',
      requiredModules: ['sd'],
      maxSteps: 20,
      allowableActions: [
        {
          type: 'parse_requirements',
          description: 'Parse and analyze requirements text',
          inputs: ['requirementsText'],
          outputs: ['parsedRequirements']
        },
        {
          type: 'generate_user_stories',
          description: 'Generate user stories from requirements',
          inputs: ['parsedRequirements'],
          outputs: ['userStories']
        },
        {
          type: 'generate_acceptance_criteria',
          description: 'Generate acceptance criteria for user stories',
          inputs: ['userStories'],
          outputs: ['acceptanceCriteria']
        },
        {
          type: 'prioritize_requirements',
          description: 'Prioritize requirements by business value',
          inputs: ['parsedRequirements', 'userStories'],
          outputs: ['prioritizedRequirements']
        },
        {
          type: 'store_artifact',
          description: 'Store artifact in design database',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        }
      ],
      contextPrompts: 'Focus on understanding and structuring requirements clearly.',
      defaultInputs: ['requirementsText'],
      defaultOutputs: ['userStories', 'acceptanceCriteria']
    };
  }

  createDomainProfile() {
    return {
      name: 'sd-domain',
      description: 'Domain modeling using DDD principles',
      requiredModules: ['sd'],
      maxSteps: 30,
      allowableActions: [
        {
          type: 'retrieve_context',
          description: 'Retrieve requirements context',
          inputs: ['query'],
          outputs: ['requirementsContext']
        },
        {
          type: 'identify_bounded_contexts',
          description: 'Identify bounded contexts',
          inputs: ['requirementsContext'],
          outputs: ['boundedContexts']
        },
        {
          type: 'model_entities',
          description: 'Model domain entities',
          inputs: ['boundedContexts', 'requirementsContext'],
          outputs: ['entities']
        },
        {
          type: 'identify_value_objects',
          description: 'Identify value objects',
          inputs: ['entities'],
          outputs: ['valueObjects']
        },
        {
          type: 'identify_aggregates',
          description: 'Identify aggregate roots',
          inputs: ['entities', 'valueObjects'],
          outputs: ['aggregates']
        },
        {
          type: 'extract_domain_events',
          description: 'Extract domain events',
          inputs: ['entities', 'aggregates'],
          outputs: ['domainEvents']
        },
        {
          type: 'build_ubiquitous_language',
          description: 'Build ubiquitous language',
          inputs: ['entities', 'boundedContexts'],
          outputs: ['ubiquitousLanguage']
        },
        {
          type: 'store_artifact',
          description: 'Store domain artifacts',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        }
      ],
      contextPrompts: 'Apply Domain-Driven Design principles to model the business domain accurately.',
      defaultInputs: ['requirementsContext'],
      defaultOutputs: ['entities', 'aggregates', 'domainEvents']
    };
  }

  createArchitectureProfile() {
    return {
      name: 'sd-architecture',
      description: 'Clean Architecture design with proper layering',
      requiredModules: ['sd'],
      maxSteps: 25,
      allowableActions: [
        {
          type: 'retrieve_context',
          description: 'Retrieve domain context',
          inputs: ['query'],
          outputs: ['domainContext']
        },
        {
          type: 'design_layers',
          description: 'Design architecture layers',
          inputs: ['domainContext'],
          outputs: ['layers']
        },
        {
          type: 'generate_use_cases',
          description: 'Generate use cases',
          inputs: ['domainContext'],
          outputs: ['useCases']
        },
        {
          type: 'design_interfaces',
          description: 'Design boundary interfaces',
          inputs: ['useCases', 'layers'],
          outputs: ['interfaces']
        },
        {
          type: 'design_adapters',
          description: 'Design adapter patterns',
          inputs: ['interfaces'],
          outputs: ['adapters']
        },
        {
          type: 'validate_dependencies',
          description: 'Validate dependency directions',
          inputs: ['layers', 'useCases', 'interfaces'],
          outputs: ['dependencyValidation']
        },
        {
          type: 'store_artifact',
          description: 'Store architecture artifacts',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        }
      ],
      contextPrompts: 'Design a clean architecture with proper separation of concerns and dependency inversion.',
      defaultInputs: ['domainContext'],
      defaultOutputs: ['layers', 'useCases', 'interfaces']
    };
  }

  createImplementationProfile() {
    return {
      name: 'sd-implementation',
      description: 'Code implementation with clean code principles',
      requiredModules: ['sd', 'file'],
      maxSteps: 50,
      allowableActions: [
        {
          type: 'retrieve_context',
          description: 'Retrieve full project context',
          inputs: ['query'],
          outputs: ['projectContext']
        },
        {
          type: 'generate_entity_code',
          description: 'Generate entity implementations',
          inputs: ['projectContext'],
          outputs: ['entityCode']
        },
        {
          type: 'generate_use_case_code',
          description: 'Generate use case implementations',
          inputs: ['projectContext'],
          outputs: ['useCaseCode']
        },
        {
          type: 'generate_adapter_code',
          description: 'Generate adapter implementations',
          inputs: ['projectContext'],
          outputs: ['adapterCode']
        },
        {
          type: 'generate_state_code',
          description: 'Generate state management code',
          inputs: ['projectContext'],
          outputs: ['stateCode']
        },
        {
          type: 'file_write',
          description: 'Write code to file',
          inputs: ['filepath', 'content'],
          outputs: ['writtenFile']
        },
        {
          type: 'generate_documentation',
          description: 'Generate documentation',
          inputs: ['projectContext'],
          outputs: ['documentation']
        },
        {
          type: 'analyze_code_quality',
          description: 'Analyze code quality',
          inputs: ['entityCode', 'useCaseCode', 'adapterCode'],
          outputs: ['qualityMetrics']
        },
        {
          type: 'store_artifact',
          description: 'Store implementation artifacts',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        }
      ],
      contextPrompts: 'Generate clean, maintainable code following SOLID principles and clean code practices.',
      defaultInputs: ['projectContext'],
      defaultOutputs: ['deployableCode', 'documentation']
    };
  }

  createTestingProfile() {
    return {
      name: 'sd-testing',
      description: 'Test generation and execution using TDD',
      requiredModules: ['sd'],
      maxSteps: 30,
      allowableActions: [
        {
          type: 'retrieve_context',
          description: 'Retrieve implementation context',
          inputs: ['query'],
          outputs: ['implementationContext']
        },
        {
          type: 'generate_test_specs',
          description: 'Generate test specifications',
          inputs: ['implementationContext'],
          outputs: ['testSpecs']
        },
        {
          type: 'generate_unit_tests',
          description: 'Generate unit tests',
          inputs: ['testSpecs', 'implementationContext'],
          outputs: ['unitTests']
        },
        {
          type: 'generate_integration_tests',
          description: 'Generate integration tests',
          inputs: ['testSpecs', 'implementationContext'],
          outputs: ['integrationTests']
        },
        {
          type: 'generate_e2e_tests',
          description: 'Generate end-to-end tests',
          inputs: ['testSpecs', 'implementationContext'],
          outputs: ['e2eTests']
        },
        {
          type: 'run_tests',
          description: 'Execute tests',
          inputs: ['unitTests', 'integrationTests', 'e2eTests'],
          outputs: ['testResults']
        },
        {
          type: 'generate_coverage_report',
          description: 'Generate test coverage report',
          inputs: ['testResults'],
          outputs: ['coverageReport']
        },
        {
          type: 'store_artifact',
          description: 'Store test artifacts',
          inputs: ['artifact', 'metadata'],
          outputs: ['storedArtifact']
        }
      ],
      contextPrompts: 'Follow Test-Driven Development principles. Generate comprehensive tests before implementation.',
      defaultInputs: ['implementationContext'],
      defaultOutputs: ['testResults', 'coverageReport']
    };
  }

  getProfile(name) {
    return this.profiles[name];
  }

  listProfiles() {
    return Object.keys(this.profiles).map(key => ({
      name: key,
      description: this.profiles[key].description,
      actionCount: this.profiles[key].allowableActions.length
    }));
  }
}