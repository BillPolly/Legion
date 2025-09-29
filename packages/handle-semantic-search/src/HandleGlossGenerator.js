/**
 * HandleGlossGenerator - Generates descriptive glosses for handles
 *
 * Uses TemplatedPrompt with querySpec to generate multiple perspective-based
 * descriptions (glosses) that capture what a handle represents.
 */

import { TemplatedPrompt, EnhancedPromptRegistry } from '@legion/prompting-manager';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HandleGlossGenerator {
  /**
   * Create HandleGlossGenerator
   * @param {Object} llmClient - LLM client for gloss generation
   */
  constructor(llmClient) {
    if (!llmClient) {
      throw new Error('LLM client is required for HandleGlossGenerator');
    }

    this.llmClient = llmClient;
    this.promptRegistry = null;
    this.prompts = new Map();
  }

  /**
   * Initialize the gloss generator
   * Loads prompt templates from the prompts directory
   */
  async initialize() {
    // Initialize prompt registry
    const promptsDir = path.join(__dirname, '../prompts');
    this.promptRegistry = new EnhancedPromptRegistry(promptsDir);

    // Load all prompts from directory
    await this.promptRegistry.loadDirectory('.');

    // Create TemplatedPrompt instances for each handle type
    await this._initializePrompts();
  }

  /**
   * Initialize TemplatedPrompt instances for handle types
   * @private
   */
  async _initializePrompts() {
    // Load filesystem prompt
    try {
      const filesystemPromptDef = await this.promptRegistry.load('filesystem-gloss');
      if (filesystemPromptDef) {
        this.prompts.set('filesystem', new TemplatedPrompt({
          prompt: filesystemPromptDef.content,
          responseSchema: filesystemPromptDef.metadata.responseSchema,
          llmClient: this.llmClient,
          querySpec: filesystemPromptDef.metadata.querySpec,
          maxRetries: 3
        }));
      }
    } catch (error) {
      console.warn('Failed to load filesystem prompt:', error.message);
    }

    // Load generic prompt
    try {
      const genericPromptDef = await this.promptRegistry.load('generic-gloss');
      if (genericPromptDef) {
        this.prompts.set('generic', new TemplatedPrompt({
          prompt: genericPromptDef.content,
          responseSchema: genericPromptDef.metadata.responseSchema,
          llmClient: this.llmClient,
          querySpec: genericPromptDef.metadata.querySpec,
          maxRetries: 3
        }));
      }
    } catch (error) {
      console.warn('Failed to load generic prompt:', error.message);
    }
  }

  /**
   * Select appropriate prompt for handle type
   * @param {string} handleType - Type of handle
   * @returns {TemplatedPrompt} Prompt template for handle type
   */
  selectPrompt(handleType) {
    // Try to get specific prompt for handle type
    const prompt = this.prompts.get(handleType);
    if (prompt) {
      return prompt;
    }

    // Fall back to generic prompt
    const genericPrompt = this.prompts.get('generic');
    if (!genericPrompt) {
      throw new Error('Generic prompt not found - HandleGlossGenerator not properly initialized');
    }

    return genericPrompt;
  }

  /**
   * Generate glosses for a handle
   * @param {Object} handleMetadata - Metadata extracted from handle
   * @returns {Promise<Array>} Array of generated glosses
   */
  async generateGlosses(handleMetadata) {
    if (!handleMetadata) {
      throw new Error('Handle metadata is required for gloss generation');
    }

    // Select appropriate prompt
    const handleType = handleMetadata.handleType || 'generic';
    const prompt = this.selectPrompt(handleType);

    // Execute prompt with metadata
    const result = await prompt.execute(handleMetadata);

    if (!result.success) {
      throw new Error(`Failed to generate glosses: ${result.errors.join(', ')}`);
    }

    // Return the glosses array
    return result.data.glosses || [];
  }
}