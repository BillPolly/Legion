/**
 * GenericLLMPlanner - A configurable LLM-based planning system
 * 
 * This class replaces specialized planner classes with a single generic implementation
 * that can be configured for different planning tasks through configuration objects.
 */

import { LLMClient } from '@jsenvoy/llm';
import { ResponseValidator } from './ResponseValidator.js';
import { PromptBuilder } from './PromptBuilder.js';

class GenericLLMPlanner {
  constructor(llmClient, plannerConfig) {
    if (!llmClient) {
      throw new Error('LLM client is required');
    }
    
    if (!plannerConfig) {
      throw new Error('Planner configuration is required');
    }

    this.llmClient = llmClient;
    this.config = plannerConfig;
    this.plannerName = plannerConfig.name;
    
    // Initialize helper components
    this.responseValidator = new ResponseValidator(plannerConfig.responseSchema);
    this.promptBuilder = new PromptBuilder(plannerConfig.promptTemplate);
    
    // Store LLM configuration
    this.llmConfig = {
      temperature: plannerConfig.settings?.temperature || 0.1,
      maxTokens: plannerConfig.settings?.maxTokens || 2000
    };
  }

  /**
   * Execute the planning task
   * @param {Object} input - Input data for planning
   * @param {Object} context - Additional context for planning
   * @returns {Promise<Object>} Planning result
   */
  async execute(input, context = {}) {
    try {
      // Build the prompt from template and input
      const prompt = this.promptBuilder.build(input, context);
      
      // Generate response using LLM client directly
      const response = await this.llmClient.completeWithStructuredResponse(prompt, {
        temperature: this.llmConfig.temperature,
        maxTokens: this.llmConfig.maxTokens,
        schema: this.config.responseSchema
      });
      
      // Parse and validate the response
      const parsedResponse = this.parseResponse(response);
      
      // Validate against schema
      const validationResult = this.responseValidator.validate(parsedResponse);
      if (!validationResult.isValid) {
        throw new Error(`Invalid response format: ${validationResult.errors.join(', ')}`);
      }
      
      // Add metadata
      const result = {
        ...parsedResponse,
        metadata: {
          planner: this.plannerName,
          plannedAt: Date.now(),
          prompt: prompt.substring(0, 200) + '...', // First 200 chars for debugging
          ...parsedResponse.metadata
        }
      };
      
      return result;
      
    } catch (error) {
      throw new Error(`${this.plannerName} execution failed: ${error.message}`);
    }
  }

  /**
   * Parse LLM response to extract structured data
   * @param {Object} response - Raw LLM response
   * @returns {Object} Parsed response
   */
  parseResponse(response) {
    try {
      // Handle different response formats
      if (typeof response === 'string') {
        // Try to extract JSON from string response
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/```\s*([\s\S]*?)\s*```/) ||
                         response.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
        
        // If no JSON blocks found, try parsing the entire response
        return JSON.parse(response);
      }
      
      // If response is already an object
      if (typeof response === 'object') {
        return response;
      }
      
      throw new Error('Unable to parse response format');
      
    } catch (error) {
      throw new Error(`Response parsing failed: ${error.message}. Response: ${JSON.stringify(response).substring(0, 200)}...`);
    }
  }

  /**
   * Get mock response for testing
   * @param {string} scenarioKey - Key for mock scenario
   * @returns {Object} Mock response
   */
  getMockResponse(scenarioKey) {
    const mockResponse = this.config.mockResponses?.[scenarioKey];
    if (!mockResponse) {
      throw new Error(`Mock response not found for scenario: ${scenarioKey}`);
    }
    
    return {
      ...mockResponse,
      timestamp: Date.now(), // Always use current timestamp
      metadata: {
        planner: this.plannerName,
        plannedAt: Date.now(),
        mockScenario: scenarioKey
      }
    };
  }

  /**
   * Validate input against expected format
   * @param {Object} input - Input to validate
   * @returns {Object} Validation result
   */
  validateInput(input) {
    if (!input) {
      return { isValid: false, errors: ['Input is required'] };
    }

    // Basic validation - can be extended per planner type
    if (this.plannerName === 'RequirementAnalyzer') {
      if (!input.task) {
        return { isValid: false, errors: ['Task description is required'] };
      }
    }

    return { isValid: true, errors: [] };
  }

  /**
   * Get planner configuration
   * @returns {Object} Configuration object
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get planner name
   * @returns {string} Planner name
   */
  getName() {
    return this.plannerName;
  }

  /**
   * Get example inputs and outputs for testing
   * @returns {Array} Array of examples
   */
  getExamples() {
    return this.config.examples || [];
  }
}

export { GenericLLMPlanner };