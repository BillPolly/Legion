/**
 * Stage2_CoreferenceResolution - Resolve coreferences and create entities using LLM
 *
 * This stage:
 * 1. Uses LLM with structured output to cluster mentions into entities
 * 2. LLM outputs specific entity types (e.g., "person", "company", "fruit")
 * 3. Looks up type strings in WordNet to get synset objects
 * 4. Validates entities using EntityValidator
 * 5. Attempts repair if validation fails (one attempt)
 * 6. Generates unique entity IDs (x1, x2, ...)
 */

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DiscourseMemory } from '../types/DiscourseMemory.js';
import { Entity } from '../types/Entity.js';
import { TemplatedPrompt } from '@legion/prompting-manager';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Stage2_CoreferenceResolution {
  constructor(llmClient, semanticInventory) {
    this.llmClient = llmClient;
    this.semanticInventory = semanticInventory;

    // Load schema
    const schemaPath = join(__dirname, '../../schemas/CorefSchema.json');
    this.corefSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Template will be loaded on first use
    this.corefPromptTemplate = null;
  }

  /**
   * Process discourse memory to resolve coreferences
   * @param {DiscourseMemory} memory - Input discourse memory with mentions
   * @returns {Promise<DiscourseMemory>} - Memory with entities populated
   */
  async process(memory) {
    // Handle empty mentions
    if (memory.mentions.length === 0) {
      return new DiscourseMemory(
        memory.text,
        memory.sentences,
        memory.mentions,
        [], // Empty entities
        memory.events,
        memory.unaryFacts,
        memory.binaryFacts
      );
    }

    // Prepare mention table for prompt (extract string from synset for readability)
    const mentionTable = memory.mentions.map(m => ({
      id: m.id,
      text: m.text,
      type: m.coarseType.synonyms ? m.coarseType.synonyms[0] : m.coarseType.label
    }));

    // Prepare prompt data (no type constraint - LLM outputs specific types)
    const promptData = {
      text: memory.text,
      mentions: mentionTable,
      schema: this.corefSchema
    };

    // First attempt
    let entities = await this._callLLM(promptData);
    let validationErrors = this._validate(entities, memory);

    // If validation failed, attempt repair (one attempt)
    if (validationErrors.length > 0) {
      // Add error feedback to prompt for repair
      promptData.errors = validationErrors.map(e => e.message);

      entities = await this._callLLM(promptData);
      validationErrors = this._validate(entities, memory);

      // If still invalid after repair, fail
      if (validationErrors.length > 0) {
        throw new Error(`Coreference resolution failed validation after repair: ${validationErrors.map(e => e.message).join('; ')}`);
      }
    }

    // Generate unique entity IDs and convert to Entity instances with synset lookup
    const entityInstances = await Promise.all(entities.map(async (e, index) => {
      const typeSynset = await this._lookupTypeSynset(e.type);
      return new Entity(
        `x${index + 1}`,
        e.canonical,
        typeSynset,
        e.mentions,
        e.number,
        e.gender,
        e.kbId || null
      );
    }));

    // Return updated DiscourseMemory
    return new DiscourseMemory(
      memory.text,
      memory.sentences,
      memory.mentions,
      entityInstances,
      memory.events,
      memory.unaryFacts,
      memory.binaryFacts
    );
  }

  /**
   * Call LLM with prompt data
   * @private
   */
  async _callLLM(promptData) {
    // Load template if not already loaded
    if (!this.corefPromptTemplate) {
      const templatePath = join(__dirname, '../../prompts/coreference.hbs');
      this.corefPromptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.corefPromptTemplate,
      responseSchema: this.corefSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute(promptData);

    if (!result.success) {
      throw new Error(`Coreference resolution failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Validate entities
   * @private
   * @returns {Array} Array of validation errors
   */
  _validate(entities, memory) {
    const errors = [];

    // Track which mentions have been used
    const usedMentions = new Set();

    for (const entity of entities) {
      // Validate mentions exist
      for (const mentionId of entity.mentions) {
        const mentionExists = memory.mentions.some(m => m.id === mentionId);
        if (!mentionExists) {
          errors.push(new Error(`Entity ${entity.canonical}: mention "${mentionId}" does not exist in DiscourseMemory`));
        }

        // Check for disjoint mentions
        if (usedMentions.has(mentionId)) {
          errors.push(new Error(`Mention "${mentionId}" appears in multiple entities`));
        }
        usedMentions.add(mentionId);
      }

      // Validate type is a non-empty string
      if (!entity.type || typeof entity.type !== 'string') {
        errors.push(new Error(`Entity ${entity.canonical}: type must be a non-empty string`));
      }

      // Validate number is valid
      const validNumbers = ['SING', 'PLUR'];
      if (!validNumbers.includes(entity.number)) {
        errors.push(new Error(`Entity ${entity.canonical}: number "${entity.number}" must be one of ${validNumbers.join(', ')}`));
      }

      // Validate gender is valid
      const validGenders = ['MASC', 'FEM', 'NEUT', 'UNKNOWN'];
      if (!validGenders.includes(entity.gender)) {
        errors.push(new Error(`Entity ${entity.canonical}: gender "${entity.gender}" must be one of ${validGenders.join(', ')}`));
      }

      // Validate canonical is non-empty
      if (!entity.canonical || entity.canonical.trim() === '') {
        errors.push(new Error(`Entity has empty canonical name`));
      }
    }

    return errors;
  }

  /**
   * Look up entity type string and return synset object
   * @private
   * @param {string} typeString - Type string from LLM (e.g., "company", "professor", "fruit")
   * @returns {Promise<Object>} Synset object from WordNet
   * @throws {Error} If synset not found
   */
  async _lookupTypeSynset(typeString) {
    const synset = await this.semanticInventory.lookupEntityTypeSynset(typeString);

    if (!synset) {
      // FAIL FAST - no matching synset found
      throw new Error(`Cannot find synset for entity type "${typeString}". No matching WordNet entry.`);
    }

    return synset;
  }
}
