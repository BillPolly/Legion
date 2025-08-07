/**
 * LLM Configuration Validator
 */

import { ConfigurationError } from '../../../foundation/types/errors/errors.js';

/**
 * Validate LLM configuration
 */
export class LLMConfigValidator {
  /**
   * Validate LLM configuration section
   * @param {Object} llmConfig - LLM configuration object
   * @param {Object} envVars - Environment variables
   * @throws {ConfigurationError} If validation fails
   */
  static validate(llmConfig, envVars = {}) {
    const errors = [];
    
    if (!llmConfig) {
      errors.push('LLM configuration is required');
      throw new ConfigurationError('LLM validation failed', 'llm', errors);
    }
    
    // Validate provider
    const validProviders = ['anthropic', 'openai'];
    if (llmConfig.provider && !validProviders.includes(llmConfig.provider)) {
      errors.push(`Invalid LLM provider: ${llmConfig.provider}. Valid providers: ${validProviders.join(', ')}`);
    }
    
    // Validate Anthropic configuration
    if (llmConfig.provider === 'anthropic' || llmConfig.anthropic) {
      this._validateAnthropic(llmConfig.anthropic, envVars, errors);
    }
    
    // Validate OpenAI configuration
    if (llmConfig.provider === 'openai' || llmConfig.openai) {
      this._validateOpenAI(llmConfig.openai, envVars, errors);
    }
    
    // Validate cost budget
    if (llmConfig.costBudget) {
      this._validateCostBudget(llmConfig.costBudget, errors);
    }
    
    if (errors.length > 0) {
      throw new ConfigurationError('LLM validation failed', 'llm', errors);
    }
  }
  
  /**
   * Validate Anthropic configuration
   * @param {Object} config - Anthropic config
   * @param {Object} envVars - Environment variables
   * @param {Array} errors - Error accumulator
   */
  static _validateAnthropic(config, envVars, errors) {
    if (!config) return;
    
    // Check API key
    if (!config.apiKey && !envVars.ANTHROPIC_API_KEY) {
      errors.push('Anthropic API key is required (ANTHROPIC_API_KEY)');
    }
    
    // Validate API key format
    if (config.apiKey && !config.apiKey.startsWith('sk-ant-')) {
      errors.push('Invalid Anthropic API key format');
    }
    
    // Validate model
    const validModels = [
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229', 
      'claude-3-opus-20240229',
      'claude-3-5-sonnet-20241022'
    ];
    
    if (config.model && !validModels.includes(config.model)) {
      errors.push(`Invalid Anthropic model: ${config.model}`);
    }
    
    // Validate parameters
    if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 100000)) {
      errors.push('Anthropic maxTokens must be between 1 and 100000');
    }
    
    if (config.temperature && (config.temperature < 0 || config.temperature > 1)) {
      errors.push('Anthropic temperature must be between 0 and 1');
    }
  }
  
  /**
   * Validate OpenAI configuration
   * @param {Object} config - OpenAI config
   * @param {Object} envVars - Environment variables
   * @param {Array} errors - Error accumulator
   */
  static _validateOpenAI(config, envVars, errors) {
    if (!config) return;
    
    // Check API key
    if (!config.apiKey && !envVars.OPENAI_API_KEY) {
      errors.push('OpenAI API key is required (OPENAI_API_KEY)');
    }
    
    // Validate API key format
    if (config.apiKey && !config.apiKey.startsWith('sk-')) {
      errors.push('Invalid OpenAI API key format');
    }
    
    // Validate model
    const validModels = [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
      'gpt-4',
      'gpt-4-32k',
      'gpt-4-turbo-preview',
      'gpt-4o',
      'gpt-4o-mini'
    ];
    
    if (config.model && !validModels.includes(config.model)) {
      errors.push(`Invalid OpenAI model: ${config.model}`);
    }
    
    // Validate parameters
    if (config.maxTokens && (config.maxTokens < 1 || config.maxTokens > 128000)) {
      errors.push('OpenAI maxTokens must be between 1 and 128000');
    }
    
    if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
      errors.push('OpenAI temperature must be between 0 and 2');
    }
  }
  
  /**
   * Validate cost budget configuration
   * @param {Object} costBudget - Cost budget config
   * @param {Array} errors - Error accumulator
   */
  static _validateCostBudget(costBudget, errors) {
    if (costBudget.enabled) {
      if (!costBudget.maxCostUSD || costBudget.maxCostUSD <= 0) {
        errors.push('Cost budget maxCostUSD must be a positive number');
      }
      
      if (costBudget.warningThreshold && (costBudget.warningThreshold < 0 || costBudget.warningThreshold > 1)) {
        errors.push('Cost budget warningThreshold must be between 0 and 1');
      }
    }
  }
}