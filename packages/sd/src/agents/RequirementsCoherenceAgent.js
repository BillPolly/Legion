/**
 * RequirementsCoherenceAgent - LLM Agent for validating requirements coherence
 * 
 * Uses LLM to analyze requirements for contradictions, redundancies, and completeness issues.
 * Provides specific feedback for requirements regeneration and improvement.
 */

import { SDAgentBase } from './SDAgentBase.js';

export class RequirementsCoherenceAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'RequirementsCoherenceAgent',
      description: 'Validates requirements coherence, identifies contradictions and redundancies',
      validationRules: {
        coherence: {
          mustNotContradict: (requirements) => this.checkContradictions(requirements),
          mustNotRedundant: (requirements) => this.checkRedundancy(requirements),
          mustBeComplete: (requirements) => this.checkCompleteness(requirements),
          mustBeTestable: (requirements) => this.checkTestability(requirements)
        }
      }
    });
  }

  getCurrentPhase() {
    return 'requirements-validation';
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'validate_requirements') {
      return {
        success: false,
        error: 'RequirementsCoherenceAgent only handles validate_requirements messages'
      };
    }

    try {
      const { requirements, context } = payload;
      
      // Perform comprehensive requirements validation using LLM
      const coherenceValidation = await this.validateRequirementsCoherence(requirements);
      const completenessValidation = await this.validateRequirementsCompleteness(requirements, context);
      const testabilityValidation = await this.validateRequirementsTestability(requirements);

      // Combine all validation results
      const overallValidation = this.combineValidationResults([
        coherenceValidation,
        completenessValidation,
        testabilityValidation
      ]);

      return {
        success: true,
        data: {
          validation: overallValidation,
          recommendations: overallValidation.recommendations,
          confidenceScore: overallValidation.confidenceScore,
          requiresRegeneration: !overallValidation.valid
        }
      };
    } catch (error) {
      console.error(`[RequirementsCoherenceAgent] Error validating requirements:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate requirements for contradictions and redundancies using LLM
   */
  async validateRequirementsCoherence(requirements) {
    const prompt = `Analyze the following requirements for coherence issues:

FUNCTIONAL REQUIREMENTS:
${JSON.stringify(requirements.functional || [], null, 2)}

NON-FUNCTIONAL REQUIREMENTS:
${JSON.stringify(requirements.nonFunctional || [], null, 2)}

CONSTRAINTS:
${JSON.stringify(requirements.constraints || [], null, 2)}

Analyze for:
1. **Contradictions**: Requirements that conflict with each other
2. **Redundancies**: Requirements that duplicate or overlap significantly
3. **Inconsistencies**: Requirements that don't align in priority or scope

Return JSON:
{
  "coherent": boolean,
  "contradictions": [
    {
      "requirement1": "FR-001",
      "requirement2": "NFR-003", 
      "conflict": "specific description of conflict",
      "severity": "high|medium|low",
      "suggestion": "specific fix recommendation"
    }
  ],
  "redundancies": [
    {
      "requirements": ["FR-002", "FR-005"],
      "overlap": "description of redundancy",
      "suggestion": "consolidation recommendation"
    }
  ],
  "inconsistencies": [
    {
      "requirements": ["FR-001", "NFR-002"],
      "issue": "priority/scope misalignment description",
      "suggestion": "alignment recommendation"
    }
  ],
  "overallCoherence": "high|medium|low",
  "confidenceScore": 0.85
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'coherence',
        valid: result.coherent && result.contradictions.length === 0,
        issues: [
          ...result.contradictions.map(c => ({ type: 'contradiction', ...c })),
          ...result.redundancies.map(r => ({ type: 'redundancy', ...r })),
          ...result.inconsistencies.map(i => ({ type: 'inconsistency', ...i }))
        ],
        recommendations: [
          ...result.contradictions.map(c => c.suggestion),
          ...result.redundancies.map(r => r.suggestion),
          ...result.inconsistencies.map(i => i.suggestion)
        ],
        confidenceScore: result.confidenceScore || 0.8,
        details: result
      };
    } catch (error) {
      console.error('[RequirementsCoherenceAgent] LLM validation error:', error);
      return {
        type: 'coherence',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual review required due to validation error'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate requirements completeness using LLM
   */
  async validateRequirementsCompleteness(requirements, context = {}) {
    const prompt = `Assess the completeness of these requirements for a ${context.systemType || 'software system'}:

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

CONTEXT:
${JSON.stringify(context, null, 2)}

Analyze for completeness:
1. **Missing functional areas**: Core functionality not addressed
2. **Missing non-functional requirements**: Performance, security, usability gaps
3. **Missing edge cases**: Error handling, boundary conditions
4. **Missing integration requirements**: External systems, APIs, data flows

Return JSON:
{
  "complete": boolean,
  "missingAreas": [
    {
      "category": "authentication|data-management|error-handling|etc",
      "description": "what's missing",
      "priority": "high|medium|low",
      "suggestion": "specific requirement to add"
    }
  ],
  "gapAnalysis": {
    "functionalCoverage": 0.85,
    "nonFunctionalCoverage": 0.70,
    "edgeCaseCoverage": 0.60
  },
  "recommendations": ["specific actions to improve completeness"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt, context || {});
      
      return {
        type: 'completeness',
        valid: result.complete && result.missingAreas.length === 0,
        issues: result.missingAreas.map(area => ({ 
          type: 'missing_requirement', 
          category: area.category,
          description: area.description,
          priority: area.priority
        })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        coverage: result.gapAnalysis,
        details: result
      };
    } catch (error) {
      console.error('[RequirementsCoherenceAgent] Completeness validation error:', error);
      return {
        type: 'completeness',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual completeness review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate requirements testability using LLM
   */
  async validateRequirementsTestability(requirements) {
    const prompt = `Evaluate the testability of these requirements:

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

For each requirement, assess:
1. **Measurability**: Can success/failure be objectively measured?
2. **Clarity**: Is the requirement specific enough to test?
3. **Observability**: Can the requirement's fulfillment be observed?
4. **Acceptance Criteria**: Are clear success criteria defined?

Return JSON:
{
  "testable": boolean,
  "untestableRequirements": [
    {
      "requirementId": "FR-001",
      "issues": ["too vague", "unmeasurable", "no clear criteria"],
      "currentText": "requirement text",
      "suggestion": "improved requirement text that is testable"
    }
  ],
  "testabilityScore": 0.85,
  "recommendations": ["specific improvements for better testability"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'testability',
        valid: result.testable && result.untestableRequirements.length === 0,
        issues: result.untestableRequirements.map(req => ({
          type: 'untestable_requirement',
          requirementId: req.requirementId,
          issues: req.issues,
          currentText: req.currentText
        })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        testabilityScore: result.testabilityScore,
        details: result
      };
    } catch (error) {
      console.error('[RequirementsCoherenceAgent] Testability validation error:', error);
      return {
        type: 'testability',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual testability review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Combine multiple validation results into overall assessment
   */
  combineValidationResults(validations) {
    const allIssues = validations.flatMap(v => v.issues);
    const allRecommendations = validations.flatMap(v => v.recommendations);
    const allValid = validations.every(v => v.valid);
    const avgConfidence = validations.reduce((sum, v) => sum + v.confidenceScore, 0) / validations.length;

    return {
      valid: allValid,
      issues: allIssues,
      recommendations: allRecommendations,
      confidenceScore: avgConfidence,
      validationDetails: validations,
      summary: {
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === 'high' || i.priority === 'high').length,
        validationTypes: validations.map(v => v.type),
        overallStatus: allValid ? 'PASS' : 'FAIL'
      }
    };
  }

  getMetadata() {
    return {
      type: 'requirements-validation',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'requirements_coherence_analysis',
        'contradiction_detection', 
        'redundancy_identification',
        'completeness_assessment',
        'testability_validation'
      ],
      validationTypes: [
        'coherence',
        'completeness', 
        'testability'
      ],
      confidenceMetrics: [
        'llm_confidence',
        'validation_coverage',
        'issue_severity'
      ]
    };
  }
}