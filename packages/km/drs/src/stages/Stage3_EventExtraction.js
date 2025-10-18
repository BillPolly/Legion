/**
 * Stage3_EventExtraction - Extract events, roles, and facts using LLM
 *
 * This stage:
 * 1. Queries semantic inventory for allowed roles, predicates, and relations
 * 2. Uses LLM with structured output to extract events with semantic roles
 * 3. Extracts unary facts (properties) and binary facts (relations)
 * 4. Validates using EventValidator rules
 * 5. Attempts repair if validation fails (one attempt)
 * 6. Generates unique event IDs (e1, e2, ...)
 */

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DiscourseMemory } from '../types/DiscourseMemory.js';
import { Event } from '../types/Event.js';
import { UnaryFact } from '../types/UnaryFact.js';
import { BinaryFact } from '../types/BinaryFact.js';
import { TemplatedPrompt } from '@legion/prompting-manager';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Stage3_EventExtraction {
  constructor(llmClient, semanticInventory) {
    this.llmClient = llmClient;
    this.semanticInventory = semanticInventory;

    // Load schema
    const schemaPath = join(__dirname, '../../schemas/EventsSchema.json');
    this.eventsSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Template will be loaded on first use
    this.eventPromptTemplate = null;
  }

  /**
   * Process discourse memory to extract events and facts
   * @param {DiscourseMemory} memory - Input discourse memory with entities
   * @returns {Promise<DiscourseMemory>} - Memory with events, unaryFacts, binaryFacts populated
   */
  async process(memory) {
    // Get relation inventory from semantic inventory
    const inventory = await this.semanticInventory.semanticSearchRelationTypes(
      memory.text,
      { limit: 50 }
    );

    // Prepare entity table for prompt (extract string label from synset)
    const entityTable = memory.entities.map(e => ({
      id: e.id,
      canonical: e.canonical,
      type: e.type.synonyms?.[0] || e.type.label || String(e.type)
    }));

    // Extract synonym strings from synset objects for LLM prompt
    const allowedRoleStrings = inventory.roles.flatMap(s => s.synonyms || [s.label]);
    const allowedPredicateStrings = inventory.unaryPredicates.flatMap(s => s.synonyms || [s.label]);
    const allowedRelationStrings = inventory.binaryRelations.flatMap(s => s.synonyms || [s.label]);

    // Prepare prompt data (LLM gets strings)
    const promptData = {
      text: memory.text,
      entities: entityTable,
      allowedRoles: allowedRoleStrings,
      allowedUnaryPredicates: allowedPredicateStrings,
      allowedBinaryRelations: allowedRelationStrings,
      schema: this.eventsSchema
    };

    // First attempt
    let extraction = await this._callLLM(promptData);
    let validationErrors = this._validate(extraction, memory, inventory);

    // If validation failed, attempt repair (one attempt)
    if (validationErrors.length > 0) {
      // Add error feedback to prompt for repair
      promptData.errors = validationErrors.map(e => e.message);

      extraction = await this._callLLM(promptData);
      validationErrors = this._validate(extraction, memory, inventory);

      // If still invalid after repair, fail
      if (validationErrors.length > 0) {
        throw new Error(`Event extraction failed validation after repair: ${validationErrors.map(e => e.message).join('; ')}`);
      }
    }

    // Convert to Event, UnaryFact, BinaryFact instances
    // Map LLM strings back to synset objects
    const eventInstances = await Promise.all(extraction.events.map(async e => {
      // Look up event lemma in WordNet (not restricted to semantic inventory)
      const lemmaSynset = await this.semanticInventory.lookupEventLemmaSynset(e.lemma);

      // FAIL FAST - no matching synset found
      if (!lemmaSynset) {
        throw new Error(`Cannot find synset for event lemma "${e.lemma}". No matching WordNet entry.`);
      }

      return new Event(
        e.id,
        lemmaSynset,  // Pass synset object, not string
        e.tense,
        e.aspect,
        e.modal,
        e.neg,
        e.roles
      );
    }));

    const unaryFactInstances = extraction.unaryFacts.map(f => {
      const predSynset = this._mapToSynset(f.pred, inventory.unaryPredicates);
      return new UnaryFact(predSynset, f.args);  // Pass synset object, not string
    });

    const binaryFactInstances = extraction.binaryFacts.map(f => {
      const predSynset = this._mapToSynset(f.pred, inventory.binaryRelations);
      return new BinaryFact(predSynset, f.args);  // Pass synset object, not string
    });

    // Return updated DiscourseMemory
    return new DiscourseMemory(
      memory.text,
      memory.sentences,
      memory.mentions,
      memory.entities,
      eventInstances,
      unaryFactInstances,
      binaryFactInstances
    );
  }

  /**
   * Call LLM with prompt data
   * @private
   */
  async _callLLM(promptData) {
    // Load template if not already loaded
    if (!this.eventPromptTemplate) {
      const templatePath = join(__dirname, '../../prompts/event-extraction.hbs');
      this.eventPromptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.eventPromptTemplate,
      responseSchema: this.eventsSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute(promptData);

    if (!result.success) {
      throw new Error(`Event extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Check if a string is a valid synonym in any of the synsets
   * @private
   * @param {string} stringValue - String to check
   * @param {Object[]} synsets - Array of synset objects
   * @returns {boolean} True if string is a valid synonym
   */
  _isValidSynonym(stringValue, synsets) {
    for (const synset of synsets) {
      const synonyms = synset.synonyms || [synset.label];
      if (synonyms.includes(stringValue)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Map LLM string response back to synset object
   * @private
   * @param {string} stringValue - String returned by LLM
   * @param {Object[]} synsets - Array of synset objects
   * @returns {Object} Matching synset object
   * @throws {Error} If no matching synset found (FAIL FAST)
   */
  _mapToSynset(stringValue, synsets) {
    for (const synset of synsets) {
      const synonyms = synset.synonyms || [synset.label];
      if (synonyms.includes(stringValue)) {
        return synset;
      }
    }

    // FAIL FAST - no matching synset found
    throw new Error(`Cannot map string "${stringValue}" to synset. No synset contains this synonym.`);
  }

  /**
   * Validate events and facts
   * @private
   * @returns {Array} Array of validation errors
   */
  _validate(extraction, memory, inventory) {
    const errors = [];
    const validEntityIds = new Set(memory.entities.map(e => e.id));
    const usedEventIds = new Set();

    // Validate events
    for (const event of extraction.events) {
      // Check for duplicate event IDs
      if (usedEventIds.has(event.id)) {
        errors.push(new Error(`Duplicate event ID: ${event.id}`));
      }
      usedEventIds.add(event.id);

      // Validate role names
      for (const roleName of Object.keys(event.roles)) {
        if (!this._isValidSynonym(roleName, inventory.roles)) {
          const allowedRoles = inventory.roles.map(s => s.label).join(', ');
          errors.push(new Error(`Event ${event.id}: role "${roleName}" not in allowed roles ${allowedRoles}`));
        }
      }

      // Validate role targets are entity IDs
      for (const [roleName, targetId] of Object.entries(event.roles)) {
        if (!validEntityIds.has(targetId)) {
          errors.push(new Error(`Event ${event.id}: role "${roleName}" target "${targetId}" is not a valid entity ID`));
        }
      }
    }

    // Validate unary facts
    for (const fact of extraction.unaryFacts) {
      // Validate predicate is in inventory
      if (!this._isValidSynonym(fact.pred, inventory.unaryPredicates)) {
        const allowedPredicates = inventory.unaryPredicates.map(s => s.label).join(', ');
        errors.push(new Error(`Unary fact: predicate "${fact.pred}" not in allowed predicates ${allowedPredicates}`));
      }

      // Validate arity (must be exactly 1)
      if (fact.args.length !== 1) {
        errors.push(new Error(`Unary fact "${fact.pred}": must have exactly 1 argument, got ${fact.args.length}`));
      }

      // Validate args are valid entity IDs
      for (const arg of fact.args) {
        if (!validEntityIds.has(arg)) {
          errors.push(new Error(`Unary fact "${fact.pred}": argument "${arg}" is not a valid entity ID`));
        }
      }
    }

    // Validate binary facts
    for (const fact of extraction.binaryFacts) {
      // Validate relation is in inventory
      if (!this._isValidSynonym(fact.pred, inventory.binaryRelations)) {
        const allowedRelations = inventory.binaryRelations.map(s => s.label).join(', ');
        errors.push(new Error(`Binary fact: relation "${fact.pred}" not in allowed relations ${allowedRelations}`));
      }

      // Validate arity (must be exactly 2)
      if (fact.args.length !== 2) {
        errors.push(new Error(`Binary fact "${fact.pred}": must have exactly 2 arguments, got ${fact.args.length}`));
      }

      // Validate args are valid entity IDs
      for (const arg of fact.args) {
        if (!validEntityIds.has(arg)) {
          errors.push(new Error(`Binary fact "${fact.pred}": argument "${arg}" is not a valid entity ID`));
        }
      }
    }

    return errors;
  }
}
