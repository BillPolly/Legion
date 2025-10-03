/**
 * GapAnalysisService - Identify missing concepts after subsumption checking
 *
 * Analyzes sentences to determine:
 * - Missing classes not in ontology
 * - Missing properties not found via subsumption
 * - Missing relationships not found via subsumption
 * - Concepts that can be reused from hierarchy
 */

import { TemplatedPrompt } from '@legion/prompting-manager';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GapAnalysisService {
  constructor(subsumptionChecker, llmClient) {
    if (!subsumptionChecker) {
      throw new Error('SubsumptionChecker is required');
    }
    if (!llmClient) {
      throw new Error('LLM client is required');
    }

    this.subsumptionChecker = subsumptionChecker;
    this.llmClient = llmClient;
    this.extractImpliedTypesTemplate = null;
  }

  /**
   * Analyze what's missing after checking subsumption
   *
   * @param {string} sentence - The sentence to analyze
   * @param {Array} existingTypes - Types found by OntologyQueryService
   * @returns {Promise<Object>} - Gap analysis result
   * @returns {Array} return.missingClasses - Classes not in ontology
   * @returns {Array} return.missingProperties - Properties not found via subsumption
   * @returns {Array} return.missingRelationships - Relationships not found via subsumption
   * @returns {Array} return.canReuseFromHierarchy - Concepts that exist and can be reused
   */
  async analyzeGaps(sentence, existingTypes) {
    // Extract what the sentence implies about types
    const implied = await this.extractImpliedTypes(sentence);

    const gaps = {
      missingClasses: [],
      missingProperties: [],
      missingRelationships: [],
      canReuseFromHierarchy: []
    };

    // Check each implied class
    for (const impliedClass of implied.classes) {
      const exists = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedClass.name.toLowerCase()
      );

      if (!exists || exists.isGap) {
        gaps.missingClasses.push(impliedClass);
      }
    }

    // Check properties with subsumption
    for (const impliedProp of implied.properties) {
      const domainType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedProp.domain?.toLowerCase()
      );

      if (domainType && domainType.matchedClass) {
        const subsumption = await this.subsumptionChecker.checkPropertySubsumption(
          domainType.matchedClass,
          impliedProp.name
        );

        if (subsumption.exists) {
          gaps.canReuseFromHierarchy.push({
            type: 'property',
            implied: impliedProp,
            existing: subsumption,
            sentence
          });
        } else {
          gaps.missingProperties.push(impliedProp);
        }
      } else {
        // Domain class doesn't exist yet
        gaps.missingProperties.push(impliedProp);
      }
    }

    // Check relationships with subsumption
    for (const impliedRel of implied.relationships) {
      const domainType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedRel.domain?.toLowerCase()
      );
      const rangeType = existingTypes.find(t =>
        t.mention?.toLowerCase() === impliedRel.range?.toLowerCase()
      );

      if (domainType?.matchedClass && rangeType?.matchedClass) {
        const subsumption = await this.subsumptionChecker.checkRelationshipSubsumption(
          domainType.matchedClass,
          rangeType.matchedClass,
          impliedRel.name
        );

        if (subsumption.exists) {
          // Check if we CAN specialize (Rule 2 validation)
          if (subsumption.canSpecialize) {
            gaps.canReuseFromHierarchy.push({
              type: 'relationship',
              implied: impliedRel,
              existing: subsumption,
              sentence
            });
          } else {
            // Relationship exists but cannot be specialized (Rule 2 violation)
            gaps.missingRelationships.push({
              ...impliedRel,
              reason: `Cannot specialize: ${subsumption.specializationReason}`
            });
          }
        } else {
          gaps.missingRelationships.push(impliedRel);
        }
      } else {
        // Domain or range class doesn't exist yet
        gaps.missingRelationships.push(impliedRel);
      }
    }

    return gaps;
  }

  /**
   * Extract implied types from sentence using LLM
   *
   * @param {string} sentence - The sentence to analyze
   * @returns {Promise<Object>} - Implied types
   * @returns {Array} return.classes - Implied classes
   * @returns {Array} return.properties - Implied properties
   * @returns {Array} return.relationships - Implied relationships
   */
  async extractImpliedTypes(sentence) {
    // Load template if not already loaded
    if (!this.extractImpliedTypesTemplate) {
      const templatePath = join(__dirname, '../prompts/extract-implied-types.hbs');
      this.extractImpliedTypesTemplate = await readFile(templatePath, 'utf-8');
    }

    // Define response schema with multi-perspective descriptions
    const responseSchema = {
      type: 'object',
      properties: {
        classes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              suggestedSupertype: { type: 'string', enum: ['PhysicalEntity', 'State', 'Process', 'Task'] },
              definition: { type: 'string' },
              supertypeDescription: { type: 'string' },
              usageDescription: { type: 'string' },
              synonyms: { type: 'string' }
            },
            required: ['name', 'definition', 'supertypeDescription', 'usageDescription', 'synonyms']
          }
        },
        properties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              domain: { type: 'string' },
              type: { type: 'string' }
            },
            required: ['name', 'domain', 'type']
          }
        },
        relationships: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              domain: { type: 'string' },
              range: { type: 'string' },
              definition: { type: 'string' },
              supertypeDescription: { type: 'string' },
              usageDescription: { type: 'string' },
              synonyms: { type: 'string' }
            },
            required: ['name', 'domain', 'range', 'definition', 'supertypeDescription', 'usageDescription', 'synonyms']
          }
        }
      },
      required: ['classes', 'properties', 'relationships']
    };

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.extractImpliedTypesTemplate,
      responseSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute({
      sentence
    });

    if (!result.success) {
      throw new Error(`Implied type extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }
}
