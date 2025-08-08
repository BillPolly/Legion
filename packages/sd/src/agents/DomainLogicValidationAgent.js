/**
 * DomainLogicValidationAgent - LLM Agent for validating domain model logic
 * 
 * Uses LLM to validate domain model business logic, entity relationships,
 * bounded context clarity, and alignment with requirements.
 */

import { SDAgentBase } from './SDAgentBase.js';

export class DomainLogicValidationAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'DomainLogicValidationAgent',
      description: 'Validates domain model logic, entity relationships, and business rules',
      validationRules: {
        domainLogic: {
          mustHaveConsistentRelationships: (domain) => this.validateRelationships(domain),
          mustAlignWithRequirements: (domain, requirements) => this.validateAlignment(domain, requirements),
          mustHaveClearBoundaries: (domain) => this.validateBoundaries(domain),
          mustFollowDDDPrinciples: (domain) => this.validateDDDCompliance(domain)
        }
      }
    });
  }

  getCurrentPhase() {
    return 'domain-validation';
  }

  async receive(message) {
    const { type, payload } = message;
    
    if (type !== 'validate_domain') {
      return {
        success: false,
        error: 'DomainLogicValidationAgent only handles validate_domain messages'
      };
    }

    try {
      const { domainModel, requirements, context } = payload;
      
      // Perform comprehensive domain validation using LLM
      const relationshipValidation = await this.validateEntityRelationships(domainModel);
      const businessLogicValidation = await this.validateBusinessLogic(domainModel, requirements);
      const boundedContextValidation = await this.validateBoundedContexts(domainModel);
      const dddComplianceValidation = await this.validateDDDCompliance(domainModel);

      // Combine all validation results
      const overallValidation = this.combineValidationResults([
        relationshipValidation,
        businessLogicValidation, 
        boundedContextValidation,
        dddComplianceValidation
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
      console.error(`[DomainLogicValidationAgent] Error validating domain:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate entity relationships and consistency using LLM
   */
  async validateEntityRelationships(domainModel) {
    const prompt = `Analyze the domain model for entity relationship consistency:

ENTITIES:
${JSON.stringify(domainModel.entities || [], null, 2)}

AGGREGATES:
${JSON.stringify(domainModel.aggregates || [], null, 2)}

VALUE OBJECTS:
${JSON.stringify(domainModel.valueObjects || [], null, 2)}

RELATIONSHIPS:
${JSON.stringify(domainModel.relationships || [], null, 2)}

Validate:
1. **Entity Relationships**: Are relationships bidirectional where needed? Are foreign keys consistent?
2. **Aggregate Boundaries**: Do aggregates maintain consistency boundaries correctly?
3. **Value Object Usage**: Are value objects used appropriately for immutable concepts?
4. **Identity Management**: Is entity identity handled consistently?

Return JSON:
{
  "relationshipsValid": boolean,
  "issues": [
    {
      "type": "relationship_inconsistency|boundary_violation|identity_issue",
      "entities": ["Entity1", "Entity2"],
      "description": "specific issue description",
      "severity": "high|medium|low",
      "suggestion": "how to fix the relationship"
    }
  ],
  "relationshipScore": 0.85,
  "recommendations": ["specific improvements"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'relationships',
        valid: result.relationshipsValid && result.issues.length === 0,
        issues: result.issues.map(issue => ({
          type: 'domain_relationship',
          ...issue
        })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        relationshipScore: result.relationshipScore,
        details: result
      };
    } catch (error) {
      console.error('[DomainLogicValidationAgent] Relationship validation error:', error);
      return {
        type: 'relationships',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual relationship review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate business logic against requirements using LLM
   */
  async validateBusinessLogic(domainModel, requirements) {
    const prompt = `Validate that the domain model correctly implements the business logic defined in requirements:

DOMAIN MODEL:
${JSON.stringify(domainModel, null, 2)}

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

Analyze:
1. **Business Rule Coverage**: Are all business rules from requirements reflected in the domain?
2. **Domain Logic Accuracy**: Do entities and aggregates correctly model the business processes?
3. **Invariant Enforcement**: Are business invariants properly enforced in the domain model?
4. **Workflow Support**: Does the domain model support the required business workflows?

Return JSON:
{
  "businessLogicValid": boolean,
  "coverage": {
    "businessRulesCovered": 0.85,
    "workflowsSupported": 0.90,
    "invariantsEnforced": 0.80
  },
  "gaps": [
    {
      "requirement": "FR-001",
      "gap": "missing business rule implementation",
      "impact": "high|medium|low",
      "suggestion": "specific domain model enhancement"
    }
  ],
  "misalignments": [
    {
      "domainConcept": "User aggregate",
      "issue": "doesn't match requirement specification",
      "suggestion": "how to align with requirements"
    }
  ],
  "recommendations": ["specific improvements"],
  "confidenceScore": 0.85
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'business_logic',
        valid: result.businessLogicValid && result.gaps.length === 0,
        issues: [
          ...result.gaps.map(gap => ({ type: 'business_rule_gap', ...gap })),
          ...result.misalignments.map(mis => ({ type: 'domain_misalignment', ...mis }))
        ],
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        coverage: result.coverage,
        details: result
      };
    } catch (error) {
      console.error('[DomainLogicValidationAgent] Business logic validation error:', error);
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
   * Validate bounded context boundaries using LLM
   */
  async validateBoundedContexts(domainModel) {
    const prompt = `Evaluate bounded context design and boundaries:

BOUNDED CONTEXTS:
${JSON.stringify(domainModel.boundedContexts || [], null, 2)}

ENTITIES AND AGGREGATES:
${JSON.stringify({
  entities: domainModel.entities || [],
  aggregates: domainModel.aggregates || []
}, null, 2)}

Assess:
1. **Context Boundaries**: Are context boundaries clear and well-defined?
2. **Entity Placement**: Are entities placed in appropriate contexts?
3. **Context Relationships**: How do contexts interact? Are integrations well-defined?
4. **Cohesion**: Do contexts contain related concepts that belong together?

Return JSON:
{
  "boundariesClear": boolean,
  "contextIssues": [
    {
      "context": "UserManagement",
      "issue": "too large|too small|unclear_boundary|wrong_entities",
      "description": "specific boundary issue",
      "suggestion": "how to improve context design"
    }
  ],
  "integrationIssues": [
    {
      "contexts": ["Context1", "Context2"],
      "issue": "unclear integration|tight coupling|missing integration",
      "suggestion": "integration improvement"
    }
  ],
  "cohesionScore": 0.80,
  "recommendations": ["specific boundary improvements"],
  "confidenceScore": 0.75
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'bounded_contexts',
        valid: result.boundariesClear && result.contextIssues.length === 0,
        issues: [
          ...result.contextIssues.map(issue => ({ type: 'context_boundary', ...issue })),
          ...result.integrationIssues.map(issue => ({ type: 'context_integration', ...issue }))
        ],
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.70,
        cohesionScore: result.cohesionScore,
        details: result
      };
    } catch (error) {
      console.error('[DomainLogicValidationAgent] Bounded context validation error:', error);
      return {
        type: 'bounded_contexts',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual bounded context review required'],
        confidenceScore: 0.0
      };
    }
  }

  /**
   * Validate DDD compliance using LLM
   */
  async validateDDDCompliance(domainModel) {
    const prompt = `Assess Domain-Driven Design compliance:

DOMAIN MODEL:
${JSON.stringify(domainModel, null, 2)}

Evaluate DDD principles:
1. **Ubiquitous Language**: Are domain concepts clearly named and consistent?
2. **Aggregate Design**: Do aggregates maintain consistency boundaries?
3. **Entity vs Value Object**: Are entities and value objects used correctly?
4. **Domain Services**: Are domain services used appropriately for stateless operations?
5. **Repository Pattern**: Are repositories properly defined for aggregate roots?

Return JSON:
{
  "dddCompliant": boolean,
  "principleViolations": [
    {
      "principle": "ubiquitous_language|aggregate_design|entity_value_object|domain_services|repository_pattern",
      "violation": "specific violation description",
      "location": "where in the model",
      "suggestion": "how to fix the violation"
    }
  ],
  "complianceScore": 0.85,
  "strengths": ["aspects that follow DDD well"],
  "recommendations": ["specific DDD improvements"],
  "confidenceScore": 0.80
}`;

    try {
      const result = await this.makeLLMDecision(prompt, {});
      
      return {
        type: 'ddd_compliance',
        valid: result.dddCompliant && result.principleViolations.length === 0,
        issues: result.principleViolations.map(violation => ({
          type: 'ddd_violation',
          ...violation
        })),
        recommendations: result.recommendations,
        confidenceScore: result.confidenceScore || 0.75,
        complianceScore: result.complianceScore,
        strengths: result.strengths,
        details: result
      };
    } catch (error) {
      console.error('[DomainLogicValidationAgent] DDD compliance validation error:', error);
      return {
        type: 'ddd_compliance',
        valid: false,
        issues: [{ type: 'validation_error', message: error.message }],
        recommendations: ['Manual DDD compliance review required'],
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
        criticalIssues: allIssues.filter(i => i.severity === 'high' || i.impact === 'high').length,
        validationTypes: validations.map(v => v.type),
        overallStatus: allValid ? 'PASS' : 'FAIL',
        domainQualityScore: avgConfidence
      }
    };
  }

  getMetadata() {
    return {
      type: 'domain-validation',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'entity_relationship_validation',
        'business_logic_verification',
        'bounded_context_analysis',
        'ddd_compliance_checking'
      ],
      validationTypes: [
        'relationships',
        'business_logic',
        'bounded_contexts',
        'ddd_compliance'
      ],
      dddPrinciples: [
        'ubiquitous_language',
        'aggregate_design',
        'entity_value_object_distinction',
        'domain_services',
        'repository_pattern'
      ]
    };
  }
}