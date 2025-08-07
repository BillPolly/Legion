/**
 * CodeGenerationAgent - BT Agent for Clean Code Generation
 * 
 * Extends SDAgentBase to generate production-ready code following
 * Clean Code principles and all design artifacts
 */

import { SDAgentBase } from './SDAgentBase.js';

export class CodeGenerationAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'CodeGenerationAgent',
      description: 'Generates clean, production-ready code from design artifacts',
      methodologyRules: {
        naming: {
          mustBeDescriptive: (artifact) => artifact.namesAreDescriptive === true,
          mustFollowConvention: (artifact) => artifact.followsNamingConvention === true,
          mustAvoidAbbreviations: (artifact) => artifact.avoidsAbbreviations === true
        },
        functions: {
          mustBeSinglePurpose: (artifact) => artifact.singleResponsibility === true,
          mustBeSmall: (artifact) => artifact.linesOfCode <= 20,
          mustHaveFewParameters: (artifact) => artifact.parameterCount <= 3,
          mustAvoidSideEffects: (artifact) => artifact.sideEffectFree === true
        },
        classes: {
          mustFollowSRP: (artifact) => artifact.singleResponsibility === true,
          mustBeCoherent: (artifact) => artifact.cohesion === 'high',
          mustHaveLowCoupling: (artifact) => artifact.coupling === 'low',
          mustFollowDIP: (artifact) => artifact.dependencyInversion === true
        },
        code: {
          mustBeReadable: (artifact) => artifact.readabilityScore >= 8,
          mustBeTestable: (artifact) => artifact.testable === true,
          mustHandleErrors: (artifact) => artifact.errorHandling === true,
          mustBeDocumented: (artifact) => artifact.documented === true
        }
      }
    });
    
    this.workflowConfig = this.createWorkflowConfig();
  }

  getCurrentPhase() {
    return 'code-generation';
  }

  createWorkflowConfig() {
    return {
      type: 'sequence',
      id: 'code-generation-workflow',
      description: 'Generate clean production-ready code',
      children: [
        {
          type: 'action',
          id: 'retrieve-all-designs',
          tool: 'retrieve_context',
          description: 'Retrieve all design artifacts and tests',
          params: {
            query: {
              types: ['domain-model', 'clean-architecture', 'state-design', 'flux-architecture', 'test-suite'],
              projectId: '${input.projectId}'
            }
          }
        },
        {
          type: 'action',
          id: 'generate-project-structure',
          tool: 'generate_project_structure',
          description: 'Generate project directory structure',
          params: {
            architecture: '${results.retrieve-all-designs.context.architecture}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'parallel',
          id: 'generate-code-layers',
          description: 'Generate code for each architectural layer',
          children: [
            {
              type: 'action',
              id: 'generate-domain-code',
              tool: 'generate_domain_code',
              description: 'Generate domain layer code',
              params: {
                domainModel: '${results.retrieve-all-designs.context.domain}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'generate-application-code',
              tool: 'generate_application_code',
              description: 'Generate application layer code',
              params: {
                useCases: '${results.retrieve-all-designs.context.architecture.useCases}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'generate-infrastructure-code',
              tool: 'generate_infrastructure_code',
              description: 'Generate infrastructure layer code',
              params: {
                interfaces: '${results.retrieve-all-designs.context.architecture.interfaces}',
                projectId: '${input.projectId}'
              }
            },
            {
              type: 'action',
              id: 'generate-presentation-code',
              tool: 'generate_presentation_code',
              description: 'Generate presentation layer code',
              params: {
                views: '${results.retrieve-all-designs.context.flux.views}',
                projectId: '${input.projectId}'
              }
            }
          ]
        },
        {
          type: 'action',
          id: 'generate-state-management',
          tool: 'generate_state_management',
          description: 'Generate state management code',
          params: {
            stateDesign: '${results.retrieve-all-designs.context.state}',
            fluxArchitecture: '${results.retrieve-all-designs.context.flux}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'generate-test-code',
          tool: 'generate_test_code',
          description: 'Generate test implementation code',
          params: {
            testSuite: '${results.retrieve-all-designs.context.tests}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'generate-configuration',
          tool: 'generate_configuration',
          description: 'Generate configuration and build files',
          params: {
            projectStructure: '${results.generate-project-structure.structure}',
            projectId: '${input.projectId}'
          }
        },
        {
          type: 'action',
          id: 'validate-code-quality',
          tool: 'validate_code_quality',
          description: 'Validate generated code quality',
          params: {
            domainCode: '${results.generate-domain-code.code}',
            applicationCode: '${results.generate-application-code.code}',
            infrastructureCode: '${results.generate-infrastructure-code.code}',
            presentationCode: '${results.generate-presentation-code.code}'
          }
        },
        {
          type: 'action',
          id: 'store-code-artifacts',
          tool: 'store_artifact',
          description: 'Store generated code artifacts',
          params: {
            artifact: {
              type: 'generated-code',
              data: {
                projectStructure: '${results.generate-project-structure.structure}',
                domainCode: '${results.generate-domain-code.code}',
                applicationCode: '${results.generate-application-code.code}',
                infrastructureCode: '${results.generate-infrastructure-code.code}',
                presentationCode: '${results.generate-presentation-code.code}',
                stateManagement: '${results.generate-state-management.code}',
                tests: '${results.generate-test-code.code}',
                configuration: '${results.generate-configuration.config}',
                validation: '${results.validate-code-quality}'
              },
              metadata: {
                phase: 'code-generation',
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
    
    if (type !== 'generate_code') {
      return {
        success: false,
        error: 'CodeGenerationAgent only handles generate_code messages'
      };
    }
    
    try {
      // Build context for code generation
      const context = await this.buildContext('code', {
        projectId: payload.projectId
      });
      
      // Determine code generation strategy using LLM
      const codeStrategy = await this.decideCodeStrategy(context);
      
      // Create execution context
      const executionContext = this.createExecutionContext({
        input: {
          projectId: payload.projectId,
          codeStrategy
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
      
      // Validate generated code
      const validation = this.validateGeneratedCode(result);
      
      return {
        success: result.success,
        data: {
          ...result.data,
          validation,
          codeStrategy,
          projectId: executionContext.input.projectId,
          phase: this.getCurrentPhase()
        }
      };
      
    } catch (error) {
      console.error(`[CodeGenerationAgent] Error generating code:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async decideCodeStrategy(context) {
    const prompt = `Based on all design artifacts, determine the code generation strategy:

Domain Model:
${JSON.stringify(context.artifacts.domain, null, 2)}

Architecture:
${JSON.stringify(context.artifacts.architecture, null, 2)}

Test Strategy:
${JSON.stringify(context.artifacts.tests?.strategy, null, 2)}

Determine the code generation strategy including:
1. Programming language and version
2. Framework choices for each layer
3. Package manager and build tools
4. Code style and formatting rules
5. Documentation approach (JSDoc, TypeDoc, etc.)
6. Error handling patterns

Return as JSON:
{
  "language": {
    "name": "typescript|javascript|python|java",
    "version": "version string"
  },
  "frameworks": {
    "domain": "framework name or 'vanilla'",
    "application": "framework name",
    "infrastructure": "framework name",
    "presentation": "framework name"
  },
  "tooling": {
    "packageManager": "npm|yarn|pnpm",
    "buildTool": "webpack|vite|rollup|esbuild",
    "linter": "eslint|tslint|pylint",
    "formatter": "prettier|black"
  },
  "codeStyle": {
    "indentation": "spaces|tabs",
    "indentSize": 2,
    "quotes": "single|double",
    "semicolons": true/false
  },
  "documentation": {
    "format": "jsdoc|tsdoc|sphinx",
    "inline": true/false,
    "generateDocs": true/false
  },
  "errorHandling": {
    "pattern": "try-catch|result-type|maybe-monad",
    "logging": true/false
  },
  "reasoning": "explanation"
}`;

    const decision = await this.makeLLMDecision(prompt, context);
    return decision;
  }

  async executeBTWorkflow(workflow, context) {
    console.log(`[CodeGenerationAgent] Executing workflow:`, workflow.id);
    
    // Placeholder implementation
    return {
      success: true,
      data: {
        workflowId: workflow.id,
        executionTime: Date.now(),
        results: {
          'generate-project-structure': {
            structure: {
              directories: [
                'src/domain',
                'src/application',
                'src/infrastructure',
                'src/presentation',
                'tests/unit',
                'tests/integration'
              ]
            }
          },
          'generate-domain-code': {
            code: [
              {
                id: 'code-user-entity',
                file: 'src/domain/entities/User.ts',
                content: 'export class User { ... }',
                namesAreDescriptive: true,
                followsNamingConvention: true,
                avoidsAbbreviations: true,
                singleResponsibility: true,
                cohesion: 'high',
                coupling: 'low',
                dependencyInversion: true,
                readabilityScore: 9,
                testable: true,
                errorHandling: true,
                documented: true
              }
            ]
          },
          'generate-application-code': {
            code: [
              {
                id: 'code-create-user-usecase',
                file: 'src/application/usecases/CreateUser.ts',
                content: 'export class CreateUserUseCase { ... }',
                singleResponsibility: true,
                linesOfCode: 18,
                parameterCount: 2,
                sideEffectFree: true
              }
            ]
          },
          'generate-infrastructure-code': {
            code: [
              {
                id: 'code-user-repository',
                file: 'src/infrastructure/repositories/UserRepository.ts',
                content: 'export class UserRepository implements IUserRepository { ... }'
              }
            ]
          },
          'generate-presentation-code': {
            code: [
              {
                id: 'code-user-controller',
                file: 'src/presentation/controllers/UserController.ts',
                content: 'export class UserController { ... }'
              }
            ]
          },
          'generate-state-management': {
            code: [
              {
                id: 'code-user-store',
                file: 'src/stores/UserStore.ts',
                content: 'export const userStore = { ... }'
              }
            ]
          },
          'generate-test-code': {
            code: [
              {
                id: 'code-user-test',
                file: 'tests/unit/User.test.ts',
                content: 'describe("User", () => { ... })'
              }
            ]
          },
          'generate-configuration': {
            config: {
              'package.json': { name: 'project', version: '1.0.0' },
              'tsconfig.json': { compilerOptions: {} },
              '.eslintrc.json': { rules: {} }
            }
          }
        }
      }
    };
  }

  validateGeneratedCode(result) {
    const validationResults = {
      valid: true,
      violations: [],
      warnings: []
    };
    
    // Validate domain code
    const domainCode = result.data?.results?.['generate-domain-code']?.code || [];
    domainCode.forEach(code => {
      // Validate naming
      const namingValidation = this.validateMethodology({ ...code, type: 'naming' });
      if (!namingValidation.valid) {
        validationResults.violations.push({
          artifact: `naming-${code.id}`,
          violations: namingValidation.violations
        });
      }
      
      // Validate classes
      if (code.file.includes('entities') || code.file.includes('domain')) {
        const classValidation = this.validateMethodology({ ...code, type: 'classes' });
        if (!classValidation.valid) {
          validationResults.violations.push({
            artifact: `class-${code.id}`,
            violations: classValidation.violations
          });
        }
      }
      
      // Validate general code quality
      const codeValidation = this.validateMethodology({ ...code, type: 'code' });
      if (!codeValidation.valid) {
        validationResults.violations.push({
          artifact: `code-${code.id}`,
          violations: codeValidation.violations
        });
      }
    });
    
    // Validate application code
    const applicationCode = result.data?.results?.['generate-application-code']?.code || [];
    applicationCode.forEach(code => {
      const functionValidation = this.validateMethodology({ ...code, type: 'functions' });
      if (!functionValidation.valid) {
        validationResults.violations.push({
          artifact: `function-${code.id}`,
          violations: functionValidation.violations
        });
      }
    });
    
    // Check for Clean Code violations
    const cleanCodeViolations = this.checkCleanCodeViolations(result);
    if (cleanCodeViolations.length > 0) {
      validationResults.valid = false;
      validationResults.violations.push(...cleanCodeViolations);
    }
    
    return validationResults;
  }

  checkCleanCodeViolations(result) {
    const violations = [];
    
    // Check all generated code for common violations
    const allCode = [
      ...(result.data?.results?.['generate-domain-code']?.code || []),
      ...(result.data?.results?.['generate-application-code']?.code || []),
      ...(result.data?.results?.['generate-infrastructure-code']?.code || []),
      ...(result.data?.results?.['generate-presentation-code']?.code || [])
    ];
    
    allCode.forEach(code => {
      // Check for large functions
      if (code.linesOfCode && code.linesOfCode > 20) {
        violations.push({
          artifact: code.id,
          violation: `Function exceeds 20 lines (has ${code.linesOfCode})`
        });
      }
      
      // Check for too many parameters
      if (code.parameterCount && code.parameterCount > 3) {
        violations.push({
          artifact: code.id,
          violation: `Function has too many parameters (${code.parameterCount} > 3)`
        });
      }
      
      // Check for low readability
      if (code.readabilityScore && code.readabilityScore < 8) {
        violations.push({
          artifact: code.id,
          violation: `Low readability score (${code.readabilityScore} < 8)`
        });
      }
    });
    
    return violations;
  }

  getMetadata() {
    return {
      type: 'code-generation',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'generate_project_structure',
        'generate_domain_code',
        'generate_application_code',
        'generate_infrastructure_code',
        'generate_presentation_code',
        'generate_state_management',
        'generate_test_code',
        'generate_configuration',
        'validate_code_quality'
      ],
      methodologyRules: Object.keys(this.methodologyRules),
      cleanCodePrinciples: [
        'Single Responsibility',
        'Open/Closed',
        'Liskov Substitution',
        'Interface Segregation',
        'Dependency Inversion',
        'DRY (Don\'t Repeat Yourself)',
        'KISS (Keep It Simple)',
        'YAGNI (You Aren\'t Gonna Need It)'
      ]
    };
  }
}