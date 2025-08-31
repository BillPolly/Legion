/**
 * Planner - Simple, focused BT plan generation
 * 
 * Clean API for generating validated behavior tree plans.
 * Takes requirements and tools, returns a valid BT structure.
 */

import { BTValidator } from '@legion/bt-validator';
import { Prompt } from './Prompt.js';
import { extractJSON } from '../utils/json-parser.js';

export class Planner {
  /**
   * Create a planner instance
   * @param {Object} options - Configuration options
   * @param {Object} options.llmClient - LLM client for generation
   * @param {Array} options.tools - Default tools (optional)
   */
  constructor({ llmClient, tools = null }) {
    if (!llmClient) {
      throw new Error('Planner requires an llmClient');
    }
    
    this.llmClient = llmClient;
    this.defaultTools = tools; // Can be null, set at construction
    
    // Initialize validator - always strict, always validate tools
    this.validator = new BTValidator({
      strictMode: true,
      validateTools: true,
      applyDefaults: true
    });
    
    // Just need an instance of Prompt
    this.prompt = new Prompt();
    
    // Default LLM options
    this.llmOptions = {
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.2,
      maxTokens: 4000,
      system: 'You are a JSON generator. Return ONLY valid JSON with no additional text, markdown, or explanations.'
    };
  }

  /**
   * Public API - Create a validated BT plan
   * @param {string} requirements - Task description/requirements
   * @param {Array} tools - Optional array of tools (uses default if not provided)
   * @param {Object} options - Optional generation options
   * @returns {Promise<Object>} ToolResult with plan or error
   */
  async makePlan(requirements, tools = null, options = {}) {
    // Input validation
    if (!requirements || typeof requirements !== 'string') {
      return {
        success: false,
        error: 'Requirements must be a non-empty string',
        data: null
      };
    }
    
    // Determine which tools to use
    const toolsToUse = tools || this.defaultTools;
    
    if (!toolsToUse || toolsToUse.length === 0) {
      return {
        success: false,
        error: 'No tools available. Provide tools in makePlan() or constructor.',
        data: null
      };
    }
    
    const maxAttempts = options.maxAttempts || 3;
    let lastValidation = null;
    let lastPlan = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (options.debug) {
          console.log(`[Planner] Attempt ${attempt}/${maxAttempts}`);
        }
        
        // First attempt or retry with fix
        const plan = attempt === 1 
          ? await this._createPlan(requirements, toolsToUse, options)
          : await this._fixPlan(requirements, toolsToUse, lastPlan, lastValidation, options);
        
        // Validate the plan
        const validation = await this._validatePlan(plan, toolsToUse);
        
        if (validation.valid) {
          // Success - return ToolResult format
          return {
            success: true,
            data: {
              plan: plan,
              attempts: attempt,
              nodeCount: this._countNodes(plan)
            },
            error: null
          };
        }
        
        // Not valid, save for next attempt
        lastPlan = plan;
        lastValidation = validation;
        
      } catch (error) {
        if (options.debug) {
          console.error(`[Planner] Attempt ${attempt} failed:`, error.message);
        }
        // Create validation object for generation errors
        lastValidation = { 
          valid: false,
          errors: [{ 
            type: 'generation', 
            message: error.message 
          }] 
        };
        lastPlan = null;
      }
    }
    
    // All attempts failed - return error result
    return {
      success: false,
      error: `Failed to create valid plan after ${maxAttempts} attempts`,
      data: {
        lastPlan: lastPlan,
        attempts: maxAttempts,
        validation: lastValidation
      }
    };
  }

  /**
   * Internal - Create initial plan
   */
  async _createPlan(requirements, tools, options = {}) {
    // Get the initial prompt from Prompt class
    const prompt = this.prompt.getInitialPrompt(requirements, tools);
    
    // Save prompt to file for debugging
    if (options.saveDebugFiles) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const timestamp = Date.now();
      const debugDir = path.join(process.cwd(), '__tests__', 'debug');
      await fs.mkdir(debugDir, { recursive: true });
      
      const promptFile = path.join(debugDir, `prompt-${timestamp}.txt`);
      await fs.writeFile(promptFile, prompt, 'utf-8');
      console.log(`[DEBUG] Prompt saved to: ${promptFile}`);
    }
    
    // Add debug prompt logging (only if debug option is enabled)
    if (options.debug) {
      console.log('\n=== FULL PROMPT SENT TO LLM ===');
      console.log(prompt);
      console.log('=== END PROMPT ===\n');
    }
    
    // Merge LLM options with any overrides
    const llmOptions = {
      ...this.llmOptions,
      ...(options.llmOptions || {})
    };
    
    const response = await this.llmClient.complete(prompt, llmOptions.maxTokens);
    
    // Save response to file for debugging
    if (options.saveDebugFiles) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const timestamp = Date.now();
      const debugDir = path.join(process.cwd(), '__tests__', 'debug');
      
      const responseFile = path.join(debugDir, `response-${timestamp}.txt`);
      await fs.writeFile(responseFile, response, 'utf-8');
      console.log(`[DEBUG] Response saved to: ${responseFile}`);
    }
    
    // Always log the full response during debugging (only if debug option is enabled)
    if (options.debug) {
      console.log('\n=== FULL LLM RESPONSE ===');
      console.log(response);
      console.log('=== END LLM RESPONSE ===\n');
    }
    
    if (options.debugResponse) {
      console.log('[Planner] LLM response:', response.substring(0, 500) + '...');
    }
    
    return extractJSON(response);
  }

  /**
   * Internal - Fix a failed plan
   */
  async _fixPlan(requirements, tools, failedPlan, validation, options = {}) {
    // Get the fix prompt from Prompt class - just pass the whole validation object
    const prompt = this.prompt.getFixPrompt(requirements, tools, failedPlan, validation);
    
    if (options.debugPrompt) {
      console.log('[Planner] Fix plan prompt:', prompt.substring(0, 500) + '...');
    }
    
    // Use slightly higher temperature for variation
    const llmOptions = {
      ...this.llmOptions,
      temperature: 0.3,
      ...(options.llmOptions || {})
    };
    
    const response = await this.llmClient.complete(prompt, llmOptions.maxTokens);
    
    if (options.debugResponse) {
      console.log('[Planner] Fix response:', response.substring(0, 500) + '...');
    }
    
    return extractJSON(response);
  }

  /**
   * Internal - Validate plan structure and tools
   */
  async _validatePlan(plan, tools) {
    return await this.validator.validate(plan, tools);
  }
  
  /**
   * Update default tools
   * @param {Array} tools - New default tools
   */
  setDefaultTools(tools) {
    if (!Array.isArray(tools)) {
      throw new Error('Tools must be an array');
    }
    this.defaultTools = tools;
  }
  
  /**
   * Get current default tools
   * @returns {Array|null} Default tools or null
   */
  getDefaultTools() {
    return this.defaultTools;
  }
  
  /**
   * Count nodes in a BT structure
   * @param {Object} node - BT node
   * @returns {number} Total node count
   */
  _countNodes(node) {
    if (!node) return 0;
    
    let count = 1; // Count this node
    
    // Count children if they exist
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += this._countNodes(child);
      }
    }
    
    // Count single child if it exists
    if (node.child) {
      count += this._countNodes(node.child);
    }
    
    return count;
  }
}