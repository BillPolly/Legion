/**
 * Stage1_MentionExtraction - Extract mentions from text using LLM
 *
 * This stage:
 * 1. Uses LLM with structured output to extract mentions
 * 2. LLM outputs specific entity types (e.g., "person", "company", "fruit")
 * 3. Looks up type strings in WordNet to get synset objects
 * 4. Validates mentions (span bounds, text matching, etc.)
 * 5. Attempts repair if validation fails (one attempt)
 */

import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DiscourseMemory } from '../types/DiscourseMemory.js';
import { Mention } from '../types/Mention.js';
import { TemplatedPrompt } from '@legion/prompting-manager';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Stage1_MentionExtraction {
  constructor(llmClient, semanticInventory) {
    this.llmClient = llmClient;
    this.semanticInventory = semanticInventory;

    // Load schema
    const schemaPath = join(__dirname, '../../schemas/MentionSchema.json');
    this.mentionSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    // Template will be loaded on first use
    this.mentionPromptTemplate = null;
  }

  /**
   * Process discourse memory to extract mentions
   * @param {DiscourseMemory} memory - Input discourse memory
   * @returns {Promise<DiscourseMemory>} - Memory with mentions populated
   */
  async process(memory) {
    // Prepare prompt data (no type constraint - LLM outputs specific types)
    const promptData = {
      text: memory.text,
      schema: this.mentionSchema
    };

    // First attempt
    let mentions = await this._callLLM(promptData);
    let validationErrors = this._validate(mentions, memory);

    // If validation failed, attempt repair (one attempt)
    if (validationErrors.length > 0) {
      // Add error feedback for repair
      promptData.errors = validationErrors.map(e => e.message);

      mentions = await this._callLLM(promptData);
      validationErrors = this._validate(mentions, memory);

      // If still invalid after repair, fail
      if (validationErrors.length > 0) {
        throw new Error(`Mention extraction failed validation after repair: ${validationErrors.map(e => e.message).join('; ')}`);
      }
    }

    // Calculate spans and IDs programmatically
    const mentionsWithSpans = this._calculateSpans(mentions, memory.text);

    // Convert plain objects to Mention instances with synset lookup
    const mentionInstances = await Promise.all(mentionsWithSpans.map(async m => {
      const typeSynset = await this._lookupTypeSynset(m.coarseType);
      return new Mention(m.id, m.span, m.text, m.head, typeSynset, m.sentenceId);
    }));

    // Return updated DiscourseMemory
    return new DiscourseMemory(
      memory.text,
      memory.sentences,
      mentionInstances,
      memory.entities,
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
    if (!this.mentionPromptTemplate) {
      const templatePath = join(__dirname, '../../prompts/mention-extraction.hbs');
      this.mentionPromptTemplate = await readFile(templatePath, 'utf-8');
    }

    // Create TemplatedPrompt
    const templatedPrompt = new TemplatedPrompt({
      prompt: this.mentionPromptTemplate,
      responseSchema: this.mentionSchema,
      llmClient: this.llmClient,
      maxRetries: 3
    });

    // Execute with variables
    const result = await templatedPrompt.execute(promptData);

    if (!result.success) {
      throw new Error(`Mention extraction failed: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    return result.data;
  }


  /**
   * Validate mentions
   * @private
   * @returns {Array} Array of validation errors
   */
  _validate(mentions, memory) {
    const errors = [];

    for (const mention of mentions) {
      // Validate text is non-empty
      if (!mention.text || typeof mention.text !== 'string' || mention.text.trim().length === 0) {
        errors.push(new Error(`Mention: text must be a non-empty string`));
        continue;
      }

      // Validate head is non-empty
      if (!mention.head || typeof mention.head !== 'string' || mention.head.trim().length === 0) {
        errors.push(new Error(`Mention "${mention.text}": head must be a non-empty string`));
        continue;
      }

      // Validate coarseType is a non-empty string
      if (!mention.coarseType || typeof mention.coarseType !== 'string') {
        errors.push(new Error(`Mention "${mention.text}": coarseType must be a non-empty string`));
        continue;
      }

      // Validate sentenceId is valid
      if (mention.sentenceId < 0 || mention.sentenceId >= memory.sentences.length) {
        errors.push(new Error(`Mention "${mention.text}": invalid sentenceId ${mention.sentenceId}`));
        continue;
      }
    }

    return errors;
  }

  /**
   * Calculate character spans and generate IDs for mentions
   * @private
   * @param {Array} mentions - Mentions from LLM (with text, head, coarseType, sentenceId)
   * @param {string} sourceText - Original text to search in
   * @returns {Array} Mentions with id and span fields added
   */
  _calculateSpans(mentions, sourceText) {
    const result = [];
    let searchOffset = 0; // Track position for duplicate text handling

    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i];

      // Generate unique ID
      const id = `m${i + 1}`;

      // Find mention text in source text starting from searchOffset
      const start = sourceText.indexOf(mention.text, searchOffset);

      if (start === -1) {
        throw new Error(`Cannot find mention text "${mention.text}" in source text starting from position ${searchOffset}`);
      }

      const end = start + mention.text.length;

      // Verify the extracted text matches
      const extractedText = sourceText.substring(start, end);
      if (extractedText !== mention.text) {
        throw new Error(`Extracted text "${extractedText}" doesn't match mention text "${mention.text}"`);
      }

      // Update searchOffset to prevent finding the same occurrence again
      searchOffset = end;

      // Add id and span to mention
      result.push({
        id,
        span: { start, end },
        text: mention.text,
        head: mention.head,
        coarseType: mention.coarseType,
        sentenceId: mention.sentenceId
      });
    }

    return result;
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
