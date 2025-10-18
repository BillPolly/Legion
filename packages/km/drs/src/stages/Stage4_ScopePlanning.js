/**
 * Stage4_ScopePlanning - Plan quantifier scope structure using LLM
 *
 * This stage:
 * 1. Uses LLM with structured output to plan scope with boxes and operators
 * 2. Handles quantifiers (Some, Every), negation (Not), conditionals (If), disjunction (Or)
 * 3. Assigns entities and events to boxes
 * 4. Validates structural well-formedness
 * 5. Attempts repair if validation fails (one attempt)
 */

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ScopePlan } from '../types/ScopePlan.js';
import { TemplatedPrompt } from '@legion/prompting-manager';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Stage4_ScopePlanning {
  constructor(llmClient) {
    this.llmClient = llmClient;

    // Load schema
    const schemaPath = join(__dirname, '../../schemas/ScopeSchema.json');
    this.scopeSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Template will be loaded on first use
    this.scopePromptTemplate = null;
  }

  /**
   * Process discourse memory to plan quantifier scope
   * @param {DiscourseMemory} memory - Input discourse memory with entities and events
   * @returns {Promise<ScopePlan>} - Scope plan with boxes, operators, and assignments
   */
  async process(memory) {
    // Prepare entity table for prompt
    const entityTable = memory.entities.map(e => ({
      id: e.id,
      canonical: e.canonical
    }));

    // Prepare event table for prompt (extract string label from synset)
    const eventTable = memory.events.map(ev => ({
      id: ev.id,
      lemma: ev.lemma.synonyms?.[0] || ev.lemma.label || String(ev.lemma)
    }));

    // Prepare prompt data
    const promptData = {
      text: memory.text,
      entities: entityTable,
      events: eventTable,
      schema: this.scopeSchema
    };

    // First attempt
    let scopeData = await this._callLLM(promptData);
    let validationErrors = this._validate(scopeData, memory);

    // If validation failed, attempt repair (one attempt)
    if (validationErrors.length > 0) {
      // Add error feedback to prompt for repair
      promptData.errors = validationErrors.map(e => e.message);

      scopeData = await this._callLLM(promptData);
      validationErrors = this._validate(scopeData, memory);

      // If still invalid after repair, fail
      if (validationErrors.length > 0) {
        throw new Error(`Scope planning failed validation after repair: ${validationErrors.map(e => e.message).join('; ')}`);
      }
    }

    // Return ScopePlan instance
    return new ScopePlan(
      scopeData.boxes,
      scopeData.ops,
      scopeData.assign
    );
  }

  /**
   * Call LLM with prompt data
   * @private
   */
  async _callLLM(promptData) {
    // Load template if not already loaded
    if (!this.scopePromptTemplate) {
      const templatePath = join(__dirname, '../../prompts/scope-planning.hbs');
      this.scopePromptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.scopePromptTemplate,
      responseSchema: this.scopeSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute(promptData);

    if (!result.success) {
      throw new Error(`Scope planning failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }

  /**
   * Validate scope plan
   * @private
   * @returns {Array} Array of validation errors
   */
  _validate(scopeData, memory) {
    const errors = [];
    const validBoxes = new Set(scopeData.boxes);
    const validEntityIds = new Set(memory.entities.map(e => e.id));
    const validEventIds = new Set(memory.events.map(e => e.id));

    // Validate operators
    for (const op of scopeData.ops) {
      if (op.kind === 'Some' || op.kind === 'Every') {
        // Validate var is a valid entity ID
        if (!validEntityIds.has(op.var)) {
          errors.push(new Error(`Operator ${op.kind}: var "${op.var}" is not a valid entity ID`));
        }

        // Validate box reference
        const boxRef = op.kind === 'Some' ? op.in : op.over;
        if (!validBoxes.has(boxRef)) {
          errors.push(new Error(`Operator ${op.kind}: box "${boxRef}" does not exist in boxes array`));
        }
      } else if (op.kind === 'Not') {
        // Validate box reference
        if (!validBoxes.has(op.box)) {
          errors.push(new Error(`Operator Not: box "${op.box}" does not exist in boxes array`));
        }
      } else if (op.kind === 'If') {
        // Validate cond and then boxes
        if (!validBoxes.has(op.cond)) {
          errors.push(new Error(`Operator If: cond box "${op.cond}" does not exist in boxes array`));
        }
        if (!validBoxes.has(op.then)) {
          errors.push(new Error(`Operator If: then box "${op.then}" does not exist in boxes array`));
        }
      } else if (op.kind === 'Or') {
        // Validate left and right boxes
        if (!validBoxes.has(op.left)) {
          errors.push(new Error(`Operator Or: left box "${op.left}" does not exist in boxes array`));
        }
        if (!validBoxes.has(op.right)) {
          errors.push(new Error(`Operator Or: right box "${op.right}" does not exist in boxes array`));
        }
      }
    }

    // Validate all entities are assigned exactly once
    const assignedEntities = new Set(Object.keys(scopeData.assign.entities));
    for (const entityId of validEntityIds) {
      if (!assignedEntities.has(entityId)) {
        errors.push(new Error(`Entity "${entityId}" is not assigned to any box`));
      }
    }

    // Validate all events are assigned exactly once
    const assignedEvents = new Set(Object.keys(scopeData.assign.events));
    for (const eventId of validEventIds) {
      if (!assignedEvents.has(eventId)) {
        errors.push(new Error(`Event "${eventId}" is not assigned to any box`));
      }
    }

    // Validate assigned boxes exist
    for (const [entityId, boxId] of Object.entries(scopeData.assign.entities)) {
      if (!validBoxes.has(boxId)) {
        errors.push(new Error(`Entity "${entityId}" assigned to non-existent box "${boxId}"`));
      }
    }

    for (const [eventId, boxId] of Object.entries(scopeData.assign.events)) {
      if (!validBoxes.has(boxId)) {
        errors.push(new Error(`Event "${eventId}" assigned to non-existent box "${boxId}"`));
      }
    }

    return errors;
  }
}
