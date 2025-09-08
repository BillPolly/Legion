/**
 * SDSystemKnowledge - Knowledge base about the SD system and methodologies
 */

export class SDSystemKnowledge {
  constructor() {
    this.methodologies = this.initializeMethodologies();
    this.agents = this.initializeAgents();
    this.phases = this.initializePhases();
    this.patterns = this.initializePatterns();
  }

  initializeMethodologies() {
    return {
      ddd: {
        name: 'Domain-Driven Design',
        description: 'Strategic and tactical design patterns for complex domain modeling',
        concepts: [
          'Bounded Contexts - Linguistic boundaries around domain models',
          'Aggregates - Consistency boundaries for related entities',
          'Entities - Objects with identity that persist over time',
          'Value Objects - Immutable objects defined by their attributes',
          'Domain Events - Significant business occurrences',
          'Ubiquitous Language - Shared vocabulary between developers and domain experts'
        ],
        benefits: [
          'Aligns software with business domain',
          'Reduces complexity through bounded contexts',
          'Improves communication with ubiquitous language'
        ]
      },
      cleanArchitecture: {
        name: 'Clean Architecture',
        description: 'Layered architecture with dependency inversion',
        layers: [
          'Domain Layer - Business logic and entities',
          'Application Layer - Use cases and application services',
          'Infrastructure Layer - External concerns (DB, APIs)',
          'Presentation Layer - User interface and controllers'
        ],
        principles: [
          'Dependency Rule - Dependencies point inward',
          'Independent of Frameworks',
          'Testable business rules',
          'Independent of UI',
          'Independent of Database'
        ]
      },
      immutableArchitecture: {
        name: 'Immutable Architecture',
        description: 'Design based on immutable data structures and pure functions',
        principles: [
          'All state is immutable',
          'State changes create new state objects',
          'Pure functions for all transformations',
          'No side effects in business logic',
          'Event sourcing for state history'
        ],
        benefits: [
          'Predictable state changes',
          'Easy to test and debug',
          'Natural undo/redo support',
          'Thread-safe by default'
        ]
      },
      flux: {
        name: 'Flux Architecture',
        description: 'Unidirectional data flow pattern',
        components: [
          'Actions - Payloads of information',
          'Dispatcher - Central hub for actions',
          'Stores - Containers for application state',
          'Views - React components that listen to stores'
        ],
        flow: 'Action → Dispatcher → Store → View → Action'
      },
      tdd: {
        name: 'Test-Driven Development',
        description: 'Write tests before implementation',
        cycle: [
          'Red - Write a failing test',
          'Green - Write minimal code to pass',
          'Refactor - Improve code while keeping tests green'
        ],
        benefits: [
          'Better code design',
          'Living documentation',
          'Regression prevention',
          'Confidence in refactoring'
        ]
      },
      cleanCode: {
        name: 'Clean Code',
        description: 'Principles for writing readable, maintainable code',
        principles: [
          'Meaningful names',
          'Small functions',
          'Single Responsibility',
          'DRY (Don\'t Repeat Yourself)',
          'Error handling',
          'Code formatting consistency'
        ]
      }
    };
  }

