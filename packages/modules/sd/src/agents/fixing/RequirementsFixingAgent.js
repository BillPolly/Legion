/**
 * RequirementsFixingAgent - Specialized agent for resolving requirements conflicts and gaps
 * 
 * Unlike RequirementsAgent which generates initial requirements,
 * this agent focuses specifically on fixing contradictions, redundancies, and gaps.
 */

import { SDAgentBase } from '../SDAgentBase.js';

export class RequirementsFixingAgent extends SDAgentBase {
  constructor(config) {
    super({
      ...config,
      name: 'RequirementsFixingAgent',
      description: 'Specialized agent for resolving requirements contradictions, redundancies, and gaps',
      capabilities: [
        'contradiction_resolution',
        'redundancy_elimination',
        'gap_filling',
        'testability_improvement'
      ]
    });
  }

  getCurrentPhase() {
    return 'requirements-fixing';
  }

  async receive(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'resolve_contradictions':
        return await this.resolveContradictions(payload);
      case 'eliminate_redundancy':
        return await this.eliminateRedundancy(payload);
      case 'resolve_inconsistencies':
        return await this.resolveInconsistencies(payload);
      case 'add_missing_requirements':
        return await this.addMissingRequirements(payload);
      case 'make_requirements_testable':
        return await this.makeRequirementsTestable(payload);
      default:
        return {
          success: false,
          error: `RequirementsFixingAgent does not handle message type: ${type}`
        };
    }
  }

  /**
   * Resolve specific contradictions between requirements
   */
  async resolveContradictions(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirement1, requirement2, conflict, suggestion } = errorToFix;

      console.log(`[RequirementsFixingAgent] Resolving contradiction between ${requirement1} and ${requirement2}`);

      const prompt = `Resolve this requirements contradiction:

CONFLICTING REQUIREMENTS:
Requirement 1: ${requirement1}
Requirement 2: ${requirement2}

CONFLICT DESCRIPTION: ${conflict}
SUGGESTED APPROACH: ${suggestion}

CURRENT REQUIREMENTS SET:
${JSON.stringify(originalArtifacts.requirements || {}, null, 2)}

INSTRUCTIONS:
1. Analyze the root cause of the contradiction
2. Determine which requirement takes priority based on business value
3. Modify the conflicting requirements to remove the contradiction
4. Ensure the resolution maintains the core business intent
5. Consider creating conditional requirements if both are needed in different contexts

Return the resolved requirements in this format:
{
  "resolution": "explanation of how the contradiction was resolved",
  "modifiedRequirements": {
    "${requirement1}": "modified requirement text",
    "${requirement2}": "modified requirement text or null if removed"
  },
  "newRequirements": [],
  "rationale": "business justification for the resolution"
}`;

      const resolution = await this.makeLLMDecision(prompt, {});

      // Update the requirements artifacts
      const updatedRequirements = this.applyRequirementsChanges(
        originalArtifacts.requirements, 
        resolution
      );

      return {
        success: true,
        data: {
          message: `Resolved contradiction: ${conflict}`,
          resolution: resolution.resolution,
          modifiedRequirements: resolution.modifiedRequirements,
          updatedArtifacts: { requirements: updatedRequirements },
          rationale: resolution.rationale
        }
      };
    } catch (error) {
      console.error(`[RequirementsFixingAgent] Error resolving contradictions:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Eliminate redundant requirements
   */
  async eliminateRedundancy(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirements: redundantRequirements, overlap, suggestion } = errorToFix;

      console.log(`[RequirementsFixingAgent] Eliminating redundancy: ${overlap}`);

      const prompt = `Eliminate this requirements redundancy:

REDUNDANT REQUIREMENTS: ${JSON.stringify(redundantRequirements)}
OVERLAP DESCRIPTION: ${overlap}
SUGGESTED CONSOLIDATION: ${suggestion}

CURRENT REQUIREMENTS SET:
${JSON.stringify(originalArtifacts.requirements || {}, null, 2)}

INSTRUCTIONS:
1. Identify the common functionality across redundant requirements
2. Create a single consolidated requirement that captures all essential aspects
3. Remove the redundant requirements
4. Ensure no functionality is lost in the consolidation
5. Use clear, specific language in the consolidated requirement

Return the consolidation plan:
{
  "consolidation": "explanation of how requirements were consolidated",
  "consolidatedRequirement": {
    "id": "new consolidated requirement ID",
    "text": "consolidated requirement text",
    "priority": "high|medium|low",
    "category": "functional|non-functional|constraint"
  },
  "removedRequirements": ["list of requirement IDs to remove"],
  "rationale": "why this consolidation preserves all necessary functionality"
}`;

      const consolidation = await this.makeLLMDecision(prompt, {});

      // Apply the consolidation
      const updatedRequirements = this.applyConsolidation(
        originalArtifacts.requirements,
        consolidation
      );

      return {
        success: true,
        data: {
          message: `Eliminated redundancy: ${overlap}`,
          consolidation: consolidation.consolidation,
          consolidatedRequirement: consolidation.consolidatedRequirement,
          removedRequirements: consolidation.removedRequirements,
          updatedArtifacts: { requirements: updatedRequirements },
          rationale: consolidation.rationale
        }
      };
    } catch (error) {
      console.error(`[RequirementsFixingAgent] Error eliminating redundancy:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resolve inconsistencies in priority or scope
   */
  async resolveInconsistencies(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirements: inconsistentRequirements, issue, suggestion } = errorToFix;

      console.log(`[RequirementsFixingAgent] Resolving inconsistency: ${issue}`);

      const prompt = `Resolve this requirements inconsistency:

INCONSISTENT REQUIREMENTS: ${JSON.stringify(inconsistentRequirements)}
INCONSISTENCY ISSUE: ${issue}
SUGGESTED RESOLUTION: ${suggestion}

CURRENT REQUIREMENTS SET:
${JSON.stringify(originalArtifacts.requirements || {}, null, 2)}

INSTRUCTIONS:
1. Identify the root cause of the inconsistency
2. Align the requirements in terms of priority, scope, or categorization
3. Ensure consistency with the overall system architecture
4. Maintain business value while resolving conflicts
5. Update related requirements if needed for overall consistency

Return the consistency resolution:
{
  "resolution": "how the inconsistency was resolved",
  "alignedRequirements": {
    "requirement_id": {
      "text": "updated requirement text",
      "priority": "aligned priority",
      "scope": "clarified scope",
      "category": "consistent category"
    }
  },
  "rationale": "business justification for the alignment"
}`;

      const alignment = await this.makeLLMDecision(prompt, {});

      // Apply the alignment
      const updatedRequirements = this.applyAlignment(
        originalArtifacts.requirements,
        alignment
      );

      return {
        success: true,
        data: {
          message: `Resolved inconsistency: ${issue}`,
          resolution: alignment.resolution,
          alignedRequirements: alignment.alignedRequirements,
          updatedArtifacts: { requirements: updatedRequirements },
          rationale: alignment.rationale
        }
      };
    } catch (error) {
      console.error(`[RequirementsFixingAgent] Error resolving inconsistencies:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add missing requirements to fill gaps
   */
  async addMissingRequirements(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { category, description: missingArea, priority, suggestion } = errorToFix;

      console.log(`[RequirementsFixingAgent] Adding missing requirements for: ${missingArea}`);

      const prompt = `Add missing requirements to address this gap:

MISSING AREA: ${missingArea}
CATEGORY: ${category}
PRIORITY: ${priority}
SUGGESTED APPROACH: ${suggestion}

CURRENT REQUIREMENTS:
${JSON.stringify(originalArtifacts.requirements || {}, null, 2)}

SYSTEM CONTEXT:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. Generate specific requirements to address the missing area
2. Ensure requirements are testable and measurable
3. Align with existing requirements and system architecture
4. Use appropriate priority levels
5. Include both functional and non-functional aspects if needed

Return the missing requirements:
{
  "gapAnalysis": "why these requirements were missing",
  "newRequirements": [
    {
      "id": "FR-NEW-001",
      "text": "specific requirement description",
      "category": "functional|non-functional|constraint",
      "priority": "high|medium|low",
      "testCriteria": "how to verify this requirement",
      "businessValue": "why this requirement is important"
    }
  ],
  "integration": "how these requirements integrate with existing ones"
}`;

      const gapFilling = await this.makeLLMDecision(prompt, {});

      // Add the new requirements
      const updatedRequirements = this.addNewRequirements(
        originalArtifacts.requirements,
        gapFilling.newRequirements
      );

      return {
        success: true,
        data: {
          message: `Added missing requirements for: ${missingArea}`,
          gapAnalysis: gapFilling.gapAnalysis,
          newRequirements: gapFilling.newRequirements,
          updatedArtifacts: { requirements: updatedRequirements },
          integration: gapFilling.integration
        }
      };
    } catch (error) {
      console.error(`[RequirementsFixingAgent] Error adding missing requirements:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Make vague requirements more testable
   */
  async makeRequirementsTestable(payload) {
    try {
      const { context, errorToFix, originalArtifacts } = payload;
      const { requirementId, issues, currentText, suggestion } = errorToFix;

      console.log(`[RequirementsFixingAgent] Making requirement testable: ${requirementId}`);

      const prompt = `Make this requirement more testable:

REQUIREMENT ID: ${requirementId}
CURRENT TEXT: ${currentText}
TESTABILITY ISSUES: ${JSON.stringify(issues)}
SUGGESTED IMPROVEMENT: ${suggestion}

INSTRUCTIONS:
1. Transform vague language into specific, measurable criteria
2. Add quantifiable acceptance criteria
3. Define clear success/failure conditions
4. Include test scenarios or examples
5. Ensure the requirement can be objectively verified

Return the improved requirement:
{
  "improvedRequirement": {
    "id": "${requirementId}",
    "text": "improved, testable requirement text",
    "acceptanceCriteria": [
      "specific criterion 1",
      "specific criterion 2"
    ],
    "testScenarios": [
      {
        "scenario": "test scenario description",
        "expectedOutcome": "measurable expected result"
      }
    ],
    "verificationMethod": "how to verify this requirement is met"
  },
  "improvements": "what was changed to make it testable"
}`;

      const improvement = await this.makeLLMDecision(prompt, {});

      // Update the requirement
      const updatedRequirements = this.updateRequirement(
        originalArtifacts.requirements,
        requirementId,
        improvement.improvedRequirement
      );

      return {
        success: true,
        data: {
          message: `Made requirement testable: ${requirementId}`,
          improvedRequirement: improvement.improvedRequirement,
          improvements: improvement.improvements,
          updatedArtifacts: { requirements: updatedRequirements }
        }
      };
    } catch (error) {
      console.error(`[RequirementsFixingAgent] Error making requirements testable:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods for updating requirements artifacts
   */
  applyRequirementsChanges(currentRequirements, resolution) {
    // Apply modifications to requirements structure
    const updated = JSON.parse(JSON.stringify(currentRequirements));
    
    for (const [reqId, newText] of Object.entries(resolution.modifiedRequirements || {})) {
      if (newText) {
        // Find and update requirement
        this.updateRequirementText(updated, reqId, newText);
      } else {
        // Remove requirement
        this.removeRequirement(updated, reqId);
      }
    }

    return updated;
  }

  applyConsolidation(currentRequirements, consolidation) {
    const updated = JSON.parse(JSON.stringify(currentRequirements));
    
    // Add consolidated requirement
    this.addRequirement(updated, consolidation.consolidatedRequirement);
    
    // Remove redundant requirements
    for (const reqId of consolidation.removedRequirements || []) {
      this.removeRequirement(updated, reqId);
    }

    return updated;
  }

  applyAlignment(currentRequirements, alignment) {
    const updated = JSON.parse(JSON.stringify(currentRequirements));
    
    for (const [reqId, alignedReq] of Object.entries(alignment.alignedRequirements || {})) {
      this.updateRequirement(updated, reqId, alignedReq);
    }

    return updated;
  }

  addNewRequirements(currentRequirements, newRequirements) {
    const updated = JSON.parse(JSON.stringify(currentRequirements));
    
    for (const newReq of newRequirements || []) {
      this.addRequirement(updated, newReq);
    }

    return updated;
  }

  // Helper methods for requirements manipulation
  updateRequirementText(requirements, reqId, newText) {
    // Implementation depends on requirements structure
    if (requirements.functional) {
      const req = requirements.functional.find(r => r.id === reqId);
      if (req) req.description = newText;
    }
    if (requirements.nonFunctional) {
      const req = requirements.nonFunctional.find(r => r.id === reqId);
      if (req) req.description = newText;
    }
  }

  removeRequirement(requirements, reqId) {
    if (requirements.functional) {
      requirements.functional = requirements.functional.filter(r => r.id !== reqId);
    }
    if (requirements.nonFunctional) {
      requirements.nonFunctional = requirements.nonFunctional.filter(r => r.id !== reqId);
    }
  }

  addRequirement(requirements, newReq) {
    const targetArray = newReq.category === 'functional' ? 'functional' : 'nonFunctional';
    if (!requirements[targetArray]) requirements[targetArray] = [];
    requirements[targetArray].push(newReq);
  }

  updateRequirement(requirements, reqId, updatedReq) {
    this.removeRequirement(requirements, reqId);
    this.addRequirement(requirements, updatedReq);
  }

  getMetadata() {
    return {
      type: 'requirements-fixing',
      name: this.name,
      phase: this.getCurrentPhase(),
      capabilities: [
        'contradiction_resolution',
        'redundancy_elimination',
        'inconsistency_resolution',
        'gap_filling',
        'testability_improvement'
      ],
      specializations: [
        'conflict_resolution',
        'requirements_optimization',
        'business_alignment',
        'clarity_enhancement'
      ]
    };
  }
}