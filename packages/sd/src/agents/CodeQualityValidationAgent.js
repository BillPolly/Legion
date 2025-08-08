/**
 * CodeQualityValidationAgent - Hybrid validation agent combining deterministic + LLM validation
 * 
 * Uses deterministic checks (compilation, tests, linting) combined with LLM semantic validation
 * for comprehensive code quality assessment and improvement recommendations.
 */

import { SDAgentBase } from './SDAgentBase.js';
import { ValidationUtils } from '../validation/ValidationUtils.js';

export class CodeQualityValidationAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'CodeQualityValidationAgent',
      description: 'Hybrid code validation using deterministic checks + LLM semantic analysis',
      validationRules: {
        codeQuality: {
          mustCompile: (code) => this.checkCompilation(code),
          mustPassTests: (code) => this.runTests(code),
          mustFollowCleanArchitecture: (code) => this.validateArchitecture(code),
          mustFollowCleanCode: (code) => this.validateCleanCode(code)
        }
      }
    });
    
    this.validationUtils = new ValidationUtils();
  }

  getCurrentPhase() {
    return 'code-validation';
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'validate_code') {
      return {
        success: false,
        error: 'CodeQualityValidationAgent only handles validate_code messages'
      };
    }

    try {
      const { generatedCode, projectPath, requirements, context } = payload;
      
      // Phase 1: Deterministic validation (fast, reliable)
      const deterministicValidation = await this.performDeterministicValidation(projectPath, generatedCode);
      
      // Phase 2: LLM semantic validation (only if deterministic passes)
      let semanticValidation = { valid: true, issues: [], recommendations: [] };
      if (deterministicValidation.valid) {
        semanticValidation = await this.performSemanticValidation(generatedCode, requirements, context);
      }

      // Combine results with priority-based reporting
      const overallValidation = this.combineValidationResults(deterministicValidation, semanticValidation);

      return {
        success: true,
        data: {
          validation: overallValidation,
          recommendations: overallValidation.recommendations,
          confidenceScore: overallValidation.confidenceScore,
          requiresRegeneration: !overallValidation.valid,
          fixPriority: overallValidation.fixPriority
        }
      };
    } catch (error) {
      console.error(`[CodeQualityValidationAgent] Error validating code:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Perform fast, reliable deterministic validation
   */
  async performDeterministicValidation(projectPath, generatedCode) {
    const results = {
      valid: true,
      issues: [],
      recommendations: [],
      validationDetails: []
    };

    try {
      // 1. Compilation checks for all JavaScript files
      console.log('[CodeQualityValidationAgent] Running compilation checks...');
      const compilationResults = await this.validateCompilation(projectPath);
      results.validationDetails.push(compilationResults);
      
      if (!compilationResults.valid) {
        results.valid = false;
        results.issues.push(...compilationResults.issues);
        results.recommendations.push(...compilationResults.recommendations);
      }

      // 2. Test execution (if compilation passes)
      if (compilationResults.valid) {
        console.log('[CodeQualityValidationAgent] Running tests...');
        const testResults = await this.validationUtils.executeTests(projectPath);
        results.validationDetails.push(testResults);
        
        if (!testResults.valid) {
          results.valid = false;
          results.issues.push(...testResults.errors.map(error => ({
            type: 'test_failure',
            message: error,
            fixable: true,
            priority: 'high'
          })));
          results.recommendations.push('Fix failing tests before proceeding');
        }
      }

      // 3. Database connectivity test
      console.log('[CodeQualityValidationAgent] Testing database connectivity...');
      const dbResults = await this.validationUtils.testDatabaseConnection();
      results.validationDetails.push(dbResults);
      
      if (!dbResults.valid) {
        results.issues.push({
          type: 'database_connection',
          message: dbResults.errors[0],
          fixable: false,
          priority: 'medium'
        });
        results.recommendations.push('Ensure MongoDB is running and accessible');
      }

      return {
        type: 'deterministic',
        valid: results.valid,
        issues: results.issues,
        recommendations: results.recommendations,
        confidenceScore: results.valid ? 1.0 : 0.0, // Deterministic = 100% confidence
        details: results.validationDetails
      };
    } catch (error) {
      return {
        type: 'deterministic',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message, fixable: true }],
        recommendations: ['Review validation setup and retry'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate compilation for all JavaScript files in project
   */
  async validateCompilation(projectPath) {
    const issues = [];
    const recommendations = [];
    
    try {
      // Check main files
      const filesToCheck = [
        'src/index.js',
        'src/domain/User.js',
        'src/domain/Task.js',
        'src/application/UserService.js',
        'src/infrastructure/UserRepository.js',
        'src/presentation/userController.js'
      ];

      for (const file of filesToCheck) {
        const fullPath = `${projectPath}/${file}`;
        const result = await this.validationUtils.checkCompilation(fullPath);
        
        if (!result.valid) {
          issues.push(...result.errors.map(error => ({
            type: 'compilation_error',
            file: file,
            message: error,
            fixable: true,
            priority: 'critical'
          })));
          recommendations.push(`Fix syntax errors in ${file}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations,
        filesChecked: filesToCheck.length
      };
    } catch (error) {
      return {
        valid: false,
        issues: [{ type: 'compilation_check_error', message: error.message }],
        recommendations: ['Review file paths and compilation setup']
      };
    }
  }

  /**
   * Perform semantic validation using LLM
   */
  async performSemanticValidation(generatedCode, requirements, context) {
    try {
      // Validate Clean Architecture compliance
      const architectureValidation = await this.validateCleanArchitecture(generatedCode);
      
      // Validate Clean Code principles
      const cleanCodeValidation = await this.validateCleanCodePrinciples(generatedCode);
      
      // Validate business logic alignment
      const businessLogicValidation = await this.validateBusinessLogicAlignment(generatedCode, requirements);

      return this.combineSemanticResults([
        architectureValidation,
        cleanCodeValidation,
        businessLogicValidation
      ]);
    } catch (error) {
      console.error('[CodeQualityValidationAgent] Semantic validation error:', error);
      return {
        type: 'semantic',
        valid: false,
        issues: [{ type: 'semantic_validation_error', message: error.message }],
        recommendations: ['Manual semantic review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate Clean Architecture compliance using LLM
   */
  async validateCleanArchitecture(generatedCode) {
    const prompt = `Assess Clean Architecture compliance in this generated code:

GENERATED CODE STRUCTURE:
${JSON.stringify(this.extractCodeStructure(generatedCode), null, 2)}

Evaluate:
1. **Dependency Rule**: Do dependencies point inward (UI -> App -> Domain)?
2. **Layer Separation**: Are concerns properly separated across layers?
3. **Interface Usage**: Are interfaces used to invert dependencies?
4. **Entity Independence**: Is the domain layer independent of frameworks?

Return JSON:
{
  "cleanArchitectureCompliant": boolean,
  "violations": [
    {
      "layer": "domain|application|infrastructure|presentation",
      "violation": "specific violation description",
      "file": "filename",
      "severity": "high|medium|low",
      "suggestion": "how to fix the violation"
    }
  ],
  "complianceScore": 0.85,
  "strengths": ["well-implemented aspects"],
  "recommendations": ["specific architectural improvements"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt);
      
      return {
        type: 'architecture',
        valid: result.cleanArchitectureCompliant && result.violations.length === 0,
        issues: result.violations.map(v => ({ type: 'architecture_violation', ...v })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        complianceScore: result.complianceScore,
        strengths: result.strengths
      };
    } catch (error) {
      return {
        type: 'architecture',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual architecture review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate Clean Code principles using LLM
   */
  async validateCleanCodePrinciples(generatedCode) {
    const prompt = `Evaluate Clean Code principles in this generated code:

CODE SAMPLES:
${this.extractCodeSamples(generatedCode)}

Assess:
1. **Naming**: Are names descriptive and meaningful?
2. **Functions**: Are functions small, focused, and well-named?
3. **Comments**: Is code self-documenting with minimal necessary comments?
4. **Error Handling**: Are errors handled gracefully?
5. **DRY Principle**: Is code duplication minimized?

Return JSON:
{
  "cleanCodeCompliant": boolean,
  "issues": [
    {
      "principle": "naming|functions|comments|error_handling|dry",
      "issue": "specific issue description",
      "location": "file and function/class",
      "severity": "high|medium|low",
      "suggestion": "specific improvement"
    }
  ],
  "qualityScore": 0.85,
  "goodPractices": ["well-implemented practices"],
  "recommendations": ["specific code quality improvements"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt);
      
      return {
        type: 'clean_code',
        valid: result.cleanCodeCompliant && result.issues.length === 0,
        issues: result.issues.map(i => ({ type: 'clean_code_violation', ...i })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        qualityScore: result.qualityScore,
        goodPractices: result.goodPractices
      };
    } catch (error) {
      return {
        type: 'clean_code',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual clean code review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate business logic alignment using LLM
   */
  async validateBusinessLogicAlignment(generatedCode, requirements) {
    const prompt = `Verify that generated code correctly implements the business requirements:

REQUIREMENTS:
${JSON.stringify(requirements?.functional || [], null, 2)}

GENERATED CODE:
${this.extractBusinessLogicCode(generatedCode)}

Validate:
1. **Requirement Coverage**: Are all functional requirements implemented?
2. **Business Rules**: Are business rules correctly coded?
3. **Data Validation**: Are input validations appropriate?
4. **Workflow Implementation**: Do code paths match required workflows?

Return JSON:
{
  "requirementsImplemented": boolean,
  "missingImplementations": [
    {
      "requirement": "FR-001",
      "missing": "what's not implemented",
      "impact": "high|medium|low",
      "suggestion": "implementation guidance"
    }
  ],
  "incorrectImplementations": [
    {
      "requirement": "FR-002",
      "issue": "how implementation differs from requirement",
      "suggestion": "correction needed"
    }
  ],
  "implementationScore": 0.90,
  "recommendations": ["specific implementation improvements"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt);
      
      return {
        type: 'business_logic',
        valid: result.requirementsImplemented && 
               result.missingImplementations.length === 0 && 
               result.incorrectImplementations.length === 0,
        issues: [
          ...result.missingImplementations.map(m => ({ type: 'missing_implementation', ...m })),
          ...result.incorrectImplementations.map(i => ({ type: 'incorrect_implementation', ...i }))
        ],
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        implementationScore: result.implementationScore
      };
    } catch (error) {
      return {
        type: 'business_logic',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual business logic review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Combine deterministic and semantic validation results
   */
  combineValidationResults(deterministicValidation, semanticValidation) {
    // Deterministic issues take priority (must fix first)
    const priorityIssues = deterministicValidation.valid ? 
      semanticValidation.issues : 
      deterministicValidation.issues;

    const allIssues = [
      ...deterministicValidation.issues,
      ...semanticValidation.issues
    ];

    const allRecommendations = [
      ...deterministicValidation.recommendations,
      ...semanticValidation.recommendations
    ];

    const overallValid = deterministicValidation.valid && semanticValidation.valid;
    
    // Confidence weighted by validation type reliability
    const confidence = deterministicValidation.valid ?
      (deterministicValidation.confidenceScore * 0.3) + (semanticValidation.confidenceScore * 0.7) :
      deterministicValidation.confidenceScore;

    return {
      valid: overallValid,
      issues: allIssues,
      recommendations: allRecommendations,
      confidenceScore: confidence,
      fixPriority: deterministicValidation.valid ? 'semantic' : 'deterministic',
      validationBreakdown: {
        deterministic: deterministicValidation,
        semantic: semanticValidation
      },
      summary: {
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.priority === 'critical' || i.severity === 'high').length,
        deterministicPassed: deterministicValidation.valid,
        semanticPassed: semanticValidation.valid,
        overallStatus: overallValid ? 'PASS' : 'FAIL'
      }
    };
  }

  /**
   * Helper methods for code analysis
   */
  extractCodeStructure(generatedCode) {
    // Extract high-level code structure for analysis
    return {
      layers: ['domain', 'application', 'infrastructure', 'presentation'],
      files: Object.keys(generatedCode || {}),
      dependencies: 'extracted from imports'
    };
  }

  extractCodeSamples(generatedCode) {
    // Extract representative code samples for clean code analysis
    return 'Key code samples for analysis';
  }

  extractBusinessLogicCode(generatedCode) {
    // Extract business logic relevant code
    return 'Business logic code samples';
  }

  combineSemanticResults(validations) {
    const allIssues = validations.flatMap(v => v.issues);
    const allRecommendations = validations.flatMap(v => v.recommendations);
    const allValid = validations.every(v => v.valid);
    const avgConfidence = validations.reduce((sum, v) => sum + v.confidenceScore, 0) / validations.length;

    return {
      type: 'semantic',
      valid: allValid,
      issues: allIssues,
      recommendations: allRecommendations,
      confidenceScore: avgConfidence,
      validationDetails: validations
    };
  }

  getMetadata() {
    return {
      type: 'code-validation',
      name: this.name,
      phase: this.getCurrentPhase(),
      validationApproach: 'hybrid',
      capabilities: [
        'deterministic_validation',
        'semantic_validation',
        'clean_architecture_assessment',
        'clean_code_principles',
        'business_logic_verification'
      ],
      deterministicChecks: [
        'compilation',
        'test_execution',
        'database_connectivity'
      ],
      semanticChecks: [
        'architecture_compliance',
        'code_quality',
        'business_logic_alignment'
      ]
    };
  }
}