  initializeAgents() {
    return {
      RequirementsAgent: {
        name: 'Requirements Agent',
        phase: 'requirements',
        purpose: 'Parse and structure requirements into user stories and acceptance criteria',
        inputs: ['Raw requirements text'],
        outputs: ['User stories', 'Acceptance criteria', 'Non-functional requirements'],
        validations: [
          'Requirements completeness',
          'Clarity and testability',
          'Conflict detection'
        ]
      },
      DomainModelingAgent: {
        name: 'Domain Modeling Agent',
        phase: 'domain-modeling',
        purpose: 'Create DDD domain models from requirements',
        inputs: ['Structured requirements'],
        outputs: ['Bounded contexts', 'Entities', 'Value objects', 'Aggregates', 'Domain events'],
        validations: [
          'DDD compliance',
          'Invariant protection',
          'Aggregate boundaries'
        ]
      },
      ArchitectureAgent: {
        name: 'Architecture Agent',
        phase: 'architecture-design',
        purpose: 'Design clean architecture with proper layering',
        inputs: ['Domain model'],
        outputs: ['Layer definitions', 'Use cases', 'Interfaces', 'Dependency flow'],
        validations: [
          'Dependency rule compliance',
          'Layer isolation',
          'Interface segregation'
        ]
      },
      StateDesignAgent: {
        name: 'State Design Agent',
        phase: 'state-design',
        purpose: 'Design immutable state management',
        inputs: ['Architecture design'],
        outputs: ['State schemas', 'State transitions', 'Reducers'],
        validations: [
          'Immutability checks',
          'Pure function validation',
          'State consistency'
        ]
      },
      FluxAgent: {
        name: 'Flux Agent',
        phase: 'flux-architecture',
        purpose: 'Implement unidirectional data flow',
        inputs: ['State design'],
        outputs: ['Actions', 'Stores', 'Dispatchers', 'View bindings'],
        validations: [
          'Unidirectional flow',
          'Action consistency',
          'Store isolation'
        ]
      },
      TestGenerationAgent: {
        name: 'Test Generation Agent',
        phase: 'testing',
        purpose: 'Generate comprehensive test suites',
        inputs: ['All design artifacts'],
        outputs: ['Unit tests', 'Integration tests', 'E2E tests'],
        validations: [
          'Coverage requirements',
          'Test independence',
          'Assertion quality'
        ]
      },
      CodeGenerationAgent: {
        name: 'Code Generation Agent',
        phase: 'implementation',
        purpose: 'Generate production code from designs',
        inputs: ['All design artifacts', 'Test specifications'],
        outputs: ['Source code', 'Configuration files', 'Documentation'],
        validations: [
          'Compilation checks',
          'Linting',
          'Type safety'
        ]
      },
      QualityAssuranceAgent: {
        name: 'Quality Assurance Agent',
        phase: 'quality-assurance',
        purpose: 'Validate all methodologies and fix issues',
        inputs: ['All artifacts'],
        outputs: ['Validation reports', 'Fixed code', 'Quality metrics'],
        validations: [
          'All methodology compliance',
          'Performance standards',
          'Security checks'
        ]
      },
      LiveTestingAgent: {
        name: 'Live Testing Agent',
        phase: 'live-testing',
        purpose: 'Run applications and capture runtime behavior',
        inputs: ['Generated code'],
        outputs: ['Runtime logs', 'Performance metrics', 'Error reports'],
        capabilities: [
          'Application startup',
          'WebSocket log streaming',
          'API endpoint testing',
          'Error pattern detection'
        ]
      }
    };
  }

  initializePhases() {
    return [
      {
        name: 'requirements',
        order: 1,
        agent: 'RequirementsAgent',
        duration: '5-10 minutes',
        description: 'Analyze and structure requirements'
      },
      {
        name: 'domain-modeling',
        order: 2,
        agent: 'DomainModelingAgent',
        duration: '10-15 minutes',
        description: 'Create DDD domain model'
      },
      {
        name: 'architecture-design',
        order: 3,
        agent: 'ArchitectureAgent',
        duration: '15-20 minutes',
        description: 'Design clean architecture'
      },
      {
        name: 'state-design',
        order: 4,
        agent: 'StateDesignAgent',
        duration: '10-15 minutes',
        description: 'Design immutable state'
      },
      {
        name: 'flux-architecture',
        order: 5,
        agent: 'FluxAgent',
        duration: '10-15 minutes',
        description: 'Implement data flow'
      },
      {
        name: 'testing',
        order: 6,
        agent: 'TestGenerationAgent',
        duration: '10-15 minutes',
        description: 'Generate test suites'
      },
      {
        name: 'implementation',
        order: 7,
        agent: 'CodeGenerationAgent',
        duration: '30-45 minutes',
        description: 'Generate production code'
      },
      {
        name: 'quality-assurance',
        order: 8,
        agent: 'QualityAssuranceAgent',
        duration: '10-15 minutes',
        description: 'Validate and fix issues'
      },
      {
        name: 'live-testing',
        order: 9,
        agent: 'LiveTestingAgent',
        duration: '15-20 minutes',
        description: 'Runtime validation'
      }
    ];
  }

  initializePatterns() {
    return {
      validationRegeneration: {
        name: 'Validation-Regeneration Loop',
        description: 'Core pattern for achieving quality through iteration',
        steps: [
          'Generate artifact',
          'Validate against rules',
          'Identify issues',
          'Regenerate with fixes',
          'Repeat until valid'
        ]
      },
      databaseCentric: {
        name: 'Database-Centric Design',
        description: 'All artifacts stored in MongoDB for traceability',
        benefits: [
          'Complete audit trail',
          'Pattern reuse',
          'Impact analysis',
          'Learning from history'
        ]
      },
      hybridValidation: {
        name: 'Hybrid Validation',
        description: 'Combines deterministic and LLM validation',
        types: [
          'Structural - Syntax and format',
          'Semantic - Meaning and logic',
          'Methodological - Pattern compliance',
          'Contextual - Consistency with other artifacts'
        ]
      }
    };
  }

  /**
   * Get explanation for a methodology
   */
  getMethodologyExplanation(methodologyName) {
    const methodology = this.methodologies[methodologyName.toLowerCase().replace(/\s+/g, '')];
    if (!methodology) {
      return `Unknown methodology: ${methodologyName}`;
    }
    
    return `## ${methodology.name}\n\n${methodology.description}\n\n${
      methodology.concepts ? '### Key Concepts\n' + methodology.concepts.map(c => `- ${c}`).join('\n') : ''
    }${
      methodology.principles ? '\n\n### Principles\n' + methodology.principles.map(p => `- ${p}`).join('\n') : ''
    }${
      methodology.benefits ? '\n\n### Benefits\n' + methodology.benefits.map(b => `- ${b}`).join('\n') : ''
    }`;
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentName) {
    const agent = this.agents[agentName];
    if (!agent) {
      return `Unknown agent: ${agentName}`;
    }
    
    return `## ${agent.name}\n\n**Purpose**: ${agent.purpose}\n\n**Phase**: ${agent.phase}\n\n### Inputs\n${
      agent.inputs.map(i => `- ${i}`).join('\n')
    }\n\n### Outputs\n${
      agent.outputs.map(o => `- ${o}`).join('\n')
    }\n\n### Validations\n${
      agent.validations ? agent.validations.map(v => `- ${v}`).join('\n') : 'N/A'
    }`;
  }

  /**
   * Get phase information
   */
  getPhaseInfo(phaseName) {
    const phase = this.phases.find(p => p.name === phaseName);
    if (!phase) {
      return `Unknown phase: ${phaseName}`;
    }
    
    return `## Phase: ${phase.name}\n\n**Order**: ${phase.order}\n**Agent**: ${phase.agent}\n**Duration**: ${phase.duration}\n**Description**: ${phase.description}`;
  }

  /**
   * Get workflow overview
   */
  getWorkflowOverview() {
    return `# SD System Workflow\n\nThe SD system follows a ${this.phases.length}-phase workflow:\n\n${
      this.phases.map(p => `${p.order}. **${p.name}** (${p.duration}) - ${p.description}`).join('\n')
    }\n\n## Total Time\nApproximately 2-3 hours for a complete application\n\n## Key Patterns\n${
      Object.values(this.patterns).map(p => `- **${p.name}**: ${p.description}`).join('\n')
    }`;
  }

  /**
   * Search knowledge base
   */
  search(query) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    // Search methodologies
    for (const [key, methodology] of Object.entries(this.methodologies)) {
      if (key.includes(queryLower) || 
          methodology.name.toLowerCase().includes(queryLower) ||
          methodology.description.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'methodology',
          name: methodology.name,
          content: this.getMethodologyExplanation(key)
        });
      }
    }
    
    // Search agents
    for (const [key, agent] of Object.entries(this.agents)) {
      if (key.toLowerCase().includes(queryLower) ||
          agent.name.toLowerCase().includes(queryLower) ||
          agent.purpose.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'agent',
          name: agent.name,
          content: this.getAgentInfo(key)
        });
      }
    }
    
    // Search phases
    for (const phase of this.phases) {
      if (phase.name.includes(queryLower) ||
          phase.description.toLowerCase().includes(queryLower)) {
        results.push({
          type: 'phase',
          name: phase.name,
          content: this.getPhaseInfo(phase.name)
        });
      }
    }
    
    return results;
  }
}